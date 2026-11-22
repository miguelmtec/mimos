// VICE PAWS — low-poly models built from primitives (merged, vertex-coloured): parametric cats, dogs, cars, props, items
import * as THREE from '../../vendor/three.module.min.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Matrix3();
const PR = {
  sph: new THREE.SphereGeometry(1, 12, 9).toNonIndexed(), mid: new THREE.SphereGeometry(1, 8, 6).toNonIndexed(), lo: new THREE.SphereGeometry(1, 7, 5).toNonIndexed(),
  box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), cyl: new THREE.CylinderGeometry(1, 1, 1, 10).toNonIndexed(),
  cone: new THREE.ConeGeometry(1, 1, 8).toNonIndexed(), tor: new THREE.TorusGeometry(1, 0.22, 5, 12).toNonIndexed(),
  taper: new THREE.CylinderGeometry(0.6, 1, 1, 8).toNonIndexed(), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).toNonIndexed(),
  pet: new THREE.SphereGeometry(1, 6, 4).toNonIndexed(), gem: new THREE.OctahedronGeometry(1, 0).toNonIndexed(), torf: new THREE.TorusGeometry(1, 0.12, 4, 16).toNonIndexed(),
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
  pet(col, x, y, z, sx, sy, sz, rx, ry, rz) { return this.add(PR.pet, col, x, y, z, sx, sy, sz, rx, ry, rz); }
  gem(col, x, y, z, sx, sy, sz, rx, ry, rz) { return this.add(PR.gem, col, x, y, z, sx, sy, sz, rx, ry, rz); }
  ring(col, x, y, z, rx, rz, th, ax, ay, az) { return this.add(PR.torf, col, x, y, z, rx, rz === undefined ? rx : rz, th === undefined ? (rx + (rz === undefined ? rx : rz)) / 2 : th, ax === undefined ? Math.PI / 2 : ax, ay, az); }   // thin ring, lies flat (xz plane) by default
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
export const premiumTick = () => premTick();
export function setDetail(low) { GB.low = !!low; }
export const MAT = {
  lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
  flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
  ghost: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.4 }),
  white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  // paid looks: shiny gold / chrome (specular + pulsing warm emissive), neon (unlit, pulsing), glossy plastic, additive sparkle
  gold: new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0xfff0b8, shininess: 95, emissive: 0x4a3410, emissiveIntensity: 0.6 }),
  gloss: new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0xffffff, shininess: 110 }),
  neon: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
  spark: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
};
// shared pulse of the premium materials (called from animCat, at most once per frame)
let _pt = -1;
function premTick() {
  const T = performance.now() * 0.001; if (T - _pt < 0.012) return; _pt = T;
  MAT.gold.emissiveIntensity = 0.55 + 0.4 * Math.sin(T * 2.6);
  const k = 0.8 + 0.2 * Math.sin(T * 3.3); MAT.neon.color.setRGB(k, k, k);
  MAT.spark.opacity = 0.72 + 0.28 * Math.sin(T * 5.1);
}
const goldish = c => { if (!c || typeof c !== 'string' || c[0] !== '#' || c.length < 7) return false; const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return r > 190 && g > 140 && b < 120 && r >= g; };
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
  // premium layers: metal (bm/hm = body/head, Phong + pulsing emissive), neon (bn/hn, unlit + pulse) and animated parts (later)
  const bm = new GB(), bn = new GB(), hm = new GB(), hn = new GB(), later = [];
  const lat = (on, gb, mat, x, y, z, k, a, sp, ph) => { if (gb.p.length) later.push({ on, gb, mat, x, y, z, k, a: a || 0, s: sp || 1, p: ph || 0 }); };
  // ---- body ----
  const b = new GB();
  const coat = A.hoodie || A.jacket || null;
  b.sph(fur, 0, 0.5, -0.04, 0.4, 0.38, 0.47);
  if (spec.pattern === 'tuxedo' || spec.pattern === 'points') b.sph(fur2, 0, 0.47, 0.2, 0.26, 0.28, 0.3);
  if (spec.pattern === 'calico' && !coat) { b.sph(pA, -0.22, 0.62, -0.2, 0.24, 0.2, 0.26); b.sph(pB, 0.24, 0.55, -0.05, 0.2, 0.22, 0.24); }
  if (spec.pattern === 'spotted' && !coat) for (let i = 0; i < 12; i++) { const a = i * 2.4, yy = 0.4 + (i % 4) * 0.09; b.lo(pA, Math.sin(a) * 0.37, yy, Math.cos(a) * 0.42 - 0.04, 0.075, 0.06, 0.075); }
  if (spec.pattern === 'tabby') for (let i = 0; i < 3; i++) b.tor(pA, 0, 0.52, -0.3 + i * 0.2, 0.39 - Math.abs(i - 1) * 0.04, 0.4, 0.3, 0, 0, 0);
  if (A.shirt) { b.sph(A.shirt, 0, 0.5, 0.0, 0.42, 0.36, 0.44); if (A.shirt2) for (let i = 0; i < 9; i++) { const a = i * 2.4, yy = 0.36 + (i % 3) * 0.12; b.lo(A.shirt2, Math.sin(a) * 0.38, yy, Math.cos(a) * 0.36 + 0.02, 0.07, 0.07, 0.07); }
    if (A.floral) for (let i = 0; i < 7; i++) { const a = -1.5 + i * 0.5, yy = 0.34 + (i % 3) * 0.13, fx = Math.sin(a) * 0.4, fz = Math.cos(a) * 0.38 + 0.02; for (let k = 0; k < 5; k++) { const q = k * 1.257 + i; b.pet(i % 2 ? A.floral : '#ffffff', fx + Math.cos(q) * 0.06, yy + Math.sin(q) * 0.06, fz + 0.01, 0.045, 0.045, 0.03); } b.pet('#ffd23f', fx, yy, fz + 0.03, 0.035, 0.035, 0.03); }
    if (A.check) { for (let i = 0; i < 4; i++) b.ring(A.shirt2 || '#17101c', 0, 0.28 + i * 0.13, 0.0, 0.43 - Math.abs(i - 1.5) * 0.02, 0.45 - Math.abs(i - 1.5) * 0.02, 0.5); for (let i = -3; i <= 3; i++) b.box(A.shirt2 || '#17101c', i * 0.11, 0.5, 0.45 - Math.abs(i) * 0.03, 0.035, 0.4, 0.03); } }
  if (A.jacket) { // open jacket: two side shells + collar, chest stays visible (gold jackets are real metal, neon ones glow along the edges)
    const J = goldish(A.jacket) ? bm : b, tc = A.glow || A.trim || A.jacket, T = A.glow ? bn : goldish(A.trim) ? bm : b;
    J.sph(A.jacket, -0.17, 0.5, -0.06, 0.32, 0.4, 0.46); J.sph(A.jacket, 0.17, 0.5, -0.06, 0.32, 0.4, 0.46);
    T.box(tc, -0.2, 0.74, 0.22, 0.2, 0.07, 0.12, 0.3, 0.3, 0.5); T.box(tc, 0.2, 0.74, 0.22, 0.2, 0.07, 0.12, 0.3, -0.3, -0.5);
    T.tor(tc, 0, 0.27, -0.05, 0.4, 0.46, 0.5, Math.PI / 2);
    if (A.glow) { bn.ring(A.glow, 0, 0.5, -0.05, 0.5, 0.56, 0.5); for (const sx of [-1, 1]) { bn.box(A.glow, sx * 0.1, 0.56, 0.44, 0.035, 0.42, 0.04, 0, 0, sx * 0.08); bn.box(A.glow, sx * 0.49, 0.5, 0.0, 0.04, 0.6, 0.04); } }
    if (goldish(A.jacket)) for (let i = 0; i < 3; i++) bm.lo('#fff3b0', 0, 0.62 - i * 0.12, 0.46, 0.04); // buttons
    if (A.studs) for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) bm.lo(A.studs, sx * 0.43, 0.38 + i * 0.1, 0.12, 0.04);
  }
  if (A.hoodie) {
    b.sph(A.hoodie, 0, 0.5, -0.04, 0.44, 0.41, 0.5); b.sph(A.hoodie, 0, 0.86, -0.32, 0.36, 0.3, 0.26); // hood resting on the back
    const HT = goldish(A.trim) ? bm : b;
    HT.tor(A.trim || A.hoodie, 0, 0.27, -0.04, 0.4, 0.47, 0.5, Math.PI / 2); HT.box(A.trim || '#fff', -0.07, 0.6, 0.44, 0.03, 0.26, 0.03); HT.box(A.trim || '#fff', 0.07, 0.6, 0.44, 0.03, 0.26, 0.03);
    if (goldish(A.trim)) { bm.ring(A.trim, 0, 0.9, -0.3, 0.28, 0.2, 0.3); bm.sph(A.trim, -0.07, 0.34, 0.47, 0.035); bm.sph(A.trim, 0.07, 0.34, 0.47, 0.035); }
    if (A.snow) { for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; b.lo(A.snow, Math.sin(a) * 0.46, 0.4 + (i % 2) * 0.07, Math.cos(a) * 0.5 - 0.04, 0.05); } for (const [fx, fy] of [[-0.2, 0.62], [0.2, 0.55]]) for (let k = 0; k < 3; k++) b.box(A.snow, fx, fy, 0.5, 0.15, 0.03, 0.03, 0, 0, k * 1.047); }
    b.box(A.hoodie, 0, 0.42, 0.42, 0.34, 0.16, 0.08);
  }
  // Coleção Mimos
  if (A.apron) { b.box(A.apron, 0, 0.5, 0.43, 0.5, 0.5, 0.05); b.box(A.apron, 0, 0.78, 0.36, 0.3, 0.14, 0.05); b.box(A.apron2 || '#ff4fb8', 0, 0.44, 0.47, 0.22, 0.14, 0.03); b.tor(A.apron, 0, 0.6, -0.02, 0.41, 0.06, 0.46, Math.PI / 2); }
  if (A.bib) { b.sph(A.bib, 0, 0.66, 0.4, 0.26, 0.22, 0.06); b.sph(A.bib2 || '#e2574c', 0, 0.66, 0.45, 0.1, 0.07, 0.03); for (const sx of [-1, 1]) b.sph(A.bib2 || '#e2574c', sx * 0.13, 0.72, 0.45, 0.05, 0.07, 0.03); }
  if (A.pillow) { b.box(A.pillow, 0, 0.6, -0.52, 0.66, 0.5, 0.2); b.sph(A.pillow, 0, 0.6, -0.56, 0.36, 0.28, 0.14); b.tor(A.pillow2 || '#2de2e6', 0, 0.86, 0.02, 0.32, 0.2, 0.4, Math.PI / 2); }
  if (A.mug) { b.cyl('#ffffff', -0.42, 0.66, 0.44, 0.11, 0.2); b.cyl('#6b3f22', -0.42, 0.765, 0.44, 0.09, 0.01); b.tor('#ffffff', -0.54, 0.66, 0.44, 0.06, 0.07, 0.06); b.box(A.mug, -0.42, 0.64, 0.44, 0.225, 0.06, 0.225); }
  if (A.snack) { b.sph(A.snack, 0.3, 0.5, -0.34, 0.2, 0.24, 0.16); b.box(A.snack, 0.12, 0.74, -0.1, 0.05, 0.05, 0.6, 0, 0.5, 0); b.sph('#ffb347', 0.3, 0.52, -0.2, 0.08, 0.06, 0.03); }
  if (A.collar) (goldish(A.collar) ? bm : b).tor(A.collar, 0, 0.82, 0.05, 0.3, 0.3, 0.3, Math.PI / 2);
  if (A.spikes) for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.6; b.cone(A.spikes, Math.sin(a) * 0.33, 0.84, 0.05 + Math.cos(a) * 0.33, 0.045, 0.13, 0.045, Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3); }
  if (A.bell) { bm.sph(A.bell, 0, 0.72, 0.38, 0.1); bm.box('#8a6a10', 0, 0.72, 0.47, 0.1, 0.012, 0.02); bm.lo('#5a4000', 0, 0.68, 0.47, 0.02); }
  if (A.bowtie) { b.cone(A.bowtie, -0.1, 0.78, 0.4, 0.09, 0.2, 0.05, 0, 0, -Math.PI / 2); b.cone(A.bowtie, 0.1, 0.78, 0.4, 0.09, 0.2, 0.05, 0, 0, Math.PI / 2); b.lo(A.bowtie, 0, 0.78, 0.4, 0.05); }
  if (A.scarf) { b.tor(A.scarf, 0, 0.84, 0.06, 0.34, 0.5, 0.34, Math.PI / 2); b.sph(A.scarf, 0.2, 0.82, 0.3, 0.12, 0.1, 0.1); const sc = new GB(); sc.box(A.scarf, 0, -0.2, 0, 0.14, 0.4, 0.07); sc.box('#ffffff', 0, -0.38, 0.0, 0.15, 0.04, 0.075); lat('b', sc, null, 0.2, 0.8, 0.34, 'sway', 0.2, 2.4, 0); const s2 = new GB(); s2.box(A.scarf, 0, -0.14, 0, 0.12, 0.28, 0.06); s2.box('#ffffff', 0, -0.27, 0, 0.13, 0.04, 0.065); lat('b', s2, null, 0.08, 0.8, 0.36, 'sway', 0.28, 2.9, 1.3); }
  if (A.pack) { b.box(A.pack, 0, 0.6, -0.5, 0.44, 0.44, 0.26); b.box('#ffffff', 0, 0.66, -0.64, 0.24, 0.14, 0.04); b.box(A.pack, -0.2, 0.7, -0.2, 0.06, 0.4, 0.5); b.box(A.pack, 0.2, 0.7, -0.2, 0.06, 0.4, 0.5); }
  if (A.cape) { b.box(A.cape, 0, 0.52, -0.5, 0.74, 0.86, 0.05, 0.42); b.tor(A.cape, 0, 0.86, 0.02, 0.32, 0.32, 0.4, Math.PI / 2); }
  if (A.bells) for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.6; bm.sph(i % 2 ? '#ffd23f' : A.bells, Math.sin(a) * 0.3, 0.76 - Math.abs(Math.sin(a)) * 0.06, 0.26 + Math.cos(a) * 0.1, 0.085); }
  if (A.lei) { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, lx = Math.sin(a) * 0.35, lz = 0.05 + Math.cos(a) * 0.32; for (let k = 0; k < 5; k++) { const q = k * 1.257; b.pet(A.lei[i % A.lei.length], lx + Math.cos(q) * 0.05, 0.8 - Math.cos(a) * 0.04 + Math.sin(q) * 0.05, lz, 0.06, 0.06, 0.05); } b.pet('#ffd23f', lx, 0.8 - Math.cos(a) * 0.04, lz + 0.02, 0.04); } }
  if (A.board) { const sb = new GB(); sb.sph(A.board, 0, 0.5, 0, 0.26, 0.98, 0.06); sb.sph(A.board2 || '#ffffff', 0, 0.5, -0.03, 0.07, 0.96, 0.03); sb.sph('#ffffff', 0, 0.5, 0.03, 0.2, 0.2, 0.03); sb.sph(A.board2 || '#ffffff', 0, 0.9, 0.04, 0.2, 0.08, 0.03); sb.cone('#17101c', 0, -0.4, -0.12, 0.05, 0.22, 0.12); lat('b', sb, MAT.gloss, 0.16, 0.38, -0.58, 'sway', 0.07, 1.7, 0); }
  if (A.guitar) { const gt = new GB(); gt.sph(A.guitar, 0, 0, 0, 0.26, 0.2, 0.07); gt.sph(A.guitar, 0, 0.26, 0, 0.2, 0.18, 0.07); gt.sph('#2a1436', 0, 0.12, 0.06, 0.09, 0.09, 0.02); gt.box('#5c3a18', 0, 0.62, 0, 0.07, 0.62, 0.05); gt.box('#e8d9b0', 0, 0.12, 0.07, 0.018, 0.82, 0.01); gt.box('#3a2140', 0, 0.98, 0, 0.11, 0.16, 0.05); gt.lo('#ffd23f', -0.05, 1.0, 0.03, 0.025); gt.lo('#ffd23f', 0.05, 1.0, 0.03, 0.025); lat('b', gt, MAT.gloss, -0.08, 0.4, -0.58, 'sway', 0.08, 3.1, 0.5); }
  if (A.balloon) { const bl = new GB(); bl.cyl('#ffffff', 0, 0.6, 0, 0.008, 1.2, 0.008); bl.sph(A.balloon, 0, 1.52, 0, 0.34, 0.42, 0.34); bl.cone(A.balloon, 0, 1.08, 0, 0.05, 0.1, 0.02, Math.PI); bl.sph('#ffffff', -0.1, 1.68, 0.18, 0.07, 0.1, 0.04); lat('b', bl, MAT.gloss, 0.3, 0.95, -0.36, 'sway', 0.1, 1.9, 0); }
  if (A.gift) { b.box(A.gift, 0, 0.62, -0.52, 0.4, 0.4, 0.3); bm.box('#ffd23f', 0, 0.62, -0.52, 0.42, 0.08, 0.32); bm.box('#ffd23f', 0, 0.62, -0.52, 0.08, 0.42, 0.32); const bw = new GB(); bw.cone('#ffd23f', -0.1, 0.04, 0, 0.09, 0.2, 0.05, 0, 0, Math.PI / 2 + 0.4); bw.cone('#ffd23f', 0.1, 0.04, 0, 0.09, 0.2, 0.05, 0, 0, -Math.PI / 2 - 0.4); bw.lo('#fff3b0', 0, 0, 0, 0.06); lat('b', bw, MAT.gold, 0, 0.86, -0.52, 'pulse', 0.12, 3, 0); }
  if (A.wings) for (const sx of [-1, 1]) { b.sph(A.wings, sx * 0.42, 0.86, -0.4, 0.34, 0.2, 0.05, 0, sx * 0.5, sx * 0.6); b.sph(A.wings, sx * 0.36, 0.64, -0.42, 0.22, 0.14, 0.05, 0, sx * 0.5, sx * 0.2); }
  // arms
  const sleeve = coat || A.shirt || fur;
  b.sph(sleeve, -0.38, 0.56, 0.2, 0.13, 0.13, 0.2); b.sph(fur2, -0.38, 0.54, 0.4, 0.11);
  b.sph(sleeve, 0.38, 0.56, 0.2, 0.13, 0.13, 0.2); b.sph(fur2, 0.38, 0.54, 0.4, 0.11);
  if (spec.cup) { b.cyl('#ffffff', 0.4, 0.64, 0.46, 0.09, 0.16); b.cyl('#6b3f22', 0.4, 0.725, 0.46, 0.075, 0.01); b.tor('#ffffff', 0.5, 0.64, 0.46, 0.05, 0.06, 0.05); b.box('#ff4fb8', 0.4, 0.62, 0.46, 0.185, 0.04, 0.185); }
  if (fl) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.4; if (!coat) b.lo(i % 2 && spec.pattern === 'calico' ? pA : fur, Math.sin(a) * 0.36, 0.42, Math.cos(a) * 0.4 - 0.04, 0.16 * fl); }
  const body = b.mesh(); inner.add(body);
  // ---- legs (two diagonal pairs, pivot at the hips) ----
  const leg = (pairs) => { const l = new GB(); for (const [x, z] of pairs) { l.sph(fur, x, -0.1, z, 0.13, 0.2, 0.14); l.sph(A.shoes || fur2, x, -0.24, z + 0.05, A.shoes ? 0.16 : 0.14, A.shoes ? 0.11 : 0.09, A.shoes ? 0.21 : 0.18); if (A.shoes) l.box('#ffffff', x, -0.3, z + 0.05, 0.3, 0.04, 0.4); } const m = l.mesh(); m.position.y = 0.3; inner.add(m); return m; };
  const legsA = leg([[-0.22, 0.2], [0.22, -0.26]]), legsB = leg([[0.22, 0.2], [-0.22, -0.26]]);
  // ---- tail (pivot at its base) ----
  const t = new GB(), tailCol = spec.pattern === 'calico' ? pA : spec.pattern === 'points' ? pA : fur;
  const TL = { short: [4, 0.55, 1], bob: [2, 0.4, 1.25], fluffy: [6, 1, 1.75], curl: [6, 1, 1] }[spec.tail] || [6, 1, 1]; // tail: long (default) | fluffy | short | bob | curl
  for (let i = 0; i < TL[0]; i++) { const f = i / 5 * TL[1] / (TL[0] === 6 ? 1 : 0.9), cu = spec.tail === 'curl' ? Math.sin(f * 3.4) * 0.3 : 0; t.sph(i === TL[0] - 1 && spec.pattern === 'calico' ? pB : i > 3 && spec.pattern === 'tuxedo' ? fur2 : spec.pattern === 'tabby' && i % 2 ? pA : tailCol, 0, f * 0.55 + Math.sin(f * 2.4) * 0.05 - cu * 0.3, -f * 0.3 - Math.sin(f * 3) * 0.12 + cu, (0.13 + (fl ? 0.05 : 0) * Math.sin(f * 3.1) + 0.02) * TL[2]); }
  const tail = t.mesh(); tail.position.set(0, 0.5, -0.44); inner.add(tail);
  // ---- head ----
  const h = new GB(), flat = spec.face !== 'round';
  h.sph(fur, 0, 0, 0, 0.56, 0.48, flat ? 0.46 : 0.5);
  if (fl) { // fluffy cheeks + forehead tufts
    for (const sx of [-1, 1]) { h.lo(spec.pattern === 'calico' ? (sx < 0 ? pA : fur) : fur, sx * 0.47, -0.16, 0.08, 0.24 * fl, 0.2 * fl, 0.2); h.lo(fur, sx * 0.4, -0.3, 0.12, 0.2 * fl, 0.16, 0.2); h.lo(spec.pattern === 'calico' ? (sx < 0 ? pA : pB) : fur, sx * 0.44, 0.1, -0.02, 0.2, 0.22, 0.24); }
    h.lo(fur, 0, -0.36, 0.14, 0.26, 0.16, 0.22);
  }
  if (spec.pattern === 'calico') { h.sph(pA, -0.26, 0.2, 0.12, 0.3, 0.27, 0.3); h.sph(pB, 0.3, 0.24, 0.06, 0.27, 0.24, 0.3); h.sph(pA, 0.36, -0.2, 0.2, 0.16, 0.14, 0.14); }
  if (spec.pattern === 'spotted') for (let i = 0; i < 5; i++) h.lo(pA, (i - 2) * 0.15, 0.32 + (i % 2) * 0.08, 0.26 - Math.abs(i - 2) * 0.05, 0.05, 0.05, 0.04);
  if (spec.pattern === 'tabby') for (let i = -1; i <= 1; i++) h.box(pA, i * 0.13, 0.36, 0.22, 0.05, 0.12, 0.2, -0.6);
  if (spec.pattern === 'tuxedo') h.sph(fur2, 0, -0.14, 0.26, 0.26, 0.26, 0.24);
  if (spec.pattern === 'points') h.sph(pA, 0, -0.3, 0.08, 0.36, 0.2, 0.34);
  // ears
  for (const sx of [-1, 1]) {
    const ec = spec.pattern === 'calico' ? (sx < 0 ? pA : pB) : spec.pattern === 'points' ? pA : fur;
    const EK = spec.ears; // ears: pointy (default) | big | round | fold | tuft
    if (EK === 'fold') { h.sph(ec, sx * 0.38, 0.36, 0.08, 0.17, 0.1, 0.14, 0.5, 0, -sx * 0.5); h.sph(spec.earIn || '#f4a9b8', sx * 0.38, 0.33, 0.16, 0.1, 0.05, 0.06, 0.5, 0, -sx * 0.5); }
    else if (EK === 'round') { h.sph(ec, sx * 0.38, 0.4, -0.02, 0.19, 0.2, 0.1); h.sph(spec.earIn || '#f4a9b8', sx * 0.38, 0.4, 0.04, 0.11, 0.13, 0.06); }
    else { const eb = EK === 'big' ? 1.35 : 1; h.cone(ec, sx * 0.36, 0.44 + (eb - 1) * 0.12, -0.02, 0.19 * eb, 0.34 * eb, 0.12, 0, 0, -sx * 0.32); h.cone(spec.earIn || '#f4a9b8', sx * 0.35, 0.42 + (eb - 1) * 0.1, 0.04, 0.11 * eb, 0.24 * eb, 0.07, 0, 0, -sx * 0.32); if (EK === 'tuft') h.cone(ec, sx * 0.45, 0.68, -0.02, 0.04, 0.2, 0.03, 0, 0, -sx * 0.5); }
  }
  // face (flat persian: eyes wide apart, tiny nose between them)
  const ez = flat ? 0.4 : 0.43, ey = 0.03, ex = 0.23, er = spec.size < 0.9 ? 0.15 : 0.135;
  for (const sx of [-1, 1]) {
    h.sph('#ffffff', sx * ex, ey, ez, er, er, 0.07); h.sph(sx > 0 && spec.eye2 ? spec.eye2 : spec.eye, sx * ex, ey, ez + 0.035, er * 0.74, er * 0.74, 0.05); h.sph('#0b0610', sx * ex, ey, ez + 0.06, er * 0.36, er * 0.46, 0.035); h.sph('#ffffff', sx * ex - 0.04, ey + 0.05, ez + 0.085, 0.03);
    if (spec.lids) h.sph(pA, sx * ex, ey + 0.075, ez + 0.03, er * 1.12, er * 0.62, 0.085);
    if (spec.brows) h.box(INK, sx * (ex - 0.02), ey + 0.18, ez + 0.04, 0.2, 0.05, 0.05, 0, 0, sx * -0.2); // Mimosa: an elegant arch, never an angry frown
  }
  h.sph(fur2, 0, -0.15, ez + 0.0, 0.2, 0.13, 0.1); h.sph('#f07a9a', 0, -0.07, ez + 0.08, 0.05, 0.035, 0.03);
  if (spec.tongue) h.sph('#ff7fa8', 0.01, -0.22, ez + 0.07, 0.045, 0.06, 0.03);
  else h.box(INK, 0, -0.17, ez + 0.09, 0.1, 0.015, 0.02);
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) h.box('#ffffff', sx * 0.38, -0.13 - i * 0.05, ez - 0.02, 0.26, 0.012, 0.012, 0, sx * -0.4, sx * (0.1 - i * 0.25));
  // head accessories
  if (A.bow) { h.cone(A.bow, -0.17, 0.5, 0.1, 0.16, 0.3, 0.1, 0, 0, -Math.PI / 2 + 0.2); h.cone(A.bow, 0.17, 0.5, 0.1, 0.16, 0.3, 0.1, 0, 0, Math.PI / 2 - 0.2); h.sph('#ff8fd0', 0, 0.5, 0.1, 0.08); }
  if (A.glasses) {
    const GF = A.glow ? hn : hm, gl = new GB();
    for (const sx of [-1, 1]) { h.cyl(A.glow ? '#101a2a' : '#2a1436', sx * ex, ey + 0.02, ez + 0.1, 0.17, 0.03, 0.15, Math.PI / 2); GF.tor(A.glasses, sx * ex, ey + 0.02, ez + 0.11, 0.17, 0.16, 0.07); GF.box(A.glasses, sx * (ex + 0.17), ey + 0.03, ez - 0.02, 0.03, 0.03, 0.26); gl.box('#ffffff', sx * ex - 0.04, ey + 0.04, ez + 0.14, 0.025, 0.2, 0.01, 0, 0, 0.6); }
    GF.box(A.glasses, 0, ey + 0.05, ez + 0.11, 0.14, 0.035, 0.035); lat('h', gl, MAT.neon, 0, 0, 0, 'flash', 1, 1.6, 0);
  }
  if (A.crown) { // crown: metal band + five tall points with ball tips, glowing jewels, a floating twinkle
    hm.cyl(A.crown, 0, 0.5, 0, 0.2, 0.1, 0.21); hm.ring(A.crown, 0, 0.55, 0, 0.21, 0.22, 0.21); hm.ring(A.crown, 0, 0.45, 0, 0.21, 0.22, 0.21);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283, cx = Math.sin(a) * 0.17, cz = Math.cos(a) * 0.17; hm.cone(A.crown, cx, 0.66, cz, 0.065, 0.24, 0.065); hm.sph('#fff6c8', cx, 0.8, cz, 0.04); hn.gem(i % 2 ? '#ff4f7a' : '#2de2e6', cx, 0.53, cz * 1.0 + (cz > 0 ? 0.03 : 0), 0.04, 0.05, 0.04); }
    const tw = new GB(); tw.gem('#ffffff', 0, 0, 0, 0.05, 0.1, 0.05); tw.gem('#fff3a8', 0, 0, 0, 0.1, 0.04, 0.04); lat('h', tw, MAT.spark, 0, 0.98, 0, 'bob', 0.05, 3, 0);
  }
  if (A.tag) { // floating mini crown over the head: readable from the gameplay camera
    const tg = new GB(); tg.cyl(A.tag, 0, 0, 0, 0.17, 0.08, 0.18); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; tg.cone(A.tag, Math.sin(a) * 0.14, 0.12, Math.cos(a) * 0.14, 0.055, 0.2, 0.055); tg.sph('#fff6c8', Math.sin(a) * 0.14, 0.23, Math.cos(a) * 0.14, 0.035); } lat('h', tg, MAT.gold, 0, 1.0, 0, 'tag', 0.06, 2.4, 0);
  }
  if (A.hat) { h.cyl(A.hat, 0, 0.46, 0, 0.5, 0.04); h.cyl(A.hat, 0, 0.56, 0, 0.3, 0.2); }
  if (A.cowboy) { h.cyl(A.cowboy, 0, 0.45, 0, 0.64, 0.04, 0.58); h.tor(A.cowboy, 0, 0.47, 0, 0.62, 0.3, 0.56, Math.PI / 2); h.cyl(A.cowboy, 0, 0.6, 0, 0.3, 0.26, 0.28); h.sph(A.cowboy, 0, 0.73, 0, 0.3, 0.1, 0.28); h.cyl(A.band || '#3a2140', 0, 0.51, 0, 0.31, 0.07, 0.29); hm.box('#ffd23f', 0, 0.51, 0.31, 0.12, 0.1, 0.03); hm.gem('#fff6c8', 0, 0.51, 0.34, 0.04, 0.04, 0.02); }
  if (A.antlers) { for (const sx of [-1, 1]) { h.cyl(A.antlers, sx * 0.2, 0.62, -0.02, 0.035, 0.36, 0.035, 0, 0, -sx * 0.35); h.cyl(A.antlers, sx * 0.33, 0.7, -0.02, 0.03, 0.2, 0.03, 0, 0, -sx * 1.1); h.cyl(A.antlers, sx * 0.2, 0.78, -0.02, 0.028, 0.18, 0.028, 0, 0, sx * 0.5); } h.sph('#ff3355', 0, -0.07, 0.52, 0.07); const al = new GB(), al2 = new GB(); for (const sx of [-1, 1]) { al.sph('#ff3355', sx * 0.33, 0.8, -0.02, 0.05); al2.sph('#7CFF6B', sx * 0.2, 0.9, -0.02, 0.05); al2.sph('#ffd23f', sx * 0.41, 0.72, -0.02, 0.045); al.sph('#2de2e6', sx * 0.2, 0.69, -0.02, 0.045); } lat('h', al, MAT.neon, 0, 0, 0, 'blink', 0, 2.4, 0); lat('h', al2, MAT.neon, 0, 0, 0, 'blink', 0, 2.4, 3.14); }
  if (A.party) { h.cone(A.party, 0, 0.7, 0, 0.24, 0.56, 0.24); h.tor('#ffffff', 0, 0.56, 0, 0.17, 0.2, 0.17, Math.PI / 2); h.tor('#2de2e6', 0, 0.74, 0, 0.12, 0.14, 0.12, Math.PI / 2); const pm = new GB(); pm.sph('#fff3a8', 0, 0, 0, 0.09); for (let i = 0; i < 6; i++) pm.cone('#ffd23f', Math.sin(i * 1.047) * 0.09, Math.cos(i * 1.047) * 0.09, 0, 0.025, 0.12, 0.01, 0, 0, -i * 1.047 + 1.57); lat('h', pm, MAT.gold, 0, 0.98, 0, 'bob', 0.05, 4, 0); for (let i = 0; i < 5; i++) { const a = i * 1.257; h.lo(i % 2 ? '#ffd23f' : '#2de2e6', Math.sin(a) * 0.14, 0.52 + (i % 3) * 0.08, Math.cos(a) * 0.14, 0.035); } }
  if (A.halo) { const ha = new GB(); ha.tor(A.halo, 0, 0, 0, 0.26, 0.26, 0.32, Math.PI / 2); lat('h', ha, MAT.neon, 0, 0.78, 0, 'bob', 0.04, 2.2, 0); const hb = new GB(); hb.tor(A.halo, 0, 0, 0, 0.3, 0.3, 0.5, Math.PI / 2); lat('h', hb, MAT.spark, 0, 0.78, 0, 'bob', 0.04, 2.2, 0); }
  if (A.phones) { h.tor(A.phones, 0, 0.12, -0.02, 0.56, 0.5, 0.36); for (const sx of [-1, 1]) { h.sph(A.phones, sx * 0.56, 0.04, 0, 0.1, 0.18, 0.18); h.sph('#17101c', sx * 0.6, 0.04, 0, 0.07, 0.13, 0.13); hn.add(PR.torf, A.phones, sx * 0.67, 0.04, 0, 0.16, 0.16, 0.5, 0, Math.PI / 2, 0); hn.add(PR.torf, '#ffffff', sx * 0.7, 0.04, 0, 0.09, 0.09, 0.5, 0, Math.PI / 2, 0); } }
  if (A.flowers) { const fl2 = new GB(); fl2.ring('#2f9a4a', 0, 0.36, 0.1, 0.43, 0.38, 0.5, 0.15); for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.6, fx = Math.sin(a) * 0.44, fy = 0.36 + Math.cos(a) * 0.16, fz = 0.12 + (1 - Math.cos(a)) * 0.02; for (let k = 0; k < 5; k++) { const q = k * 1.257 + i; fl2.pet(A.flowers[i % A.flowers.length], fx + Math.cos(q) * 0.075, fy + Math.sin(q) * 0.075, fz, 0.07, 0.07, 0.04); } fl2.pet('#ffd23f', fx, fy, fz + 0.03, 0.05, 0.05, 0.04); } lat('h', fl2, null, 0, 0, 0, 'sway', 0.03, 1.5, 0); }
  if (A.beanie) { h.sph(A.beanie, 0, 0.36, -0.02, 0.5, 0.3, 0.44); h.tor(A.trim2 || '#ffffff', 0, 0.3, -0.02, 0.5, 0.44, 0.5, Math.PI / 2); h.tor(A.trim2 || '#ffffff', 0, 0.5, -0.02, 0.4, 0.34, 0.4, Math.PI / 2); const bp = new GB(); bp.sph(A.trim2 || '#ffffff', 0.04, 0, 0, 0.12); bp.sph('#ffffff', 0.08, 0.05, 0.05, 0.04); lat('h', bp, null, 0, 0.68, -0.02, 'sway', 0.3, 3.2, 0); }
  if (A.star) { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; h.cone(A.star, Math.sin(a) * 0.09, 0.62 + Math.cos(a) * 0.09, 0.05, 0.06, 0.16, 0.03, 0, 0, -a); } h.sph(A.star, 0, 0.62, 0.05, 0.08, 0.08, 0.03); }
  if (A.chef) { h.cyl(A.chef, 0, 0.5, 0, 0.3, 0.2); for (let i = 0; i < 5; i++) { const a = i * 1.257; h.sph(A.chef, Math.sin(a) * 0.2, 0.72, Math.cos(a) * 0.2, 0.2); } h.sph(A.chef, 0, 0.8, 0, 0.24); }
  if (A.nightcap) { h.sph(A.nightcap, 0, 0.36, -0.02, 0.5, 0.26, 0.44); h.cone(A.nightcap, 0.2, 0.66, -0.06, 0.26, 0.6, 0.26, 0, 0, -0.9); h.sph(A.nightcap2 || '#ffffff', 0.52, 0.72, -0.06, 0.1); h.tor(A.nightcap2 || '#ffffff', 0, 0.3, -0.02, 0.5, 0.44, 0.5, Math.PI / 2); }
  if (A.santa) { h.cyl('#ffffff', 0, 0.42, 0, 0.36, 0.1); for (let i = 0; i < 8; i++) h.lo('#ffffff', Math.sin(i * 0.785) * 0.34, 0.4, Math.cos(i * 0.785) * 0.34 - 0.02, 0.09); h.cone('#e01e37', 0.06, 0.66, -0.04, 0.3, 0.5, 0.3, 0, 0, -0.35); const sp = new GB(); sp.sph('#ffffff', 0, 0, 0, 0.11); lat('h', sp, null, 0.26, 0.86, -0.04, 'sway', 0.35, 3, 0); }
  const head = h.mesh(); head.position.set(0, 1.12, 0.1); inner.add(head);
  // ---- paid looks: metal / neon layers, animated parts, sparkles, floor aura ----
  const anim = [];
  for (const [gb, mat, par] of [[bm, MAT.gold, body], [bn, MAT.neon, body], [hm, MAT.gold, head], [hn, MAT.neon, head]]) if (gb.p.length) par.add(gb.mesh(mat));
  for (const l of later) { const par = l.on === 'h' ? head : body, m = l.gb.mesh(l.mat || MAT.lit); m.position.set(l.x, l.y, l.z); par.add(m); if (l.k) anim.push({ m, k: l.k, a: l.a, s: l.s, p: l.p, y: l.y }); }
  if (A.sparkle) { // orbiting glints around the whole cat
    const cols = Array.isArray(A.sparkle) ? A.sparkle : [A.sparkle, '#ffffff'], sg = new GB();
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.62 + (i % 3) * 0.12, y = 0.2 + i * 0.19; sg.gem(cols[i % cols.length], Math.sin(a) * r, y, Math.cos(a) * r, 0.05 + (i % 3) * 0.015, 0.09 + (i % 3) * 0.02, 0.05 + (i % 3) * 0.015); }
    const sm = sg.mesh(MAT.spark); inner.add(sm); anim.push({ m: sm, k: 'orbit', a: 0.08, s: 0.9, p: 0, y: 0 });
  }
  if (A.aura) { // glowing ring on the ground: tells "paid look" from far away
    const ag = new GB(); ag.ring(A.aura, 0, 0.03, 0, 0.82, 0.82, 0.6); ag.ring('#ffffff', 0, 0.035, 0, 0.7, 0.7, 0.25); const am = ag.mesh(MAT.spark); am.position.y = 0.02; g.add(am); const sc = (spec.size || 1) * 1.1; am.scale.setScalar(sc); anim.push({ m: am, k: 'pulse', a: 0.1, s: 2.4, p: 0, y: 0, base: sc });
  }
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
  g.userData = { inner, body, head, tail, legsA, legsB, tool, size: s, spec, hs: HS, anim: anim.length ? anim : null, aura: A.aura || A.tag || null };
  return g;
}
// procedural animation. st: {t, walk(0/1), atk(0..1), down, sleepy, recoil, mouth, dance}
export function animCat(g, st) {
  const u = g.userData, t = st.t, w = st.walk ? 1 : 0;
  if (u.anim) {
    premTick();
    for (const a of u.anim) {
      const m = a.m, x = t * a.s + a.p;
      if (a.k === 'sway') m.rotation.z = Math.sin(x) * a.a + (w ? Math.sin(t * 13) * a.a * 0.6 : 0);
      else if (a.k === 'bob') { m.position.y = a.y + Math.sin(x) * a.a; m.rotation.y = x * 0.5; }
      else if (a.k === 'tag') { m.position.y = a.y + Math.sin(x) * a.a; m.rotation.y = x * 0.7; }
      else if (a.k === 'pulse') m.scale.setScalar((a.base || 1) * (1 + Math.sin(x) * a.a));
      else if (a.k === 'orbit') { m.rotation.y = x; m.scale.setScalar(1 + Math.sin(x * 1.7) * a.a); }
      else if (a.k === 'blink') m.visible = Math.sin(x) > 0;
      else if (a.k === 'flash') m.scale.setScalar(Math.max(0.001, Math.pow(Math.max(0, Math.sin(x)), 8) * a.a));
    }
  }
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
  // emotes: sit (haunches down, leaning back) and wave (front paws up, swaying)
  if (st.sit) { u.inner.rotation.x = -0.34; u.inner.position.y = -0.12 * u.size; u.legsA.rotation.x = 0.3; u.legsB.rotation.x = 1.25; u.tail.rotation.z = Math.sin(t * 2.2) * 0.5; }
  if (st.wave) { u.body.rotation.z = Math.sin(t * 9) * 0.16; u.legsA.rotation.x = -1.25 + Math.sin(t * 16) * 0.45; u.head.rotation.z = Math.sin(t * 9) * 0.14; }
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
  if (K.veh) { // kart, motorbike, bicycle, speedboat, helicopter (forward = +z)
    const wheel = (x, z, r) => { b.cyl('#120a18', x, r, z, r, 0.16, r, 0, 0, Math.PI / 2); b.cyl('#c0c7d1', x, r, z, r * 0.45, 0.18, r * 0.45, 0, 0, Math.PI / 2); };
    let rotor = null;
    if (K.veh === 'kart') { for (const z of [-0.9, 0.9]) for (const sx of [-1, 1]) wheel(sx * 0.7, z, 0.3); b.box(body, 0, 0.42, 0, 1.1, 0.3, 2.3); b.box(body2, 0, 0.6, 1.0, 1.3, 0.14, 0.4); b.box(body2, 0, 0.9, -1.05, 1.3, 0.1, 0.3); b.box('#17101c', 0, 0.72, -0.3, 0.8, 0.5, 0.6); b.cyl('#17101c', 0, 0.85, 0.35, 0.22, 0.05, 0.22, 1.1); }
    else if (K.veh === 'moto' || K.veh === 'bike') { const m = K.veh === 'moto', r = m ? 0.36 : 0.34; wheel(0, -0.85, r); wheel(0, 0.85, r); if (m) { b.box(body, 0, 0.7, 0, 0.34, 0.5, 1.3); b.sph(body, 0, 0.98, 0.25, 0.26, 0.2, 0.42); b.box(body2, 0, 0.98, -0.42, 0.3, 0.12, 0.6); b.cyl('#c0c7d1', 0.2, 0.4, -0.5, 0.07, 0.8, 0.07, Math.PI / 2); } else { b.box(body, 0, 0.62, 0, 0.07, 0.07, 1.5, 0.3); b.box(body, 0, 0.5, 0.1, 0.07, 0.07, 1.3, -0.3); b.box(body2, 0, 0.98, -0.4, 0.2, 0.07, 0.36); b.box('#c98f4b', 0, 0.86, 1.0, 0.5, 0.3, 0.36); }
      b.cyl('#59536b', 0, 0.75, 0.75, 0.04, 0.9, 0.04, -0.35); b.box('#17101c', 0, 1.18, 0.6, 0.8, 0.06, 0.06); b.sph('#fff6b0', 0, 0.95, 0.95, 0.1); }
    else if (K.veh === 'lancha') { b.box(body, 0, 0.3, -0.2, 1.4, 0.6, 2.6); b.add(PR.cone, body, 0, 0.3, 1.75, 0.7, 1.3, 0.3, Math.PI / 2); b.box(body2, 0, 0.62, -0.2, 1.46, 0.08, 2.64); b.box('#9fe8ff', 0, 0.9, 0.5, 1.1, 0.5, 0.08, -0.3); b.box('#17101c', 0, 0.5, -1.6, 0.5, 0.6, 0.3); b.box('#c98f4b', 0, 0.62, -0.6, 1.0, 0.1, 0.9); }
    else { b.sph(body, 0, 1.2, 0.2, 0.9, 0.85, 1.3); b.sph('#9fe8ff', 0, 1.3, 0.85, 0.72, 0.6, 0.75); b.box(body2, 0, 1.3, -1.6, 0.22, 0.26, 1.9); b.box(body2, 0, 1.8, -2.5, 0.08, 0.9, 0.4); b.cyl('#59536b', 0, 2.15, 0.2, 0.07, 0.4, 0.07); for (const sx of [-1, 1]) { b.box('#59536b', sx * 0.7, 0.12, 0.2, 0.08, 0.08, 2.2); b.box('#59536b', sx * 0.6, 0.45, 0.2, 0.06, 0.6, 0.06); }
      const rg = new GB(); rg.box('#17101c', 0, 0, 0, 6.4, 0.05, 0.3); rg.box('#17101c', 0, 0, 0, 0.3, 0.05, 6.4); rotor = rg.mesh(); rotor.position.set(0, 2.4, 0.2); }
    const mesh = b.mesh(); g.add(mesh); if (rotor) g.add(rotor);
    g.userData = { mesh, heads: null, rotor };
    return g;
  }
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
    // consumables (js/prog.js): bowl of kibble, omega-3 capsule, wet-food tin, catnip pouch, milk bottle
    case 'c_racao': b.cyl('#ff4fb8', 0, -0.06, 0, 0.3, 0.16, 0.22); b.cyl('#c98f4b', 0, 0.03, 0, 0.25, 0.04, 0.25); for (let i = 0; i < 5; i++) b.lo('#a8743a', Math.sin(i * 1.26) * 0.12, 0.08, Math.cos(i * 1.26) * 0.12, 0.07); break;
    case 'c_omega': b.sph('#ffd23f', -0.1, 0, 0, 0.2, 0.15, 0.15); b.sph('#2de2e6', 0.1, 0, 0, 0.2, 0.15, 0.15); b.sph('#ffffff', -0.14, 0.07, 0.08, 0.05); break;
    case 'c_sache': b.cyl('#c0c7d1', 0, 0, 0, 0.26, 0.2, 0.26); b.cyl('#ff7ac0', 0, 0, 0, 0.265, 0.12, 0.265); b.cyl('#e9e2f0', 0, 0.105, 0, 0.22, 0.01, 0.22); b.sph('#ffb347', 0, 0, 0.26, 0.09, 0.05, 0.02); break;
    case 'c_catnip': b.sph('#3fae6a', 0, -0.04, 0, 0.24, 0.26, 0.2); b.cyl('#2e9e3f', 0, 0.2, 0, 0.1, 0.1, 0.1); b.tor('#ffd23f', 0, 0.16, 0, 0.11, 0.11, 0.16, Math.PI / 2); for (let i = 0; i < 3; i++) b.sph('#7CFF6B', (i - 1) * 0.1, 0.32, 0, 0.07, 0.12, 0.03); break;
    case 'c_leite': b.cyl('#ffffff', 0, -0.04, 0, 0.17, 0.34, 0.17); b.cyl('#ffffff', 0, 0.2, 0, 0.09, 0.14, 0.09); b.cyl('#7CFF6B', 0, 0.29, 0, 0.1, 0.05, 0.1); b.cyl('#7fd6c2', 0, -0.06, 0, 0.175, 0.12, 0.175); break;
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
    case 'pkplat': { // parkour platform: a crate, a low roof on posts or a striped awning; top at p.h, footprint 2*hw x 2*hh px
      const w = p.hw / 12, d = p.hh / 12, h = p.h, st = p.style || 'crate';
      if (st === 'crate') { b.box(p.col || '#c98f4b', 0, h / 2, 0, w, h, d); b.box('#8a5a2b', 0, h - 0.06, 0, w + 0.06, 0.12, d + 0.06); b.box('#8a5a2b', 0, 0.06, 0, w + 0.06, 0.12, d + 0.06); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('#8a5a2b', sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05), 0.14, h, 0.14); }
      else { // roof on posts (walk underneath); the top is the running surface
        const c1 = p.col || '#e01e37', c2 = p.col2 || '#ffffff', n = Math.max(2, Math.round((p.along === 'y' ? d : w) / 0.9));
        for (let i = 0; i < n; i++) { const f = (i + 0.5) / n - 0.5; if (p.along === 'y') b.box(i % 2 ? c1 : c2, 0, h - 0.09, f * d, w, 0.18, d / n + 0.01); else b.box(i % 2 ? c1 : c2, f * w, h - 0.09, 0, w / n + 0.01, 0.18, d); }
        b.box('#3a2a4a', 0, h - 0.24, 0, w + 0.12, 0.12, d + 0.12);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('#59536b', sx * (w / 2 - 0.15), (h - 0.2) / 2, sz * (d / 2 - 0.15), 0.09, h - 0.2, 0.09);
        if (st === 'roof') { b.box('#6b7280', w * 0.22, h + 0.3, -d * 0.18, 0.7, 0.6, 0.7); b.cyl('#9aa3b2', -w * 0.25, h + 0.25, d * 0.2, 0.22, 0.5, 0.22); }
      }
      break;
    }
    case 'pkpad': { b.cyl('#1d1530', 0, 0.08, 0, 0.9, 0.16, 0.9); b.cyl('#2de2e6', 0, 0.2, 0, 0.74, 0.1, 0.74); b.cyl('#ffffff', 0, 0.27, 0, 0.42, 0.06, 0.42); b.cone('#ffd23f', 0, 0.62, 0, 0.26, 0.5, 0.26); mat = MAT.glow; break; }
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
    case 'works': { // friendly "under construction" barrier across a street that has not opened yet
      const L = (p.len || 96) / 24, hor = !!p.hor;
      for (let i = 0; i < Math.round(L / 0.5); i++) { const o = -L / 2 + (i + 0.5) * 0.5; b.box(i % 2 ? '#ffb347' : '#ffffff', hor ? o : 0, 0.95, hor ? 0 : o, hor ? 0.5 : 0.14, 0.3, hor ? 0.14 : 0.5); b.box(i % 2 ? '#ffffff' : '#ffb347', hor ? o : 0, 0.5, hor ? 0 : o, hor ? 0.5 : 0.12, 0.2, hor ? 0.12 : 0.5); }
      for (const s of [-1, 1]) { b.box('#59536b', hor ? s * L / 2 : 0, 0.6, hor ? 0 : s * L / 2, 0.16, 1.2, 0.16); b.cone('#ff7a2e', hor ? s * (L / 2 - 0.5) : 0.6, 0.35, hor ? 0.6 : s * (L / 2 - 0.5), 0.26, 0.7); }
      b.sph('#ffd23f', 0, 1.3, 0, 0.16); break;
    }
    case 'shelter': { // Abrigo dos Mimos: boarded up at first, one part restored per finished chapter (p.stage 0-5)
      const st = p.stage || 0, wall = st ? '#fff1d6' : '#8d8794', roof = st ? '#ff4fb8' : '#5a5462';
      b.box(wall, 0, 1.5, 0, 6.4, 3, 4.4); b.add(PR.cone, roof, 0, 3.9, 0, 5.2, 1.9, 3.8, 0, Math.PI / 4, 0);
      b.box(st ? '#2de2e6' : '#3a3440', 0, 1.0, 2.22, 1.2, 2.0, 0.08); for (const sx of [-1, 1]) b.box(st ? '#bff4ff' : '#3a3440', sx * 2.1, 1.7, 2.22, 1.1, 1.0, 0.08);
      b.box(st ? '#ffd23f' : '#6a6470', 0, 3.25, 2.3, 3.6, 0.6, 0.1); b.sph(st ? '#ff4fb8' : '#59536b', -1.5, 3.25, 2.38, 0.2, 0.2, 0.05); b.sph(st ? '#ff4fb8' : '#59536b', 1.5, 3.25, 2.38, 0.2, 0.2, 0.05);
      if (!st) { for (const sx of [-1, 1]) { b.box('#8a5a2b', sx * 2.1, 1.7, 2.3, 1.5, 0.16, 0.06, 0, 0, 0.5); b.box('#8a5a2b', sx * 2.1, 1.7, 2.3, 1.5, 0.16, 0.06, 0, 0, -0.5); } b.box('#8a5a2b', 0, 1.2, 2.3, 1.7, 0.18, 0.06, 0, 0, 0.3); b.box('#e2574c', 0, 0.5, 3.2, 1.6, 0.9, 0.08); }
      if (st >= 1) for (let i = 0; i < 4; i++) { const x = -2.6 + i * 0.9; b.cyl(['#ff4fb8', '#2de2e6', '#ffd23f', '#7CFF6B'][i], x, 0.12, 3.2, 0.3, 0.2, 0.22); b.cyl('#c98f4b', x, 0.22, 3.2, 0.24, 0.04, 0.24); } // food bowls
      if (st >= 2) for (let i = 0; i < 3; i++) { const x = 1.2 + i * 1.0; b.sph(['#b967ff', '#ff7ac0', '#8ff3ff'][i], x, 0.16, 3.3, 0.42, 0.16, 0.36); b.sph('#ffffff', x, 0.26, 3.3, 0.28, 0.1, 0.24); } // beds
      if (st >= 3) { b.box('#ffffff', 4.4, 1.2, -0.4, 2.4, 2.4, 3.2); b.box('#bfe9ff', 4.4, 2.5, -0.4, 2.6, 0.2, 3.4); b.box('#3fcf55', 4.4, 1.7, 1.24, 0.9, 0.28, 0.06); b.box('#3fcf55', 4.4, 1.7, 1.24, 0.28, 0.9, 0.06); } // vet room
      if (st >= 4) { for (let i = 0; i < 9; i++) { const a = i * 0.7, x = -4.6 + (i % 3) * 0.8, z = -1.4 + Math.floor(i / 3) * 1.1; b.lo('#3fae6a', x, 0.2, z, 0.3, 0.2, 0.3); b.lo(['#ff4fb8', '#ffd23f', '#ffffff'][i % 3], x, 0.45, z, 0.16); void a; } b.cyl('#7a5a3b', -4.6, 1.0, 2.2, 0.16, 2.0, 0.16); b.lo('#2f9a5a', -4.6, 2.5, 2.2, 1.2, 1.0, 1.2); } // garden
      if (st >= 5) { for (let i = 0; i < 12; i++) { const f = i / 11, x = -4.4 + f * 8.8; b.add(PR.cone, ['#ff4fb8', '#2de2e6', '#ffd23f', '#7CFF6B'][i % 4], x, 3.9 - Math.sin(f * Math.PI) * 0.6, 2.6, 0.2, 0.36, 0.05, Math.PI); } for (const [x, c2] of [[-3.4, '#ff4fb8'], [3.4, '#2de2e6'], [0, '#ffd23f']]) { b.cyl('#ffffff', x, 4.6, 2.3, 0.01, 1.4, 0.01); b.sph(c2, x, 5.5, 2.3, 0.34, 0.42, 0.34); } } // reopening party
      break;
    }
    default: return null;
  }
  const m = b.mesh(mat);
  if (alt) { m.userData.geoA = m.geometry; m.userData.geoB = alt.geo(); }
  return m;
}
export { THREE, PR };
