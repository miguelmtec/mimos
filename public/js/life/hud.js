'use strict';
// VICE PAWS — city life on the 2D HUD canvas: speech bubbles, stall signs, the contextual "E: Interagir" prompt, buff icons,
// the favor tracker, minimap icons and the phone button (map, Atividades, radio, photo).
// HOOKS: hud.js calls LifeHUD.hit() from H.hit, LifeHUD.draw() from H.draw and LifeHUD.ctxButton() for the action button.
(function () {
const VP = window.VP, U = VP.U, I = VP.I, Life = VP.Life, Game = VP.Game;
const LH = VP.LifeHUD = { btn: null };
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', INK = '#12041f', GOLD = '#ffd23f', TEAL = '#2de2e6', PINK = '#ff4fb8';
const tr = (...a) => VP.t(...a);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let c = null, H = null;
function txt(s, x, y, size, col, align, weight) { c.font = (weight || '900') + ' ' + size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.lineWidth = Math.max(3, size * 0.26); c.strokeStyle = INK; c.lineJoin = 'round'; c.strokeText(s, x, y); c.fillStyle = col || '#fff'; c.fillText(s, x, y); }
function rr(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function emoji(s, x, y, size) { c.font = size + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(s, x, y); }
const free = G => !!(G && G.life && G.life.free && !G.over);
const topLimit = () => H.top + (H.w > 700 ? 70 : 178) * H.k;

// ---------- layout / hit ----------
function layout() { const k = H.k, by = H.h - H.bot; LH.btn = I.touch ? { x: H.w - 30 * k, y: H.top + 236 * k, r: 21 * k } : { x: H.w - 40 * k, y: H.top + 150 * k, r: 20 * k }; LH.touch = I.touch; }
LH.hit = function (x, y, G, hud) {
  H = hud; if (!free(G)) return null; if (!LH.btn || LH.touch !== I.touch) layout();
  const b = LH.btn; if (U.d2(x, y, b.x, b.y) < (b.r + 8) * (b.r + 8)) return 'life_menu';
  if (U.d2(x, y, H.map.x, H.map.y) < H.map.r * H.map.r) return 'life_map';
  return null;
};

// ---------- speech bubble ----------
function bubble(s, x, y, k, al) {
  const size = 11.5 * k; c.font = '800 ' + size + 'px ' + FONT; const w = Math.min(190 * k, c.measureText(s).width) + 14 * k, h = 21 * k;
  x = U.clamp(x, w / 2 + 4, H.w - w / 2 - 4); c.globalAlpha = al;
  rr(x - w / 2, y - h, w, h, 9 * k); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.moveTo(x - 5 * k, y - 1); c.lineTo(x, y + 6 * k); c.lineTo(x + 5 * k, y - 1); c.closePath(); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill();
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y - h / 2 + 0.5, 190 * k); c.globalAlpha = 1;
}
function bubbles(L, R3, a, k) {
  const lim = topLimit(); let n = 0;
  const one = (e, h) => { if (!e.bub || n > 7 || Math.abs(e.x - a.x) > 640 || Math.abs(e.y - a.y) > 640) return; const p = R3.project(e.x, e.y, h); if (!p.on || p.y < lim) return; n++; bubble(e.bub.txt, p.x, p.y, k, Math.min(1, e.bub.t * 4, (e.bub.d - e.bub.t) * 8 + 0.2)); };
  for (const p of L.peds) one(p, 3.0 * p.look.h + (p.pose === 4 ? -0.5 : 0));
  for (const e of L.animals) one(e, e.kind === 'dog' ? 1.3 : 1.5);
  for (const w of L.windows) one(w, w.h + 1.2);
}

// ---------- world labels: stall signs, prop icons, favor target, prompt ----------
function world(L, G, R3, a, k, t) {
  const lim = topLimit();
  for (const s of L.stalls) {
    const d2 = U.d2(s.x, s.y, a.x, a.y); if (d2 > 620 * 620) continue; const p = R3.project(s.x, s.y, s.def.model === 'cart' ? 3.0 : s.def.id === 'sorveteria' ? 5.6 : 4.5); if (!p.on || p.y < lim) continue;
    const near = d2 < 300 * 300; emoji(s.def.icon, p.x, p.y, (near ? 19 : 15) * k); if (near) txt(s.def.name[VP.lang() === 'pt' ? 'pt' : 'en'], p.x, p.y + 17 * k, 10.5 * k, GOLD);
  }
  for (const pr of L.props) { const A = Life.ACTS[pr.k]; if (!A || pr.soft && pr.k !== 'climb' && pr.k !== 'celeb') continue; const d2 = U.d2(pr.x, pr.y, a.x, a.y); if (d2 > 430 * 430 || d2 < 70 * 70) continue; const p = R3.project(pr.x, pr.y, pr.k === 'celeb' ? 4.4 : 2.6); if (!p.on || p.y < lim) continue; c.globalAlpha = 0.9; emoji(A[0], p.x, p.y + Math.sin(t * 3 + pr.id) * 2, 15 * k); c.globalAlpha = 1; if (pr.k === 'celeb') txt(tr('lf_lookWeek'), p.x, p.y + 16 * k, 10.5 * k, GOLD); }
  for (const e of L.animals) if (e.kind === 'cat' && (e.friend || e.celeb) && !e.gang && Math.abs(e.x - a.x) < 420 && Math.abs(e.y - a.y) < 420 && !e.bub) { const p = R3.project(e.x, e.y, e.celeb ? 2.2 : 1.5); if (p.on && p.y > lim) txt((e.celeb ? '⭐ ' : '💛 ') + e.name, p.x, p.y, 10.5 * k, e.celeb ? GOLD : '#fff'); }
  const F = L.favor;
  if (F && F.at) { const p = R3.project(F.at.x, F.at.y, 1.6); if (p.on && p.y > lim) { txt(F.kind === 'photo' ? '✖' : F.kind === 'mouse' ? '🐭' : '🎯', p.x, p.y, 20 * k, GOLD); } if (F.kind === 'photo' && F.prog > 0 && p.on) { c.beginPath(); c.arc(p.x, p.y, 18 * k, -Math.PI / 2, -Math.PI / 2 + Math.min(1, F.prog) * 6.283); c.strokeStyle = '#7CFF6B'; c.lineWidth = 4; c.stroke(); } }
  if (F && F.carry) { const p = R3.project(a.x, a.y, 2.3); if (p.on) emoji('🛍️', p.x, p.y, 17 * k); }
  // contextual prompt over the thing in focus
  const f = L.focus;
  if (f && G.ctx && G.ctx.k === 'life') { const p = R3.project(f.x, f.y, 2.2); if (p.on) { const s = (I.touch ? '' : 'E: ') + f.label, size = 12.5 * k; c.font = '900 ' + size + 'px ' + FONT; const w = c.measureText(s).width + 18 * k, y = Math.max(lim + 14 * k, p.y - 6 * k); rr(p.x - w / 2, y - 12 * k, w, 24 * k, 12 * k); c.fillStyle = 'rgba(18,4,31,.86)'; c.fill(); c.lineWidth = 2; c.strokeStyle = TEAL; c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, p.x, y + 0.5); } }
  if (L.wp) { const p = R3.project(L.wp.x, L.wp.y, 3.2); if (p.on && p.y > lim) txt('📍 ' + Math.round(Math.hypot(L.wp.x - a.x, L.wp.y - a.y) / 24) + tr('lf_m'), p.x, p.y, 12 * k, PINK); }
}

// ---------- minimap icons (drawn over the HUD radar, same transform) ----------
const CATCOL = { food: '#ff8a3d', shop: '#b967ff', fun: '#2de2e6', friend: '#ffd23f', clinic: '#ffffff', mission: '#ff4fb8' };
LH.CATCOL = CATCOL;
function radar(L, G, a, k, t) {
  const m = H.map, yaw = VP.R3 && VP.R3.yaw !== undefined ? VP.R3.yaw : -Math.PI / 2;
  c.save(); c.beginPath(); c.arc(m.x, m.y, m.r - 1.5, 0, 6.283); c.clip();
  c.translate(m.x, m.y); c.rotate(-(yaw + Math.PI / 2)); c.scale(1.15 * k, 1.15 * k); c.translate(-a.x / 24, -a.y / 24);
  if (L.route && L.route.length > 1) { c.beginPath(); c.moveTo(a.x / 24, a.y / 24); for (const p of L.route) c.lineTo(p.x / 24, p.y / 24); c.lineWidth = 2.6; c.strokeStyle = PINK; c.lineJoin = 'round'; c.stroke(); }
  const sq = (x, y, col, r) => { c.fillStyle = INK; c.fillRect(x / 24 - r - 0.8, y / 24 - r - 0.8, r * 2 + 1.6, r * 2 + 1.6); c.fillStyle = col; c.fillRect(x / 24 - r, y / 24 - r, r * 2, r * 2); };
  const dot = (x, y, col, r) => { c.beginPath(); c.arc(x / 24, y / 24, r, 0, 6.283); c.fillStyle = col; c.fill(); };
  const R = 1150;
  for (const s of L.stalls) if (Math.abs(s.x - a.x) < R && Math.abs(s.y - a.y) < R) sq(s.x, s.y, s.def.id === 'petshop' ? CATCOL.shop : CATCOL.food, s.prop ? 1.3 : 1.9);
  for (const p of L.props) if (Life.ACTS[p.k] && Math.abs(p.x - a.x) < R && Math.abs(p.y - a.y) < R) dot(p.x, p.y, p.k === 'celeb' ? GOLD : CATCOL.fun, p.k === 'celeb' ? 3.4 : 1.7);
  for (const e of L.animals) if (e.kind === 'cat' && e.friend && !e.celeb && Math.abs(e.x - a.x) < R && Math.abs(e.y - a.y) < R) dot(e.x, e.y, CATCOL.friend, 1.9);
  for (const v of L.vehicles) if (Math.abs(v.x - a.x) < R && Math.abs(v.y - a.y) < R) dot(v.x, v.y, 'rgba(255,255,255,.55)', 1.5);
  c.restore();
  if (L.wp) { const sc = 2 / 48 * 1.15 * k, dx = L.wp.x - a.x, dy = L.wp.y - a.y, an = Math.atan2(dy, dx) - (yaw + Math.PI / 2), d = Math.min(m.r - 5, Math.hypot(dx, dy) * sc), x = m.x + Math.cos(an) * d, y = m.y + Math.sin(an) * d; c.beginPath(); c.arc(x, y, (4.6 + Math.sin(t * 6)) * k, 0, 6.283); c.fillStyle = PINK; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
  // a little clock + weather under the rim
  const LL = VP.LifeLogic; txt((L.rain > 0.4 ? '🌧 ' : L.night > 0.5 ? '🌙 ' : '☀️ ') + LL.hhmm(L.clock), m.x - m.r - 4 * k, m.y + m.r - 4 * k, 9.5 * k, '#fff', 'right', '800');
}

// ---------- buffs, favor tracker, phone button ----------
function buffs(L, k, t) {
  const D = Life.D.stalls.buffs, x = 26 * k, y0 = H.h - H.bot - (I.touch ? 372 : 108) * k; let i = 0;
  const one = (icon, f, label) => { const y = y0 - i * 46 * k; i++; c.beginPath(); c.arc(x, y, 18 * k, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.72)'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke(); if (f !== null) { c.beginPath(); c.arc(x, y, 18 * k, -Math.PI / 2, -Math.PI / 2 + f * 6.283); c.strokeStyle = GOLD; c.lineWidth = 3.5; c.stroke(); } emoji(icon, x, y + 1, 17 * k); if (label) txt(label, x + 24 * k, y, 10.5 * k, '#fff', 'left', '800'); };
  for (const key in L.buffs) { const b = L.buffs[key]; one(b.icon || D[key].icon, b.t / b.dur, Math.ceil(b.t) + 's'); }
  for (const o of L.toast) { c.globalAlpha = Math.min(1, o.t * 2); one(o.icon, null, D[o.kind] ? D[o.kind].name[VP.lang() === 'pt' ? 'pt' : 'en'] : ''); c.globalAlpha = 1; }
}
function favor(L, k) {
  const F = L.favor; if (!F || !F.txt) return; const w = Math.min(H.w - 24 * k, 330 * k), x = H.w / 2 - w / 2, y = H.h * (I.touch ? 0.36 : 0.2), left = Math.max(0, F.limit - F.t);
  rr(x, y, w, 40 * k, 12 * k); c.fillStyle = 'rgba(18,4,31,.82)'; c.fill(); c.lineWidth = 2; c.strokeStyle = GOLD; c.stroke();
  c.font = '800 ' + 12.5 * k + 'px ' + FONT; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('🤝 ' + F.txt, x + 12 * k, y + 15 * k, w - 70 * k);
  c.textAlign = 'right'; c.fillStyle = left < 8 ? '#ff6b6b' : GOLD; c.fillText(Math.ceil(left) + 's', x + w - 12 * k, y + 15 * k);
  rr(x + 12 * k, y + 28 * k, w - 24 * k, 5 * k, 2.5 * k); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill(); rr(x + 12 * k, y + 28 * k, Math.max(5 * k, (w - 24 * k) * left / F.limit), 5 * k, 2.5 * k); c.fillStyle = GOLD; c.fill();
}
function phone(L, k, t) {
  if (!LH.btn || LH.touch !== I.touch) layout(); const b = LH.btn;
  c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.66)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = Life.S().radio >= 0 ? GOLD : 'rgba(255,255,255,.75)'; c.stroke();
  emoji('📱', b.x, b.y + 1, 19 * k); if (!I.touch) txt('T', b.x - b.r, b.y - b.r + 2, 11 * k, GOLD);
  void t;
}
LH.ctxButton = function (ctx2d, b, ctx, hud) {
  c = ctx2d; H = hud; const k = H.k;
  c.save(); c.globalAlpha = 0.95; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.7)'; c.fill(); c.lineWidth = 3; c.strokeStyle = TEAL; c.stroke();
  const p = (performance.now() / 600) % 1; c.beginPath(); c.arc(b.x, b.y, b.r + 3 + p * 7, 0, 6.283); c.strokeStyle = 'rgba(45,226,230,' + (1 - p) * 0.7 + ')'; c.lineWidth = 2; c.stroke();
  emoji(ctx.icon, b.x, b.y - 5 * k, b.r * 0.72); txt(ctx.label.length > 12 ? ctx.label.slice(0, 11) + '…' : ctx.label, b.x, b.y + b.r * 0.6, 8.5 * k, '#fff'); c.restore();
};

// ---------- frame ----------
LH.draw = function (ctx2d, G, dt, hud) {
  c = ctx2d; H = hud; const L = G && G.life; if (!L || G.over) return;
  const R3 = VP.R3, k = H.k, a = Life.lead(G), t = L.t;
  if (R3 && R3.ok) { if (L.free) world(L, G, R3, a, k, t); bubbles(L, R3, a, k); }
  if (!L.free) return;
  radar(L, G, a, k, t); buffs(L, k, t); favor(L, k); phone(L, k, t);
  if (L.sleep) { c.fillStyle = 'rgba(8,4,24,' + Math.min(0.85, L.sleep.t * 0.5) + ')'; c.fillRect(0, 0, H.w, H.h); txt('💤', H.w / 2, H.h * 0.42, 44 * k); }
  // buttons pressed on the canvas (see LifeHUD.hit) are handled here, once per frame
  if (I.take('life_menu')) LH.menu(); if (I.take('life_map') && VP.Minimap) VP.Minimap.open();
};

// ---------- phone menu + Atividades ----------
LH.menu = function () {
  const G = Game.G, L = G && G.life; if (!free(G) || Life.panel) return; const S = Life.S(), LL = VP.LifeLogic, st = S.radio >= 0 ? tr(Life.STATIONS[S.radio].key) : tr('lf_radioOff');
  Life.openPanel(`<div class="lf-head"><div class="lf-ico">📱</div><div><h3>${esc(tr('lf_menu'))}</h3><p>${L.rain > 0.4 ? '🌧' : L.night > 0.5 ? '🌙' : '☀️'} ${LL.hhmm(L.clock)} · 🐾 ${esc(tr('lf_mischief'))}: ${S.pts || 0} · 💛 ${Object.keys(S.friends).length}</p></div><button class="lf-x" data-life="close">✕</button></div>
  <div class="lf-grid"><button data-life="mMap"><b>🗺️</b>${esc(tr('lf_map'))}</button><button data-life="mActs"><b>📋</b>${esc(tr('lf_acts'))}</button><button data-life="mRadio"><b>📻</b>${esc(tr('lf_radio'))}<small id="lf-st">${esc(st)}</small></button><button data-life="mPhoto"><b>📸</b>${esc(tr('lf_photoMode'))}</button></div>
  ${I.touch ? '' : `<p class="lf-note">${esc(tr('lf_keys'))}</p>`}`, 'menu');
};
LH.acts = function () {
  const G = Game.G, L = G && G.life; if (!free(G)) return; const list = Life.activities(G).slice(0, 14);
  Life.openPanel(`<div class="lf-head"><div class="lf-ico">📋</div><div><h3>${esc(tr('lf_acts'))}</h3><p>${esc(tr('lf_actsNear'))}</p></div><button class="lf-x" data-life="close">✕</button></div>
  <div class="lf-items lf-scroll">${list.map((o, i) => `<button class="lf-item" data-life="goAct" data-i="${i}"><span class="lf-ii">${o.icon}</span><span class="lf-it"><b>${esc(o.title)}</b><i>${o.d} ${esc(tr('lf_m'))}</i></span><span class="lf-price" style="color:${CATCOL[o.cat] || '#fff'}">📍 ${esc(tr('lf_go'))}</span></button>`).join('')}</div>`, 'acts');
  LH._acts = list; void L;
};
const A = Life.act;
A.mMap = () => { Life.closePanel(); if (VP.Minimap) VP.Minimap.open(); };
A.mActs = () => LH.acts();
A.mRadio = () => { const i = Life.radio(), el = document.getElementById('lf-st'); if (el) el.textContent = i >= 0 ? tr(Life.STATIONS[i].key) : tr('lf_radioOff'); };
A.mPhoto = () => { Life.closePanel(); if (Life.photo) Life.photo.open(); };
A.goAct = el => { const o = LH._acts && LH._acts[+el.dataset.i]; Life.closePanel(); if (o && VP.Minimap) VP.Minimap.setWaypoint(o.x, o.y); };
addEventListener('keydown', e => {
  if (e.repeat || (e.target && e.target.tagName === 'INPUT')) return; const G = Game.G, k = e.key.toLowerCase();
  if (!free(G) || VP.UI.state !== 'play' || VP.UI.screen) return;
  if (Life.panel) { if (k === 't' || k === 'n') Life.closePanel(); return; }
  if (VP.UI.paused) return;
  if (k === 't' && !(G.online && VP.Online && VP.Online.state === 'on')) LH.menu(); else if (k === 'n' && VP.Minimap) VP.Minimap.open(); else if (k === 'o') Life.radio(); else if (k === 'u' && Life.photo) Life.photo.open();
});
})();
