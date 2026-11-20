// VICE PAWS — city life renderer. Reads G.life (life/sim.js) and draws it with a handful of draw calls:
// every human is 7 instances spread over 5 InstancedMeshes (torso, head, hair, legs, arms) with per-instance colours;
// dogs, pigeons, butterflies, vehicles, cups, puddles, light pools and traffic lights are one InstancedMesh each.
// Street cats reuse the game's parametric cat (pooled). Stalls and props are small merged meshes, culled by distance.
// HOOK: render.js calls VP.LifeGfx.sync(G, dt, ctx) once per frame, after the mood is applied and before the fx flush.
import { THREE, GB, MAT, PR, buildCat, animCat } from '../gfx/models.js';

const VP = window.VP, U = VP.U, S = 1 / 24, T = 48;
const X = VP.LifeGfx = { ok: false };
const _b = new THREE.Matrix4(), _l = new THREE.Matrix4(), _w = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _e = new THREE.Euler(), _e2 = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
let grp = null, M = null, world = null, statics = [], cats = new Map(), leash = null, beam = null, sunMat = null;
const colCache = new Map();
const col = h => { let c = colCache.get(h); if (!c) { c = new THREE.Color(h); colCache.set(h, c); } return c; };

function inst(geo, mat, n, tint) {
  const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (tint) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  m.userData.n = 0; m.userData.cap = n; grp.add(m); return m;
}
const put = (m, mat, c) => { const i = m.userData.n; if (i >= m.userData.cap) return; m.setMatrixAt(i, mat); if (c) { const a = m.instanceColor.array; a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } m.userData.n = i + 1; };
const white = '#ffffff';

// ---------- geometry ----------
function geos() {
  const g = {};
  g.torso = new GB().add(new THREE.CylinderGeometry(1, 0.78, 1, 8).toNonIndexed(), white, 0, 0, 0, 0.37, 0.92, 0.25).geo();
  g.head = new GB().sph(white, 0, 0, 0, 0.38, 0.36, 0.37).lo('#241818', 0.14, 0.03, 0.335, 0.045, 0.06, 0.03).lo('#241818', -0.14, 0.03, 0.335, 0.045, 0.06, 0.03).lo('#e89a8a', 0, -0.07, 0.36, 0.045, 0.035, 0.03).geo();
  g.hair = new GB().add(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.56).toNonIndexed(), white, 0, 0, 0, 0.41).geo();
  g.limb = new GB().add(new THREE.CylinderGeometry(1, 0.8, 1, 6).toNonIndexed(), white, 0, 0, 0, 1, 1, 1).geo();
  g.item = new GB().box(white, 0, 0, 0, 1, 1, 1).geo();
  g.umbrella = new GB().cone(white, 0, 0.5, 0, 0.95, 0.42, 0.95).cyl('#3a3040', 0, -0.1, 0, 0.03, 1.2, 0.03).geo();
  { const b = new GB(); b.box(white, 0, 0.5, 0, 0.42, 0.4, 0.95); b.lo(white, 0, 0.74, 0.58, 0.27); b.box(white, 0, 0.66, 0.84, 0.16, 0.14, 0.2); b.box('#2a1c1c', 0, 0.7, 0.95, 0.08, 0.07, 0.06);
    b.box('#6a4a3b', 0.2, 0.92, 0.5, 0.1, 0.24, 0.14); b.box('#6a4a3b', -0.2, 0.92, 0.5, 0.1, 0.24, 0.14);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(white, sx * 0.15, 0.15, sz * 0.34, 0.12, 0.32, 0.12);
    b.box(white, 0, 0.78, -0.55, 0.09, 0.3, 0.09, -0.6); b.box('#e01e37', 0, 0.62, 0.42, 0.44, 0.07, 0.1); g.dog = b.geo(); }
  { const b = new GB(); b.lo('#8f96a3', 0, 0.2, 0, 0.16, 0.15, 0.24); b.lo('#6b727d', 0, 0.36, 0.17, 0.1); b.cone('#f2a03d', 0, 0.35, 0.29, 0.03, 0.09, 0.03, Math.PI / 2); b.box('#5a6170', 0, 0.2, -0.26, 0.12, 0.03, 0.2); b.box('#c9665a', 0.05, 0.04, 0, 0.02, 0.1, 0.02); b.box('#c9665a', -0.05, 0.04, 0, 0.02, 0.1, 0.02); g.bird = b.geo(); }
  { const p = new Float32Array([0, 0, 0.12, 0.26, 0.1, 0.2, 0.26, 0.1, -0.16, 0, 0, 0.12, 0.26, 0.1, -0.16, 0, 0, -0.08, 0, 0, 0.12, -0.26, 0.1, -0.16, -0.26, 0.1, 0.2, 0, 0, 0.12, 0, 0, -0.08, -0.26, 0.1, -0.16]); const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(p, 3)); bg.computeVertexNormals(); g.fly = bg; }
  { const b = new GB(); b.lo('#b9b3ad', 0, 0.09, 0, 0.09, 0.08, 0.15); b.lo('#b9b3ad', 0, 0.12, 0.14, 0.065); b.lo('#f4a9b8', 0.05, 0.19, 0.12, 0.035); b.lo('#f4a9b8', -0.05, 0.19, 0.12, 0.035); b.box('#f4a9b8', 0, 0.06, -0.24, 0.02, 0.02, 0.22); g.mouse = b.geo(); }
  { const b = new GB(); b.cyl(white, 0, 0.09, 0, 0.07, 0.18, 0.06); b.cyl('#ffffff', 0, 0.19, 0, 0.075, 0.02, 0.075); g.cup = b.geo(); }
  { const b = new GB(); b.sph(white, 0, 0, 0, 0.3); b.tor('#ffffff', 0, 0, 0, 0.27, 0.3, 0.27, 0.6, 0.3, 0); b.tor('#ffffff', 0, 0, 0, 0.27, 0.3, 0.27, -0.7, 1.2, 0); g.yarn = b.geo(); }
  // vehicles: forward is +z, white panels take the instance colour
  { const b = new GB(), w = 2.1, l = 5.5; b.box(white, 0, 1.45, 0, w, 1.9, l); b.box('#f7f3ea', 0, 2.44, 0, w - 0.1, 0.1, l - 0.2); b.box('#1d2440', 0, 1.85, 0, w + 0.04, 0.72, l - 0.9); b.box('#1d2440', 0, 1.8, l / 2 - 0.02, w - 0.3, 0.86, 0.1); b.box(white, 0, 1.85, 0.05, w + 0.06, 0.74, 0.14); b.box(white, 0, 1.85, 1.5, w + 0.06, 0.74, 0.14); b.box(white, 0, 1.85, -1.5, w + 0.06, 0.74, 0.14);
    for (const sx of [-1, 1]) for (const z of [-1.7, 1.8]) b.cyl('#17121d', sx * (w / 2 - 0.05), 0.42, z, 0.42, 0.26, 0.42, 0, 0, Math.PI / 2);
    b.box('#fff6b0', 0.7, 0.8, l / 2 + 0.02, 0.34, 0.2, 0.06); b.box('#fff6b0', -0.7, 0.8, l / 2 + 0.02, 0.34, 0.2, 0.06); b.box('#ff3355', 0.7, 0.8, -l / 2 - 0.02, 0.3, 0.2, 0.06); b.box('#ff3355', -0.7, 0.8, -l / 2 - 0.02, 0.3, 0.2, 0.06); b.box('#ffd23f', 0, 2.25, l / 2 + 0.03, 1.3, 0.26, 0.05); g.bus = b.geo(); }
  { const b = new GB(), w = 1.8; b.box(white, 0, 1.25, -0.5, w, 1.7, 2.6); b.box(white, 0, 0.95, 1.3, w, 1.1, 1.1); b.box('#1d2440', 0, 1.3, 1.5, w - 0.16, 0.5, 0.74, -0.35); b.box('#ff4fb8', 0, 1.4, -0.5, w + 0.04, 0.5, 1.5); b.box('#ffffff', 0, 1.4, -0.5, w + 0.06, 0.22, 0.9);
    for (const sx of [-1, 1]) for (const z of [-1.2, 1.2]) b.cyl('#17121d', sx * (w / 2 - 0.05), 0.36, z, 0.36, 0.24, 0.36, 0, 0, Math.PI / 2);
    b.box('#fff6b0', 0.55, 0.7, 1.86, 0.3, 0.18, 0.05); b.box('#fff6b0', -0.55, 0.7, 1.86, 0.3, 0.18, 0.05); b.box('#ff3355', 0.6, 0.8, -1.81, 0.26, 0.2, 0.05); b.box('#ff3355', -0.6, 0.8, -1.81, 0.26, 0.2, 0.05); g.van = b.geo(); }
  { const b = new GB(); b.cyl('#17121d', 0, 0.3, 0.62, 0.3, 0.12, 0.3, 0, 0, Math.PI / 2); b.cyl('#17121d', 0, 0.3, -0.62, 0.3, 0.12, 0.3, 0, 0, Math.PI / 2); b.box(white, 0, 0.6, 0, 0.26, 0.3, 1.1); b.box('#2a2a33', 0, 0.82, -0.2, 0.3, 0.12, 0.6); b.box('#c0c7d1', 0, 0.98, 0.5, 0.7, 0.05, 0.05); b.box('#fff6b0', 0, 0.78, 0.72, 0.16, 0.14, 0.06);
    b.add(PR.taper, '#3a3f55', 0, 1.3, -0.12, 0.26, 0.7, 0.2, 0.25); b.lo(white, 0, 1.83, 0.02, 0.24); b.box('#1d2440', 0, 1.84, 0.2, 0.3, 0.14, 0.12); b.box('#3a3f55', 0.22, 1.2, 0.2, 0.09, 0.09, 0.6, -0.5); b.box('#3a3f55', -0.22, 1.2, 0.2, 0.09, 0.09, 0.6, -0.5); b.box('#27285c', 0.16, 0.72, 0.02, 0.13, 0.5, 0.16, 0.5); b.box('#27285c', -0.16, 0.72, 0.02, 0.13, 0.5, 0.16, 0.5);
    b.box('#ffb300', 0, 1.05, -0.62, 0.5, 0.46, 0.46); g.moto = b.geo(); }
  { const b = new GB(); b.cyl('#3a3f55', 0, 1.7, 0, 0.07, 3.4, 0.07); b.cyl('#3a3f55', 0, 0.08, 0, 0.2, 0.16, 0.2); b.box('#17121d', 0, 3.3, 0, 0.34, 1.0, 0.3); b.box('#17121d', 0, 3.86, 0, 0.42, 0.1, 0.4); for (let i = 0; i < 3; i++) b.lo('#2a2a33', 0, 3.6 - i * 0.3, 0.14, 0.1); g.tl = b.geo(); }
  { const b = new GB(); b.box('#d9d2c4', 0, -0.2, 0.18, 0.8, 0.1, 0.36); b.box('#b5763a', 0, -0.06, 0.3, 0.74, 0.18, 0.12); b.lo(white, 0, 0.12, 0.08, 0.19, 0.22, 0.17); b.lo(white, 0, 0.42, 0.12, 0.17); b.cone(white, 0.1, 0.61, 0.12, 0.06, 0.14, 0.06); b.cone(white, -0.1, 0.61, 0.12, 0.06, 0.14, 0.06); b.box('#2a1c1c', 0.06, 0.44, 0.27, 0.04, 0.05, 0.04); b.box('#2a1c1c', -0.06, 0.44, 0.27, 0.04, 0.05, 0.04); b.box(white, 0.2, 0.0, 0.0, 0.07, 0.07, 0.3, 0, 0.6, 0);
    b.lo('#ff7ac0', -0.28, 0.06, 0.3, 0.07); b.lo('#ffd23f', 0.28, 0.06, 0.3, 0.07); b.lo('#3fc27f', 0, 0.03, 0.34, 0.08); g.wincat = b.geo(); }
  g.disc = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
  return g;
}

// ---------- stalls and props (static meshes) ----------
function awning(b, c1, c2, w, y, z, d) { const n = Math.max(4, Math.round(w / 0.42)); for (let i = 0; i < n; i++) b.box(i % 2 ? c1 : c2, -w / 2 + (i + 0.5) * w / n, y, z, w / n + 0.01, 0.1, d, 0.2); b.box(c1, 0, y - 0.16, z + d / 2 - 0.02, w + 0.02, 0.22, 0.05); }
function stallMesh(s) {
  const d = s.def, b = new GB(), c1 = d.cols[0], c2 = d.cols[1];
  if (s.prop) return null; // the city's own stands are drawn by the game
  if (d.model === 'fair') {
    const fruit = [['#ffd23f', '#f2a03d'], ['#e01e37', '#3fc27f'], ['#7CFF6B', '#ff8a5c']];
    for (let k = -1; k <= 1; k++) { const x = k * 1.7; b.box('#c98f4b', x, 0.5, 0, 1.4, 0.1, 0.9); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('#8a5a2b', x + sx * 0.6, 0.25, sz * 0.36, 0.08, 0.5, 0.08); b.box('#8a5a2b', x, 0.66, 0, 1.3, 0.22, 0.8, 0.25);
      for (let i = 0; i < 9; i++) b.lo(fruit[k + 1][i % 2], x - 0.45 + (i % 3) * 0.45, 0.9 - Math.floor(i / 3) * 0.05, 0.22 - Math.floor(i / 3) * 0.24, k === 0 ? 0.2 : 0.16);
      b.cyl('#59536b', x, 1.3, -0.42, 0.04, 2.6, 0.04); b.cone(k === 0 ? c2 : c1, x, 2.75, -0.2, 1.15, 0.5, 1.15); }
    b.box('#3fc27f', 0, 0.2, 0.75, 0.5, 0.4, 0.4); b.lo('#3fc27f', 0.9, 0.3, 0.8, 0.3, 0.3, 0.42); b.lo('#e01e37', 0.9, 0.3, 0.8, 0.26, 0.26, 0.44); return b.mesh(MAT.flat);
  }
  if (d.model === 'cart') { b.box('#f4e3c1', 0, 0.6, 0, 2.0, 0.8, 1.0); b.box('#d9b47c', 0, 1.02, 0, 2.1, 0.08, 1.1); for (const sx of [-1, 1]) { b.cyl('#3a2140', sx * 0.7, 0.2, 0.4, 0.2, 0.12, 0.2, 0, 0, Math.PI / 2); b.cyl('#1a0d24', sx * 0.95, 1.5, 0.45, 0.04, 1.0, 0.04); b.cyl('#1a0d24', sx * 0.95, 1.5, -0.45, 0.04, 1.0, 0.04); } awning(b, c1, c2, 2.2, 2.05, 0, 1.5); return b.mesh(MAT.flat); }
  // kiosk: counter, back wall, striped awning, sign and the goods on display
  const w = 3.4;
  b.box('#fff7ea', 0, 0.55, 0.1, w, 1.1, 0.9); b.box(c1, 0, 0.3, 0.57, w, 0.5, 0.05); b.box('#d9b47c', 0, 1.13, 0.12, w + 0.1, 0.08, 1.0);
  b.box('#f2e6d0', 0, 1.5, -0.95, w, 3.0, 0.16); b.box('#f2e6d0', -w / 2 + 0.08, 1.5, -0.45, 0.16, 3.0, 1.0); b.box('#f2e6d0', w / 2 - 0.08, 1.5, -0.45, 0.16, 3.0, 1.0); b.box('#e8d7c0', 0, 3.05, -0.4, w + 0.1, 0.12, 1.3);
  awning(b, c1, c2, w + 0.3, 2.86, 0.55, 1.3); b.box(c2, 0, 3.6, -0.3, 2.4, 0.86, 0.14); b.box(c1, 0, 3.6, -0.22, 2.2, 0.66, 0.06);
  if (d.id === 'peixaria') { for (let i = 0; i < 5; i++) { b.lo('#9fd6e8', -1.2 + i * 0.6, 1.26, 0.2, 0.26, 0.09, 0.12, 0, 0.5, 0); b.cone('#7fb6cf', -1.2 + i * 0.6 + 0.24, 1.26, 0.07, 0.09, 0.16, 0.03, 0, 0.5, Math.PI / 2); } b.box('#e6f6fb', 0, 1.2, 0.2, 3.0, 0.06, 0.6); b.lo('#9fd6e8', 0, 3.62, -0.16, 0.5, 0.2, 0.08); b.cone('#9fd6e8', 0.56, 3.62, -0.16, 0.2, 0.3, 0.05, 0, 0, Math.PI / 2); }
  else if (d.id === 'padaria') { for (let i = 0; i < 6; i++) b.lo('#d9a066', -1.25 + i * 0.5, 1.28, 0.2, 0.2, 0.12, 0.13); b.cyl('#ffffff', 1.4, 1.36, 0.36, 0.1, 0.38, 0.1); b.cyl('#8fc4ff', 1.4, 1.5, 0.36, 0.105, 0.12, 0.105); b.lo('#e8b877', 0, 3.62, -0.16, 0.5, 0.24, 0.08); }
  else if (d.id === 'sorveteria') { const cc = ['#ff9fd6', '#9fe0ff', '#fff3a8', '#b8e986']; for (let i = 0; i < 4; i++) { b.cone('#e8b877', -1.05 + i * 0.7, 1.32, 0.2, 0.11, 0.34, 0.11, Math.PI); b.lo(cc[i], -1.05 + i * 0.7, 1.58, 0.2, 0.15); } b.cone('#e8b877', 0, 4.25, -0.3, 0.3, 0.7, 0.3, Math.PI); b.lo('#ff9fd6', 0, 4.75, -0.3, 0.36); b.lo('#fff3a8', 0, 5.1, -0.3, 0.26); }
  else if (d.id === 'petshop') { b.box('#b5763a', -1.1, 1.36, 0.2, 0.5, 0.4, 0.4); b.box('#ffd23f', -1.1, 1.4, 0.41, 0.3, 0.2, 0.02); b.cyl('#3fc27f', -0.3, 1.3, 0.2, 0.16, 0.26, 0.16); b.lo('#ff4fb8', 0.4, 1.32, 0.22, 0.17); b.lo('#2de2e6', 0.9, 1.28, 0.25, 0.12); b.box('#8a5a2b', 1.35, 1.35, 0.15, 0.3, 0.4, 0.3);
    for (const [x, y, r] of [[0, 3.56, 0.2], [-0.24, 3.8, 0.1], [0, 3.88, 0.1], [0.24, 3.8, 0.1]]) b.lo('#ffd23f', x, y, -0.16, r, r, 0.06); }
  return b.mesh(MAT.flat);
}
function propMesh(p) {
  const b = new GB(); let mat = MAT.flat;
  switch (p.k) {
    case 'bench': b.box('#c98f4b', 0, 0.55, 0, 1.7, 0.1, 0.55); b.box('#b57d3c', 0, 0.95, -0.26, 1.7, 0.5, 0.08, -0.15); for (const sx of [-1, 1]) { b.box('#3a3f55', sx * 0.75, 0.27, 0, 0.08, 0.55, 0.5); b.box('#3a3f55', sx * 0.75, 0.75, -0.25, 0.08, 0.9, 0.08, -0.15); } break;
    case 'box': b.box('#c9a06a', 0, 0.04, 0, 1.3, 0.08, 1.0); for (const s of [-1, 1]) { b.box('#c9a06a', 0, 0.35, s * 0.5, 1.3, 0.7, 0.06); b.box('#b88a52', s * 0.65, 0.35, 0, 0.06, 0.7, 1.0); b.box('#d9b47c', s * 0.92, 0.72, 0, 0.56, 0.05, 1.0, 0, 0, s * -0.5); } b.box('#e9c46a', 0, 0.12, 0, 1.1, 0.1, 0.8); b.box('#8a5a2b', 0, 0.4, 0.535, 0.5, 0.26, 0.01); break;
    case 'table': b.cyl('#fff7ea', 0, 1.0, 0, 0.62, 0.06, 0.62); b.cyl('#e01e37', 0, 0.97, 0, 0.64, 0.03, 0.64); b.cyl('#59536b', 0, 0.5, 0, 0.06, 1.0, 0.06); b.cyl('#59536b', 0, 0.04, 0, 0.32, 0.08, 0.32);
      for (const sx of [-1, 1]) { b.box('#2de2e6', sx * 0.95, 0.55, 0, 0.44, 0.06, 0.44); b.box('#2de2e6', sx * 1.15, 0.9, 0, 0.06, 0.7, 0.44); for (const a of [-1, 1]) for (const c of [-1, 1]) b.box('#59536b', sx * 0.95 + a * 0.18, 0.27, c * 0.18, 0.04, 0.54, 0.04); } break;
    case 'sofa': b.box('#f7d9ff', 0, 0.03, 0.2, 3.0, 0.06, 2.2); b.box('#b967ff', 0, 0.5, 0, 2.2, 0.5, 0.9); b.box('#a04fe6', 0, 0.95, -0.38, 2.2, 0.9, 0.24); for (const sx of [-1, 1]) b.box('#a04fe6', sx * 1.2, 0.7, 0, 0.28, 0.8, 0.9); b.box('#d6a8ff', -0.52, 0.8, 0.05, 0.9, 0.14, 0.7); b.box('#d6a8ff', 0.52, 0.8, 0.05, 0.9, 0.14, 0.7);
      b.cyl('#59536b', 1.7, 0.8, 0.9, 0.04, 1.6, 0.04); b.box('#ffd23f', 1.7, 1.75, 0.9, 0.8, 0.5, 0.05); b.box('#e01e37', 1.7, 1.75, 0.93, 0.6, 0.12, 0.02); break;
    case 'sun': return null;
    case 'laser': b.cyl('#3a3f55', 0, 0.5, 0, 0.05, 1.0, 0.05); b.box('#17121d', 0, 1.06, 0, 0.16, 0.14, 0.3); b.lo('#ff3355', 0, 1.06, 0.17, 0.06); b.cyl('#3a3f55', 0, 0.04, 0, 0.2, 0.08, 0.2); break;
    case 'yarn': b.cyl('#c98f4b', 0, 0.2, 0, 0.5, 0.4, 0.42); b.cyl('#8a5a2b', 0, 0.41, 0, 0.52, 0.04, 0.52); b.lo('#2de2e6', 0.15, 0.48, 0.1, 0.2); b.lo('#ffd23f', -0.2, 0.46, -0.05, 0.18); break;
    case 'gang': b.box('#3a3f55', 0, 0.3, 0, 0.9, 0.5, 0.36); b.cyl('#17121d', -0.25, 0.3, 0.19, 0.16, 0.03, 0.16, Math.PI / 2); b.cyl('#17121d', 0.25, 0.3, 0.19, 0.16, 0.03, 0.16, Math.PI / 2); b.box('#ff4fb8', 0, 0.48, 0.19, 0.3, 0.08, 0.02); b.box('#c0c7d1', 0, 0.62, 0, 0.6, 0.04, 0.04); b.box('#c98f4b', 1.2, 0.35, -0.4, 0.7, 0.7, 0.7); break;
    case 'celeb': b.box('#e01e37', 0, 0.03, -0.6, 5.2, 0.06, 4.4); b.box('#b8002a', 0, 0.25, -1.67, 4.6, 0.5, 1.5); b.box('#ffd23f', 0, 0.5, -1.67, 4.7, 0.05, 1.6); b.box('#ffd23f', 0, 0.04, 1.62, 5.2, 0.06, 0.08); for (const sx of [-1, 1]) for (const z of [-2.4, 1.4]) { b.cyl('#ffd23f', sx * 2.7, 0.5, z, 0.06, 1.0, 0.06); b.lo('#ffd23f', sx * 2.7, 1.04, z, 0.1); } for (const sx of [-1, 1]) b.box('#b8002a', sx * 2.7, 0.82, -0.5, 0.05, 0.07, 3.7);
      b.box('#1d1530', 0, 2.3, -2.6, 4.6, 2.6, 0.12); for (let i = 0; i < 7; i++) b.cone(['#ffd23f', '#ff4fb8', '#2de2e6'][i % 3], -1.8 + i * 0.6, 2.9 + (i % 2) * 0.5, -2.52, 0.2, 0.2, 0.04, Math.PI / 2); b.box('#ffd23f', 0, 1.7, -2.52, 3.6, 0.4, 0.04); break;
    default: return null;
  }
  return b.mesh(mat);
}
function buildWorld(L, ctx) {
  for (const m of statics) { grp.remove(m); m.geometry.dispose(); }
  statics = [];
  const addAt = (m, o, extra) => { if (!m) return; m.position.set(o.x * S, ctx.hAt(o.x, o.y), o.y * S); m.rotation.y = Math.PI / 2 - o.a + (extra || 0); m.userData.o = o; m.matrixAutoUpdate = false; m.updateMatrix(); grp.add(m); statics.push(m); };
  for (const s of L.stalls) addAt(stallMesh(s), s);
  for (const p of L.props) addAt(propMesh(p), p);
  world = L;
}

// ---------- init ----------
function init(ctx) {
  grp = new THREE.Group(); ctx.scene.add(grp);
  const g = geos(), tint = new THREE.MeshLambertMaterial({ vertexColors: true }), flatTint = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  M = {
    torso: inst(g.torso, tint, 72, 1), head: inst(g.head, tint, 72, 1), hair: inst(g.hair, tint, 72, 1), legs: inst(g.limb, tint, 144, 1), arms: inst(g.limb, tint, 144, 1),
    item: inst(g.item, tint, 48, 1), umb: inst(g.umbrella, flatTint, 40, 1), dog: inst(g.dog, flatTint, 12, 1), bird: inst(g.bird, MAT.flat, 40), mouse: inst(g.mouse, MAT.flat, 4),
    fly: inst(g.fly, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 16, 1), cup: inst(g.cup, flatTint, 40, 1), yarn: inst(g.yarn, tint, 6, 1),
    bus: inst(g.bus, flatTint, 6, 1), van: inst(g.van, flatTint, 10, 1), moto: inst(g.moto, flatTint, 10, 1), tl: inst(g.tl, MAT.flat, 40), win: inst(g.wincat, flatTint, 40, 1),
    puddle: inst(g.disc, new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.3, depthWrite: false }), 48),
    pool: inst(g.disc, new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 40),
    sun: inst(g.disc, sunMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.4, depthWrite: false }), 12),
  };
  leash = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x3a2a2a })); leash.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 6), 3)); leash.frustumCulled = false; grp.add(leash);
  beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fb8, transparent: true, opacity: 0.33, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.scale.set(1, 40, 1); beam.visible = false; grp.add(beam);
  X.ok = true; X.meshes = M;
}

// ---------- humans ----------
function limb(m, P, rx, rz, r, len, c) { _e.set(rx, 0, rz); _q.setFromEuler(_e); _v.set(0, -len / 2, 0).applyQuaternion(_q).add(P); _l.compose(_v, _q, _s.set(r, len, r)); _w.multiplyMatrices(_b, _l); put(m, _w, c); }
function part(m, x, y, z, sx, sy, sz, c, rx) { if (rx) { _e.set(rx, 0, 0); _q.setFromEuler(_e); } else _q.identity(); _l.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); _w.multiplyMatrices(_b, _l); put(m, _w, c); }
function human(L, p, ctx, rain) {
  const k = p.look.h * (p.fade >= 1 ? 1 : p.fade * p.fade * (3 - 2 * p.fade)), lk = p.look, near = p.near !== false;
  if (k <= 0.01) return;
  const jog = p.role === 'jogger' || p.pose === 7, f = jog ? 13 : 8.5, sw = p.walk ? Math.sin(p.t * f) * (jog ? 0.9 : 0.6) : 0, pose = p.pose || 0;
  let y = ctx.hAt(p.x, p.y), lean = jog && p.walk ? 0.16 : 0, drop = 0, legA = -sw, legB = sw, aL = sw * 0.8, aR = -sw * 0.8, zL = 0.1, zR = -0.1;
  if (pose === 4) { drop = 0.46; legA = legB = -1.5; aL = aR = -0.5; } // sitting
  else if (pose === 5) { drop = 0.42; legA = -1.2; legB = 0.5; lean = 0.5; aR = -1.1; aL = -0.3; } // crouching to pet
  else if (pose === 1) { aR = -1.3; } else if (pose === 2) { aL = aR = -1.45; zL = -0.25; zR = 0.25; } else if (pose === 6) { aR = -1.35; }
  else if (pose === 3) { zR = -2.5 + Math.sin(p.t * 9) * 0.35; aR = 0; } else if (pose === 7) { zL = 2.5 + Math.sin(p.t * 14) * 0.4; zR = -2.5 - Math.sin(p.t * 14 + 1) * 0.4; aL = aR = 0; }
  const umb = rain && !lk.kid && pose === 0 && p.id % 3 !== 0 && p.role !== 'jogger'; if (umb) { aR = -1.5; zR = -0.1; }
  if (p.walk) y += Math.abs(Math.sin(p.t * f)) * 0.05 * k; if (p.hop) y += Math.abs(Math.sin(p.t * 9)) * 0.22;
  if (pose === 4 && p.sitting) y += 0.0;
  _e.set(0, Math.PI / 2 - p.a, 0); _q0.setFromEuler(_e);
  _b.compose(_p.set(p.x * S, y - drop * k, p.y * S), _q0, _s.set(k * lk.w, k, k * lk.w));
  const skin = col(lk.skin), top = col(lk.apron || lk.top), bot = col(lk.bottom);
  // legs
  limb(M.legs, _p.set(0.15, 1.0, 0), legA, 0, 0.135, 1.0, bot); limb(M.legs, _p.set(-0.15, 1.0, 0), legB, 0, 0.135, 1.0, bot);
  // torso + head (leaning for joggers and when crouching)
  _e.set(lean, 0, 0); _q.setFromEuler(_e); _v.set(0, 0.46, 0).applyQuaternion(_q); _l.compose(_p.set(_v.x, 0.98 + _v.y, _v.z), _q, _s.set(1, 1, 1)); _w.multiplyMatrices(_b, _l); put(M.torso, _w, top);
  _v.set(0, 1.24, 0).applyQuaternion(_q); const hx = _v.x, hy = 0.98 + _v.y, hz = _v.z;
  part(M.head, hx, hy, hz, 1, 1, 1, skin, lean * 0.5);
  if (lk.hairStyle !== 3) { const hs = lk.hairStyle, hc = col(lk.hat || lk.hair); if (hs === 1) part(M.hair, hx, hy - 0.02, hz - 0.05, 1.04, 1.45, 1.1, hc, -0.5); else if (hs === 2) part(M.hair, hx, hy + 0.04, hz - 0.02, 1.25, 1.2, 1.25, hc, -0.15); else if (hs === 4) { part(M.hair, hx, hy + 0.06, hz, 1.06, 0.8, 1.06, hc, 0); part(M.hair, hx, hy + 0.1, hz + 0.16, 0.9, 0.12, 0.9, hc, 0.1); } else part(M.hair, hx, hy + 0.02, hz - 0.02, 1.02, 1, 1.04, hc, -0.2); }
  if (near) { // arms only up close
    const sl = lk.sleeves ? top : skin, sy = 1.84 - (lean ? 0.06 : 0), sz = lean * 0.7;
    limb(M.arms, _p.set(0.43, sy, sz), aL, zL, 0.095, 0.78, sl); limb(M.arms, _p.set(-0.43, sy, sz), aR, zR, 0.095, 0.78, sl);
    if (p.snack) part(M.item, -0.46, 1.08, 0.12, 0.22, 0.22, 0.22, col(p.snack === 'hotdog' ? '#e8a05c' : p.snack === 'donut' ? '#ff7ac0' : p.snack === 'sushi' ? '#ffffff' : p.snack === 'steak' ? '#b5523a' : '#ffd27a'));
    else if (pose === 2) part(M.item, 0, 1.9, 0.76, 0.36, 0.24, 0.2, col('#17121d'));
    else if (pose === 1) part(M.item, -0.45, 1.74, 0.72, 0.12, 0.22, 0.04, col('#17121d'));
    if (umb) { _l.compose(_p.set(-0.42, 2.72, 0.5), _q.identity(), _s.set(1.2, 1.2, 1.2)); _w.multiplyMatrices(_b, _l); put(M.umb, _w, col(lk.top)); }
    if (U.d2(p.x, p.y, ctx.ax, ctx.ay) < 560 * 560) ctx.shadow(p.x * S, p.y * S, y, 0.36 * k, 0.36 * k);
  }
}

// ---------- street cats (pooled parametric cats) ----------
function catSpec(c) { if (c.spec) return c.spec; const d = c.def; return { size: c.size || 0.7, fur: d.fur, fur2: d.fur2, pattern: d.pattern, patchA: d.patchA, patchB: d.patchB, eye: d.eye, earIn: '#f4a9b8', face: 'round', fluff: 0.4, acc: c.acc || (c.friend ? { collar: '#ffd23f' } : {}) }; }
function syncCats(L, ctx, dt, frame) {
  const max = ctx.quality === 0 ? 5 : 9; let n = 0;
  for (const c of L.animals) {
    if (c.kind !== 'cat') continue; const d2 = U.d2(c.x, c.y, ctx.ax, ctx.ay);
    if (d2 > 1150 * 1150 || (n >= max && !c.celeb)) continue; n++;
    let o = cats.get(c); if (!o) { o = buildCat(catSpec(c)); o.userData.col = c.friend; cats.set(c, o); grp.add(o); }
    o.userData.f = frame; o.visible = true; const k = c.fade >= 1 ? 1 : Math.max(0.01, c.fade);
    o.position.set(c.x * S, ctx.hAt(c.x, c.y) + (c.lift || 0), c.y * S); o.rotation.y = Math.PI / 2 - c.a; o.scale.setScalar(k);
    const st = o.userData.st || (o.userData.st = {}); st.t = c.t; st.walk = c.walk; st.sit = c.sit && !c.walk ? 1 : 0; st.wave = 0; st.hop = 0; st.spin = 0; st.mouth = c.bub ? 0.8 : 0;
    if (c.celeb) { st.sit = c.emo === 'sit' ? 1 : 0; st.wave = c.emo === 'wave' ? 1 : 0; if (c.emo === 'dance') { st.walk = 1; st.hop = Math.abs(Math.sin(c.t * 8)) * 0.38; st.spin = Math.sin(c.t * 4.5) * 1.1; } ctx.glow(o.position.x, o.position.y + 2.3, o.position.z, '#ffd23f', 4 + Math.sin(c.t * 5)); }
    animCat(o, st);
    if (d2 < 600 * 600) ctx.shadow(o.position.x, o.position.z, o.position.y, 0.36, 0.36);
  }
  for (const [c, o] of cats) if (o.userData.f !== frame) { if (c.dead || !L.animals.includes(c)) { grp.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); cats.delete(c); } else o.visible = false; }
}

// ---------- frame ----------
const LIGHT = ['#ff3355', '#ffb300', '#39e66a'];
X.sync = function (G, dt, ctx) {
  const L = G && G.life;
  if (!grp) { if (!L) return; init(ctx); }
  for (const k in M) M[k].userData.n = 0;
  if (!L) { for (const k in M) M[k].count = 0; grp.visible = false; return; }
  grp.visible = true;
  if (world !== L) { for (const [, o] of cats) { grp.remove(o); } cats.clear(); buildWorld(L, ctx); }
  const a = G.car || G.cats[G.active], cam = ctx.camera, W = G.W, t = L.t, night = L.night, rain = L.rain > 0.4;
  ctx.ax = a.x; ctx.ay = a.y; X.frame = (X.frame | 0) + 1;
  const fwx = Math.cos(ctx.yaw), fwy = Math.sin(ctx.yaw), cpx = cam.position.x / S, cpy = cam.position.z / S;
  const vis = (x, y, r) => { const dx = x - cpx, dy = y - cpy; return dx * fwx + dy * fwy > -(r || 120) && dx * dx + dy * dy < 2100 * 2100; };
  // statics: distance culling
  for (const m of statics) { const o = m.userData.o; m.visible = Math.abs(o.x - a.x) < 2000 && Math.abs(o.y - a.y) < 2000; }
  for (const p of L.peds) if (vis(p.x, p.y)) human(L, p, ctx, rain);
  // dogs + leashes
  { const lp = leash.geometry.attributes.position.array; let ln = 0;
    for (const c of L.animals) { if (c.kind !== 'dog' || !vis(c.x, c.y)) continue; const s = c.def.s * (c.fade >= 1 ? 1 : c.fade), y = ctx.hAt(c.x, c.y) + (c.walk ? Math.abs(Math.sin(c.t * 12)) * 0.07 : 0);
      _e.set(0, Math.PI / 2 - c.a + (c.wag > 0 ? Math.sin(c.t * 22) * 0.12 : 0), 0); _q.setFromEuler(_e); _w.compose(_p.set(c.x * S, y, c.y * S), _q, _s.set(s, s, s)); put(M.dog, _w, col(c.def.col));
      if (c.owner && ln < 12) { const o = c.owner, i = ln++ * 6, hy = ctx.hAt(o.x, o.y); lp[i] = o.x * S + Math.cos(o.a) * 0.3; lp[i + 1] = hy + 1.25 * o.look.h; lp[i + 2] = o.y * S + Math.sin(o.a) * 0.3; lp[i + 3] = c.x * S; lp[i + 4] = y + 0.62 * s; lp[i + 5] = c.y * S; } }
    leash.geometry.setDrawRange(0, ln * 2); leash.geometry.attributes.position.needsUpdate = true; leash.visible = ln > 0; }
  for (const b of L.birds) { if (!vis(b.x, b.y)) continue; const fl = b.st === 'fly', y = ctx.hAt(b.x, b.y) + b.z + (b.hop > 0 ? Math.sin(b.hop / 0.25 * Math.PI) * 0.12 : 0), k = b.fade; _e.set(fl ? -0.3 : (Math.sin(b.t * 7) > 0.5 ? 0.5 : 0), Math.PI / 2 - b.a, fl ? Math.sin(b.t * 30) * 0.5 : 0); _q.setFromEuler(_e); _w.compose(_p.set(b.x * S, y, b.y * S), _q, _s.set(k * (fl ? 1.5 : 1), k, k)); put(M.bird, _w); }
  for (const f of L.flies) { _e.set(0, f.t * 1.7, 0); _q.setFromEuler(_e); _w.compose(_p.set(f.x * S, ctx.hAt(f.x, f.y) + f.z, f.y * S), _q, _s.set(0.25 + Math.abs(Math.sin(f.t * 16)) * 0.75, 1, 1)); put(M.fly, _w, col(f.col)); }
  syncCats(L, ctx, dt, X.frame);
  // vehicles
  for (const v of L.vehicles) { if (!vis(v.x, v.y, 300)) continue; const m = M[v.kind], y = ctx.hAt(v.x, v.y), k = v.fade >= 1 ? 1 : Math.max(0.01, v.fade);
    _e2.set(0, Math.PI / 2 - v.a, v.kind === 'moto' ? U.clamp(-v.lean * 0.9, -0.4, 0.4) : 0); _q.setFromEuler(_e2); _w.compose(_p.set(v.x * S, y + (v.kind === 'bus' ? Math.sin(v.t * 9) * 0.012 : 0), v.y * S), _q, _s.set(k, k, k)); put(m, _w, col(v.col));
    ctx.shadow(v.x * S, v.y * S, y, v.wid * S * 1.25, v.half * S * 1.12, Math.PI / 2 - v.a);
    if (night > 0.3) { const fx = Math.cos(v.a), fy = Math.sin(v.a); ctx.glow(v.x * S + fx * (v.half * S + 0.3), y + 0.8, v.y * S + fy * (v.half * S + 0.3), '#fff6b0', 5 * night); } }
  // traffic lights around the leader
  if (L.lightsOn) { const LL = VP.LifeLogic, RX = W.RX, RY = W.RY;
    for (let j = 0; j < RY.length; j++) { if (Math.abs(RY[j] - a.y) > 1000) continue; for (let i = 0; i < RX.length; i++) { if (Math.abs(RX[i] - a.x) > 1000) continue; const st = LL.lightState(t, i, j);
      for (const [sx, sy, ax, rot] of [[-1, 1, st.ew, 0], [1, -1, st.ew, Math.PI], [-1, -1, st.ns, Math.PI / 2], [1, 1, st.ns, -Math.PI / 2]]) {
        const x = RX[i] + sx * 116, y = RY[j] + sy * 116; if (!vis(x, y, 60)) continue; const hy = ctx.hAt(x, y); _e.set(0, Math.PI / 2 - (rot + Math.PI), 0); _q.setFromEuler(_e); _w.compose(_p.set(x * S, hy, y * S), _q, _s.set(1, 1, 1)); put(M.tl, _w);
        ctx.glow(x * S - Math.cos(rot) * 0.2, hy + 3.6 - (2 - ax) * 0.3, y * S - Math.sin(rot) * 0.2, LIGHT[ax], 2.6); } } } }
  // window cats
  for (const w of L.windows) { if (Math.abs(w.x - a.x) > 900 || Math.abs(w.y - a.y) > 900 || !vis(w.x, w.y, 40)) continue; _q.identity(); _w.compose(_p.set(w.x * S, ctx.hAt(w.x, w.y + 20) + w.h + (w.hop > 0 ? Math.sin(w.hop / 0.5 * Math.PI) * 0.2 : 0), w.y * S), _q, _s.set(1.5, 1.5, 1.5)); put(M.win, _w, col(L.N.streetCats[w.vi].fur)); }
  // cups, toys
  for (const k of L.knock) { if (k.st === 'gone' && k.t > 6) continue; if (Math.abs(k.x - a.x) > 700 || Math.abs(k.y - a.y) > 700) continue; _e.set(k.st === 'on' ? 0 : k.st === 'gone' ? 1.57 : k.t * 9, 0, k.st === 'fall' ? k.t * 7 : 0); _q.setFromEuler(_e); _w.compose(_p.set(k.x * S, ctx.hAt(k.x, k.y) + k.z, k.y * S), _q, _s.set(1.5, 1.5, 1.5)); put(M.cup, _w, col(['#9fe0ff', '#ffd23f', '#ff7ac0'][k.kind % 3])); }
  for (const o of L.toys) { const hy = ctx.hAt(o.x, o.y);
    if (o.k === 'yarn') { _e.set(o.roll || 0, 0, (o.roll || 0) * 0.7); _q.setFromEuler(_e); _w.compose(_p.set(o.x * S, hy + 0.3, o.y * S), _q, _s.set(1, 1, 1)); put(M.yarn, _w, col('#ff4fb8')); ctx.shadow(o.x * S, o.y * S, hy, 0.3, 0.3); }
    else if (o.k === 'laser') { ctx.glow(o.x * S, hy + 0.08, o.y * S, '#ff2040', 2.2 + Math.sin(t * 30) * 0.5); ctx.pt(o.x * S, hy + 0.1, o.y * S, '#ff2040', 1, 0.5, 0); }
    else if (o.k === 'mouse') { _e.set(0, Math.PI / 2 - o.a, 0); _q.setFromEuler(_e); _w.compose(_p.set(o.x * S, hy + (o.moving ? Math.abs(Math.sin(o.t * 26)) * 0.04 : 0), o.y * S), _q, _s.set(2.1, 2.1, 2.1)); put(M.mouse, _w); ctx.glow(o.x * S, hy + 0.9, o.y * S, '#ffd23f', 2.4); } }
  // sunny spots (by day), focus glow, favor target, waypoint beam
  const day = 1 - night; sunMat.opacity = 0.34 * day * (1 - L.rain);
  for (const p of L.props) { if (p.k !== 'sun' || Math.abs(p.x - a.x) > 1200 || Math.abs(p.y - a.y) > 1200) continue; _q.identity(); const r = 1.9 + Math.sin(t * 1.5 + p.id) * 0.08; _w.compose(_p.set(p.x * S, ctx.hAt(p.x, p.y) + 0.04, p.y * S), _q, _s.set(r, 1, r)); put(M.sun, _w); if (day > 0.5 && L.rain < 0.3) ctx.glow(p.x * S, ctx.hAt(p.x, p.y) + 0.5, p.y * S, '#ffe9a8', 6); }
  if (L.focus) ctx.glow(L.focus.x * S, ctx.hAt(L.focus.x, L.focus.y) + 0.4, L.focus.y * S, '#2de2e6', 4 + Math.sin(t * 6));
  if (L.favor && L.favor.at) { const q = L.favor.at, hy = ctx.hAt(q.x, q.y); ctx.glow(q.x * S, hy + 0.3, q.y * S, '#ffd23f', 6 + Math.sin(t * 6) * 1.5); for (let i = 0; i < 6; i++) ctx.pt(q.x * S + Math.cos(t * 2 + i) * 0.9, hy + 0.15 + ((t * 0.8 + i * 0.3) % 1) * 2.2, q.y * S + Math.sin(t * 2 + i) * 0.9, '#ffd23f', 0.9, 0.28, 1); }
  if (L.wp) { beam.visible = true; const hy = ctx.hAt(L.wp.x, L.wp.y); beam.position.set(L.wp.x * S, hy + 20, L.wp.y * S); beam.scale.set(1 + Math.sin(t * 4) * 0.1, 40, 1 + Math.sin(t * 4) * 0.1); ctx.glow(L.wp.x * S, hy + 0.4, L.wp.y * S, '#ff4fb8', 8); } else beam.visible = false;
  // night: street lamps and stall lights
  if (night > 0.15) {
    for (const l of W.lamps) { if (Math.abs(l.x - a.x) > 1150 || Math.abs(l.y - a.y) > 1150 || !vis(l.x, l.y, 200)) continue; const hy = ctx.hAt(l.x, l.y); ctx.glow(l.x * S, hy + 3.7, l.y * S, '#ffe2a0', 7 * night); _q.identity(); _w.compose(_p.set(l.x * S, hy + 0.05, l.y * S), _q, _s.set(4.2, 1, 4.2)); put(M.pool, _w); }
    for (const s of L.stalls) { if (Math.abs(s.x - a.x) > 1000 || Math.abs(s.y - a.y) > 1000) continue; const hy = ctx.hAt(s.x, s.y); ctx.glow(s.x * S, hy + 2.2, s.y * S, '#ffd9a0', 7 * night); _q.identity(); _w.compose(_p.set(s.fx * S, hy + 0.05, s.fy * S), _q, _s.set(3.2, 1, 3.2)); put(M.pool, _w); }
  }
  // rain and puddles
  if (L.rain > 0.03 && ctx.mood !== 3) { const n = Math.round((ctx.quality === 0 ? 60 : 140) * L.rain), c = ctx.cam; for (let i = 0; i < n; i++) { const hx = (i * 0.618034) % 1, hz = (i * 0.754877) % 1, sp = 16 + (i % 5) * 2, y = 12 - ((t * sp + i * 1.37) % 12); ctx.pt(c.x + (hx - 0.5) * 34 + y * 0.12, y + (c.by || 0), c.z + (hz - 0.5) * 34, '#bcd8ff', 0.5, 0.9, 4); } }
  if (L.wet > 0.08) { const LL = VP.LifeLogic, cx0 = Math.floor(a.x / 192), cy0 = Math.floor(a.y / 192); M.puddle.material.opacity = 0.34 * Math.min(1, L.wet * 1.4);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const p = LL.puddleAt(cx0 + dx, cy0 + dy); if (!p || !vis(p.x, p.y, 60)) continue; const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T); if (tx < 0 || ty < 0 || tx >= W.W || ty >= W.H) continue; const gi = ty * W.W + tx, gn = W.gnd[gi]; if (W.grid[gi] !== 0 || (gn !== 1 && gn !== 2 && gn !== 5 && gn !== 7)) continue; const r = p.r * S * (0.45 + 0.55 * Math.min(1, L.wet * 1.3)); _q.identity(); _w.compose(_p.set(p.x * S, ctx.hAt(p.x, p.y) + 0.035, p.y * S), _q, _s.set(r * 1.25, 1, r)); put(M.puddle, _w); } }
  for (const k in M) { const m = M[k]; m.count = m.userData.n; m.visible = m.count > 0; if (m.count) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
  // ---- day / night / rain grading (applyMood rewrites these every frame, so nothing accumulates) ----
  const r = L.rain;
  if (night > 0.01 || r > 0.01) {
    const sc = ctx.scene, u = ctx.city.skyMat.uniforms;
    ctx.hemi.intensity *= (1 - 0.6 * night) * (1 - 0.16 * r); ctx.sun.intensity *= (1 - 0.88 * night) * (1 - 0.4 * r);
    ctx.hemi.color.lerp(_c.set('#8fa0ff'), night * 0.55);
    sc.fog.color.lerp(_c.set('#0d0a26'), night * 0.78).lerp(_c2.set('#6f7f96'), r * 0.3 * (1 - night)); sc.fog.far *= 1 - 0.22 * r;
    u.top.value.lerp(_c.set('#04031a'), night * 0.9); u.hor.value.lerp(_c.set('#2a1650'), night * 0.75); u.sunC.value.lerp(_c.set('#b8c7ff'), night * 0.8); u.night.value = Math.max(u.night.value, night);
    if (r > 0.01) { u.top.value.lerp(_c.set('#4a5568'), r * 0.45 * (1 - night)); u.hor.value.lerp(_c.set('#8a94a6'), r * 0.4 * (1 - night)); }
    ctx.city.bMat.emissiveIntensity += night * 1.25; ctx.city.glowMat.uniforms.power.value += night * 0.55; if (ctx.fxGlow) ctx.fxGlow.uniforms.power.value += night * 0.35;
  }
};
// Smooth third-person camera: finer sampling of the boom plus two whiskers, so walls pull the camera in before it clips
// (HOOK: render.js asks for the longest free boom length).
X.camClip = function (W, tx, tz, yaw, pitch, want, cur) {
  if (!W || !W.gnd) return cur;
  const cp = Math.cos(pitch), sp = Math.sin(pitch); let best = want;
  for (const [dy, slack] of [[0, 0], [0.22, 0.8], [-0.22, 0.8]]) {
    const fx = Math.cos(yaw + dy), fz = Math.sin(yaw + dy);
    for (let i = 3; i <= 24; i++) { const d = want * i / 24, px = (tx - fx * d * cp) / S, py = (tz - fz * d * cp) / S, X0 = Math.floor(px / T), Y0 = Math.floor(py / T);
      if (X0 >= 0 && Y0 >= 0 && X0 < W.W && Y0 < W.H && W.gnd[Y0 * W.W + X0] === 9 && 1.2 + d * sp < 5) { best = Math.min(best, Math.max(3.2, d - want / 24 + slack)); break; } }
  }
  return Math.min(cur, best);
};
window.dispatchEvent(new Event('vp-lifegfx'));
