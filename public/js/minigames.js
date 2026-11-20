'use strict';
// VICE PAWS — extra mission templates (escort, stealth, photo hunt, delivery chain, duel, parkour, kite festival,
// beach volleyball, pier fishing, treat-truck heist, kitten rescue, tutorial) and the "Volta ao Mundo" city missions.
// Every template is plain data in missions.json / citypacks.json; see DESIGN.md §6.
(function () {
const VP = window.VP, U = VP.U, I = VP.I, T = VP.TILE, Game = VP.Game, World = VP.World, M = VP.Missions;
const { TYPES, pack, gsize, arenaStuff, nearestFood } = M._;
const GT = World.GT, tr = (...a) => VP.t(...a);
const say = (k, col, dur, ...a) => Game.fx.say(tr(k, ...a), col || '#fff', dur || 2.2);

// ---------- shared helpers ----------
// most open walkable tile around a point (clearance in tiles, capped at `need`); pref(g) favours a ground type
function patch(W, cx, cy, rad, need, pref) {
  const tx0 = Math.floor(cx / T), ty0 = Math.floor(cy / T), g = W.grid; let best = null, bs = -1e9;
  for (let y = ty0 - rad; y <= ty0 + rad; y++) for (let x = tx0 - rad; x <= tx0 + rad; x++) {
    if (x < need + 2 || y < need + 2 || x >= W.W - need - 2 || y >= W.H - need - 2 || g[y * W.W + x] || (W.conn && W.conn[y * W.W + x] < 0)) continue;
    let c = 0;
    scan: for (; c < need; c++) for (let k = -c - 1; k <= c + 1; k++) if (g[(y - c - 1) * W.W + x + k] || g[(y + c + 1) * W.W + x + k] || g[(y + k) * W.W + x - c - 1] || g[(y + k) * W.W + x + c + 1]) break scan;
    const gr = W.gnd[y * W.W + x], pv = pref ? pref(gr, (x + 0.5) * T, (y + 0.5) * T) : 0, s = c * 100 + (pv === true ? 160 : +pv || 0) - Math.hypot(x - tx0, y - ty0) * 4 - (gr === GT.G_ROAD ? 80 : 0);
    if (s > bs) { bs = s; best = { x: (x + 0.5) * T, y: (y + 0.5) * T, c }; }
  }
  return best;
}
const reach = (G, x, y) => !G.field || G.W.distAt(G.field, x, y) >= 0;
// a free, reachable point near (x, y)
function freeNear(B, x, y, rmin, rmax) {
  const W = B.W;
  for (let i = 0; i < 40; i++) { const a = B.rng() * 6.283, d = rmin + B.rng() * (rmax - rmin), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!W.blocked(px, py, 16, 0) && reach(B.G, px, py)) return { x: px, y: py }; }
  return null;
}
const lotsOf = (B, types) => B.W.lots.filter(l => l.d === B.geo && types.includes(l.type));
// spots worth a photo in the home city: the named places of the district
const SPOT_ROLES = ['plaza1', 'house', 'plaza2', 'arena', 'plaza3', 'park', 'compB', 'compD'];
function photoSpots(B) {
  const W = B.W;
  if (W.real) return (W.places || []).concat(W.landmarks).map(l => ({ x: l.gx, y: l.gy, name: l.name }));
  return SPOT_ROLES.filter(r => W.roles[B.geo][r]).map(r => { const side = 'nsew'[Math.floor(B.rng() * 4)], p = W.front(W.roles[B.geo][r], side); return { x: p.x, y: p.y, name: tr('spot_' + r.replace(/\d|[A-D]$/g, '')) }; });
}
const near = (G, pt, r) => { const a = G.car || G.cats[G.active]; return U.d2(a.x, a.y, pt.x, pt.y) < r * r; };
const flash = (G, pt, txt) => { Game.fx.burst(pt.x, pt.y - 20, 14, ['#ffffff', '#ffd23f'], 220, 'star', 8, 0.5); Game.fx.part({ x: pt.x, y: pt.y, k: 'ring', col: '#ffffff', size: 14, life: 0.4, grow: 220 }); VP.Audio.sfx('paw', 0.05); if (txt) Game.fx.text(pt.x, pt.y - 60, txt, '#ffd23f', 16); G.flashT = 0.25; };
const startOf = B => B.W.real ? (B.W.tourStart || B.W.randWalk(B.rng)) : B.front('arena', 's');
// chain of far-apart street points starting at `from`
function route(B, from, n, dmin, dmax) {
  const out = []; let cur = from;
  for (let k = 0; k < n; k++) {
    let best = null, bs = -1;
    for (let i = 0; i < 30; i++) { const q = B.rw(), d = Math.hypot(q.x - cur.x, q.y - cur.y); if (!reach(B.G, q.x, q.y)) continue; const s = d >= dmin && d <= dmax ? 1e6 - Math.abs(d - (dmin + dmax) / 2) : -Math.abs(d - dmin); if (s > bs || !best) { bs = s; best = q; } }
    out.push(best || B.rw()); cur = out[out.length - 1];
  }
  return out;
}
const pathLen = (from, pts) => { let d = 0, c = from; for (const p of pts) { d += Math.hypot(p.x - c.x, p.y - c.y); c = p; } return d; };

// Rooftop course for parkour missions: crates to climb, a low awning, a gap to hop, a roof, a jump pad and a higher roof,
// laid out in a straight line on the longest clear stretch near `from` (see Game.addCourse). Returns null when the streets
// around are too tight; then the mission is a plain checkpoint run. Call before B.begin; `build()` after it.
function courseSite(B, from) {
  const W = B.W, cands = [from]; for (let i = 0; i < 26; i++) { const q = B.rw(); if (Math.hypot(q.x - from.x, q.y - from.y) < 900) cands.push(q); }
  let best = null;
  for (const o of cands) for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let n = 0; for (let d = 0; d <= 1010; d += 24) { const x = o.x + ux * d, y = o.y + uy * d; if (W.blocked(x, y, 47, 0) || (W.conn && W.conn[Math.floor(y / T) * W.W + Math.floor(x / T)] < 0)) break; n = d; }
    const sc = Math.min(n, 1000) - Math.hypot(o.x - from.x, o.y - from.y) * 0.25; if (n >= 670 && (!best || sc > best.sc)) best = { o, ux, uy, n, sc };
  }
  return best;
}
function buildCourse(B, site) {
  const G = B.G, { o, ux, uy } = site, full = site.n >= 1000, along = ux ? 'x' : 'y', LW = 44;
  const at = s => ({ x: o.x + ux * s, y: o.y + uy * s }), rect = (s0, len, h, extra) => Object.assign({ x: o.x + ux * (s0 + len / 2), y: o.y + uy * (s0 + len / 2), hw: ux ? len / 2 : LW, hh: ux ? LW : len / 2, h, along }, extra);
  const plats = []; let s = 70;
  [0.7, 1.4, 2.1].forEach((h, i) => { plats.push(rect(s, 44, h, { style: 'crate', col: ['#c98f4b', '#b87f3f', '#d9a35c'][i] })); s += 44; });
  const A = rect(s, 150, 2.1, { style: 'awning', solid: false, col: '#e01e37' }); plats.push(A); s += 150 + 80;
  const Bp = rect(s, 140, 2.1, { style: 'roof', solid: false, col: '#2a6bff' }); plats.push(Bp); s += 140;
  let Cp = null; const pads = [];
  if (full) { const padAt = at(s - 24); s += 170; Cp = rect(s, 160, 3.3, { style: 'roof', solid: false, col: '#1fa85a', col2: '#ffd23f' }); plats.push(Cp); s += 160; pads.push({ x: padAt.x, y: padAt.y, to: { x: Cp.x, y: Cp.y } }); }
  const pk = Game.addCourse(plats, pads), P = pk.plats;
  if (full) { pk.pads[0].plat = P[4]; pk.pads[0].to.plat = P[5]; }
  // nothing parked or driving through the course
  for (const k of G.cars) { const t = (k.x - o.x) * ux + (k.y - o.y) * uy, l = Math.abs((k.x - o.x) * uy - (k.y - o.y) * ux); if (t > -60 && t < s + 160 && l < 120 && k !== G.car) k.dead = true; }
  const on = pl => () => { const a = G.cats[G.active]; return !a.jump && a.plat === pl && U.d2(a.x, a.y, pl.x, pl.y) < 62 * 62; };
  const cp = (txt, pl) => B.step({ txt, at: () => pl, done: on(pl), exit() { G.mtimer += 3; G.stat.cash += 30; VP.Audio.sfx('step'); Game.fx.burst(pl.x, pl.y - 10, 8, ['#2de2e6', '#fff'], 160, 'star', 6, 0.4); } });
  B.goto(at(34), 'o_pkStart');
  cp('o_pkUp', P[3]); cp('o_pkGap', P[4]); if (full) cp('o_pkPad', P[5]);
  const end = at(s + 100); B.goto(end, 'o_pkDown');
  return { end, len: s + 100, full };
}

// ---------- reusable mini-games (home city and real cities) ----------
// Kite festival: kites drift down with the wind; catch n before the clock runs out
function kiteGame(B, c, n, o) {
  const G = B.G, W = B.W; o = o || {};
  let wind = B.rng() * 6.283, sp = 0;
  const spawn = () => {
    for (let i = 0; i < 20; i++) { const a = B.rng() * 6.283, d = 40 + B.rng() * (o.rad || 230), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d; if (W.blocked(x, y, 12, 0) || !reach(G, x, y)) continue; const it = Game.addItem('kite', x, y); it.z = 250 + B.rng() * 60; it.fl = (o.fall || 52) * (0.85 + B.rng() * 0.3); it.wx = Math.cos(wind) * 26; it.wy = Math.sin(wind) * 26; it.ttl = o.ttl || 6; it.col = Math.floor(B.rng() * 5); return it; }
    return null;
  };
  return B.step({
    txt: o.txt || 'o_kites', args: [n], cat: null,
    enter() { G.stat.kites = 0; for (let i = 0; i < 2; i++) spawn(); },
    tick(dt) { sp -= dt; wind += dt * 0.15; let air = 0; for (const it of G.items) if (it.k === 'kite') air++; if (air < (o.max || 3) && sp <= 0) { spawn(); sp = o.every || 1.4; } },
    at() { const a = G.cats[G.active]; let b = null, bd = 1e12; for (const it of G.items) if (it.k === 'kite') { const d = Math.hypot(it.x - a.x, it.y - a.y) + it.z * 1.2; if (d < bd) { bd = d; b = it; } } return b || c; },
    done: () => G.stat.kites >= n, prog: () => [Math.min(n, G.stat.kites), n],
  });
}
// Volleyball / keepie-uppie: be under the ball when it lands. 3 misses and the rally is over.
function ballGame(B, c, points, o) {
  const G = B.G, W = B.W; o = o || {};
  const cw = o.cw || 150, ch = o.ch || 105, S = { pts: 0, miss: 0, t: 0, T: 1, spot: null, src: { x: c.x, y: c.y - ch - 70 }, ball: null, rest: 1.2, tele: null };
  const serve = () => {
    const a = G.cats[G.active]; let p = null;
    for (let i = 0; i < 30 && !p; i++) { const x = c.x + (B.rng() * 2 - 1) * cw, y = c.y + (B.rng() * 2 - 1) * ch; if (!W.blocked(x, y, 14, 0) && reach(G, x, y) && Math.hypot(x - a.x, y - a.y) < 300) p = { x, y }; }
    S.spot = p || { x: a.x, y: a.y };
    S.T = Math.max(1.2, Math.hypot(S.spot.x - a.x, S.spot.y - a.y) / (118 * (o.speed || 1)) + 0.8 - S.pts * 0.012); S.t = 0;
    S.from = { x: S.ball.x, y: S.ball.y };
    G.teles.push(S.tele = { k: 'circle', x: S.spot.x, y: S.spot.y, r: 46, t: 0, dur: S.T, safe: true });
  };
  return B.step({
    txt: o.txt || 'o_volley', args: [points], cat: null, mini: true,
    enter() { G.mini = { k: 'ball', quiet: true }; S.ball = Game.addItem(o.item || 'ball', S.src.x, S.src.y); S.ball.arc = true; S.ball.nopick = true; S.ball.z = 30; },
    exit() { G.mini = null; if (S.ball) S.ball.dead = true; },
    tick(dt) {
      if (S.rest > 0) { S.rest -= dt; if (S.rest <= 0) serve(); return; }
      S.t += dt; const f = Math.min(1, S.t / S.T);
      S.ball.x = U.lerp(S.from.x, S.spot.x, f); S.ball.y = U.lerp(S.from.y, S.spot.y, f); S.ball.z = 20 + Math.sin(f * Math.PI) * 190;
      if (f < 1) return;
      let hit = null; for (const k of G.cats) if (!k.down && U.d2(k.x, k.y, S.spot.x, S.spot.y) < 54 * 54) hit = k;
      if (hit) { S.pts++; G.stat.pts = S.pts; G.stat.cash += 12; hit.hopT = 0.45; VP.Audio.sfx('hit', 0.05); Game.fx.text(S.spot.x, S.spot.y - 50, tr('v_hit'), '#7CFF6B', 17); Game.fx.burst(S.spot.x, S.spot.y - 20, 8, ['#fff', '#ffd23f'], 170, 'star', 6, 0.4); S.rest = 0.55; }
      else { S.miss++; VP.Audio.sfx('fail', 0.3); Game.fx.text(S.spot.x, S.spot.y - 50, tr('v_miss', 3 - S.miss), '#ff6b6b', 16); Game.fx.poof(S.spot.x, S.spot.y - 6, 8, '#ffe9b8'); S.rest = 1.1; S.ball.x = S.src.x; S.ball.y = S.src.y; }
    },
    at: () => S.spot || c, done: () => S.pts >= points, fail: () => (S.miss >= 3 ? 'volley' : null), prog: () => [S.pts, points],
  });
}
// Fishing: stand on the spot, wait for the bite ("!") and tap ATTACK. Tapping early scares the fish.
const FISH = [['🐟', 'fi_sardine', 1, 20], ['🐟', 'fi_sardine', 1, 20], ['🐠', 'fi_tuna', 1, 45], ['🦐', 'fi_shrimp', 1, 30], ['🥾', 'fi_boot', 0, 5]];
function fishSpot(B, from) {
  const W = B.W, G = B.G, TT = World.TT; let best = null, bd = 1e18;
  for (let y = 3; y < W.H - 3; y++) for (let x = 3; x < W.W - 3; x++) {
    const i = y * W.W + x; if (W.grid[i] !== TT.FLOOR) continue;
    let wx = 0, wy = 0; if (W.grid[i + 1] === TT.WATER) wx = 1; else if (W.grid[i - 1] === TT.WATER) wx = -1; else if (W.grid[i + W.W] === TT.WATER) wy = 1; else if (W.grid[i - W.W] === TT.WATER) wy = -1; else continue;
    const px = (x + 0.5) * T, py = (y + 0.5) * T; if (!W.real && World.distAt(W, px, py) !== B.geo) continue; if (!reach(G, px, py)) continue;
    const d = U.d2(px, py, from.x, from.y) + (W.gnd[i] === GT.G_WOOD ? 0 : 4e5); if (d < bd) { bd = d; best = { x: px, y: py, wx, wy }; }
  }
  return best;
}
function fishGame(B, spot, n) {
  const G = B.G; let prev = false, w = 2, bite = 0, caught = 0, bob = null;
  return B.step({
    txt: 'o_fish', args: [n], cat: null, tap: true, mini: true,
    enter() { bob = Game.addItem('bobber', spot.x + spot.wx * 62, spot.y + spot.wy * 62); bob.nopick = true; bob.arc = true; },
    exit() { G.mini = null; if (bob) bob.dead = true; },
    ready: () => bite > 0,
    tick(dt) {
      const a = G.cats[G.active], on = !G.car && U.d2(a.x, a.y, spot.x, spot.y) < 62 * 62, edge = I.attack && !prev; prev = I.attack;
      G.mini = on ? { k: 'fish', quiet: true } : null; bob.z = bite > 0 ? -6 : Math.sin(G.real * 3) * 2;
      if (!on) { bite = 0; w = Math.max(w, 1); return; }
      if (bite > 0) {
        bite -= dt;
        if (edge) { const f = FISH[Math.floor(Math.random() * FISH.length)]; bite = 0; w = U.rand(1.1, 2.6); caught += f[2]; G.stat.cash += f[3]; if (f[2]) { Game.fx.part({ x: bob.x, y: bob.y - 10, k: 'fly', icon: 'sushi', tx: a, life: 0.35, size: 12 }); const mo = G.cats[2]; if (!mo.down) mo.belly = Math.min(100, mo.belly + 12); } VP.Audio.sfx(f[2] ? 'paw' : 'tink', 0.05); Game.fx.text(a.x, a.y - 56, f[0] + ' ' + tr(f[1]), f[2] ? '#7CFF6B' : '#c0c7d1', 16); Game.fx.burst(bob.x, bob.y, 8, '#bfe9ff', 150, 'dot', 5, 0.4); }
        else if (bite <= 0) { w = U.rand(1.2, 2.6); Game.fx.text(a.x, a.y - 56, tr('fi_gone'), '#ffb347', 14); }
      } else {
        if (edge) { w = U.rand(1.6, 3); Game.fx.text(a.x, a.y - 56, tr('fi_early'), '#ffb347', 14); }
        w -= dt; if (w <= 0) { bite = 1.0; VP.Audio.sfx('tick', 0.02); Game.fx.part({ x: a.x, y: a.y - 70, k: 'txt', txt: '❗', col: '#ffd23f', size: 30, life: 0.9, vy: -10 }); Game.fx.part({ x: bob.x, y: bob.y, k: 'ring', col: '#ffffff', size: 8, life: 0.6, grow: 90 }); }
      }
    },
    at: () => spot, done: () => caught >= n, prog: () => [caught, n],
  });
}
// The VIP (elder cat, kitten…) follows the leader; dogs go for it like they go for the little house in "defend".
function addVip(B, pt, skin, hp) {
  const G = B.G, f = Game.addFriend(pt.x + 28, pt.y + 26, skin || 'elder'); f.spd = 128; f.vip = true;
  const h = { kind: 'vipHp', k: 'vip', x: f.x, y: f.y, hp: hp || 260, max: hp || 260, done: false, flash: 0, failWhy: 'vip', friend: f }; G.house = h; G.houseField = null;
  (G.ticks = G.ticks || []).push(() => { h.x = f.x; h.y = f.y; return null; });
  return f;
}
const gotoWith = (B, f, pt, txt, o) => B.step(Object.assign({ txt, at: () => pt, done: () => near(B.G, pt, 85) && U.d2(f.x, f.y, pt.x, pt.y) < 150 * 150 }, o));

// ---------- home-city templates ----------
Object.assign(TYPES, {
  // walk an elder cat (or any VIP) across the district; ambushes on the way
  escort: {
    setup(B) {
      const p = B.p, G = B.G, a = B.front(p.from || 'plaza3', 'n'), mid = B.front('arena', B.rng() < 0.5 ? 'e' : 'w'), b = B.front(p.to || 'plaza1', 's');
      B.begin(a, { traffic: 6 }); G.noHeat = true; G.noPolice = true;
      const f = addVip(B, a, p.vip || 'elder', 220 + B.lv * 6);
      const stops = (p.stops || 2) > 1 ? [mid, b] : [b];
      stops.forEach((pt, i) => {
        gotoWith(B, f, pt, 'o_escortVip', { args: [i + 1, stops.length] });
        if (i < stops.length - 1 || p.last) B.wave(pack(B, Math.min(8, 3 + Math.round(B.lv / 12) + i)), { raid: true, txt: 'o_protect', args: [i + 1, stops.length] });
      });
      if (p.time) G.mtimer = p.time;
    },
  },
  // Morticia alone, past sleeping dogs, to grab the treat bag and bring it back
  stealth: {
    setup(B) {
      const p = B.p, G = B.G, A = B.R('arena');
      // start a good walk away from the sleeping pack
      let start = null, bs = -1e9; for (const r of ['plaza1', 'plaza2', 'plaza3', 'park', 'house', 'compB', 'compD']) { const lot = B.W.roles[B.geo][r]; if (!lot) continue; for (const side of ['s', 'n']) { const q = B.W.front(lot, side), d = Math.hypot(q.x - A.cx, q.y - A.cy), s = (r === p.from ? 500 : 0) - Math.abs(d - 760); if (d > 520 && s > bs) { bs = s; start = q; } } }
      start = start || B.corner(0, 0, 'w');
      B.begin(start, { traffic: 4 }); G.noHeat = true; G.noPolice = true;
      const c = { x: A.cx, y: A.cy }, n = p.dogs || 6, wake = p.wake || 60, nb = p.bags || (n > 8 ? 3 : 2), a0 = B.rng() * 6.283;
      Game.addItem('bag', c.x, c.y); for (let i = 1; i < nb; i++) { const a = a0 + i * 2.6, q = { x: c.x + Math.cos(a) * 205, y: c.y + Math.sin(a) * 205 }; if (!B.W.blocked(q.x, q.y, 14, 0)) Game.addItem('bag', q.x, q.y); }
      const bags = G.items.filter(it => it.k === 'bag').length;
      const ring = (k, R, off, types) => { for (let i = 0; i < k; i++) { const a = off + i / k * 6.283, x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R; if (!B.W.blocked(x, y, 16, 0)) Game.addDog(types[i % types.length], x, y, { sleep: true, wake, tag: 'z' }); } };
      ring(Math.min(n, 5), 132, B.rng() * 6, ['mutt', 'cop', 'mutt', 'heavy', 'mutt']);
      if (n > 5) ring(n - 5, 262, B.rng() * 6, ['chi', 'mutt', 'cop', 'chi', 'mutt', 'heavy']);
      Game.switchTo(2, true); G.solo = 2; if (p.time) G.mtimer = p.time;
      B.step({ txt: 'o_sneak', args: [bags], cat: 'morticia', sneak: true, mode: 1, at: () => { const a = G.cats[G.active]; let b = null, bd = 1e12; for (const it of G.items) if (it.k === 'bag') { const d = U.d2(it.x, it.y, a.x, a.y); if (d < bd) { bd = d; b = it; } } return b || c; }, done: () => (G.flags.bag || 0) >= bags, prog: () => [G.flags.bag || 0, bags] });
      B.step({ txt: 'o_sneakBack', cat: 'morticia', sneak: true, mode: 1, at: () => start, done: () => near(G, start, 85), exit() { G.solo = null; if (!G.stat.woke) { G.stat.cash += 120; say('sn_ghost', '#7CFF6B', 2.4); } } });
    },
  },
  // find the photo spots of the district
  photo: {
    setup(B) {
      const p = B.p, G = B.G, start = startOf(B);
      B.begin(start, {});
      const all = B.rng.shuffle(photoSpots(B)).slice(0, p.n || 4);
      for (let i = 0; i < (p.groups || 0); i++) B.dogs(B.farPoint(320), pack(B, gsize(B) - 1), { aggro: 180 });
      all.forEach((s, i) => B.step({ txt: 'o_photo', args: [i + 1, all.length, s.name], at: () => s, done: () => near(G, s, 80) && !G.car, exit() { flash(G, s, '📸 ' + s.name); G.stat.cash += 35; } }));
      if (p.time) G.mtimer = p.time;
    },
  },
  // pick up here, drop there, again and again; the clock gets a little longer on every drop
  chain: {
    setup(B) {
      const p = B.p, G = B.G, start = startOf(B);
      B.begin(start, {}); G.noHeat = true;
      let car = null; if (p.car) { car = Game.addCar(p.car === 2 ? 'pickup' : B.getaway(), start.x, start.y, 0); Game.enterCar(car); }
      const pts = route(B, start, p.stops || 4, p.car ? 700 : 380, p.car ? 1500 : 800);
      G.mtimer = p.time || Math.round(pathLen(start, pts) / (p.car ? 170 : 105) + 25);
      pts.forEach((pt, i) => B.step({
        txt: i % 2 ? 'o_dropoff' : 'o_pickup', args: [Math.floor(i / 2) + 1, Math.ceil(pts.length / 2)], car: !!p.car, at: () => pt, done: () => near(G, pt, p.car ? 105 : 80) && (!p.car || !!G.car),
        exit() { G.mtimer += p.bonus || 4; G.stat.cash += i % 2 ? 60 : 10; VP.Audio.sfx('cash', 0.05); Game.fx.text(pt.x, pt.y - 50, i % 2 ? '📦 ✔' : '📦', '#ffd23f', 18); if (p.thieves && i % 2 === 0) { const q = Game.spawnPoint(380, 620) || B.rw(); for (const t of pack(B, 2)) { const e = Game.addDog(t === 'heavy' ? 'mutt' : t, q.x, q.y, {}); e.hunt = true; } } },
        fail: () => (car && !G.car && car.dead ? 'car' : null),
      }));
    },
  },
  // one very tough dog and the friends it calls
  duel: {
    setup(B) {
      const p = B.p, G = B.G, A = B.R('arena');
      B.begin({ x: A.cx, y: A.cy + 150 }, { traffic: 0 }); arenaStuff(B); G.noPolice = true; G.noHeat = true;
      const e = Game.addDog(p.elite || 'heavy', A.cx, A.cy - 130, { hpMul: p.hp || 6, big: 1.4 }); e.hunt = true; e.stun = 2; e.label = B.m.name;
      let called = 0;
      B.step({ txt: 'o_duel', fight: true, at: () => e, done: () => e.dead, prog: () => [Math.round((1 - Math.max(0, e.hp) / e.max) * 100), 100],
        tick() { const f = e.hp / e.max; if (!e.dead && called < 2 && f < (called ? 0.33 : 0.66)) { called++; say('du_call', '#ffd23f', 2); for (const t of pack(B, 2 + called)) { const q = Game.spawnPoint(300, 520) || { x: A.cx, y: A.cy }; const d = Game.addDog(t === 'heavy' ? 'cop' : t, q.x, q.y, {}); d.hunt = true; } } } });
    },
  },
  // on foot only: checkpoints against the clock, a coffee on each one
  parkour: {
    setup(B) {
      const p = B.p, G = B.G, start = startOf(B), site = p.flat ? null : courseSite(B, start);
      B.begin(start, { traffic: site ? 0 : 6 }); G.noHeat = true; G.noPolice = true; G.noCars = true;
      // rooftop stretch first (crates, gap, jump pad), then street checkpoints
      G.mtimer = 0; const crs = site ? buildCourse(B, site) : null, from = crs ? crs.end : start;
      const pts = route(B, from, crs ? Math.max(2, (p.cps || 6) - 3) : p.cps || 6, 300, 620);
      G.mtimer = (p.time || Math.round(pathLen(from, pts) / 120 + 14)) + (crs ? Math.round((Math.hypot(site.o.x - start.x, site.o.y - start.y) + crs.len) / 95 + 12) : 0);
      pts.forEach((pt, i) => { if (i % 2 === 0) Game.addItem('coffee', pt.x + 20, pt.y); B.step({ txt: 'o_parkour', args: [i + 1, pts.length], at: () => pt, done: () => near(G, pt, 72), exit() { G.mtimer += p.bonus || 3; G.stat.cash += 25; G.cats[G.active].hopT = 0.5; VP.Audio.sfx('step'); Game.fx.burst(pt.x, pt.y - 10, 8, ['#2de2e6', '#fff'], 160, 'star', 6, 0.4); } }); });
    },
  },
  kites: {
    setup(B) {
      const p = B.p, G = B.G, W = B.W, lot = lotsOf(B, ['park', 'beach', 'plaza'])[p.site || 0] || B.R('arena');
      const c = patch(W, lot.cx, lot.cy, 5, 3, g => g === GT.G_SAND || g === GT.G_GRASS) || { x: lot.cx, y: lot.cy };
      B.begin(freeNear(B, c.x, c.y, 30, 90) || B.front(lot, 's'), { traffic: 5 }); G.noHeat = true; G.noPolice = true;
      G.mtimer = p.time || 90;
      kiteGame(B, c, p.n || 8, { max: p.max || 3, fall: p.fall, rad: 240 });
    },
  },
  volley: {
    setup(B) {
      const p = B.p, G = B.G, W = B.W, lot = lotsOf(B, ['beach', 'park', 'plaza'])[p.site || 0] || B.R('arena');
      const c = patch(W, lot.cx, lot.cy, 5, 3, g => g === GT.G_SAND) || { x: lot.cx, y: lot.cy };
      B.begin(freeNear(B, c.x, c.y, 10, 60) || c, { traffic: 4 }); G.noHeat = true; G.noPolice = true;
      for (let i = 0; i < 2; i++) { const q = freeNear(B, c.x + (i ? 70 : -70), c.y - 175, 0, 50); if (q) { const f = Game.addFriend(q.x, q.y, i ? 'f3' : 'f1'); f.stay = true; } }
      ballGame(B, c, p.points || 8, { speed: p.speed || 1 });
    },
  },
  fish: {
    setup(B) {
      const p = B.p, G = B.G, start = startOf(B);
      B.begin(start, {}); G.noHeat = true; G.noPolice = true;
      const spot = fishSpot(B, start) || Object.assign({ wx: 0, wy: 1 }, start);
      for (let i = 0; i < (p.groups || 0); i++) B.dogs(B.farPoint(300), pack(B, 2), { aggro: 170 });
      B.goto(spot, 'o_fishGo'); G.mtimer = p.time || 120;
      fishGame(B, spot, p.n || 5);
    },
  },
  // ram the moving treat truck until it stops, board it and drive it home with the police behind
  heist: {
    setup(B) {
      const p = B.p, G = B.G, sp = B.ix(1, B.rows - 1, 60, 48);
      B.begin(sp);
      const car = Game.addCar(B.getaway(), sp.x, sp.y, 0); car.hp = car.max = 280; Game.enterCar(car); G.noHeat = true; G.mtimer = p.time || 170;
      const cw = B.cols, rh = B.rows, route0 = [[1, 1], [cw - 1, 1], [cw - 1, rh - 1], [1, rh - 1]].map(q => B.ix(q[0], q[1]));
      let tc = null; const hl = B.R('house'), dest = { x: hl.cx + 60, y: (hl.ty + 9.6) * T };
      B.step({ txt: 'o_heistRam', car: true, ram: true, enter() { tc = Game.addCar('truck', route0[2].x, route0[2].y, 0, { ai: 'target', route: route0, wi: 3, capture: true, drop: p.drop || 0 }); tc.hp = tc.max = tc.max * (3.2 + B.lv * 0.03); tc.top *= 0.8; },
        at: () => tc, done: () => !!tc && tc.captured, prog: () => (tc ? [Math.round((1 - Math.max(0, tc.hp) / tc.max) * 100), 100] : [0, 100]), fail: () => (!G.car && car.dead ? 'car' : null) });
      B.step({ txt: 'o_enterTruck', act: 'ctx', at: () => tc, done: () => G.car === tc, enter() { G.mtimer = null; }, fail: () => (tc.dead ? 'truck' : null) });
      B.step({ txt: 'o_driveTruck', car: true, enter() { B.wantedOn(p.wanted || 2); }, at: () => dest, done: () => G.car === tc && U.d2(tc.x, tc.y, dest.x, dest.y) < 110 * 110, fail: () => (tc.dead ? 'truck' : null) });
      B.step({ txt: 'o_done', enter() { G.minWanted = 0; G.heat = 0; G.noPolice = true; }, done: () => true, at: () => null });
    },
  },
  // find the kittens (hidden, guarded, caged), survive the ambush, walk everyone home
  kittens: {
    setup(B) {
      const p = B.p, G = B.G, home = B.front('house', 's');
      B.begin(home, {}); G.noHeat = true;
      const kinds = p.kinds || ['free', 'guard', 'cage'], n = kinds.length, spots = route(B, home, n, 380, 760);
      kinds.forEach((kind, i) => {
        const s = spots[i], args = [i + 1, n];
        if (kind === 'cage') {
          const q = freeNear(B, s.x, s.y, 0, 40) || s, cage = Game.addProp({ k: 'cage', x: q.x, y: q.y, friend: 'f' + (i % 4), lock: 'bite' });
          B.dogs(s, pack(B, 2));
          B.step({ txt: 'o_kitCage', args, cat: 'mimosa', act: 'attack', at: () => ({ x: cage.x, y: cage.y + 30 }), done: () => cage.done });
        } else {
          const f = Game.addFriend(s.x, s.y, 'f' + (i % 4)); f.stay = true;
          const guards = kind === 'guard' ? B.dogs(s, pack(B, gsize(B))) : [];
          B.step({ txt: 'o_kitFind', args, at: () => s, done: () => near(G, s, 80) });
          if (guards.length) B.step({ txt: 'o_clear', fight: true, at: () => guards.find(e => !e.dead) || null, done: () => guards.every(e => e.dead), prog: () => [guards.filter(e => e.dead).length, guards.length] });
          B.step({ txt: 'o_done', at: () => null, done: () => true, enter() { f.stay = false; G.stat.freed++; VP.Audio.sfx('revive'); say('freed', '#7CFF6B', 1.8); } });
        }
      });
      B.wave(pack(B, Math.min(8, 3 + Math.round(B.lv / 10))), { txt: 'o_kitAmbush' });
      B.goto(home, 'o_escort');
    },
  },
  // first play: move, attack, switch, revive (skippable; lives are not spent here)
  tutorial: {
    setup(B) {
      const G = B.G, W = B.W, start = B.front('arena', 's');
      B.begin(start, { traffic: 0, coffee: 4 }); G.noHeat = true; G.noPolice = true; G.noCars = true; G.tutorial = true;
      for (const e of G.dogs) e.dead = true;
      const a = { x: start.x + 190, y: start.y };
      B.goto(a, 'tu_move', { hint: 'move' });
      // a dizzy, harmless mutt to practise on (any cat can do it)
      let dummy = null;
      B.step({ txt: 'tu_attack', hint: 'attack', fight: true, enter() { const q = freeNear(B, a.x + 150, a.y, 0, 60) || { x: a.x + 120, y: a.y }; dummy = Game.addDog('mutt', q.x, q.y, { guard: true, tag: 't' }); dummy.hp = dummy.max = 30; dummy.stun = 1e6; dummy.carry = null; }, at: () => (dummy && !dummy.dead ? dummy : null), done: () => !!dummy && dummy.dead });
      B.step({ txt: 'tu_switch', hint: 'switch', at: () => null, seen: {}, enter() { this.seen = { [G.active]: 1 }; }, tick() { this.seen[G.active] = 1; }, done() { return Object.keys(this.seen).length >= 2; } });
      B.step({ txt: 'tu_revive', hint: 'revive', at: () => G.cats.find(c => c.down) || null,
        enter() { const c = G.cats[G.active === 2 ? 1 : 2]; c.hp = 0; c.down = true; G.tutLives = VP.S.lives; VP.S.lives = Math.max(1, VP.S.lives) + 1; Game.fx.poof(c.x, c.y - 14, 8); VP.Audio.sfx('down'); },
        exit() { VP.S.lives = G.tutLives; VP.persist(); }, done: () => !G.cats.some(c => c.down) });
      B.step({ txt: 'tu_done', t: 0, at: () => null, tick(dt) { this.t += dt; }, done() { return this.t > 1.6; } });
    },
  },
});

// ---------- Volta ao Mundo: missions on real maps ----------
// Kinds that are allowed on maps tagged "comunidade": only positive, no dogs, no police, no crime.
const COMU_SAFE = ['deliver', 'treats', 'rescue', 'kites', 'kiterun', 'paws', 'photo', 'football', 'parkour', 'chain', 'groceries', 'fish', 'volley', 'feast'];
M.COMU_SAFE = COMU_SAFE;
TYPES.tour = {
  setup(B) {
    const p = B.p, G = B.G, W = B.W, C = W.real, comu = (C.tags || []).includes('comunidade'), agro = C.id === 'rioverde';
    const L = (W.places || []).concat(W.landmarks);
    const named = name => { const l = L.find(x => x.name === name); return l ? { x: l.gx, y: l.gy, name: l.name } : null; };
    const pick = i => { if (L.length) { const l = L[(i * 7 + B.m.n) % L.length]; return { x: l.gx, y: l.gy, name: l.name }; } const q = W.randWalk(B.rng); return { x: q.x, y: q.y, name: '' }; };
    const start = W.tourStart;
    const far = (from, i, dmin) => { let best = null, bd = -1; for (let k = 0; k < Math.max(1, Math.min(10, L.length)); k++) { const c = pick(i + k), d = U.d2(c.x, c.y, from.x, from.y); if (d > bd && d < 9000 * 9000) { bd = d; best = c; } } if (!best || bd < (dmin || 400) * (dmin || 400)) { const r = route(B, from, 1, dmin || 500, 1400)[0]; best = { x: r.x, y: r.y, name: best && bd > 200 * 200 ? best.name : tr('tp_spot') }; } return best; };
    // waypoints: the names listed by the pack first, then generated ones
    const want = (p.at || []).map(named).filter(Boolean);
    const way = (i, from) => want[i] || far(from, i * 3 + 1 + (p.seed || 0), 450);
    const kind = comu && !COMU_SAFE.includes(p.kind) ? 'photo' : p.kind;
    // car checkpoints must be drivable: move them onto the nearest real road (wide enough for any vehicle)
    const onRoad = pt => { let b = null, bd = 520 * 520; for (const rd of W.roads) if (rd.w >= 6) for (const q of rd.pts) { const d = U.d2(q.x, q.y, pt.x, pt.y); if (d < bd && !W.blocked(q.x, q.y, 44, 3)) { bd = d; b = q; } } return b ? { x: b.x, y: b.y, name: pt.name } : pt; };
    B.begin(start, { traffic: comu ? 0 : 8, coffee: 8, parked: comu ? 0 : 10 });
    G.tourM = true;
    if (comu) { G.noPolice = true; G.noHeat = true; for (const e of G.dogs) e.dead = true; }
    const vehicle = agro || p.car === 2 ? 'pickup' : B.getaway();
    if (kind === 'race') {
      const car = Game.addCar(vehicle, start.x, start.y, 0); car.hp = car.max = 260; Game.enterCar(car); G.noHeat = true;
      let cur = start; const cps = []; for (let k = 0; k < (p.n || 5); k++) { const c = onRoad(way(k, cur)); cps.push(c); cur = c; }
      G.mtimer = Math.round(pathLen(start, cps) / 24 / (vehicle === 'pickup' ? 5 : 6) + 50);
      cps.forEach((pt, k) => B.step({ txt: 'o_tourCp', args: [k + 1, cps.length, pt.name], car: true, at: () => pt, done: () => !!G.car && U.d2(G.car.x, G.car.y, pt.x, pt.y) < 130 * 130 }));
    } else if (kind === 'deliver') {
      const dest = way(0, start); G.mtimer = Math.round(Math.hypot(dest.x - start.x, dest.y - start.y) / 24 / 3.2 + 50);
      if (!comu) B.dogs({ x: dest.x, y: dest.y }, pack(B, gsize(B)));
      B.goto(dest, comu ? 'o_tourCarry' : 'o_tourDeliver', { args: [dest.name] });
    } else if (kind === 'groceries') { // walk the elder cat home with her shopping bags (no enemies)
      const dest = way(0, start), f = Game.addFriend(start.x + 28, start.y + 26, 'elder'); f.spd = 135;
      gotoWith(B, f, dest, 'o_groceries', { args: [dest.name], exit() { G.stat.cash += 80; say('gr_thanks', '#7CFF6B', 2.6); } });
    } else if (kind === 'brawl') {
      const spot = way(0, start); B.goto(spot, 'o_tourGo', { args: [spot.name] }); G.noPolice = true; G.noHeat = true;
      for (let i = 0; i < 3; i++) { B.wait(2, 'o_waveIn', [i + 1, 3]); B.wave(pack(B, 4 + i * 2), { args: [i + 1, 3] }); }
    } else if (kind === 'feast' || kind === 'treats') {
      for (let i = 0; i < 26; i++) { const q = W.randWalk(B.rng); if (U.d2(q.x, q.y, start.x, start.y) < 1500 * 1500 || i < 8) Game.addItem(B.rng.pick(['treat', 'donut', 'sushi', 'hotdog']), q.x, q.y); }
      for (let i = 0; i < 4; i++) { const q = Game.nearFree(start.x, start.y, 120 + i * 60, 0); if (q) Game.addProp({ k: 'stand', x: q.x, y: q.y, food: B.rng.pick(['sushi', 'hotdog', 'donut']), free: true }); }
      G.mtimer = 120; G.restock = 9;
      B.step({ txt: comu ? 'o_tourTreats' : 'o_eat', args: [p.n || 22], cat: 'morticia', act: 'attack', at: () => nearestFood(G), done: () => G.stat.eaten >= (p.n || 22), prog: () => [Math.min(p.n || 22, G.stat.eaten), p.n || 22] });
    } else if (kind === 'escape') {
      B.wantedOn(2); const dest = way(0, start);
      B.step({ txt: 'o_survive', t: 0, fight: true, roam: true, tick(dt) { this.t += dt; }, done() { return this.t >= 35; }, prog() { return [Math.floor(this.t), 35]; }, at: () => null });
      B.goto(dest, 'o_tourGo', { args: [dest.name] });
      B.step({ txt: 'o_done', enter() { G.minWanted = 0; G.heat = 0; G.noPolice = true; }, done: () => true, at: () => null });
    } else if (kind === 'rescue') { // kitten stuck up high: climb, then bring it home
      let top = want[0] || null, th = -1e9;
      if (!top) for (let k = 0; k < 40; k++) { const q = k < L.length ? { x: L[k].gx, y: L[k].gy, name: L[k].name } : Object.assign({ name: tr('tp_roof') }, W.randWalk(B.rng)); const h = W.hpx ? W.hpx(q.x, q.y) : 0, d = Math.hypot(q.x - start.x, q.y - start.y); if (d > 350 && d < 2600 && reach(G, q.x, q.y) && h + d * 1e-4 > th) { th = h + d * 1e-4; top = q; } }
      top = top || way(0, start);
      const kit = Game.addFriend(top.x, top.y, 'f1'); kit.stay = true;
      B.goto(top, 'o_tourKitten', { args: [top.name] });
      B.step({ txt: 'o_done', enter() { kit.stay = false; G.stat.freed++; VP.Audio.sfx('revive'); say('freed', '#7CFF6B'); }, done: () => true, at: () => null });
      B.goto(start, 'o_escort');
    } else if (kind === 'photo') {
      let cur = start; const n = p.n || 4, spots = []; for (let k = 0; k < n; k++) { const c = way(k, cur); if (spots.some(s => U.d2(s.x, s.y, c.x, c.y) < 150 * 150)) { const r = route(B, cur, 1, 400, 900)[0]; c.x = r.x; c.y = r.y; if (!want[k]) c.name = tr('tp_view'); } spots.push(c); cur = c; }
      spots.forEach((s, i) => B.step({ txt: 'o_photo', args: [i + 1, spots.length, s.name], at: () => s, done: () => near(G, s, 85) && !G.car, exit() { flash(G, s, '📸 ' + s.name); G.stat.cash += 35; } }));
    } else if (kind === 'chain') {
      let cur = start; const pts = []; for (let k = 0; k < (p.n || 4); k++) { let c = want[k] || Object.assign({ name: '' }, route(B, cur, 1, 400, 900)[0]); if (p.car) c = onRoad(c); pts.push(c); cur = c; }
      let car = null; if (p.car) { car = Game.addCar(vehicle, start.x, start.y, 0); Game.enterCar(car); G.noHeat = true; }
      G.mtimer = Math.round(pathLen(start, pts) / (p.car ? (vehicle === 'pickup' ? 115 : 150) : 95) + 30);
      pts.forEach((pt, i) => B.step({ txt: i % 2 ? 'o_dropoff' : 'o_pickup', args: [Math.floor(i / 2) + 1, Math.ceil(pts.length / 2)], car: !!p.car, at: () => pt, done: () => near(G, pt, p.car ? 120 : 85) && (!p.car || !!G.car), exit() { G.mtimer += 5; G.stat.cash += i % 2 ? 60 : 10; VP.Audio.sfx('cash', 0.05); Game.fx.text(pt.x, pt.y - 50, i % 2 ? '📦 ✔' : '📦', '#ffd23f', 18); } }));
      void car;
    } else if (kind === 'parkour') { // comunidade: up the stairways, always climbing when the map has hills
      G.noCars = true; G.mtimer = 0; const site = courseSite(B, start), crs = site ? buildCourse(B, site) : null;
      let cur = crs ? crs.end : start; const pts = [], from = cur;
      for (let k = 0; k < (crs ? Math.max(2, (p.n || 5) - 2) : p.n || 5); k++) { let best = null, bs = -1e9; for (let i = 0; i < 24; i++) { const q = W.randWalk(B.rng), d = Math.hypot(q.x - cur.x, q.y - cur.y); if (d < 260 || d > 700) continue; const s = (W.hpx ? W.hpx(q.x, q.y) - W.hpx(cur.x, cur.y) : 0) * 12 - Math.abs(d - 450) * 0.02; if (s > bs) { bs = s; best = q; } } best = best || route(B, cur, 1, 260, 700)[0]; pts.push(best); cur = best; }
      G.mtimer = Math.round(pathLen(from, pts) / 85 + 25) + (crs ? Math.round((Math.hypot(site.o.x - start.x, site.o.y - start.y) + crs.len) / 85 + 14) : 0);
      pts.forEach((pt, i) => B.step({ txt: 'o_parkour', args: [i + 1, pts.length], at: () => pt, done: () => near(G, pt, 75), exit() { G.mtimer += 4; G.stat.cash += 25; G.cats[G.active].hopT = 0.5; VP.Audio.sfx('step'); } }));
    } else if (kind === 'paws') { // golden coins along the footways (stairways and alleys)
      const n = p.n || 12, feet = []; for (const i of W.walkList) if (W.gnd[i] === GT.G_WALK) feet.push(i);
      const src = feet.length > 40 ? feet : W.walkList; let placed = 0;
      for (let k = 0; k < 400 && placed < n + 6; k++) { const i = src[Math.floor(B.rng() * src.length)], x = (i % W.W + 0.5) * T, y = (Math.floor(i / W.W) + 0.5) * T, d = Math.hypot(x - start.x, y - start.y); if (d > 150 && d < 1500 && reach(G, x, y)) { Game.addItem('gcoin', x, y); placed++; } }
      G.mtimer = p.time || 150;
      B.step({ txt: 'o_paws', args: [n], at: () => { const a = G.cats[G.active]; let b = null, bd = 1e12; for (const it of G.items) if (it.k === 'gcoin') { const d = U.d2(it.x, it.y, a.x, a.y); if (d < bd) { bd = d; b = it; } } return b; }, done: () => G.stat.coins >= Math.min(n, placed), prog: () => [G.stat.coins, Math.min(n, placed)] });
    } else if (kind === 'kites') {
      const c = patch(W, start.x, start.y, 9, 3, g => g === GT.G_SAND || g === GT.G_GRASS) || start;
      G.mtimer = p.time || 100; B.goto(c, 'o_tourGo', { args: [tr('tp_kites')] });
      kiteGame(B, c, p.n || 8, { rad: 250, txt: comu ? 'o_kiteContest' : 'o_kites' });
    } else if (kind === 'football' || kind === 'volley') {
      const sandy = kind === 'volley' || (!comu && (C.tags || []).includes('beach')); // beach maps play on the sand
      const c = (kind === 'football' && W.pitch) || patch(W, start.x, start.y, sandy ? 60 : 10, 3, g => (sandy ? (g === GT.G_SAND ? 900 : 0) : g === GT.G_LOT || g === GT.G_GRASS)) || start;
      B.goto(c, 'o_tourGo', { args: [tr(kind === 'volley' ? 'tp_court' : 'tp_pitch')] });
      for (let i = 0; i < 2; i++) { const q = freeNear(B, c.x + (i ? 70 : -70), c.y - 150, 0, 60); if (q) { const f = Game.addFriend(q.x, q.y, i ? 'f3' : 'f1'); f.stay = true; } }
      ballGame(B, c, p.n || 8, { txt: kind === 'volley' ? 'o_volley' : 'o_football' });
    } else if (kind === 'fish') {
      const spot = fishSpot(B, start);
      if (spot) { B.goto(spot, 'o_fishGo'); G.mtimer = p.time || 150; fishGame(B, spot, p.n || 5); }
      else { const c = way(0, start); B.goto(c, 'o_tourGo', { args: [c.name] }); }
    } else { // 'kiterun': on-foot checkpoints
      let cur = start; const cps = []; for (let k = 0; k < 4; k++) { const c = way(k, cur); cps.push(c); cur = c; }
      G.mtimer = Math.round(pathLen(start, cps) / 24 / 3 + 45);
      cps.forEach((pt, k) => B.step({ txt: 'o_tourKite', args: [k + 1, cps.length, pt.name], at: () => pt, done: () => near(G, pt, 90) }));
    }
  },
};
M.helpers = { patch, freeNear, route, kiteGame, ballGame, fishGame, fishSpot, courseSite, buildCourse };
})();
