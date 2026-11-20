'use strict';
// VICE PAWS — ambient traffic: buses, delivery vans and motorbikes that keep to their lane, stop at traffic lights and zebra
// crossings, honk and brake for cats. They are scenery (drivable vehicles are another module): nobody is ever hit. A cat in
// front of a moving vehicle gets a honk, a little jump and an "Ufa!".
// Public API: VP.Life.traffic (see the bottom of this file).
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, LL = VP.LifeLogic, Game = VP.Game, Life = VP.Life;
const sfx = (n, g) => VP.Audio && VP.Audio.sfx(n, g);
const DV = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// half = half length (px), wid = half width, top = cruise speed (px/s)
const KIND = Life.VEHICLES = {
  bus: { half: 66, wid: 24, top: 86, w: 2 },
  van: { half: 44, wid: 21, top: 100, w: 4 },
  moto: { half: 20, wid: 9, top: 124, w: 4 },
};
const VAN_COLS = ['#ffffff', '#ffd23f', '#ff8a5c', '#8fc4ff', '#7CFF6B'], BUS_COLS = ['#ffb300', '#2de2e6', '#ff4fb8'], MOTO_COLS = ['#e01e37', '#2a6bff', '#17121d', '#ffd23f', '#7CFF6B'];
const laneCoord = (W, dir, i, j) => (dir === 0 ? W.RY[j] + 48 : dir === 2 ? W.RY[j] - 48 : dir === 1 ? W.RX[i] - 48 : W.RX[i] + 48);
const canGo = (W, dir, i, j) => (dir === 0 ? i < W.cols : dir === 2 ? i > 0 : dir === 1 ? j < W.rows : j > 0);
const nearestIx = (arr, q) => { let b = 0, bd = 1e9; for (let k = 0; k < arr.length; k++) { const d = Math.abs(arr[k] - q); if (d < bd) { bd = d; b = k; } } return b; };
const isRoad = (W, x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx >= 0 && ty >= 0 && tx < W.W && ty < W.H && W.gnd[ty * W.W + tx] === 1 && W.grid[ty * W.W + tx] === 0; };

function pickKind(r) { return LL.weighted(Object.keys(KIND).map(k => ({ k, w: KIND[k].w })), r).k; }
function make(L, kind, x, y, a, o) {
  const K = KIND[kind], r = L.rng;
  const v = Object.assign({ kind, x, y, a, spd: K.top * 0.8, top: K.top * r.range(0.9, 1.08), half: K.half, wid: K.wid, col: r.pick(kind === 'bus' ? BUS_COLS : kind === 'van' ? VAN_COLS : MOTO_COLS), t: r() * 9, missT: 0, honkT: 0, stuck: 0, ghost: 0, fade: 0, lean: 0 }, o);
  L.vehicles.push(v); return v;
}
Life._.spawnVehicle = function (L, a, yaw) {
  const W = L.W, r = L.rng, G = L.G, kind = pickKind(r);
  let x, y, o, ang;
  if (W.real) {
    if (!W.roads || !W.roads.length) return;
    const road = r.pick(W.roads), wi = r.int(0, road.pts.length - 1), p = road.pts[wi]; x = p.x; y = p.y; ang = 0;
    if (kind === 'bus' && road.w < 9) return; // buses keep to the avenues
    o = { road, wi, dirn: r() < 0.5 ? 1 : -1 };
  } else {
    if (!W.RX || W.cols < 1) return;
    const hor = r() < 0.5, fwd = r() < 0.5; let dir;
    if (hor) { const j = r.int(0, W.rows); dir = fwd ? 0 : 2; y = laneCoord(W, dir, 0, j); x = a.x + r.range(-1150, 1150); }
    else { const i = r.int(0, W.cols); dir = fwd ? 1 : 3; x = laneCoord(W, dir, i, 0); y = a.y + r.range(-1150, 1150); }
    if (x < W.RX[0] + 120 || x > W.RX[W.cols] - 120 || y < W.RY[0] + 120 || y > W.RY[W.rows] - 120) return;
    // not in the middle of a crossing
    if (Math.abs(W.RX[nearestIx(W.RX, x)] - x) < 150 && Math.abs(W.RY[nearestIx(W.RY, y)] - y) < 150) return;
    o = { dir }; ang = dir * Math.PI / 2;
  }
  const d2 = U.d2(x, y, a.x, a.y);
  if (d2 < 430 * 430 || d2 > 1250 * 1250 || !isRoad(W, x, y)) return;
  if (yaw !== null && (x - a.x) * Math.cos(yaw) + (y - a.y) * Math.sin(yaw) < 0 && r() < 0.5) return;
  for (const c of G.cars) if (U.d2(c.x, c.y, x, y) < 170 * 170) return;
  for (const v of L.vehicles) if (U.d2(v.x, v.y, x, y) < 190 * 190) return;
  make(L, kind, x, y, ang, o);
};

// is (x, y) inside the box in front of the vehicle? returns the forward distance or -1
function aheadOf(v, ca, sa, x, y, reach, side) {
  const dx = x - v.x, dy = y - v.y, f = dx * ca + dy * sa; if (f < 6 || f > reach) return -1;
  return Math.abs(-dx * sa + dy * ca) < side ? f : -1;
}
function ufa(L, c, v) {
  if (L.missCd > 0) return; L.missCd = 2.6; L.stats.ufa++;
  Game.fx.text(c.x, c.y - 62, VP.t('lf_ufa'), '#ffffff', 21); c.hopT = 0.5; Game.fx.poof(c.x, c.y - 8, 6, '#fff'); sfx('honk', 0.6); VP.haptic(22);
  for (let i = 0; i < 5; i++) Game.fx.part({ x: c.x + U.rand(-14, 14), y: c.y - 30, k: 'star', size: 5, life: 0.5, vx: U.rand(-60, 60), vy: -80, col: '#ffd23f' });
  void v;
}
Life._.ufa = ufa;
// everything a vehicle must not drive into: cats, people, pets, the player's car, other traffic
function obstacle(L, v, ca, sa) {
  const G = L.G, reach = v.half + 74 + v.spd * 0.3, side = v.wid + 13; let best = -1;
  const see = (x, y, r) => { const f = aheadOf(v, ca, sa, x, y, reach + (r || 0), side + (r || 0)); if (f >= 0 && (best < 0 || f < best)) best = f; return f; };
  if (!G.car) for (const c of G.cats) if (!c.down) { const f = see(c.x, c.y, 0); if (f >= 0 && c.idx === G.active && LL.nearMiss(v.x + ca * v.half * 0.6, v.y + sa * v.half * 0.6, v.a, v.spd, c.x, c.y)) ufa(L, c, v); }
  for (const p of L.peds) if (p.near !== false) see(p.x, p.y, 0);
  for (const c of L.animals) see(c.x, c.y, 0);
  for (const c of G.cars) if (!c.dead) see(c.x, c.y, 22);
  for (const e of G.dogs) if (!e.dead) see(e.x, e.y, 0);
  for (const o of L.vehicles) if (o !== v) see(o.x, o.y, o.half * 0.6);
  return best;
}
function drive(L, v, dt, want) {
  // deadlock breaker: a vehicle held by an obstacle (not by a light) for a long time creeps through
  if (want < 5 && !v.atLight) { v.stuck += dt; if (v.stuck > 7) { v.ghost = 2.5; v.stuck = 0; } } else v.stuck = Math.max(0, v.stuck - dt * 2);
  const k = want < v.spd ? 5.5 : 1.6; v.spd += (want - v.spd) * Math.min(1, dt * k); if (v.spd < 2 && want === 0) v.spd = 0;
}
function updGrid(L, v, dt) {
  const W = L.W, d = DV[v.dir], hor = v.dir % 2 === 0, sgn = hor ? d[0] : d[1], ca = d[0], sa = d[1];
  let want = v.top; v.atLight = false;
  const lines = hor ? W.RX : W.RY, pos = hor ? v.x : v.y, me = nearestIx(hor ? W.RY : W.RX, hor ? v.y : v.x), ext = v.half - 40;
  if (L.lightsOn) for (let k = 0; k < lines.length; k++) {
    const dist = (lines[k] - pos) * sgn - ext; if (dist <= 0 || dist > LL.LOOK) continue;
    const i = hor ? k : me, j = hor ? me : k;
    if (LL.mustStop(L.t, i, j, v.dir, dist)) { want = Math.min(want, v.top * U.clamp((dist - LL.STOP) / 90, 0, 1)); v.atLight = true; }
  }
  if (v.ghost > 0) v.ghost -= dt; else { const f = obstacle(L, v, ca, sa); if (f >= 0) { const w = LL.followSpeed(v.top, f - v.half, 30); if (w < want) { want = w; if (v.atLight && w > 0) v.atLight = true; else v.atLight = v.atLight && w >= want; } if (w === 0 && v.spd > 55 && v.honkT <= 0) { v.honkT = 3; if (Game.onScreen(v.x, v.y, 0)) sfx('honk', 1.2); } } }
  drive(L, v, dt, want);
  const px = v.x, py = v.y;
  v.x += d[0] * v.spd * dt; v.y += d[1] * v.spd * dt;
  const f0 = hor ? px : py, f1 = hor ? v.x : v.y;
  for (let k = 0; k < lines.length; k++) {
    const i = hor ? k : me, j = hor ? me : k, rd = (v.dir + 1) % 4, ld = (v.dir + 3) % 4;
    const first = lines[k] - sgn * 48, second = lines[k] + sgn * 48;
    const crossed = t => (sgn > 0 ? f0 < t && f1 >= t : f0 > t && f1 <= t);
    const straight = canGo(W, v.dir, i, j), bus = v.kind === 'bus';
    if (crossed(first)) { const must = !straight && !canGo(W, ld, i, j); if (canGo(W, rd, i, j) && (must || Math.random() < (bus ? 0.12 : 0.3))) { turn(W, v, rd, i, j); return; } }
    if (crossed(second)) { if (canGo(W, ld, i, j) && (!straight || Math.random() < (bus ? 0.1 : 0.25))) { turn(W, v, ld, i, j); return; } if (!straight) { v.dir = (v.dir + 2) % 4; const nv = laneCoord(W, v.dir, i, j); if (hor) v.y = nv; else v.x = nv; } }
  }
  // a pedestrian street or a park ahead (bigger home maps): turn back instead of driving through it
  if (!isRoad(W, v.x + d[0] * (v.half + 30), v.y + d[1] * (v.half + 30))) { v.dir = (v.dir + 2) % 4; const i = nearestIx(W.RX, v.x), j = nearestIx(W.RY, v.y), nv = laneCoord(W, v.dir, i, j); if (hor) v.y = nv; else v.x = nv; }
  const da = U.angDiff(v.a, v.dir * Math.PI / 2); v.a += da * Math.min(1, dt * 7); v.lean = da;
}
function turn(W, v, nd, i, j) { if (nd % 2 === 0) v.y = laneCoord(W, nd, i, j); else v.x = laneCoord(W, nd, i, j); v.dir = nd; }
function updPath(L, v, dt) {
  const pts = v.road.pts;
  if (v.wi < 0 || v.wi >= pts.length) { v.dirn = -v.dirn; v.wi = U.clamp(v.wi + v.dirn * 2, 0, pts.length - 1); }
  const wp = pts[v.wi], prev = pts[U.clamp(v.wi - v.dirn, 0, pts.length - 1)];
  let ox = 0, oy = 0; { const dx = wp.x - prev.x, dy = wp.y - prev.y, l = Math.hypot(dx, dy); if (l > 1) { const off = Math.min(40, v.road.w * 4); ox = -dy / l * off; oy = dx / l * off; } }
  const dx = wp.x + ox - v.x, dy = wp.y + oy - v.y;
  if (dx * dx + dy * dy < 70 * 70) v.wi += v.dirn;
  const diff = U.angDiff(v.a, Math.atan2(dy, dx)); v.a += U.clamp(diff, -2.6 * dt, 2.6 * dt); v.lean = diff;
  const ca = Math.cos(v.a), sa = Math.sin(v.a); let want = v.top * Math.max(0.3, Math.cos(diff)); v.atLight = false;
  if (v.ghost > 0) v.ghost -= dt; else { const f = obstacle(L, v, ca, sa); if (f >= 0) { const w = LL.followSpeed(v.top, f - v.half, 30); if (w < want) want = w; if (w === 0 && v.spd > 55 && v.honkT <= 0) { v.honkT = 3; if (Game.onScreen(v.x, v.y, 0)) sfx('honk', 1.2); } } }
  drive(L, v, dt, want);
  if (L.W.hpx) v.spd *= 1; // (slopes are gentle enough for the ambient traffic)
  v.x += ca * v.spd * dt; v.y += sa * v.spd * dt;
}
// the game's own traffic cars (G.cars, ai "traffic") get the same manners: they wait at red lights and for people on the zebra
function holdCars(L, dt, a) {
  const G = L.G, W = L.W;
  for (const c of G.cars) {
    if (c.ai !== 'traffic' || c.dead || G.car === c) { c._hold = null; continue; }
    if (Math.abs(c.x - a.x) > 1500 || Math.abs(c.y - a.y) > 1500) { c._hold = null; continue; }
    const d = DV[c.dir], hor = c.dir % 2 === 0, sgn = hor ? d[0] : d[1], lines = hor ? W.RX : W.RY, pos = hor ? c.x : c.y, me = nearestIx(hor ? W.RY : W.RX, hor ? c.y : c.x);
    let cap = 1e9, stop = false;
    if (L.lightsOn) for (let k = 0; k < lines.length; k++) { const dist = (lines[k] - pos) * sgn; if (dist <= 0 || dist > LL.LOOK) continue; if (LL.mustStop(L.t, hor ? k : me, hor ? me : k, c.dir, dist)) { cap = Math.min(cap, 105 * U.clamp((dist - LL.STOP) / 90, 0, 1)); if (dist <= LL.STOP + 5) stop = true; } }
    const fake = { x: c.x, y: c.y, a: c.dir * Math.PI / 2 };
    for (const p of L.peds) if (p.near !== false && aheadOf(fake, d[0], d[1], p.x, p.y, 96, 30) >= 0) { stop = true; cap = 0; break; }
    if (!stop) for (const v of L.vehicles) if (aheadOf(fake, d[0], d[1], v.x, v.y, 70 + v.half, 30) >= 0) { stop = true; cap = 0; break; }
    if (!G.car && L.free && LL.nearMiss(c.x + d[0] * 30, c.y + d[1] * 30, fake.a, c.spd, a.x, a.y)) ufa(L, a, c);
    if (stop) { if (!c._hold) c._hold = { x: c.x, y: c.y }; c.x = c._hold.x; c.y = c._hold.y; c.spd = 0; }
    else { c._hold = null; if (c.spd > cap) c.spd = cap; }
  }
}
Life._.updTraffic = function (L, dt, a) {
  const W = L.W;
  for (const v of L.vehicles) {
    v.t += dt; if (v.honkT > 0) v.honkT -= dt; if (v.fade < 1) v.fade = Math.min(1, v.fade + dt * 2);
    if (L.paused) { v.spd *= Math.pow(0.02, dt); continue; }
    if (v.road) updPath(L, v, dt); else updGrid(L, v, dt);
  }
  if (!W.real && W.RX) holdCars(L, dt, a);
  // the player's car and the ambient traffic never crunch: scenery gives way with a honk
  const car = L.G.car;
  if (car) for (const v of L.vehicles) { const d = Math.hypot(v.x - car.x, v.y - car.y), min = v.half * 0.7 + 30; if (d < min && d > 0.1) { car.spd *= 0.86; v.spd = 0; if (v.honkT <= 0) { v.honkT = 2; sfx('honk', 0.8); } const nx = (car.x - v.x) / d, ny = (car.y - v.y) / d; if (!W.blocked(car.x + nx * 3, car.y + ny * 3, 17, 3)) { car.x += nx * 3; car.y += ny * 3; } } }
};

// ---------- exported API (other modules: read-only view of the ambient traffic and of the lights) ----------
Life.traffic = {
  // vehicles alive right now: [{ kind: 'bus'|'van'|'moto', x, y, a, spd, half, wid }]
  list() { const L = Game.G && Game.G.life; return L ? L.vehicles : []; },
  // vehicles within r px of a point
  near(x, y, r) { return Life.traffic.list().filter(v => U.d2(v.x, v.y, x, y) < r * r); },
  // state of the light at crossing (i, j) of the home grid: { ns, ew } with 0 red, 1 amber, 2 green; null where there are no lights
  light(i, j) { const L = Game.G && Game.G.life; return L && L.lightsOn ? LL.lightState(L.t, i, j) : null; },
  // should something heading `dir` (0 east, 1 south, 2 west, 3 north) at (x, y) stop for a light?
  mustStop(x, y, dir) {
    const L = Game.G && Game.G.life; if (!L || !L.lightsOn) return false; const W = L.W, hor = dir % 2 === 0, d = DV[dir], sgn = hor ? d[0] : d[1], lines = hor ? W.RX : W.RY, pos = hor ? x : y, me = nearestIx(hor ? W.RY : W.RX, hor ? y : x);
    for (let k = 0; k < lines.length; k++) { const dist = (lines[k] - pos) * sgn; if (dist > 0 && dist <= LL.LOOK && LL.mustStop(L.t, hor ? k : me, hor ? me : k, dir, dist)) return true; }
    return false;
  },
  // freeze / release the ambient traffic (cutscenes, minigames)
  pause(on) { const L = Game.G && Game.G.life; if (L) L.paused = !!on; },
  // remove every ambient vehicle inside a circle (e.g. to clear a race track)
  clear(x, y, r) { const L = Game.G && Game.G.life; if (L) L.vehicles = L.vehicles.filter(v => U.d2(v.x, v.y, x, y) > r * r); },
  // cap override: Life.traffic.max = n (null = automatic by device)
  max: null,
};
})();
