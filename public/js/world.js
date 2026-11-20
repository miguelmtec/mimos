'use strict';
// VICE PAWS — open city generator (5 districts, one continuous map), tile collision, flow fields
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE;
const World = VP.World = {};
// collision tile ids
const FLOOR = 0, WALL = 1, WATER = 2, FENCE = 3, GAP = 4, DOOR = 5, LASER = 6;
World.TT = { FLOOR, WALL, WATER, FENCE, GAP, DOOR, LASER };
// pass[mode][tile]: mode 0 walker, 1 Morticia, 2 bullet, 3 car
const PASS = [[1, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0], [1, 0, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 0]];
// ground ids
const G_ROAD = 1, G_WALK = 2, G_GRASS = 3, G_SAND = 4, G_PLAZA = 5, G_WOOD = 6, G_LOT = 7, G_WATER = 8, G_ROOF = 9, G_BORDER = 10, G_FLOOR = 11, G_POOL = 12;
World.GT = { G_ROAD, G_WALK, G_GRASS, G_SAND, G_PLAZA, G_WOOD, G_LOT, G_WATER, G_ROOF, G_BORDER, G_FLOOR, G_POOL };

const PAL = World.PAL = [
  { // 0 Sunset Beach
    road: '#4a3a5e', line: '#ffe9a8', walk: '#f2c9a0', walk2: '#dba77c', grass: '#5fbf7a', grass2: '#4aa868', sand: '#ffd9a0', sand2: '#f2c282',
    water: '#ff8fa8', water2: '#ffc3a0', plaza: '#f7b7c5', plaza2: '#ef9fb4', wood: '#c98f4b', lot: '#5a4a70', floor: '#bfa9c9',
    roofs: ['#ff9fb8', '#8fe3e0', '#ffd27a', '#c9a7ff', '#ffb38a'], wall: '#fff1e0', neon: ['#ff4fb8', '#2de2e6', '#ffd23f'], palmT: '#9a6a3b', palmL: ['#2fae7a', '#1f8f6a'],
    tint: 'rgba(255,120,80,.13)', dark: 0, border: 'water', lamp: '#ffe9a8', traffic: 4,
  },
  { // 1 Neon Downtown
    road: '#231b3a', line: '#6f63a8', walk: '#3d3460', walk2: '#2e2749', grass: '#1f5a54', grass2: '#184a46', sand: '#4d436e', sand2: '#3d3460',
    water: '#1b2f6b', water2: '#2de2e6', plaza: '#4a2a66', plaza2: '#3a1f52', wood: '#5e3f5a', lot: '#2a2145', floor: '#3b3359',
    roofs: ['#3a2a66', '#27285c', '#4a2256', '#1f3a5e', '#5a2a4a'], wall: '#1a1430', neon: ['#ff4fb8', '#2de2e6', '#b967ff', '#fffb96'], palmT: '#4a3a5e', palmL: ['#167a6e', '#0f5f58'],
    tint: 'rgba(60,20,140,.16)', dark: 0.28, border: 'wall', lamp: '#ff9fe0', traffic: 6,
  },
  { // 2 Palm Harbor
    road: '#56607a', line: '#ffffff', walk: '#efe6d2', walk2: '#d6cab0', grass: '#6fd08a', grass2: '#57b874', sand: '#ffe9b8', sand2: '#f2d596',
    water: '#27c4d6', water2: '#9ff0f5', plaza: '#ffe1a8', plaza2: '#f5cc85', wood: '#c9a06a', lot: '#69728c', floor: '#c5ccd9',
    roofs: ['#ff8a70', '#5fd0c8', '#ffd27a', '#ffffff', '#7fb4ff'], wall: '#fff7ea', neon: ['#ff4fb8', '#2de2e6', '#ffd23f'], palmT: '#a67a45', palmL: ['#3fc27f', '#2aa368'],
    tint: 'rgba(255,255,200,.05)', dark: 0, border: 'water', lamp: '#fff', traffic: 5,
  },
  { // 3 Storm Docks
    road: '#262d3a', line: '#8fa3b8', walk: '#4a5568', walk2: '#3a4455', grass: '#2f5a50', grass2: '#264a42', sand: '#5a6170', sand2: '#4a5160',
    water: '#1c3550', water2: '#4c7fa8', plaza: '#414b5e', plaza2: '#353e4f', wood: '#6a5444', lot: '#2f3644', floor: '#525d70',
    roofs: ['#3d4a5e', '#5a3d4a', '#2f5560', '#4a4a66', '#5e5033'], wall: '#1d2430', neon: ['#ffd23f', '#4cc9f0', '#ff4f5e'], palmT: '#4a4038', palmL: ['#256e5a', '#1a5546'],
    tint: 'rgba(40,80,140,.2)', dark: 0.3, border: 'water', lamp: '#ffe9a8', rain: 1, traffic: 4,
  },
  { // 4 Vice Heights
    road: '#2a1238', line: '#ff4fb8', walk: '#55306b', walk2: '#432355', grass: '#2a7a66', grass2: '#1f6656', sand: '#6a4580', sand2: '#55306b',
    water: '#2de2e6', water2: '#b8fbff', plaza: '#6b2a66', plaza2: '#571f55', wood: '#7a4a5e', lot: '#34184a', floor: '#5a3a70',
    roofs: ['#ffffff', '#ffd9ef', '#c9f5f5', '#ffe9a8', '#e6d4ff'], wall: '#2a1238', neon: ['#ff4fb8', '#ffd23f', '#2de2e6'], palmT: '#6a4a3b', palmL: ['#2fd0a0', '#1fa684'],
    tint: 'rgba(160,20,120,.14)', dark: 0.24, border: 'wall', lamp: '#ff9fe0', traffic: 5,
  },
];
// building heights (in tiles) per district
const BH = [[2, 4], [5, 16], [2, 5], [2, 4], [4, 9]];
// city layout: 12 x 8 blocks. Top: Neon Downtown (6x4) | Vice Heights (6x4). Bottom: Sunset Beach | Palm Harbor | Storm Docks (4x4 each)
const COLS = 12, ROWS = 8;
const DREG = World.DREG = [
  { d: 0, c0: 0, r0: 4, cw: 4, rh: 4 }, { d: 1, c0: 0, r0: 0, cw: 6, rh: 4 }, { d: 2, c0: 4, r0: 4, cw: 4, rh: 4 },
  { d: 3, c0: 8, r0: 4, cw: 4, rh: 4 }, { d: 4, c0: 6, r0: 0, cw: 6, rh: 4 },
];
const TPL = [
  ['bld plaza1 compB bld', 'compA arena house lot', 'park compC plaza2 compD', 'beach beach plaza3 beach'],
  ['bld bld plaza1 bld compB bld', 'bld compA arena house bld lot', 'bld plaza2 bld compC bld bld', 'lot bld compD bld plaza3 park'],
  ['bld plaza1 compB bld', 'compA arena house lot', 'dock compC plaza2 compD', 'dock beach plaza3 dock'],
  ['bld plaza1 compB bld', 'compA arena house lot', 'dock compC plaza2 compD', 'dock dock plaza3 dock'],
  ['pool bld plaza1 pool compB bld', 'bld compA arena house bld pool', 'pool plaza2 bld compC pool bld', 'lot bld compD bld plaza3 park'],
];
const SIGNS = World.SIGNS = ['PET SHOP', 'SUSHI', 'MIAU BAR', 'DONUTS', 'HOTEL', 'CAFE', 'PIZZA', 'ARCADE', 'MOTEL', 'SURF', 'CLUB 9', 'PEIXARIA', 'TACOS', 'GELATO', 'VICE', 'NEON'];

World.gen = function (cfg) {
  cfg = cfg || {};
  const cols = COLS, rows = ROWS, rng = U.rng(cfg.seed || 7);
  const W = cols * 14 + 8, H = rows * 14 + 8;
  const grid = new Uint8Array(W * H), gnd = new Uint8Array(W * H), flap = new Uint8Array(W * H);
  const w = {
    W, H, grid, gnd, flap, cols, rows, pal: PAL[0], pw: W * T, ph: H * T, RX: [], RY: [], lots: [], blds: [], deco: [], palms: [], lamps: [], glows: [],
    spawn: { stands: [], crates: [], trash: [], parked: [], treats: [], props: [] }, roles: [{}, {}, {}, {}, {}], comps: [],
  };
  const set = w.set = (x, y, t, g) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; grid[i] = t; if (g) gnd[i] = g; };
  for (let i = 0; i < W * H; i++) { grid[i] = WATER; gnd[i] = G_BORDER; }
  for (let i = 0; i <= cols; i++) w.RX.push((2 + i * 14 + 2) * T);
  for (let j = 0; j <= rows; j++) w.RY.push((2 + j * 14 + 2) * T);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const rx = (x - 2) % 14 < 4, ry = (y - 2) % 14 < 4;
    if (rx || ry) set(x, y, FLOOR, G_ROAD); else set(x, y, FLOOR, G_WALK);
  }
  const types = {};
  for (const R of DREG) for (let r = 0; r < R.rh; r++) {
    const row = TPL[R.d][r].split(' ');
    for (let c = 0; c < R.cw; c++) {
      const role = row[c], C = R.c0 + c, RR = R.r0 + r;
      const type = role.startsWith('comp') ? 'comp' : role.startsWith('plaza') ? 'plaza' : role === 'arena' ? 'arena' : role;
      const tx = 6 + C * 14 + 1, ty = 6 + RR * 14 + 1;
      const lot = { c: C, r: RR, d: R.d, role, type, tx, ty, tw: 8, th: 8, cx: (tx + 4) * T, cy: (ty + 4) * T, side: 's', stands: 3, pal: PAL[R.d] };
      w.lots.push(lot); types[C + ',' + RR] = lot;
      if (type !== 'bld' && type !== 'lot' && type !== 'beach' && type !== 'dock' && type !== 'pool') w.roles[R.d][role] = lot;
      if (type === 'comp') w.comps.push(lot);
    }
  }
  w.lot = (c, r) => types[c + ',' + r];
  w.setComp = (lot, spec) => setComp(w, lot, spec || {});
  for (const lot of w.lots) { if (lot.type === 'comp') lot.props = setComp(w, lot, {}); else fillLot(w, lot, rng, set); }
  // street furniture
  for (const lot of w.lots) {
    const bx = lot.tx - 1, by = lot.ty - 1, d = lot.d;
    w.lamps.push({ x: (bx + 0.3) * T, y: (by + 0.6) * T, d }, { x: (bx + 9.5) * T, y: (by + 9.9) * T, d });
    if (lot.type === 'arena') continue;
    if (d !== 3 || rng() < 0.4) w.palms.push({ x: (bx + 9.5) * T, y: (by + 0.7) * T, s: 0.95, d }, { x: (bx + 0.4) * T, y: (by + 9.8) * T, s: 0.9, d });
    if (rng() < 0.6 && d !== 3) w.palms.push({ x: (bx + 5) * T, y: (by + 0.55) * T, s: 0.8, d });
  }
  finalize(w);
  w.pristine = grid.slice(); w.pristineFlap = flap.slice();
  // restore tiles before a new session/mission (gates, crates, vaults)
  w.reset = () => { grid.set(w.pristine); flap.set(w.pristineFlap); for (const l of w.comps) l.props = setComp(w, l, {}); };
  return w;
};
World.distAt = (w, px, py) => { const c = U.clamp(Math.floor((px / T - 2) / 14), 0, COLS - 1), r = U.clamp(Math.floor((py / T - 2) / 14), 0, ROWS - 1); return r >= 4 ? (c < 4 ? 0 : c < 8 ? 2 : 3) : (c < 6 ? 1 : 4); };

// compound (fenced yard). spec: {gate:'open'|'fence'|'switch'|'gap'|'key', vault:bool}. Returns its props.
function setComp(w, lot, spec) {
  const { tx, ty } = lot, set = w.set, P = [];
  const px = ix => (tx + ix + 0.5) * T, py = iy => (ty + iy + 0.5) * T;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { set(tx + x, ty + y, FLOOR, G_FLOOR); w.flap[(ty + y) * w.W + tx + x] = 0; }
  for (let i = 0; i < 8; i++) { set(tx + i, ty, FENCE); set(tx + i, ty + 7, FENCE); set(tx, ty + i, FENCE); set(tx + 7, ty + i, FENCE); }
  const side = lot.side || 's', hor = side === 's' || side === 'n';
  const gt = side === 's' ? [[3, 7], [4, 7]] : side === 'n' ? [[3, 0], [4, 0]] : side === 'w' ? [[0, 3], [0, 4]] : [[7, 3], [7, 4]];
  const tiles = gt.map(([a, b]) => [tx + a, ty + b]);
  const gx = (px(gt[0][0]) + px(gt[1][0])) / 2, gy = (py(gt[0][1]) + py(gt[1][1])) / 2;
  const out = { s: [0, 1], n: [0, -1], w: [-1, 0], e: [1, 0] }[side];
  lot.gateX = gx; lot.gateY = gy; lot.frontX = gx + out[0] * T * 1.6; lot.frontY = gy + out[1] * T * 1.6;
  lot.gate = spec.gate || 'open'; lot.vault = !!spec.vault;
  const gate = lot.gate, id = 'g' + lot.c + '_' + lot.r;
  const gp = { tiles, x: gx, y: gy, w: hor ? 96 : 20, h: hor ? 20 : 96, lot };
  for (const [a, b] of tiles) set(a, b, gate === 'open' ? FLOOR : gate === 'switch' ? LASER : DOOR);
  if (gate === 'fence') P.push(Object.assign({ k: 'fgate', hp: 4 }, gp));
  if (gate === 'switch') { P.push(Object.assign({ k: 'laser', id }, gp)); const s = side === 's' ? [1, 1] : side === 'n' ? [6, 6] : side === 'w' ? [6, 1] : [1, 6]; P.push({ k: 'switch', x: px(s[0]), y: py(s[1]) + 8, link: id, lot }); }
  if (gate === 'gap') {
    P.push(Object.assign({ k: 'sdoor', id }, gp));
    const g = hor ? [0, 5] : [5, 0]; set(tx + g[0], ty + g[1], GAP); w.flap[(ty + g[1]) * w.W + tx + g[0]] = 1;
    lot.gapX = px(g[0]) + (hor ? -T : 0); lot.gapY = py(g[1]) + (hor ? 0 : -T);
    P.push({ k: 'flap', x: px(g[0]), y: py(g[1]), hor: !hor, lot });
    const lv = hor ? [6, side === 's' ? 1 : 6] : [side === 'w' ? 6 : 1, 6];
    P.push({ k: 'lever', x: px(lv[0]), y: py(lv[1]), link: id, lot });
  }
  if (gate === 'key') P.push(Object.assign({ k: 'sdoor', key: true, id }, gp));
  if (lot.vault) {
    for (let i = 2; i <= 5; i++) { set(tx + i, ty + 2, WALL); set(tx + i, ty + 5, WALL); set(tx + 2, ty + i, WALL); set(tx + 5, ty + i, WALL); }
    P.push({ k: 'vwall', x: (tx + 4) * T, y: (ty + 4) * T, lot });
    const fx = tx + 2, fy = ty + 4; w.flap[fy * w.W + fx] = 1;
    P.push({ k: 'vlaser', id: 'v' + id, tiles: [[fx, fy]], x: (fx + 0.5) * T - 26, y: (fy + 0.5) * T, w: 10, h: 44, lot });
    set(tx + 5, ty + 1, FENCE); set(tx + 6, ty + 2, FENCE);
    P.push({ k: 'nook', x: px(5.5), y: py(1.5), lot });
    P.push({ k: 'switch', x: px(6), y: py(1) + 8, link: 'v' + id, lot });
    P.push({ k: 'loot', x: (tx + 4) * T, y: (ty + 4) * T, lot });
  }
  return P;
}

function fillLot(w, lot, rng, set) {
  const { tx, ty } = lot, pal = lot.pal, sp = w.spawn, bh = BH[lot.d];
  const px = ix => (tx + ix + 0.5) * T, py = iy => (ty + iy + 0.5) * T;
  const area = (x0, y0, x1, y1, t, g) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(tx + x, ty + y, t, g); };
  const bld = (x0, y0, x1, y1) => {
    area(x0, y0, x1, y1, WALL, G_ROOF);
    const b = { x: (tx + x0) * T, y: (ty + y0) * T, w: (x1 - x0 + 1) * T, h: (y1 - y0 + 1) * T, d: lot.d, ht: Math.round(rng.range(bh[0], bh[1]) * (((x1 - x0) < 2 || (y1 - y0) < 2) ? 0.75 : 1) * 2) / 2 + 1, col: rng.pick(pal.roofs), seed: rng.int(1, 99999), sign: (x1 - x0) >= 3 && rng() < 0.8 ? rng.pick(SIGNS) : null, neon: rng.pick(pal.neon) };
    w.blds.push(b);
    
  };
  const type = lot.type;
  if (type === 'bld') {
    const v = rng.int(0, 4);
    if (v === 0) bld(0, 0, 7, 7);
    else if (v === 1) { area(0, 0, 7, 7, FLOOR, G_LOT); bld(0, 0, 7, 2); bld(0, 4, 7, 7); sp.trash.push({ x: px(rng.int(1, 6)), y: py(3) }); }
    else if (v === 2) { area(0, 0, 7, 7, FLOOR, G_LOT); bld(0, 0, 2, 7); bld(4, 0, 7, 7); sp.crates.push({ tx: tx + 3, ty: ty + rng.int(2, 5) }); }
    else if (v === 3) { area(0, 0, 7, 7, FLOOR, G_LOT); bld(0, 0, 2, 2); bld(4, 0, 7, 2); bld(0, 4, 2, 7); bld(4, 4, 7, 7); sp.trash.push({ x: px(3), y: py(3) }); sp.treats.push({ x: px(3), y: py(6) }); }
    else { area(0, 0, 7, 7, FLOOR, G_PLAZA); bld(0, 0, 7, 3); bld(0, 4, 1, 7); bld(6, 4, 7, 7); sp.crates.push({ tx: tx + 2, ty: ty + 4 }); sp.treats.push({ x: px(4), y: py(5) }, { x: px(3), y: py(6) }); }
  } else if (type === 'park' || type === 'yard' || type === 'house') {
    area(0, 0, 7, 7, FLOOR, G_GRASS);
    if (type === 'park') {
      area(3, 3, 4, 4, WALL, G_GRASS); w.deco.push({ k: 'fountain', x: px(3.5), y: py(3.5) });
      for (const [a, b] of [[0, 0], [7, 0], [0, 7], [7, 7], [2, 6], [5, 1]]) w.palms.push({ x: px(a), y: py(b) + 10, s: rng.range(0.9, 1.15) });
      w.deco.push({ k: 'bench', x: px(1.5), y: py(3.5) }, { k: 'bench', x: px(5.8), y: py(3.5) });
      for (let i = 0; i < 6; i++) w.deco.push({ k: 'flower', x: px(rng.range(0.2, 7)), y: py(rng.range(0.2, 7)), col: rng.pick(pal.neon) });
      sp.treats.push({ x: px(1), y: py(6) }, { x: px(6), y: py(2) }); sp.trash.push({ x: px(6.5), y: py(6.5) });
    } else {
      for (const [a, b] of [[0, 0], [7, 0], [0, 7], [7, 7]]) w.palms.push({ x: px(a), y: py(b) + 10, s: 1 });
      for (let i = 0; i < 8; i++) w.deco.push({ k: 'flower', x: px(rng.range(0.2, 7)), y: py(rng.range(0.2, 7)), col: rng.pick(pal.neon) });
      if (type === 'house') area(3, 2, 4, 3, WALL, G_GRASS);
    }
  } else if (type === 'plaza' || type === 'arena') {
    area(0, 0, 7, 7, FLOOR, G_PLAZA);
    if (type === 'plaza') {
      const kinds = ['hotdog', 'sushi', 'donut'];
      const spots = rng.shuffle([[1, 1], [6, 1], [1, 6], [6, 6], [3.5, 3.5]]);
      const n = lot.stands === undefined ? rng.int(2, 3) : lot.stands;
      for (let i = 0; i < n; i++) sp.stands.push({ x: px(spots[i][0]), y: py(spots[i][1]), kind: rng.pick(kinds), lot });
      for (const [a, b] of [[0, 3.5], [7, 3.5]]) { set(tx + a, ty + 3, WALL, G_PLAZA); w.deco.push({ k: 'planter', x: px(a), y: py(3), col: rng.pick(pal.neon) }); void b; }
      
      sp.treats.push({ x: px(3), y: py(1) }, { x: px(4), y: py(6) });
    }
  } else if (type === 'lot') {
    area(0, 0, 7, 7, FLOOR, G_LOT);
    w.deco.push({ k: 'parklines', x: tx * T, y: ty * T });
    const n = lot.cars === undefined ? rng.int(2, 3) : lot.cars;
    const slots = rng.shuffle([0, 1, 2, 3]);
    for (let i = 0; i < n; i++) sp.parked.push({ x: px(slots[i] * 2 + 0.5), y: py(1), a: Math.PI / 2, lot });
    sp.trash.push({ x: px(7), y: py(7) }); sp.crates.push({ tx: tx + rng.int(0, 5), ty: ty + 6 });
  } else if (type === 'beach') {
    area(0, 0, 7, 7, FLOOR, G_SAND);
    const wx = rng.int(0, 4), wy = rng.int(4, 5); area(wx, wy, wx + 3, wy + 2, WATER, G_WATER);
    for (let i = 0; i < 3; i++) w.deco.push({ k: 'umbrella', x: px(rng.range(0.5, 7)), y: py(rng.range(0.5, 3)), col: rng.pick(pal.neon) });
    w.palms.push({ x: px(0), y: py(0) + 12, s: 1.1 }, { x: px(7), y: py(1) + 12, s: 1 });
    sp.treats.push({ x: px(2), y: py(2) }, { x: px(5), y: py(3) }, { x: px(6), y: py(1) }); sp.crates.push({ tx: tx + 7, ty: ty + 3 });
  } else if (type === 'dock') {
    area(0, 0, 7, 7, FLOOR, G_WOOD);
    const wx = rng.int(1, 4); area(wx, 5, wx + 2, 7, WATER, G_WATER);
    const cont = (x0, y0, x1, y1) => { area(x0, y0, x1, y1, WALL, G_WOOD); w.deco.push({ k: 'container', x: (tx + x0) * T, y: (ty + y0) * T, w: (x1 - x0 + 1) * T, h: (y1 - y0 + 1) * T, col: rng.pick(['#e2574c', '#2a9d8f', '#e9c46a', '#577590', '#f28a2e']) }); };
    cont(0, 0, 2, 0); cont(5, 1, 7, 1); if (rng() < 0.7) cont(1, 2, 1, 3);
    sp.crates.push({ tx: tx + 4, ty: ty + 3 }, { tx: tx + 6, ty: ty + 4 }, { tx: tx + 3, ty: ty + 0 });
    sp.treats.push({ x: px(3), y: py(2) }, { x: px(6), y: py(6) }); sp.trash.push({ x: px(0), y: py(7) });
  } else if (type === 'pool') {
    area(0, 0, 7, 7, FLOOR, G_PLAZA); bld(0, 0, 7, 2);
    area(2, 4, 5, 6, WATER, G_POOL);
    w.palms.push({ x: px(0), y: py(7), s: 1 }, { x: px(7), y: py(7), s: 1.05 });
    w.deco.push({ k: 'umbrella', x: px(0.6), y: py(4.5), col: rng.pick(pal.neon) }, { k: 'umbrella', x: px(6.6), y: py(4.2), col: rng.pick(pal.neon) });
    
    sp.treats.push({ x: px(1), y: py(6.5) }, { x: px(6.5), y: py(6) }); sp.stands.push({ x: px(3.5), y: py(7), kind: 'sushi', lot, free: true });
  }
}

function finalize(w) {
  const { W, H, grid } = w;
  w.walkList = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x; if (grid[i] === FLOOR && (w.gnd[i] === G_ROAD || w.gnd[i] === G_WALK)) w.walkList.push(i); }
  w.tile = (px, py) => { const x = Math.floor(px / T), y = Math.floor(py / T); return x < 0 || y < 0 || x >= W || y >= H ? WALL : grid[y * W + x]; };
  w.setTile = (tx, ty, t) => { grid[ty * W + tx] = t; };
  w.pass = (px, py, mode) => PASS[mode][w.tile(px, py)] === 1;
  w.blocked = (x, y, r, mode) => {
    const P = PASS[mode];
    if (!P[w.tile(x - r, y - r)] || !P[w.tile(x + r, y - r)] || !P[w.tile(x - r, y + r)] || !P[w.tile(x + r, y + r)]) return true;
    if (r > 22 && (!P[w.tile(x, y - r)] || !P[w.tile(x, y + r)] || !P[w.tile(x - r, y)] || !P[w.tile(x + r, y)] || !P[w.tile(x, y)])) return true;
    return false;
  };
  w.los = (x0, y0, x1, y1, mode) => {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 14), P = PASS[mode === undefined ? 2 : mode];
    for (let i = 1; i < n; i++) { const t = i / n; if (!P[w.tile(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)]) return false; }
    return true;
  };
  // BFS distance field from a tile (mode 0 walkers, 1 Morticia)
  const queue = new Int32Array(W * H);
  w.field = (px, py, mode, out) => {
    const dist = out || new Int16Array(W * H); dist.fill(-1);
    const P = PASS[mode || 0];
    let sx = Math.floor(px / T), sy = Math.floor(py / T);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return dist;
    let h = 0, t = 0; queue[t++] = sy * W + sx; dist[sy * W + sx] = 0;
    while (h < t) {
      const i = queue[h++], d = dist[i] + 1, x = i % W;
      if (x > 0 && dist[i - 1] < 0 && P[grid[i - 1]]) { dist[i - 1] = d; queue[t++] = i - 1; }
      if (x < W - 1 && dist[i + 1] < 0 && P[grid[i + 1]]) { dist[i + 1] = d; queue[t++] = i + 1; }
      if (i >= W && dist[i - W] < 0 && P[grid[i - W]]) { dist[i - W] = d; queue[t++] = i - W; }
      if (i < W * (H - 1) && dist[i + W] < 0 && P[grid[i + W]]) { dist[i + W] = d; queue[t++] = i + W; }
    }
    return dist;
  };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // direction to walk "downhill" in a field; returns distance (tiles) or -1 if unreachable
  w.fieldDir = (dist, px, py, out) => {
    const x = Math.floor(px / T), y = Math.floor(py / T);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return -1;
    const here = dist[y * W + x];
    if (here < 0) return -1;
    let best = here, bx = 0, by = 0;
    for (const [dx, dy] of DIRS) {
      const v = dist[(y + dy) * W + x + dx];
      if (v < 0 || v >= best) continue;
      if (dx && dy && (dist[y * W + x + dx] < 0 || dist[(y + dy) * W + x] < 0)) continue;
      best = v; bx = dx; by = dy;
    }
    const tx = (x + bx + 0.5) * T - px, ty = (y + by + 0.5) * T - py, l = Math.hypot(tx, ty) || 1;
    out.x = tx / l; out.y = ty / l;
    return here;
  };
  w.distAt = (dist, px, py) => { const x = Math.floor(px / T), y = Math.floor(py / T); return x < 0 || y < 0 || x >= W || y >= H ? -1 : dist[y * W + x]; };
  // free interior tiles of a lot (pixel centers)
  w.lotFree = (lot, rng) => {
    const out = [];
    const x0 = lot.tx, y0 = lot.ty, tw = 8, th = 8;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (grid[(y0 + y) * W + x0 + x] === FLOOR) out.push({ x: (x0 + x + 0.5) * T, y: (y0 + y + 0.5) * T });
    return rng ? rng.shuffle(out) : out;
  };
  // sidewalk point just outside a lot side
  w.front = (lot, side) => {
    const bx = (lot.tx - 1) * T, by = (lot.ty - 1) * T, s = 10 * T;
    if (side === 'n') return { x: bx + s / 2, y: by - T * 0.7 }; if (side === 's') return { x: bx + s / 2, y: by + s + T * 0.7 };
    if (side === 'w') return { x: bx - T * 0.7, y: by + s / 2 }; return { x: bx + s + T * 0.7, y: by + s / 2 };
  };
  w.randWalk = (rng) => { const i = w.walkList[Math.floor((rng || Math.random)() * w.walkList.length)]; return { x: (i % W + 0.5) * T, y: (Math.floor(i / W) + 0.5) * T }; };
  w.clear = (px, py) => w.tile(px, py) === FLOOR;
  w.walkD = [[], [], [], [], []];
  for (const i of w.walkList) w.walkD[World.distAt(w, (i % W + 0.5) * T, (Math.floor(i / W) + 0.5) * T)].push(i);
  w.randWalkD = (d, rng) => { const L = w.walkD[d], i = L[Math.floor((rng || Math.random)() * L.length)]; return { x: (i % W + 0.5) * T, y: (Math.floor(i / W) + 0.5) * T }; };
  // minimap
  const mm = document.createElement('canvas'); mm.width = W * 2; mm.height = H * 2;
  const m = mm.getContext('2d');
  w.mini = mm;
  w.redrawMini = () => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, g = w.gnd[i], t = grid[i];
      m.fillStyle = g === G_BORDER ? '#17406b' : g === G_ROAD ? '#5a5375' : g === G_ROOF || t === WALL ? '#1d1530' : t === WATER ? '#2a7fb8' : t === FENCE || t === DOOR || t === LASER || t === GAP ? '#ff4fb8' : g === G_GRASS ? '#3f8f5f' : g === G_SAND ? '#d9b87c' : '#8a7fa8';
      m.fillRect(x * 2, y * 2, 2, 2);
    }
  };
  w.redrawMini();
}

})();
