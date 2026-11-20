'use strict';
// VICE PAWS — simulation: cats, dogs, bosses, bullets, items, props, cars, wanted level
(function () {
const VP = window.VP, U = VP.U, I = VP.I, T = VP.TILE, TT = VP.World.TT;
const Game = VP.Game = {};
let G = null, W = null;
const tmp = { x: 0, y: 0 };
const sfx = (n, g) => VP.Audio.sfx(n, g);
const NAMES = ['mimo', 'mimosa', 'morticia'];
const FOODS = ['treat', 'bone', 'donut', 'steak', 'sushi', 'hotdog'];

const CAT = {
  mimo: { hp: 100, spd: 150 },
  mimosa: { hp: 150, spd: 165 },
  morticia: { hp: 80, spd: 195 },
};
const DOG = Game.DOG = {
  mutt: { hp: 55, spd: 104, dmg: 8, cd: 1.0, r: 13, reach: 38, carry: ['bone', 0.4], cash: 12 },
  chi: { hp: 22, spd: 168, dmg: 5, cd: 0.7, r: 9, reach: 30, carry: ['treat', 0.2], cash: 6 },
  cop: { hp: 90, spd: 100, dmg: 12, cd: 1.1, r: 14, reach: 42, carry: ['donut', 0.65], cash: 18, police: 1 },
  shooter: { hp: 60, spd: 92, dmg: 9, cd: 1.5, r: 13, reach: 34, range: 330, keep: 200, carry: ['ammo', 1], cash: 20 },
  catcher: { hp: 70, spd: 108, dmg: 6, cd: 2.0, r: 13, reach: 36, range: 250, keep: 150, carry: ['net', 1], cash: 22, police: 1 },
  heavy: { hp: 190, spd: 74, dmg: 20, cd: 1.6, r: 18, reach: 52, armor: 120, carry: ['steak', 0.6], cash: 40, slam: 1 },
  chief: { hp: 3600, spd: 82, dmg: 18, r: 30, armor: 240, boss: { moves: ['charge', 'slam', 'nets', 'summon'], minion: ['cop', 'cop', 'catcher'], snack: 'donut' } },
  poodle: { hp: 4600, spd: 98, dmg: 20, r: 28, armor: 280, boss: { moves: ['spray', 'barrels', 'summon', 'charge', 'spray'], minion: ['chi', 'chi', 'chi', 'chi'], snack: 'sushi' } },
  rott: { hp: 5600, spd: 84, dmg: 22, r: 32, armor: 320, boss: { moves: ['slam', 'barrels', 'charge', 'summon', 'slam'], minion: ['mutt', 'shooter', 'mutt'], snack: 'steak' } },
  pug: { hp: 6400, spd: 92, dmg: 23, r: 30, armor: 360, boss: { moves: ['suck', 'spray', 'charge', 'barrels', 'summon'], minion: ['chi', 'shooter', 'heavy'], snack: 'donut' } },
  dogcatcher: { hp: 7200, spd: 96, dmg: 20, r: 31, armor: 400, boss: { moves: ['nets', 'charge', 'barrels', 'summon', 'slam', 'spray', 'suck'], minion: ['catcher', 'cop', 'heavy', 'shooter'], snack: 'steak' } },
};
// Difficulty curve: mission levels above 20 keep growing, but at half the pace (smoother late game).
Game.eff = lv => { lv = lv || 1; return lv <= 20 ? lv : 20 + (lv - 20) * 0.5; };
const CARSTAT = { pickup: [150, 300],  gold: [100, 345], pink: [100, 345], sedan: [80, 320], taxi: [80, 320], sport: [80, 360], cop: [90, 315], van: [150, 262], truck: [170, 270], limo: [260, 285] };

// ---------- helpers ----------
function step(e, dx, dy, mode) {
  let hit = false;
  if (dx) { if (!W.blocked(e.x + dx, e.y, e.r, mode)) e.x += dx; else hit = true; }
  if (dy) { if (!W.blocked(e.x, e.y + dy, e.r, mode)) e.y += dy; else hit = true; }
  return hit;
}
function part(o) { if (G.parts.length < 420) G.parts.push(Object.assign({ t: 0, life: 0.5, vx: 0, vy: 0, size: 4, col: '#fff', k: 'dot' }, o)); }
function burst(x, y, n, col, spd, k, size, life) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = U.rand(0.3, 1) * (spd || 120); part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col: Array.isArray(col) ? U.pick(col) : col, k: k || 'dot', size: (size || 4) * U.rand(0.6, 1.3), life: (life || 0.45) * U.rand(0.7, 1.2) }); }
}
function poof(x, y, n, col) { burst(x, y, n || 8, col || '#fff', 70, 'puff', 12, 0.5); }
function text(x, y, txt, col, size) { G.texts.push({ x: x + U.rand(-6, 6), y, txt, col: col || '#fff', t: 0, size: size || 16 }); if (G.texts.length > 40) G.texts.shift(); }
function shake(v) { G.shake = Math.max(G.shake, v); VP.haptic(v >= 10 ? 32 : 16); }
function hitstop(v) { G.hitstop = Math.max(G.hitstop, v); }
function say(txt, col, dur) { G.banner = { txt, col: col || '#fff', t: 0, dur: dur || 2.4 }; }
Game.fx = { part, burst, poof, text, shake, say };
const alive = () => G.cats.filter(c => !c.down);
const active = () => G.cats[G.active];
const tr = k => VP.t(k);

// ---------- construction ----------
Game.create = function (world, mission) {
  W = world;
  G = Game.G = {
    W: world, m: mission, n: Game.eff(mission.lv), id: mission.n, d: mission.d, time: 0, real: 0, over: false, paused: false,
    cats: [], active: 0, dogs: [], bullets: [], items: [], props: [], cars: [], parts: [], texts: [], teles: [], friends: [],
    cam: { x: 0, y: 0 }, mtimer: null, shake: 0, hitstop: 0, nap: 0, catnip: 0, feast: 0, banner: null,
    heat: 0, wanted: 0, minWanted: 0, calm: 0, copT: 2, car: null, ctx: null, revive: 0, keys: 0,
    stat: { ko: 0, eaten: 0, freed: 0, cash: 0, downs: 0, stolen: 0, dmg: 0, kites: 0, coins: 0, woke: 0, pts: 0 }, flags: {}, solo: null, mini: null,
    steps: [], step: 0, stepT: 0, timer: null, fieldT: 0, field: null, fieldM: null, houseField: null, house: null,
    hpMul: 1 + Game.eff(mission.lv) * 0.016, dmgMul: 1 + Game.eff(mission.lv) * 0.007, pawT: 0, hungerMul: mission.hunger || 1, noPolice: false, tut: {},
  };
  return G;
};
Game.addCats = function (x, y) {
  NAMES.forEach((name, idx) => {
    const st = CAT[name];
    G.cats.push({
      kind: 'cat', name, idx, x: x + (idx - 1) * 34, y: y + (idx === 0 ? 0 : 22), r: name === 'morticia' ? 11 : 13, hp: st.hp, max: st.hp, spd: st.spd,
      face: 1, aim: 0, t: idx * 1.3, walk: 0, kx: 0, ky: 0, cd: 0, cd2: 0, cdS: 1.5, flash: 0, inv: 1, down: false, root: 0, atk: 0, mouth: 0,
      energy: 100, belly: 70, exhausted: false, combo: 0, comboT: 0, dashT: 0, dx: 0, dy: 0, invis: 0, recoil: 0, idle: 0, hitSet: null, aiT: 0, stuck: 0,
    });
  });
  // never spawn inside a wall (narrow real-world streets)
  const used = [];
  for (const c of G.cats) {
    let ok = !W.blocked(c.x, c.y, c.r + 3, 0);
    for (let r = 0; r < 9 && !ok; r++) for (let k = 0; k < 8 && !ok; k++) { const an = k * 0.785, px = x + Math.cos(an) * r * 20, py = y + Math.sin(an) * r * 20; if (!W.blocked(px, py, c.r + 3, 0) && !used.some(u => U.d2(u.x, u.y, px, py) < 24 * 24)) { c.x = px; c.y = py; ok = true; } }
    used.push({ x: c.x, y: c.y });
  }
  G.cam.x = x; G.cam.y = y;
  refreshFields(true);
};
Game.addDog = function (type, x, y, o) {
  o = o || {};
  const st = DOG[type];
  const e = {
    kind: 'dog', type, x, y, r: st.r, hp: st.hp * G.hpMul * (o.hpMul || 1), spd: st.spd * (1 + G.n * 0.003), dmg: st.dmg * G.dmgMul, face: Math.random() < 0.5 ? 1 : -1,
    t: Math.random() * 5, walk: 0, kx: 0, ky: 0, state: o.guard ? 'guard' : 'chase', st: 0, cd: U.rand(0.3, 1), wind: 0, stun: 0, flash: 0, target: null, think: Math.random() * 0.4,
    armor: (st.armor || 0) * (1 + G.n * 0.01), carry: null, tag: o.tag || null, police: !!st.police || !!o.police, raid: !!o.raid, home: { x, y }, aggro: o.aggro || 250,
    disarmed: false, aim: 0, stuck: 0, dead: false, robbed: 0,
  };
  if (o.sleep) { e.sleep = true; e.wake = o.wake || 62; e.state = 'guard'; e.aggro = 0; }
  if (o.big) { e.big = o.big; e.r *= 1.25; e.dmg *= 1.15; e.elite = true; }
  e.max = e.hp; e.maxArmor = e.armor;
  if (o.carry !== undefined) e.carry = o.carry;
  else if (st.carry && Math.random() < st.carry[1]) e.carry = st.carry[0];
  if (st.boss) {
    e.boss = Object.assign({ phase: 'armored', pt: 0, move: null, mt: 0, cd: 2.5, i: 0 }, st.boss);
    e.carry = st.boss.snack; e.state = 'chase'; e.isBoss = true; G.boss = e;
  }
  G.dogs.push(e);
  return e;
};
Game.addItem = function (k, x, y, pop) {
  const it = { k, x, y, t: Math.random() * 6, vx: 0, vy: 0, z: 0, vz: 0 };
  if (pop) { const a = Math.random() * 6.283; it.vx = Math.cos(a) * 80; it.vy = Math.sin(a) * 80; it.vz = 160; }
  G.items.push(it); return it;
};
Game.addProp = function (o) {
  const p = Object.assign({ kind: 'prop', t: 0, flash: 0, done: false, open: false }, o);
  if (p.k === 'crate') { p.x = (p.tx + 0.5) * T; p.y = (p.ty + 0.5) * T; p.hp = p.max = 2; p.tiles = [[p.tx, p.ty]]; W.setTile(p.tx, p.ty, TT.DOOR); }
  if (p.k === 'fgate') p.max = p.hp;
  if (p.k === 'stand') p.left = 3;
  if (p.k === 'house' || p.k === 'gen') { p.max = p.hp; G.house = p; }
  if (p.k === 'cage') { p.hp = p.max = 3; }
  G.props.push(p); return p;
};
Game.addCar = function (type, x, y, a, o) {
  const st = CARSTAT[type];
  const c = Object.assign({ kind: 'car', type, x, y, a: a || 0, spd: 0, hp: st[0], max: st[0], top: st[1], ai: 'parked', r: 21, t: 0, flash: 0, hitCd: 0, col: null, px: 0, py: 0, dead: false }, o || {});
  if (['sedan', 'sport'].includes(type) && !c.col) c.col = VP.Art.carColor((Math.random() * 7) | 0);
  G.cars.push(c); return c;
};
Game.addFriend = function (x, y, skin) { const f = { kind: 'friend', name: skin, x, y, r: 9, t: Math.random() * 4, walk: 0, face: 1, spd: 185 }; G.friends.push(f); return f; };
// instantiate what the world generator asked for
Game.populate = function (o) {
  o = o || {};
  const sp = W.spawn;
  for (const s of sp.stands) Game.addProp({ k: 'stand', x: s.x, y: s.y, food: s.kind, free: s.free });
  for (const c of sp.crates) if (W.grid[c.ty * W.W + c.tx] === 0) Game.addProp({ k: 'crate', tx: c.tx, ty: c.ty });
  for (const t of sp.trash) Game.addProp({ k: 'trash', x: t.x, y: t.y });
  for (const t of sp.treats) Game.addItem('treat', t.x, t.y);
  for (const p of sp.parked) Game.addCar(U.pick(['sedan', 'sport', 'taxi', 'sedan']), p.x, p.y, p.a);
  for (const l of W.comps) for (const p of l.props) Game.addProp(p);
  // coffee + extras scattered on sidewalks
  const rng = U.rng(G.id * 31 + 5);
  const nCoffee = o.coffee === undefined ? 16 : o.coffee;
  for (let i = 0; i < nCoffee; i++) { const p = W.randWalk(rng); Game.addItem('coffee', p.x, p.y); }
  for (let i = 0; i < (W.real ? 130 : W.cols * W.rows * 2); i++) { const p = W.randWalk(rng); Game.addItem(rng() < 0.25 ? 'cash' : 'treat', p.x, p.y); }
  if (rng() < 0.7) { const p = W.randWalk(rng); Game.addItem('catnip', p.x, p.y); }
  if (rng() < 0.5) { const p = W.randWalk(rng); Game.addItem('milk', p.x, p.y); }
  // traffic
  const nT = o.traffic === undefined ? 20 : o.traffic;
  for (let i = 0; i < (o.paws || 0); i++) { const p = W.randWalk(rng); Game.addItem('paw', p.x, p.y); }
  for (let i = 0; i < nT; i++) spawnTraffic(rng);
  if (W.real) for (let i = 0; i < (o.parked === undefined ? 14 : o.parked); i++) { const p = W.randWalk(rng); if (W.gnd[Math.floor(p.y / T) * W.W + Math.floor(p.x / T)] === 1 && !W.blocked(p.x, p.y, 40, 3)) Game.addCar(rng.pick(W.real.id === 'rioverde' ? ['pickup', 'pickup', 'sedan'] : ['sedan', 'sport', 'taxi', 'sedan']), p.x, p.y, rng() * 6.283); }
};
function spawnTraffic(rng) {
  if (W.real) { // real cities: cars follow the road polylines of the map
    if (!W.roads.length) return;
    const road = rng.pick(W.roads), wi = rng.int(0, road.pts.length - 1), p = road.pts[wi];
    for (const c of G.cars) if (U.d2(c.x, c.y, p.x, p.y) < 150 * 150) return;
    for (const c of G.cats) if (U.d2(c.x, c.y, p.x, p.y) < 220 * 220) return;
    if (W.blocked(p.x, p.y, 30, 3)) return;
    Game.addCar(rng.pick(W.real.id === 'rioverde' ? ['pickup', 'pickup', 'sedan', 'pickup'] : ['sedan', 'sedan', 'taxi', 'sport']), p.x, p.y, 0, { ai: 'path', road, wi, dirn: rng() < 0.5 ? 1 : -1, spd: 80 });
    return;
  }
  const hor = rng() < 0.5, fwd = rng() < 0.5;
  let x, y, dir;
  if (hor) { const j = rng.int(0, W.rows); dir = fwd ? 0 : 2; y = W.RY[j] + (fwd ? 48 : -48); x = rng.range(W.RX[0] + 100, W.RX[W.cols] - 100); }
  else { const i = rng.int(0, W.cols); dir = fwd ? 1 : 3; x = W.RX[i] + (fwd ? -48 : 48); y = rng.range(W.RY[0] + 100, W.RY[W.rows] - 100); }
  for (const c of G.cars) if (U.d2(c.x, c.y, x, y) < 150 * 150) return;
  for (const c of G.cats) if (U.d2(c.x, c.y, x, y) < 200 * 200) return;
  Game.addCar(rng.pick(['sedan', 'sedan', 'taxi', 'sport']), x, y, dir * Math.PI / 2, { ai: 'traffic', dir, spd: 100 });
}

// ---------- fields ----------
function refreshFields(force) {
  G.fieldT -= 1;
  if (!force && G.fieldT > 0) return;
  G.fieldT = 12;
  const a = active();
  G.field = W.field(a.x, a.y, 0, G.field);
  G.fieldM = W.field(a.x, a.y, 1, G.fieldM);
}
function moveToward(e, tx, ty, spd, dt, field, mode) {
  let dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  if (field && (e.stuck > 0 || d > 60) && !W.los(e.x, e.y, tx, ty, mode || 0)) {
    if (W.fieldDir(field, e.x, e.y, tmp) > 0) { dx = tmp.x; dy = tmp.y; }
  }
  const hit = step(e, dx * spd * dt, dy * spd * dt, mode || 0);
  if (hit) e.stuck = 0.6; else if (e.stuck > 0) e.stuck -= dt;
  if (Math.abs(dx) > 0.2) e.face = dx > 0 ? 1 : -1;
  e.walk = 1;
  return d;
}

// ---------- damage ----------
function hurtCat(c, dmg, fx, fy) {
  if (c.down || c.inv > 0 || G.over) return false;
  if (G.car) { if (c.idx === G.active) damageCar(G.car, dmg * 0.6); return true; }
  if (c.name === 'mimosa') dmg *= 0.72;
  if (c.idx !== G.active) dmg *= 0.55;
  dmg = Math.max(1, Math.round(dmg));
  c.hp -= dmg; c.flash = 0.14; c.inv = 0.35; G.stat.dmg += dmg;
  const a = Math.atan2(c.y - fy, c.x - fx); c.kx += Math.cos(a) * 180; c.ky += Math.sin(a) * 180;
  text(c.x, c.y - 44, '-' + dmg, '#ff6b6b', 17); burst(c.x, c.y - 16, 5, '#ffd23f', 110, 'star', 6);
  if (c.idx === G.active) { shake(6); sfx('hurt'); }
  if (c.hp <= 0) downCat(c);
  return true;
}
function downCat(c) {
  c.hp = 0; c.down = true; c.root = 0; c.dashT = 0; G.stat.downs++;
  sfx('down'); shake(10); poof(c.x, c.y - 14, 8);
  say(tr(c.name).toUpperCase() + ' ' + tr('fainted'), '#ff6b6b', 3);
  if (G.solo !== null && c.idx === G.solo) return Game.fail('caught');
  if (c.idx === G.active) { const n = G.cats.find(k => !k.down); if (n) switchTo(n.idx, true); }
  if (!alive().length) Game.fail('allDown');
}
function healCat(c, n) { if (c.down || c.hp >= c.max) return; c.hp = Math.min(c.max, c.hp + n); }
function healTeam(n) { let any = false; for (const c of G.cats) if (!c.down && c.hp < c.max) { healCat(c, n); any = true; text(c.x, c.y - 46, '+' + n, '#7CFF6B', 14); part({ x: c.x, y: c.y - 20, k: 'ring', col: '#7CFF6B', size: 10, life: 0.4 }); } return any; }
Game.healTeam = healTeam;
Game.hurtCat = hurtCat; // [hook:ext] used by enemies.js / boss.js
// src: 'bolt' | 'bite' | 'snatch' | 'car' | 'hair' | 'roar'
function hurtDog(e, dmg, src, fx, fy, kb) {
  if (e.dead) return;
  VP.haptic(e.isBoss ? 14 : 9, 170);
  if (G.catnip > 0) dmg *= 1.6;
  let shown = dmg, tink = false;
  const exposed = e.isBoss && e.boss.phase === 'exposed';
  if (e.armor > 0 && !exposed) {
    const bite = src === 'bite' || src === 'roar' || src === 'car';
    e.armor -= dmg * (bite ? 1.7 : 0.3); shown = dmg * (bite ? 0.35 : 0.12); tink = !bite;
    if (e.armor <= 0) { e.armor = 0; burst(e.x, e.y - 20, 12, '#c0c7d1', 200, 'dot', 6); sfx('break'); text(e.x, e.y - 60 * (e.isBoss ? 1.6 : 1), tr('armorBreak'), '#ffd23f', 18); shake(8); if (!e.isBoss) e.stun = Math.max(e.stun, 1.2); }
  } else if (exposed) shown = dmg * 1.25;
  shown = Math.max(1, Math.round(shown));
  e.hp -= shown; e.flash = 0.12;
  if (e.sleep) wakeDog(e);
  if (e.state === 'guard') { e.state = 'chase'; alertPack(e); }
  if (kb && !e.isBoss) { const a = Math.atan2(e.y - fy, e.x - fx); e.kx += Math.cos(a) * kb; e.ky += Math.sin(a) * kb; }
  text(e.x, e.y - 40 - e.r, tink ? tr('tink') : '' + shown, tink ? '#c0c7d1' : (src === 'bite' ? '#ff7ac0' : src === 'bolt' ? '#8ff3ff' : '#fff'), tink ? 12 : 15);
  if (tink) sfx('tink', 0.08);
  if (e.hp <= 0) koDog(e);
}
function wakeDog(e) { e.sleep = false; e.state = 'chase'; e.hunt = true; e.aggro = 250; G.stat.woke++; part({ x: e.x, y: e.y - 56, k: 'txt', txt: '!', col: '#ff4f5e', size: 22, life: 0.6, vy: -20 }); sfx('alarm', 0.3); }
function alertPack(e) { for (const o of G.dogs) if (o !== e && !o.sleep && o.state === 'guard' && U.d2(o.x, o.y, e.x, e.y) < 300 * 300) o.state = 'chase'; }
function koDog(e) {
  e.dead = true; G.stat.ko++;
  poof(e.x, e.y - 14, e.isBoss ? 30 : 9); burst(e.x, e.y - 18, e.isBoss ? 24 : 6, ['#ffd23f', '#fff'], 190, 'star', 8, 0.7);
  sfx('ko'); shake(e.isBoss ? 18 : 4); hitstop(e.isBoss ? 0.25 : 0.03);
  const st = DOG[e.type];
  if (e.carry === 'key') Game.addItem('key', e.x, e.y, true);
  else if (e.carry && FOODS.includes(e.carry)) Game.addItem(e.carry, e.x, e.y, true);
  if (Math.random() < 0.6 || e.isBoss) Game.addItem('cash', e.x, e.y, true);
  if (Math.random() < 0.3) Game.addItem('treat', e.x, e.y, true);
  if (Math.random() < 0.07) Game.addItem('coffee', e.x, e.y, true);
  if (e.isBoss) { for (let i = 0; i < 8; i++) Game.addItem(i % 2 ? 'cash' : 'treat', e.x, e.y, true); for (const o of G.dogs) if (!o.dead && o !== e) { o.dead = true; poof(o.x, o.y - 10); } }
  G.stat.cash += st.cash || 0;
  if (e.police && !G.noHeat) G.heat = Math.min(5, G.heat + 0.15);
}
function damageCar(car, dmg) {
  if (car.dead) return;
  car.hp -= dmg; car.flash = 0.1;
  if (car.hp <= 0 && car.capture) { // heist target: it stops instead of blowing up, ready to be boarded
    car.capture = false; car.captured = true; car.ai = 'parked'; car.spd = 0; car.hp = car.max = 380; car.drop = 0; poof(car.x, car.y, 14, '#fff'); sfx('crash'); shake(10); G.stat.cash += 100; return;
  }
  if (car.hp <= 0) {
    car.dead = true; poof(car.x, car.y, 18, '#bbb'); burst(car.x, car.y, 14, ['#ffd23f', '#fff', '#888'], 220, 'dot', 7, 0.7); sfx('crash'); shake(14);
    if (G.car === car) { exitCar(true); for (const c of G.cats) if (!c.down) { c.inv = 0; hurtCat(c, 15, car.x, car.y); c.inv = 1.5; } }
    if (car.ai === 'cop') { G.stat.ko++; G.stat.cash += 40; }
    if (car.ai === 'target') { G.stat.ko++; G.stat.cash += 150; }
  }
}

// ---------- cats ----------
function switchTo(i, silent) {
  const c = G.cats[i];
  if (!c || c.down || i === G.active) { if (c && c.down && !silent) say(tr('isDown'), '#ff6b6b', 1.5); return; }
  if (G.solo !== null) { if (!silent) say(tr('soloOnly'), '#ffd23f', 1.6); return; }
  if (G.car) { G.active = i; return; }
  G.active = i; G.fieldT = 0; refreshFields(true);
  if (!silent) sfx('sw');
  part({ x: c.x, y: c.y - 4, k: 'ring', col: '#2de2e6', size: 14, life: 0.35 });
}
Game.switchTo = switchTo;
function autoAim(c, range, kind) {
  let best = null, bd = range * range, bx = 0, by = 0;
  const consider = (o, x, y, bias) => { const d = U.d2(c.x, c.y, x, y) * (bias || 1); if (d < bd && W.los(c.x, c.y - 4, x, y - 4, kind === 'bolt' ? 2 : 0)) { bd = d; best = o; bx = x; by = y; } };
  for (const e of G.dogs) if (!e.dead) consider(e, e.x, e.y);
  if (kind === 'bolt') { for (const p of G.props) if (p.k === 'switch' && !p.done) consider(p, p.x, p.y - 28, 0.8); for (const k of G.cars) if (!k.dead && (k.ai === 'cop' || k.ai === 'target')) consider(k, k.x, k.y); }
  if (VP.Ext) VP.Ext.aimAt(G, consider, kind, c); // [hook:ext] extra targets (enemies.js)
  if (kind === 'bite') for (const p of G.props) if (!p.done && (p.k === 'fgate' || p.k === 'crate' || (p.k === 'cage' && p.lock === 'bite'))) { const d = U.d2(c.x, c.y, p.x, p.y); if (d < 90 * 90 && d < bd) { bd = d; best = p; bx = p.x; by = p.y; } }
  return best ? Math.atan2(by - c.y, bx - c.x) : null;
}
function shoot(c, ang, ai) {
  const sp = ang + U.rand(-0.045, 0.045), mx = c.x + Math.cos(ang) * 22, my = c.y - 12 + Math.sin(ang) * 22;
  G.bullets.push({ k: 'bolt', x: mx, y: my, vx: Math.cos(sp) * 640, vy: Math.sin(sp) * 640, life: 0.8, dmg: (ai ? 9 : 13) * (c.exhausted ? 0.8 : 1), from: 'cat', r: 6, t: 0 });
  c.recoil = 1; c.kx -= Math.cos(ang) * 26; c.ky -= Math.sin(ang) * 26;
  part({ x: mx, y: my, k: 'flash', col: '#bff4ff', size: 13, life: 0.07 });
  if (!ai) { shake(1.6); c.energy = Math.max(0, c.energy - 1.7); }
  sfx('shoot', 0.05);
}
function biteHit(c, ang, dmg, reach, rad, kb, src) {
  const hx = c.x + Math.cos(ang) * reach, hy = c.y + Math.sin(ang) * reach;
  let hit = 0;
  for (const e of G.dogs) if (!e.dead && U.d2(e.x, e.y, hx, hy) < (rad + e.r) * (rad + e.r)) { if (c.hitSet && c.hitSet.has(e)) continue; if (c.hitSet) c.hitSet.add(e); hurtDog(e, dmg, src || 'bite', c.x, c.y, kb); hit++; }
  for (const p of G.props) {
    if (p.done || (p.k !== 'fgate' && p.k !== 'crate' && !(p.k === 'cage' && p.lock === 'bite'))) continue;
    if (c.hitSet && c.hitSet.has(p)) continue;
    const pr = p.k === 'fgate' ? 56 : 34;
    if (U.d2(p.x, p.y, hx, hy) < (rad + pr) * (rad + pr) * 0.6) {
      if (c.hitSet) c.hitSet.add(p);
      if (c.name !== 'mimosa') { text(p.x, p.y - 40, tr('needMimosa'), '#ff7ac0', 13); sfx('tink', 0.2); continue; }
      p.hp--; p.flash = 0.12; hit++; burst(p.x, p.y - 10, 6, '#c98f4b', 150, 'dot', 5); sfx('break');
      if (p.hp <= 0) breakProp(p);
    }
  }
  for (const k of G.cars) if (!k.dead && (k.ai === 'cop' || k.ai === 'target') && U.d2(k.x, k.y, hx, hy) < (rad + 30) * (rad + 30)) { damageCar(k, dmg * 0.6); hit++; }
  part({ x: hx, y: hy - 14, k: 'bite', a: ang, size: rad, life: 0.16, col: '#fff' });
  return hit;
}
function breakProp(p) {
  p.done = true; p.open = true;
  if (p.tiles) for (const [a, b] of p.tiles) W.setTile(a, b, TT.FLOOR);
  poof(p.x, p.y - 10, 8, '#e9c9a0'); burst(p.x, p.y - 10, 12, ['#c98f4b', '#8a5a2b'], 220, 'dot', 7, 0.6); shake(7); hitstop(0.05);
  G.fieldT = 0;
  if (p.k === 'crate') { const r = Math.random(); Game.addItem(r < 0.35 ? 'cash' : r < 0.75 ? 'treat' : r < 0.9 ? 'coffee' : 'milk', p.x, p.y, true); if (Math.random() < 0.5) Game.addItem('cash', p.x, p.y, true); }
  if (p.k === 'cage') freeFriend(p);
}
function freeFriend(p) {
  p.done = true; p.open = true; G.stat.freed++;
  const f = Game.addFriend(p.x, p.y + 8, p.friend); poof(p.x, p.y - 10, 10); sfx('revive'); burst(p.x, p.y - 20, 10, ['#ff7ac0', '#fff'], 150, 'heart', 8, 0.8);
  say(tr('freed'), '#7CFF6B'); void f;
}
function openLink(id) {
  for (const p of G.props) if (p.id === id && !p.done) {
    p.done = p.open = true; sfx('door');
    if (p.k === 'vlaser') for (const [a, b] of p.tiles) W.setTile(a, b, TT.GAP);
    else if (p.tiles) for (const [a, b] of p.tiles) W.setTile(a, b, TT.FLOOR);
    poof(p.x, p.y - 10, 6, '#bff4ff'); G.fieldT = 0;
  }
  for (const p of G.props) if (p.k === 'cage' && p.link === id && !p.done) freeFriend(p);
}
function eat(c, kind, big) {
  // only Morticia really eats; big = stolen/stand portion
  const m = G.cats[2];
  G.stat.eaten++;
  c.mouth = 1; sfx('eat', 0.06);
  const F = VP.DATA && VP.DATA.items && VP.DATA.items.food[big && kind === 'treat' ? 'bone' : kind];
  m.belly = Math.min(100, m.belly + (F ? F.belly : big ? 20 : 9));
  healTeam(F ? F.heal : big ? 10 : 4);
  G.stat.cash += F ? F.coins : big ? 15 : 5;
  burst(c.x + c.face * 8, c.y - 22, 4, ['#ffb347', '#fff3a8'], 90, 'dot', 4);
  void kind;
}
function snatch(c, ang) {
  // steal from enemies first
  let best = null, bd = 62 * 62;
  for (const e of G.dogs) { if (e.dead) continue; const d = U.d2(e.x, e.y, c.x, c.y); const rr = 50 + e.r; if (d < rr * rr && d < bd + e.r * e.r * 4) { if (!best || (e.carry && !best.carry) || (!!e.carry === !!best.carry && d < bd)) { best = e; bd = d; } } }
  c.atk = 1; c.mouth = 0.8;
  if (best) {
    const e = best; c.face = e.x > c.x ? 1 : -1;
    const locked = e.isBoss && e.boss.phase !== 'exposed' && e.stun <= 0;
    if (e.carry && !locked) {
      const k = e.carry; e.carry = null; G.stat.stolen++;
      part({ x: e.x, y: e.y - 44, k: 'fly', icon: k, tx: c, life: 0.25, size: 12 });
      sfx('steal'); text(e.x, e.y - 58, tr('stolen'), '#ffd23f', 15); hitstop(0.04);
      e.robbed = 1.3; e.stun = Math.max(e.stun, e.isBoss ? 0 : 1.1);
      if (k === 'key') { G.keys++; G.flags.key = (G.flags.key || 0) + 1; say(tr('gotKey'), '#ffd23f'); sfx('paw'); }
      else if (k === 'ammo' || k === 'net') { e.disarmed = true; G.stat.cash += 20; text(c.x, c.y - 50, tr('disarmed'), '#8ff3ff', 13); c.belly = Math.min(100, c.belly + 6); if (k === 'net') { e.state = 'flee'; e.st = 6; } }
      else { eat(c, k, true); if (e.isBoss) { e.boss.pt += 2.5; e.boss.robbed = true; healTeam(20); say(tr('bossRobbed'), '#ffd23f'); shake(8); } }
      return;
    }
    if (locked && e.carry) text(e.x, e.y - 80, tr('needExpose'), '#c0c7d1', 13);
    hurtDog(e, 9, 'snatch', c.x, c.y, 90); sfx('hit', 0.08);
    part({ x: (c.x + e.x) / 2, y: (c.y + e.y) / 2 - 16, k: 'slash', a: ang, size: 18, life: 0.12, col: '#fff' });
    return;
  }
  // stands, trash, loot
  for (const p of G.props) {
    const d = U.d2(p.x, p.y, c.x, c.y);
    if (p.k === 'stand' && p.left > 0 && d < 70 * 70) {
      p.left--; p.flash = 0.1; eat(c, p.food, true); part({ x: p.x, y: p.y - 14, k: 'fly', icon: p.food, tx: c, life: 0.2, size: 11 });
      if (!p.free && !G.noHeat) { G.heat = Math.min(5, G.heat + 0.34); if (!G.tut.theft) { G.tut.theft = 1; say(tr('theft'), '#ffd23f'); } }
      return;
    }
    if (p.k === 'trash' && !p.done && d < 50 * 50) { p.done = true; sfx('door'); Game.addItem(Math.random() < 0.6 ? 'treat' : 'cash', p.x, p.y, true); Game.addItem('treat', p.x, p.y, true); return; }
    if (p.k === 'loot' && !p.done && d < 70 * 70) { p.done = true; G.flags.loot = (G.flags.loot || 0) + 1; G.stat.cash += 300; eat(c, 'treat', true); c.belly = 100; sfx('paw'); burst(p.x, p.y - 10, 20, ['#ffd23f', '#ffb347'], 240, 'star', 8, 0.8); say(tr('gotLoot'), '#ffd23f'); return; }
  }
  part({ x: c.x + Math.cos(ang) * 26, y: c.y - 14 + Math.sin(ang) * 26, k: 'slash', a: ang, size: 16, life: 0.12, col: '#d9c8f0' });
}
function doAttack(c, ang, ai) {
  if (c.cd > 0 || c.down || c.root > 0 && c.name !== 'mimo') return;
  c.face = Math.cos(ang) >= 0 ? 1 : -1; c.aim = ang; c.idle = 0;
  if (c.name === 'mimo') { shoot(c, ang, ai); c.cd = (c.exhausted ? 0.52 : 0.2) * (ai ? 2.3 : 1); }
  else if (c.name === 'mimosa') {
    if (c.comboT <= 0) c.combo = 0;
    const third = c.combo === 2; c.hitSet = null;
    c.kx += Math.cos(ang) * (third ? 230 : 130); c.ky += Math.sin(ang) * (third ? 230 : 130);
    const n = biteHit(c, ang, (third ? 34 : 21) * (ai ? 0.7 : 1), 30, third ? 34 : 28, third ? 330 : 120);
    c.atk = 1; c.mouth = 1; sfx(third ? 'bite3' : 'bite');
    if (n) { hitstop(third ? 0.085 : 0.045); if (!ai) shake(third ? 7 : 3.5); }
    c.combo = (c.combo + 1) % 3; c.comboT = 0.75; c.cd = (third ? 0.42 : 0.23) * (ai ? 1.5 : 1);
  } else { snatch(c, ang); c.cd = ai ? 0.5 : 0.3; }
}
function doDash(c) {
  if (c.cd2 > 0 || c.down || c.root > 0) return;
  let ang = c.aim; if (Math.hypot(I.mx, I.my) > 0.3 && c.idx === G.active) ang = Math.atan2(I.my, I.mx);
  if (c.name === 'mimosa') {
    c.dashT = 0.2; c.dx = Math.cos(ang); c.dy = Math.sin(ang); c.aim = ang; c.inv = Math.max(c.inv, 0.3); c.cd2 = 2.4; c.hitSet = new Set(); c.face = c.dx >= 0 ? 1 : -1; sfx('dash');
  } else if (c.name === 'morticia') {
    c.dashT = 0.16; c.dx = Math.cos(ang); c.dy = Math.sin(ang); c.invis = 2.2; c.inv = Math.max(c.inv, 0.4); c.cd2 = 4; sfx('dash'); poof(c.x, c.y - 12, 6, '#b9a6d9');
    for (const e of G.dogs) if (e.target === c) e.target = null;
  } else { // Mimo: hairball lob (stuns)
    if (c.energy < 12) { text(c.x, c.y - 50, tr('tired'), '#bfe9ff', 13); return; }
    const tgt = autoAim(c, 300, 'bolt'); const a = I.aim !== null && c.idx === G.active ? I.aim : (tgt === null ? ang : tgt);
    let dist = 190; for (const e of G.dogs) if (!e.dead) { const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < 320 && Math.abs(U.angDiff(a, Math.atan2(e.y - c.y, e.x - c.x))) < 0.3) { dist = d; break; } }
    G.bullets.push({ k: 'hair', x: c.x, y: c.y, sx: c.x, sy: c.y, tx: c.x + Math.cos(a) * dist, ty: c.y + Math.sin(a) * dist, t: 0, dur: 0.5, from: 'cat', life: 1, r: 8 });
    c.energy -= 10; c.cd2 = 5; sfx('hairball');
  }
}
function doSpecial(c) {
  if (c.down) return;
  if (c.name === 'mimo') {
    if (c.cdS > 0) return;
    G.nap = 4.5; c.cdS = 18; c.energy = Math.min(100, c.energy + 50); c.exhausted = false; sfx('nap'); say(tr('nap') + '!', '#bfe9ff', 1.6);
    part({ x: c.x, y: c.y - 16, k: 'ring', col: '#bfe9ff', size: 30, life: 0.7, grow: 500 });
  } else if (c.name === 'mimosa') {
    if (c.cdS > 0) return;
    c.cdS = 12; sfx('roar'); shake(14); hitstop(0.08); say(tr('roar') + '!', '#ff7ac0', 1.4); c.mouth = 1; c.atk = 1;
    for (let i = 0; i < 3; i++) part({ x: c.x, y: c.y - 14, k: 'ring', col: '#ff4fb8', size: 20, life: 0.5 + i * 0.12, grow: 420 });
    for (const e of G.dogs) if (!e.dead && U.d2(e.x, e.y, c.x, c.y) < 210 * 210) { hurtDog(e, 16, 'roar', c.x, c.y, 260); if (!e.dead) { if (e.armor > 0) e.armor = Math.max(0, e.armor - 55); e.stun = Math.max(e.stun, e.isBoss ? 1.2 : 3); e.wind = 0; if (e.state === 'wind') e.state = 'chase'; } }
    for (const b of G.bullets) if (b.from === 'dog' && U.d2(b.x, b.y, c.x, c.y) < 210 * 210) b.life = 0;
    for (const k of G.cats) k.root = 0;
  } else {
    if (!c.feastReady) { text(c.x, c.y - 50, tr('needFull'), '#ffb347', 13); return; }
    G.feast = 5; c.belly = 55; c.feastReady = false; sfx('feast'); say(tr('feast') + '!', '#ffb347', 1.6); shake(6);
  }
}
Game.special = doSpecial;
// ---------- parkour course: low roofs, crates, gaps and jump pads ----------
// The simulation stays 2D: a course is a set of rectangles ("platforms") with a height. The leading cat climbs anything up to
// CLIMB higher than where it stands just by walking into it (crates can be scrambled up from the street at any height), hops over short gaps on its own when it walks off an edge
// towards another platform, and is launched by jump pads. Walking off anywhere else is a harmless drop. No jump button:
// it plays the same on touch and keyboard. plats: {x, y, hw, hh (px), h (3D units), solid}, pads: {x, y, plat, to: {x, y, plat}}.
const CLIMB = 0.85, HOP = 150;
Game.addCourse = function (plats, pads) {
  G.pk = { plats: [], pads: [] };
  for (const o of plats) { const p = Game.addProp(Object.assign({ k: 'pkplat', solid: true }, o)); G.pk.plats.push(p); }
  for (const o of pads || []) { const p = Game.addProp(Object.assign({ k: 'pkpad' }, o)); G.pk.pads.push(p); }
  return G.pk;
};
function platAt(x, y, m) { let best = null; m = m || 0; for (const p of G.pk.plats) if (Math.abs(x - p.x) <= p.hw + m && Math.abs(y - p.y) <= p.hh + m && (!best || p.h > best.h)) best = p; return best; }
Game.platAt = (x, y) => (G && G.pk ? platAt(x, y) : null);
function startJump(c, to, dur, arc) { c.jump = { t: 0, dur, arc, fx: c.x, fy: c.y, fp: c.plat || null, tx: to.x, ty: to.y, tp: to.plat || null }; c.emote = null; sfx('dash', 0.05); }
function pkJump(c, dt) {
  const j = c.jump; j.t += dt; const f = Math.min(1, j.t / j.dur);
  c.x = U.lerp(j.fx, j.tx, f); c.y = U.lerp(j.fy, j.ty, f); c.walk = 1;
  if (f >= 1) { c.plat = j.tp; c.jump = null; poof(c.x, c.y - 6, 5, '#fff'); sfx('step', 0.05); VP.haptic(10); }
}
// one movement step of the leading cat on a map with a course
function pkMove(c, dx, dy, mode) {
  const cur = c.plat || null, ch = cur ? cur.h : 0, nx = c.x + dx, ny = c.y + dy, np = platAt(nx, ny);
  if (np && np !== cur && np.h > ch + 0.01) {
    // low enough: climb. Crates (solid) can always be scrambled up from the street, so a course never blocks the way.
    if (np.h - ch <= CLIMB || (np.solid && !cur)) { c.x = nx; c.y = ny; c.plat = np; c.climbT = np.h - ch <= CLIMB ? 0.18 : 0.3; sfx('step', 0.08); return false; }
    if (!cur) return step(c, dx, dy, mode);            // awnings and roofs on posts: walk underneath
  }
  if (cur) {
    if (np === cur || (np && np.h <= ch)) { c.x = nx; c.y = ny; if (np !== cur) { c.plat = np; c.dropH = ch - np.h; c.dropT = 0.16; } return false; }
    if (!np) { // walking off the edge: hop to a platform straight ahead, otherwise drop to the ground
      const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      for (let d = 24; d <= HOP; d += 8) { const q = platAt(c.x + ux * d, c.y + uy * d); if (q && q !== cur && q.h - ch <= CLIMB + 0.1) { const lx = U.clamp(c.x + ux * (d + 30), q.x - q.hw + 14, q.x + q.hw - 14), ly = U.clamp(c.y + uy * (d + 30), q.y - q.hh + 14, q.y + q.hh - 14); startJump(c, { x: lx, y: ly, plat: q }, 0.4, 0.9); return false; } }
      if (W.blocked(nx, ny, c.r, mode)) return true;
      c.x = nx; c.y = ny; c.plat = null; c.dropH = ch; c.dropT = 0.26; poof(c.x, c.y - 6, 4, '#fff'); return false;
    }
    return true; // a taller platform ahead while up here: blocked
  }
  return step(c, dx, dy, mode);
}
// keep cats consistent after dashes, knockbacks or a switch; fire jump pads
function pkTick(c, dt) {
  if (c.climbT > 0) c.climbT -= dt; if (c.dropT > 0) c.dropT -= dt;
  if (c.plat && !c.jump && (Math.abs(c.x - c.plat.x) > c.plat.hw + 3 || Math.abs(c.y - c.plat.y) > c.plat.hh + 3)) { const q = platAt(c.x, c.y); if (q && q.h <= c.plat.h + CLIMB) c.plat = q; else { c.dropH = c.plat.h; c.dropT = 0.26; c.plat = null; } }
  if (!c.jump && c.idx === G.active && !c.down) for (const p of G.pk.pads) if ((p.plat || null) === (c.plat || null) && U.d2(c.x, c.y, p.x, p.y) < 34 * 34) { startJump(c, p.to, 0.85, 2.6); p.flash = 0.4; burst(p.x, p.y - 10, 8, ['#2de2e6', '#fff'], 180, 'star', 6, 0.4); VP.haptic(18); break; }
}
// Emotes: little gestures of the active cat (HUD buttons or Z X C V). Pure fun today; they travel in Game.snapshot()
// so other players will see them when the shared world arrives.
const EMOTES = Game.EMOTES = { miau: 1.3, dance: 3.2, sit: 5, wave: 1.9 };
Game.emote = function (k, c) {
  if (!G || G.over || G.car || !EMOTES[k]) return false;
  c = c || active(); if (c.down || c.dashT > 0) return false;
  c.emote = { k, t: EMOTES[k] }; G.stat.emotes = (G.stat.emotes || 0) + 1;
  if (k === 'miau') { c.mouth = 1; text(c.x, c.y - 62, tr('em_miau_say'), '#fff', 18); part({ x: c.x, y: c.y - 30, k: 'ring', col: '#ffffff', size: 10, life: 0.45, grow: 120 }); sfx('paw', 0.1); }
  else if (k === 'dance') { burst(c.x, c.y - 30, 8, ['#ff4fb8', '#2de2e6', '#ffd23f'], 150, 'star', 6, 0.6); sfx('star', 0.1); }
  else if (k === 'wave') { text(c.x, c.y - 62, '👋', '#fff', 22); sfx('sw', 0.1); }
  else sfx('step', 0.1);
  return true;
};
function updCat(c, dt) {
  const isA = c.idx === G.active;
  c.t += dt; c.walk = 0;
  for (const k of ['cd', 'cd2', 'cdS', 'flash', 'inv', 'comboT', 'invis', 'root']) if (c[k] > 0) c[k] -= dt;
  c.atk = Math.max(0, c.atk - dt * 6); c.mouth = Math.max(0, c.mouth - dt * 4); c.recoil = Math.max(0, c.recoil - dt * 9);
  if (c.down) {
    if (!G.car && c.idx !== G.active && G.field && W.distAt(G.cats[G.active].name === 'morticia' ? G.fieldM : G.field, c.x, c.y) < 0) {
      c.lostT = (c.lostT || 0) + dt;
      if (c.lostT > 2.5) { const a = active(), p = nearFree(a.x, a.y, 60, 0); if (p) { poof(c.x, c.y - 10, 6); c.x = p.x; c.y = p.y; poof(c.x, c.y - 10, 6); c.lostT = 0; } }
    } else c.lostT = 0;
    return;
  }
  // role meters
  if (c.name === 'mimo') {
    c.idle += dt;
    if (c.idle > 1.2) c.energy = Math.min(100, c.energy + dt * (c.exhausted ? 7 : 3.5));
    else if (isA) c.energy = Math.max(0, c.energy - dt * 0.5);
    if (c.energy <= 0 && !c.exhausted) { c.exhausted = true; text(c.x, c.y - 52, tr('exhausted'), '#bfe9ff', 15); if (!G.tut.tired) { G.tut.tired = 1; say(tr('tipCoffee'), '#bfe9ff', 3); } }
    if (c.exhausted && c.energy >= 28) c.exhausted = false;
    if (c.exhausted && Math.random() < dt * 1.5) part({ x: c.x + 8, y: c.y - 44, k: 'icon', icon: 'zzz', vy: -30, vx: 12, size: 9, life: 0.9 });
  }
  if (c.name === 'morticia') {
    if (!G.car) c.belly = Math.max(0, c.belly - dt * 0.85 * G.hungerMul);
    if (c.belly <= 0) { c.hungerT = (c.hungerT || 0) + dt; if (c.hungerT > 1 && !G.car) { c.hungerT = 0; if (c.hp > 12) { c.hp = Math.max(12, c.hp - 3); c.flash = 0.1; } text(c.x, c.y - 46, tr('hungry'), '#ffb347', 13); if (!G.tut.hungry) { G.tut.hungry = 1; say(tr('tipHungry'), '#ffb347', 3); } } }
    if (c.belly >= 99.5 && !c.feastReady) { c.feastReady = true; text(c.x, c.y - 56, tr('feast') + '!', '#ffd23f', 15); sfx('paw', 0.5); }
    if (G.feast > 0) feastTick(c, dt);
  }
  if (G.car) { c.x = G.car.x; c.y = G.car.y; return; }
  // knockback
  if (c.kx || c.ky) { step(c, c.kx * dt, c.ky * dt, c.name === 'morticia' ? 1 : 0); const f = Math.pow(0.0008, dt); c.kx *= f; c.ky *= f; if (Math.abs(c.kx) + Math.abs(c.ky) < 6) c.kx = c.ky = 0; }
  if (c.dashT > 0) {
    c.dashT -= dt; const sp = c.name === 'mimosa' ? 900 : 760;
    const hit = step(c, c.dx * sp * dt, c.dy * sp * dt, c.name === 'morticia' ? 1 : 0);
    part({ x: c.x, y: c.y - 14, k: 'ghost', name: c.name, face: c.face, life: 0.18 });
    if (c.name === 'mimosa') { c.mouth = 1; biteHit(c, Math.atan2(c.dy, c.dx), 38, 16, 30, 380); }
    if (hit) c.dashT = 0;
    return;
  }
  let pace = 1;
  const mimo = G.cats[0];
  if (!mimo.down && mimo.energy > 70) pace = 1.08; else if (mimo.down || mimo.exhausted) pace = 0.9;
  if (G.catnip > 0) pace *= 1.2;
  let spd = c.spd * pace * (c.exhausted ? 0.62 : 1) * (c.root > 0 ? 0 : 1);
  if (c.name === 'morticia' && c.belly <= 0) spd *= 0.8;
  if (c.hopT > 0) c.hopT -= dt;
  if (G.pk) { pkTick(c, dt); if (c.jump) { pkJump(c, dt); return; } }
  if (c.emote) { c.emote.t -= dt; if (c.emote.t <= 0 || (isA && (Math.hypot(I.mx, I.my) > 0.3 || I.attack))) c.emote = null; else if (c.emote.k === 'miau') c.mouth = Math.max(c.mouth, 0.6); } // moving or attacking ends the gesture
  if (isA) {
    const m = Math.hypot(I.mx, I.my);
    if (m > 0.12 && spd > 0) spd *= slopeMul(c.x, c.y, I.mx / m, I.my / m);
    if (m > 0.12 && spd > 0) { if (G.pk) pkMove(c, I.mx * spd * dt, I.my * spd * dt, c.name === 'morticia' ? 1 : 0); else step(c, I.mx * spd * dt, I.my * spd * dt, c.name === 'morticia' ? 1 : 0); c.walk = 1; if (!I.attack && Math.abs(I.mx) > 0.15) c.face = I.mx > 0 ? 1 : -1; if (Math.random() < dt * 9) part({ x: c.x - I.mx * 8, y: c.y - 1, k: 'puff', size: 5, life: 0.3, col: 'rgba(255,255,255,.5)' }); }
    // aim
    const range = c.name === 'mimo' ? 520 : 120, kind = c.name === 'mimo' ? 'bolt' : c.name === 'mimosa' ? 'bite' : 'snatch';
    let ang = null;
    if (I.aim !== null) ang = I.aim;
    else if (I.useMouse && !I.touch && I.mw) ang = Math.atan2(I.mw.y - c.y, I.mw.x - c.x);
    else { ang = autoAim(c, range, kind); if (ang === null && m > 0.12) ang = Math.atan2(I.my, I.mx); }
    if (ang !== null) c.aim = ang;
    if (I.attack && !(G.ctx && G.ctx.k === 'revive' && I.ctxHeld) && !(G.mini && G.mini.quiet)) doAttack(c, c.aim, false);
  } else updFollower(c, dt, spd);
}
function feastTick(c, dt) {
  const R = 230;
  if (Math.random() < dt * 30) { const a = Math.random() * 6.283; part({ x: c.x + Math.cos(a) * R, y: c.y - 14 + Math.sin(a) * R, k: 'suck', tx: c, life: 0.4, col: '#ffb347', size: 5 }); }
  for (const it of G.items) { const d = U.d2(it.x, it.y, c.x, c.y); if (d < R * R) { const l = Math.sqrt(d) || 1; it.x += (c.x - it.x) / l * 520 * dt; it.y += (c.y - it.y) / l * 520 * dt; } }
  c.feastT = (c.feastT || 0) - dt;
  if (c.feastT <= 0) {
    c.feastT = 0.22;
    for (const e of G.dogs) {
      if (e.dead || U.d2(e.x, e.y, c.x, c.y) > R * R) continue;
      if (e.carry && !(e.isBoss && e.boss.phase !== 'exposed')) {
        const k = e.carry; e.carry = null; G.stat.stolen++; part({ x: e.x, y: e.y - 44, k: 'fly', icon: k, tx: c, life: 0.3, size: 12 }); e.stun = Math.max(e.stun, 1.5);
        if (k === 'key') { G.keys++; G.flags.key = (G.flags.key || 0) + 1; say(tr('gotKey'), '#ffd23f'); } else if (k === 'ammo' || k === 'net') e.disarmed = true; else eat(c, k, true);
        break;
      }
      if (e.type === 'chi') { hurtDog(e, 999, 'snatch', c.x, c.y, 0); eat(c, 'treat', false); break; }
    }
    for (const p of G.props) if (p.k === 'stand' && p.left > 0 && U.d2(p.x, p.y, c.x, c.y) < R * R) { p.left--; eat(c, p.food, true); part({ x: p.x, y: p.y - 14, k: 'fly', icon: p.food, tx: c, life: 0.3, size: 11 }); break; }
  }
}
// walking speed on real-city terrain: uphill is slower, downhill a touch faster (W.slope = rise per px along the direction)
function slopeMul(x, y, dx, dy) { if (!W.hpx) return 1; const g = (W.hpx(x + dx * 30, y + dy * 30) - W.hpx(x, y)) / 1.25; return U.clamp(1 - g * 1.5, 0.55, 1.15); }
Game.slopeMul = slopeMul;
function updFollower(c, dt, spd) {
  if (G.solo !== null) return; // solo stealth: the other two wait where they are
  const a = active(), isM = c.name === 'morticia', mode = isM ? 1 : 0, field = isM ? G.fieldM : G.field;
  const da = Math.hypot(a.x - c.x, a.y - c.y);
  c.aiT -= dt;
  // combat / role behaviour
  let busy = false;
  if (c.name === 'mimo') {
    if (c.aiT <= 0) { c.aiT = 0.25; c.aiAim = c.exhausted ? null : autoAim(c, 360, 'bolt'); if (c.aiAim !== null && G.dogs.length === 0) c.aiAim = null; }
    if (c.aiAim !== null && c.aiAim !== undefined && !c.exhausted) { let hasDog = false; for (const e of G.dogs) if (!e.dead && U.d2(e.x, e.y, c.x, c.y) < 360 * 360) { hasDog = true; break; } if (hasDog) doAttack(c, c.aiAim, true); }
  } else if (c.name === 'mimosa') {
    if (c.aiT <= 0) { c.aiT = 0.3; c.aiTarget = null; let bd = 210 * 210; for (const e of G.dogs) { if (e.dead) continue; const d = U.d2(e.x, e.y, c.x, c.y); if (d < bd && U.d2(e.x, e.y, a.x, a.y) < 300 * 300 && W.los(c.x, c.y, e.x, e.y, 0)) { bd = d; c.aiTarget = e; } } }
    const e = c.aiTarget;
    if (e && !e.dead && c.root <= 0) {
      busy = true; const d = Math.hypot(e.x - c.x, e.y - c.y);
      if (d > 34 + e.r) moveToward(c, e.x, e.y, spd, dt, null, 0);
      else doAttack(c, Math.atan2(e.y - c.y, e.x - c.x), true);
    }
  } else {
    // Morticia: go eat nearby food; steal from stunned/close carriers
    if (c.aiT <= 0) {
      c.aiT = 0.35; c.aiItem = null; let bd = 230 * 230;
      for (const it of G.items) { if (!FOODS.includes(it.k)) continue; const d = U.d2(it.x, it.y, c.x, c.y); if (d < bd && U.d2(it.x, it.y, a.x, a.y) < 280 * 280 && W.los(c.x, c.y, it.x, it.y, 1)) { bd = d; c.aiItem = it; } }
      c.aiTarget = null; if (!c.aiItem) for (const e of G.dogs) if (!e.dead && e.carry && e.carry !== 'key' && !e.isBoss && U.d2(e.x, e.y, c.x, c.y) < 120 * 120) { c.aiTarget = e; break; }
    }
    if (c.aiItem && G.items.includes(c.aiItem)) { busy = true; moveToward(c, c.aiItem.x, c.aiItem.y, spd, dt, null, 1); }
    else if (c.aiTarget && !c.aiTarget.dead && c.aiTarget.carry) { busy = true; const e = c.aiTarget, d = Math.hypot(e.x - c.x, e.y - c.y); if (d > 40 + e.r) moveToward(c, e.x, e.y, spd, dt, null, 1); else doAttack(c, Math.atan2(e.y - c.y, e.x - c.x), true); }
  }
  if (busy) return;
  // follow in formation
  const slot = (c.idx - G.active + 3) % 3, ox = slot === 1 ? -30 : 30, oy = 30;
  const tx = a.x + ox * (a.face > 0 ? -1 : 1) * 0.9, ty = a.y + (slot === 1 ? oy : oy * 0.6);
  const reach = W.distAt(field, c.x, c.y);
  if (reach < 0) { // can't reach the leader (e.g. behind a cat flap): wait
    c.wait = true; return;
  }
  c.wait = false;
  if (reach > 22 && da > 560 && !onScreen(c.x, c.y, 80)) { // far behind: catch up
    const p = nearFree(a.x, a.y, 50, mode); if (p) { poof(c.x, c.y - 10, 5); c.x = p.x; c.y = p.y; poof(c.x, c.y - 10, 5); } return;
  }
  if (da > 62) moveToward(c, tx, ty, spd * (da > 170 ? 1.25 : da > 100 ? 1 : 0.7), dt, field, mode);
}
function nearFree(x, y, rad, mode) {
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283, d = rad * (0.5 + i * 0.12), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!W.blocked(px, py, 14, mode || 0) && W.los(x, y, px, py, 0)) return { x: px, y: py }; }
  return null;
}
function onScreen(x, y, pad) { const v = G.view; if (!v) return true; return x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - pad && y < v.y1 + pad; }
Game.onScreen = onScreen;

// ---------- dogs ----------
function pickTarget(e) {
  let best = null, bd = 1e12;
  const lim = e.police || e.isBoss || e.state !== 'guard' ? 900 : e.aggro;
  for (const c of G.cats) {
    if (c.down || c.invis > 0) continue;
    if (G.car && c.idx !== G.active) continue;
    if (G.solo !== null && c.idx !== G.solo) continue;
    let d = Math.hypot(c.x - e.x, c.y - e.y);
    let l = lim; if (c.name === 'morticia' && e.state === 'guard') l *= 0.55;
    if (d > l) continue;
    if (c.name === 'mimosa') d *= 0.8; // the brawler draws aggro
    if (d < bd) { bd = d; best = c; }
  }
  e.target = best;
}
function dogAttack(e) {
  const st = DOG[e.type], tg = e.target;
  if (e.atkHouse) { const h = G.house; if (h && !h.done) { h.hp -= e.dmg * 0.5; h.flash = 0.1; burst(h.x + U.rand(-30, 30), h.y, 4, '#fff1d6', 120, 'dot', 5); sfx('hit', 0.1); if (h.hp <= 0) { h.hp = 0; h.done = true; Game.fail(h.failWhy || 'house'); } } return; }
  if (st.range && !e.disarmed) {
    const a = e.aim;
    if (e.type === 'shooter') { G.bullets.push({ k: 'ball', x: e.x + Math.cos(a) * 18, y: e.y - 12 + Math.sin(a) * 18, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290, life: 1.6, dmg: e.dmg, from: 'dog', r: 6, t: 0 }); sfx('hairball', 0.1); }
    else { G.bullets.push({ k: 'net', x: e.x, y: e.y - 14, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, life: 1.2, dmg: e.dmg, from: 'dog', r: 13, t: 0 }); sfx('net', 0.1); }
    return;
  }
  const dmg = e.disarmed ? e.dmg * 0.6 : e.dmg;
  if (st.slam) {
    part({ x: e.x, y: e.y, k: 'ring', col: '#ff6b6b', size: 20, life: 0.3, grow: 260 }); shake(5); sfx('slam', 0.1);
    for (const c of G.cats) if (!c.down && U.d2(c.x, c.y, e.x, e.y) < 80 * 80) hurtCat(c, dmg, e.x, e.y);
  } else if (tg && !tg.down && U.d2(tg.x, tg.y, e.x, e.y) < (st.reach + 22) * (st.reach + 22)) { hurtCat(tg, dmg, e.x, e.y); part({ x: tg.x, y: tg.y - 16, k: 'slash', a: e.aim, size: 16, life: 0.12, col: '#ff6b6b' }); sfx('hit', 0.08); }
}
function updDog(e, dt) {
  e.t += dt; e.walk = 0;
  if (e.flash > 0) e.flash -= dt; if (e.robbed > 0) e.robbed -= dt;
  if (e.kx || e.ky) { step(e, e.kx * dt, e.ky * dt, 0); const f = Math.pow(0.001, dt); e.kx *= f; e.ky *= f; if (Math.abs(e.kx) + Math.abs(e.ky) < 6) e.kx = e.ky = 0; }
  if (e.stun > 0) { e.stun -= dt; e.wind = 0; if (e.state === 'wind') e.state = 'chase'; if (Math.random() < dt * 5) part({ x: e.x + U.rand(-10, 10), y: e.y - 46 - e.r, k: 'star', size: 5, life: 0.4, col: '#ffd23f', vy: -20 }); return; }
  if (e.isBoss) return updBoss(e, dt);
  if (e.sleep) { // snoring: the ring shows how close a cat may get before the dog wakes up
    e.zt = (e.zt || 0) - dt; if (e.zt <= 0) { e.zt = 1.25; part({ x: e.x, y: e.y - 14, k: 'ring', col: '#8fd0ff', size: e.wake, grow: 0.01, life: 1.25 }); part({ x: e.x + 8, y: e.y - 40, k: 'icon', icon: 'zzz', vy: -26, vx: 10, size: 9, life: 1 }); }
    for (const c of G.cats) if (!c.down && c.invis <= 0 && (G.solo === null || c.idx === G.solo) && U.d2(c.x, c.y, e.x, e.y) < e.wake * e.wake) { wakeDog(e); break; }
    return;
  }
  const st = DOG[e.type];
  e.think -= dt; if (e.think <= 0) { e.think = 0.4; pickTarget(e); }
  const tg = e.target;
  if (e.state === 'flee') {
    e.st -= dt; const c = active(); const a = Math.atan2(e.y - c.y, e.x - c.x);
    step(e, Math.cos(a) * e.spd * 1.3 * dt, Math.sin(a) * e.spd * 1.3 * dt, 0); e.walk = 1; e.face = Math.cos(a) > 0 ? 1 : -1;
    if (e.st <= 0 || !onScreen(e.x, e.y, 120)) { e.dead = true; if (onScreen(e.x, e.y, 0)) poof(e.x, e.y - 10, 5); }
    return;
  }
  if (e.state === 'guard') {
    if (tg) { e.state = 'chase'; alertPack(e); part({ x: e.x, y: e.y - 56, k: 'txt', txt: '!', col: '#ff4f5e', size: 22, life: 0.6, vy: -20 }); }
    else if (U.d2(e.x, e.y, e.home.x, e.home.y) > 30 * 30) moveToward(e, e.home.x, e.home.y, e.spd * 0.5, dt, null);
    return;
  }
  if (e.state === 'wind') {
    e.st -= dt; e.wind = 1 - Math.max(0, e.st) / 0.42;
    if (e.st <= 0) { dogAttack(e); e.state = 'cool'; e.st = st.cd * U.rand(0.8, 1.2) * (e.disarmed ? 1.3 : 1); e.wind = 0; }
    return;
  }
  if (e.state === 'cool') { e.st -= dt; if (e.st <= 0) e.state = 'chase'; if (!(st.range && !e.disarmed)) { if (e.st > 0.5) return; } }
  // chase
  e.atkHouse = false;
  if (e.raid && G.house && !G.house.done && (!tg || Math.hypot(tg.x - e.x, tg.y - e.y) > 130)) {
    const h = G.house, d = Math.hypot(h.x - e.x, h.y - e.y);
    if (d < 84 + e.r) { if (e.state === 'chase') { e.state = 'wind'; e.st = 0.42; e.atkHouse = true; e.aim = Math.atan2(h.y - e.y, h.x - e.x); } }
    else { if (G.houseField && W.fieldDir(G.houseField, e.x, e.y, tmp) > 0 && !W.los(e.x, e.y, h.x, h.y, 0)) { step(e, tmp.x * e.spd * dt, tmp.y * e.spd * dt, 0); e.walk = 1; e.face = tmp.x > 0 ? 1 : -1; } else moveToward(e, h.x, h.y, e.spd, dt, null); }
    return;
  }
  if (!tg) {
    if (e.police || e.raid || e.hunt) { const c = active(); if (!c.down && c.invis <= 0) moveToward(e, c.x, c.y, e.spd * 0.8, dt, G.field); }
    else if (U.d2(e.x, e.y, e.home.x, e.home.y) > 40 * 40) moveToward(e, e.home.x, e.home.y, e.spd * 0.6, dt, null); else e.state = e.tag ? 'guard' : 'chase';
    return;
  }
  const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy);
  e.aim = Math.atan2(dy - 0, dx); e.face = dx > 0 ? 1 : -1;
  const ranged = st.range && !e.disarmed;
  const spd = e.spd * (e.robbed > 0 ? 0 : 1) * (e.disarmed ? 1.1 : 1);
  if (ranged) {
    const los = W.los(e.x, e.y - 8, tg.x, tg.y - 8, 2);
    if (d < st.range && los) {
      if (e.state === 'chase') { e.state = 'wind'; e.st = 0.42; part({ x: e.x, y: e.y - 56, k: 'txt', txt: '!', col: '#ffd23f', size: 18, life: 0.4, vy: -20 }); return; }
      if (d < st.keep) { step(e, -dx / d * spd * 0.7 * dt, -dy / d * spd * 0.7 * dt, 0); e.walk = 1; }
    } else if (e.state === 'chase' || d > st.range) moveToward(e, tg.x, tg.y, spd, dt, tg.idx === G.active ? G.field : null);
    return;
  }
  if (d < st.reach + (tg.r || 12)) { if (e.state === 'chase') { e.state = 'wind'; e.st = 0.42; } }
  else if (e.state === 'chase') moveToward(e, tg.x, tg.y, spd, dt, G.field);
}
function tele(o) { const t = Object.assign({ t: 0, dur: 1 }, o); G.teles.push(t); return t; }
function updBoss(e, dt) {
  const B = e.boss, hard = e.hp < e.max * 0.5 ? 0.72 : 1;
  e.think -= dt; if (e.think <= 0) { e.think = 0.4; pickTarget(e); }
  const tg = e.target || alive()[0];
  if (!tg) return;
  if (B.phase === 'exposed') {
    B.pt -= dt; e.exposed = true;
    if (Math.random() < dt * 8) part({ x: e.x + U.rand(-24, 24), y: e.y - 70, k: 'star', size: 6, life: 0.5, col: '#ffd23f', vy: -30 });
    if (B.pt <= 0) {
      e.exposed = false; B.phase = 'armored'; B.cd = 1;
      if (e.carry) { const h = Math.round(e.max * 0.08); e.hp = Math.min(e.max, e.hp + h); e.armor = e.maxArmor; text(e.x, e.y - 100, tr('bossAte') + ' +' + h, '#ff6b6b', 16); sfx('eat'); }
      else { e.armor = e.maxArmor * 0.55; }
      e.carry = B.snack; B.robbed = false;
      part({ x: e.x, y: e.y - 20, k: 'ring', col: '#c0c7d1', size: 30, life: 0.4, grow: 200 });
    }
    return;
  }
  if (e.armor <= 0) { B.phase = 'exposed'; B.pt = 5; B.move = null; e.wind = 0; shake(12); hitstop(0.1); say(tr('exposed'), '#ffd23f', 2.6); sfx('break'); return; }
  const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (!B.move) {
    e.face = dx > 0 ? 1 : -1; e.aim = Math.atan2(dy, dx);
    if (d > 150) moveToward(e, tg.x, tg.y, e.spd, dt, G.field);
    // contact damage
    for (const c of G.cats) if (!c.down && U.d2(c.x, c.y, e.x, e.y) < (e.r + 16) * (e.r + 16)) hurtCat(c, e.dmg * 0.5, e.x, e.y);
    B.cd -= dt;
    if (B.cd <= 0) {
      const mv = B.moves[B.i % B.moves.length]; B.i++;
      B.move = mv; B.mt = 0; B.hit = new Set();
      if (mv === 'charge') { B.a = Math.atan2(dy, dx); B.tele = tele({ k: 'line', x: e.x, y: e.y, a: B.a, len: 520, w: e.r * 2 + 16, dur: 0.85 * hard }); }
      if (mv === 'slam') B.tele = tele({ k: 'circle', x: e.x, y: e.y, r: 150, dur: 0.95 * hard, follow: e });
      if (mv === 'barrels') { B.tl = []; for (const c of alive()) B.tl.push(tele({ k: 'circle', x: c.x + U.rand(-20, 20), y: c.y + U.rand(-20, 20), r: 74, dur: 1.1 * hard })); for (let i = 0; i < 3; i++) B.tl.push(tele({ k: 'circle', x: tg.x + U.rand(-180, 180), y: tg.y + U.rand(-180, 180), r: 74, dur: 1.1 * hard + i * 0.15 })); }
      if (mv === 'suck') { sfx('nap'); }
      sfx('boss', 0.5);
    }
    return;
  }
  B.mt += dt; const mv = B.move;
  const end = cd => { B.move = null; B.cd = (cd || U.rand(1.3, 2.1)) * hard; e.wind = 0; };
  if (mv === 'charge') {
    const w = 0.85 * hard;
    if (B.mt < w) { e.wind = B.mt / w; e.face = Math.cos(B.a) > 0 ? 1 : -1; }
    else {
      const hit = step(e, Math.cos(B.a) * 640 * dt, Math.sin(B.a) * 640 * dt, 0); e.walk = 1;
      part({ x: e.x, y: e.y, k: 'puff', size: 12, life: 0.3, col: 'rgba(255,255,255,.6)' });
      for (const c of G.cats) if (!c.down && !B.hit.has(c) && U.d2(c.x, c.y, e.x, e.y) < (e.r + 18) * (e.r + 18)) { B.hit.add(c); hurtCat(c, e.dmg, e.x, e.y); }
      if (hit) { e.stun = 1.8; e.armor = Math.max(0, e.armor - e.maxArmor * 0.22); shake(12); sfx('crash'); text(e.x, e.y - 100, tr('bonk'), '#ffd23f', 18); end(1); }
      else if (B.mt > w + 0.75) end();
    }
  } else if (mv === 'slam') {
    const w = 0.95 * hard; e.wind = Math.min(1, B.mt / w);
    if (B.mt >= w) { shake(14); sfx('slam'); part({ x: e.x, y: e.y, k: 'ring', col: '#ff6b6b', size: 30, life: 0.35, grow: 400 }); for (const c of G.cats) if (!c.down && U.d2(c.x, c.y, e.x, e.y) < 150 * 150) hurtCat(c, e.dmg, e.x, e.y); end(); }
  } else if (mv === 'spray') {
    if (B.mt > 0.5 && !B.s1) { B.s1 = 1; ring(e, 12, 0); } if (B.mt > 1.0 && !B.s2) { B.s2 = 1; ring(e, 12, 0.26); }
    e.wind = Math.min(1, B.mt * 2);
    if (B.mt > 1.3) { B.s1 = B.s2 = 0; end(); }
  } else if (mv === 'summon') {
    e.wind = Math.min(1, B.mt * 1.5);
    if (B.mt > 0.7) { let n = 0; for (const o of G.dogs) if (!o.dead && !o.isBoss) n++; if (n < 4) for (const type of B.minion) { const p = nearFree(e.x, e.y, 110, 0); if (p) { Game.addDog(type, p.x, p.y, { hpMul: 0.5 }); poof(p.x, p.y - 10, 6); } } sfx('wanted', 0.5); end(); }
  } else if (mv === 'nets') {
    e.wind = Math.min(1, B.mt * 1.6);
    if (B.mt > 0.6) { for (const c of alive()) { const a = Math.atan2(c.y - e.y, c.x - e.x); for (const off of [-0.18, 0.18]) G.bullets.push({ k: 'net', x: e.x, y: e.y - 20, vx: Math.cos(a + off) * 270, vy: Math.sin(a + off) * 270, life: 1.5, dmg: e.dmg * 0.4, from: 'dog', r: 14, t: 0 }); } sfx('net'); end(); }
  } else if (mv === 'barrels') {
    e.wind = Math.min(1, B.mt);
    let left = 0;
    for (const t of B.tl) { if (t.fired) continue; if (t.t >= t.dur) { t.fired = true; sfx('slam', 0.08); shake(6); poof(t.x, t.y, 8, '#ffb3e6'); part({ x: t.x, y: t.y, k: 'ring', col: '#ff6b6b', size: 20, life: 0.3, grow: 200 }); for (const c of G.cats) if (!c.down && U.d2(c.x, c.y, t.x, t.y) < 74 * 74) hurtCat(c, e.dmg * 0.8, t.x, t.y); } else left++; }
    if (!left) end();
  } else if (mv === 'suck') {
    e.wind = 0.5 + Math.sin(B.mt * 20) * 0.5;
    for (const c of G.cats) { if (c.down) continue; const a = Math.atan2(e.y - c.y, e.x - c.x); step(c, Math.cos(a) * 135 * dt, Math.sin(a) * 135 * dt, c.name === 'morticia' ? 1 : 0); }
    if (Math.random() < dt * 40) { const a = Math.random() * 6.283; part({ x: e.x + Math.cos(a) * 300, y: e.y + Math.sin(a) * 300, k: 'suck', tx: e, life: 0.45, col: '#d9c8f0', size: 5 }); }
    if (B.mt > 2.2) { B.move = 'slam'; B.mt = 0.3; B.tele = tele({ k: 'circle', x: e.x, y: e.y, r: 150, dur: 0.65 * hard, follow: e }); }
  }
}
function ring(e, n, off) { for (let i = 0; i < n; i++) { const a = i / n * 6.283 + off; G.bullets.push({ k: 'perf', x: e.x, y: e.y - 16, vx: Math.cos(a) * 185, vy: Math.sin(a) * 185, life: 2.4, dmg: e.dmg * 0.45, from: 'dog', r: 8, t: 0 }); } sfx('hairball'); }

// ---------- bullets ----------
function updBullet(b, dt) {
  b.t += dt; b.life -= dt;
  if (b.k === 'hair') {
    const f = Math.min(1, b.t / b.dur); b.x = U.lerp(b.sx, b.tx, f); b.y = U.lerp(b.sy, b.ty, f); b.z = Math.sin(f * Math.PI) * 60;
    if (f >= 1) { b.life = 0; poof(b.x, b.y, 10, '#d9b98a'); part({ x: b.x, y: b.y, k: 'ring', col: '#e6cfa6', size: 16, life: 0.3, grow: 300 }); sfx('ko'); shake(5);
      for (const e of G.dogs) if (!e.dead && U.d2(e.x, e.y, b.x, b.y) < 95 * 95) { hurtDog(e, 22, 'hair', b.x, b.y, 140); if (!e.dead && !e.isBoss) e.stun = Math.max(e.stun, 1.8); } }
    return;
  }
  const n = 2;
  for (let s = 0; s < n; s++) {
    b.x += b.vx * dt / n; b.y += b.vy * dt / n;
    if (!W.pass(b.x, b.y + 10, 2)) { b.life = 0; splash(b); return; }
    if (b.from === 'cat') {
      for (const e of G.dogs) if (!e.dead && U.d2(e.x, e.y - 12, b.x, b.y) < (e.r + 8) * (e.r + 8)) { hurtDog(e, b.dmg, 'bolt', b.x - b.vx, b.y - b.vy, 70); b.life = 0; splash(b); hitstop(0.012); return; }
      for (const p of G.props) {
        if (p.k === 'switch' && !p.done && U.d2(p.x, p.y - 28, b.x, b.y) < 20 * 20) { p.done = true; b.life = 0; sfx('switch'); burst(p.x, p.y - 28, 12, ['#7CFF6B', '#fff'], 180, 'star', 6); openLink(p.link); G.flags.sw = (G.flags.sw || 0) + 1; shake(5); return; }
        if (p.k === 'cage' && !p.done && U.d2(p.x, p.y - 8, b.x, b.y) < 26 * 26) { b.life = 0; splash(b); sfx('tink', 0.1); return; }
      }
      for (const k of G.cars) if (!k.dead && (k.ai === 'cop' || k.ai === 'target') && U.d2(k.x, k.y, b.x, b.y) < 34 * 34) { damageCar(k, b.dmg * 0.55); b.life = 0; splash(b); return; }
    } else {
      for (const c of G.cats) {
        if (c.down || U.d2(c.x, c.y - 12, b.x, b.y) > (c.r + b.r) * (c.r + b.r)) continue;
        if (G.car && c.idx !== G.active) continue;
        if (b.k === 'net') { if (c.inv <= 0 && !G.car) { c.root = c.name === 'mimosa' ? 0.7 : 2.2; hurtCat(c, b.dmg, b.x, b.y); c.kx = c.ky = 0; if (c.name === 'mimosa') text(c.x, c.y - 56, tr('ripNet'), '#ff7ac0', 13); } }
        else hurtCat(c, b.dmg, b.x - b.vx, b.y - b.vy);
        b.life = 0; splash(b); return;
      }
    }
  }
  if (b.k === 'bolt' && Math.random() < 0.5) part({ x: b.x, y: b.y, k: 'dot', col: '#8ff3ff', size: 3, life: 0.2 });
}
function splash(b) { burst(b.x, b.y, 5, b.k === 'bolt' ? ['#8ff3ff', '#fff'] : b.k === 'perf' ? '#ff9fd6' : '#d7f25a', 130, 'dot', 4, 0.25); if (b.k === 'bolt') part({ x: b.x, y: b.y, k: 'ring', col: '#8ff3ff', size: 5, life: 0.18, grow: 120 }); }

// ---------- items ----------
function updItem(it, dt) {
  it.t += dt;
  if (it.fl) { // floating things (kites): drift with the wind, sink slowly, vanish a while after landing
    it.z = Math.max(0, it.z - it.fl * dt); const nx = it.x + (it.wx || 0) * dt, ny = it.y + (it.wy || 0) * dt;
    if (it.z > 0 && !W.blocked(nx, ny, 10, 0)) { it.x = nx; it.y = ny; } else if (it.z > 0) { it.wx = -(it.wx || 0); it.wy = -(it.wy || 0); }
    if (it.z <= 0) { it.gt = (it.gt || 0) + dt; if (it.gt > (it.ttl || 8)) { it.dead = true; it.missed = true; return; } }
  } else if (it.arc) { /* mini-game ball: moved by the mission */ }
  else if (it.vz || it.z > 0) { it.z += it.vz * dt; it.vz -= 600 * dt; if (it.z <= 0) { it.z = 0; it.vz = 0; it.vx = it.vy = 0; } }
  if (it.vx || it.vy) { const e = { x: it.x, y: it.y, r: 8 }; step(e, it.vx * dt, it.vy * dt, 0); it.x = e.x; it.y = e.y; }
  if (it.z > 8 || it.nopick) return;
  for (const c of G.cats) {
    if (c.down) continue;
    const d = U.d2(c.x, c.y, it.x, it.y);
    if (d < 70 * 70 && d > 4) { const l = Math.sqrt(d); it.x += (c.x - it.x) / l * 150 * dt; it.y += (c.y - it.y) / l * 150 * dt; }
    if (d < 26 * 26) { if (collect(c, it)) { it.dead = true; return; } }
  }
}
function collect(c, it) {
  const k = it.k;
  if (FOODS.includes(k)) {
    if (c.name === 'morticia') eat(c, k, k !== 'treat');
    else { G.cats[2].belly = Math.min(100, G.cats[2].belly + (G.cats[2].down ? 0 : 4)); G.stat.cash += 5; G.stat.eaten++; sfx('pickup', 0.05); text(it.x, it.y - 20, '+5', '#ffb347', 12); }
  } else if (k === 'coffee') {
    const m = G.cats[0]; if (m.down) return false;
    if (m.energy > 92 && c.name !== 'mimo') return false;
    m.energy = Math.min(100, m.energy + 60); m.exhausted = false; sfx('coffee'); text(m.x, m.y - 50, tr('coffee'), '#c9a27e', 15); part({ x: m.x, y: m.y - 16, k: 'ring', col: '#c9a27e', size: 10, life: 0.4 });
  } else if (k === 'paw') { VP.S.lives = Math.max(VP.S.lives, Math.min(9, VP.S.lives + 1)); VP.persist(); sfx('paw'); text(it.x, it.y - 24, tr('life1'), '#ffd23f', 17); burst(it.x, it.y, 12, '#ffd23f', 160, 'star', 7, 0.7); }
  else if (k === 'gpaw') {
    const S = VP.S; S.paws = S.paws || {}; S.paws[it.pid] = 1; S.cash += 50; sfx('paw'); burst(it.x, it.y, 14, '#ffd23f', 170, 'star', 7, 0.8);
    const d = it.pid.split('_')[0], per = (VP.Missions.act && VP.Missions.act.pawsPerDistrict) || 5; let n = 0; for (const key in S.paws) if (key.split('_')[0] === d) n++;
    if (n >= per) { S.lives = Math.max(S.lives, Math.min(9, S.lives + 1)); say(tr('pawsAll'), '#ffd23f', 3.5); } else say(tr('pawFound', n, per), '#ffd23f', 2.2);
    VP.persist();
  }
  else if (k === 'cash') { G.stat.cash += 25; sfx('cash', 0.05); text(it.x, it.y - 20, '+$25', '#7CFF6B', 13); }
  else if (k === 'catnip') { G.catnip = 7; sfx('paw'); say(tr('catnip'), '#7CFF6B', 2); for (const k2 of G.cats) k2.root = 0; }
  else if (k === 'milk') { let need = false; for (const k2 of G.cats) if (!k2.down && k2.hp < k2.max) need = true; if (!need) return false; healTeam(35); sfx('coffee'); }
  else if (k === 'kite') { G.stat.kites++; G.stat.cash += 15; sfx('paw', 0.05); text(it.x, it.y - 24, '🪁 +1', '#ffd23f', 15); burst(it.x, it.y - 10, 8, ['#ff4fb8', '#2de2e6', '#ffd23f'], 150, 'star', 6, 0.5); }
  else if (k === 'gcoin') { G.stat.coins++; G.stat.cash += 10; sfx('cash', 0.05); burst(it.x, it.y - 10, 6, '#ffd23f', 130, 'star', 6, 0.5); }
  else if (k === 'bag') { G.flags.bag = (G.flags.bag || 0) + 1; G.stat.cash += 60; sfx('paw'); say(tr('gotBag'), '#ffd23f', 2); burst(it.x, it.y - 10, 12, '#ffd23f', 160, 'star', 7, 0.7); }
  else if (k === 'key') { G.keys++; G.flags.key = (G.flags.key || 0) + 1; sfx('paw'); say(tr('gotKey'), '#ffd23f'); }
  return true;
}

// ---------- props ----------
function updProp(p, dt) {
  p.t += dt; if (p.flash > 0) p.flash -= dt;
  if (p.done && p.k !== 'stand') return;
  if (p.k === 'stand' && G.restock && p.left < 3) { p.rs = (p.rs || 0) + dt; if (p.rs > G.restock) { p.rs = 0; p.left++; } }
  if (p.k === 'lever') { const m = G.cats[2]; for (const c of G.cats) if (!c.down && U.d2(c.x, c.y, p.x, p.y) < 34 * 34) { p.done = true; sfx('switch'); openLink(p.link); G.flags.lever = (G.flags.lever || 0) + 1; burst(p.x, p.y - 10, 8, '#7CFF6B', 140, 'star', 6); } void m; }
  else if ((p.k === 'sdoor' && p.key) || (p.k === 'cage' && p.lock === 'key')) {
    for (const c of G.cats) if (!c.down && U.d2(c.x, c.y, p.x, p.y) < 70 * 70) {
      if (G.keys > 0) { G.keys--; if (p.k === 'cage') freeFriend(p); else { p.done = p.open = true; for (const [a, b] of p.tiles) W.setTile(a, b, TT.FLOOR); sfx('door'); poof(p.x, p.y - 10, 6); G.fieldT = 0; } }
      else if (c.idx === G.active && (!p.hintT || p.hintT < G.real)) { p.hintT = G.real + 2.5; text(p.x, p.y - 50, tr('needKey'), '#ffd23f', 13); }
      break;
    }
  }
}

// ---------- cars ----------
const DV = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function canGo(dir, i, j) { return dir === 0 ? i < W.cols : dir === 2 ? i > 0 : dir === 1 ? j < W.rows : j > 0; }
function laneCoord(dir, i, j) { return dir === 0 ? W.RY[j] + 48 : dir === 2 ? W.RY[j] - 48 : dir === 1 ? W.RX[i] - 48 : W.RX[i] + 48; }
function carBlocked(c, x, y) {
  const ca = Math.cos(c.a), sa = Math.sin(c.a), h = VP.Art.CARS[c.type].len / 2 - 18;
  return W.blocked(x + ca * h, y + sa * h, 17, 3) || W.blocked(x - ca * h, y - sa * h, 17, 3);
}
function updCar(c, dt, rdt) {
  c.t += dt; if (c.flash > 0) c.flash -= dt; if (c.hitCd > 0) c.hitCd -= dt;
  if (c.hp < c.max * 0.4 && Math.random() < dt * 8) part({ x: c.x + U.rand(-8, 8), y: c.y - 6, k: 'puff', size: 9, life: 0.6, col: 'rgba(60,60,70,.7)', vy: -40 });
  const driven = G.car === c, a0 = c.a;
  if (driven) {
    const m = Math.hypot(I.mx, I.my);
    if (m > 0.15) {
      const want = Math.atan2(I.my, I.mx), diff = U.angDiff(c.a, want);
      const turn = 3.4 * (0.35 + Math.min(1, Math.abs(c.spd) / 120) * 0.65);
      c.a += U.clamp(diff, -turn * rdt, turn * rdt);
      const align = Math.max(0.25, Math.cos(diff));
      const hill = W.hpx ? slopeMul(c.x, c.y, Math.cos(c.a), Math.sin(c.a)) : 1;
      c.spd += (c.top * m * align * (0.6 + 0.4 * hill) - c.spd) * Math.min(1, rdt * 1.9);
    } else c.spd *= Math.pow(0.25, rdt);
    dt = rdt;
    VP.Audio.engine(c.spd, true);
    if (Math.abs(c.spd) > 200 && Math.random() < dt * 20) part({ x: c.x - Math.cos(c.a) * 40, y: c.y - Math.sin(c.a) * 40, k: 'puff', size: 6, life: 0.3, col: 'rgba(255,255,255,.35)' });
    // drive-by: Mimo shoots from the window
    const mimo = G.cats[0];
    if (I.attack && !mimo.down && mimo.cd <= 0) { let ang = I.aim; if (ang === null) ang = autoAim(c, 480, 'bolt'); if (ang !== null) { const o = { x: c.x, y: c.y + 12 }; mimo.x = c.x; mimo.y = c.y + 12; shoot(mimo, ang, false); mimo.cd = mimo.exhausted ? 0.5 : 0.22; void o; } }
  } else if (c.ai === 'traffic') updTraffic(c, dt);
  else if (c.ai === 'cop') updCopCar(c, dt);
  else if (c.ai === 'path') updPathCar(c, dt);
  else if (c.ai === 'target') updTargetCar(c, dt);
  else { c.spd *= Math.pow(0.05, dt); }
  if (c.ai !== 'traffic' || driven) {
    if (c.a !== a0 && carBlocked(c, c.x, c.y)) { c.a = a0; if (carBlocked(c, c.x, c.y)) { for (let i = 0; i < 8; i++) { const an = i * 0.785, qx = c.x + Math.cos(an) * 10, qy = c.y + Math.sin(an) * 10; if (!carBlocked(c, qx, qy)) { c.x = qx; c.y = qy; break; } } } }
    const nx = c.x + Math.cos(c.a) * c.spd * dt + c.px * dt, ny = c.y + Math.sin(c.a) * c.spd * dt + c.py * dt;
    c.px *= Math.pow(0.02, dt); c.py *= Math.pow(0.02, dt);
    if (!carBlocked(c, nx, c.y)) c.x = nx; else bump(c);
    if (!carBlocked(c, c.x, ny)) c.y = ny; else bump(c);
  }
  // collisions with dogs
  const fast = Math.abs(c.spd) > 80;
  if (fast && (driven || c.ai === 'parked')) for (const e of G.dogs) {
    if (e.dead || U.d2(e.x, e.y, c.x, c.y) > (30 + e.r) * (30 + e.r)) continue;
    hurtDog(e, 70 * Math.abs(c.spd) / 300, 'car', c.x, c.y, 420); c.spd *= e.isBoss ? 0.3 : 0.88; shake(5); hitstop(0.03); sfx('hit', 0.06);
    if (e.isBoss) damageCar(c, 12);
  }
  // car vs car
  for (const o of G.cars) {
    if (o === c || o.dead) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d < 46 && d > 0.1) {
      const nx = (o.x - c.x) / d, ny = (o.y - c.y) / d, rel = Math.abs(c.spd) + Math.abs(o.spd);
      const push = (46 - d) * 0.5;
      if (!carBlocked(c, c.x - nx * push, c.y - ny * push)) { c.x -= nx * push; c.y -= ny * push; }
      if (o.ai === 'parked' && G.car !== o && !carBlocked(o, o.x + nx * push, o.y + ny * push)) { o.x += nx * push; o.y += ny * push; }
      if (rel > 90 && c.hitCd <= 0 && o.hitCd <= 0) {
        c.hitCd = o.hitCd = 0.4; const dmg = rel * 0.035;
        const involvesPlayer = G.car === c || G.car === o;
        if (involvesPlayer) { sfx('crash', 0.15); shake(8); burst((c.x + o.x) / 2, (c.y + o.y) / 2, 8, ['#ffd23f', '#fff'], 200, 'dot', 4, 0.3); }
        const hostile = k => k.ai === 'cop' || k.ai === 'target';
        damageCar(c, hostile(o) && G.car === c ? dmg * 0.3 : hostile(c) ? dmg * 2.6 : dmg * 0.5);
        damageCar(o, hostile(c) && G.car === o ? dmg * 0.3 : hostile(o) ? dmg * 2.6 : dmg * 0.5);
        o.px += nx * rel * 0.5; o.py += ny * rel * 0.5; c.spd *= 0.55;
        if (o.ai === 'traffic' || o.ai === 'path') { o.ai = 'parked'; if (involvesPlayer && !G.noHeat) G.heat = Math.min(5, G.heat + 0.2); }
      }
    }
  }
}
function bump(c) {
  if (Math.abs(c.spd) > 140) { damageCar(c, Math.abs(c.spd) * 0.02); if (G.car === c) { shake(7); sfx('crash', 0.2); } burst(c.x + Math.cos(c.a) * 40, c.y + Math.sin(c.a) * 40, 6, ['#ffd23f', '#fff'], 160, 'dot', 4, 0.3); }
  c.spd *= -0.3; c.px = c.py = 0;
}
function updTraffic(c, dt) {
  const v = DV[c.dir];
  // brake for anything ahead
  let want = 105;
  const ax = c.x + v[0] * 62, ay = c.y + v[1] * 62;
  for (const k of G.cats) if (!k.down && !G.car && U.d2(k.x, k.y, ax, ay) < 46 * 46) want = 0;
  for (const o of G.cars) if (o !== c && !o.dead && U.d2(o.x, o.y, ax, ay) < 52 * 52) want = 0;
  for (const e of G.dogs) if (!e.dead && U.d2(e.x, e.y, ax, ay) < 40 * 40) want = 0;
  if (want === 0 && c.spd > 60 && onScreen(c.x, c.y, 0)) sfx('honk', 1.5);
  c.spd += (want - c.spd) * Math.min(1, dt * 4);
  const px = c.x, py = c.y;
  c.x += v[0] * c.spd * dt; c.y += v[1] * c.spd * dt;
  const hor = c.dir % 2 === 0, f0 = hor ? px : py, f1 = hor ? c.x : c.y, sgn = hor ? v[0] : v[1];
  const lines = hor ? W.RX : W.RY;
  // which road am I on
  let me = 0; { const arr = hor ? W.RY : W.RX, q = hor ? c.y : c.x; let bd = 1e9; arr.forEach((r, k) => { if (Math.abs(r - q) < bd) { bd = Math.abs(r - q); me = k; } }); }
  for (let k = 0; k < lines.length; k++) {
    const i = hor ? k : me, j = hor ? me : k;
    const rd = (c.dir + 1) % 4, ld = (c.dir + 3) % 4;
    const first = lines[k] - sgn * 48, second = lines[k] + sgn * 48;
    const crossed = t => sgn > 0 ? (f0 < t && f1 >= t) : (f0 > t && f1 <= t);
    const straight = canGo(c.dir, i, j);
    if (crossed(first)) { const must = !straight && !canGo(ld, i, j); if (canGo(rd, i, j) && (must || Math.random() < 0.3)) { turn(c, rd, i, j); return; } }
    if (crossed(second)) { if (canGo(ld, i, j) && (!straight || Math.random() < 0.25)) { turn(c, ld, i, j); return; } if (!straight) { c.dir = (c.dir + 2) % 4; const nv = laneCoord(c.dir, i, j); if (hor) c.y = nv; else c.x = nv; } }
  }
  c.a += U.angDiff(c.a, c.dir * Math.PI / 2) * Math.min(1, dt * 8);
}
function turn(c, nd, i, j) { const hor = nd % 2 === 0; if (hor) { c.y = laneCoord(nd, i, j); } else { c.x = laneCoord(nd, i, j); } c.dir = nd; }
function updCopCar(c, dt) {
  const a = active();
  const d = Math.hypot(a.x - c.x, a.y - c.y);
  if (!G.car && d < 170 && !c.dropped) { // park and release the hounds
    c.dropped = true; c.ai = 'parked';
    for (let i = 0; i < 2; i++) { const p = nearFree(c.x, c.y, 50, 0); if (p) { Game.addDog('cop', p.x, p.y); poof(p.x, p.y - 10, 5); } }
    return;
  }
  let dx = a.x - c.x, dy = a.y - c.y;
  if (!W.los(c.x, c.y, a.x, a.y, 3) && W.fieldDir(G.field, c.x, c.y, tmp) > 0) { dx = tmp.x; dy = tmp.y; }
  const want = Math.atan2(dy, dx), diff = U.angDiff(c.a, want);
  c.a += U.clamp(diff, -3 * dt, 3 * dt);
  const top = c.top * (1 + G.n * 0.0025);
  c.spd += (top * Math.max(0.3, Math.cos(diff)) - c.spd) * Math.min(1, dt * 1.6);
  if (c.stuckT === undefined) c.stuckT = 0;
  if (Math.abs(c.spd) < 30) { c.stuckT += dt; if (c.stuckT > 1.5) { c.spd = -160; c.a += 0.9; c.stuckT = 0; } } else c.stuckT = 0;
}
function updPathCar(c, dt) {
  const pts = c.road.pts;
  if (c.wi < 0 || c.wi >= pts.length) { c.dirn = -c.dirn; c.wi = U.clamp(c.wi + c.dirn * 2, 0, pts.length - 1); }
  const wp = pts[c.wi], prev = pts[U.clamp(c.wi - c.dirn, 0, pts.length - 1)];
  let ox = 0, oy = 0; { const dx = wp.x - prev.x, dy = wp.y - prev.y, l = Math.hypot(dx, dy); if (l > 1) { const off = Math.min(40, c.road.w * 4); ox = -dy / l * off; oy = dx / l * off; } }
  const tx = wp.x + ox, ty = wp.y + oy, dx = tx - c.x, dy = ty - c.y;
  if (dx * dx + dy * dy < 70 * 70) c.wi += c.dirn;
  const want = Math.atan2(dy, dx), diff = U.angDiff(c.a, want);
  c.a += U.clamp(diff, -3 * dt, 3 * dt);
  let top = 100; const ax = c.x + Math.cos(c.a) * 62, ay = c.y + Math.sin(c.a) * 62;
  for (const k of G.cats) if (!k.down && !G.car && U.d2(k.x, k.y, ax, ay) < 46 * 46) top = 0;
  for (const o of G.cars) if (o !== c && !o.dead && U.d2(o.x, o.y, ax, ay) < 50 * 50) top = 0;
  c.spd += (top * Math.max(0.3, Math.cos(diff)) - c.spd) * Math.min(1, dt * 3);
  if (top > 0 && Math.abs(c.spd) < 12) { c.stuckT = (c.stuckT || 0) + dt; if (c.stuckT > 2.5) { c.stuckT = 0; c.dirn = -c.dirn; c.wi = U.clamp(c.wi + c.dirn, 0, pts.length - 1); c.a += 3.14; } } else c.stuckT = 0;
}
function updTargetCar(c, dt) {
  const wp = c.route[c.wi % c.route.length];
  const dx = wp.x - c.x, dy = wp.y - c.y;
  if (dx * dx + dy * dy < 80 * 80) c.wi++;
  const want = Math.atan2(dy, dx), diff = U.angDiff(c.a, want);
  c.a += U.clamp(diff, -3.2 * dt, 3.2 * dt);
  const hurt = c.hp / c.max;
  c.spd += (c.top * (0.72 + 0.28 * hurt) * Math.max(0.35, Math.cos(diff)) - c.spd) * Math.min(1, dt * 1.5);
  if (Math.abs(c.spd) < 25) { c.stuckT = (c.stuckT || 0) + dt; if (c.stuckT > 1.2) { c.spd = -150; c.stuckT = 0; } } else c.stuckT = 0;
  if (c.drop) { c.dropT = (c.dropT || 2) - dt; if (c.dropT <= 0 && G.car && U.d2(c.x, c.y, G.car.x, G.car.y) < 500 * 500) { c.dropT = c.drop; const a = Math.atan2(G.car.y - c.y, G.car.x - c.x); G.bullets.push({ k: 'net', x: c.x, y: c.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, life: 1.6, dmg: 8, from: 'dog', r: 14, t: 0 }); } }
}
function enterCar(car) {
  if (G.cats.some(c => c.down)) { say(tr('noOneBehind'), '#ff6b6b', 2.5); return; }
  G.car = car; car.ai = 'player'; car.spd = 0; sfx('door');
  for (const c of G.cats) { poof(c.x, c.y - 10, 4); c.x = car.x; c.y = car.y; c.root = 0; c.dashT = 0; }
  if (!G.tut.car) { G.tut.car = 1; say(tr('tipCar'), '#fff', 3); }
}
function exitCar(force) {
  const car = G.car; if (!car) return;
  G.car = null; car.ai = 'parked'; VP.Audio.engine(0, false); if (!force) sfx('door');
  for (const c of G.cats) { const p = nearFree(car.x, car.y, 56, 0) || { x: car.x, y: car.y }; c.x = p.x; c.y = p.y; c.inv = 0.8; poof(c.x, c.y - 10, 4); }
  G.fieldT = 0;
}
Game.enterCar = enterCar; Game.exitCar = exitCar;

// ---------- wanted ----------
const CAP = [0, 2, 3, 4, 5, 6], CARCAP = [0, 0, 1, 2, 2, 3];
function updWanted(dt) {
  if (G.heat < G.minWanted) G.heat = G.minWanted;
  let police = 0, pcars = 0, seen = false;
  const a = active();
  for (const e of G.dogs) if (e.police && !e.dead && e.state !== 'flee') { police++; if (U.d2(e.x, e.y, a.x, a.y) < 430 * 430) seen = true; }
  for (const c of G.cars) if (c.ai === 'cop' && !c.dead) { pcars++; if (U.d2(c.x, c.y, a.x, a.y) < 480 * 480) seen = true; }
  if (G.heat > 0) { if (seen) G.calm = 0; else G.calm += dt; if (G.calm > 4 && G.heat > G.minWanted) G.heat = Math.max(G.minWanted, G.heat - dt / 6); }
  const w = Math.min(5, Math.ceil(G.heat - 0.001));
  if (w > G.wanted) { sfx('wanted', 0.5); G.wantedFlash = 1; }
  if (w === 0 && G.wanted > 0) { for (const e of G.dogs) if (e.police && !e.tag) { e.state = 'flee'; e.st = 8; } say(tr('lostCops'), '#7CFF6B', 2); }
  G.wanted = w;
  if (G.wantedFlash > 0) G.wantedFlash -= dt;
  if (w <= 0 || G.noPolice) return;
  G.copT -= dt;
  if (G.copT > 0) return;
  G.copT = Math.max(1.1, 3.4 - w * 0.45);
  if (G.car && pcars < CARCAP[w]) {
    const p = spawnPoint(520, 800, true); if (p) { const c = Game.addCar('cop', p.x, p.y, Math.atan2(a.y - p.y, a.x - p.x), { ai: 'cop' }); void c; }
  } else if (police < CAP[w] && !(G.car && w < 2)) {
    const p = spawnPoint(430, 720); if (!p) return;
    const r = Math.random(); let type = 'cop';
    if (w >= 2 && r < 0.3) type = 'catcher'; else if (w >= 3 && r < 0.5) type = 'shooter'; else if (w >= 4 && r < 0.6) type = 'heavy';
    const e = Game.addDog(type, p.x, p.y, { police: true }); e.state = 'chase';
  }
}
function spawnPoint(dmin, dmax, road) {
  const a = active();
  for (let i = 0; i < 40; i++) {
    const ang = Math.random() * 6.283, d = U.rand(dmin, dmax);
    const p = { x: (Math.floor((a.x + Math.cos(ang) * d) / T) + 0.5) * T, y: (Math.floor((a.y + Math.sin(ang) * d) / T) + 0.5) * T };
    if (!W.clear(p.x, p.y)) continue;
    if (W.distAt(G.field, p.x, p.y) < 0) continue;
    if (road && W.blocked(p.x, p.y, 40, 3)) continue;
    return p;
  }
  return null;
}
Game.spawnPoint = spawnPoint; Game.nearFree = nearFree;

// ---------- context actions ----------
function updContext(dt) {
  const c = active(); G.ctx = null;
  if (G.car) { G.ctx = { k: 'exit' }; if (I.take('ctx') && Math.abs(G.car.spd) < 220) exitCar(); G.revive = 0; return; }
  let down = null, bd = 58 * 58;
  for (const k of G.cats) if (k.down) { const d = U.d2(k.x, k.y, c.x, c.y); if (d < bd) { bd = d; down = k; } }
  if (down) {
    G.ctx = { k: 'revive', cat: down };
    if (I.ctxHeld) {
      if (VP.S.lives <= 0) { if (!G.noLifeT || G.noLifeT < G.real) { G.noLifeT = G.real + 2; say(tr('noLives'), '#ff6b6b', 2); } }
      else { G.revive += dt / 1.15; if (Math.random() < dt * 14) part({ x: down.x + U.rand(-14, 14), y: down.y - 10, k: 'heart', size: 6, life: 0.5, vy: -50, col: '#ff7ac0' }); if (G.revive >= 1) { G.revive = 0; revive(down); } }
    } else G.revive = Math.max(0, G.revive - dt * 2);
    I.take('ctx'); return;
  }
  G.revive = 0;
  let car = null; bd = 70 * 70;
  for (const k of G.cars) if (!k.dead && k.ai !== 'cop' && k.ai !== 'target' && !k.locked && !(k.ai === 'path' && Math.abs(k.spd) > 60)) { const d = U.d2(k.x, k.y, c.x, c.y); if (d < bd) { bd = d; car = k; } }
  if (car && !G.noCars) { G.ctx = { k: 'car', car }; if (I.take('ctx')) { if (car.needKey && !G.flags.key) say(tr('needKey'), '#ffd23f', 2); else enterCar(car); } return; }
  I.take('ctx');
}
function revive(c) {
  VP.S.lives--; VP.persist();
  c.down = false; c.hp = Math.round(c.max * 0.6); c.inv = 2.5; c.flash = 0.3;
  if (c.name === 'mimo') { c.energy = Math.max(c.energy, 60); c.exhausted = false; } if (c.name === 'morticia') c.belly = Math.max(c.belly, 50);
  sfx('revive'); burst(c.x, c.y - 16, 16, ['#ff7ac0', '#fff', '#7CFF6B'], 180, 'heart', 8, 0.8);
  say(tr(c.name).toUpperCase() + ' ' + tr('revived'), '#7CFF6B', 2.2);
}
Game.revive = revive;

// ---------- main update ----------
Game.update = function (dt) {
  if (!G || G.over) return;
  G.real += dt;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  const sdt = dt * (G.nap > 0 ? 0.32 : 1);
  G.time += dt;
  for (const k of ['nap', 'catnip', 'feast']) if (G[k] > 0) G[k] -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  // switching
  const sw = I.take('sw'); if (sw >= 0) switchTo(sw);
  if (I.take('cycle') && G.solo === null) { for (let i = 1; i < 3; i++) { const n = (G.active + i) % 3; if (!G.cats[n].down) { switchTo(n); break; } } }
  refreshFields();
  updContext(dt);
  if (I.take('special')) { if (G.car) { sfx(G.car.type === 'gold' ? 'viphorn' : 'honk', 0.6); } else doSpecial(active()); }
  if (I.take('dash')) { if (!G.car) doDash(active()); }
  { const em = I.take('emote'); if (em) Game.emote(em); }
  for (const c of G.cats) updCat(c, dt);
  // friends follow
  for (const f of G.friends) {
    f.t += dt; f.walk = 0;
    if (f.wander) { f.wt = (f.wt || 0) - dt; if (f.wt <= 0) { f.wt = U.rand(2, 6); const an = Math.random() * 6.283, d = U.rand(40, 160); f.gx = f.home.x + Math.cos(an) * d; f.gy = f.home.y + Math.sin(an) * d; } if (f.gx !== undefined && U.d2(f.x, f.y, f.gx, f.gy) > 20 * 20 && f.wt > 1) { const px = f.x, py = f.y; moveToward(f, f.gx, f.gy, 70, dt, null, 0); if (px === f.x && py === f.y) f.wt = 0; } continue; }
    if (f.stay) continue; const a = active(); const d = Math.hypot(a.x - f.x, a.y - f.y);
    if (d > 70) { if (d > 620 && !onScreen(f.x, f.y, 60)) { const p = nearFree(a.x, a.y, 60, 0); if (p) { f.x = p.x; f.y = p.y; } } else moveToward(f, a.x, a.y, f.spd || 185, dt, G.field, 0); }
  }
  for (const e of G.dogs) updDog(e, sdt);
  if (VP.Ext) VP.Ext.tick(G, dt, sdt); // [hook:ext] enemies, boss, clinic, season
  // soft separation
  const all = G.dogs;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), p = (rr - d) * 0.5, nx = dx / d, ny = dy / d; if (!a.isBoss) step(a, -nx * p, -ny * p, 0); if (!b.isBoss) step(b, nx * p, ny * p, 0); }
  }
  for (const b of G.bullets) updBullet(b, b.from === 'cat' ? dt : sdt);
  for (const it of G.items) updItem(it, dt);
  for (const p of G.props) updProp(p, dt);
  for (const c of G.cars) if (!c.dead) updCar(c, sdt, dt);
  for (const t of G.teles) { t.t += sdt; if (t.follow) { t.x = t.follow.x; t.y = t.follow.y; } }
  for (const p of G.parts) {
    p.t += dt;
    if (p.tx) { const f = Math.min(1, p.t / p.life); p.x += (p.tx.x - p.x) * f * 0.5; p.y += (p.tx.y - 20 - p.y) * f * 0.5; }
    else { p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'dot' || p.k === 'star') { p.vx *= 0.93; p.vy *= 0.93; } }
  }
  for (const t of G.texts) { t.t += dt; t.y -= 38 * dt; }
  const live = o => !o.dead;
  G.dogs = G.dogs.filter(live); G.items = G.items.filter(live); G.cars = G.cars.filter(live);
  G.bullets = G.bullets.filter(b => b.life > 0); G.parts = G.parts.filter(p => p.t < p.life); G.texts = G.texts.filter(t => t.t < 0.9);
  G.teles = G.teles.filter(t => t.t < t.dur + 0.05);
  if (G.boss && G.boss.dead) G.bossDead = true;
  updWanted(sdt);
  // mercy: a golden paw appears if someone is down and there are no lives left
  if (VP.S.lives <= 0 && G.cats.some(c => c.down) && !G.items.some(i => i.k === 'paw')) {
    G.pawT += dt; if (G.pawT > 2) { G.pawT = 0; const a = active(); const p = spawnPoint(260, 700); void a; if (p) { Game.addItem('paw', p.x, p.y); say(tr('pawHint'), '#ffd23f', 3.5); } }
  }
  if (G.car && G.car.dead) G.car = null;
  VP.Missions.update(G, dt);
  if (!G) return;
  // camera
  const a = active(); let tx = a.x, ty = a.y - 10;
  if (G.car) { tx += Math.cos(G.car.a) * G.car.spd * 0.3; ty += Math.sin(G.car.a) * G.car.spd * 0.3; }
  else if (I.aim !== null || I.attack) { tx += Math.cos(a.aim) * 36; ty += Math.sin(a.aim) * 36; }
  const k = Math.min(1, dt * 6); G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
};
Game.fail = function (why) { if (G.over) return; G.over = true; VP.Audio.engine(0, false); sfx('fail'); setTimeout(() => VP.UI.result(false, why), 900); };
Game.win = function () {
  if (G.over) return; if (G.car) exitCar(true); G.over = true; G.won = true; VP.Audio.engine(0, false); sfx('win');
  for (const c of G.cats) burst(c.x, c.y - 20, 14, ['#ffd23f', '#ff4fb8', '#2de2e6'], 220, 'star', 8, 1);
  setTimeout(() => VP.UI.result(true), 1100);
};
Game.end = function () { VP.Audio.engine(0, false); G = Game.G = null; };
// small serializable snapshot of the player's party (entity-state layer; ready for future online sync)
Game.snapshot = function () {
  if (!G) return null;
  const r = v => Math.round(v);
  return { t: +G.real.toFixed(2), a: G.active, car: G.car ? { k: G.car.type, x: r(G.car.x), y: r(G.car.y), a: +G.car.a.toFixed(2), v: r(G.car.spd) } : null,
    cats: G.cats.map(c => ({ n: c.name, x: r(c.x), y: r(c.y), h: +(c.aim || 0).toFixed(2), w: c.walk ? 1 : 0, s: c.down ? 'down' : c.atk > 0.1 ? 'atk' : c.dashT > 0 ? 'dash' : 'idle', hp: r(c.hp), e: c.emote ? c.emote.k : undefined })) };
};
})();
