// VICE PAWS — Three.js renderer: syncs the simulation (VP.Game.G) to a 3D scene. No game logic here.
import { THREE, GB, MAT, buildCat, animCat, CAT_SPECS, buildDog, animDog, buildCar, itemGeo, buildProp } from './models.js';
import { buildCity, MOODS, LAND_H, glowMaterial } from './city.js';
import { buildRealCity } from './realcity.js';

const VP = window.VP, U = VP.U, I = VP.I, S = 1 / 24;
const R = VP.R3 = { ok: false, lost: false, quality: 2, fps: 60, mode: 'game', draws: 0 };
let renderer, scene, camera, city, W, dyn, hemi, sun, canvas;
let stage, stageCam, stageGroup, stageItems = [];
const ents = new Map(); let frame = 0;
const cam = { yaw: -Math.PI / 2, dist: 9.5, pitch: 0.52, x: 0, y: 0, z: 0, init: false };
const mood = { cur: null, i: -1 };
const _v = new THREE.Vector3(), _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6), ndc = new THREE.Vector2();
const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
R.mobile = mobile;

// ---------- world (static city) swapping ----------
let cityGroup = null;
R.setWorld = function (nw) {
  if (nw === W && city) return;
  if (cityGroup) { scene.remove(cityGroup); cityGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose && o.material !== MAT.lit && o.material !== MAT.flat && o.material !== MAT.glow) { if (o.material.map) o.material.map.dispose(); if (o.material.emissiveMap) o.material.emissiveMap.dispose(); o.material.dispose(); } }); }
  W = nw; cityGroup = new THREE.Group(); scene.add(cityGroup);
  city = nw.real ? buildRealCity(nw, cityGroup, VP) : buildCity(nw, cityGroup, VP); R.city = city;
  mood.cur = null; if (R.ok) R.resize();
};
// ---------- init ----------
R.init = function (cv) {
  canvas = cv;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !mobile, powerPreference: 'high-performance', alpha: false, stencil: false });
  } catch (e) { return false; }
  if (!renderer.getContext()) return false;
  R.quality = mobile ? 1 : 2;
  try { const q = VP.ls.get('vp_quality'); if (q !== null && q !== '') R.quality = U.clamp(+q, 0, 2); } catch (e) { /* ignore */ }
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); R.lost = true; if (VP.UI && VP.UI.toast) VP.UI.toast(VP.t('ctxLost')); });
  cv.addEventListener('webglcontextrestored', () => { R.lost = false; R.resize(); });
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xf08a78, 60, 300);
  camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1400);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 2.2); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(-0.75, 0.6, -0.3); scene.add(sun);
  R.setWorld(VP.Missions.world());
  dyn = new THREE.Group(); scene.add(dyn);
  initFx(); initStage();
  R.ok = true; R.resize();
  addEventListener('resize', R.resize); addEventListener('orientationchange', () => setTimeout(R.resize, 250));
  R.three = { THREE, scene, camera, renderer }; R.SPECS = CAT_SPECS;
  return true;
};
R.pixelRatio = () => Math.min(window.devicePixelRatio || 1, mobile ? [1, 1.25, 1.5][R.quality] : [1, 1.5, 2][R.quality]);
R.resize = function () {
  if (!renderer) return;
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setPixelRatio(R.pixelRatio()); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 62 : 50; camera.updateProjectionMatrix();
  R.w = w; R.h = h;
  const sc = h * R.pixelRatio() * 0.5 / Math.tan(camera.fov * Math.PI / 360);
  if (fx.mat) fx.mat.uniforms.scale.value = sc; if (city) city.glowMat.uniforms.scale.value = sc; if (fx.glowMat) fx.glowMat.uniforms.scale.value = sc;
  if (city) { city.palms.count = R.quality === 0 ? Math.floor(city.palmCount * 0.5) : city.palmCount; }
  if (stageCam) { stageCam.aspect = w / h; stageCam.updateProjectionMatrix(); }
};
R.setQuality = function (q, auto) { q = U.clamp(q, 0, 2); if (q === R.quality) return; R.quality = q; if (!auto) VP.ls.set('vp_quality', '' + q); R.resize(); };
// auto quality: measured FPS, only steps down (or back up once things are clearly fine)
let fpsAcc = 0, fpsN = 0, lowT = 0, highT = 0;
function autoQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc < 1) return;
  R.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
  if (VP.ls.get('vp_quality')) return; // user chose
  if (R.fps < 27) { lowT++; highT = 0; if (lowT >= 3 && R.quality > 0) { R.setQuality(R.quality - 1, true); lowT = 0; R.autoLowered = true; } }
  else if (R.fps > 56) { highT++; lowT = 0; if (highT >= 8 && R.quality < (mobile ? 1 : 2) && !R.autoLowered) { R.setQuality(R.quality + 1, true); highT = 0; } }
  else { lowT = 0; highT = 0; }
}

// ---------- fx: particles, glow, rings, shadows ----------
const fx = { N: 700 };
function initFx() {
  const N = fx.N, g = new THREE.BufferGeometry();
  fx.pos = new Float32Array(N * 3); fx.col = new Float32Array(N * 4); fx.misc = new Float32Array(N * 2);
  g.setAttribute('position', new THREE.BufferAttribute(fx.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('col', new THREE.BufferAttribute(fx.col, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('misc', new THREE.BufferAttribute(fx.misc, 2).setUsage(THREE.DynamicDrawUsage));
  fx.mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { scale: { value: 300 } },
    vertexShader: 'attribute vec4 col; attribute vec2 misc; varying vec4 vC; varying float vS; uniform float scale; void main(){ vC = col; vS = misc.y; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(misc.x * scale / -mv.z, 1.0, 256.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; varying float vS;\nvoid main(){ vec2 p = gl_PointCoord*2.0-1.0; float d = length(p); float a = 0.0; vec3 c = vC.rgb;\n if (vS < 0.5) { a = smoothstep(1.0, 0.7, d); }\n else if (vS < 1.5) { float an = atan(p.y, p.x); float r = 0.42 + 0.58*pow(0.5+0.5*cos(an*5.0-1.5708), 1.6); a = step(d, r); c = mix(c, vec3(1.0), smoothstep(0.5, 0.0, d)*0.6); }\n else if (vS < 2.5) { vec2 q = vec2(p.x*1.15, -p.y*1.15+0.2); float h = pow(q.x*q.x+q.y*q.y-0.6, 3.0) - q.x*q.x*q.y*q.y*q.y; a = step(h, 0.0); }\n else if (vS < 3.5) { a = pow(max(0.0, 1.0-d), 1.2)*0.8; }\n else if (vS < 4.5) { a = step(abs(p.x), 0.1) * (1.0-abs(p.y)) * 0.6; }\n else { a = smoothstep(1.0,0.9,d) * (0.35 + 0.65*smoothstep(0.55,0.8,d)); c = mix(c, vec3(1.0), smoothstep(0.75,0.2,d)*0.5); }\n a *= vC.a; if (a < 0.02) discard; gl_FragColor = vec4(c, a); }',
  });
  fx.pts = new THREE.Points(g, fx.mat); fx.pts.frustumCulled = false; fx.pts.renderOrder = 5; scene.add(fx.pts);
  // dynamic glows
  const G2 = 64, gg = new THREE.BufferGeometry(); fx.gpos = new Float32Array(G2 * 3); fx.gcol = new Float32Array(G2 * 3); fx.gsize = new Float32Array(G2);
  gg.setAttribute('position', new THREE.BufferAttribute(fx.gpos, 3).setUsage(THREE.DynamicDrawUsage)); gg.setAttribute('color', new THREE.BufferAttribute(fx.gcol, 3).setUsage(THREE.DynamicDrawUsage)); gg.setAttribute('size', new THREE.BufferAttribute(fx.gsize, 1).setUsage(THREE.DynamicDrawUsage));
  fx.glowMat = glowMaterial(); fx.glow = new THREE.Points(gg, fx.glowMat); fx.glow.frustumCulled = false; scene.add(fx.glow); fx.GN = G2;
  // shockwave rings
  fx.rings = []; const rg = new THREE.RingGeometry(0.82, 1, 28); rg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); fx.rings.push(m); }
  // blob shadows
  const sg = new THREE.CircleGeometry(1, 14); sg.rotateX(-Math.PI / 2);
  fx.shadows = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), 48); fx.shadows.frustumCulled = false; scene.add(fx.shadows);
  // shared geometries/materials
  fx.bubbleGeo = new THREE.SphereGeometry(1, 10, 8);
  fx.bubbleMat = new THREE.MeshBasicMaterial({ color: 0x8ff3ff, transparent: true, opacity: 0.5, depthWrite: false });
  fx.perfMat = new THREE.MeshBasicMaterial({ color: 0xff9fd6, transparent: true, opacity: 0.7, depthWrite: false });
  fx.netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
  const bone = new GB(); bone.cyl('#ffffff', 0, 0, 0, 0.1, 0.9, 0.1, Math.PI / 2); for (let i = -1; i <= 1; i++) bone.box('#ffffff', 0, 0, i * 0.24, 0.5 - Math.abs(i) * 0.1, 0.08, 0.08); bone.cone('#ffffff', 0, 0, 0.6, 0.26, 0.36, 0.1, Math.PI / 2);
  fx.boneGeo = bone.geo();
  const beam = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); beam.translate(0, 0.5, 0);
  { const n = beam.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const t = 1 - beam.attributes.position.getY(i); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = t * t; } beam.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  fx.beamGeo = beam;
  fx.discGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
  fx.ringGeo = new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2);
  fx.planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
  fx.activeRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.9, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2de2e6, transparent: true, opacity: 0.9, depthWrite: false })); scene.add(fx.activeRing);
  fx.target = makeBeam('#2de2e6'); fx.target.visible = false; scene.add(fx.target);
}
function makeBeam(col) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(fx.beamGeo, new THREE.MeshBasicMaterial({ color: col, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); b.scale.set(1.3, 22, 1.3); g.add(b);
  const r = new THREE.Mesh(fx.ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, fog: false })); r.scale.setScalar(2.4); r.position.y = 0.08; g.add(r);
  g.userData = { beam: b, ring: r }; return g;
}
let pn = 0, gn = 0, sn = 0, rn = 0;
function pt(x, y, z, col, alpha, size, shape) {
  if (pn >= fx.N) return; const i = pn++; fx.pos[i * 3] = x; fx.pos[i * 3 + 1] = y; fx.pos[i * 3 + 2] = z; _c.set(col);
  fx.col[i * 4] = _c.r; fx.col[i * 4 + 1] = _c.g; fx.col[i * 4 + 2] = _c.b; fx.col[i * 4 + 3] = alpha; fx.misc[i * 2] = size; fx.misc[i * 2 + 1] = shape;
}
function glow(x, y, z, col, size) { if (gn >= fx.GN) return; const i = gn++; fx.gpos[i * 3] = x; fx.gpos[i * 3 + 1] = y; fx.gpos[i * 3 + 2] = z; _c.set(col); fx.gcol[i * 3] = _c.r; fx.gcol[i * 3 + 1] = _c.g; fx.gcol[i * 3 + 2] = _c.b; fx.gsize[i] = size; }
function shadow(x, z, y, rx, rz, rot) { if (sn >= 48) return; _e.set(0, rot || 0, 0); _q.setFromEuler(_e); _m4.compose(_p.set(x, y + 0.03, z), _q, _s.set(rx, 1, rz)); fx.shadows.setMatrixAt(sn++, _m4); }
const hAt = (px, py) => W.real ? W.hpx(px, py) : (W.gnd[Math.floor(py / 48) * W.W + Math.floor(px / 48)] === 1 ? 0 : LAND_H);
const H0 = (px, py) => W.real ? W.hpx(px, py) : 0;
R.hAt = hAt;

// ---------- entity meshes ----------
function setMat(g, mat) { if (g.userData.mat === mat) return; g.userData.mat = mat; g.traverse(o => { if (o.isMesh) { if (!o.userData.m0) o.userData.m0 = o.material; o.material = mat || o.userData.m0; } }); }
function obj(e, make) {
  let o = ents.get(e);
  if (!o) { o = make(); if (!o) return null; ents.set(e, o); dyn.add(o); }
  o.userData.f = frame; o.visible = true; return o;
}
function turn(o, target, k) { const cur = o.userData.h === undefined ? target : o.userData.h; o.userData.h = cur + U.angDiff(cur, target) * Math.min(1, k); o.rotation.y = Math.PI / 2 - o.userData.h; }
R.spec = function (name, vip) { const Wd = VP.Wardrobe; if (Wd) return Wd.spec(name, vip); return CAT_SPECS[vip ? name + '_vip' : name] || CAT_SPECS[name]; };
R.catSpec = function (name, G) { return R.spec(name, (G && G.forceVip) || (!VP.Wardrobe && VP.Shop && VP.Shop.has('vip'))); };
R.refreshCats = function () { for (const [e, o] of ents) if (e.kind === 'cat') { dyn.remove(o); ents.delete(e); } };

function syncCat(c, G, dt, near) {
  const o = obj(c, () => { const g = buildCat(R.catSpec(c.name, G)); g.userData.px = c.x; g.userData.py = c.y; return g; });
  if (G.car) { o.visible = false; return; }
  const ud = o.userData, mvx = c.x - ud.px, mvy = c.y - ud.py; ud.px = c.x; ud.py = c.y;
  const moving = mvx * mvx + mvy * mvy > 0.05;
  let h = ud.h === undefined ? c.aim : ud.h;
  if (c.atk > 0.05 || c.recoil > 0.05 || (c.idx === G.active && I.attack) || c.dashT > 0) h = c.aim; else if (moving) h = Math.atan2(mvy, mvx);
  turn(o, h, dt * 14);
  o.position.set(c.x * S, hAt(c.x, c.y), c.y * S);
  const dance = G.over && G.won ? G.real : 0;
  const st = ud.st || (ud.st = {});
  st.t = c.t; st.walk = c.walk && !c.down; st.atk = c.atk; st.down = c.down; st.sleepy = c.exhausted || (c.name === 'mimo' && G.nap > 0); st.recoil = c.recoil; st.mouth = c.mouth; st.hop = 0; st.spin = 0;
  if (dance && !c.down) { const vip = ud.spec && ud.spec.shiny, t = G.real * (vip ? 7 : 5) + c.idx * 1.2; st.hop = Math.abs(Math.sin(t)) * (vip ? 0.5 : 0.3); st.walk = 1; if (vip) st.spin = c.name === 'morticia' ? G.real * 7 : Math.sin(G.real * 3.5 + c.idx) * 0.9; }
  if (c.root > 0) st.walk = 0;
  animCat(o, st);
  setMat(o, c.flash > 0 ? MAT.white : c.invis > 0 ? MAT.ghost : null);
  if (!c.down) shadow(o.position.x, o.position.z, o.position.y, 0.5 * ud.size, 0.5 * ud.size);
  if (c.root > 0) { const n = obj(c.netKey || (c.netKey = { kind: 'net' }), () => new THREE.Mesh(fx.bubbleGeo, fx.netMat)); n.position.set(o.position.x, o.position.y + 0.7, o.position.z); n.scale.setScalar(0.95); n.rotation.y = G.real * 2; }
  const tr = ud.spec && ud.spec.trail; if (tr && c.walk && !c.down && Math.random() < dt * 14) VP.Game.fx.part({ x: c.x + U.rand(-8, 8), y: c.y + U.rand(-8, 8), k: tr.shape || 'star', col: tr.col || '#ffd23f', size: 5, life: 0.5, vy: -10 });
  void near;
}
function syncDog(e, G, dt) {
  const D = VP.Art.DOGS[e.type];
  const o = obj(e, () => { const g = buildDog(e.type, D); g.userData.px = e.x; g.userData.py = e.y; return g; });
  const ud = o.userData, mvx = e.x - ud.px, mvy = e.y - ud.py; ud.px = e.x; ud.py = e.y;
  let h = ud.h === undefined ? (e.face > 0 ? 0 : Math.PI) : ud.h;
  if (e.state === 'wind' || e.wind > 0 || (e.isBoss && e.boss.move)) h = e.isBoss && e.boss.move === 'charge' ? e.boss.a : e.aim; else if (mvx * mvx + mvy * mvy > 0.04) h = Math.atan2(mvy, mvx); else if (e.target) h = Math.atan2(e.target.y - e.y, e.target.x - e.x);
  turn(o, h, dt * 10);
  o.position.set(e.x * S, hAt(e.x, e.y), e.y * S);
  const st = ud.st || (ud.st = {}); st.t = e.t; st.walk = e.walk; st.wind = e.wind; st.stun = e.stun > 0;
  animDog(o, st);
  setMat(o, e.flash > 0 ? MAT.white : null);
  shadow(o.position.x, o.position.z, o.position.y, 0.6 * D.s, 0.6 * D.s);
  if (e.isBoss && e.exposed) glow(o.position.x, 2.4, o.position.z, '#ffd23f', 7);
}
function syncCar(c, G) {
  const K = VP.Art.CARS[c.type];
  const o = obj(c, () => buildCar(c.type, K, c.col));
  o.position.set(c.x * S, hAt(c.x, c.y), c.y * S); o.rotation.y = Math.PI / 2 - c.a;
  const driven = G.car === c;
  if (o.userData.heads) o.userData.heads.visible = driven;
  o.rotation.z = driven ? U.clamp(-(c.da || 0) * 0.02, -0.06, 0.06) : 0;
  setMat(o, c.flash > 0 ? MAT.white : null);
  shadow(o.position.x, o.position.z, o.position.y, K.wid * S * 0.62, K.len * S * 0.56, o.rotation.y);
  if (K.cop) { const b = Math.floor(c.t * 6) % 2; glow(o.position.x, o.position.y + 1.7, o.position.z, b ? '#ff2040' : '#2a6bff', 6); }
  if (c.type === 'gold') glow(o.position.x, o.position.y + 0.25, o.position.z, Math.floor(c.t * 2) % 2 ? '#ff4fb8' : '#2de2e6', 7);
  if (driven) { const fxp = Math.cos(c.a), fyp = Math.sin(c.a); glow(o.position.x + fxp * 3.2, o.position.y + 0.5, o.position.z + fyp * 3.2, '#fff6b0', 5); }
}
function syncItem(it) {
  const o = obj(it, () => { const m = new THREE.Mesh(itemGeo(it.k), MAT.lit); m.scale.setScalar(it.k === 'paw' || it.k === 'gpaw' ? 1.7 : 1.35); return m; });
  o.position.set(it.x * S, hAt(it.x, it.y) + 0.65 + Math.sin(it.t * 3) * 0.12 + (it.z || 0) * S, it.y * S); o.rotation.y = it.t * 2.2;
  if (it.k === 'paw' || it.k === 'gpaw') glow(o.position.x, o.position.y, o.position.z, '#ffd23f', 5); else if (it.k === 'coffee' || it.k === 'catnip' || it.k === 'key' || it.k === 'milk') glow(o.position.x, o.position.y, o.position.z, it.k === 'key' ? '#ffd23f' : '#ffffff', 2.4);
}
const HIDE_DONE = { fgate: 1, crate: 1, laser: 1, vlaser: 1, sdoor: 1 };
function syncProp(p, G) {
  const o = obj(p, () => {
    const m = buildProp(p, W.lots[0] ? W.lots[0].pal : W.pal); if (!m) return null;
    if (p.k === 'cage' && p.friend) { const k = buildCat(CAT_SPECS[p.friend]); k.position.y = 0.24; m.add(k); m.userData.kit = k; }
    if (p.k === 'stand') { m.userData.food = []; for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(itemGeo(p.food), MAT.lit); f.position.set(-0.6 + i * 0.6, 1.3, 0.1); f.scale.setScalar(1.1); m.add(f); m.userData.food.push(f); } }
    return m;
  });
  if (!o) return;
  o.position.set(p.x * S, hAt(p.x, p.y), p.y * S);
  if (HIDE_DONE[p.k] && p.done) { o.visible = false; return; }
  if (o.userData.geoB) { const g = p.done ? o.userData.geoB : o.userData.geoA; if (o.geometry !== g) o.geometry = g; }
  if (o.userData.kit) { o.userData.kit.visible = !p.done; if (!p.done) animCat(o.userData.kit, { t: p.t, walk: 0 }); }
  if (o.userData.food) o.userData.food.forEach((f, i) => { f.visible = i < p.left; f.rotation.y = p.t; });
  const k = p.flash > 0 ? 1.08 : 1; o.scale.set(k, k, k);
  if (p.k === 'trash') o.rotation.z = p.done ? 0.5 : 0;
  if (p.k === 'switch') glow(o.position.x, 1.5, o.position.z, p.done ? '#7CFF6B' : '#ff3355', 4 + Math.sin(p.t * 6));
  if (p.k === 'loot' && !p.done) glow(o.position.x, 1, o.position.z, '#ffd23f', 6);
  if (p.k === 'house' && p.tree) glow(o.position.x, 6.2, o.position.z, '#ffd23f', 7);
  void G;
}
function syncBullet(b) {
  const o = obj(b, () => {
    if (b.k === 'bolt') { const m = new THREE.Mesh(fx.bubbleGeo, fx.bubbleMat); m.scale.setScalar(0.34); const bn = new THREE.Mesh(fx.boneGeo, MAT.white); bn.scale.setScalar(0.75); m.add(bn); return m; }
    if (b.k === 'net') { const m = new THREE.Mesh(fx.bubbleGeo, fx.netMat); m.scale.setScalar(0.6); return m; }
    if (b.k === 'perf') { const m = new THREE.Mesh(fx.bubbleGeo, fx.perfMat); m.scale.setScalar(0.36); return m; }
    const g = new GB(); if (b.k === 'hair') g.lo('#b08a6e', 0, 0, 0, 0.36); else g.lo('#d7f25a', 0, 0, 0, 0.26);
    return g.mesh();
  });
  const yy = (b.k === 'hair' ? 0.5 + (b.z || 0) * S : 0.75) + H0(b.x, b.y);
  o.position.set(b.x * S, yy, (b.y + (b.k === 'hair' ? 0 : 12)) * S);
  if (b.k === 'bolt') { o.rotation.y = Math.PI / 2 - Math.atan2(b.vy, b.vx) - Math.PI / 2; glow(o.position.x, yy, o.position.z, '#8ff3ff', 2.2); } else o.rotation.y += 0.2;
}
function syncTele(t) {
  const o = obj(t, () => {
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0.3, depthWrite: false });
    if (t.k === 'circle') { const d = new THREE.Mesh(fx.discGeo, mat); const r = new THREE.Mesh(fx.ringGeo, new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.95, depthWrite: false })); g.add(d, r); g.userData = { d, r }; }
    else { const d = new THREE.Mesh(fx.planeGeo, mat); g.add(d); g.userData = { d }; }
    return g;
  });
  const f = Math.min(1, t.t / t.dur);
  o.position.set(t.x * S, hAt(t.x, t.y) + 0.06, t.y * S);
  if (t.k === 'circle') { const r = t.r * S; o.userData.r.scale.setScalar(r); o.userData.d.scale.setScalar(Math.max(0.01, r * f)); }
  else { o.rotation.y = -t.a; o.userData.d.scale.set(t.len * S, 1, t.w * S); o.userData.d.material.opacity = 0.15 + f * 0.4; }
}
function syncMarker(mk, G) {
  const o = obj(mk, () => { const b = makeBeam(mk.col); if (mk.thin) b.userData.beam.scale.set(0.5, 9, 0.5); return b; });
  o.position.set(mk.x * S, hAt(mk.x, mk.y), mk.y * S);
  o.userData.ring.rotation.y = G.real; o.userData.ring.scale.setScalar(2.4 + Math.sin(G.real * 3) * 0.2);
  glow(o.position.x, 1.2, o.position.z, mk.col, 9);
}

// ---------- particles from the sim ----------
const SHAPE = { dot: 0, star: 1, heart: 2, puff: 3, flash: 3, suck: 0, fly: 1, bite: 5, slash: 5, ghost: 3 };
function syncParts(G) {
  const ax = cam.x, az = cam.z;
  for (const p of G.parts) {
    const k = p.k; if (k === 'txt' || k === 'icon') continue;
    const f = p.t / p.life, x = p.x * S, z = p.y * S;
    if (Math.abs(x - ax) > 60 || Math.abs(z - az) > 60) continue;
    if (k === 'ring') { if (rn < fx.rings.length) { const m = fx.rings[rn++]; m.visible = true; m.position.set(x, hAt(p.x, p.y) + 0.08, (p.y + 14) * S); m.scale.setScalar(Math.max(0.05, (p.size + (p.grow || 60) * p.t) * S)); m.material.color.set(p.col); m.material.opacity = 1 - f; } continue; }
    let y = 0.9, size = (p.size || 4) * S * 2.4, a = 1 - f * f;
    if (k === 'puff' || k === 'ghost') { y = 0.5 + p.t * 1.1; size = (p.size || 8) * S * 3.2 * (1 + f); a = (1 - f) * 0.8; }
    else if (k === 'star' || k === 'heart') { y = 1.0 + p.t * 1.5; size *= 1.6; }
    else if (k === 'dot') { y = 0.9 + Math.sin(Math.min(1, f) * 3.14) * 0.7 * ((p.size * 7 % 3) / 2 + 0.3); }
    else if (k === 'flash') { size = p.size * S * 5; y = 0.8; }
    else if (k === 'bite' || k === 'slash') { size = p.size * S * 3.4 * (0.6 + f); y = 0.8; a = 1 - f; }
    else if (k === 'fly') { y = 1.2; size = 0.5; }
    pt(x, y + H0(p.x, p.y), z, k === 'ghost' ? '#ffffff' : p.col, a, size, SHAPE[k] === undefined ? 0 : SHAPE[k]);
  }
}
function weather(G, t, m) {
  const n = R.quality === 0 ? 70 : 150;
  if (m === 3) for (let i = 0; i < n; i++) { const hx = (i * 0.618034) % 1, hz = (i * 0.754877) % 1, sp = 16 + (i % 5) * 2; const y = 12 - ((t * sp + i * 1.37) % 12); pt(cam.x + (hx - 0.5) * 34 + y * 0.12, y + (cam.by || 0), cam.z + (hz - 0.5) * 34, '#bcd8ff', 0.55, 0.9, 4); }
  if (m === 6) for (let i = 0; i < n; i++) { const hx = (i * 0.618034) % 1, hz = (i * 0.754877) % 1; const y = 10 - ((t * (1.4 + (i % 4) * 0.3) + i * 0.77) % 10); pt(cam.x + (hx - 0.5) * 36 + Math.sin(t + i) * 0.6, y, cam.z + (hz - 0.5) * 36, '#ffffff', 0.9, 0.16 + (i % 3) * 0.05, 0); }
}

// ---------- mood (sky / fog / lights lerp between districts) ----------
const mcol = k => new THREE.Color(k);
function applyMood(idx, dt) {
  const T = MOODS[idx];
  if (!mood.cur) { mood.cur = { top: mcol(T.top), hor: mcol(T.hor), sunC: mcol(T.sunC), fog: mcol(T.fog), hs: mcol(T.hs), hg: mcol(T.hg), water: mcol(T.water), sun: T.sun, night: T.night, fogN: T.fogN, fogF: T.fogF }; dt = 1e3; }
  const c = mood.cur, k = Math.min(1, dt * 1.6);
  for (const key of ['top', 'hor', 'sunC', 'fog', 'hs', 'hg', 'water']) c[key].lerp(_c.set(T[key]), k);
  for (const key of ['sun', 'night', 'fogN', 'fogF']) c[key] += (T[key] - c[key]) * k;
  const u = city.skyMat.uniforms; u.top.value.copy(c.top); u.hor.value.copy(c.hor); u.sunC.value.copy(c.sunC); u.night.value = c.night;
  scene.fog.color.copy(c.fog); scene.fog.near = c.fogN; scene.fog.far = c.fogF * (R.quality === 0 ? 0.75 : 1);
  hemi.color.copy(c.hs); hemi.groundColor.copy(c.hg); hemi.intensity = 1.9 + (1 - c.night) * 0.9 + (R.flash || 0) * 3;
  sun.color.copy(c.sunC); sun.intensity = c.sun * 1.6;
  city.bMat.emissiveIntensity = 0.12 + c.night * 1.25; city.glowMat.uniforms.power.value = 0.15 + c.night * 0.6; fx.glowMat.uniforms.power.value = 0.5 + c.night * 0.4;
  city.waterMat.color.copy(c.water).multiplyScalar(0.9);
  mood.i = idx;
}
R.moodOf = G => { if (G.W.real) return G.W.meta.mood || 0; if (G.m && G.m.d > 4 && !G.free) return G.m.d; if (VP.S.xmas && VP.Shop && VP.Shop.has('season')) return 6; const a = G.car || G.cats[G.active]; return VP.World.distAt(W, a.x, a.y); };

// ---------- Natal Neon: seasonal decorations for the home city (trees, light strings); snow comes from the mood ----------
let xmas = null;
function setXmas(on) {
  if (!on) { if (xmas) xmas.visible = false; return; }
  if (!xmas || xmas.userData.W !== W) {
    if (xmas) scene.remove(xmas);
    xmas = new THREE.Group(); xmas.userData.W = W;
    const b = new GB(), n = new GB(), cols = ['#ff3355', '#7CFF6B', '#ffd23f', '#2de2e6', '#ff4fb8'], pts = { glowPts: [] };
    for (const l of W.lots) if (l.type === 'arena' || l.type === 'plaza' || l.type === 'park' || l.type === 'beach') {
      const x = (l.tx + 0.6) * 2, z = (l.ty + 0.6) * 2, y = LAND_H;
      b.cyl('#6a4a3b', x, y + 0.4, z, 0.25, 0.8, 0.25); for (let i = 0; i < 4; i++) b.cone('#1f8f5a', x, y + 1.4 + i * 0.95, z, 1.7 - i * 0.36, 1.6, 1.7 - i * 0.36);
      n.sph('#ffd23f', x, y + 5.3, z, 0.28); for (let i = 0; i < 12; i++) { const a = i * 2.4, yy = y + 1.0 + i * 0.32, r = 1.45 - i * 0.1; n.lo(cols[i % 5], x + Math.sin(a) * r, yy, z + Math.cos(a) * r, 0.13); }
      if (l.type === 'beach') for (let i = 0; i < 5; i++) { const sx = (l.tx + 1 + i * 1.4) * 2, sz = (l.ty + 2 + (i % 2)) * 2; b.sph('#ffffff', sx, y + 0.5, sz, 0.6); b.sph('#ffffff', sx, y + 1.3, sz, 0.42); n.cone('#ff8a3d', sx, y + 1.3, sz + 0.45, 0.07, 0.3, 0.07, Math.PI / 2); }
    }
    W.lamps.forEach((p, i) => { n.lo(cols[i % 5], p.x * S, 3.4, p.y * S, 0.16); n.lo(cols[(i + 2) % 5], p.x * S + 0.5, 3.1, p.y * S, 0.14); n.lo(cols[(i + 3) % 5], p.x * S - 0.5, 3.1, p.y * S, 0.14); });
    xmas.add(b.mesh(MAT.flat), n.mesh(MAT.glow)); xmas.children.forEach(m => { m.frustumCulled = false; }); scene.add(xmas); void pts;
  }
  xmas.visible = true;
}
// ---------- camera ----------
function updateCamera(G, dt) {
  const a = G.car || G.cats[G.active];
  const tx = a.x * S, tz = a.y * S, by = H0(a.x, a.y);
  cam.by = cam.by === undefined || !cam.init ? by : cam.by + (by - cam.by) * Math.min(1, dt * 6);
  // manual look (desktop RMB drag / HUD) + gentle auto-follow
  cam.yaw += I.look; I.look = 0;
  if (G.car) { const d = U.angDiff(cam.yaw, G.car.a + (G.car.spd < -20 ? Math.PI : 0)); cam.yaw += d * Math.min(1, dt * (0.8 + Math.min(2.2, Math.abs(G.car.spd) / 120))); }
  else if (!I.rmb) { const m = Math.hypot(I.rawx || 0, I.rawy || 0); if (m > 0.3 && !I.attack) { cam.yaw += (I.rawx || 0) * dt * 1.15 * (I.rawy > 0.5 ? 0.4 : 1); } }
  if (G.over && G.won) cam.yaw += dt * 0.5;
  const wantDist = G.over && G.won ? 6 : G.car ? 12.5 + Math.abs(G.car.spd) * 0.008 : (G.boss && !G.boss.dead ? 12 : 8.6) * (R.w < R.h ? 1.06 : 1), pitch = G.car ? 0.36 : 0.44;
  // collision-lite: pull the camera in if a building is in the way
  const fx0 = Math.cos(cam.yaw), fz0 = Math.sin(cam.yaw);
  let maxD = wantDist;
  for (let i = 2; i <= 10; i++) { const d = wantDist * i / 10, px = (tx - fx0 * d * Math.cos(pitch)) / S, py = (tz - fz0 * d * Math.cos(pitch)) / S, tX = Math.floor(px / 48), tY = Math.floor(py / 48); if (tX >= 0 && tY >= 0 && tX < W.W && tY < W.H && W.gnd[tY * W.W + tX] === 9 && 1.2 + d * Math.sin(pitch) < 5) { maxD = Math.max(3.2, d - wantDist / 10); break; } }
  cam.dist += (Math.min(wantDist, maxD) - cam.dist) * Math.min(1, dt * (maxD < cam.dist ? 12 : 3));
  const k = cam.init ? Math.min(1, dt * 9) : 1; cam.init = true;
  cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k;
  const sh = G.shake * 0.012, ex = maxD < wantDist ? (wantDist - cam.dist) * 0.5 : 0;
  const cpx = cam.x - fx0 * cam.dist * Math.cos(pitch), cpz = cam.z - fz0 * cam.dist * Math.cos(pitch); let cpy = cam.by + 1.3 + cam.dist * Math.sin(pitch) + ex; if (W.real) cpy = Math.max(cpy, W.hpx(cpx / S, cpz / S) + 1.6);
  camera.position.set(cpx + (Math.random() - 0.5) * sh, cpy + (Math.random() - 0.5) * sh, cpz);
  camera.lookAt(cam.x + fx0 * 3.2, cam.by + 1.2, cam.z + fz0 * 3.2);
  I.yaw = cam.yaw; R.yaw = cam.yaw;
  G.view = { x0: a.x - 600, x1: a.x + 600, y0: a.y - 600, y1: a.y + 600 };
  // mouse -> world point (desktop aim)
  if (I.useMouse && !I.touch) { ndc.set(I.mouse.x / R.w * 2 - 1, -(I.mouse.y / R.h) * 2 + 1); plane.constant = -0.6 - (cam.by || 0); ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, _v)) I.mw = { x: _v.x / S, y: _v.z / S }; }
}
R.snapCamera = function (yaw) { cam.init = false; if (yaw !== undefined) cam.yaw = yaw; };
R.project = function (px, py, h) {
  _v.set(px * S, (h === undefined ? 1 : h) + H0(px, py), py * S).project(camera);
  return { x: (_v.x + 1) / 2 * R.w, y: (1 - _v.y) / 2 * R.h, on: _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15, z: _v.z };
};

// ---------- frame ----------
R.attach = function (G) { if (G && G.W) R.setWorld(G.W); for (const [, o] of ents) dyn.remove(o); ents.clear(); cam.init = false; };
R.render = function (G, dt) {
  if (!R.ok || R.lost) return;
  frame++; pn = 0; gn = 0; sn = 0; rn = 0;
  autoQuality(dt);
  if (R.mode === 'stage') return renderStage(dt);
  if (!G) return;
  updateCamera(G, dt);
  const a = G.car || G.cats[G.active], near = 1900 * 1900, nearItem = 1300 * 1300;
  for (const c of G.cats) syncCat(c, G, dt);
  for (const f of G.friends) { const o = obj(f, () => { const g = buildCat(f.spec || CAT_SPECS[f.name] || CAT_SPECS.f0); g.userData.px = f.x; g.userData.py = f.y; return g; }); const ud = o.userData; if (Math.abs(f.x - ud.px) + Math.abs(f.y - ud.py) > 0.2) turn(o, Math.atan2(f.y - ud.py, f.x - ud.px), dt * 10); ud.px = f.x; ud.py = f.y; o.position.set(f.x * S, hAt(f.x, f.y), f.y * S); animCat(o, { t: f.t, walk: f.walk }); shadow(o.position.x, o.position.z, o.position.y, 0.3, 0.3); }
  for (const e of G.dogs) if (U.d2(e.x, e.y, a.x, a.y) < near) syncDog(e, G, dt);
  for (const c of G.cars) if (!c.dead && U.d2(c.x, c.y, a.x, a.y) < near * 1.6) syncCar(c, G);
  for (const it of G.items) if (U.d2(it.x, it.y, a.x, a.y) < nearItem) syncItem(it);
  for (const p of G.props) if (U.d2(p.x, p.y, a.x, a.y) < near * 1.4) syncProp(p, G);
  for (const b of G.bullets) syncBullet(b);
  for (const t of G.teles) syncTele(t);
  if (G.markers) for (const mk of G.markers) if (U.d2(mk.x, mk.y, a.x, a.y) < 5200 * 5200) syncMarker(mk, G);
  for (const [e, o] of ents) if (o.userData.f !== frame) { if (e.dead || e.life <= 0 || !o.userData.keep && (e.kind === 'net' || e.t > e.dur || !alive(G, e))) { dyn.remove(o); ents.delete(e); } else o.visible = false; }
  // active ring + objective beam
  const ac = G.cats[G.active];
  fx.activeRing.visible = !G.car && !ac.down; fx.activeRing.position.set(ac.x * S, hAt(ac.x, ac.y) + 0.05, ac.y * S); fx.activeRing.scale.setScalar(1 + Math.sin(G.real * 5) * 0.06);
  for (const c of G.cats) if (c.down && !G.car) glow(c.x * S, 0.8, c.y * S, '#ff4f7a', 5 + Math.sin(G.real * 6));
  const ob = G.free ? null : VP.Missions.objective(G), at = ob && ob.at;
  if (at && !at.kind && at.x !== undefined || at && (at.kind === 'car' || at.kind === 'prop')) { fx.target.visible = true; fx.target.position.set(at.x * S, hAt(at.x, at.y), at.y * S); fx.target.userData.ring.rotation.y = G.real; fx.target.userData.beam.scale.set(1.1, 16, 1.1); } else fx.target.visible = false;
  syncParts(G);
  const m = R.moodOf(G);
  weather(G, G.real, m);
  if (m === 3) { R.flash = Math.max(0, (R.flash || 0) - dt * 3); if (Math.random() < dt * 0.09) { R.flash = 1; VP.Audio.sfx('thunder', 3); } } else R.flash = 0;
  applyMood(m, dt); setXmas(m === 6 && !W.real);
  for (; rn < fx.rings.length; rn++) fx.rings[rn].visible = false;
  flush();
  city.waterTex.offset.x = G.real * 0.004; city.waterTex.offset.y = G.real * 0.006;
  city.sky.position.copy(camera.position);
  renderer.render(scene, camera);
  R.draws = renderer.info.render.calls; R.tris = renderer.info.render.triangles;
};
function alive(G, e) { return e.kind === 'cat' || e.kind === 'dog' || e.kind === 'car' || e.kind === 'prop' || e.kind === 'friend' || (e.k && (G.items.includes(e) || (G.markers && G.markers.includes(e)))); }
function flush() {
  fx.pts.geometry.setDrawRange(0, pn); const g = fx.pts.geometry.attributes; g.position.needsUpdate = g.col.needsUpdate = g.misc.needsUpdate = true;
  fx.glow.geometry.setDrawRange(0, gn); const gg = fx.glow.geometry.attributes; gg.position.needsUpdate = gg.color.needsUpdate = gg.size.needsUpdate = true;
  fx.shadows.count = sn; fx.shadows.instanceMatrix.needsUpdate = true;
}

// ---------- showcase stage (shop try-on, wardrobe, avatar creator, thank-you) ----------
function initStage() {
  stage = new THREE.Scene(); stage.background = new THREE.Color(0x14052a); stage.fog = new THREE.Fog(0x14052a, 14, 40);
  stageCam = new THREE.PerspectiveCamera(40, 1, 0.3, 100);
  stage.add(new THREE.HemisphereLight(0xffd0f0, 0x3a1a6a, 2.4)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 4, 5); stage.add(d);
  const b = new GB();
  b.cyl('#2a1048', 0, -0.2, 0, 3.2, 0.4, 3.2); b.cyl('#3a1a6a', 0, 0.04, 0, 2.8, 0.1, 2.8);
  const ped = b.mesh(MAT.flat); stage.add(ped);
  const n = new GB(); n.tor('#ff4fb8', 0, 0.02, 0, 3.2, 3.2, 0.5, Math.PI / 2); n.tor('#2de2e6', 0, 0.1, 0, 2.8, 2.8, 0.4, Math.PI / 2);
  for (let i = 0; i < 13; i++) { const a = (i / 12 - 0.5) * 3.0; n.box(i % 2 ? '#ff4fb8' : '#2de2e6', Math.sin(a) * 11, 4, -Math.cos(a) * 11 - 1, 0.1, 12, 0.1); }
  stage.add(n.mesh(MAT.glow));
  const grid = new GB(); for (let i = -10; i <= 10; i++) { grid.box('#7a2a9a', i * 2, -0.38, -6, 0.04, 0.02, 40); grid.box('#7a2a9a', 0, -0.38, i * 2 - 6, 40, 0.02, 0.04); } stage.add(grid.mesh(MAT.glow));
  stageGroup = new THREE.Group(); stage.add(stageGroup);
}
// items: [{spec, x, z, s}] or car: {car:'gold'}
R.showcase = function (items, opts) {
  opts = opts || {};
  while (stageGroup.children.length) stageGroup.remove(stageGroup.children[0]);
  stageItems = [];
  for (const it of items) {
    const g = it.car ? buildCar(it.car, VP.Art.CARS[it.car]) : buildCat(it.spec);
    g.position.set(it.x || 0, 0.1, it.z || 0); if (it.s) g.scale.setScalar(it.s); if (it.car && g.userData.heads) g.userData.heads.visible = true;
    stageGroup.add(g); stageItems.push({ g, it });
  }
  R.stageOpts = opts; R.mode = 'stage'; R.stageT = 0;
};
R.endShowcase = function () { R.mode = 'game'; };
function renderStage(dt) {
  R.stageT += dt; const t = R.stageT, o = R.stageOpts || {};
  if (o.spin !== false) stageGroup.rotation.y = t * 0.8;
  for (const s of stageItems) if (!s.it.car) animCat(s.g, { t, walk: o.dance ? 1 : 0, hop: o.dance ? Math.abs(Math.sin(t * 6 + s.g.position.x)) * 0.35 : 0 });
  const portrait = R.w < R.h, dist = (o.dist || 7) * (portrait ? 1.45 : 1);
  stageCam.fov = portrait ? 48 : 38; stageCam.updateProjectionMatrix();
  stageCam.position.set(0, 2.2 + (o.lift || 0), dist); stageCam.lookAt(0, (o.lookY === undefined ? 0.9 : o.lookY) - (portrait ? (o.shift === undefined ? 1.2 : o.shift) : 0), 0);
  if (o.sparkle) for (let i = 0; i < 26; i++) { const a = i * 2.4 + t * 0.5, r = 1.6 + (i % 5) * 0.35, y = ((t * 0.5 + i * 0.37) % 3.2); pn < fx.N && 0; void a; void r; void y; }
  renderer.render(stage, stageCam);
  R.draws = renderer.info.render.calls;
}
window.dispatchEvent(new Event('vp-gfx'));
