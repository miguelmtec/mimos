'use strict';
// VICE PAWS — 2D overlay: HUD, radar, touch controls, world-anchored labels (drawn over the WebGL canvas)
(function () {
const VP = window.VP, U = VP.U, I = VP.I, Art = VP.Art;
const H = VP.HUD = { btn: {}, w: 0, h: 0, k: 1 };
let cv, c, dpr = 1;
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const PINK = '#ff4fb8', TEAL = '#2de2e6', GOLD = '#ffd23f', INK = '#12041f';
const NAMES = ['mimo', 'mimosa', 'morticia'], CATCOL = { mimo: '#8ff3ff', mimosa: '#ff7ac0', morticia: '#ffb347' };

H.EMO = [['miau', '😺', 'Z'], ['dance', '💃', 'X'], ['sit', '🪑', 'C'], ['wave', '👋', 'V']]; H.emoOpen = 0;
// emote buttons live in the calm moments: free roam and city visits, on foot, outside the tutorial
H.emoOn = G => !!G && G.free && !G.car && !G.tutorial && !G.over && !G.trial;
// phones: above the stick area; mouse and keyboard: tucked in the bottom-left corner
H.layoutEmo = function () { const k = H.k, b = H.btn, by = H.h - H.bot, t = I.touch; b.emo = { x: 30 * k, y: by - (t ? 250 : 34) * k, r: 20 * k }; H.EMO.forEach((e, i) => { b['em_' + e[0]] = t ? { x: (34 + i * 60) * k, y: by - 310 * k, r: 25 * k } : { x: (88 + i * 58) * k, y: by - 38 * k, r: 25 * k }; }); H.emoTouch = t; };
H.init = function (canvas) { cv = canvas; c = cv.getContext('2d'); H.resize(); addEventListener('resize', H.resize); };
H.resize = function () {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  H.w = w; H.h = h; H.k = U.clamp(Math.min(w, h) / 390, 1, 1.3);
  let st = 0, sb = 0; try { const cs = getComputedStyle(document.documentElement); st = parseFloat(cs.getPropertyValue('--sat')) || 0; sb = parseFloat(cs.getPropertyValue('--sab')) || 0; } catch (e) { /* ignore */ }
  H.top = st; H.bot = sb;
  const k = H.k, b = H.btn;
  for (let i = 0; i < 3; i++) b['c' + i] = { x: (38 + i * 62) * k, y: st + 40 * k, r: 27 * k };
  b.pause = { x: w - 126 * k, y: st + 24 * k, r: 17 * k };
  const by = h - sb;
  b.special = { x: w - 60 * k, y: by - 236 * k, r: 31 * k }; b.dash = { x: w - 132 * k, y: by - 206 * k, r: 26 * k }; b.ctx = { x: w - 60 * k, y: by - 318 * k, r: 31 * k };
  H.map = { x: w - 56 * k, y: st + 56 * k, r: 46 * k };
  // emotes: a small toggle on the left edge (above the stick area) that opens four big buttons
  H.layoutEmo();
  H.atkHint = { x: w - 92 * k, y: by - 112 * k }; H.stickHint = { x: 88 * k, y: by - 112 * k };
};
H.hit = function (x, y) {
  const G = VP.Game.G; if (!G) return null;
  if (VP.LifeHUD) { const lh = VP.LifeHUD.hit(x, y, G, H); if (lh) return lh; } // HOOK city-life
  if (H.emoOn(G)) { if (H.emoOpen > 0) for (const e of H.EMO) { const b = H.btn['em_' + e[0]]; if (U.d2(x, y, b.x, b.y) < (b.r + 4) * (b.r + 4)) return 'em_' + e[0]; } const b = H.btn.emo; if (U.d2(x, y, b.x, b.y) < (b.r + 8) * (b.r + 8)) return 'emo'; }
  for (const id of ['c0', 'c1', 'c2', 'pause', 'special', 'dash', 'ctx']) {
    const b = H.btn[id]; if (id === 'ctx' && !G.ctx) continue; if (id === 'dash' && G.car) continue;
    if (U.d2(x, y, b.x, b.y) < (b.r + 7) * (b.r + 7)) return id;
  }
  if (U.d2(x, y, H.map.x, H.map.y) < H.map.r * H.map.r) return 'pause';
  return null;
};

// ---------- helpers ----------
function txt(s, x, y, size, col, align, stroke, weight) {
  c.font = (weight || '900') + ' ' + size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (stroke !== false) { c.lineJoin = 'round'; c.lineWidth = Math.max(2.5, size * 0.22); c.strokeStyle = stroke || INK; c.strokeText(s, x, y); }
  c.fillStyle = col || '#fff'; c.fillText(s, x, y);
}
function pill(x, y, w, h, fill, stroke) { Art.rr(c, x, y, w, h, Math.min(h / 2, 14)); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); } }
function bar(x, y, w, h, f, col, back) { Art.rr(c, x, y, w, h, h / 2); c.fillStyle = back || 'rgba(10,4,25,.75)'; c.fill(); if (f > 0.01) { Art.rr(c, x + 1, y + 1, Math.max(h - 2, (w - 2) * U.clamp(f, 0, 1)), h - 2, (h - 2) / 2); c.fillStyle = col; c.fill(); } }
function wrap(s, maxW, size) { c.font = '800 ' + size + 'px ' + FONT; const words = s.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
function portrait(name, x, y, r) {
  const img = VP.Assets.image('portrait_' + name);
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.283); c.clip();
  if (img) { const s = img.naturalWidth; c.drawImage(img, s * 0.1, s * 0.02, s * 0.8, s * 0.8, x - r, y - r, r * 2, r * 2); }
  else { c.fillStyle = '#2a0b4a'; c.fillRect(x - r, y - r, r * 2, r * 2); Art.cat(c, x, y + r * 0.9, { name, t: 0, face: 1, scale: r / 22 }); }
  c.restore();
}
H.portrait = portrait;
function button(b, col, icon, label, cd, on) {
  c.save(); c.globalAlpha = on === false ? 0.45 : 0.92;
  c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.62)'; c.fill(); c.lineWidth = 3; c.strokeStyle = col; c.stroke();
  if (cd > 0.01) { c.beginPath(); c.moveTo(b.x, b.y); c.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + cd * 6.283); c.closePath(); c.fillStyle = 'rgba(0,0,0,.6)'; c.fill(); }
  Art.icon(c, icon, b.x, b.y - (label ? 4 : 0), b.r * 0.5, performance.now() / 1000);
  if (label) txt(label, b.x, b.y + b.r * 0.58, 9 * H.k, '#fff', 'center', INK);
  c.restore();
}

// ---------- frame ----------
H.draw = function (G, dt) {
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, H.w, H.h);
  if (!G || H.hidden) return;
  const w = H.w, h = H.h, k = H.k, R3 = VP.R3, t = G.real, a = G.cats[G.active], touch = I.touch;
  // screen tints
  if (G.nap > 0) { c.fillStyle = 'rgba(80,140,255,' + Math.min(0.2, G.nap * 0.1) + ')'; c.fillRect(0, 0, w, h); }
  if (a.flash > 0) { c.fillStyle = 'rgba(255,40,80,.16)'; c.fillRect(0, 0, w, h); }
  if (G.feast > 0) { c.strokeStyle = 'rgba(255,179,71,.5)'; c.lineWidth = 10; c.strokeRect(0, 0, w, h); }
  if (G.flashT > 0) { G.flashT -= dt; c.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, G.flashT * 3) + ')'; c.fillRect(0, 0, w, h); }
  worldLabels(G, R3, k, t);
  // ---- cat cards ----
  const vip = VP.Shop && VP.Shop.has('vip');
  G.cats.forEach((cat, i) => {
    const b = H.btn['c' + i], act = i === G.active, col = CATCOL[cat.name];
    c.save(); if (cat.down) c.filter = 'grayscale(1)'; portrait(cat.name, b.x, b.y, b.r - 3); c.restore();
    c.beginPath(); c.arc(b.x, b.y, b.r - 2, 0, 6.283); c.lineWidth = act ? 4.5 : 2.5; c.strokeStyle = cat.down ? '#ff4f5e' : act ? (vip ? GOLD : TEAL) : 'rgba(255,255,255,.75)'; c.stroke();
    if (act) { c.beginPath(); c.arc(b.x, b.y, b.r + 2.5, 0, 6.283); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke(); }
    if (cat.down) txt('✖', b.x, b.y, 26 * k, '#ff4f5e');
    const need = H.ob && H.ob.cat === cat.name && !act && !cat.down;
    if (need) { c.beginPath(); c.arc(b.x, b.y, b.r + 5 + Math.sin(t * 8) * 2.5, 0, 6.283); c.lineWidth = 3; c.strokeStyle = GOLD; c.stroke(); }
    bar(b.x - b.r, b.y + b.r + 3, b.r * 2, 7 * k, cat.hp / cat.max, cat.hp / cat.max < 0.3 ? '#ff4f5e' : '#7CFF6B');
    let f = 0, mc = col;
    if (cat.name === 'mimo') { f = cat.energy / 100; mc = cat.exhausted ? '#7f8ab0' : '#8ff3ff'; } else if (cat.name === 'mimosa') f = 1 - Math.max(0, cat.cdS) / 12; else { f = cat.feastReady ? 1 : cat.belly / 100; mc = cat.feastReady ? GOLD : '#ffb347'; }
    bar(b.x - b.r, b.y + b.r + 11 * k, b.r * 2, 5 * k, f, mc);
    if (!touch) txt('' + (i + 1), b.x - b.r + 5, b.y - b.r + 6, 11 * k, '#fff');
  });
  // lives + cash
  const ly = H.top + 92 * k;
  Art.icon(c, 'heart', 16 * k, ly, 9 * k); txt('×' + VP.S.lives, 28 * k, ly + 1, 14 * k, VP.S.lives ? '#fff' : '#ff6b6b', 'left');
  Art.icon(c, 'cash', 74 * k, ly, 8 * k); txt('' + ((G.free ? VP.S.cash : 0) + G.stat.cash - (G.free ? (G.bank || 0) : 0)), 86 * k, ly + 1, 14 * k, '#7CFF6B', 'left');
  if (G.free && VP.S.paws) { Art.icon(c, 'paw', 148 * k, ly, 8 * k); txt(Object.keys(VP.S.paws).length + '/' + ((VP.Missions.act.pawsPerDistrict || 5) * 5), 160 * k, ly + 1, 13 * k, GOLD, 'left'); }
  if (G.keys > 0) { Art.icon(c, 'key', 148 * k, ly, 8 * k); txt('×' + G.keys, 162 * k, ly + 1, 13 * k, GOLD, 'left'); }
  // ---- objective ----
  const ob = H.ob = VP.Missions.objective(G);
  const ow = Math.min(w - 20 * k, 420 * k), ox = w > 700 ? w / 2 - ow / 2 : 10 * k, oy = w > 700 ? H.top + 12 * k : H.top + (G.wanted > 0 || G.wantedFlash > 0 ? 142 : 124) * k; // on phones: below the minimap label (and the wanted stars)
  const ofs = (w > 700 ? 13.5 : 14.5) * k, lh = w > 700 ? 17 : 18.5; // a touch larger on phones: the goal is the one line everybody must read
  const lines = wrap(ob.txt, ow - 26 * k - (ob.cat ? 30 * k : 0), ofs), oh = (lines.length * lh + 12 + (ob.prog ? 9 : 0)) * k;
  if (G.objFlash > 0) G.objFlash -= dt * 1.2;
  pill(ox, oy, ow, oh, 'rgba(18,4,31,.72)', G.objFlash > 0 ? GOLD : (ob.cat ? CATCOL[ob.cat] : 'rgba(255,79,184,.8)'));
  let tx = ox + 13 * k;
  if (ob.cat) { portrait(ob.cat, ox + 20 * k, oy + oh / 2, 13 * k); c.beginPath(); c.arc(ox + 20 * k, oy + oh / 2, 13 * k, 0, 6.283); c.strokeStyle = CATCOL[ob.cat]; c.lineWidth = 2; c.stroke(); tx += 30 * k; }
  lines.forEach((l, i) => txt(l, tx, oy + (15 + i * lh) * k, ofs, '#fff', 'left', false, '800'));
  if (ob.prog) bar(tx, oy + oh - 11 * k, ow - (tx - ox) - 14 * k, 6 * k, ob.prog[0] / ob.prog[1], GOLD);
  if (G.mtimer !== null && G.mtimer !== undefined) { const low = G.mtimer < 10; txt(U.fmtTime(G.mtimer), w / 2, oy + oh + 22 * k, (low ? 30 + Math.sin(t * 10) * 3 : 24) * k, low ? '#ff4f5e' : '#fff'); }
  // ---- boss bar ----
  if (G.boss && !G.boss.dead) {
    const e = G.boss, bw = Math.min(w - 40 * k, 360 * k), bx = w / 2 - bw / 2, by = touch ? oy + oh + (G.mtimer != null ? 44 : 10) * k : h - 54 * k;
    txt(VP.t('boss_' + e.type).replace(/^(o|a|the) /i, '').toUpperCase(), w / 2, by + 6 * k, 13 * k, e.exposed ? GOLD : '#fff');
    bar(bx, by + 15 * k, bw, 11 * k, e.hp / e.max, '#ff4f5e'); if (e.maxArmor) bar(bx, by + 28 * k, bw, 6 * k, e.armor / e.maxArmor, e.exposed ? GOLD : '#c0c7d1');
  }
  // ---- radar ----
  radar(G, k, t, ob);
  if (VP.LifeHUD) VP.LifeHUD.draw(c, G, dt, H); // HOOK city-life
  // wanted stars
  if (G.wanted > 0 || G.wantedFlash > 0) for (let i = 0; i < 5; i++) Art.icon(c, i < G.wanted ? 'star' : 'starOff', H.map.x - 36 * k + i * 18 * k, H.map.y + H.map.r + 14 * k, (i < G.wanted ? 8 + (G.wantedFlash > 0 ? Math.sin(t * 20) * 1.5 : 0) : 7) * k);
  // pause
  const pb = H.btn.pause; c.beginPath(); c.arc(pb.x, pb.y, pb.r, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.6)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#fff'; c.fillRect(pb.x - 5 * k, pb.y - 6 * k, 3.5 * k, 12 * k); c.fillRect(pb.x + 1.5 * k, pb.y - 6 * k, 3.5 * k, 12 * k);
  // ---- off-screen objective arrow ----
  if (ob.at && R3 && R3.ok) {
    const p = R3.project(ob.at.x, ob.at.y, 1.2), behind = p.z > 1;
    if (!p.on || behind) {
      let dx = p.x - w / 2, dy = p.y - h / 2; if (behind) { dx = -dx; dy = Math.abs(dy) + h; }
      const an = Math.atan2(dy, dx), ex = U.clamp(w / 2 + Math.cos(an) * w, 34 * k, w - 34 * k), ey = U.clamp(h / 2 + Math.sin(an) * h, H.top + (w > 700 ? 150 : 200) * k, h - (touch ? (ex > w * 0.5 ? 372 : 300) : 190) * k); // on phones: above the ability buttons and the emote button
      c.save(); c.translate(ex, ey); c.rotate(an); Art.poly(c, [16 * k, 0, -8 * k, -11 * k, -3 * k, 0, -8 * k, 11 * k], ob.free ? PINK : GOLD, INK, 2.5); c.restore();
      const dist = Math.round(Math.hypot(ob.at.x - a.x, ob.at.y - a.y) / 24); txt(dist + 'm', ex - Math.cos(an) * 26 * k, ey - Math.sin(an) * 26 * k, 11 * k, '#fff');
    }
  }
  // ---- banner ----
  if (G.banner) { const b = G.banner, al = Math.min(1, b.t * 6, (b.dur - b.t) * 3); c.globalAlpha = Math.max(0, al); const bl = wrap(b.txt, w - 40, 20 * k); bl.forEach((l, i) => txt(l, w / 2, h * 0.3 + i * 26 * k, 20 * k, b.col)); c.globalAlpha = 1; }
  // ---- controls ----
  controls(G, k, t, touch, a);
  if (H.emoOn(G)) {
    if (H.emoTouch !== touch) H.layoutEmo();
    if (H.emoOpen > 0) H.emoOpen -= dt;
    const eb = H.btn.emo; c.save(); c.globalAlpha = 0.9; c.beginPath(); c.arc(eb.x, eb.y, eb.r, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.62)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = H.emoOpen > 0 ? GOLD : 'rgba(255,255,255,.7)'; c.stroke(); c.restore();
    c.font = 20 * k + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('😺', eb.x, eb.y + 1);
    if (H.emoOpen > 0) for (const e of H.EMO) { const b = H.btn['em_' + e[0]]; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.78)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = TEAL; c.stroke(); c.font = 22 * k + 'px ' + FONT; c.fillStyle = '#fff'; c.fillText(e[1], b.x, b.y - 3 * k); txt(VP.t('em_' + e[0]), b.x, b.y + b.r * 0.62, 9 * k, '#fff', 'center', INK); if (!touch) txt(e[2], b.x - b.r * 0.8, b.y - b.r * 0.8, 11 * k, GOLD); }
    else if (!touch) txt('Z X C V', eb.x + eb.r + 30 * k, eb.y, 10 * k, 'rgba(255,255,255,.8)');
  }
  if (G.tutorial) tutorial(G, k, t, touch, ob);
  if (G.real < 0.5) { c.fillStyle = 'rgba(18,4,31,' + (1 - G.real * 2) + ')'; c.fillRect(0, 0, w, h); }
  if (G.W.real) txt('© OpenStreetMap', 6, h - 8, 9, 'rgba(255,255,255,.75)', 'left', false, '600');
  if ((VP.debug || VP.ls.get('vp_fps') === '1') && R3) txt(R3.fps + 'fps q' + R3.quality + ' dc' + R3.draws + ' tri' + Math.round((R3.tris || 0) / 1000) + 'k', w / 2, h - 12, 11, '#fff');
};

function controls(G, k, t, touch, a) {
  const b = H.btn;
  // ability buttons
  if (G.car) button(b.special, GOLD, 'car', VP.t('honk'), 0);
  else {
    const n = a.name;
    if (n === 'mimo') button(b.special, '#8ff3ff', 'zzz', VP.t('nap'), Math.max(0, a.cdS) / 18, a.cdS <= 0);
    else if (n === 'mimosa') button(b.special, '#ff7ac0', 'roar', VP.t('roar'), Math.max(0, a.cdS) / 12, a.cdS <= 0);
    else button(b.special, a.feastReady ? GOLD : '#ffb347', 'steak', VP.t('feast'), a.feastReady ? 0 : 1 - a.belly / 100, !!a.feastReady);
    button(b.dash, '#fff', n === 'mimo' ? 'ball' : n === 'mimosa' ? 'dash' : 'smoke', VP.t(n === 'mimo' ? 'hairLbl' : n === 'mimosa' ? 'dashLbl' : 'smokeLbl'), Math.max(0, a.cd2) / (n === 'mimo' ? 5 : n === 'mimosa' ? 2.4 : 4), a.cd2 <= 0);
  }
  if (G.ctx && G.ctx.k === 'life' && VP.LifeHUD) VP.LifeHUD.ctxButton(c, b.ctx, G.ctx, H); // HOOK city-life
  else if (G.ctx) {
    const x = G.ctx.k; button(b.ctx, x === 'revive' ? '#ff7ac0' : TEAL, x === 'revive' ? 'heart' : 'car', VP.t(x === 'revive' ? 'revive' : x === 'car' ? 'enter' : 'exit'), 0);
    if (x === 'revive') { c.beginPath(); c.arc(b.ctx.x, b.ctx.y, b.ctx.r + 5, -Math.PI / 2, -Math.PI / 2 + G.revive * 6.283); c.strokeStyle = '#7CFF6B'; c.lineWidth = 5; c.stroke(); if (G.revive <= 0) txt(VP.t('hold'), b.ctx.x, b.ctx.y - b.ctx.r - 12 * k, 11 * k, '#fff'); }
    if (!touch) txt('E', b.ctx.x - b.ctx.r, b.ctx.y - b.ctx.r, 12 * k, GOLD);
  }
  if (!touch) { txt('Space', b.special.x, b.special.y - b.special.r - 8, 10 * k, '#fff'); if (!G.car) txt('Shift', b.dash.x, b.dash.y - b.dash.r - 8, 10 * k, '#fff'); return; }
  // sticks
  const st = I.stick, at = I.atk;
  const ring = (x, y, r, col, al) => { c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fillStyle = 'rgba(255,255,255,' + al * 0.25 + ')'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = col; c.globalAlpha = al; c.stroke(); c.globalAlpha = 1; };
  if (st.id >= 0) { ring(st.ox, st.oy, 52, '#fff', 0.5); const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy) || 1, m = Math.min(52, d); c.beginPath(); c.arc(st.ox + dx / d * m, st.oy + dy / d * m, 24, 0, 6.283); c.fillStyle = 'rgba(45,226,230,.75)'; c.fill(); }
  else { ring(H.stickHint.x, H.stickHint.y, 46 * k, '#fff', 0.28); c.beginPath(); c.arc(H.stickHint.x, H.stickHint.y, 20 * k, 0, 6.283); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill(); }
  const ac = G.car ? '#8ff3ff' : CATCOL[a.name];
  if (at.id >= 0) { ring(at.ox, at.oy, 52, ac, 0.6); const dx = at.x - at.ox, dy = at.y - at.oy, d = Math.hypot(dx, dy) || 1, m = Math.min(52, d); c.beginPath(); c.arc(at.ox + dx / d * m, at.oy + dy / d * m, 24, 0, 6.283); c.fillStyle = ac; c.globalAlpha = 0.8; c.fill(); c.globalAlpha = 1; }
  else { const p = H.atkHint; ring(p.x, p.y, 46 * k, ac, 0.5); Art.icon(c, G.car || a.name === 'mimo' ? 'bolt' : a.name === 'mimosa' ? 'fang' : 'hand', p.x, p.y - 5 * k, 15 * k); txt(VP.t(G.car || a.name === 'mimo' ? 'atkShoot' : a.name === 'mimosa' ? 'atkBite' : 'atkSteal'), p.x, p.y + 22 * k, 10 * k, '#fff'); }
}

// first-play hints: a pulsing ring on the control the current step asks for, plus a short caption
function tutorial(G, k, t, touch, ob) {
  const hint = ob.step && ob.step.hint; if (!hint) return;
  const pulse = (x, y, r) => { for (let i = 0; i < 2; i++) { const f = (t * 0.9 + i * 0.5) % 1; c.beginPath(); c.arc(x, y, r * (0.9 + f * 0.5), 0, 6.283); c.strokeStyle = 'rgba(255,210,63,' + (1 - f) + ')'; c.lineWidth = 4; c.stroke(); } };
  const cap = (s, x, y) => { c.font = '800 ' + 12.5 * k + 'px ' + FONT; const tw = c.measureText(s).width + 18 * k; x = U.clamp(x, tw / 2 + 6, H.w - tw / 2 - 6); pill(x - tw / 2, y - 12 * k, tw, 24 * k, 'rgba(18,4,31,.88)', GOLD); txt(s, x, y, 12.5 * k, '#fff', 'center', false, '800'); };
  const b = H.btn;
  if (hint === 'move') { if (touch) { pulse(H.stickHint.x, H.stickHint.y, 46 * k); cap(VP.t('tu_hMoveT'), H.stickHint.x, H.stickHint.y - 70 * k); } else cap(VP.t('tu_hMoveK'), H.w / 2, H.h - 70 * k); }
  else if (hint === 'attack') { if (touch) { pulse(H.atkHint.x, H.atkHint.y, 46 * k); cap(VP.t('tu_hAtkT'), H.atkHint.x, H.atkHint.y - 70 * k); } else cap(VP.t('tu_hAtkK'), H.w / 2, H.h - 70 * k); }
  else if (hint === 'switch') { for (let i = 0; i < 3; i++) if (i !== G.active) pulse(b['c' + i].x, b['c' + i].y, b.c0.r); cap(VP.t(touch ? 'tu_hSwT' : 'tu_hSwK'), b.c1.x, b.c1.y + b.c1.r + 34 * k); }
  else if (hint === 'revive') { if (G.ctx && G.ctx.k === 'revive') { pulse(b.ctx.x, b.ctx.y, b.ctx.r); cap(VP.t(touch ? 'tu_hRevT' : 'tu_hRevK'), b.ctx.x, b.ctx.y - b.ctx.r - 34 * k); } else cap(VP.t('tu_hRevGo'), H.w / 2, H.h * 0.42); }
}
function radar(G, k, t, ob) {
  const W = G.W, m = H.map, a = G.car || G.cats[G.active], yaw = (VP.R3 && VP.R3.yaw !== undefined) ? VP.R3.yaw : -Math.PI / 2, sc = 2 / 48 * 1.15 * k;
  c.save(); c.beginPath(); c.arc(m.x, m.y, m.r, 0, 6.283); c.clip();
  c.fillStyle = '#17406b'; c.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
  c.translate(m.x, m.y); c.rotate(-(yaw + Math.PI / 2)); c.scale(1.15 * k, 1.15 * k); c.translate(-a.x / 24, -a.y / 24);
  c.imageSmoothingEnabled = false; c.drawImage(W.mini, 0, 0); c.imageSmoothingEnabled = true;
  const dot = (x, y, col, r) => { c.beginPath(); c.arc(x / 24, y / 24, r, 0, 6.283); c.fillStyle = col; c.fill(); };
  for (const e of G.dogs) if (Math.abs(e.x - a.x) < 1200 && Math.abs(e.y - a.y) < 1200) dot(e.x, e.y, e.police ? '#4c9bff' : '#ff4f5e', e.isBoss ? 4 : 2.2);
  for (const car of G.cars) if (car.ai === 'cop' || car.ai === 'target') dot(car.x, car.y, car.ai === 'cop' ? '#4c9bff' : GOLD, 3);
  for (const it of G.items) if (it.k === 'paw') dot(it.x, it.y, GOLD, 2);
  for (const cat of G.cats) if (cat.idx !== G.active && !G.car) dot(cat.x, cat.y, cat.down ? '#ff4f5e' : CATCOL[cat.name], 2.4);
  c.restore();
  // objective + markers pinned to the rim
  const pin = (x, y, col, r) => { const dx = x - a.x, dy = y - a.y, an = Math.atan2(dy, dx) - (yaw + Math.PI / 2), d = Math.min(m.r - 4, Math.hypot(dx, dy) * sc); c.beginPath(); c.arc(m.x + Math.cos(an) * d, m.y + Math.sin(an) * d, r, 0, 6.283); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); };
  if (G.markers) for (const mk of G.markers) pin(mk.x, mk.y, mk.col, 3.6 * k);
  if (ob.at && !ob.free) pin(ob.at.x, ob.at.y, GOLD, (4.5 + Math.sin(t * 6)) * k);
  Art.poly(c, [m.x, m.y - 7 * k, m.x - 5 * k, m.y + 5 * k, m.x, m.y + 2 * k, m.x + 5 * k, m.y + 5 * k], '#fff', INK, 1.5);
  c.beginPath(); c.arc(m.x, m.y, m.r, 0, 6.283); c.lineWidth = 3; c.strokeStyle = G.wanted > 0 ? (Math.floor(t * 4) % 2 ? '#ff2040' : '#2a6bff') : PINK; c.stroke();
  const d = VP.World.distAt(W, a.x, a.y), rn = W.real ? W.real.name.split(' — ').pop().toUpperCase() : ''; txt(W.real ? (rn.length > 16 ? rn.slice(0, 15).trim() + '…' : rn) : VP.t('d' + ((G.m.d === 5 || G.m.d === 6) && !G.free ? G.m.d : d)).toUpperCase(), m.x, m.y + m.r + (G.wanted > 0 || G.wantedFlash > 0 ? 30 : 12) * k, 9.5 * k, '#fff');
}

// world labels (places, mission beams, shop): never under the top HUD, never on top of each other
let placed = [];
function lab(s, x, y, size, col) {
  const w = H.w, top = H.top, k = H.k; c.font = '900 ' + size + 'px ' + FONT; const tw = c.measureText(s).width / 2 + 4, th = size * 0.7;
  for (let n = 0; n < 5; n++) { let hit = false; for (const r of placed) if (Math.abs(r.x - x) < r.w + tw && Math.abs(r.y - y) < r.h + th) { hit = true; break; } if (!hit) break; y -= size * 1.25; }
  if (w > 700 ? (y < top + 70 * k || (y < top + 130 * k && x - tw < 260 * k) || (y < top + 150 * k && x + tw > w - 120 * k)) : y < top + 182 * k) return false;
  placed.push({ x, y, w: tw, h: th }); txt(s, x, y, size, col); return true;
}
function worldLabels(G, R3, k, t) {
  if (!R3 || !R3.ok) return;
  placed = [];
  const a = G.cats[G.active];
  // dogs: carried loot, hp
  for (const e of G.dogs) {
    if (e.dead || Math.abs(e.x - a.x) > 900 || Math.abs(e.y - a.y) > 900) continue;
    const s = VP.Art.DOGS[e.type].s, p = R3.project(e.x, e.y, 1.9 * s + 0.2); if (!p.on) continue;
    if (e.carry) { c.beginPath(); c.arc(p.x, p.y - 14 * k, 11 * k, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.6)'; c.fill(); c.strokeStyle = GOLD; c.lineWidth = 1.5; c.stroke(); Art.icon(c, e.carry, p.x, p.y - 14 * k, 7 * k); }
    if (!e.isBoss && e.hp < e.max) bar(p.x - 16 * k, p.y, 32 * k, 5 * k, e.hp / e.max, '#ff4f5e');
    if (!e.isBoss && e.armor > 0) bar(p.x - 16 * k, p.y + 5 * k, 32 * k, 4 * k, e.armor / e.maxArmor, '#c0c7d1');
    if (e.state === 'wind' && !e.isBoss) txt('!', p.x, p.y - (e.carry ? 34 : 14) * k, 18 * k, '#ff4f5e');
    if (e.elite && e.label) txt('💢 ' + VP.mname({ name: e.label }), p.x, p.y - 16 * k, 12 * k, '#ffd23f');
  }
  for (const cat of G.cats) if (cat.down && !G.car) { const p = R3.project(cat.x, cat.y, 1.5); if (p.on) { txt('💫 ' + VP.t(cat.name), p.x, p.y - 8 * k, 13 * k, '#ff7ac0'); const near = U.d2(a.x, a.y, cat.x, cat.y) < 62 * 62; txt(near ? VP.t('hold') + (I.touch ? '' : ' [E]') : VP.t('revive') + '!', p.x, p.y + 10 * k, 11 * k, '#fff'); } }
  for (const pr of G.props) {
    if (pr.k === 'house' && !pr.done) { const p = R3.project(pr.x, pr.y, pr.tree ? 7 : 5.6); if (p.on) { bar(p.x - 40 * k, p.y, 80 * k, 9 * k, pr.hp / pr.max, pr.hp / pr.max < 0.35 ? '#ff4f5e' : TEAL); Art.icon(c, 'heart', p.x - 50 * k, p.y + 4 * k, 8 * k); } }
    else if ((pr.k === 'fgate' || pr.k === 'crate' || pr.k === 'cage') && !pr.done && pr.hp < pr.max) { const p = R3.project(pr.x, pr.y, 2.4); if (p.on) bar(p.x - 16 * k, p.y, 32 * k, 5 * k, pr.hp / pr.max, '#ffb347'); }
  }
  if (G.house && G.house.friend && !G.house.done) { const pr = G.house, p = R3.project(pr.x, pr.y, 2.3); if (p.on) { bar(p.x - 30 * k, p.y, 60 * k, 8 * k, pr.hp / pr.max, pr.hp / pr.max < 0.35 ? '#ff4f5e' : TEAL); Art.icon(c, 'heart', p.x - 40 * k, p.y + 4 * k, 7 * k); } }
  for (const car of G.cars) if (car.ai === 'target' && !car.dead) { const p = R3.project(car.x, car.y, 2.6); if (p.on) bar(p.x - 26 * k, p.y, 52 * k, 7 * k, car.hp / car.max, GOLD); }
  if (G.car && G.car.hp < G.car.max) { const p = R3.project(G.car.x, G.car.y, 2.2); if (p.on) bar(p.x - 24 * k, p.y, 48 * k, 6 * k, G.car.hp / G.car.max, G.car.hp / G.car.max < 0.35 ? '#ff4f5e' : '#7CFF6B'); }
  if (G.ctx && G.ctx.k === 'car' && !I.touch) { const p = R3.project(G.ctx.car.x, G.ctx.car.y, 2.2); if (p.on) txt('[E] ' + VP.t('enter'), p.x, p.y, 13 * k, TEAL); }
  for (const f of G.friends) if (f.label && Math.abs(f.x - a.x) < 700 && Math.abs(f.y - a.y) < 700) { const p = R3.project(f.x, f.y, 1.7); if (p.on) txt(f.label, p.x, p.y, 11 * k, f.name === 'avatar' ? GOLD : '#fff'); }
  // mission beams
  if (G.markers) for (const mk of G.markers.slice().sort((p, q) => U.d2(p.x, p.y, a.x, a.y) - U.d2(q.x, q.y, a.x, a.y))) {
    if (U.d2(mk.x, mk.y, a.x, a.y) > 1500 * 1500) continue;
    const p = R3.project(mk.x, mk.y, 3.4); if (!p.on) continue;
    if (mk.k === 'shop') lab('🛍 ' + VP.t('shop'), p.x, p.y, 13 * k, GOLD);
    else if (mk.k === 'npc') lab('💬 ' + mk.label, p.x, p.y, 12 * k, '#7CFF6B');
    else if (mk.k === 'race') lab('🏁 ' + mk.label, p.x, p.y, 12 * k, TEAL);
    else { const m = VP.Missions.get(mk.n); if (!m) continue; if (lab(VP.mname(m), p.x, p.y + 8 * k, 12 * k, '#fff')) { const q = placed[placed.length - 1]; txt('▶ ' + (m.boss ? '👑 ' : '') + (m.side ? '★' : 'M' + (m.bonus ? '★' : m.n)), q.x, q.y - 17 * k, 15 * k, mk.col); q.y -= 9 * k; q.h += 10 * k; } }
  }
  if (G.W.landmarks) for (const l of G.W.landmarks) { const dl = Math.max(Math.abs(l.gx - a.x), Math.abs(l.gy - a.y)); if (dl > (l.beacon ? 3200 : 1000)) continue; const p = R3.project(l.gx, l.gy, 5); if (p.on) lab((VP.S.tour && VP.S.tour[G.tour] && VP.S.tour[G.tour].seen[l.name] ? '✓ ' : '📍 ') + l.name, p.x, p.y, 10.5 * k, GOLD); }
  // floating numbers + sim text particles
  for (const tx of G.texts) { const p = R3.project(tx.x, tx.y + 20, 1.7 + tx.t * 1.3); if (p.on) { c.globalAlpha = Math.min(1, (0.9 - tx.t) * 4); txt(tx.txt, p.x, p.y, tx.size * k * (tx.t < 0.1 ? 1 + (0.1 - tx.t) * 5 : 1), tx.col); c.globalAlpha = 1; } }
  for (const pt of G.parts) if (pt.k === 'txt' || pt.k === 'icon') { const p = R3.project(pt.x, pt.y + 30, 2.1 + pt.t); if (!p.on) continue; if (pt.k === 'txt') txt(pt.txt, p.x, p.y, pt.size * k, pt.col); else Art.icon(c, pt.icon, p.x, p.y, pt.size * k, t); }
}
})();
