// Scarcity engine: cap math, eligibility, rate limits and the claim race.
// The memory store below mirrors the semantics of the SQL in api/_lib/rewards.js (one atomic statement per method:
// `update … set minted = minted + 1 where minted < cap … returning`), with awaits between calls so that claims interleave.
import test from 'node:test';
import assert from 'node:assert/strict';
import { capFor, claim, loadConfig, dayKey } from '../api/_lib/rewards.js';

const tick = () => new Promise((r) => setImmediate(r));
function memStore(active, premium = new Set()) {
  const supply = new Map(), owners = new Map(), claims = new Set();
  return {
    supply, owners,
    async activePlayers() { await tick(); return active; },
    async isPremium(id) { await tick(); return premium.has(id); },
    async claimsOn(id, day) { await tick(); let n = 0; for (const k of claims) if (k.startsWith(id + '|' + day + '|')) n++; return n; },
    async logClaim(id, day, key) { await tick(); const k = id + '|' + day + '|' + key; if (claims.has(k)) return false; claims.add(k); return true; },
    async mint(item, season, tier, cap, rule, userId) {
      await tick();
      // --- atomic section (a single SQL statement on the real store) ---
      const k = item + '|' + season, s = supply.get(k) || { minted: 0, tier }; supply.set(k, s);
      if (s.minted >= cap || owners.has(k + '|' + userId)) return null;
      s.minted += 1; owners.set(k + '|' + userId, s.minted);
      // ------------------------------------------------------------------
      return s.minted;
    },
  };
}
const cfg = loadConfig();
const one = (tier) => ({ ...cfg, items: cfg.items.filter((i) => i.tier === tier).slice(0, 1), caches: [{ id: 'x', tier }], limits: { ...cfg.limits, claimsPerDay: 1000 } });
const win = (n) => ({ source: 'mission', n, stars: 3, downs: 0, time: 40, gold: true });

test('cap = ceil(active / ratio): 10 players -> 1 rare', () => {
  const r = cfg.ratios;
  assert.equal(capFor('raro', 10, r), 1);
  assert.equal(capFor('raro', 11, r), 2);
  assert.equal(capFor('raro', 1, r), 1);
  assert.equal(capFor('raro', 0, r), 0);
  assert.equal(capFor('raro', 230, r), 23);
  assert.equal(capFor('epico', 230, r), 5);
  assert.equal(capFor('lendario', 230, r), 2);
  assert.equal(capFor('lendario', 200, r), 1);
  assert.equal(capFor('unico', 100000, r), 1);
  assert.equal(capFor('nope', 100, r), 0);
  assert.deepEqual(r, { raro: 10, epico: 50, lendario: 200 });
});

test('data: every item has a tier, caches are valid, 25 Natal gifts', () => {
  for (const i of cfg.items) assert.ok(['raro', 'epico', 'lendario', 'unico'].includes(i.tier) && i.name.pt && i.name.en);
  assert.equal(cfg.caches.filter((c) => c.month === 12).length, 25);
  assert.ok(cfg.caches.some((c) => c.premium));
  assert.equal(new Set(cfg.caches.map((c) => c.id)).size, cfg.caches.length);
});

test('claim race: 200 players, 37 active -> exactly 4 copies, serials 1..4, the rest get a consolation', async () => {
  const store = memStore(37), c = one('raro');
  const res = await Promise.all(Array.from({ length: 200 }, (_, i) => claim(store, c, { id: 'u' + i }, { source: 'cache', id: 'x' }, { random: () => 0 })));
  const got = res.filter((r) => r.item);
  assert.equal(got.length, 4);
  assert.deepEqual(got.map((r) => r.serial).sort(), [1, 2, 3, 4]);
  assert.ok(got.every((r) => r.cap === 4));
  assert.equal(res.filter((r) => r.consolation).length, 196);
  assert.equal([...store.supply.values()][0].minted, 4);
});

test('único: a single copy per season, however many claim at once', async () => {
  const store = memStore(5000), c = one('unico');
  const res = await Promise.all(Array.from({ length: 300 }, (_, i) => claim(store, c, { id: 'u' + i }, { source: 'cache', id: 'x' }, { random: () => 0 })));
  assert.equal(res.filter((r) => r.item).length, 1);
  assert.equal(res.find((r) => r.item).serial, 1);
});

test('one player cannot take two copies, nor replay a claim', async () => {
  const store = memStore(1000), c = one('raro'), u = { id: 'solo' };
  const res = await Promise.allSettled(Array.from({ length: 20 }, () => claim(store, c, u, { source: 'cache', id: 'x' }, { random: () => 0 })));
  assert.equal(res.filter((r) => r.status === 'fulfilled' && r.value.item).length, 1);
  assert.equal(res.filter((r) => r.status === 'rejected' && r.reason.status === 409).length, 19);
  // same mission twice on the same day
  const s2 = memStore(1000); await claim(s2, c, u, win(7), { random: () => 0 });
  await assert.rejects(claim(s2, c, u, win(7), { random: () => 0 }), (e) => e.status === 409);
});

test('eligibility: 3 stars, no faints, gold time, sane duration; unknown or off-season caches refused', async () => {
  const store = memStore(100), u = { id: 'a' };
  for (const bad of [{ ...win(1), stars: 2 }, { ...win(1), downs: 1 }, { ...win(1), gold: false }, { ...win(1), time: 1 }, { ...win(1), n: 'x' }, { source: 'shop' }, {}])
    await assert.rejects(claim(store, cfg, u, bad), (e) => e.status === 400);
  await assert.rejects(claim(store, cfg, u, { source: 'cache', id: 'nope' }), (e) => e.status === 400);
  await assert.rejects(claim(store, cfg, u, { source: 'cache', id: 'natal_01' }, { now: new Date('2026-07-01T12:00:00Z') }), (e) => e.status === 400);
  const ok = await claim(store, cfg, u, { source: 'cache', id: 'natal_01' }, { now: new Date('2026-12-24T12:00:00Z'), random: () => 0 });
  assert.equal(ok.item.tier, 'raro');
});

test('premium: golden caches need it; it doubles the mission odds and never anything else', async () => {
  const u = { id: 'p' }, g = { id: 'g' };
  await assert.rejects(claim(memStore(100), cfg, g, { source: 'cache', id: 'g_01' }), (e) => e.status === 403);
  assert.ok((await claim(memStore(100, new Set(['p'])), cfg, u, { source: 'cache', id: 'g_01' }, { random: () => 0 })).item);
  // a roll of 0.2 misses at 12% and hits at 24%
  assert.deepEqual(await claim(memStore(100), cfg, g, win(3), { random: () => 0.2 }), { miss: true });
  assert.ok(!(await claim(memStore(100, new Set(['p'])), cfg, u, win(3), { random: () => 0.2 })).miss);
  assert.equal(cfg.sources.mission.premiumMult, 2);
});

test('rate limit per day', async () => {
  const store = memStore(100), c = { ...cfg, limits: { ...cfg.limits, claimsPerDay: 3 } }, u = { id: 'r' };
  for (let n = 1; n <= 3; n++) await claim(store, c, u, win(n), { random: () => 0.99 });
  await assert.rejects(claim(store, c, u, win(4)), (e) => e.status === 429);
  assert.ok(dayKey(new Date('2026-12-24T00:00:00Z')) === 20261224);
});

test('sold out everywhere -> consolation coins, never an error', async () => {
  const r = await claim(memStore(0), one('epico'), { id: 'z' }, { source: 'cache', id: 'x' }, { random: () => 0 });
  assert.equal(r.consolation.coins, cfg.consolation.coins);
});
