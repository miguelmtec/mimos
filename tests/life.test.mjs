// City life (no browser): stalls and NPC data, coin maths, pedestrian networks, spawn rules, traffic lights.   node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const json = async f => JSON.parse(await readFile(new URL('../public/data/' + f, import.meta.url), 'utf8'));
const src = f => readFile(new URL('../public/js/' + f, import.meta.url), 'utf8');
// the game's scripts are classic browser scripts: run the pure-logic one in a sandbox with a bare window
const win = { VP: {} }; win.window = win;
vm.runInNewContext(await src('life/logic.js'), win);
const LL = win.VP.LifeLogic, T = 48;
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m); // objects made inside the sandbox have another realm's prototypes

test('stalls.json: valid, bilingual, coins only, every stall has a free favor', async () => {
  const d = await json('stalls.json');
  same(LL.checkStalls(d), []);
  const ids = d.stalls.map(s => s.id);
  for (const need of ['hotdog', 'peixaria', 'padaria', 'sorveteria', 'petshop', 'feirinha']) assert.ok(ids.includes(need), 'stall ' + need);
  const item = (s, i) => LL.itemOf(d, s, i);
  assert.equal(item('hotdog', 'salsicha').buff.kind, 'energy', 'sausage = energy');
  assert.ok(d.stalls.find(s => s.id === 'peixaria').items.some(i => i.buff.kind === 'heal' || i.buff.kind === 'life'), 'fish = hearts');
  assert.equal(item('padaria', 'leite').buff.kind, 'speed', 'lactose-free milk = speed');
  assert.equal(item('sorveteria', 'picole').buff.kind, 'cooldown', 'ice cream = cooldown reset');
  for (const id of ['racao', 'omega', 'sache', 'catnip']) assert.ok(item('petshop', id) && item('petshop', id).prog === id, 'pet shop sells ' + id + ' (progression consumable)');
  assert.ok(d.stalls.find(s => s.id === 'petshop').items.filter(i => i.buff.kind === 'toy').length >= 2, 'pet shop sells toys');
  assert.ok(d.stalls.find(s => s.id === 'feirinha').items.length >= 3, 'fruit market');
  // the stands the city already had (hotdog / sushi / donut props) are covered
  for (const food of ['hotdog', 'sushi', 'donut']) assert.ok(d.stalls.some(s => s.stand === food), 'stand ' + food);
  // nothing here is sold for real money or by chance
  assert.ok(!/R\$|pix|loot|sorte|gacha|roleta/i.test(JSON.stringify(d.stalls)), 'no real money, no gambling');
  for (const s of d.stalls) for (const i of s.items) assert.ok(i.price <= 150, s.id + '/' + i.id + ' affordable with mission coins');
});

test('stall checker catches broken data', async () => {
  const d = await json('stalls.json'), clone = () => JSON.parse(JSON.stringify(d));
  let x = clone(); x.currency = 'brl'; assert.ok(LL.checkStalls(x).length);
  x = clone(); x.stalls[0].items[0].price = 0; assert.ok(LL.checkStalls(x).length);
  x = clone(); delete x.stalls[1].favor; assert.ok(LL.checkStalls(x).length);
  x = clone(); x.stalls[0].items[0].name.en = ''; assert.ok(LL.checkStalls(x).length);
  x = clone(); x.stalls[0].items[0].buff.kind = 'xp'; assert.ok(LL.checkStalls(x).length);
  x = clone(); x.stalls[2].favor.reward = 'nope'; assert.ok(LL.checkStalls(x).length);
  x = clone(); x.stalls[0].items[0].desc.pt = 'Custa R$ 2'; assert.ok(LL.checkStalls(x).length);
  same(LL.checkStalls(null), ['no stalls']);
});

test('buying: coins never go negative and a failed purchase changes nothing', async () => {
  const d = await json('stalls.json'), it = LL.itemOf(d, 'hotdog', 'salsicha');
  same(LL.buy(100, it), { ok: true, cash: 100 - it.price, need: 0 });
  same(LL.buy(it.price, it), { ok: true, cash: 0, need: 0 });
  same(LL.buy(it.price - 1, it), { ok: false, cash: it.price - 1, need: 1 });
  assert.equal(LL.buy(NaN, it).ok, false); assert.equal(LL.buy(50, null).ok, false);
});

test('npcs.json: caps, looks and lines', async () => {
  const d = await json('npcs.json'), i18n = await src('life/i18n.js');
  for (const k of ['peds', 'cats', 'dogs', 'birds', 'vehicles']) { assert.equal(d.caps[k].length, 3, k); assert.ok(d.caps[k][0] <= d.caps[k][1] && d.caps[k][1] <= d.caps[k][2], k + ' grows with quality'); }
  assert.ok(d.caps.peds[2] <= 60, 'instanced meshes hold 96 humans (fixed vendors included)');
  assert.ok(d.skin.length >= 6 && d.hair.length >= 6 && d.tops.length >= 10, 'variety');
  assert.ok(d.radius.spawnMin < d.radius.spawnMax && d.radius.spawnMax < d.radius.despawn, 'spawn ring inside the despawn radius');
  for (const r of ['walker', 'pair', 'jogger', 'dogwalker', 'tourist', 'kid', 'eater', 'sitter']) assert.ok(d.roles.some(x => x.id === r), 'role ' + r);
  for (const c of d.streetCats) assert.ok(c.name.pt && c.name.en && ['friendly', 'shy', 'grumpy'].includes(c.mood));
  // every line exists in both languages and nobody insults anybody
  const lines = [...i18n.matchAll(/(lf_\w+): \[('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"), ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\]/g)];
  assert.ok(lines.length > 100, 'strings found: ' + lines.length);
  for (const [, k, pt, en] of lines) { assert.ok(pt.length > 2 && en.length > 2, k); assert.ok(!/idiot|burr[oa]|est[uú]pid|stupid|dumb|feio|ugly|hate|odeio|kill|matar|morr/i.test(pt + en), 'kind words only: ' + k); }
  for (const k of ['lf_aw', 'lf_shoo', 'lf_kid', 'lf_thief', 'lf_cat_hiss', 'lf_ufa', 'lf_interact']) assert.ok(lines.some(l => l[1] === k), k);
  assert.match(i18n, /Own, que gatinho!/);
});

// a toy version of the home city: 3 x 2 blocks on the 14-tile lattice, everything walkable
const fakeCity = (cols, rows, types) => {
  const lots = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) lots.push({ c, r, tx: 6 + c * 14 + 1, ty: 6 + r * 14 + 1, type: (types && types[r * cols + c]) || 'bld' });
  return { lots, cols, rows, clear: () => true, los: () => true };
};
test('home-city network: sidewalk rings, zebra crossings tied to lights, paths through plazas', () => {
  const W = fakeCity(3, 2, ['bld', 'plaza', 'bld', 'park', 'bld', 'bld']), net = LL.gridNet(W);
  assert.equal(net.n, 6 * 8 + 2 * 4, 'ring nodes + plaza/park interior');
  let crossV = 0, crossH = 0, dead = 0;
  for (let i = 0; i < net.n; i++) { if (!net.links[i].length) dead++; net.links[i].forEach((j, k) => { assert.ok(net.links[j].includes(i), 'links are two-way'); if (net.axis[i][k] === 1) crossV++; if (net.axis[i][k] === 2) crossH++; if (net.axis[i][k]) { assert.ok(net.cross[i][k] >= 0, 'a zebra knows its light'); const d = Math.hypot(net.x[i] - net.x[j], net.y[i] - net.y[j]); assert.ok(Math.abs(d - 5 * T) < 1, 'zebra spans the 4-tile road: ' + d); } }); }
  assert.equal(dead, 0); assert.equal(crossV / 2, 2 * 2 * 2, 'two zebras per east-west neighbour pair'); assert.equal(crossH / 2, 3 * 2, 'two per north-south pair');
  // every node can be reached from every other (one connected sidewalk network)
  const seen = new Set([0]), q = [0]; while (q.length) for (const j of net.links[q.pop()]) if (!seen.has(j)) { seen.add(j); q.push(j); }
  assert.equal(seen.size, net.n);
  // walls prune nodes and edges instead of sending people through them
  const W2 = fakeCity(2, 1); W2.clear = (x, y) => !(x < 7 * T && y < 7 * T); assert.equal(LL.gridNet(W2).n, 15);
  const W3 = fakeCity(2, 1); W3.los = (a, b, c) => Math.abs(c - a) < 3 * T; const n3 = LL.gridNet(W3); for (let i = 0; i < n3.n; i++) for (const k of n3.axis[i]) assert.notEqual(k, 1, 'no zebra without line of sight');
});

test('real-city network: both kerbs of a street, the middle of a footway, joined at corners', () => {
  const roads = [[9, 0, -300, 0, 300, 0], [3, 1, 0, 0, 0, 240], [9, 0, 300, 0, 300, 300]];
  const toPx = m => (m + 600) / 3 * T, net = LL.roadNet(roads, toPx, () => true, () => true, { mpt: 3 });
  assert.ok(net.n > 150 && net.n < 400, 'nodes: ' + net.n);
  const seen = new Set([0]), q = [0]; while (q.length) for (const j of net.links[q.pop()]) if (!seen.has(j)) { seen.add(j); q.push(j); }
  assert.ok(seen.size > net.n * 0.95, 'connected: ' + seen.size + '/' + net.n);
  const blocked = LL.roadNet(roads, toPx, (x, y) => y < toPx(100), () => true, { mpt: 3 }); assert.ok(blocked.n < net.n, 'unwalkable ground gets no nodes');
  assert.equal(LL.roadNet([], toPx, () => true, () => true).n, 0);
});

test('spawn logic: in the ring, ahead of the camera, never on top of someone, capped by device', async () => {
  const d = await json('npcs.json'), W = fakeCity(6, 6), net = LL.gridNet(W), r = LL.rng(42), px = 40 * T, py = 40 * T, R = d.radius;
  let ahead = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const s = LL.pickSpawn(net, px, py, 0, R.spawnMin, R.spawnMax, r, null); if (!s) continue; n++;
    const dx = net.x[s.node] - px, dy = net.y[s.node] - py, dist = Math.hypot(dx, dy);
    assert.ok(dist >= R.spawnMin - 0.01 && dist <= R.spawnMax + 0.01, 'inside the ring: ' + dist);
    assert.ok(net.links[s.node].includes(s.to), 'walks towards a neighbour');
    if (dx > 0) ahead++;
  }
  assert.ok(n > 300, 'usually finds a spot: ' + n); assert.ok(ahead / n > 0.7, 'mostly in front of the camera: ' + (ahead / n).toFixed(2));
  assert.equal(LL.pickSpawn(net, px, py, 0, R.spawnMin, R.spawnMax, r, () => true), null, 'crowded spots are refused');
  assert.equal(LL.pickSpawn(net, -9000, -9000, 0, 100, 200, r, null), null, 'nothing out in the sea');
  assert.equal(LL.nodesInRing(net, px, py, 0, 60, []).length <= 2, true);
  // despawn: far away, or fairly far and off screen; busy NPCs (chasing, following) get more room
  assert.equal(LL.shouldDespawn(R.despawn + 10, 0, R.despawn, true, false), true);
  assert.equal(LL.shouldDespawn(R.despawn * 0.9, 0, R.despawn, true, false), false);
  assert.equal(LL.shouldDespawn(R.despawn * 0.9, 0, R.despawn, false, false), true);
  assert.equal(LL.shouldDespawn(R.spawnMax, 0, R.despawn, false, false), false, 'never despawns inside the spawn ring (no flicker)');
  assert.equal(LL.shouldDespawn(R.despawn * 1.2, 0, R.despawn, false, true), false);
  // caps scale with quality, phones, the FPS governor and ambient (mission) mode
  const hi = LL.caps(d.caps, 2, false, 1), lo = LL.caps(d.caps, 0, true, 1), slow = LL.caps(d.caps, 2, false, 0.5), amb = LL.caps(d.caps, 2, false, 1, true);
  assert.ok(lo.peds < hi.peds && slow.peds < hi.peds && amb.peds < hi.peds); assert.ok(lo.peds >= 4); assert.equal(amb.vehicles, 0, 'no ambient traffic in missions');
  assert.equal(LL.caps(d.caps, 2, false, 0).peds, LL.caps(d.caps, 2, false, d.caps.min).peds, 'the governor has a floor');
  let s = 1; for (let i = 0; i < 20; i++) s = LL.govern(s, 15, d.caps.min); assert.equal(s, d.caps.min); for (let i = 0; i < 40; i++) s = LL.govern(s, 60, d.caps.min); assert.equal(s, 1); assert.equal(LL.govern(0.7, 40, 0.4), 0.7);
  // at a node people keep going instead of turning back
  let back = 0; for (let i = 0; i < 200; i++) { const at = 1, from = net.links[at][0]; if (LL.nextNode(net, at, from, r) === from) back++; } assert.equal(back, 0);
});

test('traffic lights: never green both ways, people cross only against stopped traffic, vehicles stop before the zebra', () => {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let nsG = 0, ewG = 0;
    for (let t = 0; t < LL.CYCLE * 2; t += 0.1) {
      const s = LL.lightState(t, i, j); assert.ok(!(s.ns > 0 && s.ew > 0), 'both directions open at ' + t);
      if (s.ns === 2) nsG++; if (s.ew === 2) ewG++;
      if (LL.canWalk(t, i, j, 1)) assert.equal(s.ns, 0, 'crossing a north-south road while it has green');
      if (LL.canWalk(t, i, j, 2)) assert.equal(s.ew, 0);
      for (const dir of [0, 1, 2, 3]) { const v = dir % 2 === 0 ? s.ew : s.ns; assert.equal(LL.mustStop(t, i, j, dir, LL.STOP + 20), v === 0, 'red holds at the line, amber lets the nose through'); assert.equal(LL.mustStop(t, i, j, dir, LL.STOP + 60), v !== 2, 'amber stops whoever still has room'); assert.equal(LL.mustStop(t, i, j, dir, 80), false, 'never stops inside the box'); assert.equal(LL.mustStop(t, i, j, dir, LL.LOOK + 50), false); }
    }
    assert.ok(nsG > 50 && ewG > 50, 'both directions get their turn');
  }
  assert.ok(LL.STOP - 40 > 96 + 48, 'a stopped car keeps its nose off the zebra');
});

test('near miss and following distance', () => {
  assert.equal(LL.nearMiss(0, 0, 0, 100, 50, 0), true, 'cat right in front of a moving van');
  assert.equal(LL.nearMiss(0, 0, 0, 100, 50, 60), false, 'cat on the sidewalk');
  assert.equal(LL.nearMiss(0, 0, 0, 100, -50, 0), false, 'cat behind');
  assert.equal(LL.nearMiss(0, 0, 0, 10, 30, 0), false, 'vehicle already crawling');
  assert.equal(LL.followSpeed(100, 20), 0); assert.equal(LL.followSpeed(100, 500), 100); const mid = LL.followSpeed(100, 140); assert.ok(mid > 0 && mid < 100);
});

test('clock: night falls and lifts smoothly', () => {
  assert.equal(LL.night(0.5), 0); assert.equal(LL.night(0), 1); assert.equal(LL.night(0.95), 1);
  let prev = LL.night(0), max = 0; for (let c = 0; c <= 1.001; c += 0.002) { const n = LL.night(c); max = Math.max(max, Math.abs(n - prev)); prev = n; assert.ok(n >= 0 && n <= 1); } assert.ok(max < 0.05, 'no jumps: ' + max);
  assert.equal(LL.hhmm(0.5), '12:00'); assert.equal(LL.hhmm(0), '00:00'); assert.equal(LL.hhmm(1.25), '06:00');
});

test('hooks into existing files stay small and marked', async () => {
  const hooks = { 'game.js': 2, 'hud.js': 3, 'gfx/render.js': 2 };
  for (const f in hooks) { const s = await src(f); assert.equal((s.match(/HOOK city-life/g) || []).length, hooks[f], f); }
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8'); assert.equal((html.match(/HOOK city-life/g) || []).length, 1);
  assert.match(await src('life/celebs.js'), /HOOK city-life[^\n]*getMimosShowcaseLook/);
});
