'use strict';
// VICE PAWS — city generator, tile collision, flow fields, chunked ground rendering
(function () {
const VP = window.VP, U = VP.U, Art = VP.Art, T = VP.TILE;
const World = VP.World = {};
const INK = '#1a0d24';
// collision tile ids
const FLOOR = 0, WALL = 1, WATER = 2, FENCE = 3, GAP = 4, DOOR = 5, LASER = 6;
World.TT = { FLOOR, WALL, WATER, FENCE, GAP, DOOR, LASER };
// pass[mode][tile]: mode 0 walker, 1 Morticia, 2 bullet, 3 car
const PASS = [[1, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0], [1, 0, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 0]];
// ground ids
const G_ROAD = 1, G_WALK = 2, G_GRASS = 3, G_SAND = 4, G_PLAZA = 5, G_WOOD = 6, G_LOT = 7, G_WATER = 8, G_ROOF = 9, G_BORDER = 10, G_FLOOR = 11, G_POOL = 12;

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
const MIX = [
  ['bld', 'bld', 'park', 'plaza', 'beach', 'beach', 'lot', 'bld'],
  ['bld', 'bld', 'bld', 'bld', 'plaza', 'lot', 'park', 'plaza'],
  ['bld', 'dock', 'dock', 'plaza', 'park', 'lot', 'bld', 'beach'],
  ['bld', 'dock', 'dock', 'bld', 'lot', 'bld', 'plaza', 'dock'],
  ['pool', 'pool', 'bld', 'park', 'plaza', 'bld', 'lot', 'pool'],
];
const SIGNS = ['PET SHOP', 'SUSHI', 'MIAU BAR', 'DONUTS', 'HOTEL', 'CAFE', 'PIZZA', 'ARCADE', 'MOTEL', 'SURF', 'CLUB 9', 'PEIXARIA', 'TACOS', 'GELATO'];

World.gen = function (cfg) {
  const cols = cfg.cols, rows = cfg.rows, d = cfg.d, rng = U.rng(cfg.seed || 7), pal = PAL[d];
  const W = cols * 14 + 8, H = rows * 14 + 8;
  const grid = new Uint8Array(W * H), gnd = new Uint8Array(W * H), flap = new Uint8Array(W * H);
  const w = {
    W, H, grid, gnd, flap, cols, rows, d, pal, pw: W * T, ph: H * T, RX: [], RY: [], lots: [], blds: [], deco: [], palms: [], lamps: [], glows: [],
    spawn: { stands: [], crates: [], trash: [], parked: [], treats: [], props: [] }, chunks: new Map(), merge: cfg.merge || null,
  };
  const set = (x, y, t, g) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; grid[i] = t; if (g) gnd[i] = g; };
  const borderT = pal.border === 'water' ? WATER : WALL;
  for (let i = 0; i < W * H; i++) { grid[i] = borderT; gnd[i] = G_BORDER; }
  // roads
  for (let i = 0; i <= cols; i++) w.RX.push((2 + i * 14 + 2) * T);
  for (let j = 0; j <= rows; j++) w.RY.push((2 + j * 14 + 2) * T);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const rx = (x - 2) % 14 < 4, ry = (y - 2) % 14 < 4;
    if (rx || ry) set(x, y, FLOOR, G_ROAD); else set(x, y, FLOOR, G_WALK);
  }
  // lots
  const types = {};
  const mix = MIX[d];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let spec = cfg.lots && cfg.lots[c + ',' + r];
    if (!spec) spec = rng.pick(mix);
    if (typeof spec === 'string') spec = { type: spec };
    const tx = 6 + c * 14 + 1, ty = 6 + r * 14 + 1;
    const lot = Object.assign({ c, r, tx, ty, tw: 8, th: 8, cx: (tx + 4) * T, cy: (ty + 4) * T, used: {} }, spec);
    w.lots.push(lot); types[c + ',' + r] = lot;
  }
  w.lot = (c, r) => types[c + ',' + r];
  const M = w.merge;
  const inMerge = l => M && l.c >= M.c && l.c < M.c + M.w && l.r >= M.r && l.r < M.r + M.h;
  for (const lot of w.lots) if (!inMerge(lot)) fillLot(w, lot, rng, set);
  if (M) { // merged arena: one big plaza covering several blocks and the roads between
    const tx = 6 + M.c * 14, ty = 6 + M.r * 14, tw = M.w * 14 - 4, th = M.h * 14 - 4;
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) set(x, y, FLOOR, G_PLAZA);
    w.arena = { tx, ty, tw, th, cx: (tx + tw / 2) * T, cy: (ty + th / 2) * T, x0: tx * T, y0: ty * T, x1: (tx + tw) * T, y1: (ty + th) * T };
    for (const [px, py] of [[tx + 1, ty + 1], [tx + tw - 2, ty + 1], [tx + 1, ty + th - 2], [tx + tw - 2, ty + th - 2]]) w.palms.push({ x: (px + 0.5) * T, y: (py + 0.8) * T, s: 1.1 });
    for (let i = 0; i < 4; i++) w.glows.push({ x: (tx + tw / 2) * T + Math.cos(i * 1.57) * tw * 18, y: (ty + th / 2) * T + Math.sin(i * 1.57) * th * 18, col: pal.neon[i % pal.neon.length], r: 160 });
    for (const l of w.lots) if (inMerge(l)) { l.type = 'arena'; l.merged = true; }
  }
  // street furniture: lamps + palms on sidewalk corners
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (inMerge(w.lot(c, r))) continue;
    const bx = 6 + c * 14, by = 6 + r * 14;
    w.lamps.push({ x: (bx + 0.3) * T, y: (by + 0.6) * T }, { x: (bx + 9.5) * T, y: (by + 9.9) * T });
    if (d !== 3 || rng() < 0.5) w.palms.push({ x: (bx + 9.5) * T, y: (by + 0.7) * T, s: 0.95 }, { x: (bx + 0.4) * T, y: (by + 9.8) * T, s: 0.9 });
    if (rng() < 0.6) w.palms.push({ x: (bx + 5) * T, y: (by + 0.55) * T, s: 0.8 });
  }
  finalize(w);
  return w;
};

function fillLot(w, lot, rng, set) {
  const { tx, ty } = lot, pal = w.pal, sp = w.spawn;
  const px = ix => (tx + ix + 0.5) * T, py = iy => (ty + iy + 0.5) * T;
  const area = (x0, y0, x1, y1, t, g) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(tx + x, ty + y, t, g); };
  const bld = (x0, y0, x1, y1) => {
    area(x0, y0, x1, y1, WALL, G_ROOF);
    const b = { x: (tx + x0) * T, y: (ty + y0) * T, w: (x1 - x0 + 1) * T, h: (y1 - y0 + 1) * T, col: rng.pick(pal.roofs), seed: rng.int(1, 99999), sign: (x1 - x0) >= 3 && rng() < 0.8 ? rng.pick(SIGNS) : null, neon: rng.pick(pal.neon) };
    w.blds.push(b);
    if (b.sign) w.glows.push({ x: b.x + b.w / 2, y: b.y + b.h - 6, col: b.neon, r: 110 });
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
      if (type === 'house') area(3, 3, 4, 3, WALL, G_GRASS);
    }
  } else if (type === 'plaza' || type === 'arena') {
    area(0, 0, 7, 7, FLOOR, G_PLAZA);
    if (type === 'plaza') {
      const kinds = ['hotdog', 'sushi', 'donut'];
      const spots = rng.shuffle([[1, 1], [6, 1], [1, 6], [6, 6], [3.5, 3.5]]);
      const n = lot.stands === undefined ? rng.int(2, 3) : lot.stands;
      for (let i = 0; i < n; i++) sp.stands.push({ x: px(spots[i][0]), y: py(spots[i][1]), kind: rng.pick(kinds), lot });
      for (const [a, b] of [[0, 3.5], [7, 3.5]]) { set(tx + a, ty + 3, WALL, G_PLAZA); w.deco.push({ k: 'planter', x: px(a), y: py(3), col: rng.pick(pal.neon) }); void b; }
      w.glows.push({ x: px(3.5), y: py(3.5), col: rng.pick(pal.neon), r: 170 });
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
    w.glows.push({ x: px(3.5), y: py(5), col: '#2de2e6', r: 150 });
    sp.treats.push({ x: px(1), y: py(6.5) }, { x: px(6.5), y: py(6) }); sp.stands.push({ x: px(3.5), y: py(7), kind: 'sushi', lot, free: true });
  } else if (type === 'comp') {
    area(0, 0, 7, 7, FLOOR, G_FLOOR);
    for (let i = 0; i < 8; i++) { set(tx + i, ty, FENCE); set(tx + i, ty + 7, FENCE); set(tx, ty + i, FENCE); set(tx + 7, ty + i, FENCE); }
    const side = lot.side || 's', hor = side === 's' || side === 'n';
    const gt = side === 's' ? [[3, 7], [4, 7]] : side === 'n' ? [[3, 0], [4, 0]] : side === 'w' ? [[0, 3], [0, 4]] : [[7, 3], [7, 4]];
    const tiles = gt.map(([a, b]) => [tx + a, ty + b]);
    const gx = (px(gt[0][0]) + px(gt[1][0])) / 2, gy = (py(gt[0][1]) + py(gt[1][1])) / 2;
    const out = { s: [0, 1], n: [0, -1], w: [-1, 0], e: [1, 0] }[side];
    lot.gateX = gx; lot.gateY = gy; lot.frontX = gx + out[0] * T * 1.6; lot.frontY = gy + out[1] * T * 1.6;
    const gate = lot.gate || 'open', P = sp.props;
    const gp = { tiles, x: gx, y: gy, w: hor ? 96 : 20, h: hor ? 20 : 96, lot };
    for (const [a, b] of tiles) set(a, b, gate === 'open' ? FLOOR : gate === 'switch' ? LASER : DOOR);
    if (gate === 'fence') P.push(Object.assign({ k: 'fgate', hp: 4 }, gp));
    if (gate === 'switch') { P.push(Object.assign({ k: 'laser', id: 'g' + lot.c + lot.r }, gp)); const s = side === 's' ? [1, 1] : side === 'n' ? [6, 6] : side === 'w' ? [6, 1] : [1, 6]; P.push({ k: 'switch', x: px(s[0]), y: py(s[1]) + 8, link: 'g' + lot.c + lot.r, lot }); }
    if (gate === 'gap') {
      P.push(Object.assign({ k: 'sdoor', id: 'g' + lot.c + lot.r }, gp));
      const g = hor ? [0, 5] : [5, 0]; set(tx + g[0], ty + g[1], GAP); w.flap[(ty + g[1]) * w.W + tx + g[0]] = 1;
      lot.gapX = px(g[0]) + (hor ? -T : 0); lot.gapY = py(g[1]) + (hor ? 0 : -T);
      const lv = hor ? [6, side === 's' ? 1 : 6] : [side === 'w' ? 6 : 1, 6];
      P.push({ k: 'lever', x: px(lv[0]), y: py(lv[1]), link: 'g' + lot.c + lot.r, lot });
    }
    if (gate === 'key') P.push(Object.assign({ k: 'sdoor', key: true, id: 'g' + lot.c + lot.r }, gp));
    if (lot.vault) {
      for (let i = 2; i <= 5; i++) { set(tx + i, ty + 2, WALL); set(tx + i, ty + 5, WALL); set(tx + 2, ty + i, WALL); set(tx + 5, ty + i, WALL); }
      // cat flap (starts sealed by a laser), switch in a fenced nook
      const fx = tx + 2, fy = ty + 4; w.flap[fy * w.W + fx] = 1;
      P.push({ k: 'vlaser', id: 'v' + lot.c + lot.r, tiles: [[fx, fy]], x: (fx + 0.5) * T - 26, y: (fy + 0.5) * T, w: 10, h: 44, lot });
      set(tx + 5, ty + 1, FENCE); set(tx + 6, ty + 2, FENCE);
      P.push({ k: 'switch', x: px(6), y: py(1) + 8, link: 'v' + lot.c + lot.r, lot });
      P.push({ k: 'loot', x: (tx + 4) * T, y: (ty + 4) * T, lot });
    }
    w.glows.push({ x: gx, y: gy, col: '#ff4f5e', r: 90 });
  }
  void lot.used;
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
    const x0 = lot.merged ? w.arena.tx + 2 : lot.tx, y0 = lot.merged ? w.arena.ty + 2 : lot.ty, tw = lot.merged ? w.arena.tw - 4 : 8, th = lot.merged ? w.arena.th - 4 : 8;
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
  // minimap
  const mm = document.createElement('canvas'); mm.width = W * 3; mm.height = H * 3;
  const m = mm.getContext('2d'), pal = w.pal;
  w.mini = mm;
  w.redrawMini = () => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, g = w.gnd[i], t = grid[i];
      m.fillStyle = g === G_BORDER ? (pal.border === 'water' ? '#17406b' : '#0d0716') : g === G_ROAD ? '#5a5375' : g === G_ROOF || t === WALL ? '#1d1530' : t === WATER ? '#2a7fb8' : t === FENCE || t === DOOR || t === LASER || t === GAP ? '#ff4fb8' : g === G_GRASS ? '#3f8f5f' : g === G_SAND ? '#d9b87c' : '#8a7fa8';
      m.fillRect(x * 3, y * 3, 3, 3);
    }
  };
  w.redrawMini();
}

// ---------- rendering ----------
const patterns = {};
function pat(ctx, key, base, speck, n, size) {
  const k = key + base + speck;
  if (patterns[k]) return patterns[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  const r = U.rng(key.length * 77 + 5);
  g.fillStyle = speck;
  for (let i = 0; i < n; i++) { const s = size || 2; g.globalAlpha = r.range(0.3, 0.9); g.fillRect(r.int(0, 62), r.int(0, 62), r.int(1, s), r.int(1, s)); }
  patterns[k] = ctx.createPattern(cv, 'repeat'); return patterns[k];
}
const CH = 384; // chunk size in world px
function drawChunk(w, cx, cy, rf) {
  const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(CH * rf);
  const c = cv.getContext('2d'); c.scale(rf, rf); c.translate(-cx * CH, -cy * CH);
  const pal = w.pal, { W, H, grid, gnd } = w;
  const x0 = Math.floor(cx * CH / T) - 1, y0 = Math.floor(cy * CH / T) - 1, x1 = Math.ceil((cx + 1) * CH / T) + 1, y1 = Math.ceil((cy + 1) * CH / T) + 1;
  const G = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? G_BORDER : gnd[y * W + x];
  const fills = {
    [G_ROAD]: pat(c, 'road', pal.road, 'rgba(255,255,255,.07)', 60, 2), [G_WALK]: pat(c, 'walk', pal.walk, pal.walk2, 26, 3),
    [G_GRASS]: pat(c, 'grass', pal.grass, pal.grass2, 90, 3), [G_SAND]: pat(c, 'sand', pal.sand, pal.sand2, 70, 2),
    [G_PLAZA]: pal.plaza, [G_WOOD]: pal.wood, [G_LOT]: pat(c, 'lot', pal.lot, 'rgba(255,255,255,.06)', 50, 2), [G_WATER]: pal.water, [G_POOL]: '#2de2e6',
    [G_BORDER]: pal.border === 'water' ? pal.water : '#0d0716', [G_FLOOR]: pat(c, 'floor', pal.floor, 'rgba(0,0,0,.12)', 40, 3), [G_ROOF]: '#000',
  };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const g = G(x, y), px = x * T, py = y * T;
    c.fillStyle = fills[g]; c.fillRect(px, py, T + 0.5, T + 0.5);
    if (g === G_WALK) { // paving joints + curb where it meets the road
      c.strokeStyle = 'rgba(0,0,0,.1)'; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, T / 2, T / 2); c.strokeRect(px + T / 2 + 0.5, py + T / 2 + 0.5, T / 2, T / 2);
      c.fillStyle = 'rgba(255,255,255,.35)';
      if (G(x - 1, y) === G_ROAD) c.fillRect(px, py, 4, T); if (G(x + 1, y) === G_ROAD) c.fillRect(px + T - 4, py, 4, T);
      if (G(x, y - 1) === G_ROAD) c.fillRect(px, py, T, 4); if (G(x, y + 1) === G_ROAD) c.fillRect(px, py + T - 4, T, 4);
    } else if (g === G_PLAZA) {
      c.fillStyle = pal.plaza2; if ((x + y) % 2) c.fillRect(px, py, T, T);
      c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, T, T);
    } else if (g === G_WOOD) {
      c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(px, py + i * 16 + 0.5); c.lineTo(px + T, py + i * 16 + 0.5); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(px + (x * 7 % 3) * 14 + 6, py + 6, 2, 2); c.fillRect(px + (y * 5 % 3) * 14 + 8, py + 38, 2, 2);
    } else if (g === G_WATER || g === G_POOL || (g === G_BORDER && pal.border === 'water')) {
      // shoreline foam
      c.fillStyle = g === G_POOL ? '#fff' : 'rgba(255,255,255,.55)';
      const land = (a, b) => { const q = G(a, b); return q !== G_WATER && q !== G_POOL && q !== G_BORDER; };
      if (land(x - 1, y)) c.fillRect(px, py, 5, T); if (land(x + 1, y)) c.fillRect(px + T - 5, py, 5, T);
      if (land(x, y - 1)) c.fillRect(px, py, T, 5); if (land(x, y + 1)) c.fillRect(px, py + T - 5, T, 5);
    }
  }
  // road markings
  c.fillStyle = pal.line;
  for (const rx of w.RX) { if (rx < cx * CH - 100 || rx > (cx + 1) * CH + 100) continue; for (let y = Math.floor(cy * CH / 48) * 48 - 48; y < (cy + 1) * CH + 48; y += 48) { if (G(Math.floor(rx / T) - 3, Math.floor((y + 12) / T)) === G_ROAD || G(Math.floor(rx / T), Math.floor((y + 12) / T)) !== G_ROAD) continue; c.globalAlpha = 0.75; c.fillRect(rx - 2, y + 10, 4, 26); } }
  for (const ry of w.RY) { if (ry < cy * CH - 100 || ry > (cy + 1) * CH + 100) continue; for (let x = Math.floor(cx * CH / 48) * 48 - 48; x < (cx + 1) * CH + 48; x += 48) { if (G(Math.floor((x + 12) / T), Math.floor(ry / T) - 3) === G_ROAD || G(Math.floor((x + 12) / T), Math.floor(ry / T)) !== G_ROAD) continue; c.globalAlpha = 0.75; c.fillRect(x + 10, ry - 2, 26, 4); } }
  // crosswalks at each block corner approach
  c.globalAlpha = 0.5; c.fillStyle = '#fff';
  for (const rx of w.RX) for (const ry of w.RY) {
    if (Math.abs(rx - (cx + 0.5) * CH) > CH || Math.abs(ry - (cy + 0.5) * CH) > CH) continue;
    if (G(Math.floor(rx / T), Math.floor(ry / T)) !== G_ROAD) continue;
    for (let i = 0; i < 6; i++) {
      if (G(Math.floor(rx / T), Math.floor(ry / T) - 3) === G_ROAD) c.fillRect(rx - 90 + i * 32, ry - 2 * T - 26, 16, 22);
      if (G(Math.floor(rx / T), Math.floor(ry / T) + 3) === G_ROAD) c.fillRect(rx - 90 + i * 32, ry + 2 * T + 4, 16, 22);
      if (G(Math.floor(rx / T) - 3, Math.floor(ry / T)) === G_ROAD) c.fillRect(rx - 2 * T - 26, ry - 90 + i * 32, 22, 16);
      if (G(Math.floor(rx / T) + 3, Math.floor(ry / T)) === G_ROAD) c.fillRect(rx + 2 * T + 4, ry - 90 + i * 32, 22, 16);
    }
  }
  c.globalAlpha = 1;
  const near = (o, pad) => o.x + (o.w || 0) + pad > cx * CH && o.x - pad < (cx + 1) * CH && o.y + (o.h || 0) + pad > cy * CH && o.y - pad < (cy + 1) * CH;
  // flat decor
  for (const d of w.deco) {
    if (!near(d, 120)) continue;
    if (d.k === 'parklines') { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(d.x + i * 96, d.y + 4); c.lineTo(d.x + i * 96, d.y + 100); c.stroke(); } }
    else if (d.k === 'flower') { for (let i = 0; i < 5; i++) Art.ell(c, d.x + Math.cos(i * 1.26) * 4, d.y + Math.sin(i * 1.26) * 4, 3, 3, d.col); Art.ell(c, d.x, d.y, 2.5, 2.5, '#fff3a8'); }
  }
  // fences + compound walls
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x, t = grid[i], px = x * T, py = y * T, isF = (a, b) => { const q = grid[b * W + a]; return q === FENCE || q === GAP || q === DOOR || q === LASER; };
    if (t === WALL && gnd[i] === G_FLOOR || (w.flap[i] && gnd[i] === G_FLOOR && t !== FENCE && grid[i] !== FENCE && !isFenceRing(w, x, y))) {
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(px + 5, py + 6, T, T);
      Art.box(c, px, py - 8, T, T + 8, 3, '#7c8799', INK, 2); c.fillStyle = '#9aa5b8'; c.fillRect(px + 3, py - 5, T - 6, T - 18); c.fillStyle = '#5d6777'; c.fillRect(px + 2, py + T - 14, T - 4, 12);
      if (w.flap[i]) { Art.box(c, px - 4, py + 12, 12, 24, 5, '#17101c', INK, 2); Art.icon(c, 'paw', px + 10, py + 6, 6); }
    } else if (t === FENCE || (t === GAP && isFenceRing(w, x, y))) {
      const hor = isF(x - 1, y) || isF(x + 1, y), ver = isF(x, y - 1) || isF(x, y + 1);
      c.lineCap = 'butt';
      const seg = (ax, ay, bx, by) => { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 5; c.beginPath(); c.moveTo(ax + 4, ay + 6); c.lineTo(bx + 4, by + 6); c.stroke(); for (const off of [-16, -6]) { c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(ax, ay + off); c.lineTo(bx, by + off); c.stroke(); c.strokeStyle = '#c0c7d1'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(ax, ay + off); c.lineTo(bx, by + off); c.stroke(); } };
      if (t === GAP) { // cat flap in the fence
        Art.box(c, px + 4, py - 14, T - 8, 40, 4, '#7c8799', INK, 2); Art.box(c, px + 14, py + 2, 20, 24, 8, '#17101c', INK, 2); Art.icon(c, 'paw', px + 24, py - 5, 6);
      } else {
        if (hor) seg(px, py + T / 2, px + T, py + T / 2);
        if (ver) seg(px + T / 2, py, px + T / 2, py + T);
      }
      Art.box(c, px + T / 2 - 4, py + T / 2 - 26, 8, 30, 2, '#8a90ad', INK, 1.8);
    }
  }
  // buildings
  for (const b of w.blds) {
    if (!near(b, 40)) continue;
    const r = U.rng(b.seed), fh = 34;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(b.x + 10, b.y + 12, b.w, b.h);
    // facade (south wall)
    Art.box(c, b.x, b.y + b.h - fh - 4, b.w, fh + 4, 3, pal.wall, INK, 2.4);
    for (let wx = b.x + 12; wx < b.x + b.w - 22; wx += 26) {
      const lit = r() < 0.6; c.fillStyle = lit ? (pal.dark ? '#ffe9a8' : '#bff4ff') : (pal.dark ? '#2a2145' : '#7fb4d9');
      c.fillRect(wx, b.y + b.h - fh + 4, 14, 14); c.strokeStyle = INK; c.lineWidth = 1.4; c.strokeRect(wx, b.y + b.h - fh + 4, 14, 14);
    }
    c.fillStyle = b.neon; c.fillRect(b.x + 2, b.y + b.h - 7, b.w - 4, 3);
    // roof
    Art.box(c, b.x, b.y - 6, b.w, b.h - fh + 4, 5, b.col, INK, 2.4);
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 3; Art.rr(c, b.x + 6, b.y, b.w - 12, b.h - fh - 8, 3); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(b.x + 8, b.y + (b.h - fh) * 0.5, b.w - 16, (b.h - fh) * 0.5 - 8);
    const rw = b.w - 30, rh = b.h - fh - 34;
    if (rh > 30 && rw > 60) {
      const n = r.int(1, 3);
      for (let i = 0; i < n; i++) {
        const ax = b.x + 14 + r() * (rw - 40), ay = b.y + 6 + r() * (rh - 20), k = r.int(0, 3);
        if (k === 0) { Art.box(c, ax, ay, 30, 22, 3, '#c0c7d1', INK, 1.8); Art.ell(c, ax + 15, ay + 11, 7, 7, '#8a90ad', INK, 1.4); }
        else if (k === 1) { Art.box(c, ax, ay, 40, 26, 4, '#2de2e6', INK, 1.8); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(ax + 5, ay + 5, 12, 3); }
        else if (k === 2) { Art.ell(c, ax + 18, ay + 14, 17, 17, 'rgba(0,0,0,.12)', '#fff', 2.5); c.fillStyle = '#fff'; c.font = '900 18px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', ax + 18, ay + 15); }
        else { Art.box(c, ax, ay, 24, 24, 3, pal.wall, INK, 1.8); Art.box(c, ax + 5, ay + 5, 14, 14, 2, '#17101c'); }
      }
    }
    if (b.sign) {
      c.font = '900 italic 15px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(b.sign).width + 16, sx = b.x + b.w / 2, sy = b.y + b.h - fh - 6;
      Art.box(c, sx - tw / 2, sy - 11, tw, 21, 5, '#17101c', INK, 2);
      c.save(); c.shadowColor = b.neon; c.shadowBlur = 8; c.fillStyle = b.neon; c.fillText(b.sign, sx, sy); c.restore();
    }
  }
  // solid decor
  for (const d of w.deco) {
    if (!near(d, 120)) continue;
    if (d.k === 'fountain') { Art.ell(c, d.x + 4, d.y + 8, 46, 42, 'rgba(0,0,0,.25)'); Art.ell(c, d.x, d.y, 44, 40, '#c5ccd9', INK, 2.4); Art.ell(c, d.x, d.y, 34, 30, '#2de2e6', INK, 2); Art.ell(c, d.x, d.y, 10, 9, '#c5ccd9', INK, 2); Art.ell(c, d.x - 14, d.y - 8, 6, 3, 'rgba(255,255,255,.7)'); }
    else if (d.k === 'bench') { Art.box(c, d.x - 8, d.y - 22, 16, 44, 3, '#c98f4b', INK, 2); c.fillStyle = '#8a5a2b'; c.fillRect(d.x - 1, d.y - 20, 2, 40); }
    else if (d.k === 'planter') { Art.box(c, d.x - 20, d.y - 20, 40, 40, 6, '#8a90ad', INK, 2.2); Art.ell(c, d.x, d.y - 4, 15, 13, '#2fae7a', INK, 1.8); for (let i = 0; i < 4; i++) Art.ell(c, d.x - 8 + i * 5, d.y - 8 + (i % 2) * 6, 3, 3, d.col); }
    else if (d.k === 'umbrella') Art.umbrella(c, d.x, d.y, d.col);
    else if (d.k === 'container') { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(d.x + 8, d.y + 10, d.w, d.h); Art.box(c, d.x + 2, d.y - 10, d.w - 4, d.h + 6, 3, d.col, INK, 2.4); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 2; const hor = d.w > d.h; for (let i = 10; i < (hor ? d.w : d.h) - 6; i += 10) { c.beginPath(); if (hor) { c.moveTo(d.x + i, d.y - 6); c.lineTo(d.x + i, d.y + d.h - 8); } else { c.moveTo(d.x + 6, d.y - 8 + i); c.lineTo(d.x + d.w - 6, d.y - 8 + i); } c.stroke(); } }
  }
  return cv;
}
function isFenceRing(w, x, y) { // a gap tile that belongs to a compound's outer fence (vs. a vault wall)
  const g = (a, b) => w.grid[b * w.W + a];
  return (g(x - 1, y) === FENCE && g(x + 1, y) === FENCE) || (g(x, y - 1) === FENCE && g(x, y + 1) === FENCE) || g(x, y - 1) === FENCE || g(x, y + 1) === FENCE || g(x - 1, y) === FENCE || g(x + 1, y) === FENCE;
}

World.draw = function (w, c, vx, vy, vw, vh, rf) {
  if (w.rf !== rf) { w.chunks.clear(); w.rf = rf; }
  const cx0 = Math.floor(vx / CH), cy0 = Math.floor(vy / CH), cx1 = Math.floor((vx + vw) / CH), cy1 = Math.floor((vy + vh) / CH);
  let made = 0;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const k = cx + ',' + cy; let ch = w.chunks.get(k);
    if (!ch) {
      if (made >= 2 && w.chunks.size > 0) { c.fillStyle = w.pal.road; c.fillRect(cx * CH, cy * CH, CH, CH); continue; }
      ch = drawChunk(w, cx, cy, rf); w.chunks.set(k, ch); made++;
      if (w.chunks.size > 30) { const first = w.chunks.keys().next().value; const cv = w.chunks.get(first); cv.width = cv.height = 0; w.chunks.delete(first); }
    } else { w.chunks.delete(k); w.chunks.set(k, ch); } // LRU touch
    c.drawImage(ch, cx * CH, cy * CH, CH, CH);
  }
  // animated water sparkle
  const t = performance.now() / 1000, W = w.W, H = w.H;
  const tx0 = Math.max(0, Math.floor(vx / T)), ty0 = Math.max(0, Math.floor(vy / T)), tx1 = Math.min(W - 1, Math.floor((vx + vw) / T)), ty1 = Math.min(H - 1, Math.floor((vy + vh) / T));
  c.strokeStyle = w.pal.water2; c.lineWidth = 2; c.lineCap = 'round'; c.globalAlpha = 0.6; c.beginPath();
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const g = w.gnd[y * W + x];
    if ((g === G_WATER || g === G_POOL || (g === G_BORDER && w.pal.border === 'water')) && (x * 3 + y * 5) % 3 === 0) {
      const ox = Math.sin(t * 1.2 + x * 1.7 + y) * 8, px = x * T + 14 + ox, py = y * T + 18 + (x % 2) * 14;
      c.moveTo(px, py); c.quadraticCurveTo(px + 8, py - 5, px + 16, py);
    }
  }
  c.stroke(); c.globalAlpha = 1;
};
World.prewarm = function (w, x, y, vw, vh, rf) {
  w.rf = rf;
  const cx0 = Math.floor((x - vw / 2) / CH), cy0 = Math.floor((y - vh / 2) / CH), cx1 = Math.floor((x + vw / 2) / CH), cy1 = Math.floor((y + vh / 2) / CH);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { const k = cx + ',' + cy; if (!w.chunks.has(k)) w.chunks.set(k, drawChunk(w, cx, cy, rf)); }
};
})();
