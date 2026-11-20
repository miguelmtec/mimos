// VICE PAWS — low-poly models built from primitives (merged, vertex-coloured): parametric cats, dogs, cars, props, items
import * as THREE from '../../vendor/three.module.min.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Matrix3();
const PR = {
  sph: new THREE.SphereGeometry(1, 12, 9).toNonIndexed(), mid: new THREE.SphereGeometry(1, 8, 6).toNonIndexed(), lo: new THREE.SphereGeometry(1, 7, 5).toNonIndexed(),
  box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), cyl: new THREE.CylinderGeometry(1, 1, 1, 10).toNonIndexed(),
  cone: new THREE.ConeGeometry(1, 1, 8).toNonIndexed(), tor: new THREE.TorusGeometry(1, 0.22, 5, 12).toNonIndexed(),
  taper: new THREE.CylinderGeometry(0.6, 1, 1, 8).toNonIndexed(), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).toNonIndexed(),
};
// geometry builder: every part is baked (position/normal/colour) into one BufferGeometry => 1 draw call
export class GB {
  constructor() { this.p = []; this.n = []; this.c = []; }
  add(geo, col, x, y, z, sx, sy, sz, rx, ry, rz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz)); _n.getNormalMatrix(_m); _c.set(col);
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, p = this.p, n = this.n, c = this.c;
    for (let i = 0; i < P.length; i += 3) {
      _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(_m); p.push(_v.x, _v.y, _v.z);
      _v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(_n).normalize(); n.push(_v.x, _v.y, _v.z);
      c.push(_c.r, _c.g, _c.b);
    }
    return this;
  }
  sph(col, x, y, z, sx, sy, sz, rx, ry, rz) { return this.add(GB.low ? PR.mid : PR.sph, col, x, y, z, sx, sy, sz, rx, ry, rz); }
  lo(col, x, y, z, sx, sy, sz, rx, ry, rz) { return this.add(PR.lo, col, x, y, z, sx, sy, sz, rx, ry, rz); }
  box(col, x, y, z, sx, sy, sz, rx, ry, rz) { return this.add(PR.box, col, x, y, z, sx, sy, sz, rx, ry, rz); }
  cyl(col, x, y, z, r, h, r2, rx, ry, rz) { return this.add(PR.cyl, col, x, y, z, r, h, r2 === undefined ? r : r2, rx, ry, rz); }
  cone(col, x, y, z, r, h, r2, rx, ry, rz) { return this.add(PR.cone, col, x, y, z, r, h, r2 === undefined ? r : r2, rx, ry, rz); }
  tor(col, x, y, z, r, t, r2, rx, ry, rz) { return this.add(PR.tor, col, x, y, z, r, t === undefined ? r : t, r2 === undefined ? r : r2, rx, ry, rz); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat) { return new THREE.Mesh(this.geo(), mat || MAT.lit); }
}
// low quality: characters are built from coarser spheres (about 40% of the triangles)
export function setDetail(low) { GB.low = !!low; }
export const MAT = {
  lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
  flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
  ghost: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.4 }),
  white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};
const INK = '#1a0d24';

// ================= CATS (parametric) =================
// spec: { size, fur, fur2, pattern:'solid'|'calico'|'tuxedo'|'tabby'|'points', patchA, patchB, eye, earIn, face:'flat'|'round', fluff,
//         lids, brows, tongue, acc:{ bow, shirt, shirt2, jacket, hoodie, trim, glasses, hat, crown, scarf, santa, collar }, tool:'blaster'|null, cup }
export const CAT_SPECS = {
  mimo: { size: 1.06, fur: '#f7ead0', fur2: '#ffffff', pattern: 'points', patchA: '#e6cfa6', eye: '#3fa9f5', earIn: '#f4a9b8', face: 'flat', fluff: 1, lids: 1, acc: { shirt: '#1d2440', shirt2: '#ffb347', jacket: '#fff6e6' }, tool: 'blaster', cup: 1 },
  mimosa: { size: 1.0, fur: '#fffaf2', fur2: '#ffffff', pattern: 'calico', patchA: '#f28a2e', patchB: '#2b1f24', eye: '#f2b01e', earIn: '#f4a9b8', face: 'flat', fluff: 1, brows: 1, acc: { bow: '#ff3fa4', jacket: '#ff4fb8', trim: '#c2267f' } },
  morticia: { size: 0.8, fur: '#3a2e45', fur2: '#4a3b57', pattern: 'solid', eye: '#ffc928', earIn: '#8a5a78', face: 'flat', fluff: 1.2, tongue: 1, acc: { hoodie: '#17121d', trim: '#4a3b57' } },
  // VIP outfits
  mimo_vip: { size: 1.06, fur: '#f7ead0', fur2: '#ffffff', pattern: 'points', patchA: '#e6cfa6', eye: '#3fa9f5', earIn: '#f4a9b8', face: 'flat', fluff: 1, lids: 1, acc: { shirt: '#fff3a8', shirt2: '#ffffff', jacket: '#ffc928', trim: '#b8860b', glasses: '#ffd23f' }, tool: 'blaster', cup: 1, shiny: 1 },
  mimosa_vip: { size: 1.0, fur: '#fffaf2', fur2: '#ffffff', pattern: 'calico', patchA: '#f28a2e', patchB: '#2b1f24', eye: '#f2b01e', earIn: '#f4a9b8', face: 'flat', fluff: 1, brows: 1, acc: { bow: '#ff2bd6', jacket: '#ff2bd6', trim: '#2de2e6', glasses: '#2de2e6', studs: '#ffffff' }, shiny: 1 },
  morticia_vip: { size: 0.8, fur: '#3a2e45', fur2: '#4a3b57', pattern: 'solid', eye: '#ffc928', earIn: '#8a5a78', face: 'flat', fluff: 1.2, tongue: 1, acc: { hoodie: '#17121d', trim: '#ffd23f', crown: '#ffd23f' }, shiny: 1 },
  // rescued kittens
  f0: { size: 0.6, fur: '#b9b3ad', fur2: '#ddd', pattern: 'tabby', patchA: '#8d8780', eye: '#7bd88f', earIn: '#f4a9b8', face: 'round', acc: {} },
  f1: { size: 0.6, fur: '#f6a94a', fur2: '#fff', pattern: 'tabby', patchA: '#d9822b', eye: '#7bd88f', earIn: '#f4a9b8', face: 'round', acc: {} },
  f2: { size: 0.6, fur: '#ffffff', fur2: '#fff', pattern: 'solid', eye: '#6fc3ff', earIn: '#f4a9b8', face: 'round', acc: { collar: '#ff4fb8' } },
  f3: { size: 0.6, fur: '#2b2b33', fur2: '#fff', pattern: 'tuxedo', eye: '#ffd23f', earIn: '#f4a9b8', face: 'round', acc: {} },
  // friendly neighbours
  elder: { size: 0.9, fur: '#c9c4cf', fur2: '#f2eef5', pattern: 'tabby', patchA: '#9a94a3', eye: '#7bd88f', earIn: '#f4a9b8', face: 'round', fluff: 0.8, lids: 1, acc: { glasses: '#b8860b', scarf: '#b967ff', shirt: '#f7d9ff' } },
  farmer: { size: 0.95, fur: '#d9a066', fur2: '#fff3df', pattern: 'tabby', patchA: '#b5763a', eye: '#7bd88f', earIn: '#f4a9b8', face: 'round', acc: { cowboy: '#8a5a2b', scarf: '#e01e37', shirt: '#2a6bff', shirt2: '#ffffff' } },
};
export function buildCat(spec) {
  const A = spec.acc || {}, fur = spec.fur, fur2 = spec.fur2 || fur, pA = spec.patchA || fur, pB = spec.patchB || pA, fl = spec.fluff || 0;
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  // ---- body ----
  const b = new GB();
  const coat = A.hoodie || A.jacket || null;
  b.sph(fur, 0, 0.5, -0.04, 0.4, 0.38, 0.47);
  if (spec.pattern === 'tuxedo' || spec.pattern === 'points') b.sph(fur2, 0, 0.47, 0.2, 0.26, 0.28, 0.3);
  if (spec.pattern === 'calico' && !coat) { b.sph(pA, -0.22, 0.62, -0.2, 0.24, 0.2, 0.26); b.sph(pB, 0.24, 0.55, -0.05, 0.2, 0.22, 0.24); }
  if (spec.pattern === 'tabby') for (let i = 0; i < 3; i++) b.tor(pA, 0, 0.52, -0.3 + i * 0.2, 0.39 - Math.abs(i - 1) * 0.04, 0.4, 0.3, 0, 0, 0);
  if (A.shirt) { b.sph(A.shirt, 0, 0.5, 0.0, 0.42, 0.36, 0.44); if (A.shirt2) for (let i = 0; i < 9; i++) { const a = i * 2.4, yy = 0.36 + (i % 3) * 0.12; b.lo(A.shirt2, Math.sin(a) * 0.38, yy, Math.cos(a) * 0.36 + 0.02, 0.07, 0.07, 0.07); } }
  if (A.jacket) { // open jacket: two side shells + collar, chest stays visible
    b.sph(A.jacket, -0.17, 0.5, -0.06, 0.32, 0.4, 0.46); b.sph(A.jacket, 0.17, 0.5, -0.06, 0.32, 0.4, 0.46);
    b.box(A.trim || A.jacket, -0.2, 0.74, 0.22, 0.2, 0.07, 0.12, 0.3, 0.3, 0.5); b.box(A.trim || A.jacket, 0.2, 0.74, 0.22, 0.2, 0.07, 0.12, 0.3, -0.3, -0.5);
    b.tor(A.trim || '#fff', 0, 0.27, -0.05, 0.4, 0.46, 0.5, Math.PI / 2);
    if (A.studs) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.lo(A.studs, sx * 0.43, 0.42 + i * 0.12, 0.12, 0.035);
  }
  if (A.hoodie) {
    b.sph(A.hoodie, 0, 0.5, -0.04, 0.44, 0.41, 0.5); b.sph(A.hoodie, 0, 0.86, -0.32, 0.36, 0.3, 0.26); // hood resting on the back
    b.tor(A.trim || A.hoodie, 0, 0.27, -0.04, 0.4, 0.47, 0.5, Math.PI / 2); b.box(A.trim || '#fff', -0.07, 0.6, 0.44, 0.03, 0.26, 0.03); b.box(A.trim || '#fff', 0.07, 0.6, 0.44, 0.03, 0.26, 0.03);
    b.box(A.hoodie, 0, 0.42, 0.42, 0.34, 0.16, 0.08);
  }
  if (A.collar) b.tor(A.collar, 0, 0.82, 0.05, 0.3, 0.3, 0.3, Math.PI / 2);
  if (A.bell) b.sph(A.bell, 0, 0.74, 0.36, 0.08);
  if (A.bowtie) { b.cone(A.bowtie, -0.1, 0.78, 0.4, 0.09, 0.2, 0.05, 0, 0, -Math.PI / 2); b.cone(A.bowtie, 0.1, 0.78, 0.4, 0.09, 0.2, 0.05, 0, 0, Math.PI / 2); b.lo(A.bowtie, 0, 0.78, 0.4, 0.05); }
  if (A.scarf) { b.tor(A.scarf, 0, 0.84, 0.06, 0.34, 0.5, 0.34, Math.PI / 2); b.box(A.scarf, 0.2, 0.62, 0.36, 0.14, 0.4, 0.07, 0, 0, -0.2); }
  if (A.pack) { b.box(A.pack, 0, 0.6, -0.5, 0.44, 0.44, 0.26); b.box('#ffffff', 0, 0.66, -0.64, 0.24, 0.14, 0.04); b.box(A.pack, -0.2, 0.7, -0.2, 0.06, 0.4, 0.5); b.box(A.pack, 0.2, 0.7, -0.2, 0.06, 0.4, 0.5); }
  if (A.cape) { b.box(A.cape, 0, 0.52, -0.5, 0.74, 0.86, 0.05, 0.42); b.tor(A.cape, 0, 0.86, 0.02, 0.32, 0.32, 0.4, Math.PI / 2); }
  if (A.bells) for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.6; b.sph(i % 2 ? '#ffd23f' : A.bells, Math.sin(a) * 0.3, 0.78, 0.26 + Math.cos(a) * 0.1, 0.06); }
  if (A.lei) for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; b.lo(A.lei[i % A.lei.length], Math.sin(a) * 0.33, 0.8 - Math.cos(a) * 0.04, 0.05 + Math.cos(a) * 0.3, 0.085); }
  if (A.board) { b.sph(A.board, 0.12, 0.8, -0.56, 0.2, 0.74, 0.05, 0, 0, 0.25); b.box(A.board2 || '#ffffff', 0.12, 0.8, -0.59, 0.05, 1.3, 0.02, 0, 0, 0.25); }
  if (A.guitar) { b.sph(A.guitar, -0.06, 0.52, -0.56, 0.24, 0.3, 0.07); b.sph('#3a2140', -0.06, 0.56, -0.62, 0.08, 0.08, 0.02); b.box('#8a5a2b', 0.2, 0.98, -0.56, 0.07, 0.62, 0.05, 0, 0, -0.5); }
  if (A.balloon) { b.cyl('#ffffff', 0.3, 1.4, -0.36, 0.008, 1.3, 0.008); b.sph(A.balloon, 0.3, 2.2, -0.36, 0.26, 0.32, 0.26); b.sph('#ffffff', 0.22, 2.3, -0.2, 0.05); }
  if (A.gift) { b.box(A.gift, 0, 0.62, -0.52, 0.4, 0.4, 0.3); b.box('#ffd23f', 0, 0.62, -0.52, 0.42, 0.08, 0.32); b.box('#ffd23f', 0, 0.62, -0.52, 0.08, 0.42, 0.32); b.lo('#ffd23f', 0, 0.86, -0.52, 0.09); }
  if (A.wings) for (const sx of [-1, 1]) { b.sph(A.wings, sx * 0.42, 0.86, -0.4, 0.34, 0.2, 0.05, 0, sx * 0.5, sx * 0.6); b.sph(A.wings, sx * 0.36, 0.64, -0.42, 0.22, 0.14, 0.05, 0, sx * 0.5, sx * 0.2); }
  // arms
  const sleeve = coat || A.shirt || fur;
  b.sph(sleeve, -0.38, 0.56, 0.2, 0.13, 0.13, 0.2); b.sph(fur2, -0.38, 0.54, 0.4, 0.11);
  b.sph(sleeve, 0.38, 0.56, 0.2, 0.13, 0.13, 0.2); b.sph(fur2, 0.38, 0.54, 0.4, 0.11);
  if (spec.cup) { b.cyl('#ffffff', 0.4, 0.64, 0.46, 0.09, 0.16); b.cyl('#6b3f22', 0.4, 0.725, 0.46, 0.075, 0.01); b.tor('#ffffff', 0.5, 0.64, 0.46, 0.05, 0.06, 0.05); b.box('#ff4fb8', 0.4, 0.62, 0.46, 0.185, 0.04, 0.185); }
  if (fl) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.4; if (!coat) b.lo(i % 2 && spec.pattern === 'calico' ? pA : fur, Math.sin(a) * 0.36, 0.42, Math.cos(a) * 0.4 - 0.04, 0.16 * fl); }
  const body = b.mesh(); inner.add(body);
  // ---- legs (two diagonal pairs, pivot at the hips) ----
  const leg = (pairs) => { const l = new GB(); for (const [x, z] of pairs) { l.sph(fur, x, -0.1, z, 0.13, 0.2, 0.14); l.sph(fur2, x, -0.24, z + 0.05, 0.14, 0.09, 0.18); } const m = l.mesh(); m.position.y = 0.3; inner.add(m); return m; };
  const legsA = leg([[-0.22, 0.2], [0.22, -0.26]]), legsB = leg([[0.22, 0.2], [-0.22, -0.26]]);
  // ---- tail (pivot at its base) ----
  const t = new GB(), tailCol = spec.pattern === 'calico' ? pA : spec.pattern === 'points' ? pA : fur;
  for (let i = 0; i < 6; i++) { const f = i / 5; t.sph(i === 5 && spec.pattern === 'calico' ? pB : i > 3 && spec.pattern === 'tuxedo' ? fur2 : tailCol, 0, f * 0.55 + Math.sin(f * 2.4) * 0.05, -f * 0.3 - Math.sin(f * 3) * 0.12, 0.13 + (fl ? 0.05 : 0) * Math.sin(f * 3.1) + 0.02); }
  const tail = t.mesh(); tail.position.set(0, 0.5, -0.44); inner.add(tail);
  // ---- head ----
  const h = new GB(), flat = spec.face !== 'round';
  h.sph(fur, 0, 0, 0, 0.56, 0.48, flat ? 0.46 : 0.5);
  if (fl) { // fluffy cheeks + forehead tufts
    for (const sx of [-1, 1]) { h.lo(spec.pattern === 'calico' ? (sx < 0 ? pA : fur) : fur, sx * 0.47, -0.16, 0.08, 0.24 * fl, 0.2 * fl, 0.2); h.lo(fur, sx * 0.4, -0.3, 0.12, 0.2 * fl, 0.16, 0.2); h.lo(spec.pattern === 'calico' ? (sx < 0 ? pA : pB) : fur, sx * 0.44, 0.1, -0.02, 0.2, 0.22, 0.24); }
    h.lo(fur, 0, -0.36, 0.14, 0.26, 0.16, 0.22);
  }
  if (spec.pattern === 'calico') { h.sph(pA, -0.26, 0.2, 0.12, 0.3, 0.27, 0.3); h.sph(pB, 0.3, 0.24, 0.06, 0.27, 0.24, 0.3); h.sph(pA, 0.36, -0.2, 0.2, 0.16, 0.14, 0.14); }
  if (spec.pattern === 'tabby') for (let i = -1; i <= 1; i++) h.box(pA, i * 0.13, 0.36, 0.22, 0.05, 0.12, 0.2, -0.6);
  if (spec.pattern === 'tuxedo') h.sph(fur2, 0, -0.14, 0.26, 0.26, 0.26, 0.24);
  if (spec.pattern === 'points') h.sph(pA, 0, -0.3, 0.08, 0.36, 0.2, 0.34);
  // ears
  for (const sx of [-1, 1]) {
    const ec = spec.pattern === 'calico' ? (sx < 0 ? pA : pB) : spec.pattern === 'points' ? pA : fur;
    h.cone(ec, sx * 0.36, 0.44, -0.02, 0.19, 0.34, 0.12, 0, 0, -sx * 0.32); h.cone(spec.earIn || '#f4a9b8', sx * 0.35, 0.42, 0.04, 0.11, 0.24, 0.07, 0, 0, -sx * 0.32);
  }
  // face (flat persian: eyes wide apart, tiny nose between them)
  const ez = flat ? 0.4 : 0.43, ey = 0.03, ex = 0.23, er = spec.size < 0.9 ? 0.15 : 0.135;
  for (const sx of [-1, 1]) {
    h.sph('#ffffff', sx * ex, ey, ez, er, er, 0.07); h.sph(spec.eye, sx * ex, ey, ez + 0.035, er * 0.74, er * 0.74, 0.05); h.sph('#0b0610', sx * ex, ey, ez + 0.06, er * 0.36, er * 0.46, 0.035); h.sph('#ffffff', sx * ex - 0.04, ey + 0.05, ez + 0.085, 0.03);
    if (spec.lids) h.sph(pA, sx * ex, ey + 0.075, ez + 0.03, er * 1.12, er * 0.62, 0.085);
    if (spec.brows) h.box(INK, sx * (ex - 0.02), ey + 0.18, ez + 0.04, 0.2, 0.05, 0.05, 0, 0, sx * -0.45);
  }
  h.sph(fur2, 0, -0.15, ez + 0.0, 0.2, 0.13, 0.1); h.sph('#f07a9a', 0, -0.07, ez + 0.08, 0.05, 0.035, 0.03);
  if (spec.tongue) h.sph('#ff7fa8', 0.01, -0.22, ez + 0.07, 0.045, 0.06, 0.03);
  else h.box(INK, 0, -0.17, ez + 0.09, 0.1, 0.015, 0.02);
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) h.box('#ffffff', sx * 0.38, -0.13 - i * 0.05, ez - 0.02, 0.26, 0.012, 0.012, 0, sx * -0.4, sx * (0.1 - i * 0.25));
  // head accessories
  if (A.bow) { h.cone(A.bow, -0.17, 0.5, 0.1, 0.16, 0.3, 0.1, 0, 0, -Math.PI / 2 + 0.2); h.cone(A.bow, 0.17, 0.5, 0.1, 0.16, 0.3, 0.1, 0, 0, Math.PI / 2 - 0.2); h.sph('#ff8fd0', 0, 0.5, 0.1, 0.08); }
  if (A.glasses) { for (const sx of [-1, 1]) { h.cyl('#2a1436', sx * ex, ey + 0.02, ez + 0.1, 0.17, 0.03, 0.15, Math.PI / 2); h.tor(A.glasses, sx * ex, ey + 0.02, ez + 0.11, 0.17, 0.16, 0.06); } h.box(A.glasses, 0, ey + 0.05, ez + 0.11, 0.14, 0.03, 0.03); }
  if (A.crown) { h.cyl(A.crown, 0, 0.5, 0, 0.16, 0.1); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; h.cone(A.crown, Math.sin(a) * 0.13, 0.6, Math.cos(a) * 0.13, 0.05, 0.14); } h.lo('#ff4fb8', 0, 0.52, 0.16, 0.035); }
  if (A.hat) { h.cyl(A.hat, 0, 0.46, 0, 0.5, 0.04); h.cyl(A.hat, 0, 0.56, 0, 0.3, 0.2); }
  if (A.cowboy) { h.cyl(A.cowboy, 0, 0.45, 0, 0.64, 0.04, 0.58); h.tor(A.cowboy, 0, 0.47, 0, 0.62, 0.3, 0.56, Math.PI / 2); h.cyl(A.cowboy, 0, 0.6, 0, 0.3, 0.26, 0.28); h.sph(A.cowboy, 0, 0.73, 0, 0.3, 0.1, 0.28); h.cyl(A.band || '#3a2140', 0, 0.51, 0, 0.31, 0.07, 0.29); }
  if (A.antlers) { for (const sx of [-1, 1]) { h.cyl(A.antlers, sx * 0.2, 0.62, -0.02, 0.035, 0.36, 0.035, 0, 0, -sx * 0.35); h.cyl(A.antlers, sx * 0.33, 0.7, -0.02, 0.03, 0.2, 0.03, 0, 0, -sx * 1.1); h.cyl(A.antlers, sx * 0.2, 0.78, -0.02, 0.028, 0.18, 0.028, 0, 0, sx * 0.5); } h.sph('#ff3355', 0, -0.07, 0.52, 0.07); }
  if (A.party) { h.cone(A.party, 0, 0.66, 0, 0.2, 0.46, 0.2); h.sph('#ffffff', 0, 0.9, 0, 0.07); for (let i = 0; i < 5; i++) { const a = i * 1.257; h.lo(i % 2 ? '#ffd23f' : '#2de2e6', Math.sin(a) * 0.14, 0.52 + (i % 3) * 0.08, Math.cos(a) * 0.14, 0.035); } }
  if (A.halo) h.tor(A.halo, 0, 0.74, 0, 0.26, 0.26, 0.3, Math.PI / 2);
  if (A.phones) { h.tor(A.phones, 0, 0.12, -0.02, 0.56, 0.5, 0.36); for (const sx of [-1, 1]) { h.sph(A.phones, sx * 0.56, 0.04, 0, 0.1, 0.18, 0.18); h.sph('#17101c', sx * 0.6, 0.04, 0, 0.07, 0.13, 0.13); } }
  if (A.flowers) for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.4; h.lo(A.flowers[i % A.flowers.length], Math.sin(a) * 0.42, 0.34 + Math.cos(a) * 0.14, 0.12, 0.085); h.lo('#ffd23f', Math.sin(a) * 0.42, 0.34 + Math.cos(a) * 0.14, 0.19, 0.035); }
  if (A.beanie) { h.sph(A.beanie, 0, 0.36, -0.02, 0.5, 0.3, 0.44); h.tor(A.trim2 || '#ffffff', 0, 0.3, -0.02, 0.5, 0.44, 0.5, Math.PI / 2); h.sph(A.trim2 || '#ffffff', 0, 0.68, -0.02, 0.1); }
  if (A.star) { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; h.cone(A.star, Math.sin(a) * 0.09, 0.62 + Math.cos(a) * 0.09, 0.05, 0.06, 0.16, 0.03, 0, 0, -a); } h.sph(A.star, 0, 0.62, 0.05, 0.08, 0.08, 0.03); }
  if (A.santa) { h.cyl('#ffffff', 0, 0.42, 0, 0.36, 0.1); h.cone('#e01e37', 0.06, 0.66, -0.04, 0.3, 0.5, 0.3, 0, 0, -0.35); h.sph('#ffffff', 0.24, 0.86, -0.04, 0.09); }
  const head = h.mesh(); head.position.set(0, 1.12, 0.1); inner.add(head);
  // ---- tool (Mimo's toy blaster), pivot at the paw ----
  let tool = null;
  if (spec.tool === 'blaster') {
    const w = new GB();
    w.box('#2de2e6', 0, 0, 0.2, 0.14, 0.16, 0.5); w.box('#ff4fb8', 0, 0, 0.5, 0.11, 0.11, 0.16); w.cyl('#ffb347', 0, 0, 0.6, 0.085, 0.06, 0.085, Math.PI / 2);
    w.box('#178a9c', 0, -0.13, 0.08, 0.1, 0.18, 0.1); w.sph('#bff4ff', 0, 0.12, 0.14, 0.1, 0.09, 0.14); w.sph('#ffffff', 0, 0.05, 0.3, 0.03);
    tool = w.mesh(); tool.position.set(-0.4, 0.58, 0.42); inner.add(tool);
  }
  const s = (spec.size || 1) * 1.22; inner.scale.setScalar(s);
  const HS = { wedge: [0.9, 1, 1.06], square: [1.08, 0.94, 1], long: [0.93, 1.12, 1] }[spec.headShape] || [1, 1, 1];
  g.userData = { inner, body, head, tail, legsA, legsB, tool, size: s, spec, hs: HS };
  return g;
}
// procedural animation. st: {t, walk(0/1), atk(0..1), down, sleepy, recoil, mouth, dance}
export function animCat(g, st) {
  const u = g.userData, t = st.t, w = st.walk ? 1 : 0;
  const bob = w ? Math.abs(Math.sin(t * 13)) * 0.09 : Math.sin(t * 2.6) * 0.015;
  u.inner.position.y = bob + (st.hop || 0);
  u.inner.rotation.set(0, st.spin || 0, 0);
  u.body.rotation.z = w ? Math.sin(t * 13) * 0.06 : 0;
  u.legsA.rotation.x = w ? Math.sin(t * 13) * 0.7 : 0; u.legsB.rotation.x = w ? -Math.sin(t * 13) * 0.7 : 0;
  u.tail.rotation.z = Math.sin(t * 4.2) * 0.35; u.tail.rotation.x = w ? -0.5 : Math.sin(t * 1.7) * 0.12;
  const atk = st.atk || 0;
  u.head.position.z = 0.1 + atk * 0.22; u.head.position.y = 1.12 + (w ? Math.sin(t * 13 + 1) * 0.02 : 0) - atk * 0.05;
  u.head.rotation.set(st.sleepy ? 0.28 + Math.sin(t * 2) * 0.05 : -atk * 0.25, 0, st.sleepy ? 0.12 : Math.sin(t * 1.3) * 0.03);
  const k = 1 + (st.mouth || 0) * 0.08, hs = u.hs || [1, 1, 1]; u.head.scale.set(k * hs[0], k * hs[1], k * hs[2]);
  u.body.position.z = atk * 0.1;
  if (u.tool) { u.tool.position.z = 0.42 - (st.recoil || 0) * 0.16; u.tool.rotation.x = -(st.recoil || 0) * 0.5; }
  if (st.down) { u.inner.rotation.z = Math.PI / 2 * 0.92; u.inner.position.y = 0.38 * u.size; u.legsA.rotation.x = 0.4; u.legsB.rotation.x = -0.3; } else u.inner.rotation.z = 0;
}

// ================= DOGS =================
export function buildDog(type, D) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const b = new GB(), fur = D.fur, fur2 = D.fur2, coat = D.coat, ac = D.accCol;
  if (D.vac) { b.cyl('#3a3f55', 0, 0.2, 0, 0.9, 0.3, 0.9); b.cyl('#596080', 0, 0.38, 0, 0.8, 0.12, 0.8); b.cyl('#8a90ad', 0, 0.3, 0.9, 0.16, 0.7, 0.16, Math.PI / 2 - 0.3); b.box('#ff4fb8', 0, 0.12, 1.25, 0.6, 0.14, 0.2); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; b.lo(i % 2 ? '#ff4fb8' : '#2de2e6', Math.sin(a) * 0.86, 0.26, Math.cos(a) * 0.86, 0.07); } }
  const by = D.vac ? 0.5 : 0;
  b.sph(coat, 0, 0.56 + by, -0.02, 0.46, 0.44, 0.52);
  b.sph(fur2, 0, 0.5 + by, 0.3, 0.26, 0.26, 0.24);
  if (D.acc === 'cop' || D.acc === 'chief') { b.box('#111', 0, 0.36 + by, 0, 0.95, 0.07, 1.06); b.lo('#ffd23f', -0.2, 0.74 + by, 0.38, 0.07); }
  if (D.acc === 'chief') { b.box('#ffd23f', -0.42, 0.86 + by, 0.05, 0.14, 0.06, 0.3); b.box('#ffd23f', 0.42, 0.86 + by, 0.05, 0.14, 0.06, 0.3); }
  if (D.acc === 'bandana') b.cone(ac, 0, 0.84 + by, 0.34, 0.2, 0.26, 0.08, Math.PI);
  if (D.acc === 'collar') b.tor(ac, 0, 0.92 + by, 0.06, 0.3, 0.3, 0.3, Math.PI / 2);
  if (D.acc === 'spikes') { b.tor('#17101c', 0, 0.94 + by, 0.08, 0.36, 0.4, 0.36, Math.PI / 2); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; b.cone(ac, Math.sin(a) * 0.4, 0.96 + by, Math.cos(a) * 0.4 + 0.08, 0.05, 0.14, 0.05, Math.PI / 2, 0, -a); } }
  if (D.acc === 'pom') for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; b.lo('#ffffff', Math.sin(a) * 0.4, 0.9 + by, Math.cos(a) * 0.4, 0.09); }
  if (D.acc === 'sailor') b.box('#ffffff', 0, 0.86 + by, -0.2, 0.7, 0.06, 0.5);
  // arms + legs + tail
  for (const sx of [-1, 1]) { b.sph(coat, sx * 0.44, 0.6 + by, 0.18, 0.15, 0.15, 0.22); b.sph(fur, sx * 0.44, 0.58 + by, 0.4, 0.13); if (!D.vac) { b.sph(fur, sx * 0.24, 0.16, 0.14, 0.15, 0.18, 0.2); b.sph(fur, sx * 0.24, 0.16, -0.26, 0.15, 0.18, 0.18); } }
  b.sph(fur, 0, 0.74 + by, -0.52, 0.09, 0.2, 0.09, -0.6);
  // weapon (right paw)
  const wx = -0.46, wy = 0.6 + by, wz = 0.46;
  if (D.wpn === 'baton') b.cyl('#17101c', wx, wy + 0.3, wz, 0.06, 0.8, 0.06, 0.3);
  if (D.wpn === 'launcher') { b.cyl('#70d44b', wx, wy, wz + 0.2, 0.13, 0.7, 0.13, Math.PI / 2); b.sph('#d7f25a', wx, wy, wz + 0.58, 0.14); }
  if (D.wpn === 'net') { b.cyl('#b98b55', wx, wy + 0.4, wz, 0.045, 1.2, 0.045, 0.25); b.tor('#ffffff', wx, wy + 1.15, wz + 0.18, 0.3, 0.3, 0.3, 0.25); b.lo('#dfe8ff', wx, wy + 1.15, wz + 0.1, 0.26, 0.26, 0.12); }
  if (D.wpn === 'perfume') { b.box('#bff4ff', wx, wy + 0.1, wz, 0.2, 0.26, 0.14); b.box('#ffd23f', wx, wy + 0.28, wz, 0.1, 0.1, 0.1); }
  if (D.wpn === 'anchor') { b.cyl('#aab3c2', wx, wy + 0.35, wz, 0.06, 1.0, 0.06, 0.25); b.tor('#aab3c2', wx, wy - 0.05, wz - 0.1, 0.26, 0.3, 0.26, 0.25); }
  const body = b.mesh(); inner.add(body);
  // head
  const h = new GB(), earC = D.earCol || fur;
  h.sph(fur, 0, 0, 0, 0.5, 0.45, 0.46);
  h.sph(fur2, 0, -0.14, 0.34, 0.3, 0.23, 0.26); h.sph('#17101c', 0, -0.05, 0.58, 0.11, 0.08, 0.07);
  if (D.jowl) { for (const sx of [-1, 1]) { h.sph(fur2, sx * 0.2, -0.3, 0.34, 0.17, 0.16, 0.16); h.cone('#ffffff', sx * 0.13, -0.2, 0.52, 0.035, 0.11, 0.035); } }
  if (D.stache) for (const sx of [-1, 1]) h.sph('#e9e9ee', sx * 0.2, -0.16, 0.52, 0.18, 0.07, 0.07, 0, 0, sx * 0.3);
  if (D.ear === 'flop') for (const sx of [-1, 1]) h.sph(earC, sx * 0.46, 0.06, -0.02, 0.12, 0.28, 0.2, 0, 0, sx * 0.3);
  else if (D.ear === 'long') for (const sx of [-1, 1]) h.sph(earC, sx * 0.48, -0.12, -0.04, 0.1, 0.42, 0.18, 0, 0, sx * 0.15);
  else if (D.ear === 'point') for (const sx of [-1, 1]) h.cone(earC, sx * 0.28, 0.5, -0.04, 0.14, 0.42, 0.1);
  else if (D.ear === 'big') for (const sx of [-1, 1]) { h.cone(earC, sx * 0.36, 0.5, -0.02, 0.24, 0.56, 0.1, 0, 0, -sx * 0.4); h.cone('#f4a9b8', sx * 0.36, 0.48, 0.04, 0.14, 0.4, 0.06, 0, 0, -sx * 0.4); }
  else if (D.ear === 'pom') for (const sx of [-1, 1]) { h.lo(earC, sx * 0.52, -0.05, 0, 0.24, 0.3, 0.24); }
  else if (D.ear === 'pug') for (const sx of [-1, 1]) h.cone(fur2, sx * 0.36, 0.36, 0, 0.16, 0.2, 0.1, 0, 0, -sx * 0.7);
  if (D.acc === 'shades') { for (const sx of [-1, 1]) h.box('#111111', sx * 0.2, 0.08, 0.43, 0.28, 0.16, 0.06); h.box('#ff4fb8', 0, 0.12, 0.44, 0.7, 0.04, 0.05); }
  else for (const sx of [-1, 1]) { h.sph('#ffffff', sx * 0.2, 0.08, 0.4, 0.12, 0.12, 0.06); h.sph('#17101c', sx * 0.2, 0.07, 0.445, 0.06, 0.07, 0.03); h.box(INK, sx * 0.2, 0.22, 0.43, 0.24, 0.06, 0.06, 0, 0, sx * -0.4); }
  const a = D.acc;
  if (a === 'cop' || a === 'chief') { h.cyl(ac, 0, 0.42, 0, 0.42, 0.2, 0.42); h.box('#111', 0, 0.36, 0.36, 0.6, 0.05, 0.3); h.lo('#ffd23f', 0, 0.44, 0.4, 0.08); if (a === 'chief') h.cyl('#ffd23f', 0, 0.55, 0, 0.43, 0.06, 0.43); }
  if (a === 'cap') { h.sph(ac, 0, 0.36, 0, 0.44, 0.2, 0.42); h.box(ac, 0, 0.32, 0.42, 0.5, 0.05, 0.34); }
  if (a === 'sailor') { h.cyl('#ffffff', 0, 0.48, 0, 0.38, 0.2, 0.38); h.cyl('#16224f', 0, 0.38, 0, 0.42, 0.06, 0.42); h.lo('#ffd23f', 0, 0.5, 0.36, 0.06); }
  if (a === 'pom') h.lo(ac, 0, 0.52, 0, 0.34, 0.3, 0.34);
  if (a === 'crown') { h.cyl(ac, 0, 0.46, 0, 0.3, 0.14, 0.3); for (let i = 0; i < 5; i++) { const an = i / 5 * 6.283; h.cone(ac, Math.sin(an) * 0.26, 0.6, Math.cos(an) * 0.26, 0.08, 0.2); } }
  const head = h.mesh(); head.position.set(0, 1.18 + by, 0.14); inner.add(head);
  inner.scale.setScalar(D.s * 1.15);
  g.userData = { inner, body, head, size: D.s * 1.15, hy: 1.18 + by };
  return g;
}
export function animDog(g, st) {
  const u = g.userData, t = st.t, w = st.walk ? 1 : 0, wind = st.wind || 0;
  u.inner.position.y = w ? Math.abs(Math.sin(t * 11)) * 0.08 * u.size : 0;
  u.inner.rotation.z = w ? Math.sin(t * 11) * 0.09 : 0;
  u.inner.rotation.x = -wind * 0.35 + (st.lunge || 0) * 0.3;
  u.head.rotation.z = st.stun ? Math.sin(t * 8) * 0.3 : 0; u.head.rotation.x = st.stun ? 0.3 : -wind * 0.2;
  u.head.position.y = u.hy + Math.sin(t * 3) * 0.01;
}

// ================= CARS (facing +Z) =================
export function buildCar(type, K, col) {
  const g = new THREE.Group(), b = new GB();
  const S = 1 / 24, L = K.len * S, W = K.wid * S, body = col ? col[0] : K.body, body2 = col ? col[1] : K.body2, hl = L / 2, hw = W / 2;
  for (const z of [-hl * 0.62, hl * 0.58]) for (const sx of [-1, 1]) { b.cyl('#120a18', sx * (hw - 0.02), 0.3, z, 0.3, 0.26, 0.3, 0, 0, Math.PI / 2); b.cyl('#c0c7d1', sx * (hw + 0.115), 0.3, z, 0.14, 0.03, 0.14, 0, 0, Math.PI / 2); }
  if (K.pickup) { // farm pickup: cab in front, open bed with hay
    b.box(body, 0, 0.6, 0, W, 0.5, L); b.box(body2, 0, 0.36, 0, W + 0.04, 0.12, L - 0.1);
    b.box(body, 0, 1.12, 0.35, W - 0.1, 0.6, 1.3); b.box('#9fe8ff', 0, 1.15, 1.01, W - 0.3, 0.42, 0.06); for (const sx of [-1, 1]) b.box('#9fe8ff', sx * (hw - 0.04), 1.15, 0.35, 0.04, 0.4, 0.9);
    for (const sx of [-1, 1]) b.box(body, sx * (hw - 0.05), 0.98, -hl * 0.55, 0.1, 0.3, L * 0.4); b.box(body, 0, 0.98, -hl + 0.06, W, 0.3, 0.1);
    b.box('#e8c860', 0, 1.0, -hl * 0.55, W - 0.4, 0.44, 0.9); b.box('#c9a43c', 0, 1.0, -hl * 0.55, W - 0.38, 0.06, 0.92); b.box('#c0c7d1', 0, 0.42, hl + 0.06, W + 0.1, 0.16, 0.12);
  } else if (K.truck) {
    b.box(body2, 0, 0.75, hl - 0.6, W, 0.9, 1.2); b.box('#9fe8ff', 0, 1.0, hl - 0.05, W - 0.2, 0.36, 0.12); b.box('#fff7dc', 0, 1.15, -0.65, W + 0.06, 1.7, L - 1.5);
    b.box(body, 0, 0.4, 0, W, 0.2, L); for (const sx of [-1, 1]) { b.sph('#ffb347', sx * (hw + 0.04), 1.2, -0.7, 0.03, 0.34, 0.6); b.cone('#ff9a3d', sx * (hw + 0.04), 1.2, -1.45, 0.03, 0.4, 0.3, Math.PI / 2); }
    b.box('#ff8a3d', 0, 0.45, -hl, W, 0.14, 0.1);
  } else if (K.van) {
    b.box(body, 0, 0.9, -0.1, W, 1.2, L - 0.3); b.box(body2, 0, 1.0, -0.55, W + 0.04, 0.8, L * 0.6); b.box('#9fe8ff', 0, 1.2, hl - 0.2, W - 0.2, 0.44, 0.12);
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) b.box('#17101c', sx * (hw + 0.03), 1.0, -hl * 0.75 + i * 0.26, 0.03, 0.74, 0.05);
    b.box(body2, 0, 0.6, hl - 0.15, W, 0.5, 0.5);
  } else {
    b.box(body, 0, 0.55, 0, W, 0.46, L); b.box(body2, 0, 0.56, 0, W + 0.03, 0.1, L - 0.2);
    b.box(body, 0, 0.72, hl - 0.7, W - 0.16, 0.14, 1.0); b.box(body, 0, 0.72, -hl + 0.55, W - 0.16, 0.14, 0.8);
    if (K.conv) {
      b.box('#3a0f2e', 0, 0.74, -0.25, W - 0.3, 0.12, L * 0.42); b.box('#bff4ff', 0, 0.98, 0.52, W - 0.24, 0.4, 0.06, -0.3);
      b.box('#5a1f48', -0.38, 0.9, -0.2, 0.5, 0.36, 0.2); b.box('#5a1f48', 0.38, 0.9, -0.2, 0.5, 0.36, 0.2); b.box('#5a1f48', 0, 0.9, -0.95, W - 0.4, 0.3, 0.2);
      b.box('#ffffff', 0, 0.8, hl - 0.7, 0.2, 0.02, 1.0); // racing stripe
    } else {
      const cl = K.limo ? L * 0.62 : L * 0.46;
      b.add(PR.taper, '#231433', 0, 1.0, -0.15, hw - 0.04, 0.46, cl / 2 * 1.42, 0, Math.PI / 4); b.box(body, 0, 1.24, -0.15, W - 0.5, 0.05, cl * 0.62);
      if (K.cop) { b.box(body2, 0, 0.56, -hl + 0.6, W + 0.04, 0.44, 0.6); b.box(body2, 0, 0.56, hl - 0.7, W + 0.04, 0.44, 0.3); b.box('#ff2040', -0.25, 1.33, -0.15, 0.4, 0.12, 0.22); b.box('#2a6bff', 0.25, 1.33, -0.15, 0.4, 0.12, 0.22); }
      if (K.taxi) b.box('#17101c', 0, 1.33, -0.15, 0.5, 0.16, 0.24);
    }
  }
  for (const sx of [-1, 1]) { b.box('#fff6b0', sx * (hw - 0.3), 0.6, hl, 0.34, 0.14, 0.06); b.box('#ff3355', sx * (hw - 0.3), 0.6, -hl, 0.34, 0.14, 0.06); }
  b.box('#c0c7d1', 0, 0.36, hl + 0.02, W - 0.1, 0.1, 0.08); b.box('#c0c7d1', 0, 0.36, -hl - 0.02, W - 0.1, 0.1, 0.08);
  const mesh = b.mesh(MAT.flat); g.add(mesh);
  let heads = null;
  if (K.conv) { // the three passengers
    const hgb = new GB();
    hgb.sph('#f7ead0', -0.38, 1.22, 0.02, 0.26); hgb.cone('#f7ead0', -0.52, 1.46, 0.02, 0.08, 0.16); hgb.cone('#f7ead0', -0.24, 1.46, 0.02, 0.08, 0.16);
    hgb.sph('#fffaf2', 0.38, 1.22, 0.02, 0.26); hgb.sph('#f28a2e', 0.3, 1.34, 0, 0.16); hgb.sph('#2b1f24', 0.5, 1.34, 0, 0.14); hgb.cone('#ff3fa4', 0.26, 1.5, 0.04, 0.09, 0.2, 0.06, 0, 0, 1.3); hgb.cone('#ff3fa4', 0.5, 1.5, 0.04, 0.09, 0.2, 0.06, 0, 0, -1.3);
    hgb.sph('#3a2e45', 0, 1.14, -0.72, 0.2); hgb.cone('#3a2e45', -0.1, 1.33, -0.72, 0.06, 0.12); hgb.cone('#3a2e45', 0.1, 1.33, -0.72, 0.06, 0.12); hgb.lo('#ffc928', -0.07, 1.16, -0.54, 0.04); hgb.lo('#ffc928', 0.07, 1.16, -0.54, 0.04);
    heads = hgb.mesh(); heads.visible = false; g.add(heads);
  }
  g.userData = { mesh, heads };
  return g;
}

// ================= ITEMS =================
const itemCache = {};
export function itemGeo(k) {
  if (itemCache[k]) return itemCache[k];
  const b = new GB();
  switch (k) {
    case 'treat': b.sph('#ffb347', 0, 0, 0, 0.3, 0.2, 0.1); b.cone('#ff9a3d', 0.36, 0, 0, 0.2, 0.24, 0.06, 0, 0, Math.PI / 2); b.lo(INK, -0.16, 0.05, 0.09, 0.04); b.lo(INK, -0.16, 0.05, -0.09, 0.04); break;
    case 'bone': b.cyl('#fff8e8', 0, 0, 0, 0.07, 0.5, 0.07, 0, 0, Math.PI / 2); for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.sph('#fff8e8', sx * 0.26, sy * 0.08, 0, 0.11); break;
    case 'donut': b.tor('#ff7ac0', 0, 0, 0, 0.22, 0.24, 0.3); b.tor('#e9b872', 0, 0, -0.03, 0.22, 0.24, 0.26); break;
    case 'steak': b.sph('#e2574c', 0, 0, 0, 0.32, 0.24, 0.1); b.sph('#ff9d94', -0.05, 0, 0.06, 0.16, 0.12, 0.06); b.sph('#fff8e8', 0.2, 0.05, 0.06, 0.07); break;
    case 'sushi': b.box('#ffffff', 0, -0.06, 0, 0.5, 0.2, 0.28); b.box('#ff8a5c', 0, 0.08, 0, 0.54, 0.12, 0.3); b.box('#1e2b22', 0, 0, 0, 0.14, 0.34, 0.32); break;
    case 'hotdog': b.cyl('#e9b872', 0, -0.03, 0, 0.13, 0.6, 0.16, 0, 0, Math.PI / 2); b.cyl('#d1483b', 0, 0.07, 0, 0.09, 0.68, 0.09, 0, 0, Math.PI / 2); b.box('#ffd23f', 0, 0.15, 0, 0.5, 0.03, 0.04); break;
    case 'coffee': b.cyl('#ffffff', 0, 0, 0, 0.2, 0.36, 0.2); b.cyl('#6b3f22', 0, 0.185, 0, 0.17, 0.01, 0.17); b.tor('#ffffff', 0.24, 0, 0, 0.11, 0.12, 0.11); b.cyl('#ff4fb8', 0, -0.04, 0, 0.205, 0.1, 0.205); break;
    case 'gpaw': case 'paw': b.sph('#ffd23f', 0, -0.08, 0, 0.24, 0.2, 0.09); for (const [x, y] of [[-0.26, 0.12], [-0.09, 0.26], [0.09, 0.26], [0.26, 0.12]]) b.sph('#ffd23f', x, y, 0, 0.1, 0.12, 0.08); b.sph('#fff3a8', -0.05, -0.05, 0.07, 0.08, 0.06, 0.03); break;
    case 'cash': b.cyl('#3fcf55', 0, 0, 0, 0.26, 0.07, 0.26, Math.PI / 2); b.cyl('#7CFF6B', 0, 0, 0, 0.19, 0.09, 0.19, Math.PI / 2); b.box('#0d3b16', 0, 0, 0, 0.05, 0.22, 0.11); break;
    case 'catnip': for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; b.sph('#7CFF6B', Math.sin(a) * 0.16, 0.05 + Math.cos(a) * 0.16, 0, 0.14, 0.2, 0.04, 0, 0, -a); } b.cyl('#2e9e3f', 0, -0.2, 0, 0.03, 0.3, 0.03); break;
    case 'milk': b.box('#ffffff', 0, 0, 0, 0.28, 0.4, 0.28); b.box('#4cc9f0', 0, -0.04, 0, 0.29, 0.12, 0.29); b.cone('#bfe9ff', 0, 0.27, 0, 0.2, 0.14, 0.2, 0, Math.PI / 4); break;
    case 'key': b.tor('#ffd23f', -0.16, 0, 0, 0.13, 0.16, 0.13); b.box('#ffd23f', 0.14, 0, 0, 0.4, 0.07, 0.06); b.box('#ffd23f', 0.24, -0.08, 0, 0.06, 0.12, 0.06); b.box('#ffd23f', 0.33, -0.07, 0, 0.06, 0.1, 0.06); break;
    case 'kite': case 'kite1': case 'kite2': case 'kite3': case 'kite4': { const cs = { kite: ['#ff4fb8', '#ffd23f'], kite1: ['#2de2e6', '#ffffff'], kite2: ['#ffd23f', '#ff5a3d'], kite3: ['#7CFF6B', '#2de2e6'], kite4: ['#b967ff', '#ff9fe0'] }[k];
      b.box(cs[0], 0, 0.05, 0, 0.62, 0.62, 0.03, 0, 0, Math.PI / 4); b.box(cs[1], 0, 0.05, 0.01, 0.3, 0.3, 0.035, 0, 0, Math.PI / 4); b.box('#3a2140', 0, 0.05, 0.02, 0.03, 0.86, 0.02); b.box('#3a2140', 0, 0.05, 0.02, 0.86, 0.03, 0.02);
      for (let i = 0; i < 4; i++) b.box(i % 2 ? cs[0] : cs[1], Math.sin(i * 1.3) * 0.07, -0.5 - i * 0.2, 0, 0.13, 0.08, 0.02, 0, 0, i % 2 ? 0.5 : -0.5); break; }
    case 'ball': b.sph('#ffffff', 0, 0, 0, 0.3); b.tor('#2de2e6', 0, 0, 0, 0.3, 0.3, 0.3); b.tor('#ffd23f', 0, 0, 0, 0.3, 0.3, 0.3, Math.PI / 2); b.tor('#ff4fb8', 0, 0, 0, 0.3, 0.3, 0.3, 0, Math.PI / 2); break;
    case 'bag': b.sph('#c98f4b', 0, -0.05, 0, 0.3, 0.34, 0.26); b.cyl('#a8743a', 0, 0.26, 0, 0.13, 0.14, 0.13); b.tor('#ff4f5e', 0, 0.2, 0, 0.15, 0.15, 0.2, Math.PI / 2); b.sph('#ffb347', 0, -0.05, 0.25, 0.1, 0.07, 0.03); b.cone('#ff9a3d', 0.12, -0.05, 0.25, 0.07, 0.09, 0.03, 0, 0, Math.PI / 2); break;
    case 'gcoin': b.cyl('#ffd23f', 0, 0, 0, 0.26, 0.06, 0.26, Math.PI / 2); b.cyl('#fff3a8', 0, 0, 0.01, 0.19, 0.07, 0.19, Math.PI / 2); b.sph('#ffb300', 0, -0.03, 0.05, 0.08, 0.07, 0.02); for (const [x, y] of [[-0.09, 0.05], [0, 0.1], [0.09, 0.05]]) b.sph('#ffb300', x, y, 0.05, 0.04, 0.045, 0.02); break;
    case 'bobber': b.sph('#ff3355', 0, 0.06, 0, 0.14, 0.12, 0.14); b.sph('#ffffff', 0, -0.05, 0, 0.14, 0.1, 0.14); b.cyl('#3a2140', 0, 0.24, 0, 0.015, 0.2, 0.015); break;
    default: b.sph('#ffffff', 0, 0, 0, 0.2);
  }
  return (itemCache[k] = b.geo());
}

// ================= PROPS =================
const S = 1 / 24;
export function buildProp(p, pal) {
  const b = new GB(); let alt = null, mat = MAT.flat;
  const neon = pal ? pal.neon : ['#ff4fb8', '#2de2e6', '#ffd23f'];
  switch (p.k) {
    case 'stand': {
      const cols = { hotdog: ['#ff4f5e', '#ffffff'], sushi: ['#2de2e6', '#ffffff'], donut: ['#ff7ac0', '#fff3a8'] }[p.food] || ['#ff4f5e', '#fff'];
      b.box('#f4e3c1', 0, 0.6, 0, 2.0, 0.8, 1.0); b.box('#d9b47c', 0, 1.02, 0, 2.1, 0.08, 1.1);
      for (const sx of [-1, 1]) { b.cyl('#3a2140', sx * 0.7, 0.2, 0.4, 0.2, 0.12, 0.2, 0, 0, Math.PI / 2); b.cyl('#1a0d24', sx * 0.95, 1.5, 0.45, 0.04, 1.0, 0.04); b.cyl('#1a0d24', sx * 0.95, 1.5, -0.45, 0.04, 1.0, 0.04); }
      for (let i = 0; i < 6; i++) b.box(cols[i % 2], -0.92 + i * 0.37, 2.05, 0, 0.37, 0.1, 1.5, 0.12);
      b.box(cols[0], 0, 1.9, 0.76, 2.22, 0.24, 0.04);
      break;
    }
    case 'crate': b.box('#c98f4b', 0, 0.75, 0, 1.6, 1.5, 1.6); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('#8a5a2b', sx * 0.78, 0.75, sz * 0.78, 0.14, 1.56, 0.14); b.box('#8a5a2b', 0, 1.48, 0, 1.7, 0.1, 1.7); b.box('#8a5a2b', 0, 0.05, 0, 1.7, 0.1, 1.7); b.box('#8a5a2b', 0, 0.75, 0.81, 0.14, 1.9, 0.03, 0, 0, 0.78); b.box('#8a5a2b', 0, 0.75, -0.81, 0.14, 1.9, 0.03, 0, 0, 0.78); break;
    case 'trash': b.cyl('#6f7d8c', 0, 0.5, 0, 0.42, 1.0, 0.42); b.cyl('#8b99a8', 0, 1.04, 0, 0.47, 0.1, 0.47); b.cyl('#4c5866', 0, 0.5, 0, 0.44, 0.08, 0.44); break;
    case 'fgate': { const hor = p.w > p.h, n = 8; for (let i = 0; i < n; i++) { const o = -1.75 + i * 0.5; b.box(i % 2 ? '#c98f4b' : '#b57d3c', hor ? o : 0, 0.9, hor ? 0 : o, hor ? 0.44 : 0.14, 1.8 + (i % 2) * 0.1, hor ? 0.14 : 0.44); } b.box('#8a5a2b', 0, 0.5, 0, hor ? 4 : 0.2, 0.14, hor ? 0.2 : 4); b.box('#8a5a2b', 0, 1.3, 0, hor ? 4 : 0.2, 0.14, hor ? 0.2 : 4); break; }
    case 'laser': case 'vlaser': {
      const hor = p.w > p.h, half = (hor ? p.w : p.h) * S / 2; mat = MAT.glow;
      for (const s of [-1, 1]) b.box('#596080', hor ? s * half : 0, 0.9, hor ? 0 : s * half, 0.24, 1.8, 0.24);
      for (let i = 0; i < 3; i++) b.box('#ff3355', 0, 0.4 + i * 0.5, 0, hor ? half * 2 : 0.07, 0.07, hor ? 0.07 : half * 2);
      break;
    }
    case 'switch': b.cyl('#8a90ad', 0, 0.6, 0, 0.07, 1.2, 0.07); b.cyl('#596080', 0, 0.06, 0, 0.3, 0.12, 0.3); b.sph('#ffffff', 0, 1.36, 0, 0.36); b.sph('#ff3355', 0, 1.36, 0, 0.3, 0.3, 0.42); mat = MAT.glow;
      alt = new GB(); alt.cyl('#8a90ad', 0, 0.6, 0, 0.07, 1.2, 0.07); alt.cyl('#596080', 0, 0.06, 0, 0.3, 0.12, 0.3); alt.sph('#ffffff', 0, 1.36, 0, 0.36); alt.sph('#7CFF6B', 0, 1.36, 0, 0.3, 0.3, 0.42); break;
    case 'sdoor': { const hor = p.w > p.h; b.box('#7c8799', 0, 1.1, 0, hor ? 4 : 0.3, 2.2, hor ? 0.3 : 4); b.box('#5d6777', 0, 1.6, 0, hor ? 3.8 : 0.34, 0.12, hor ? 0.34 : 3.8); b.box('#5d6777', 0, 0.5, 0, hor ? 3.8 : 0.34, 0.12, hor ? 0.34 : 3.8); b.cyl(p.key ? '#ffd23f' : '#ff4f5e', 0, 1.1, hor ? 0.18 : 0, 0.3, 0.08, 0.3, Math.PI / 2, 0, hor ? 0 : Math.PI / 2); break; }
    case 'lever': b.box('#596080', 0, 0.2, 0, 0.9, 0.4, 0.5); b.cyl('#c0c7d1', -0.2, 0.7, 0, 0.06, 0.9, 0.06, 0, 0, 0.5); b.sph('#ff4f5e', -0.42, 1.08, 0, 0.16);
      alt = new GB(); alt.box('#596080', 0, 0.2, 0, 0.9, 0.4, 0.5); alt.cyl('#c0c7d1', 0.2, 0.7, 0, 0.06, 0.9, 0.06, 0, 0, -0.5); alt.sph('#7CFF6B', 0.42, 1.08, 0, 0.16); break;
    case 'loot': b.box('#c9964f', 0, 0.45, 0, 1.3, 0.9, 0.9); b.cyl('#e0b060', 0, 0.9, 0, 0.45, 1.3, 0.45, 0, 0, Math.PI / 2); b.box('#ffd23f', 0, 0.7, 0.46, 0.24, 0.3, 0.06); b.box('#8a5a2b', -0.45, 0.6, 0, 0.1, 1.24, 0.94); b.box('#8a5a2b', 0.45, 0.6, 0, 0.1, 1.24, 0.94);
      alt = new GB(); alt.box('#8a5a2b', 0, 0.3, 0, 1.3, 0.6, 0.9); break;
    case 'cage': b.box('#596080', 0, 0.12, 0, 1.9, 0.24, 1.9); b.box('#8a90ad', 0, 2.1, 0, 1.9, 0.2, 1.9); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { b.cyl('#c0c7d1', -0.84 + i * 0.42, 1.1, s * 0.84, 0.045, 1.9, 0.045); b.cyl('#c0c7d1', s * 0.84, 1.1, -0.84 + i * 0.42, 0.045, 1.9, 0.045); }
      b.box(p.lock === 'key' ? '#ffd23f' : p.lock === 'bite' ? '#c98f4b' : '#ff4f5e', 0, 1.1, 0.9, 0.36, 0.36, 0.12);
      alt = new GB(); alt.box('#596080', 0, 0.12, 0, 1.9, 0.24, 1.9); alt.box('#8a90ad', 0.9, 1.0, 0, 0.14, 1.9, 1.9); break;
    case 'house':
      if (p.tree) { b.cyl('#6a4a3b', 0, 0.5, 0, 0.3, 1.0, 0.3); for (let i = 0; i < 4; i++) b.cone('#1f8f5a', 0, 1.6 + i * 1.1, 0, 2.0 - i * 0.42, 1.8, 2.0 - i * 0.42); b.sph('#ffd23f', 0, 6.0, 0, 0.3); for (let i = 0; i < 16; i++) { const a = i * 2.4, y = 1.2 + i * 0.26, r = 1.7 - i * 0.09; b.lo(neon[i % 3], Math.sin(a) * r, y, Math.cos(a) * r, 0.14); } }
      else if (p.gen) { b.box('#596080', 0, 1.0, 2.6, 2.6, 2.0, 1.8); b.box('#17101c', -0.5, 1.2, 3.52, 1.1, 0.8, 0.06); b.box('#ffd23f', 0, 0.35, 3.52, 2.2, 0.3, 0.06); b.cyl('#3a3f55', 0.8, 2.3, 2.4, 0.2, 0.7, 0.2); for (let i = 0; i < 4; i++) b.box('#7CFF6B', -0.86 + i * 0.24, 1.1 + (i % 2) * 0.1, 3.56, 0.14, 0.3 + (i % 3) * 0.14, 0.03); }
      else b.box('#000', 0, -5, 0, 0.01, 0.01, 0.01);
      break;
    case 'vwall': { // 4x4-tile concrete vault ring (hole at the flap is just visual: the laser prop sits there)
      const R = 4, h = 2.6;
      for (const s of [-1, 1]) { b.box('#7c8799', 0, h / 2, s * 3, 8, h, 2); b.box('#9aa5b8', 0, h + 0.06, s * 3, 8.1, 0.12, 2.1); }
      b.box('#7c8799', 3, h / 2, 0, 2, h, 4); b.box('#9aa5b8', 3, h + 0.06, 0, 2.1, 0.12, 4);
      b.box('#7c8799', -3, h / 2, -1, 2, h, 2); b.box('#7c8799', -3, h * 0.72, 1, 2, h * 0.56, 2); b.box('#9aa5b8', -3, h + 0.06, 0, 2.1, 0.12, 4);
      b.box('#17101c', -4.02, 0.6, 1, 0.06, 1.2, 1.0); b.box('#ffd23f', -4.05, 1.5, 1, 0.06, 0.3, 0.5); void R;
      break;
    }
    case 'flap': b.box('#7c8799', 0, 1.0, 0, p.hor ? 0.3 : 2.0, 2.0, p.hor ? 2.0 : 0.3); b.box('#17101c', 0, 0.5, 0, p.hor ? 0.34 : 0.9, 1.0, p.hor ? 0.9 : 0.34); b.box('#ffd23f', 0, 1.4, 0, p.hor ? 0.36 : 0.4, 0.3, p.hor ? 0.4 : 0.36); break;
    case 'nook': b.box('#c0c7d1', -1, 1.0, -1, 0.1, 0.06, 2.0); b.box('#c0c7d1', -1, 0.5, -1, 0.1, 0.06, 2.0); b.box('#c0c7d1', 1, 1.0, 1, 2.0, 0.06, 0.1); b.box('#c0c7d1', 1, 0.5, 1, 2.0, 0.06, 0.1); for (const [x, z] of [[-1, -2], [-1, 0], [0, 1], [2, 1]]) b.box('#8a90ad', x, 0.65, z, 0.16, 1.3, 0.16); break;
    default: return null;
  }
  const m = b.mesh(mat);
  if (alt) { m.userData.geoA = m.geometry; m.userData.geoB = alt.geo(); }
  return m;
}
export { THREE, PR };
