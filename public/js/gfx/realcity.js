// VICE PAWS — real-city renderer: builds the 3D scene of an OpenStreetMap extract (data/cities/*.json)
// Buildings are extruded footprints, roads are ribbons on the terrain, everything merged into a handful of draw calls.
import { THREE, GB, MAT, PR } from './models.js';
import { bldMaterial, palmGeo, palmGeoLo, treeGeo, treeGeoLo, glowPoints, skyWater, lin, MOODS } from './city.js';
import { chunkMesh, chunkInstances } from './lod.js';

// Landmarks shown as a low-poly backdrop from any map within 14 km of them (height in metres above the sea)
const SKYLINE = [{ kind: 'cristo', lat: -22.9519, lon: -43.2105, h: 710 }, { kind: 'sugarloaf', lat: -22.9492, lon: -43.1545, h: 396 }];
const VIVID = ['#ff5a7a', '#ffb347', '#ffe066', '#5fd0c8', '#7fb4ff', '#c9a7ff', '#ff8fd0', '#7CFF6B', '#ff7043', '#40c4ff'];
export function buildRealCity(W, scene, VP) {
  const C = W.real, meta = W.meta || {}, K = 2 / VP.World.MPT, half = C.half, U = VP.U, rng = U.rng(77 + C.id.length * 13), pal = W.pal;
  const city = { glowPts: [], real: true, chunks: [] }, GT = VP.World.GT, tags = C.tags || [];
  const comu = tags.includes('comunidade');
  const u = m => (m + half) * K;
  // terrain height (3D units) at metres: comes from the simulation world, so movement and rendering always agree
  const E = W.hasElev, hM = W.hM;
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
    chunkMesh(g, MAT.lit, scene, city, { cell: 80 });
  }

  // ---------- roads (ribbons following the terrain) ----------
  {
    const P = [], N = [], Cc = [];
    const road = lin(pal.road), foot = lin(comu ? '#e9d9c0' : pal.walk2), line = lin(pal.line), step0 = lin('#e8e0d2'), step1 = lin('#bdb3a4'); let stairN = 0;
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
        const rise = Math.abs(hM(bx, bz) - hM(ax, az)) / K / (len || 1);
        if (isFoot && E && rise > 0.16 && len > 3) { // steep footpath: a stairway with flat treads and painted risers
          const ns = Math.max(2, Math.ceil(len / 1.6)), up = hM(bx, bz) > hM(ax, az);
          for (let k = 0; k < ns; k++) {
            const f0 = k / ns, f1 = (k + 1) / ns, x0 = ax + (bx - ax) * f0, z0 = az + (bz - az) * f0, x1 = ax + (bx - ax) * f1, z1 = az + (bz - az) * f1, y = Math.max(hM(x0, z0), hM(x1, z1)) + 0.09, yl = Math.min(hM(x0, z0), hM(x1, z1)) + 0.02;
            const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * hw, nz = dx / l * hw, c = k % 2 ? step1 : step0, rc = comu ? lin(VIVID[(k + stairN) % VIVID.length]) : step1;
            P.push(u(x0 - nx), y, u(z0 - nz), u(x0 + nx), y, u(z0 + nz), u(x1 - nx), y, u(z1 - nz), u(x1 - nx), y, u(z1 - nz), u(x0 + nx), y, u(z0 + nz), u(x1 + nx), y, u(z1 + nz));
            for (let q = 0; q < 6; q++) { N.push(0, 1, 0); Cc.push(c[0], c[1], c[2]); }
            const ex = up ? x0 : x1, ez = up ? z0 : z1; // riser on the low side of the tread
            P.push(u(ex - nx), y, u(ez - nz), u(ex - nx), yl, u(ez - nz), u(ex + nx), y, u(ez + nz), u(ex + nx), y, u(ez + nz), u(ex - nx), yl, u(ez - nz), u(ex + nx), yl, u(ez + nz), u(ex + nx), y, u(ez + nz), u(ex - nx), yl, u(ez - nz), u(ex - nx), y, u(ez - nz), u(ex + nx), yl, u(ez + nz), u(ex - nx), yl, u(ez - nz), u(ex + nx), y, u(ez + nz));
            for (let q = 0; q < 12; q++) { N.push(0, 0.6, 0.8); Cc.push(rc[0], rc[1], rc[2]); }
          }
          stairN++; city.stairs = (city.stairs || 0) + 1;
        } else
        for (let k = 0; k < n; k++) { const x0 = ax + (bx - ax) * k / n, z0 = az + (bz - az) * k / n, x1 = ax + (bx - ax) * (k + 1) / n, z1 = az + (bz - az) * (k + 1) / n; quad(x0, z0, x1, z1, hw, isFoot ? foot : road, isFoot ? 0.07 : 0.1); }
        if (!isFoot && R[0] >= 6) for (let d = (12 - run % 12) % 12; d + 4 < len; d += 12) { const f0 = d / len, f1 = (d + 4) / len; quad(ax + (bx - ax) * f0, az + (bz - az) * f0, ax + (bx - ax) * f1, az + (bz - az) * f1, 0.16, line, 0.16); }
        run += len;
        // round the joints so bends do not leave gaps
        if (!isFoot) { const y = hM(bx, bz) + 0.09, r = hw; for (let s = 0; s < 6; s++) { const a0 = s / 6 * 6.283, a1 = (s + 1) / 6 * 6.283; P.push(u(bx), y, u(bz), u(bx + Math.cos(a1) * r), y, u(bz + Math.sin(a1) * r), u(bx + Math.cos(a0) * r), y, u(bz + Math.sin(a0) * r)); for (let q = 0; q < 3; q++) { N.push(0, 1, 0); Cc.push(road[0], road[1], road[2]); } } }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    chunkMesh(g, mat, scene, city, { cell: 80 });
  }

  // ---------- procedural street frontage for sparse maps (lots come from World.infill, so collision matches) ----------
  const fill = W.infill || [], STY = VP.World.STYLES[W.style] || VP.World.STYLES.us, KH = K * 1.35, fillBody = new GB(), fillDet = new GB(), fillNeon = new GB();
  const fillBlocks = fill.filter(L => L.k === 'block').map(L => { const hw = L.w / 2 - 0.4, hd = L.d / 2 - 0.4, o = [L.h]; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) o.push(L.x + L.ux * hw * a + L.fx * hd * b, L.z + L.uz * hw * a + L.fz * hd * b); return o; });
  {
    const ROOFS = { clay: ['#c96a3b', '#b85c34', '#d47a4a', '#a8552f'], gray: ['#6b6f7a', '#585c68', '#7a6a5e', '#8a4a44'] }, AWN = ['#e01e37', '#2a6bff', '#1fa85a', '#ff8a1f', '#ffd23f', '#8a4fd0'], _c = new THREE.Color();
    // gable roof: ridge along the street, pushed straight into the merged buffers
    const gable = (g, col, cx, y, cz, ux, uz, fx, fz, hl, hd, rise) => {
      _c.set(col); const v = (a, b, h) => [u(cx + ux * hl * a + fx * hd * b), y + h, u(cz + uz * hl * a + fz * hd * b)], A = v(-1, -1, 0), B = v(1, -1, 0), Cc = v(1, 1, 0), D = v(-1, 1, 0), E0 = v(-1, 0, rise), E1 = v(1, 0, rise);
      const tri = (p, q, r, sh) => { const ax = q[0] - p[0], ay = q[1] - p[1], az = q[2] - p[2], bx = r[0] - p[0], by = r[1] - p[1], bz = r[2] - p[2]; let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; const fl = ny < 0; for (const t of fl ? [p, r, q] : [p, q, r]) { g.p.push(t[0], t[1], t[2]); g.n.push(fl ? -nx : nx, fl ? -ny : ny, fl ? -nz : nz); g.c.push(_c.r * sh, _c.g * sh, _c.b * sh); } };
      tri(A, B, E1, 1); tri(A, E1, E0, 1); tri(D, Cc, E1, 0.86); tri(D, E1, E0, 0.86);
      // gable ends face outwards along the ridge
      for (const [p, q, r, sgn] of [[A, D, E0, -1], [B, Cc, E1, 1]]) { for (const t of sgn * (ux * ((q[2] - p[2]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[2] - p[2]))) > 0 ? [p, q, r] : [p, r, q]) { g.p.push(t[0], t[1], t[2]); g.n.push(ux * sgn, 0, uz * sgn); g.c.push(_c.r * 0.7, _c.g * 0.7, _c.b * 0.7); } }
    };
    for (const L of fill) {
      if (L.k === 'block') continue;
      const r = U.rng(L.s + 5), ry = -Math.atan2(L.uz, L.ux), col = r.pick(STY.cols), y0 = Math.min(hM(L.x, L.z), hM(L.x + L.fx * L.d / 2, L.z + L.fz * L.d / 2), hM(L.x - L.fx * L.d / 2, L.z - L.fz * L.d / 2));
      const at = (a, b) => [L.x + L.ux * a + L.fx * b, L.z + L.uz * a + L.fz * b]; // a along the street, b towards it (metres from the lot centre)
      if (L.k === 'house') {
        const bw = L.w - (STY.walls ? 1.8 : 3), bd = L.d * 0.56, bh = 3.1, cb = at(0, -(L.d / 2 - bd / 2 - 0.4)), ft = -(L.d / 2 - bd - 0.4);
        fillBody.box(col, u(cb[0]), y0 + bh * KH / 2 - 0.3, u(cb[1]), bw * K, bh * KH + 0.6, bd * K, 0, ry, 0);
        if (STY.roof !== 'flat') gable(fillBody, r.pick(ROOFS[STY.roof]), cb[0], y0 + bh * KH, cb[1], L.ux, L.uz, L.fx, L.fz, bw / 2 + 0.5, bd / 2 + 0.6, 1.25 * KH);
        else fillBody.box(r.pick(STY.trim), u(cb[0]), y0 + bh * KH + 0.1, u(cb[1]), (bw + 0.3) * K, 0.22, (bd + 0.3) * K, 0, ry, 0);
        const dx = (r() < 0.5 ? -1 : 1) * bw * 0.22, d0 = at(dx, ft + 0.04), w0 = at(-dx, ft + 0.04), tc = r.pick(STY.trim);
        fillDet.box(r.pick(['#6b4a32', '#3f6b8a', '#8a3b2f', '#3d6b4a']), u(d0[0]), y0 + 1.05 * KH, u(d0[1]), 0.95 * K, 2.1 * KH, 0.08, 0, ry, 0);
        fillDet.box('#9fd8ff', u(w0[0]), y0 + 1.6 * KH, u(w0[1]), 1.3 * K, 1.0 * KH, 0.08, 0, ry, 0); fillDet.box(tc, u(w0[0]), y0 + 1.03 * KH, u(w0[1]), 1.5 * K, 0.12 * KH, 0.14, 0, ry, 0);
        if (STY.walls) { // front wall with a gate, short side walls: the classic Brazilian street front
          const gx = (r() < 0.5 ? -1 : 1) * L.w * 0.2, gw = 2.6, fb = L.d / 2 - 0.2, wh = 1.85, yf = hM(L.x + L.fx * fb, L.z + L.fz * fb);
          for (const [a0, a1] of [[-L.w / 2 + 0.2, gx - gw / 2], [gx + gw / 2, L.w / 2 - 0.2]]) { if (a1 - a0 < 0.4) continue; const m = at((a0 + a1) / 2, fb); fillDet.box(tc, u(m[0]), yf + wh * KH / 2 - 0.15, u(m[1]), (a1 - a0) * K, wh * KH + 0.3, 0.2, 0, ry, 0); }
          const gp = at(gx, fb); fillDet.box(r.pick(['#4a5560', '#7a4a32', '#2f5d4a', '#59636e']), u(gp[0]), yf + 0.8 * KH, u(gp[1]), gw * K, 1.6 * KH, 0.09, 0, ry, 0);
          for (const sx of [-1, 1]) { const m = at(sx * (L.w / 2 - 0.25), (fb + ft) / 2); fillDet.box(tc, u(m[0]), yf + wh * KH / 2 - 0.15, u(m[1]), 0.2, wh * KH + 0.3, (fb - ft) * K, 0, ry, 0); }
        }
      } else { // shop: full-width front, awning over the pavement, sign band
        const bw = L.w - 0.5, bd = L.d - 1.2, bh = 4.2, cb = at(0, -0.4), ft = bd / 2 - 0.4, ac = r.pick(AWN);
        fillBody.box(col, u(cb[0]), y0 + bh * KH / 2 - 0.3, u(cb[1]), bw * K, bh * KH + 0.6, bd * K, 0, ry, 0);
        fillBody.box(r.pick(STY.trim), u(cb[0]), y0 + bh * KH + 0.12, u(cb[1]), (bw + 0.2) * K, 0.24, (bd + 0.2) * K, 0, ry, 0);
        const f0 = at(0, ft + 0.05), f1 = at(0, ft + 0.95), f2 = at(0, ft + 1.85);
        fillDet.box('#2b3a4a', u(f0[0]), y0 + 1.15 * KH, u(f0[1]), bw * 0.62 * K, 2.3 * KH, 0.08, 0, ry, 0);
        fillDet.box(ac, u(f1[0]), y0 + 2.75 * KH, u(f1[1]), (bw - 0.6) * K, 0.1, 1.8 * K, 0, ry, 0); fillDet.box('#ffffff', u(f2[0]), y0 + 2.58 * KH, u(f2[1]), (bw - 0.6) * K, 0.3 * KH, 0.06, 0, ry, 0);
        (STY.sign ? fillNeon : fillDet).box(STY.sign ? r.pick(pal.neon) : r.pick(['#ffffff', '#ffd23f', '#1f2a44', '#e01e37', '#1fa85a']), u(f0[0]), y0 + 3.55 * KH, u(f0[1]), (bw - 1) * K, 0.7 * KH, 0.1, 0, ry, 0);
      }
    }
    city.infill = fill.length;
    if (fillBody.p.length) chunkMesh(fillBody.geo(), MAT.flat, scene, city, { cell: 80 });
    if (fillDet.p.length) chunkMesh(fillDet.geo(), MAT.flat, scene, city, { cell: 80, detail: 1.7 });
    if (fillNeon.p.length) chunkMesh(fillNeon.geo(), MAT.glow, scene, city, { cell: 80, detail: 1.8 });
  }

  // ---------- buildings (extruded footprints) ----------
  const neon = new GB(), mural = new GB(), pitches = [];
  {
    const P = [], N = [], Cc = [], UV = [], cols = comu ? VIVID : pal.roofs, _c = new THREE.Color(), white = new THREE.Color('#ffffff'), dusk = new THREE.Color('#8a7ab8');
    let neonEdges = 0;
    for (const B of C.buildings.concat(fillBlocks)) {
      const n = (B.length - 1) >> 1; if (n < 3) continue;
      const pts = []; let area = 0, ymin = 1e9, ymax = -1e9, cx = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += B[1 + i * 2]; cz += B[2 + i * 2]; } cx /= n; cz /= n;
      // keep streets, alleys and stairways clear: shrink the footprint towards its centre until it no longer covers walkable tiles
      let sc = 0; for (const f of [1, 0.86, 0.72, 0.58, 0.44]) { let hit = false; for (let i = 0; i < n && !hit; i++) { const x0 = cx + (B[1 + i * 2] - cx) * f, z0 = cz + (B[2 + i * 2] - cz) * f, k = (i + 1) % n, x1 = cx + (B[1 + k * 2] - cx) * f, z1 = cz + (B[2 + k * 2] - cz) * f; for (const t of [0, 0.33, 0.66]) { const g = gAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t); if (g === GT.G_ROAD || g === GT.G_WALK) { hit = true; break; } } } if (!hit) { sc = f; break; } }
      if (!sc) continue;
      for (let i = 0; i < n; i++) { const x = cx + (B[1 + i * 2] - cx) * sc, z = cz + (B[2 + i * 2] - cz) * sc; pts.push(new THREE.Vector2(x, z)); const y = hM(x, z); if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      if (pts.length > 3 && pts[0].distanceTo(pts[pts.length - 1]) < 0.3) pts.pop();
      const m = pts.length; if (m < 3) continue;
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
        if (comu && len > 3.2 && r() < 0.22 && city.murals !== 90) { // mural: bright stripes and a sun painted on the wall
          city.murals = (city.murals || 0) + 1; const ry = -Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2 + nx * 0.05, mz = (az + bz) / 2 + nz * 0.05, mw = Math.min(len * 0.8, 5), k0 = Math.floor(r() * 10);
          const base = Math.max(hM(pts[j].x, pts[j].y), hM(pts[i].x, pts[i].y)) + 0.5, n5 = 4 + Math.floor(r() * 3);
          for (let q = 0; q < n5; q++) mural.box(VIVID[(k0 + q * 3) % VIVID.length], mx + (bx - ax) / len * (q / (n5 - 1) - 0.5) * mw * 0.8, base + 1.1 + Math.sin(q * 1.7 + k0) * 0.25, mz + (bz - az) / len * (q / (n5 - 1) - 0.5) * mw * 0.8, mw / n5 * 0.86, 1.7 + (q % 2) * 0.5, 0.06, 0, ry, 0);
          mural.cyl('#fff6c8', mx + nx * 0.04, base + 2.5, mz + nz * 0.04, 0.42, 0.05, 0.42, Math.PI / 2, ry, 0);
        }
        if (glowIt && len > 3) { neon.box(nc, (ax + bx) / 2, y1 + 0.05, (az + bz) / 2, len, 0.16, 0.16, 0, -Math.atan2(bz - az, bx - ax), 0); neonEdges++; }
      }
      let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(pts, []); } catch (e) { tris = []; }
      for (const t of tris) for (const q of [t[0], t[2], t[1]]) { P.push(u(pts[q].x), y1, u(pts[q].y)); N.push(0, 1, 0); Cc.push(rc[0], rc[1], rc[2]); UV.push(0.004, 0.004); }
      if (comu && r() < 0.35) { mural.cyl(r.pick(['#3f8fd0', '#2f7fc0', '#5fa8e0']), u(cx), y1 + 0.55, u(cz), 0.6, 1.1, 0.6); } // blue rooftop water tanks
      if (comu && Math.abs(area) > 260 && pitches.length < 4 && ymax - ymin < 1.5) pitches.push({ x: u(cx), y: y1 + 0.03, z: u(cz), s: Math.min(1, Math.sqrt(Math.abs(area)) / 26) }); // big flat roof: a rooftop football pitch
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    city.bMat = bldMaterial(VP);
    chunkMesh(g, city.bMat, scene, city, { cell: 80 });
  }

  // ---------- trees / palms, lamps ----------
  {
    const spots = [], inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) if ((P[i + 1] > z) !== (P[j + 1] > z) && x < (P[j] - P[i]) * (z - P[i + 1]) / (P[j + 1] - P[i + 1]) + P[i]) c = !c; return c; };
    for (const P of C.green || []) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < P.length; i += 2) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 1]); z1 = Math.max(z1, P[i + 1]); } const want = Math.min(26, Math.ceil((x1 - x0) * (z1 - z0) / 420)); for (let k = 0, tries = 0; k < want && tries < want * 6; tries++) { const x = rng.range(x0, x1), z = rng.range(z0, z1); if (Math.abs(x) < half - 4 && Math.abs(z) < half - 4 && inPoly(P, x, z) && gAt(x, z) === GT.G_GRASS) { spots.push([x, z]); k++; } } }
    for (let i = 0; i < 500 && spots.length < 420; i++) { const x = rng.range(-half, half), z = rng.range(-half, half), g = gAt(x, z); if (g === GT.G_SAND && rng() < 0.25 || (g === GT.G_LOT && rng() < 0.12)) spots.push([x, z]); }
    const list = spots.slice(0, 420), inst = sp => ({ x: u(sp[0]), y: hM(sp[0], sp[1]), z: u(sp[1]), ry: rng() * 6.283, s: 0.85 + rng() * 0.5 });
    // street trees of the procedural frontage: ipês in bloom (yellow, pink, purple, white), palms or plain trees
    const ft = W.infillTrees || [], IPE = ['#ffd23f', '#ff8fd0', '#b388ff', '#fff3fa'], extraPalms = ft.filter(t => t[2] === 'palm'), extraTrees = ft.filter(t => t[2] === 'tree'), ipes = ft.filter(t => t[2] === 'ipe');
    const palmsL = (meta.palms ? list : []).concat(extraPalms), treesL = (meta.palms ? [] : list).concat(extraTrees);
    if (palmsL.length) chunkInstances(palmGeo(), palmGeoLo(), MAT.lit, palmsL.map(inst), scene, city, { cell: 90 });
    if (treesL.length) chunkInstances(treeGeo(), treeGeoLo(), MAT.lit, treesL.map(inst), scene, city, { cell: 90 });
    for (let ci = 0; ci < 4 && ipes.length; ci++) { // one small instanced set per blossom colour (the trunk stays brown)
      const some = ipes.filter(t => t[3] % 4 === ci); if (!some.length) continue; const cc = new THREE.Color(IPE[ci]), c2 = '#' + cc.clone().multiplyScalar(0.9).getHexString(), c3 = '#' + cc.clone().multiplyScalar(0.8).getHexString();
      const hi = new GB(); hi.add(PR.cyl6, '#7a5a3b', 0, 1.3, 0, 0.2, 2.6, 0.2); hi.lo(IPE[ci], 0, 3.5, 0, 1.9, 1.4, 1.9); hi.lo(c2, 0.7, 4.3, 0.3, 1.2, 1.0, 1.2); hi.lo(c3, -0.7, 4.1, -0.4, 1.1, 0.9, 1.1); const lo = new GB(); lo.add(PR.cyl6, '#7a5a3b', 0, 1.3, 0, 0.2, 2.6, 0.2); lo.add(PR.cone, IPE[ci], 0, 3.9, 0, 1.9, 2.6, 1.9);
      chunkInstances(hi.geo(), lo.geo(), MAT.lit, some.map(inst), scene, city, { cell: 90 }); }
    city.ipes = ipes.length;
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(); void mt; void q; void p; void sc;
    // street lamps along the main roads
    const lg = new GB(); lg.add(PR.cyl6, '#59536b', 0, 2.2, 0, 0.07, 4.4, 0.07); lg.box('#fff6c8', 0, 4.45, 0, 0.5, 0.12, 0.5);
    const lamps = [];
    for (const R of C.roads) { if (R[1] === 1 || R[0] < 6) continue; let acc = 20; for (let i = 2; i + 3 < R.length && lamps.length < 240; i += 2) { const ax = R[i], az = R[i + 1], bx = R[i + 2], bz = R[i + 3], len = Math.hypot(bx - ax, bz - az) || 1; acc += len; if (acc > 48) { acc = 0; const nx = -(bz - az) / len, nz = (bx - ax) / len, x = ax + nx * (R[0] / 2 + 1.6), z = az + nz * (R[0] / 2 + 1.6); if (Math.abs(x) < half && Math.abs(z) < half && gAt(x, z) !== GT.G_WATER) lamps.push([x, z]); } } }
    lamps.forEach(sp => { city.glowPts.push({ x: u(sp[0]), y: hM(sp[0], sp[1]) + 4.4, z: u(sp[1]), col: pal.lamp, s: 7 }); });
    chunkInstances(lg.geo(), null, MAT.lit, lamps.map(sp => ({ x: u(sp[0]), y: hM(sp[0], sp[1]), z: u(sp[1]) })), scene, city, { cell: 90, detail: 1.5 });
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
  // ---------- comunidade: football pitches (rooftops + the little ground pitch the missions use) ----------
  const pitch = (x, y, z, s, flat) => {
    const g = flat || mural; g.box('#3fae5a', x, y, z, 9 * s, 0.05, 6 * s); for (const sx of [-1, 1]) { g.box('#ffffff', x + sx * 4.4 * s, y + 0.03, z, 0.12, 0.03, 6 * s); g.box('#ffffff', x + sx * 4.3 * s, y + 0.6, z, 0.1, 1.2, 2.2 * s); g.box('#ffffff', x + sx * 4.3 * s, y + 1.2, z, 0.12, 0.1, 2.3 * s); }
    for (const sz of [-1, 1]) g.box('#ffffff', x, y + 0.03, z + sz * 2.95 * s, 9 * s, 0.03, 0.12); g.box('#ffffff', x, y + 0.03, z, 0.1, 0.03, 6 * s); g.cyl('#ffffff', x, y + 0.02, z, 0.9 * s, 0.03, 0.9 * s);
  };
  for (const pt of pitches) pitch(pt.x, pt.y, pt.z, pt.s);
  if (W.pitch) { const py = Math.max(W.hpx(W.pitch.x - 90, W.pitch.y), W.hpx(W.pitch.x + 90, W.pitch.y), W.hpx(W.pitch.x, W.pitch.y - 60), W.hpx(W.pitch.x, W.pitch.y + 60)); pitch(W.pitch.x / 24, py + 0.1, W.pitch.y / 24, 0.8); mural.box('#b98a5e', W.pitch.x / 24, py - 3.9, W.pitch.y / 24, 7.6, 7.9, 5.2); W.pitch.h = py + 0.12; }
  city.pitches = pitches.length;
  // ---------- Rio Verde: the livestock fair next to the start (tents, hay, flags, prize cattle) ----------
  if (C.id === 'rioverde' && W.tourStart) {
    const fx = W.tourStart.x / 24, fz = W.tourStart.y / 24, r2 = U.rng(2026);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * 6.283, d = 9 + r2() * 9, x = fx + Math.cos(a) * d, z = fz + Math.sin(a) * d, px = x * 24, py = z * 24; if (W.blocked(px, py, 30, 0)) continue; const y = W.hpx(px, py);
      if (i % 3 === 0) { mural.box('#ffffff', x, y + 1.1, z, 2.6, 0.1, 2.6); mural.add(PR.cone, i % 2 ? '#e01e37' : '#ffd23f', x, y + 2.2, z, 2.3, 1.6, 2.3, 0, Math.PI / 4, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mural.cyl('#8a5a2b', x + sx * 1.2, y + 0.55, z + sz * 1.2, 0.06, 1.1, 0.06); }
      else if (i % 3 === 1) { for (let k = 0; k < 3; k++) mural.cyl('#e8c860', x + (k - 1) * 0.9, y + 0.42, z, 0.42, 0.8, 0.42, Math.PI / 2, 0, 0); mural.cyl('#e8c860', x, y + 1.15, z, 0.42, 0.8, 0.42, Math.PI / 2, 0, 0); }
      else { mural.box('#f4f0ea', x, y + 0.75, z, 0.7, 0.6, 1.3); mural.box('#2b2b33', x + 0.1, y + 0.85, z + 0.2, 0.72, 0.3, 0.5); mural.box('#f4f0ea', x, y + 1.0, z + 0.8, 0.45, 0.45, 0.5); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mural.box('#d8d0c4', x + sx * 0.25, y + 0.22, z + sz * 0.45, 0.14, 0.45, 0.14); mural.cone('#fff6c8', x - 0.2, y + 1.3, z + 0.85, 0.05, 0.2); mural.cone('#fff6c8', x + 0.2, y + 1.3, z + 0.85, 0.05, 0.2); }
    }
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, x = fx + Math.cos(a) * 14, z = fz + Math.sin(a) * 14; neon.box(['#ffd23f', '#7CFF6B', '#2a6bff', '#ffffff'][i % 4], x, W.hpx(x * 24, z * 24) + 4.2, z, 0.5, 0.36, 0.04, 0, a, 0); }
  }
  // ---------- distant skyline: famous silhouettes outside the map, placed on their real bearing (never fogged out) ----------
  {
    const g = new GB(), hz = new THREE.Color(MOODS[meta.mood || 0].fog), _k = new THREE.Color(), tone = (c, f) => '#' + _k.set(c).lerp(hz, f === undefined ? 0.42 : f).getHexString(); let any = 0, nearSky = 1e9;
    for (const S of SKYLINE) {
      const mx = (S.lon - C.lon) * Math.cos(C.lat * Math.PI / 180) * 111320, mz = -(S.lat - C.lat) * 110540, real = Math.hypot(mx, mz);
      if (real > 14000 || real < 1) continue;
      if (Math.abs(mx) < half - 40 && Math.abs(mz) < half - 40) continue; // inside the playable map: the map itself shows it
      // far ones peak about 7 degrees above the horizon (the top of the screen is at ~8); a hill right next to the map towers over it
      const Dm = U.clamp(real, half + 250, half + 500), dx = mx / real, dz = mz / real, H = U.clamp(S.h * Dm / real, Dm * 0.11, Dm * (real < 1500 ? 0.3 : 0.135)) * K, x = u(dx * Dm), z = u(dz * Dm), sx = -dz, sz = dx, ry = Math.atan2(-dx, -dz);
      if (S.kind === 'sugarloaf') {
        g.lo(tone('#3f8a5a'), x, -2, z, H * 0.62, H * 0.3, H * 0.5, 0, ry, 0); g.lo(tone('#8a8f9a'), x, -2, z, H * 0.36, H, H * 0.33, 0, ry, 0.06);
        const ux2 = x + sx * H * 0.78, uz2 = z + sz * H * 0.78; g.lo(tone('#3f8a5a'), ux2, -2, uz2, H * 0.5, H * 0.3, H * 0.42, 0, ry, 0); g.lo(tone('#7f8792'), ux2, -2, uz2, H * 0.4, H * 0.55, H * 0.34, 0, ry, 0);
        // the cable car line between the two hills, with a little car on it
        const ax = x + sx * H * 0.05, az = z + sz * H * 0.05, len = H * 0.74; g.box(tone('#2b2b33', 0.2), (ax + ux2) / 2, H * 0.76, (az + uz2) / 2, len, H * 0.006, H * 0.006, 0, ry, 0.56); g.box(tone('#ffd23f', 0.1), (ax + ux2) / 2, H * 0.735, (az + uz2) / 2, H * 0.05, H * 0.035, H * 0.03, 0, ry, 0);
      } else if (S.kind === 'cristo') {
        g.add(PR.cone, tone('#3f8a5a'), x, H * 0.5 - 2, z, H * 0.62, H, H * 0.62, 0, ry, 0); g.lo(tone('#357a50'), x + sx * H * 0.5, -2, z + sz * H * 0.5, H * 0.6, H * 0.55, H * 0.5, 0, ry, 0); g.lo(tone('#357a50'), x - sx * H * 0.55, -2, z - sz * H * 0.55, H * 0.55, H * 0.42, 0.5 * H, 0, ry, 0);
        const c = H * 0.2, w = tone('#f4f1ea', 0.12); g.box(tone('#b9b4a8', 0.2), x, H - 2 + c * 0.1, z, c * 0.5, c * 0.3, c * 0.5, 0, ry, 0); g.box(w, x, H - 2 + c * 0.72, z, c * 0.26, c, c * 0.2, 0, ry, 0); g.box(w, x, H - 2 + c * 1.0, z, c * 1.08, c * 0.15, c * 0.16, 0, ry, 0); g.lo(w, x, H - 2 + c * 1.32, z, c * 0.12);
      }
      if (!any || real < nearSky) { nearSky = real; city.skyYaw = Math.atan2(dz, dx); }
      any++;
    }
    if (any) { const m = new THREE.Mesh(g.geo(), new THREE.MeshLambertMaterial({ vertexColors: true, fog: false })); m.frustumCulled = false; m.matrixAutoUpdate = false; scene.add(m); }
    city.skyline = any;
  }
  if (mural.p.length) chunkMesh(mural.geo(), MAT.flat, scene, city, { cell: 80, detail: 1.6 });
  if (neon.p.length) chunkMesh(neon.geo(), MAT.glow, scene, city, { cell: 80, detail: 1.8 });
  glowPoints(city, scene);
  skyWater(city, scene, VP, u(0), u(0), -0.3);
  return city;
}
