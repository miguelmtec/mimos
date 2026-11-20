'use strict';
// VICE PAWS — city life, pure logic (no DOM, no Three.js, no game state): pedestrian networks, spawn rules, traffic lights,
// stall data checks and the coin maths. Everything here is unit-tested in tests/life.test.mjs.
(function (root) {
const VP = root.VP = root.VP || {};
const LL = VP.LifeLogic = {};
const T = 48;

// ---------- small seeded rng (same family as VP.U.rng, kept here so the tests need nothing else) ----------
LL.rng = function (seed) {
  let s = (seed >>> 0) || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = a => a[Math.floor(f() * a.length)];
  f.range = (a, b) => a + f() * (b - a);
  return f;
};
LL.weighted = function (list, r) { let tot = 0; for (const o of list) tot += o.w || 1; let x = r() * tot; for (const o of list) { x -= o.w || 1; if (x <= 0) return o; } return list[list.length - 1]; };

// ---------- how many NPCs may be alive ----------
// quality 0 (leve) / 1 (médio) / 2 (alto); phones get fewer; `scale` is the live FPS governor (see LL.govern).
LL.caps = function (def, quality, mobile, scale, ambient) {
  const q = Math.max(0, Math.min(2, quality | 0)), out = {};
  const k = (mobile ? def.mobile || 0.8 : 1) * Math.max(def.min || 0.4, Math.min(1, scale === undefined ? 1 : scale)) * (ambient ? def.ambient || 0.5 : 1);
  for (const key of ['peds', 'cats', 'dogs', 'birds', 'vehicles', 'flies']) out[key] = Math.max(key === 'peds' ? 4 : 1, Math.round((def[key] || [0, 0, 0])[q] * k));
  if (ambient) out.vehicles = 0;
  return out;
};
// FPS governor: below 30 fps the crowd thins out quickly, above 50 it slowly comes back
LL.govern = function (scale, fps, min) {
  if (fps < 24) return Math.max(min || 0.4, scale - 0.2);
  if (fps < 30) return Math.max(min || 0.4, scale - 0.1);
  if (fps > 50) return Math.min(1, scale + 0.04);
  return scale;
};

// ---------- pedestrian network ----------
// net = { n, x: Float32Array, y: Float32Array, links: [[node...]], cross: [[lightIndex or -1 ...]], axis: [[0 none, 1 crosses a vertical road, 2 crosses a horizontal road]],
//         cell, cw, ch, buckets: Map(cellIndex -> [node...]) }
function makeNet() { return { n: 0, xs: [], ys: [], links: [], cross: [], axis: [] }; }
function addNode(net, x, y) { net.xs.push(x); net.ys.push(y); net.links.push([]); net.cross.push([]); net.axis.push([]); return net.n++; }
function link(net, a, b, cross, axis) {
  if (a === b || a < 0 || b < 0 || net.links[a].includes(b)) return;
  net.links[a].push(b); net.cross[a].push(cross === undefined ? -1 : cross); net.axis[a].push(axis || 0);
  net.links[b].push(a); net.cross[b].push(cross === undefined ? -1 : cross); net.axis[b].push(axis || 0);
}
function finish(net, cell) {
  net.x = Float32Array.from(net.xs); net.y = Float32Array.from(net.ys); delete net.xs; delete net.ys;
  net.cell = cell || 256; net.buckets = new Map();
  let maxX = 0, maxY = 0; for (let i = 0; i < net.n; i++) { if (net.x[i] > maxX) maxX = net.x[i]; if (net.y[i] > maxY) maxY = net.y[i]; }
  net.cw = Math.floor(maxX / net.cell) + 1; net.ch = Math.floor(maxY / net.cell) + 1;
  for (let i = 0; i < net.n; i++) { if (!net.links[i].length) continue; const k = Math.floor(net.y[i] / net.cell) * net.cw + Math.floor(net.x[i] / net.cell); let b = net.buckets.get(k); if (!b) net.buckets.set(k, b = []); b.push(i); }
  return net;
}
LL.makeNet = makeNet; LL.addNode = addNode; LL.link = link; LL.finishNet = finish;

// Home city: every block has a one-tile sidewalk ring. Nodes on its 4 corners and 4 side middles, zebra crossings to the
// neighbouring blocks (tied to the traffic light of that corner) and a few paths through open lots (plazas, parks, beaches).
// W needs: lots [{c, r, tx, ty, tw?, th?, type}], clear(px, py), los(x0, y0, x1, y1, mode), cols, rows.
LL.gridNet = function (W) {
  const net = makeNet(), ids = new Map(), ok = (x, y) => W.clear(x, y), see = (a, b) => W.los(net.xs[a], net.ys[a], net.xs[b], net.ys[b], 0);
  const node = (x, y) => (ok(x, y) ? addNode(net, x, y) : -1);
  const lightIx = (i, j) => (i < 0 || j < 0 || i > W.cols || j > W.rows ? -1 : j * (W.cols + 1) + i);
  for (const lot of W.lots) {
    const tw = lot.tw || 8, th = lot.th || 8, x0 = (lot.tx - 0.5) * T, x1 = (lot.tx + tw + 0.5) * T, y0 = (lot.ty - 0.5) * T, y1 = (lot.ty + th + 0.5) * T, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    // 0 NW, 1 N, 2 NE, 3 E, 4 SE, 5 S, 6 SW, 7 W
    const ring = [node(x0, y0), node(mx, y0), node(x1, y0), node(x1, my), node(x1, y1), node(mx, y1), node(x0, y1), node(x0, my)];
    for (let k = 0; k < 8; k++) { const a = ring[k], b = ring[(k + 1) % 8]; if (a >= 0 && b >= 0 && see(a, b)) link(net, a, b); }
    ids.set(lot.c + ',' + lot.r, ring);
    if (['plaza', 'arena', 'park', 'beach', 'dock', 'lot', 'house', 'yard'].includes(lot.type)) {
      const q = [[0.27, 0.27], [0.73, 0.27], [0.73, 0.73], [0.27, 0.73]].map(([fx, fy]) => node(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy));
      for (let k = 0; k < 4; k++) { const a = q[k], b = q[(k + 1) % 4]; if (a >= 0 && b >= 0 && see(a, b)) link(net, a, b); }
      [[1, 0], [1, 1], [3, 1], [3, 2], [5, 2], [5, 3], [7, 3], [7, 0]].forEach(([m, k]) => { const a = ring[m], b = q[k]; if (a >= 0 && b >= 0 && see(a, b)) link(net, a, b); });
    }
  }
  for (const lot of W.lots) {
    const A = ids.get(lot.c + ',' + lot.r), E = ids.get((lot.c + 1) + ',' + lot.r), S = ids.get(lot.c + ',' + (lot.r + 1));
    if (E) { // across the vertical road i = c + 1
      if (A[2] >= 0 && E[0] >= 0 && see(A[2], E[0])) link(net, A[2], E[0], lightIx(lot.c + 1, lot.r), 1);
      if (A[4] >= 0 && E[6] >= 0 && see(A[4], E[6])) link(net, A[4], E[6], lightIx(lot.c + 1, lot.r + 1), 1);
    }
    if (S) { // across the horizontal road j = r + 1
      if (A[6] >= 0 && S[0] >= 0 && see(A[6], S[0])) link(net, A[6], S[0], lightIx(lot.c, lot.r + 1), 2);
      if (A[4] >= 0 && S[2] >= 0 && see(A[4], S[2])) link(net, A[4], S[2], lightIx(lot.c + 1, lot.r + 1), 2);
    }
  }
  return finish(net);
};

// Real cities: people walk along both edges of every street and down the middle of footways and alleys.
// roads: [[widthMetres, isFoot, x1, z1, x2, z2, ...]] in metres; toPx(m) -> px; ok(px, py) -> walkable and connected.
LL.roadNet = function (roads, toPx, ok, see, opt) {
  opt = opt || {};
  const net = makeNet(), STEP = opt.step || 110, MAXN = opt.max || 9000, mpt = opt.mpt || 3, ends = [];
  for (const R of roads) {
    if (net.n >= MAXN) break;
    const foot = R[1] === 1, hw = Math.max(foot ? 0.5 : 0.95, R[0] / mpt / 2) * T, sides = foot || hw < 30 ? [0] : [-(hw - 12), hw - 12];
    for (const off of sides) {
      let prev = -1, carry = 0, first = -1;
      for (let i = 2; i + 3 < R.length; i += 2) {
        const ax = toPx(R[i]), ay = toPx(R[i + 1]), bx = toPx(R[i + 2]), by = toPx(R[i + 3]), len = Math.hypot(bx - ax, by - ay); if (len < 1) continue;
        const ux = (bx - ax) / len, uy = (by - ay) / len;
        let s = carry; for (; s <= len; s += STEP) {
          const x = ax + ux * s - uy * off, y = ay + uy * s + ux * off;
          if (!ok(x, y)) { prev = -1; continue; }
          const id = addNode(net, x, y); if (first < 0) first = id;
          if (prev >= 0 && see(net.xs[prev], net.ys[prev], x, y)) link(net, prev, id);
          prev = id; ends.push(id);
        }
        carry = s - len;
        if (i + 5 >= R.length && carry < STEP - 24) { // always a node at the very end of the street, so corners meet
          const x = bx - uy * off, y = by + ux * off;
          if (ok(x, y)) { const id = addNode(net, x, y); if (prev >= 0 && see(net.xs[prev], net.ys[prev], x, y)) link(net, prev, id); prev = id; ends.push(id); }
        }
      }
    }
  }
  // stitch the chains together wherever two of them come close (corners, junctions, a footway meeting a street)
  const cell = 96, grid = new Map(), key = (x, y) => Math.floor(y / cell) * 100000 + Math.floor(x / cell);
  for (let i = 0; i < net.n; i++) { const k = key(net.xs[i], net.ys[i]); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(i); }
  for (const i of ends) {
    if (net.links[i].length > 3) continue;
    const cx = Math.floor(net.xs[i] / cell), cy = Math.floor(net.ys[i] / cell); let best = -1, bd = 92 * 92;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const b = grid.get((cy + dy) * 100000 + cx + dx); if (!b) continue; for (const j of b) { if (j === i || Math.abs(j - i) < 3 || net.links[i].includes(j)) continue; const d = (net.xs[j] - net.xs[i]) ** 2 + (net.ys[j] - net.ys[i]) ** 2; if (d < bd) { bd = d; best = j; } } }
    if (best >= 0 && see(net.xs[i], net.ys[i], net.xs[best], net.ys[best])) link(net, i, best);
  }
  return finish(net);
};

// nodes of the network inside a ring around (px, py); out is reused
LL.nodesInRing = function (net, px, py, rMin, rMax, out) {
  out = out || []; out.length = 0;
  const c = net.cell, x0 = Math.max(0, Math.floor((px - rMax) / c)), x1 = Math.min(net.cw - 1, Math.floor((px + rMax) / c)), y0 = Math.max(0, Math.floor((py - rMax) / c)), y1 = Math.min(net.ch - 1, Math.floor((py + rMax) / c));
  const a = rMin * rMin, b = rMax * rMax;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const B = net.buckets.get(cy * net.cw + cx); if (!B) continue; for (const i of B) { const d = (net.x[i] - px) ** 2 + (net.y[i] - py) ** 2; if (d >= a && d <= b) out.push(i); } }
  return out;
};
// Where should the next NPC appear? A node in the ring, preferably ahead of the camera (the busy side is the one you look at)
// and never on top of another NPC. Returns { node, to } (to = neighbour to walk towards) or null.
LL.pickSpawn = function (net, px, py, yaw, rMin, rMax, r, taken, tries) {
  const pool = LL.nodesInRing(net, px, py, rMin, rMax, LL._pool || (LL._pool = []));
  if (!pool.length) return null;
  const fx = Math.cos(yaw), fy = Math.sin(yaw);
  for (let k = 0; k < (tries || 10); k++) {
    const i = pool[Math.floor(r() * pool.length)], dx = net.x[i] - px, dy = net.y[i] - py;
    if (yaw !== null && yaw !== undefined && dx * fx + dy * fy < 0 && r() < 0.72) continue; // behind the camera: usually skipped
    if (taken && taken(net.x[i], net.y[i])) continue;
    const L = net.links[i]; if (!L.length) continue;
    return { node: i, to: L[Math.floor(r() * L.length)] };
  }
  return null;
};
LL.shouldDespawn = function (dx, dy, rMax, onScreen, busy) { const d2 = dx * dx + dy * dy; if (busy) return d2 > rMax * rMax * 2.2; return d2 > rMax * rMax || (!onScreen && d2 > rMax * rMax * 0.72); };
// which way at a node: anything but straight back, unless it is a dead end
LL.nextNode = function (net, at, from, r, avoidCross) {
  const L = net.links[at]; if (!L.length) return -1; if (L.length === 1) return L[0];
  for (let k = 0; k < 6; k++) { const j = Math.floor(r() * L.length); if (L[j] === from) continue; if (avoidCross && net.cross[at][j] >= 0 && r() < avoidCross) continue; return L[j]; }
  for (const n of L) if (n !== from) return n;
  return L[0];
};
LL.edge = function (net, a, b) { const k = net.links[a].indexOf(b); return k < 0 ? null : { light: net.cross[a][k], axis: net.axis[a][k] }; };

// ---------- traffic lights (home city grid) ----------
// One light per crossing. CYCLE seconds: north-south green, amber, all red, east-west green, amber, all red.
LL.CYCLE = 18;
LL.lightState = function (t, i, j) {
  const C = LL.CYCLE, ph = (((t + (i * 5 + j * 7) % C) % C) + C) % C, g = C / 2 - 3;
  // returns ns / ew: 0 red, 1 amber, 2 green
  if (ph < g) return { ns: 2, ew: 0 };
  if (ph < g + 2) return { ns: 1, ew: 0 };
  if (ph < g + 3) return { ns: 0, ew: 0 };
  if (ph < g * 2 + 3) return { ns: 0, ew: 2 };
  if (ph < g * 2 + 5) return { ns: 0, ew: 1 };
  return { ns: 0, ew: 0 };
};
// may a pedestrian start crossing? axis 1 = the zebra crosses a vertical (north-south) road, so north-south traffic must be stopped
LL.canWalk = function (t, i, j, axis) { const s = LL.lightState(t, i, j); return axis === 1 ? s.ns === 0 && s.ew === 2 : s.ew === 0 && s.ns === 2; };
// must a vehicle stop? heading 0 east, 1 south, 2 west, 3 north. dist = distance (px) from the vehicle's centre to the centre of the crossing.
// Vehicles hold at the stop line (before the zebra) and never stop once inside the box.
LL.STOP = 196; LL.LOOK = 300;
LL.mustStop = function (t, i, j, dir, dist) {
  if (dist > LL.LOOK || dist < LL.STOP - 26) return false;
  const s = LL.lightState(t, i, j), v = dir % 2 === 0 ? s.ew : s.ns;
  return v === 0 || (v === 1 && dist > LL.STOP + 30);
};

// ---------- near miss ----------
// a vehicle at (vx, vy) heading `a` at speed spd (px/s) and a cat at (cx, cy): true when the cat is right in front and close
LL.nearMiss = function (vx, vy, a, spd, cx, cy) {
  if (spd < 45) return false;
  const dx = cx - vx, dy = cy - vy, f = dx * Math.cos(a) + dy * Math.sin(a), s = -dx * Math.sin(a) + dy * Math.cos(a);
  return f > 10 && f < 60 + spd * 0.35 && Math.abs(s) < 34;
};
// how fast may a vehicle go with something `f` px ahead (0 = stop)
LL.followSpeed = function (top, f, gap) { gap = gap || 70; if (f <= gap) return 0; if (f >= gap * 3) return top; return top * (f - gap) / (gap * 2); };

// ---------- stalls: data checks and coin maths ----------
LL.BUFF_KINDS = ['energy', 'heal', 'life', 'speed', 'cooldown', 'belly', 'regen', 'catnip', 'toy'];
LL.FAVORS = ['mouse', 'photo', 'pigeons', 'delivery', 'meow'];
LL.MODELS = ['cart', 'shop', 'fair'];
// returns a list of problems (empty = good). Used by the tests and, at load time, to refuse a broken file.
LL.checkStalls = function (d) {
  const bad = [], two = o => o && typeof o.pt === 'string' && o.pt && typeof o.en === 'string' && o.en;
  if (!d || !Array.isArray(d.stalls) || !d.stalls.length) return ['no stalls'];
  if (d.currency !== 'moedas') bad.push('currency must be the in-game "moedas"');
  const ids = new Set();
  for (const s of d.stalls) {
    const at = 'stall ' + s.id;
    if (!s.id || ids.has(s.id)) bad.push(at + ': missing or duplicate id'); ids.add(s.id);
    if (!two(s.name) || !two(s.hello)) bad.push(at + ': name/hello need pt and en');
    if (!LL.MODELS.includes(s.model)) bad.push(at + ': model');
    if (!Array.isArray(s.items) || !s.items.length) { bad.push(at + ': no items'); continue; }
    const iids = new Set();
    for (const it of s.items) {
      const ia = at + '/' + it.id;
      if (!it.id || iids.has(it.id)) bad.push(ia + ': missing or duplicate item id'); iids.add(it.id);
      if (!two(it.name) || !two(it.desc)) bad.push(ia + ': name/desc need pt and en');
      if (!Number.isInteger(it.price) || it.price < 1 || it.price > 500) bad.push(ia + ': price must be 1-500 coins');
      if (!it.buff || !LL.BUFF_KINDS.includes(it.buff.kind)) bad.push(ia + ': buff kind');
      else if (!d.buffs || !d.buffs[it.buff.kind]) bad.push(ia + ': buff ' + it.buff.kind + ' has no HUD entry');
      if (it.buff && it.buff.kind === 'toy' && !['yarn', 'laser'].includes(it.buff.toy)) bad.push(ia + ': toy');
      if (/r\$|real|pix|usd|\$\d/i.test(JSON.stringify([it.name, it.desc]))) bad.push(ia + ': must not mention real money');
    }
    if (!s.favor || !LL.FAVORS.includes(s.favor.kind) || !two(s.favor.name) || !two(s.favor.desc)) bad.push(at + ': every stall needs a free favor');
    else if (!iids.has(s.favor.reward)) bad.push(at + ': favor reward is not one of its items');
  }
  const P = d.placement || {};
  for (const p of P.home || []) if (!ids.has(p.stall) || !Array.isArray(p.roles) || !'nsew'.includes(p.side)) bad.push('placement of ' + p.stall);
  for (const id of (P.real && P.real.order) || []) if (!ids.has(id)) bad.push('real placement: ' + id);
  return bad;
};
LL.canBuy = (cash, item) => !!item && Number.isFinite(cash) && cash >= item.price;
// buying never goes below zero and never changes anything on failure
LL.buy = function (cash, item) { if (!LL.canBuy(cash, item)) return { ok: false, cash, need: item ? item.price - cash : 0 }; return { ok: true, cash: cash - item.price, need: 0 }; };
LL.itemOf = function (d, stallId, itemId) { const s = d.stalls.find(x => x.id === stallId); return s ? s.items.find(i => i.id === itemId) || null : null; };

// ---------- looks ----------
LL.look = function (N, r, role) {
  const kid = role === 'kid', h = kid ? r.range(0.56, 0.68) : r.range(0.9, 1.08);
  const o = { skin: r.pick(N.skin), hair: r.pick(N.hair), top: r.pick(N.tops), bottom: r.pick(N.bottoms), h, w: r.range(0.88, 1.16) * (kid ? 0.9 : 1), kid,
    hairStyle: r.int(0, 4), // 0 short, 1 long, 2 bun/afro (big), 3 bald, 4 cap or hat
    sleeves: r() < 0.45, skirt: r() < 0.22 };
  if (o.hairStyle === 4) o.hat = r.pick(N.hats);
  if (role === 'jogger') { o.bottom = r.pick(['#17121d', '#27285c', '#ff4fb8']); o.sleeves = false; o.skirt = false; }
  if (role === 'vendor') { o.apron = '#ffffff'; o.hairStyle = 4; o.hat = '#ffffff'; o.skirt = false; }
  if (role === 'waiter') { o.top = '#ffffff'; o.bottom = '#17121d'; o.apron = '#17121d'; o.skirt = false; }
  if (role === 'tourist') { o.hat = o.hat || '#f2c282'; o.hairStyle = 4; o.top = r.pick(['#ff8a5c', '#2de2e6', '#ffd23f', '#7CFF6B']); }
  return o;
};

// ---------- day clock ----------
// clock 0..1 (0 = midnight). night() is 0 by day, 1 in the middle of the night, with soft dusk and dawn.
LL.night = function (clock) { const h = ((clock % 1) + 1) % 1 * 24; if (h >= 7 && h <= 17.5) return 0; if (h >= 19.5 || h <= 5) return 1; if (h > 17.5) return (h - 17.5) / 2; return 1 - (h - 5) / 2; };
LL.hhmm = function (clock) { const m = Math.floor((((clock % 1) + 1) % 1) * 1440); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

if (typeof module !== 'undefined' && module.exports) module.exports = LL;
})(typeof window !== 'undefined' ? window : globalThis);
