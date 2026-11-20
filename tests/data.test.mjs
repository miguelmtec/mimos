// Vice Paws content checks (no browser): missions, wardrobe, shop catalogue, city packs, events.   node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCTS } from '../api/pix/_products.js';
const json = async f => JSON.parse(await readFile(new URL('../public/data/' + f, import.meta.url), 'utf8'));
const TYPES = ['reach', 'waves', 'eat', 'steal', 'cash', 'rescue', 'truck', 'vault', 'escape', 'chase', 'race', 'defend', 'boss', 'escort', 'stealth', 'photo', 'chain', 'duel', 'parkour', 'kites', 'volley', 'fish', 'heist', 'kittens'];
const SAFE = ['deliver', 'treats', 'rescue', 'kites', 'kiterun', 'paws', 'photo', 'football', 'parkour', 'chain', 'groceries', 'fish', 'volley', 'feast'];

test('missions.json: 200+ missions, valid and bilingual', async () => {
  const d = await json('missions.json'), ns = new Set();
  assert.ok(d.missions.length >= 200, 'has ' + d.missions.length);
  for (const m of d.missions) {
    assert.ok(!ns.has(m.n), 'duplicate n ' + m.n); ns.add(m.n);
    assert.ok(TYPES.includes(m.type), 'type ' + m.type);
    assert.ok(m.name.pt && m.name.en && m.lv >= 1 && m.par >= 30, 'fields of ' + m.n);
    assert.ok(d.districts.some(x => m.n >= x.from && m.n <= x.to), 'district of ' + m.n);
    if (m.params && m.params.time) assert.ok(m.params.time >= m.par * 0.6, 'timer vs par in ' + m.n);
    for (const l of m.talk || []) assert.ok(['mimo', 'mimosa', 'morticia'].includes(l[0]) && l[1] && l[2], 'talk of ' + m.n);
  }
  d.districts.forEach((x, i) => assert.equal(x.id, i, 'district ids are their index'));
  for (const x of d.districts.filter(x => x.arc)) { assert.equal(d.missions.filter(m => m.n >= x.from && m.n <= x.to).length, 10, 'chapter ' + x.id); assert.ok(x.req.stars > 0 && x.intro.pt && x.intro.en); }
  assert.ok(new Set(d.missions.map(m => m.type)).size >= 24, 'all templates in use');
});

test('difficulty curve is smooth inside every chapter', async () => {
  const d = await json('missions.json');
  for (const x of d.districts.filter(x => x.arc)) { const lv = d.missions.filter(m => m.n >= x.from && m.n <= x.to).map(m => m.lv); for (let i = 1; i < lv.length; i++) assert.ok(lv[i] >= lv[i - 1] && lv[i] - lv[i - 1] <= 3, 'chapter ' + x.id + ': ' + lv); }
});

test('shop catalogue: fixed small prices, cosmetics and support only', async () => {
  const allowed = new Set(['vip', 'lives10', 'season', 'supporter', 'pack_praia', 'pack_agro', 'pack_festa', 'pack_natal']);
  for (const [id, p] of Object.entries(PRODUCTS)) {
    assert.ok(typeof p.price === 'number' && p.price >= 0.5 && p.price <= 20, id + ' price');
    assert.ok(p.title && Array.isArray(p.grants) && p.grants.every(g => allowed.has(g)), id + ' grants');
    assert.ok(!/dobro|doubl|2x|multipl|moeda|coin|sorte|loot|caixa/i.test(id + p.title + p.grants.join()), id + ' must not be a coin doubler or a loot box');
  }
  for (const id of ['supporter_small', 'skin_praia', 'skin_agro']) assert.equal(PRODUCTS[id].price, 0.99);
  for (const id of ['skin_festa', 'skin_natal']) assert.equal(PRODUCTS[id].price, 1.99);
  // the prices shown by the client are the server prices
  const shop = await readFile(new URL('../public/js/shop.js', import.meta.url), 'utf8'), shown = Function('return ' + /const PRICE = (\{[^}]+\})/.exec(shop)[1])();
  for (const [id, p] of Object.entries(PRODUCTS)) assert.equal(shown[id], p.price.toFixed(2).replace('.', ','), 'client price of ' + id);
  assert.deepEqual(Object.keys(shown).sort(), Object.keys(PRODUCTS).sort());
});

test('outfits.json: 60+ items, every paid item maps to a real product', async () => {
  const d = await json('outfits.json'), grants = new Set(Object.values(PRODUCTS).flatMap(p => p.grants)), ids = new Set();
  assert.ok(d.items.length >= 60, 'has ' + d.items.length);
  for (const it of d.items) {
    assert.ok(!ids.has(it.id), 'duplicate ' + it.id); ids.add(it.id);
    assert.ok(d.slots.includes(it.slot) && it.name.pt && it.name.en, it.id);
    assert.ok(it.free || it.price > 0 || grants.has(it.grant), it.id + ' needs free, a coin price or a grant that a product gives');
    assert.ok(it.slot === 'trail' ? it.trail && it.trail.col : it.acc && Object.keys(it.acc).length, it.id + ' look');
  }
  for (const sl of d.slots) assert.ok(d.items.filter(i => i.slot === sl).length >= 5, 'slot ' + sl);
  assert.ok(d.items.filter(i => i.grant === 'pack_natal' || i.grant === 'season').length >= 4, 'seasonal Natal items');
  for (const [g, pk] of Object.entries(d.packs)) assert.ok(PRODUCTS[pk.product] && PRODUCTS[pk.product].grants.includes(g), 'pack ' + g);
});

test('citypacks.json: 10 missions per pack, comunidade is positive only', async () => {
  const d = await json('citypacks.json');
  assert.equal(d.templates.length, 10); assert.equal(d.comunidade.length, 10);
  for (const m of d.comunidade) assert.ok(SAFE.includes(m.kind), 'comunidade kind ' + m.kind);
  for (const id of ['miami', 'rio', 'rioverde']) assert.equal(d.packs[id].missions.length, 10, id);
  const all = d.templates.concat(d.comunidade, ...Object.values(d.packs).map(p => p.missions));
  for (const m of all) { assert.ok(m.name.pt && m.name.en && m.story.pt && m.story.en, 'texts of ' + m.name.pt); assert.ok(!/pol[ií]cia|crime|gangue|droga|tr[aá]fico|arma\b|gang|drug/i.test(JSON.stringify(m.kind === 'escape' || m.kind === 'brawl' ? {} : m)), 'tone of ' + m.name.pt); }
  for (const m of d.comunidade.concat(d.packs.rioverde.missions)) assert.ok(!/cachorr|carrocinha|vira-lata|fuga|briga|dog|fight/i.test(JSON.stringify(m)), 'peaceful: ' + m.name.pt);
  for (const p of Object.values(d.packs)) for (const pl of p.places || []) assert.ok(typeof pl[0] === 'string' && Math.abs(pl[1]) <= 90 && Math.abs(pl[2]) <= 180);
});

test('city pack waypoints exist in the city data', async () => {
  const d = await json('citypacks.json');
  for (const id of ['miami', 'rio']) {
    let c; try { c = await json('cities/' + id + '.json'); } catch (e) { continue; }
    const names = new Set(c.landmarks.map(l => l[0]).concat((d.packs[id].places || []).map(p => p[0])));
    for (const m of d.packs[id].missions) for (const a of m.at || []) assert.ok(names.has(a), id + ': unknown place "' + a + '"');
  }
});

test('events.json: weekly events only touch coins', async () => {
  const d = await json('events.json');
  assert.ok(d.events.length >= 4 && /^\d{4}-\d\d-\d\d$/.test(d.epoch));
  for (const e of d.events) { assert.ok(e.id && e.name.pt && e.name.en && e.desc.pt && e.desc.en && e.mult > 1 && e.mult <= 2); assert.ok(Array.isArray(e.types) && (e.types.length || e.tour)); assert.deepEqual(Object.keys(e).filter(k => !['id', 'icon', 'name', 'desc', 'types', 'mult', 'tour'].includes(k)), []); }
});
