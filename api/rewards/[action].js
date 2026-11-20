// Special rewards (see api/_lib/rewards.js and public/data/rewards.json).
//   POST /api/rewards/claim  {source: 'mission', n, stars, downs, time, gold} | {source: 'cache', id}   (login required)
//        -> {item: {id, tier, name, icon}, serial, cap, season} | {consolation: {coins}} | {miss: true}
//   GET  /api/rewards/mine    -> {items: [{id, tier, serial, minted, season}]}                          (login required)
//   GET  /api/rewards/rarity  -> {season, active, items: [{id, tier, minted, cap, firstOwner}], vault}  (public "Raridade" page)
import { endpoint, fail, actionOf } from '../_lib/http.js';
import { requireUser } from '../_lib/auth.js';
import { sqlStore, loadConfig, claim, capFor } from '../_lib/rewards.js';

export default endpoint({
  POST: async ({ req, sql, body }) => {
    if (actionOf(req) !== 'claim') throw fail(404, 'not-found');
    const user = await requireUser(sql, req), store = sqlStore(sql);
    await store.ensure();
    return claim(store, loadConfig(), user, body);
  },
  GET: async ({ req, sql }) => {
    const act = actionOf(req), cfg = loadConfig(), store = sqlStore(sql);
    await store.ensure();
    if (act === 'mine') {
      const user = await requireUser(sql, req);
      return { items: (await store.owned(user.id)).map((r) => ({ id: r.item_id, tier: r.tier, serial: r.serial, minted: r.minted, season: r.season })) };
    }
    if (act !== 'rarity') throw fail(404, 'not-found');
    const active = await store.activePlayers(), rows = await store.supply(cfg.season);
    return {
      season: cfg.season, active,
      items: cfg.items.map((i) => { const r = rows.find((x) => x.item_id === i.id); return { id: i.id, tier: i.tier, minted: r ? r.minted : 0, cap: capFor(i.tier, active, cfg.ratios), firstOwner: (r && r.first_owner) || null }; }),
      vault: await store.vault(cfg.vault.goal),
    };
  },
});
