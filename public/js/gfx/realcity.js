// VICE PAWS — real-city renderer: builds the 3D scene of an OpenStreetMap extract (data/cities/*.json)
// Buildings are extruded footprints, roads are ribbons on the terrain, everything merged into a handful of draw calls.
import { THREE, GB, MAT, PR } from './models.js';
import { bldMaterial, palmGeo, treeGeo, glowPoints, skyWater, lin } from './city.js';

const VIVID = ['#ff5a7a', '#ffb347', '#ffe066', '#5fd0c8', '#7fb4ff', '#c9a7ff', '#ff8fd0', '#7CFF6B', '#ff7043', '#40c4ff'];
export function buildRealCity(W, scene, VP) {
  const C = W.real, meta = W.meta || {}, K = 2 / VP.World.MPT, half = C.half, U = VP.U, rng = U.rng(77 + C.id.length * 13), pal = W.pal;
  const city = { glowPts: [], real: true }, GT = VP.World.GT, tags = C.tags || [];
  const comu = tags.includes('comunidade');
  const u = m => (m + half) * K;
  // terrain height (units) at metres
  const E = C.elev && C.elev.data && C.elev.n > 1 ? C.elev : null;
  const hM = (x, z) => {
    if (!E) return 0;
    const n = E.n, fx = U.clamp((x + half) / (half * 2) * (n - 1), 0, n - 1.001), fz = U.clamp((z + half) / (half * 2) * (n - 1), 0, n - 1.001), i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j, d = E.data;
    return ((d[j * n + i] * (1 - a) + d[j * n + i + 1] * a) * (1 - b) + (d[(j + 1) * n + i] * (1 - a) + d[(j + 1) * n + i + 1] * a) * b) * K;
  };
  W.hpx = (px, py) => hM(px / 48 * VP.World.MPT - half, py / 48 * VP.World.MPT - half);
  const gAt = (x, z) => { const tx = Math.floor((x + half) / VP.World.MPT), ty = Math.floor((z + half) / VP.World.MPT); return tx < 0 || ty < 0 || tx >= W.W || ty >= W.H ? GT.G_LOT : W.gnd[ty * W.W + tx]; };

  // ---------- terrain ----------
  {
    const step = 6, n = Math.ceil(half * 2 / step), pos = new Float32Array((n + 1) * (n + 1) * 3), col = new Float32Array((n + 1) * (n + 1) * 3), idx = [];
    const cLot = lin(comu ? '#c9a27e' : pal.walk), cLot2 = lin(pal.walk2), cGrass = lin(pal.grass), cSand = lin(pal.sand), cWater = lin(pal.water), cRoad = lin(pal.lot);
    const wet = new Uint8Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = -half + i * step, z = -half + j * step, k = j * (n + 1) + i, g = gAt(x, z);
      const water = g === GT.G_WATER; wet[k] = water ? 1 : 0;
      pos[k * 3] = u(x); pos[k * 3 + 1] = water ? -0.7 : hM(x, z); pos[k * 3 + 2] = u(z);
      const c = water ? cWater : g === GT.G_GRASS ? cGrass : g === GT.G_SAND ? cSand : g === GT.G_ROAD ? cRoad : ((i + j) % 2 ? cLot : cLot2), sh = 0.92 + ((i * 7 + j * 13) % 5) * 0.035;
      col[k * 3] = c[0] * sh; col[k * 3 + 1] = c[1] * sh; col[k * 3 + 2] = c[2] * sh;
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; if (wet[a] && wet[b] && wet[c] && wet[d]) continue; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.lit); m.frustumCulled = false; scene.add(m);
  }

  // ---------- roads (ribbons following the terrain) ----------
  {
    const P = [], N = [], Cc = [];
    const road = lin(pal.road), foot = lin(comu ? '#e9d9c0' : pal.walk2), line = lin(pal.line);
    const quad = (ax, az, bx, bz, hw, c, lift) => {
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * hw, nz = dx / l * hw, ya = hM(ax, az) + lift, yb = hM(bx, bz) + lift;
      P.push(u(ax - nx), ya, u(az - nz), u(ax + nx), ya, u(az + nz), u(bx - nx), yb, u(bz - nz), u(bx - nx), yb, u(bz - nz), u(ax + nx), ya, u(az + nz), u(bx + nx), yb, u(bz + nz));
      for (let i = 0; i < 6; i++) { N.push(0, 1, 0); Cc.push(c[0], c[1], c[2]); }
    };
    for (const R of C.roads) {
      const isFoot = R[1] === 1, hw = Math.max(isFoot ? 1.2 : 2.6, R[0] / 2 + (isFoot ? 0 : 0.8)); let run = 0;
      for (let i = 2; i + 3 < R.length; i += 2) {
        const ax = R[i], az = R[i + 1], bx = R[i + 2], bz = R[i + 3], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / (E ? 7 : 40)));
        if (Math.max(Math.abs(ax), Math.abs(az), Math.abs(bx), Math.abs(bz)) > half + 30) continue;
        for (let k = 0; k < n; k++) { const x0 = ax + (bx - ax) * k / n, z0 = az + (bz - az) * k / n, x1 = ax + (bx - ax) * (k + 1) / n, z1 = az + (bz - az) * (k + 1) / n; quad(x0, z0, x1, z1, hw, isFoot ? foot : road, isFoot ? 0.07 : 0.1); }
        if (!isFoot && R[0] >= 6) for (let d = (12 - run % 12) % 12; d + 4 < len; d += 12) { const f0 = d / len, f1 = (d + 4) / len; quad(ax + (bx - ax) * f0, az + (bz - az) * f0, ax + (bx - ax) * f1, az + (bz - az) * f1, 0.16, line, 0.16); }
        run += len;
        // round the joints so bends do not leave gaps
        if (!isFoot) { const y = hM(bx, bz) + 0.09, r = hw; for (let s = 0; s < 6; s++) { const a0 = s / 6 * 6.283, a1 = (s + 1) / 6 * 6.283; P.push(u(bx), y, u(bz), u(bx + Math.cos(a1) * r), y, u(bz + Math.sin(a1) * r), u(bx + Math.cos(a0) * r), y, u(bz + Math.sin(a0) * r)); for (let q = 0; q < 3; q++) { N.push(0, 1, 0); Cc.push(road[0], road[1], road[2]); } } }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
  }

  // ---------- buildings (extruded footprints) ----------
  const neon = new GB();
  {
    const P = [], N = [], Cc = [], UV = [], cols = comu ? VIVID : pal.roofs, _c = new THREE.Color(), white = new THREE.Color('#ffffff'), dusk = new THREE.Color('#8a7ab8');
    let neonEdges = 0;
    for (const B of C.buildings) {
      const n = (B.length - 1) >> 1; if (n < 3) continue;
      const pts = []; let area = 0, ymin = 1e9, ymax = -1e9, cx = 0, cz = 0;
      for (let i = 0; i < n; i++) { const x = B[1 + i * 2], z = B[2 + i * 2]; pts.push(new THREE.Vector2(x, z)); const y = hM(x, z); if (y < ymin) ymin = y; if (y > ymax) ymax = y; cx += x; cz += z; }
      if (pts.length > 3 && pts[0].distanceTo(pts[pts.length - 1]) < 0.3) pts.pop();
      const m = pts.length; if (m < 3) continue; cx /= n; cz /= n;
      if (Math.abs(cx) > half + 10 || Math.abs(cz) > half + 10) continue;
      for (let i = 0, j = m - 1; i < m; j = i++) area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
      if (area > 0) pts.reverse(); // make the winding consistent (walls face out, roof faces up)
      const hgt = Math.max(3, (B[0] || 6) * K * 1.35), y0 = ymin - 0.4, y1 = ymax + hgt;
      const r = U.rng(Math.abs(Math.round(cx * 7919 + cz * 104729)) + 3); r(); r(); r();
      _c.set(r.pick(cols)); if (comu) _c.lerp(white, 0.12); else if (pal.dark) _c.multiplyScalar(1.5).lerp(dusk, 0.25); else _c.lerp(white, 0.3);
      const wc = [_c.r, _c.g, _c.b], rc = [_c.r * 0.5, _c.g * 0.5, _c.b * 0.55], uo = Math.floor(r() * 4) / 4, v1 = Math.max(1, Math.round((y1 - y0) / 1.5)) / 4;
      const nc = r.pick(pal.neon), glowIt = !comu && B[0] >= 18 && neonEdges < 1800;
      for (let i = 0, j = m - 1; i < m; j = i++) {
        const ax = u(pts[j].x), az = u(pts[j].y), bx = u(pts[i].x), bz = u(pts[i].y), len = Math.hypot(bx - ax, bz - az); if (len < 0.05) continue;
        const nx = (bz - az) / len, nz = -(bx - ax) / len, u1 = Math.max(1, Math.round(len / 1.25)) / 4;
        P.push(ax, y1, az, bx, y1, bz, ax, y0, az, bx, y1, bz, bx, y0, bz, ax, y0, az);
        UV.push(uo, v1, uo + u1, v1, uo, 0, uo + u1, v1, uo + u1, 0, uo, 0);
        for (let q = 0; q < 6; q++) { N.push(nx, 0, nz); Cc.push(wc[0], wc[1], wc[2]); }
        if (glowIt && len > 3) { neon.box(nc, (ax + bx) / 2, y1 + 0.05, (az + bz) / 2, len, 0.16, 0.16, 0, -Math.atan2(bz - az, bx - ax), 0); neonEdges++; }
      }
      let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(pts, []); } catch (e) { tris = []; }
      for (const t of tris) for (const q of [t[0], t[2], t[1]]) { P.push(u(pts[q].x), y1, u(pts[q].y)); N.push(0, 1, 0); Cc.push(rc[0], rc[1], rc[2]); UV.push(0.004, 0.004); }
      if (comu && r() < 0.35) { neon.box(r.pick(VIVID), u(cx), y1 + 0.5, u(cz), 1.2, 1.0, 1.2); } // rooftop water tanks in bright colours
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    city.bMat = bldMaterial(VP);
    const m = new THREE.Mesh(g, city.bMat); m.frustumCulled = false; scene.add(m);
  }

  // ---------- trees / palms, lamps ----------
  {
    const spots = [], inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) if ((P[i + 1] > z) !== (P[j + 1] > z) && x < (P[j] - P[i]) * (z - P[i + 1]) / (P[j + 1] - P[i + 1]) + P[i]) c = !c; return c; };
    for (const P of C.green || []) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < P.length; i += 2) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 1]); z1 = Math.max(z1, P[i + 1]); } const want = Math.min(26, Math.ceil((x1 - x0) * (z1 - z0) / 420)); for (let k = 0, tries = 0; k < want && tries < want * 6; tries++) { const x = rng.range(x0, x1), z = rng.range(z0, z1); if (Math.abs(x) < half - 4 && Math.abs(z) < half - 4 && inPoly(P, x, z) && gAt(x, z) === GT.G_GRASS) { spots.push([x, z]); k++; } } }
    for (let i = 0; i < 500 && spots.length < 420; i++) { const x = rng.range(-half, half), z = rng.range(-half, half), g = gAt(x, z); if (g === GT.G_SAND && rng() < 0.25 || (g === GT.G_LOT && rng() < 0.12)) spots.push([x, z]); }
    const list = spots.slice(0, 420), geo = meta.palms ? palmGeo() : treeGeo();
    const im = new THREE.InstancedMesh(geo, MAT.lit, Math.max(1, list.length)), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    list.forEach((s, i) => { const k = 0.85 + rng() * 0.5; e.set(0, rng() * 6.283, 0); q.setFromEuler(e); mt.compose(p.set(u(s[0]), hM(s[0], s[1]), u(s[1])), q, sc.set(k, k, k)); im.setMatrixAt(i, mt); });
    im.count = list.length; im.frustumCulled = false; scene.add(im); city.palms = im; city.palmCount = list.length;
    // street lamps along the main roads
    const lg = new GB(); lg.add(PR.cyl6, '#59536b', 0, 2.2, 0, 0.07, 4.4, 0.07); lg.box('#fff6c8', 0, 4.45, 0, 0.5, 0.12, 0.5);
    const lamps = [];
    for (const R of C.roads) { if (R[1] === 1 || R[0] < 6) continue; let acc = 20; for (let i = 2; i + 3 < R.length && lamps.length < 240; i += 2) { const ax = R[i], az = R[i + 1], bx = R[i + 2], bz = R[i + 3], len = Math.hypot(bx - ax, bz - az) || 1; acc += len; if (acc > 48) { acc = 0; const nx = -(bz - az) / len, nz = (bx - ax) / len, x = ax + nx * (R[0] / 2 + 1.6), z = az + nz * (R[0] / 2 + 1.6); if (Math.abs(x) < half && Math.abs(z) < half && gAt(x, z) !== GT.G_WATER) lamps.push([x, z]); } } }
    const lm = new THREE.InstancedMesh(lg.geo(), MAT.lit, Math.max(1, lamps.length));
    lamps.forEach((s, i) => { const y = hM(s[0], s[1]); mt.compose(p.set(u(s[0]), y, u(s[1])), q.identity(), sc.set(1, 1, 1)); lm.setMatrixAt(i, mt); city.glowPts.push({ x: u(s[0]), y: y + 4.4, z: u(s[1]), col: pal.lamp, s: 7 }); });
    lm.count = lamps.length; lm.frustumCulled = false; scene.add(lm);
  }

  // ---------- landmarks: glowing beacons; comunidade kites ----------
  {
    const beam = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); beam.translate(0, 0.5, 0);
    const n = beam.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const t = 1 - beam.attributes.position.getY(i); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = t * t; } beam.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const top = W.landmarks.slice().sort((a, b) => b.h - a.h).slice(0, 14), im = new THREE.InstancedMesh(beam, new THREE.MeshBasicMaterial({ color: 0xffd23f, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), Math.max(1, top.length));
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    top.forEach((l, i) => { const y = W.hpx(l.x, l.y), H = Math.max(26, l.h * K * 1.35 + 18); mt.compose(p.set(l.x / 24, y, l.y / 24), q, sc.set(0.8, H, 0.8)); im.setMatrixAt(i, mt); city.glowPts.push({ x: l.x / 24, y: y + H * 0.6, z: l.y / 24, col: '#ffd23f', s: 12 }); l.beacon = true; });
    im.count = top.length; im.frustumCulled = false; scene.add(im);
    if (comu) for (let i = 0; i < 16; i++) { const x = rng.range(-half * 0.8, half * 0.8), z = rng.range(-half * 0.8, half * 0.8), y = hM(x, z) + rng.range(16, 34), col = rng.pick(VIVID); neon.box(col, u(x), y, u(z), 1.5, 1.5, 0.05, 0.4, rng() * 3, Math.PI / 4); neon.box('#ffffff', u(x), y - 1.6, u(z), 0.06, 2.2, 0.06, 0.3); }
  }
  const nm = neon.mesh(MAT.glow); nm.frustumCulled = false; scene.add(nm);
  glowPoints(city, scene);
  skyWater(city, scene, VP, u(0), u(0), -0.3);
  return city;
}
