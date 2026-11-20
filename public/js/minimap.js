'use strict';
// VICE PAWS — the big map (GTA style): the whole city with icons for food, shops, the clinic, missions, friends and fun,
// a legend, zoom, and a waypoint set by tapping. The waypoint gets a GPS line on the radar and a beam in the world.
// Opened by tapping the radar, from the phone menu or with N.
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, Game = VP.Game;
const Mm = VP.Minimap = { zoom: 1, cx: 0, cy: 0 };
const tr = (...a) => VP.t(...a);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COL = () => VP.LifeHUD.CATCOL;
let cv = null, c = null, view = null, raf = 0;

// ---------- waypoint + route ----------
function snap(W, x, y) {
  if (W.clear(x, y) && !W.blocked(x, y, 12, 0)) return { x, y };
  const cx = Math.floor(x / T), cy = Math.floor(y / T);
  for (let r = 1; r < 16; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const X = cx + dx, Y = cy + dy; if (X > 1 && Y > 1 && X < W.W - 2 && Y < W.H - 2 && W.grid[Y * W.W + X] === 0 && (!W.conn || W.conn[Y * W.W + X] >= 0)) return { x: (X + 0.5) * T, y: (Y + 0.5) * T }; }
  return null;
}
Mm.setWaypoint = function (x, y) {
  const G = Game.G, L = G && G.life; if (!L) return false; const W = G.W, p = snap(W, x, y); if (!p) return false;
  L.wp = p; const fm = W.fieldMax; W.fieldMax = 0; L.wpField = W.field(p.x, p.y, 0, L.wpField); W.fieldMax = fm; L.route = null; L.routeT = 0;
  Mm.route(L); if (VP.Audio) VP.Audio.sfx('step'); Game.fx.say('📍 ' + tr('lf_wpSet'), '#ff4fb8', 1.8); return true;
};
Mm.clearWaypoint = function () { const L = Game.G && Game.G.life; if (L) { L.wp = null; L.route = null; } };
// follow the distance field downhill from the leader to the waypoint: the GPS line
Mm.route = function (L) {
  if (!L.wp || !L.wpField) { L.route = null; return; }
  const W = L.W, a = VP.Life.lead(L.G), out = [], o = { x: 0, y: 0 }; let x = a.x, y = a.y;
  for (let i = 0; i < 700; i++) { const d = W.fieldDir(L.wpField, x, y, o); if (d <= 0) break; x += o.x * 34; y += o.y * 34; if (i % 2) out.push({ x, y }); }
  out.push({ x: L.wp.x, y: L.wp.y }); L.route = out;
};
Mm.tick = function (L, dt) { if (!L.wp) return; L.routeT = (L.routeT || 0) - dt; if (L.routeT <= 0) { L.routeT = 0.7; Mm.route(L); } };

// ---------- drawing ----------
function fit() {
  const G = Game.G, W = G.W, box = cv.parentNode.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(200, box.width), h = Math.max(200, box.height);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const s0 = Math.min(w / W.mini.width, h / W.mini.height), s = s0 * Mm.zoom, a = VP.Life.lead(G);
  let cx = Mm.zoom > 1 ? U.clamp(Mm.cx, w / 2 / s, W.mini.width - w / 2 / s) : W.mini.width / 2, cy = Mm.zoom > 1 ? U.clamp(Mm.cy, h / 2 / s, W.mini.height - h / 2 / s) : W.mini.height / 2;
  if (W.mini.width * s < w) cx = W.mini.width / 2; if (W.mini.height * s < h) cy = W.mini.height / 2;
  view = { w, h, s, dpr, ox: w / 2 - cx * s, oy: h / 2 - cy * s }; void a;
}
const mx = x => view.ox + x / 24 * view.s, my = y => view.oy + y / 24 * view.s;
function draw() {
  const G = Game.G, L = G && G.life; if (!L || !cv || !cv.isConnected) return; raf = requestAnimationFrame(draw);
  const W = G.W, a = VP.Life.lead(G), t = performance.now() / 1000, C = COL();
  fit(); c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); c.fillStyle = '#17406b'; c.fillRect(0, 0, view.w, view.h);
  c.imageSmoothingEnabled = false; c.drawImage(W.mini, view.ox, view.oy, W.mini.width * view.s, W.mini.height * view.s); c.imageSmoothingEnabled = true;
  const k = Math.max(0.9, Math.min(1.5, view.s * 0.55 + 0.5));
  if (L.route && L.route.length > 1) { c.beginPath(); c.moveTo(mx(a.x), my(a.y)); for (const p of L.route) c.lineTo(mx(p.x), my(p.y)); c.lineWidth = 3.5; c.strokeStyle = '#ff4fb8'; c.lineJoin = 'round'; c.stroke(); }
  const pin = (x, y, col, icon, r) => { const X = mx(x), Y = my(y); if (X < -10 || Y < -10 || X > view.w + 10 || Y > view.h + 10) return; c.beginPath(); c.arc(X, Y, r * k, 0, 6.283); c.fillStyle = col; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#12041f'; c.stroke(); if (icon && (view.s > 1.5 || r > 7)) { c.font = r * 1.25 * k + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(icon, X, Y + 0.5); } };
  const big = view.s > 1.5 ? 9 : 5.5;
  for (const p of L.props) { const A = VP.Life.ACTS[p.k]; if (A) pin(p.x, p.y, p.k === 'celeb' ? '#ffd23f' : C.fun, A[0], p.k === 'celeb' ? big + 2 : big - 1); }
  for (const s of L.stalls) pin(s.x, s.y, s.def.id === 'petshop' ? C.shop : C.food, s.def.icon, big);
  for (const e of L.animals) if (e.kind === 'cat' && e.friend && !e.celeb) pin(e.x, e.y, C.friend, '💛', big - 1);
  for (const f of G.friends) pin(f.x, f.y, C.friend, '', 3);
  if (G.markers) for (const m of G.markers) { if (/clinic|vet/.test(m.k)) pin(m.x, m.y, C.clinic, '➕', big + 1); else if (m.k === 'shop') pin(m.x, m.y, C.shop, '🛍', big + 1); else pin(m.x, m.y, m.col || C.mission, m.k === 'race' ? '🏁' : m.k === 'npc' ? '💬' : '▶', big + 1); }
  for (const it of G.items) if (it.k === 'gpaw') pin(it.x, it.y, '#ffd23f', '', 2.5);
  if (L.wp) { const X = mx(L.wp.x), Y = my(L.wp.y), r = 9 + Math.sin(t * 6) * 2; c.beginPath(); c.arc(X, Y, r, 0, 6.283); c.fillStyle = '#ff4fb8'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke(); c.font = '15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('📍', X, Y - 14); }
  // the leader: an arrow pointing where the camera looks
  { const X = mx(a.x), Y = my(a.y), yaw = VP.R3 && VP.R3.yaw !== undefined ? VP.R3.yaw : -Math.PI / 2; c.save(); c.translate(X, Y); c.rotate(yaw + Math.PI / 2); c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 8); c.lineTo(0, 4); c.lineTo(-8, 8); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#12041f'; c.stroke(); c.restore(); c.beginPath(); c.arc(X, Y, 16 + (t * 14) % 14, 0, 6.283); c.strokeStyle = 'rgba(255,255,255,' + (1 - ((t * 14) % 14) / 14) * 0.8 + ')'; c.lineWidth = 2; c.stroke(); }
}

// ---------- panel ----------
Mm.open = function () {
  const G = Game.G, L = G && G.life, Life = VP.Life; if (!L || !L.free || Life.panel) return;
  const a = Life.lead(G); Mm.cx = a.x / 24; Mm.cy = a.y / 24; const C = COL();
  const leg = (col, key) => `<span><i style="background:${col}"></i>${esc(tr(key))}</span>`;
  Life.openPanel(`<div class="lf-head"><div class="lf-ico">🗺️</div><div><h3>${esc(tr('lf_map'))}</h3><p>${esc(tr('lf_setWp'))}</p></div><button class="lf-x" data-life="close">✕</button></div>
  <div class="lf-mapbox"><canvas id="lf-map"></canvas></div>
  <div class="lf-legend">${leg(C.food, 'lf_legFood')}${leg(C.shop, 'lf_legShop')}${leg(C.clinic, 'lf_legClinic')}${leg(C.mission, 'lf_legMission')}${leg(C.friend, 'lf_legFriend')}${leg(C.fun, 'lf_legFun')}</div>
  <div class="lf-row"><button class="lf-chip" data-life="mapZoom">🔍 ${esc(tr('lf_zoom'))}</button><button class="lf-chip" data-life="mapClear">✖ ${esc(tr('lf_wpClear'))}</button><button class="lf-chip" data-life="mActs">📋 ${esc(tr('lf_acts'))}</button></div>`, 'map');
  cv = document.getElementById('lf-map'); c = cv.getContext('2d');
  let moved = 0, last = null;
  cv.addEventListener('pointerdown', e => { last = { x: e.clientX, y: e.clientY }; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } });
  cv.addEventListener('pointermove', e => { if (!last || !view) return; const dx = e.clientX - last.x, dy = e.clientY - last.y; moved += Math.abs(dx) + Math.abs(dy); if (Mm.zoom > 1) { Mm.cx -= dx / view.s; Mm.cy -= dy / view.s; } last = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', e => { if (!last || !view) return; last = null; if (moved > 12) return; const r = cv.getBoundingClientRect(), x = (e.clientX - r.left - view.ox) / view.s * 24, y = (e.clientY - r.top - view.oy) / view.s * 24; if (Mm.setWaypoint(x, y)) setTimeout(() => { if (Life.panel === 'map') Life.closePanel(); }, 420); });
  cancelAnimationFrame(raf); draw();
};
VP.Life.act.mapZoom = () => { const G = Game.G, a = VP.Life.lead(G); Mm.zoom = Mm.zoom > 1 ? 1 : 2.6; Mm.cx = a.x / 24; Mm.cy = a.y / 24; };
VP.Life.act.mapClear = () => { Mm.clearWaypoint(); };
// keep the GPS line fresh while walking
const upd = VP.Life._.updFocus; VP.Life._.updFocus = function (L, dt, c2) { upd(L, dt, c2); Mm.tick(L, dt); };
})();
