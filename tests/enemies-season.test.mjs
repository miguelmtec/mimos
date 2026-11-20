// feat/enemies-season content + logic checks (no browser): enemy roster, enemy missions, clinic, seasons.   node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { PRODUCTS } from '../api/pix/_products.js';
const json = async f => JSON.parse(await readFile(new URL('../public/data/' + f, import.meta.url), 'utf8'));
// the pure helpers of the browser modules run in a bare context (they stop before touching the DOM)
async function load(files) {
  const VP = { U: { clamp: (v, a, b) => (v < a ? a : v > b ? b : v) }, L: {}, lang: () => 'pt', S: { unlocked: 7 }, t: k => k };
  for (const f of files) vm.runInNewContext(await readFile(new URL('../public/js/' + f, import.meta.url), 'utf8'), { window: { VP }, console });
  return VP;
}
const bi = o => o && typeof o.pt === 'string' && o.pt && typeof o.en === 'string' && o.en;
const GORE = /\b(kill|blood|gore|dead|death|die[sd]?|gun|weapon|mat(a|ar|ou)|morr\w*|morte|sangue|arma|tiro de)\b/i;
const GAMBLE = /loot|sorte(io)?\b|gacha|roleta|roulette|chance|random|aleat|caixa surpresa|mystery|spin/i;

test('enemies.json: six cartoon enemies with stats, districts, levels and a 3-phase boss', async () => {
  const d = await json('enemies.json');
  assert.deepEqual(Object.keys(d.enemies).sort(), ['aspirador', 'pepino', 'pombo', 'pulga', 'rato', 'robo']);
  const behaviors = new Set();
  for (const [id, e] of Object.entries(d.enemies)) {
    assert.ok(bi(e.name) && bi(e.tip), id + ' texts');
    assert.ok(e.hp > 0 && e.spd > 0 && e.r > 0 && e.dmg >= 0 && e.coins > 0 && e.minLevel >= 1, id + ' stats');
    assert.ok(e.districts.length && e.districts.every(x => x >= 0 && x <= 4), id + ' districts');
    assert.ok(e.group[0] >= 1 && e.group[1] >= e.group[0] && e.group[1] <= 6, id + ' group');
    assert.ok(['confetti', 'flee'].includes(e.defeat), id + ' is never killed: confetti or running away');
    assert.ok(e.dmg <= 8, id + ' stays gentle'); behaviors.add(e.behavior);
  }
  assert.equal(behaviors.size, 6, 'one behaviour each');
  assert.ok(d.enemies.pulga.minLevel === 1 && d.enemies.pulga.districts.includes(0), 'a new player meets something in Sunset Beach');
  assert.ok(d.cap.total <= 40 && d.cap.awake <= d.cap.total && d.cap.shots <= 64, 'caps for mobile');
  for (const k of ['bolt', 'bite', 'roar', 'snatch']) assert.ok(['mimo', 'mimosa', 'morticia'].includes(d.abilities[k].cat) && bi(d.abilities[k].note));
  const b = d.bosses.carrocinha; assert.equal(b.phases.length, 3); assert.ok(bi(b.name) && b.defeat === 'flee');
  let prev = 1; for (const p of b.phases) { assert.ok(p.until < prev && p.moves.length >= 2 && bi(p.label)); prev = p.until; } assert.equal(prev, 0);
  assert.ok(!GORE.test(JSON.stringify(d)), 'kid-safe wording');
});

test('enemy stats scale with the level (and stay bounded)', async () => {
  const VP = await load(['enemies.js']), E = VP.Enemies, d = await json('enemies.json');
  for (const t of E.TYPES) {
    const a = E.stats(t, 1, d), b = E.stats(t, 20, d), c = E.stats(t, 60, d), z = E.stats(t, 500, d);
    assert.equal(a.hp, d.enemies[t].hp); assert.ok(b.hp > a.hp && c.hp >= b.hp && b.spd >= a.spd && b.coins >= a.coins, t + ' grows');
    assert.deepEqual({ ...z }, { ...E.stats(t, 5000, d) }, t + ' is capped'); assert.ok(c.hp <= a.hp * 3 && c.spd <= a.spd * 1.2, t + ' bounded');
  }
  assert.equal(E.eligible(0, 1, d).join(), 'pulga'); assert.ok(E.eligible(1, 40, d).length >= 4); assert.equal(E.eligible(4, 1, d).length, 0);
  assert.equal(E.groupSize('pulga', 1, d), 4); assert.ok(E.groupSize('pulga', 40, d) <= 6); assert.equal(E.groupSize('aspirador', 40, d), 1);
  assert.equal(E.playerLevel(), 7); VP.Progress = { level: () => 23 }; assert.equal(E.playerLevel(), 23, 'uses feat/progression levels when present');
  for (const t of E.TYPES) assert.ok(['mimo', 'mimosa', 'morticia'].includes(E.HINT[t]));
});

test('missions_enemies.json: 15+ missions on ids 400-449 that do not clash with missions.json', async () => {
  const d = await json('missions_enemies.json'), base = await json('missions.json'), en = await json('enemies.json'), used = new Set(base.missions.map(m => m.n)), ns = new Set();
  const TYPES = ['foe_hunt', 'foe_waves', 'foe_recover', 'foe_survive', 'foe_boss', 'clinic_visit'];
  assert.ok(d.missions.length >= 15);
  for (const x of base.districts) assert.ok(x.to < 400 || x.from > 549, 'no base district overlaps 400-549');
  for (const m of d.missions) {
    assert.ok(m.n >= 400 && m.n <= 449 && !used.has(m.n) && !ns.has(m.n), 'id ' + m.n); ns.add(m.n);
    assert.ok(TYPES.includes(m.type) && bi(m.name) && m.lv >= 1 && m.par >= 30, 'fields of ' + m.n);
    assert.ok(d.districts.some(x => m.n >= x.from && m.n <= x.to), 'district of ' + m.n);
    if (m.params.time && m.type !== 'foe_survive') assert.ok(m.params.time >= m.par * 0.6, 'timer vs par in ' + m.n);
    const foes = [].concat(...(m.params.foes || []).map(f => (Array.isArray(f) ? [f[0]] : [f])), ...(m.params.waves || []), ...(m.params.fight || []).map(f => f[0]));
    for (const f of foes) assert.ok(en.enemies[f], 'enemy ' + f + ' in ' + m.n);
    if (m.type === 'foe_boss') assert.ok(en.bosses[m.params.boss]);
    for (const l of m.talk || []) assert.ok(['mimo', 'mimosa', 'morticia'].includes(l[0]) && l[1] && l[2]);
  }
  for (const x of d.districts) { const lv = d.missions.filter(m => m.n >= x.from && m.n <= x.to).map(m => m.lv); assert.equal(lv.length, 10, 'chapter ' + x.key); assert.ok(x.key && x.arc && bi(x.name) && bi(x.intro) && x.req); for (let i = 1; i < lv.length; i++) assert.ok(lv[i] >= lv[i - 1] && lv[i] - lv[i - 1] <= 3, x.key + ': ' + lv); }
  assert.ok(new Set(d.missions.map(m => m.type)).size >= 6, 'every new template in use');
  assert.ok(!GORE.test(JSON.stringify(d)), 'kid-safe wording');
});

test('clinic.json: services, kid tips and an empty sponsor slot', async () => {
  const d = await json('clinic.json'), VP = await load(['clinic.js']), C = VP.Clinic;
  assert.ok(bi(d.name) && bi(d.vet.name) && d.footprint.length === 4);
  for (const s of ['heal', 'checkup', 'vaccine']) assert.ok(bi(d.services[s].name) && bi(d.services[s].desc));
  assert.equal(d.services.vaccine.count, 3, 'the vet counts 3-2-1');
  assert.ok(d.tips.length >= 8); for (const t of d.tips) assert.ok(bi(t) && t.icon);
  const all = d.tips.map(t => t.pt).join(' ').toLowerCase(); for (const w of ['água', 'vacina', 'castra', 'adot']) assert.ok(all.includes(w), 'tip about ' + w);
  assert.ok(!/R\$|\bprice\b|preço/i.test(JSON.stringify(d)), 'nothing is sold at the clinic');
  assert.ok(d.sponsor.active === false && d.sponsor.name === null && d.sponsor.awaitingOwnerApproval === true);
  assert.deepEqual({ on: C.sponsorOf(d, 'pt').on, name: C.sponsorOf(d, 'pt').name }, { on: false, name: '' });
  assert.equal(C.sponsorOf(d, 'pt', true).name, d.sponsor.placeholder.pt, 'preview shows the placeholder');
  const on = C.sponsorOf({ sponsor: { active: true, name: 'Clínica Exemplo', url: 'javascript:alert(1)', tagline: { pt: 'oi', en: 'hi' } } }, 'en');
  assert.ok(on.on && on.name === 'Clínica Exemplo' && on.tagline === 'hi' && on.url === null, 'only https links');
  assert.equal(C.sponsorOf({ sponsor: { active: true, name: null } }, 'pt').on, false, 'active without a name stays off');
  assert.equal(C.dayKey(new Date(2026, 11, 5)), 20261205);
  for (let i = -3; i < 30; i++) { const k = C.tipIndex(20261205, d.tips.length, i); assert.ok(k >= 0 && k < d.tips.length); }
});

test('seasons: every file listed, valid dates, no overlap; skeletons for the next five', async () => {
  const ix = await json('seasons/index.json'), defs = [];
  for (const id of ix.seasons) { const d = await json('seasons/' + id + '.json'); assert.equal(d.id, id); defs.push(d); }
  assert.deepEqual(ix.seasons.slice().sort(), ['carnaval', 'dia_dos_animais', 'festa_junina', 'halloween', 'natal', 'pascoa']);
  const VP = await load(['season.js']), S = VP.Season;
  for (const d of defs) { assert.ok(S.validKey(d.start) && S.validKey(d.end) && d.start <= d.end && bi(d.name) && bi(d.theme) && d.icon, d.id); }
  for (const a of defs) for (const b of defs) if (a !== b) assert.ok(a.end < b.start || b.end < a.start, a.id + ' overlaps ' + b.id);
  const by = Object.fromEntries(defs.map(d => [d.id, d]));
  assert.ok(by.natal.start === '2026-12-01' && by.natal.end >= '2026-12-25' && by.natal.end <= '2027-01-06');
  assert.ok(by.carnaval.start.startsWith('2027-02')); assert.ok(S.isActive(by.dia_dos_animais, '2027-10-04'), 'Dia dos Animais covers October 4');
  assert.ok(S.isActive(by.halloween, '2027-10-31') && S.isActive(by.festa_junina, '2027-06-24') && S.isActive(by.pascoa, '2027-03-28'));
  for (const id of ['carnaval', 'pascoa', 'festa_junina', 'halloween', 'dia_dos_animais']) assert.ok(by[id].skeleton && !by[id].track && !by[id].pass && by[id].missions.length === 0, id + ' is a skeleton');
});

test('season date logic: inclusive range, URL override, off switch', async () => {
  const VP = await load(['season.js']), S = VP.Season, natal = await json('seasons/natal.json'), carn = await json('seasons/carnaval.json'), defs = [natal, carn];
  assert.equal(S.dateKey(new Date(2026, 11, 1)), '2026-12-01'); assert.equal(S.dateKey(new Date(2027, 0, 9)), '2027-01-09');
  assert.equal(S.isActive(natal, '2026-11-30'), false); assert.equal(S.isActive(natal, '2026-12-01'), true); assert.equal(S.isActive(natal, natal.end), true); assert.equal(S.isActive(natal, '2027-01-07'), false);
  assert.equal(S.isActive({ start: 'x', end: 'y' }, '2026-12-10'), false); assert.equal(S.isActive(null, '2026-12-10'), false);
  assert.equal(S.pick(defs, '2026-11-20'), null, 'today (before December) no season is on');
  assert.equal(S.pick(defs, '2026-12-24').id, 'natal'); assert.equal(S.pick(defs, '2027-02-07').id, 'carnaval');
  assert.equal(S.pick(defs, '2026-11-20', 'natal').id, 'natal', '?season=natal'); assert.equal(S.pick(defs, '2026-12-24', 'off'), null, '?season=off');
  assert.equal(S.pick(defs, '2026-12-24', 'nope').id, 'natal', 'unknown override falls back to the dates');
  assert.deepEqual({ ...S.params('?season=natal&seasondate=2026-12-10') }, { season: 'natal', date: '2026-12-10' });
  assert.deepEqual({ ...S.params('?x=1&seasondate=2026-13-45') }, { season: null, date: null }); assert.deepEqual({ ...S.params('') }, { season: null, date: null });
  assert.equal(S.daysLeft(natal, '2026-12-30'), 1); assert.equal(S.daysLeft(natal, '2027-02-01'), 0);
});

test('Natal Neon: 10+ missions on 500-549, free track with the four cosmetics, nothing random', async () => {
  const d = await json('seasons/natal.json'), base = await json('missions.json'), en = await json('missions_enemies.json'), VP = await load(['season.js']), S = VP.Season;
  const used = new Set(base.missions.concat(en.missions).map(m => m.n)), ns = new Set();
  assert.ok(d.missions.length >= 10); assert.ok(d.decor.lights && d.decor.snow && d.decor.trees && d.decor.santa && bi(d.santa.name));
  for (const m of d.missions) { assert.ok(m.n >= 500 && m.n <= 549 && !used.has(m.n) && !ns.has(m.n), 'id ' + m.n); ns.add(m.n); assert.ok(bi(m.name) && m.lv >= 1 && m.par >= 30 && m.n >= d.district.from && m.n <= d.district.to); if (m.params.time) assert.ok(m.params.time >= m.par * 0.6, 'timer of ' + m.n); }
  const lv = d.missions.map(m => m.lv); for (let i = 1; i < lv.length; i++) assert.ok(lv[i] >= lv[i - 1] && lv[i] - lv[i - 1] <= 3);
  const kinds = d.missions.map(m => m.type + ':' + (m.params.loot || m.params.kind || ''));
  assert.ok(kinds.some(k => k.startsWith('gift_run')), 'deliver gifts'); assert.ok(kinds.includes('foe_recover:gift'), 'recover the gifts the Pigeon stole');
  assert.ok(kinds.some(k => k.startsWith('runway')), 'ugly sweater contest'); assert.ok(d.missions.some(m => m.type === 'collect' && m.params.to === 'house'), 'decorate the Abrigo');
  // items + tracks
  const ids = new Set(d.items.map(i => i.id)), slots = ['head', 'eyes', 'neck', 'body', 'back', 'trail'], outfits = await json('outfits.json');
  assert.equal(ids.size, d.items.length); for (const it of d.items) { assert.ok(slots.includes(it.slot) && bi(it.name) && (it.slot === 'trail' ? it.trail && it.trail.col : it.acc && Object.keys(it.acc).length), it.id); assert.ok(!outfits.items.some(o => o.id === it.id), it.id + ' is a new id'); }
  const free = d.track.free, prem = d.track.premium, freeItems = free.filter(r => r.item).map(r => r.item);
  for (const need of ['natal26_gorro', 'natal26_cachecol', 'natal26_sueter_feio', 'natal26_chifres']) assert.ok(freeItems.includes(need), need + ' is on the FREE track');
  for (const r of free.concat(prem)) { assert.ok(r.tier >= 1 && r.tier <= d.track.tiers); if (r.item) assert.ok(ids.has(r.item), r.item); }
  assert.ok(free.length >= prem.length, 'the free track is at least as long as the paid one'); assert.ok(free.some(r => r.tier === d.track.tiers), 'the free track pays out at the last tier too');
  for (const r of prem) assert.deepEqual(Object.keys(r).sort(), ['item', 'tier'], 'paid track: cosmetics only (no coins, lives or power)');
  for (const r of free.concat(prem)) assert.equal(Object.keys(r).filter(k => !['tier', 'item', 'coins', 'lives'].includes(k)).length, 0, 'fixed rewards only');
  assert.ok(!GAMBLE.test(JSON.stringify({ t: d.track, p: d.points, i: d.items, pass: d.pass })), 'no loot boxes, no paid randomness');
  assert.ok(d.points.mission > 0 && d.track.tiers * d.track.tierPoints <= 31 * 40, 'the whole free track is reachable by playing during the season');
  // logic
  assert.equal(S.tier(0, d.track), 0); assert.equal(S.tier(29, d.track), 0); assert.equal(S.tier(30, d.track), 1); assert.equal(S.tier(99999, d.track), d.track.tiers); assert.equal(S.tier(60, d.track, 10), 12); assert.equal(S.tier(99999, d.track, 10), d.track.tiers);
  const st = { pts: 70, f: {}, p: {} };
  assert.equal(S.claimable(d, st, { pass: false, plus: false }).map(c => c.k + c.tier).join(), 'f1,f2');
  assert.ok(S.claimable(d, { pts: 99999, f: {}, p: {} }, { pass: false, plus: false }).every(c => c.k === 'f'), 'no premium reward without the pass');
  assert.equal(S.claimable(d, { pts: 70, f: { 1: 1, 2: 1 }, p: {} }, { pass: true, plus: false }).map(c => c.k + c.tier).join(), 'p2');
  assert.equal(S.claimable(d, { pts: 99999, f: {}, p: {} }, { pass: true, plus: true }).length, free.length + prem.length);
});

test('season pass: a hook only, with no price until the owner approves', async () => {
  const d = await json('seasons/natal.json'), p = d.pass, shop = await readFile(new URL('../public/js/shop.js', import.meta.url), 'utf8'), js = await readFile(new URL('../public/js/season.js', import.meta.url), 'utf8');
  assert.equal(p.price, null); assert.equal(p.plusPrice, null); assert.equal(p.awaitingOwnerApproval, true); assert.equal(p.cosmeticOnly, true);
  assert.ok(!/R\$\s*\d/.test(JSON.stringify(d)), 'no price anywhere in the season file');
  for (const id of [p.product, p.plusProduct]) { assert.ok(id && !PRODUCTS[id], id + ' is not for sale yet'); assert.ok(!shop.includes(id), id + ' has no client price'); }
  assert.ok(!/grants\[[^\]]*\]\s*=|P\.grants/.test(js), 'season.js never grants an entitlement by itself');
  for (const f of await Promise.all(['carnaval', 'pascoa', 'festa_junina', 'halloween', 'dia_dos_animais'].map(id => json('seasons/' + id + '.json')))) assert.ok(!/R\$|price/i.test(JSON.stringify(f)));
});

test('new modules: every string has pt-BR and en, hooks are marked', async () => {
  const VP = { L: {} }; // the string tables are plain object literals: Object.assign(VP.L, { key: ['pt', 'en'], ... });
  for (const f of ['enemies.js', 'boss.js', 'clinic.js', 'season.js']) {
    const src = await readFile(new URL('../public/js/' + f, import.meta.url), 'utf8'), re = /Object\.assign\(VP\.L[^,]*, (\{\n[\s\S]*?\n\})\);/g; let m, n = 0;
    while ((m = re.exec(src))) { Object.assign(VP.L, Function('return ' + m[1])()); n++; }
    assert.ok(n >= 1, f + ' has a string table');
  }
  const keys = Object.keys(VP.L); assert.ok(keys.length >= 40, 'strings found: ' + keys.length);
  for (const k of keys) assert.ok(Array.isArray(VP.L[k]) && VP.L[k].length === 2 && VP.L[k][0] && VP.L[k][1], 'string ' + k);
  assert.ok(!GORE.test(keys.map(k => VP.L[k].join(' ')).join(' ')), 'kid-safe strings');
  let hooks = 0; for (const f of ['public/index.html', 'public/js/game.js', 'public/js/gfx/render.js', 'public/js/hud.js', 'public/js/ui.js']) hooks += ((await readFile(new URL('../' + f, import.meta.url), 'utf8')).match(/\[hook:ext\]/g) || []).length;
  assert.equal(hooks, 8, 'eight one-line hooks in the existing files');
});
