// VICE PAWS — static 3D city built once from the tile world: ground, buildings, neon, palms, lamps, water, sky
import { THREE, GB, MAT, PR } from './models.js';

const S = 1 / 24, TL = 2; // world px -> units; tile size in units
export const LAND_H = 0.14;
const _c = new THREE.Color();
const lin = hex => { _c.set(hex); return [_c.r, _c.g, _c.b]; };
function canvasTex(w, h, draw, opts) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; Object.assign(t, opts || {}); return t;
}
// moods: sky top / horizon, fog, hemisphere sky+ground, sun colour+intensity, night (0..1: window + glow strength), water
export const MOODS = [
  { top: '#3b1d6e', hor: '#ff8a5c', sunC: '#ffd07a', fog: '#f08a78', hs: '#ffc9a8', hg: '#7a4a78', sun: 1.25, night: 0.45, water: '#ff8fa8', fogN: 60, fogF: 300 },   // Sunset Beach
  { top: '#0b0524', hor: '#7a2a9a', sunC: '#ff7ad9', fog: '#3a1560', hs: '#9a7aff', hg: '#2a1048', sun: 0.5, night: 1, water: '#1b2f6b', fogN: 40, fogF: 240 },      // Neon Downtown
  { top: '#2a7fd0', hor: '#ffe0b0', sunC: '#fff3c8', fog: '#bfe6f0', hs: '#ffffff', hg: '#6fae9a', sun: 1.5, night: 0.12, water: '#27c4d6', fogN: 80, fogF: 340 },   // Palm Harbor
  { top: '#10161f', hor: '#34465c', sunC: '#8fa3b8', fog: '#2c3a4c', hs: '#8fa3c8', hg: '#1c2430', sun: 0.45, night: 0.85, water: '#1c3550', fogN: 25, fogF: 170 },   // Storm Docks
  { top: '#1a0638', hor: '#ff4fb8', sunC: '#ff9fe0', fog: '#8a2a8a', hs: '#ffa8f0', hg: '#3a1458', sun: 0.8, night: 0.9, water: '#2de2e6', fogN: 50, fogF: 280 },     // Vice Heights
  { top: '#6a3a9a', hor: '#ffd27a', sunC: '#fff0b0', fog: '#ffc98a', hs: '#fff0c8', hg: '#8a6a4a', sun: 1.5, night: 0.3, water: '#39d0c8', fogN: 80, fogF: 340 },     // Marina Dourada (VIP, golden hour)
  { top: '#06122e', hor: '#2a5a8a', sunC: '#dff3ff', fog: '#24406a', hs: '#bfe0ff', hg: '#20304a', sun: 0.6, night: 1, water: '#1b3a6b', fogN: 35, fogF: 220 },      // Natal Neon (snow)
];

export function buildCity(W, scene, VP) {
  const World = VP.World, GT = World.GT, TT = World.TT, PAL = World.PAL, { W: TW, H: TH, grid, gnd } = W;
  const dOf = (tx, ty) => World.distAt(W, (tx + 0.5) * 48, (ty + 0.5) * 48);
  const city = { glowPts: [], animated: [] };
  const rng = VP.U.rng(4711);

  // ---------- ground ----------
  {
    const P = [], N = [], C = [];
    const quad = (x0, z0, x1, z1, y, c) => { P.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1); for (let i = 0; i < 6; i++) { N.push(0, 1, 0); C.push(c[0], c[1], c[2]); } };
    const wallq = (x0, z0, x1, z1, y0, y1, c, nx, nz) => { P.push(x0, y1, z0, x0, y0, z0, x1, y1, z1, x1, y1, z1, x0, y0, z0, x1, y0, z1); for (let i = 0; i < 6; i++) { N.push(nx, 0.4, nz); C.push(c[0], c[1], c[2]); } };
    const cache = {}; const colOf = (d, k, shade) => { const key = d + k + shade; if (!cache[key]) { const c = lin(PAL[d][k]); cache[key] = [c[0] * shade, c[1] * shade, c[2] * shade]; } return cache[key]; };
    const G = (x, y) => x < 0 || y < 0 || x >= TW || y >= TH ? GT.G_BORDER : gnd[y * TW + x];
    const isWater = g => g === GT.G_WATER || g === GT.G_BORDER || g === GT.G_POOL;
    const KEY = { [GT.G_ROAD]: 'road', [GT.G_WALK]: 'walk', [GT.G_GRASS]: 'grass', [GT.G_SAND]: 'sand', [GT.G_PLAZA]: 'plaza', [GT.G_WOOD]: 'wood', [GT.G_LOT]: 'lot', [GT.G_FLOOR]: 'floor', [GT.G_ROOF]: 'lot' };
    const curb = lin('#e9e2f0'), wallc = lin('#6a5a78'), poolc = lin('#5ff0f0');
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const g = gnd[y * TW + x], d = dOf(x, y), x0 = x * TL, z0 = y * TL, x1 = x0 + TL, z1 = z0 + TL;
      if (g === GT.G_POOL) { quad(x0, z0, x1, z1, -0.12, poolc); continue; }
      if (isWater(g)) continue;
      const road = g === GT.G_ROAD, h = road ? 0 : LAND_H;
      let shade = 0.94 + ((x * 7 + y * 13) % 5) * 0.03;
      let k = KEY[g] || 'walk';
      if (g === GT.G_PLAZA && (x + y) % 2) k = 'plaza2'; if (g === GT.G_WALK && (x + y) % 2) shade *= 0.95; if (g === GT.G_GRASS && (x * 3 + y) % 4 === 0) k = 'grass2'; if (g === GT.G_SAND && (x + y * 3) % 5 === 0) k = 'sand2';
      quad(x0, z0, x1, z1, h, colOf(d, k, shade));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ng = G(x + dx, y + dy), nw = isWater(ng), nroad = ng === GT.G_ROAD;
        if (!nw && !(nroad && !road)) continue;
        const y0 = nw ? (ng === GT.G_POOL ? -0.12 : -0.7) : 0, c = nw ? wallc : curb;
        if (dx === 1) wallq(x1, z1, x1, z0, y0, h, c, 1, 0); else if (dx === -1) wallq(x0, z0, x0, z1, y0, h, c, -1, 0);
        else if (dy === 1) wallq(x0, z1, x1, z1, y0, h, c, 0, 1); else wallq(x1, z0, x0, z0, y0, h, c, 0, -1);
      }
    }
    // road markings
    const isRoad = (px, py) => G(Math.floor(px / 48), Math.floor(py / 48)) === GT.G_ROAD;
    const mark = (px0, py0, px1, py1, c) => quad(px0 * S, py0 * S, px1 * S, py1 * S, 0.035, c);
    for (let i = 0; i < W.RX.length; i++) for (let j = 0; j < W.RY.length; j++) {
      const rx = W.RX[i], ry = W.RY[j], d = World.distAt(W, rx + 100, ry + 100), lc = colOf(d, 'line', 1), wc = lin('#f4f0ff');
      if (j < W.RY.length - 1) for (let y = ry + 96 + 40; y < W.RY[j + 1] - 96 - 30; y += 72) mark(rx - 3, y, rx + 3, y + 36, lc);
      if (i < W.RX.length - 1) for (let x = rx + 96 + 40; x < W.RX[i + 1] - 96 - 30; x += 72) mark(x, ry - 3, x + 36, ry + 3, lc);
      for (let k = 0; k < 6; k++) {
        const o = -84 + k * 30;
        if (isRoad(rx, ry - 150)) mark(rx + o, ry - 96 - 30, rx + o + 14, ry - 96 - 6, wc);
        if (isRoad(rx - 150, ry)) mark(rx - 96 - 30, ry + o, rx - 96 - 6, ry + o + 14, wc);
      }
    }
    for (const d of W.deco) if (d.k === 'parklines') for (let i = 0; i <= 4; i++) quad((d.x + i * 96 - 2) * S, (d.y + 4) * S, (d.x + i * 96 + 2) * S, (d.y + 100) * S, LAND_H + 0.02, lin('#ffffff'));
    // arena emblems (mission spots)
    for (const l of W.lots) if (l.type === 'arena') { const c = lin(l.pal.neon[0]); const cx = l.cx * S, cz = l.cy * S; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; quad(cx + Math.cos(a) * 5 - 0.6, cz + Math.sin(a) * 5 - 0.6, cx + Math.cos(a) * 5 + 0.6, cz + Math.sin(a) * 5 + 0.6, LAND_H + 0.02, c); } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const m = new THREE.Mesh(g, MAT.lit); m.frustumCulled = false; scene.add(m); city.ground = m;
  }

  // ---------- buildings (one merged mesh, window texture + emissive map) ----------
  {
    const winTex = canvasTex(128, 128, (c) => { c.fillStyle = '#e8e2f0'; c.fillRect(0, 0, 128, 128); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = '#39406a'; c.fillRect(x * 32 + 8, y * 32 + 7, 17, 19); c.fillStyle = '#5a64a0'; c.fillRect(x * 32 + 8, y * 32 + 7, 17, 4); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x * 32, y * 32 + 30, 32, 2); } }, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
    const emTex = canvasTex(128, 128, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128); const r = VP.U.rng(31); const cols = ['#ffe9a8', '#ffe9a8', '#ffd27a', '#ff9fe0', '#8ff3ff', '#fff']; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (r() < 0.56) { c.fillStyle = r.pick(cols); c.fillRect(x * 32 + 9, y * 32 + 8, 15, 17); } }, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
    const P = [], N = [], C = [], UV = [];
    const neon = new GB();
    const face = (ax, az, bx, bz, y0, y1, nx, nz, c, uo) => {
      const len = Math.hypot(bx - ax, bz - az), u1 = Math.max(1, Math.round(len / 1.25)) / 4, v1 = Math.max(1, Math.round((y1 - y0) / 1.5)) / 4;
      P.push(ax, y1, az, ax, y0, az, bx, y1, bz, bx, y1, bz, ax, y0, az, bx, y0, bz);
      UV.push(uo, v1, uo, 0, uo + u1, v1, uo + u1, v1, uo, 0, uo + u1, 0);
      for (let i = 0; i < 6; i++) { N.push(nx, 0, nz); C.push(c[0], c[1], c[2]); }
    };
    const top = (x0, z0, x1, z1, y, c) => { P.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1); for (let i = 0; i < 6; i++) { N.push(0, 1, 0); C.push(c[0], c[1], c[2]); UV.push(0.004, 0.004); } };
    const signs = [];
    for (const b of W.blds) {
      const r = VP.U.rng(b.seed), x0 = b.x * S + 0.15, z0 = b.y * S + 0.15, x1 = (b.x + b.w) * S - 0.15, z1 = (b.y + b.h) * S - 0.15, H = b.ht * TL;
      b.H = H;
      _c.set(b.col); if (b.d === 1 || b.d === 3) _c.multiplyScalar(1.5).lerp(new THREE.Color('#8a7ab8'), 0.25); else _c.lerp(new THREE.Color('#ffffff'), 0.25);
      const wc = [_c.r, _c.g, _c.b], rc = [_c.r * 0.45, _c.g * 0.45, _c.b * 0.5], uo = Math.floor(r() * 4) / 4;
      const tiers = H > 14 && r() < 0.6 ? 2 : 1, h1 = tiers === 2 ? H * r.range(0.55, 0.75) : H;
      const tier = (ax0, az0, ax1, az1, y0, y1) => { face(ax0, az1, ax1, az1, y0, y1, 0, 1, wc, uo); face(ax1, az1, ax1, az0, y0, y1, 1, 0, wc, uo); face(ax1, az0, ax0, az0, y0, y1, 0, -1, wc, uo); face(ax0, az0, ax0, az1, y0, y1, -1, 0, wc, uo); top(ax0, az0, ax1, az1, y1, rc); };
      tier(x0, z0, x1, z1, LAND_H, h1);
      const nc = b.neon, t = 0.14;
      const trim = (ax0, az0, ax1, az1, y) => { neon.box(nc, (ax0 + ax1) / 2, y, az1, ax1 - ax0 + t, t, t); neon.box(nc, (ax0 + ax1) / 2, y, az0, ax1 - ax0 + t, t, t); neon.box(nc, ax0, y, (az0 + az1) / 2, t, t, az1 - az0); neon.box(nc, ax1, y, (az0 + az1) / 2, t, t, az1 - az0); };
      if (r() < 0.8) trim(x0, z0, x1, z1, h1 + 0.02);
      if (tiers === 2) { const ins = Math.min(x1 - x0, z1 - z0) * 0.18; tier(x0 + ins, z0 + ins, x1 - ins, z1 - ins, h1, H); trim(x0 + ins, z0 + ins, x1 - ins, z1 - ins, H + 0.02); if (r() < 0.6) { neon.box(nc, (x0 + x1) / 2, H + 2.2, (z0 + z1) / 2, 0.12, 4.4, 0.12); city.glowPts.push({ x: (x0 + x1) / 2, y: H + 4.5, z: (z0 + z1) / 2, col: '#ff3355', s: 3 }); } }
      else if (x1 - x0 > 5 && z1 - z0 > 5) { const ax = r.range(x0 + 1.2, x1 - 2.4), az = r.range(z0 + 1.2, z1 - 2.4); tier(ax, az, ax + 1.6, az + 1.2, h1, h1 + 0.9); }
      if (b.d !== 3 && r() < 0.5 && H > 6) for (const cx of [x0, x1]) neon.box(r.pick(PAL[b.d].neon), cx, LAND_H + H / 2, z1, t, H * 0.9, t);
      // ground floor shopfront strip + sign on the south face
      neon.box(nc, (x0 + x1) / 2, 2.25, z1 + 0.04, x1 - x0 - 0.3, 0.08, 0.06);
      if (b.sign) { signs.push({ b, x: (x0 + x1) / 2, y: 3.15, z: z1 + 0.12, col: nc, i: World.SIGNS.indexOf(b.sign) }); city.glowPts.push({ x: (x0 + x1) / 2, y: 3.0, z: z1 + 0.8, col: nc, s: 9 }); }
      // door + awning
      neon.box('#17101c', (x0 + x1) / 2 + r.range(-1, 1), 1.0, z1 + 0.03, 1.1, 1.8, 0.05);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    city.bMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: winTex, emissiveMap: emTex, emissive: 0xffffff, emissiveIntensity: 0.5 });
    const m = new THREE.Mesh(g, city.bMat); m.frustumCulled = false; scene.add(m);
    city.neonGB = neon;
    // sign text atlas
    const NS = World.SIGNS.length, atlas = canvasTex(1024, 512, (c) => { c.clearRect(0, 0, 1024, 512); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 italic 60px system-ui,Arial,sans-serif'; for (let i = 0; i < NS; i++) { const x = (i % 4) * 256 + 128, y = Math.floor(i / 4) * 128 + 64; c.shadowColor = '#fff'; c.shadowBlur = 14; c.fillStyle = '#fff'; c.fillText(World.SIGNS[i], x, y, 240); c.shadowBlur = 0; c.fillText(World.SIGNS[i], x, y, 240); } });
    const SP = [], SU = [], SC = [];
    for (const s of signs) { const w = 2.3, h = 1.15, u0 = (s.i % 4) / 4, v1 = 1 - Math.floor(s.i / 4) / 4, c = lin(s.col); neon.box('#120a1c', s.x, s.y, s.z - 0.06, w * 2 + 0.2, h + 0.1, 0.08); SP.push(s.x - w, s.y + h / 2, s.z, s.x - w, s.y - h / 2, s.z, s.x + w, s.y + h / 2, s.z, s.x + w, s.y + h / 2, s.z, s.x - w, s.y - h / 2, s.z, s.x + w, s.y - h / 2, s.z); SU.push(u0, v1, u0, v1 - 0.25, u0 + 0.25, v1, u0 + 0.25, v1, u0, v1 - 0.25, u0 + 0.25, v1 - 0.25); for (let i = 0; i < 6; i++) SC.push(Math.min(1, c[0] + 0.35), Math.min(1, c[1] + 0.35), Math.min(1, c[2] + 0.35)); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(SU, 2)); sg.setAttribute('color', new THREE.Float32BufferAttribute(SC, 3));
    const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: atlas, transparent: true, vertexColors: true, depthWrite: false, fog: true })); sm.frustumCulled = false; scene.add(sm);
  }

  // ---------- deco (merged) ----------
  {
    const b = new GB(), neon = city.neonGB;
    for (const d of W.deco) {
      const x = d.x * S, z = d.y * S, y = LAND_H;
      if (d.k === 'fountain') { b.cyl('#c5ccd9', x, y + 0.3, z, 1.9, 0.6, 1.9); b.cyl('#2de2e6', x, y + 0.56, z, 1.6, 0.1, 1.6); b.cyl('#c5ccd9', x, y + 0.9, z, 0.3, 1.4, 0.3); b.cyl('#c5ccd9', x, y + 1.6, z, 0.8, 0.14, 0.8); b.sph('#bff4ff', x, y + 1.9, z, 0.36); }
      else if (d.k === 'bench') { b.box('#c98f4b', x, y + 0.45, z, 0.6, 0.1, 1.8); b.box('#c98f4b', x - 0.26, y + 0.8, z, 0.08, 0.6, 1.8); b.box('#3a2140', x, y + 0.22, z - 0.7, 0.5, 0.44, 0.08); b.box('#3a2140', x, y + 0.22, z + 0.7, 0.5, 0.44, 0.08); }
      else if (d.k === 'planter') { b.box('#8a90ad', x, y + 0.4, z, 1.7, 0.8, 1.7); b.lo('#2fae7a', x, y + 1.0, z, 0.8, 0.6, 0.8); for (let i = 0; i < 4; i++) b.lo(d.col, x - 0.4 + i * 0.27, y + 1.4, z - 0.2 + (i % 2) * 0.4, 0.16); }
      else if (d.k === 'umbrella') { b.cyl('#ffffff', x, y + 1.0, z, 0.05, 2.0, 0.05); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; b.add(PR.cone, i % 2 ? d.col : '#ffffff', x + Math.sin(a) * 0.5, y + 1.95, z + Math.cos(a) * 0.5, 0.56, 0.5, 0.56, 0.5, a, 0); } b.box(d.col, x + 0.9, y + 0.12, z + 0.3, 0.7, 0.08, 1.7); }
      else if (d.k === 'container') { const w = d.w * S, h = d.h * S; b.box(d.col, x + w / 2, y + 1.25, z + h / 2, w - 0.1, 2.5, h - 0.1); const hor = w > h; for (let i = 0.4; i < (hor ? w : h) - 0.2; i += 0.5) b.box('#1a0d24', hor ? x + i : x + w / 2, y + 1.25, hor ? z + h / 2 : z + i, hor ? 0.05 : w - 0.04, 2.3, hor ? h - 0.04 : 0.05); }
      else if (d.k === 'flower') { b.lo(d.col, x, y + 0.14, z, 0.16, 0.12, 0.16); }
    }
    // compound fence rings (gate tiles left open; the gate itself is a mission prop)
    for (const l of W.comps) {
      const gate = new Set(l.side === 's' ? ['3,7', '4,7'] : ['0,3', '0,4']);
      for (let i = 0; i < 8; i++) for (const [a, c2] of [[i, 0], [i, 7], [0, i], [7, i]]) {
        if (gate.has(a + ',' + c2)) continue;
        const x = (l.tx + a + 0.5) * TL, z = (l.ty + c2 + 0.5) * TL, hor = c2 === 0 || c2 === 7;
        b.box('#8a90ad', x, LAND_H + 0.8, z, 0.16, 1.6, 0.16);
        if (hor && a < 7 && !gate.has((a + 1) + ',' + c2) || hor && a === 7) for (const yy of [0.5, 1.0, 1.45]) b.box('#c0c7d1', x + (a === 7 ? -0 : 0), LAND_H + yy, z, TL, 0.06, 0.06);
        if (!hor || a === 0 || a === 7) if (c2 > 0 && c2 < 7 || c2 === 0) for (const yy of [0.5, 1.0, 1.45]) if (!hor || c2 === 0) { if (a === 0 || a === 7) b.box('#c0c7d1', x, LAND_H + yy, z + (c2 === 7 ? 0 : 0), 0.06, 0.06, TL); }
      }
      for (const [a, c2] of [[2.5, 7], [5.5, 7]]) { const x = (l.tx + a + 0.5) * TL, z = (l.ty + c2 + 0.5) * TL; b.box('#596080', x, LAND_H + 1.3, z, 0.3, 2.6, 0.3); neon.sph('#ff4f5e', x, LAND_H + 2.75, z, 0.2); }
    }
    // cottages on the "house" lots
    for (const l of W.lots) if (l.type === 'house') {
      const x = (l.tx + 4) * TL, z = (l.ty + 3) * TL, y = LAND_H;
      b.box('#fff1d6', x, y + 1.4, z, 3.7, 2.8, 3.7); b.add(PR.cone, '#ff4fb8', x, y + 3.7, z, 3.3, 1.9, 3.3, 0, Math.PI / 8, 0);
      b.box('#2de2e6', x, y + 0.9, z + 1.87, 0.9, 1.8, 0.06); for (const sx of [-1, 1]) b.box('#bff4ff', x + sx * 1.15, y + 1.6, z + 1.87, 0.8, 0.8, 0.06);
      b.lo('#ffd23f', x, y + 3.3, z + 1.3, 0.3, 0.3, 0.1); b.box('#8a5a2b', x + 1.0, y + 3.8, z - 0.6, 0.5, 1.4, 0.5);
    }
    // yachts moored south of Palm Harbor + a few sails out at sea
    const boat = (x, z, s, col, rot) => { const c = Math.cos(rot), sn = Math.sin(rot), p = (lx, lz) => [x + (lx * c + lz * sn) * s, z + (-lx * sn + lz * c) * s]; let q = p(0, 0); b.box('#ffffff', q[0], -0.1, q[1], 2.6 * s, 1.1 * s, 8 * s, 0, rot, 0); q = p(0, 4.6); b.add(PR.cone, '#ffffff', q[0], -0.1, q[1], 1.3 * s, 2.2 * s, 0.55 * s, Math.PI / 2, rot, 0); q = p(0, -0.6); b.box('#e8f4ff', q[0], 0.95 * s, q[1], 2.0 * s, 1.0 * s, 3.6 * s, 0, rot, 0); b.box(col, q[0], 0.5 * s, q[1], 2.66 * s, 0.14 * s, 8.02 * s, 0, rot, 0); q = p(0, -1); b.box('#bff4ff', q[0], 1.7 * s, q[1], 1.5 * s, 0.6 * s, 2.0 * s, 0, rot, 0); neon.box(col, q[0], 2.05 * s, q[1], 1.6 * s, 0.06, 2.1 * s, 0, rot, 0); };
    const south = TH * TL + 4;
    for (let i = 0; i < 7; i++) boat((62 + 4 * 28 / 4 + i * 13.5) + 30, south + 5 + (i % 2) * 7, 1 + (i % 3) * 0.25, ['#ffd23f', '#ff4fb8', '#2de2e6'][i % 3], Math.PI / 2 + (i % 2 ? 0.2 : -0.15));
    for (let i = 0; i < 8; i++) { const a = rng() * 6.283, R = 260 + rng() * 80, x = TW * TL / 2 + Math.cos(a) * R * 1.3, z = TH * TL / 2 + Math.sin(a) * R; boat(x, z, 1.6, '#ff4fb8', a); }
    // far skyline silhouettes on the horizon
    for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283 + rng() * 0.05, R = 300 + rng() * 60, x = TW * TL / 2 + Math.cos(a) * R * 1.4, z = TH * TL / 2 + Math.sin(a) * R * 1.1, h = 12 + rng() * 46, w = 8 + rng() * 10; b.box('#2a1848', x, h / 2 - 1, z, w, h, w); neon.box(rng.pick(['#ff4fb8', '#2de2e6', '#ffd23f', '#b967ff']), x, h - 1, z, w + 0.2, 0.5, w + 0.2); }
    const m = b.mesh(MAT.flat); m.frustumCulled = false; scene.add(m);
    const nm = neon.mesh(MAT.glow); nm.frustumCulled = false; scene.add(nm); city.neon = nm;
  }

  // ---------- palms + lamps (instanced) ----------
  {
    const pg = new GB();
    let px = 0, py = 0; for (let i = 0; i < 4; i++) { const lean = i * 0.08; pg.add(PR.cyl6, i % 2 ? '#9a6a3b' : '#86592f', px, py + 0.95, 0, 0.22 - i * 0.028, 1.96, 0.22 - i * 0.028, 0, 0, -lean); px += Math.sin(lean) * 1.9; py += Math.cos(lean) * 1.9; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; pg.box(i % 2 ? '#2fae7a' : '#1f8f6a', px + Math.cos(a) * 1.0, py + 0.12, Math.sin(a) * 1.0, 2.0, 0.07, 0.62, 0, -a, -0.3); pg.box(i % 2 ? '#27a070' : '#188060', px + Math.cos(a) * 2.35, py - 0.52, Math.sin(a) * 2.35, 1.2, 0.06, 0.42, 0, -a, -0.85); }
    pg.lo('#8a5a2b', px, py - 0.05, 0, 0.3);
    const palms = W.palms, im = new THREE.InstancedMesh(pg.geo(), MAT.lit, palms.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
    const tint = [new THREE.Color('#ffffff'), new THREE.Color('#9a8ad0'), new THREE.Color('#ffffff'), new THREE.Color('#7a94a8'), new THREE.Color('#d8a8f0')];
    palms.forEach((p, i) => { const s = Math.max(0.95, (p.s || 1)) * (0.95 + rng() * 0.3); e.set(0, rng() * 6.283, 0); q.setFromEuler(e); mt.compose(pos.set(p.x * S, LAND_H, p.y * S), q, sc.set(s, s * (0.9 + rng() * 0.3), s)); im.setMatrixAt(i, mt); im.setColorAt(i, tint[World.distAt(W, p.x, p.y)]); });
    im.frustumCulled = false; scene.add(im); city.palms = im; city.palmCount = palms.length;
    const lg = new GB(); lg.add(PR.cyl6, '#59536b', 0, 2.2, 0, 0.07, 4.4, 0.07); lg.box('#59536b', 0.4, 4.4, 0, 0.9, 0.08, 0.08); lg.add(PR.cyl6, '#3a3550', 0, 0.15, 0, 0.16, 0.3, 0.16); lg.box('#fff6c8', 0.8, 4.34, 0, 0.36, 0.1, 0.2);
    const lm = new THREE.InstancedMesh(lg.geo(), MAT.lit, W.lamps.length);
    W.lamps.forEach((p, i) => { const d = World.distAt(W, p.x, p.y); e.set(0, (i % 4) * 1.57, 0); q.setFromEuler(e); mt.compose(pos.set(p.x * S, LAND_H, p.y * S), q, sc.set(1, 1, 1)); lm.setMatrixAt(i, mt); city.glowPts.push({ x: p.x * S + Math.cos((i % 4) * 1.57) * 0.8, y: 4.3, z: p.y * S - Math.sin((i % 4) * 1.57) * 0.8, col: PAL[d].lamp, s: 7, lamp: 1 }); });
    lm.frustumCulled = false; scene.add(lm);
  }

  // ---------- glow sprites (additive points) ----------
  {
    const n = city.glowPts.length, P = new Float32Array(n * 3), C = new Float32Array(n * 3), Sz = new Float32Array(n);
    city.glowPts.forEach((g, i) => { P[i * 3] = g.x; P[i * 3 + 1] = g.y; P[i * 3 + 2] = g.z; const c = lin(g.col); C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2]; Sz[i] = g.s; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('size', new THREE.BufferAttribute(Sz, 1));
    city.glowMat = glowMaterial(); const pts = new THREE.Points(g, city.glowMat); pts.frustumCulled = false; scene.add(pts); city.glow = pts;
  }

  // ---------- water + sky ----------
  {
    const wt = canvasTex(128, 128, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(255,255,255,1)'; const r = VP.U.rng(9); c.fillStyle = 'rgba(0,0,0,.14)'; for (let i = 0; i < 26; i++) { const x = r() * 128, y = r() * 128; c.beginPath(); c.ellipse(x, y, 10 + r() * 16, 2 + r() * 2, 0, 0, 6.283); c.fill(); } }, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
    wt.repeat.set(90, 90);
    city.waterMat = new THREE.MeshBasicMaterial({ color: 0x27c4d6, map: wt });
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), city.waterMat); wm.rotation.x = -Math.PI / 2; wm.position.set(TW * TL / 2, -0.5, TH * TL / 2); scene.add(wm); city.waterTex = wt;
    city.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunC: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(-0.75, 0.16, -0.3).normalize() }, night: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunC; uniform vec3 sunDir; uniform float night; varying vec3 vD;\nfloat h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }\nvoid main(){ vec3 d = normalize(vD); float h = clamp(d.y*1.6+0.08, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.55)); float s = max(dot(d, sunDir), 0.0); c += sunC * (pow(s, 380.0)*1.6 + pow(s, 12.0)*0.35 + pow(s, 3.0)*0.12); float band = smoothstep(0.0,0.04,abs(fract(d.y*26.0+0.5)-0.5)); if (s > 0.9965 && d.y < sunDir.y) c = mix(c, hor, (1.0-band)*0.8); vec2 g = floor(d.xz/max(d.y,0.05)*42.0); float st = step(0.985, h21(g)) * step(0.12, d.y) * night; c += vec3(st)*0.7; gl_FragColor = vec4(c, 1.0); }',
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 20, 12), city.skyMat); sky.frustumCulled = false; scene.add(sky); city.sky = sky;
  }
  return city;
}

export function glowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { scale: { value: 300 }, power: { value: 1 } },
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(size * scale / -mv.z, 220.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; uniform float power; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2) * power; gl_FragColor = vec4(vC * a, a); }',
  });
}
