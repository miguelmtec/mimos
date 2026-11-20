// Special rewards with controlled scarcity. The server is the only authority on how many copies of an item exist.
//   cap = ceil(activePlayers / ratio)   (raro 1:10, épico 1:50, lendário 1:200; único = 1 per season)
// Ratios, items and sources live in public/data/rewards.json so the owner can tune them without touching code.
// Nothing here is bought: every claim comes from play (a mission result or a hidden cache). Premium only doubles the odds.
import { readFileSync } from 'node:fs';
import { fail } from './http.js';

let cfgCache = null;
export function loadConfig() {
  if (!cfgCache) cfgCache = JSON.parse(readFileSync(new URL('../../public/data/rewards.json', import.meta.url), 'utf8'));
  return cfgCache;
}
export const TIERS = ['raro', 'epico', 'lendario', 'unico'];

/** How many copies of an item of this tier may exist for `active` players. */
export function capFor(tier, active, ratios) {
  if (tier === 'unico') return 1;
  const r = Number(ratios && ratios[tier]);
  if (!(r > 0) || !(active > 0)) return 0;
  return Math.ceil(active / r);
}
export const dayKey = (d = new Date()) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

/** Neon-backed store. Every method is one statement, so each of them is atomic on its own. */
export function sqlStore(sql) {
  let ready = null;
  return {
    ensure() {
      return (ready = ready || (async () => {
        await sql`create table if not exists vp_item_supply (item_id text not null, season text not null, tier text not null, minted int not null default 0, cap_rule text not null default '', primary key (item_id, season))`;
        await sql`create table if not exists vp_item_owners (item_id text not null, season text not null, user_id uuid not null references vp_users(id) on delete cascade, serial int not null, earned_at timestamptz not null default now(), primary key (item_id, season, user_id), unique (item_id, season, serial))`;
        await sql`create table if not exists vp_reward_claims (user_id uuid not null references vp_users(id) on delete cascade, day int not null, key text not null, created_at timestamptz not null default now(), primary key (user_id, day, key))`;
        await sql`create table if not exists vp_vault_orders (id text primary key, created_at timestamptz not null default now())`;
      })().catch((e) => { ready = null; throw e; }));
    },
    async activePlayers() {
      const r = await sql`select count(*)::int as n from vp_users u where u.last_login_at > now() - interval '30 days' or exists (select 1 from vp_saves s where s.user_id = u.id and s.updated_at > now() - interval '30 days')`;
      return r[0] ? r[0].n : 0;
    },
    async isPremium(userId) {
      const r = await sql`select data->'p'->'grants' as g from vp_saves where user_id = ${userId}`;
      const g = r[0] && r[0].g; return !!(g && (g.vip || g.season));
    },
    /** Registers the claim attempt; false when this key was already used (replay) . */
    async logClaim(userId, day, key) {
      const r = await sql`insert into vp_reward_claims (user_id, day, key) values (${userId}, ${day}, ${key}) on conflict do nothing returning key`;
      return r.length > 0;
    },
    async claimsOn(userId, day) {
      const r = await sql`select count(*)::int as n from vp_reward_claims where user_id = ${userId} and day = ${day}`;
      return r[0] ? r[0].n : 0;
    },
    /** The atomic mint: one statement bumps `minted` only while it is below the cap and hands the serial to the player.
     *  Two concurrent claims can never both take the last copy; a player can never hold two copies of the same item. */
    async mint(itemId, season, tier, cap, rule, userId) {
      await sql`insert into vp_item_supply (item_id, season, tier, cap_rule) values (${itemId}, ${season}, ${tier}, ${rule}) on conflict do nothing`;
      const r = await sql`with m as (
          update vp_item_supply set minted = minted + 1
          where item_id = ${itemId} and season = ${season} and minted < ${cap}
            and not exists (select 1 from vp_item_owners o where o.item_id = ${itemId} and o.season = ${season} and o.user_id = ${userId})
          returning minted)
        insert into vp_item_owners (item_id, season, user_id, serial) select ${itemId}, ${season}, ${userId}, minted from m returning serial`;
      return r[0] ? r[0].serial : null;
    },
    async owned(userId) {
      return sql`select o.item_id, o.season, o.serial, o.earned_at, s.tier, s.minted from vp_item_owners o join vp_item_supply s on s.item_id = o.item_id and s.season = o.season where o.user_id = ${userId} order by o.earned_at`;
    },
    async supply(season) {
      return sql`select s.item_id, s.tier, s.minted, (select c.name from vp_item_owners o join vp_cats c on c.user_id = o.user_id where o.item_id = s.item_id and o.season = s.season and o.serial = 1 and c.is_public order by c.created_at limit 1) as first_owner from vp_item_supply s where s.season = ${season}`;
    },
    async vault(goal) {
      const r = await sql`select count(*)::int as n from vp_vault_orders`; const n = r[0] ? r[0].n : 0, fills = Math.floor(n / goal);
      let filledAt = null;
      if (fills > 0) { const f = await sql`select created_at from vp_vault_orders order by created_at, id offset ${fills * goal - 1} limit 1`; filledAt = f[0] ? new Date(f[0].created_at).toISOString() : null; }
      return { orders: n, goal, fills, filledAt };
    },
    async addOrder(id) { await sql`insert into vp_vault_orders (id) values (${id}) on conflict do nothing`; },
  };
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
/**
 * One claim. `body`: {source: 'mission', n, stars, downs, time, gold} or {source: 'cache', id}.
 * Returns {item, serial, cap, minted} | {consolation: {coins}} | {miss: true}.
 * Anti-cheat here is sanity checks + rate limits + one claim per mission per day / per cache per season; it keeps honest
 * clients honest and bounds what a scripted client can take, and the cap bounds it absolutely.
 */
export async function claim(store, cfg, user, body, opts = {}) {
  const rnd = opts.random || Math.random, now = opts.now || new Date(), day = dayKey(now), season = cfg.season;
  const src = body && body.source;
  let key, forced = null, chance = 1;
  if (src === 'mission') {
    if (!int(body.n, 1, 99999) || body.stars !== 3 || body.downs !== 0 || body.gold !== true) throw fail(400, 'not-eligible');
    if (typeof body.time !== 'number' || !(body.time >= cfg.limits.minMissionSeconds) || body.time > 3600) throw fail(400, 'not-eligible');
    key = 'm:' + body.n; chance = cfg.sources.mission.chance;
  } else if (src === 'cache') {
    const c = (cfg.caches || []).find((x) => x.id === body.id);
    if (!c) throw fail(400, 'unknown-cache');
    if (c.month && now.getUTCMonth() + 1 !== c.month) throw fail(400, 'out-of-season');
    if (c.premium && !(await store.isPremium(user.id))) throw fail(403, 'premium');
    key = 'c:' + c.id; forced = c.tier || null; chance = c.chance === undefined ? 1 : c.chance;
  } else throw fail(400, 'invalid', { field: 'source' });
  if ((await store.claimsOn(user.id, day)) >= cfg.limits.claimsPerDay) throw fail(429, 'rate');
  // a cache is claimed once per season (day 0), a mission once per day
  if (!(await store.logClaim(user.id, src === 'cache' ? 0 : day, key))) throw fail(409, 'already-claimed');
  if (src === 'mission' && (await store.isPremium(user.id))) chance = Math.min(1, chance * cfg.sources.mission.premiumMult);
  if (rnd() >= chance) return { miss: true };
  let tier = forced;
  if (!tier) { const w = cfg.sources.mission.tiers; let x = rnd() * Object.values(w).reduce((a, b) => a + b, 0); for (const t of Object.keys(w)) { x -= w[t]; if (x <= 0) { tier = t; break; } } tier = tier || 'raro'; }
  const pool = cfg.items.filter((i) => i.tier === tier && (!i.season || i.season === season));
  const consolation = { consolation: { coins: cfg.consolation.coins, tier } };
  if (!pool.length) return consolation;
  const active = await store.activePlayers();
  const cap = capFor(tier, active, cfg.ratios);
  // try the items of the tier in random order: the first one with a copy left (that the player does not own yet) is minted
  const order = pool.map((i) => [rnd(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  for (const item of order) {
    const serial = await store.mint(item.id, season, tier, cap, tier === 'unico' ? '1/season' : '1:' + cfg.ratios[tier], user.id);
    if (serial) return { item: { id: item.id, tier, name: item.name, icon: item.icon }, serial, cap, season };
  }
  return consolation;
}
