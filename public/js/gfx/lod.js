// VICE PAWS — static-scene performance helpers: spatial chunks (so Three.js can frustum-cull the city),
// distance culling per quality level, and two-level LOD for instanced props (palms, lamps).
import { THREE } from './models.js';

// Splits a merged, non-indexed geometry into XZ grid cells. Every chunk is its own Mesh with a tight bounding
// sphere, so only the chunks in view are drawn. `detail` chunks (neon trims, small props) vanish first with distance.
export function chunkMesh(geo, mat, scene, city, o) {
  o = o || {};
  if (geo.index) geo = geo.toNonIndexed();
  const cell = o.cell || 48, P = geo.attributes.position.array, names = Object.keys(geo.attributes), buckets = new Map(), tris = P.length / 9;
  for (let t = 0; t < tris; t++) {
    const i = t * 9, cx = Math.floor((P[i] + P[i + 3] + P[i + 6]) / 3 / cell), cz = Math.floor((P[i + 2] + P[i + 5] + P[i + 8]) / 3 / cell), k = cx * 4096 + cz;
    let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(t);
  }
  const out = [];
  for (const list of buckets.values()) {
    const g = new THREE.BufferGeometry();
    for (const name of names) {
      const a = geo.attributes[name], n = a.itemSize, src = a.array, dst = new Float32Array(list.length * 3 * n);
      for (let j = 0; j < list.length; j++) { const s = list[j] * 3 * n; for (let q = 0; q < 3 * n; q++) dst[j * 3 * n + q] = src[s + q]; }
      g.setAttribute(name, new THREE.BufferAttribute(dst, n));
    }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; if (o.renderOrder) m.renderOrder = o.renderOrder; scene.add(m);
    const s = g.boundingSphere; city.chunks.push({ m, x: s.center.x, z: s.center.z, r: s.radius, detail: o.detail || 0, far: o.far || 0 }); out.push(m);
  }
  geo.dispose();
  return out;
}
// items: [{x, y, z, ry, s, sy?, col?}] -> per-cell InstancedMesh pairs (full geometry near, cheap geometry far)
export function chunkInstances(hiGeo, loGeo, mat, items, scene, city, o) {
  o = o || {};
  const cell = o.cell || 64, buckets = new Map(), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  for (const it of items) { const k = Math.floor(it.x / cell) * 4096 + Math.floor(it.z / cell); let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(it); }
  hiGeo.computeBoundingSphere(); const gr = hiGeo.boundingSphere.radius + hiGeo.boundingSphere.center.length();
  for (const list of buckets.values()) {
    const pair = [];
    for (const geo of loGeo ? [hiGeo, loGeo] : [hiGeo]) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { e.set(0, it.ry || 0, 0); q.setFromEuler(e); mt.compose(p.set(it.x, it.y, it.z), q, sc.set(it.s || 1, it.sy || it.s || 1, it.s || 1)); im.setMatrixAt(i, mt); if (it.col) im.setColorAt(i, c.set(it.col)); });
      im.instanceMatrix.needsUpdate = true; im.matrixAutoUpdate = false; scene.add(im); pair.push(im);
    }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y = 0, smax = 1; for (const it of list) { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z); y += it.y; smax = Math.max(smax, it.sy || it.s || 1); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.hypot(x1 - x0, z1 - z0) / 2 + gr * smax;
    for (const im of pair) im.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, y / list.length + gr * 0.5, cz), r);
    city.chunks.push({ m: pair[0], lo: pair[1] || null, x: cx, z: cz, r, detail: o.detail || 0, far: o.far || 0, n: list.length });
  }
}
// Called every few frames: hide chunks beyond the fog, drop detail chunks early, pick the LOD of instanced props.
const FAR = [0.94, 1.02, 1.1], DETAIL = [70, 120, 190], LODD = [26, 60, 110];
export function updateChunks(city, cam, quality, fogFar) {
  const far = fogFar * FAR[quality], det = DETAIL[quality], lod = LODD[quality], cx = cam.x, cz = cam.z; let vis = 0;
  for (const c of city.chunks) {
    const d = Math.hypot(c.x - cx, c.z - cz) - c.r, lim = c.far || (c.detail ? det * c.detail : far), on = d < lim;
    if (c.lo) { const near = d < lod; c.m.visible = on && near; c.lo.visible = on && !near; } else c.m.visible = on;
    if (on) vis++;
  }
  city.chunksVisible = vis;
}
