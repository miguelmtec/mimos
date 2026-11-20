'use strict';
// VICE PAWS — "Clínica Patinhas": the vet clinic in Sunset Beach (the hub). Cats heal their hearts, get a check-up buff and a
// vaccine (hold still while the vet counts 3-2-1), and kids read healthy-habit tips. Data: public/data/clinic.json, including
// the sponsor ("patrocinador") slot for a real clinic later. Hooks for feat/progression's shelter cats: VP.Clinic.treat(catId).
(function () {
const VP = window.VP, U = VP.U, I = VP.I || {};
const C = VP.Clinic = { DATA: null, ready: false, onTreat: [] };
const DAY = 86400000;
// ---- pure helpers (unit-tested) ----
C.dayKey = d => { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
C.tipIndex = (day, n, skip) => (((day + (skip || 0)) % n) + n) % n;
// what the sponsor sign shows: the sponsor only when the owner switched it on and gave it a name
C.sponsorOf = function (data, lang, preview) {
  const s = (data && data.sponsor) || {}, L = lang === 'pt' ? 'pt' : 'en';
  if (s.active && s.name) return { on: true, name: String(s.name).slice(0, 28), tagline: (s.tagline && s.tagline[L]) || '', logo: s.logo || null, url: /^https:\/\//.test(s.url || '') ? s.url : null, color: s.color || '#ffd23f' };
  return { on: false, name: preview ? (s.placeholder && s.placeholder[L]) || '' : '', tagline: '', logo: null, url: null, color: s.color || '#ffd23f', preview: !!preview };
};
if (typeof document === 'undefined') return;

const Game = VP.Game, Ext = VP.Ext, UI = VP.UI, FX = Game.fx, T = VP.TILE, S3 = 1 / 24, sfx = (n, g) => VP.Audio.sfx(n, g), tr = (...a) => VP.t(...a);
const L2 = o => (o ? o[VP.lang() === 'pt' ? 'pt' : 'en'] : '') || '';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMES = ['mimo', 'mimosa', 'morticia'];
const PREVIEW = /[?&]sponsor=preview/.test(location.search);
Object.assign(VP.L, {
  cl_title: ['Clínica Patinhas', 'Little Paws Clinic'], cl_hello: ['Oi! Eu sou a {0}. Como posso cuidar de vocês hoje?', "Hi! I'm {0}. How can I take care of you today?"],
  cl_tip: ['Dica de saúde', 'Health tip'], cl_next: ['Outra dica', 'Another tip'], cl_bye: ['Tchau, doutora!', 'Bye, doc!'], cl_sponsor: ['Apoio', 'Supported by'],
  cl_healed: ['Corações curados! 💖', 'Hearts healed! 💖'], cl_fine: ['Todo mundo já está bem!', 'Everyone is already fine!'], cl_check: ['Check-up feito: saúde em dia!', 'Check-up done: healthy!'],
  cl_checkWait: ['Check-up de novo em {0} min', 'Next check-up in {0} min'], cl_vaxDone: ['já tomou hoje', 'already had it today'], cl_vaxGo: ['Vacinar {0}', 'Vaccinate {0}'],
  cl_hold: ['Fique paradinho…', 'Hold still…'], cl_oops: ['Opa! Sem se mexer. De novo!', 'Oops! No wiggling. Again!'], cl_vaxOk: ['{0} VACINADO! Nem doeu.', '{0} VACCINATED! Did not even hurt.'],
  cl_vaxAll: ['Os três vacinados hoje! +{0} moedas', 'All three vaccinated today! +{0} coins'], cl_card: ['Carteirinha de vacinação', 'Vaccination card'],
  cl_go: ['Vá até a mesa da doutora e fique parado', "Go to the vet's table and hold still"], cl_free: ['Tudo aqui é grátis. Cuidar da saúde é coisa séria!', 'Everything here is free. Health is serious business!'],
  o_clinic_go: ['Vá até a Clínica Patinhas', 'Go to the Little Paws Clinic'], o_clinic_vax: ['Vacina: fique paradinho enquanto a doutora conta', 'Vaccine: hold still while the vet counts'],
  o_clinic_check: ['Check-up: espere a doutora examinar', 'Check-up: wait while the vet examines you'],
  b_clinic_visit: ['Hora de se cuidar! Leve os gatos até a Clínica Patinhas, em Sunset Beach. Na vacina, é só ficar paradinho.', 'Time for some care! Take the cats to the Little Paws Clinic in Sunset Beach. For the vaccine, just hold still.'],
});
const St = () => { const s = VP.S; if (!s.clinic) s.clinic = { buffUntil: 0, checkAt: 0, vax: {}, treated: {}, tip: 0, visits: 0 }; return s.clinic; };
C.state = St;

// ---------- buff (read by enemies.js: speed, slow regen, no flea itch) ----------
C.buff = function () { if (!C.DATA) return null; const s = VP.S.clinic; if (!s || !(s.buffUntil > Date.now())) return null; return C.DATA.services.checkup; };
C.buffLeft = () => Math.max(0, ((VP.S.clinic && VP.S.clinic.buffUntil) || 0) - Date.now()) / 1000;

// ---------- services ----------
C.heal = function (G) {
  G = G || Game.G; if (!G) return false; let any = false;
  for (const c of G.cats) { if (c.down) { c.down = false; c.inv = 2; any = true; } if (c.hp < c.max) { c.hp = c.max; any = true; } if (c.name === 'mimo') { c.energy = 100; c.exhausted = false; } if (c.name === 'morticia') c.belly = Math.max(c.belly, 70); FX.burst(c.x, c.y - 16, 8, ['#ff7ac0', '#fff', '#7CFF6B'], 160, 'heart', 7, 0.7); }
  if (VP.Enemies && VP.Enemies.clearDebuffs) VP.Enemies.clearDebuffs(G);
  sfx('revive'); return any;
};
C.checkupWait = () => Math.max(0, ((VP.S.clinic && VP.S.clinic.checkAt) || 0) - Date.now()) / 1000;
C.checkup = function (G, force) {
  const s = St(), d = C.DATA.services.checkup; if (!force && C.checkupWait() > 0) return false;
  s.buffUntil = Date.now() + d.buffSeconds * 1000; s.checkAt = Date.now() + d.cooldown * 1000; s.visits++; VP.persist();
  C.heal(G); for (const f of Ext.clinic || []) { try { f('checkup'); } catch (e) { /* ignore */ } }
  return true;
};
C.vaccinatedToday = name => St().vax[name] === C.dayKey();
// The minigame: the leading cat stands by the vet's table and must not move while she counts 3, 2, 1.
C.startVaccine = function (G, o) {
  G = G || Game.G; if (!G || !G.W.clinic) return null;
  const c = G.cats[G.active], d = C.DATA.services.vaccine;
  G.vax = { cat: c, t: 0, need: d.count, spot: G.W.clinic.table, done: false, shown: -1, oops: 0, onDone: (o && o.onDone) || null };
  return G.vax;
};
function vaxTick(G, dt) {
  const v = G.vax; if (!v || v.done) return;
  const c = G.cats[G.active], d = C.DATA.services.vaccine, at = U.d2(c.x, c.y, v.spot.x, v.spot.y) < 30 * 30;
  if (v.oops > 0) v.oops -= dt;
  if (!at) { v.t = 0; v.shown = -1; v.cat = c; return; }
  if (c !== v.cat) { v.cat = c; v.t = 0; v.shown = -1; }
  const moving = Math.hypot(I.mx || 0, I.my || 0) > 0.25 || I.attack;
  if (moving) { if (v.t > 0.4) { v.oops = 1.4; sfx('tink', 0.3); } v.t = 0; v.shown = -1; return; }
  if (v.t === 0) v.anchor = { x: c.x, y: c.y };
  if (v.anchor && U.d2(c.x, c.y, v.anchor.x, v.anchor.y) > d.holdRadius * d.holdRadius) { v.t = 0; v.shown = -1; v.oops = 1.4; return; }
  v.t += dt; const n = Math.floor(v.t);
  if (n !== v.shown && n < v.need) { v.shown = n; sfx('tick'); FX.text(c.x, c.y - 70, '' + (v.need - n), '#ffd23f', 30); }
  if (v.t >= v.need) {
    v.done = true; const s = St(), day = C.dayKey(), first = s.vax[c.name] !== day; s.vax[c.name] = day; s.visits++;
    c.hopT = 0.5; sfx('win', 0.5); FX.burst(c.x, c.y - 20, 20, ['#ff4fb8', '#2de2e6', '#ffd23f', '#7CFF6B'], 220, 'star', 8, 0.9); FX.say('💉 ' + tr('cl_vaxOk', tr(c.name).toUpperCase()), '#7CFF6B', 2.6);
    if (first) { G.stat.cash += d.coins; FX.text(c.x, c.y - 50, '+' + d.coins, '#ffd23f', 16); if (NAMES.every(n2 => s.vax[n2] === day)) { G.stat.cash += d.allCoins; setTimeout(() => { if (Game.G === G) FX.say('🏅 ' + tr('cl_vaxAll', d.allCoins), '#ffd23f', 3); }, 1500); } }
    VP.persist(); for (const f of Ext.clinic || []) { try { f('vaccine', c.name); } catch (e) { /* ignore */ } }
    if (v.onDone) v.onDone(c);
    if (!G.vaxKeep) setTimeout(() => { if (G.vax === v) G.vax = null; }, 800);
  }
}
// ---------- hooks for other modules (feat/progression's shelter cats) ----------
// treat(catId, {vaccine?: true}) -> {ok, catId, vaccinated, day, tip}; never costs anything; fires VP.Clinic.onTreat callbacks.
C.treat = function (catId, o) {
  o = o || {}; const s = St(), day = C.dayKey(), id = String(catId);
  if (NAMES.includes(id) && Game.G) { const c = Game.G.cats.find(k => k.name === id); if (c) { c.hp = c.max; if (c.down) { c.down = false; c.inv = 2; } } }
  const rec = s.treated[id] || (s.treated[id] = { n: 0, day: 0, vax: 0 }); rec.n++; rec.day = day; if (o.vaccine) rec.vax = day;
  VP.persist(); const tips = (C.DATA && C.DATA.tips) || [], res = { ok: true, catId: id, vaccinated: !!rec.vax, day, tip: tips.length ? tips[C.tipIndex(day, tips.length, rec.n)] : null };
  for (const f of C.onTreat) { try { f(res); } catch (e) { /* ignore */ } }
  return res;
};
C.vaccinate = catId => C.treat(catId, { vaccine: true });
C.record = catId => (St().treated[String(catId)] || null);
C.isTreated = catId => !!C.record(catId);
C.sponsor = () => C.sponsorOf(C.DATA, VP.lang(), PREVIEW);
C.tip = skip => { const tips = C.DATA.tips; return tips[C.tipIndex(C.dayKey(), tips.length, (St().tip || 0) + (skip || 0))]; };
C.where = () => { const W = VP.Missions.world(); return W.clinic || null; };

// ---------- world: a small building on the park of Sunset Beach (collision is part of the map for every mission) ----------
C.install = function (W) {
  if (!W || W.real || W.clinic || !C.DATA) return;
  const D = C.DATA, lot = W.roles[D.district] && W.roles[D.district][D.lot]; if (!lot) return;
  const [fx, fy, fw, fh] = D.footprint, x0 = lot.tx + fx, y0 = lot.ty + fy, blocked = new Set();
  for (let y = y0; y < y0 + fh; y++) for (let x = x0; x < x0 + fw; x++) { const i = y * W.W + x; W.grid[i] = 1; if (W.pristine) W.pristine[i] = 1; blocked.add(i); }
  const strip = arr => { let w = 0; for (let i = 0; i < arr.length; i++) if (!blocked.has(arr[i])) arr[w++] = arr[i]; arr.length = w; };
  strip(W.walkList); if (W.walkD) for (const a of W.walkD) if (a !== W.walkList) strip(a);
  W.clinic = { x0: x0 * T, y0: y0 * T, w: fw * T, h: fh * T, door: { x: (x0 + fw / 2) * T, y: (y0 + fh + 0.75) * T }, table: { x: (x0 + fw / 2 + 1.1) * T, y: (y0 + fh + 0.95) * T }, vet: { x: (x0 + fw / 2 + 1.75) * T, y: (y0 + fh + 0.55) * T } };
  try { if (W.redrawMini) W.redrawMini(); } catch (e) { /* ignore */ }
};
Ext.init.push(G => {
  const W = G.W; if (!C.ready || !W.clinic) return;
  const k = W.clinic, f = Game.addFriend(k.vet.x, k.vet.y, 'f2'); f.spec = C.DATA.vet.spec; f.stay = true; f.label = L2(C.DATA.vet.name); f.vet = true; G.vet = f;
  if (G.free && !G.trial) { G.markers.push({ x: k.door.x, y: k.door.y, k: 'clinic', col: '#7CFF6B', thin: true, act: () => C.open() }); }
});
Ext.update.push((G, dt) => { if (G.vax) vaxTick(G, dt); if (G.vet) G.vet.face = 1; });

// ---------- 3D building + signs ----------
let gx = null;
function signTex(TH, lines, bg, fg, w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach((l, i) => { let size = l.size; c.font = '900 ' + size + 'px system-ui,Arial,sans-serif'; while (c.measureText(l.txt).width > w - 40 && size > 14) { size -= 2; c.font = '900 ' + size + 'px system-ui,Arial,sans-serif'; } c.fillText(l.txt, w / 2, h * (i + 1) / (lines.length + 1)); });
  const t = new TH.CanvasTexture(cv); if (TH.SRGBColorSpace) t.colorSpace = TH.SRGBColorSpace; return t;
}
function build(gfx, W) {
  const TH = gfx.THREE, D = C.DATA, col = D.colors, k = W.clinic, g = new TH.Group(), b = new gfx.GB(), n = new gfx.GB();
  const w = k.w * S3, d = k.h * S3, hgt = 3.1, y0 = 0.14;
  b.box(col.wall, 0, y0 + hgt / 2, 0, w - 0.3, hgt, d - 0.3); b.box(col.roof, 0, y0 + hgt + 0.18, 0, w, 0.36, d); b.box(col.trim, 0, y0 + hgt + 0.42, 0, w - 0.5, 0.14, d - 0.5);
  b.box(col.trim, 0, y0 + 0.2, d / 2 - 0.1, w - 0.2, 0.4, 0.12); b.box('#7fd6e8', 0, y0 + 1.15, d / 2 - 0.13, 1.5, 2.1, 0.1); b.box('#ffffff', 0, y0 + 1.15, d / 2 - 0.1, 0.08, 2.1, 0.12); // glass door
  for (const s of [-1, 1]) { b.box('#7fd6e8', s * (w / 2 - 1.5), y0 + 1.7, d / 2 - 0.13, 1.5, 1.1, 0.1); b.box(col.trim, s * (w / 2 - 1.5), y0 + 2.34, d / 2 - 0.02, 1.7, 0.4, 0.5, 0.5); b.box('#c98f4b', s * (w / 2 - 0.7), y0 + 0.3, d / 2 + 0.5, 0.6, 0.5, 0.6); b.sph('#3fae5a', s * (w / 2 - 0.7), y0 + 0.86, d / 2 + 0.5, 0.42); n.lo('#ff7ac0', s * (w / 2 - 0.7) + 0.2, y0 + 1.1, d / 2 + 0.66, 0.1); n.lo('#ffd23f', s * (w / 2 - 0.7) - 0.18, y0 + 0.98, d / 2 + 0.74, 0.09); }
  b.box('#e9c9a0', 0, y0 + 0.04, d / 2 + 0.9, 2.2, 0.06, 1.5); // doormat
  // the vet's table outside (where the vaccine happens) + a water bowl
  const tx = (k.table.x - (k.x0 + k.w / 2)) * S3, tz = (k.table.y - (k.y0 + k.h / 2)) * S3;
  b.cyl('#ffffff', tx, y0 + 0.5, tz - 0.9, 0.5, 0.08, 0.5); b.cyl('#8a90ad', tx, y0 + 0.25, tz - 0.9, 0.06, 0.5, 0.06); b.box('#ff4fb8', tx + 0.1, y0 + 0.62, tz - 0.9, 0.34, 0.16, 0.22); b.cyl('#4cc9f0', tx - 1.3, y0 + 0.1, tz - 0.3, 0.26, 0.14, 0.26); n.cyl('#bff4ff', tx - 1.3, y0 + 0.16, tz - 0.3, 0.2, 0.04, 0.2);
  // glowing cross + paw on the roof
  n.box(col.cross, 0, y0 + hgt + 1.25, 0, 0.36, 1.1, 0.2); n.box(col.cross, 0, y0 + hgt + 1.25, 0, 1.1, 0.36, 0.2);
  n.box(col.trim, 0, y0 + hgt - 0.06, d / 2 - 0.1, w - 0.4, 0.07, 0.07); n.box('#2de2e6', 0, y0 + 0.06, d / 2 + 0.16, w - 0.4, 0.05, 0.05);
  g.add(b.mesh(gfx.MAT.flat), n.mesh(gfx.MAT.glow));
  const name = new TH.Mesh(new TH.PlaneGeometry(4.6, 0.8), new TH.MeshBasicMaterial({ map: signTex(TH, [{ txt: '🐾 ' + L2(D.name).toUpperCase(), size: 60 }], '#12041f', '#ff4fb8', 640, 112), fog: false }));
  name.position.set(0, y0 + hgt - 0.52, d / 2 - 0.1); g.add(name);
  const sp = C.sponsor();
  if (sp.on || sp.preview) { // the "patrocinador" slot: a board next to the door, read from clinic.json
    const lines = [{ txt: tr('cl_sponsor').toUpperCase(), size: 34 }, { txt: sp.name, size: 62 }]; if (sp.tagline) lines.push({ txt: sp.tagline, size: 30 });
    const m = new TH.Mesh(new TH.PlaneGeometry(2.6, 1.5), new TH.MeshBasicMaterial({ map: signTex(TH, lines, '#12041f', sp.color, 512, 296), fog: false }));
    m.position.set(-(w / 2 + 1.5), y0 + 1.5, d / 2 + 0.3); m.rotation.y = 0.3; g.add(m);
    const post = new gfx.GB(); post.cyl('#8a90ad', -(w / 2 + 1.5), y0 + 0.4, d / 2 + 0.27, 0.07, 0.8, 0.07); g.add(post.mesh(gfx.MAT.flat));
    g.userData.sponsorSign = m;
  }
  g.position.set((k.x0 + k.w / 2) * S3, 0, (k.y0 + k.h / 2) * S3); g.userData.W = W; g.userData.lang = VP.lang();
  g.traverse(o => { o.frustumCulled = false; });
  VP.R3.three.scene.add(g); return g;
}
Ext.render.push((G, dt, gfx) => {
  const W = G.W;
  if (!W.clinic || !C.ready) { if (gx) gx.visible = false; return; }
  if (!gx || gx.userData.W !== W || gx.userData.lang !== VP.lang()) { if (gx) VP.R3.three.scene.remove(gx); gx = build(gfx, W); C.gx = gx; }
  const a = G.cats[G.active], k = W.clinic; gx.visible = U.d2(a.x, a.y, k.x0, k.y0) < 2600 * 2600;
  if (gx.visible) { gfx.glow((k.x0 + k.w / 2) * S3, 4.5, (k.y0 + k.h / 2) * S3, C.DATA.colors.cross, 7 + Math.sin(G.real * 3)); if (G.vax && !G.vax.done) gfx.glow(k.table.x * S3, 0.4, k.table.y * S3, '#ffd23f', 6 + Math.sin(G.real * 6)); }
});
Ext.hud.push((G, H) => {
  const k = G.W.clinic; if (!k || !C.ready) return; const a = G.cats[G.active];
  if (G.free && U.d2(a.x, a.y, k.door.x, k.door.y) < 1500 * 1500) { const p = H.R3.project(k.door.x, k.door.y, 3.4); if (p.on) H.lab('🏥 ' + tr('cl_title'), p.x, p.y, 13 * H.k, '#7CFF6B'); }
  const v = G.vax;
  if (v && !v.done) {
    const w = H.w, h = H.h, kk = H.k, at = U.d2(a.x, a.y, v.spot.x, v.spot.y) < 30 * 30;
    if (!at) { const p = H.R3.project(v.spot.x, v.spot.y, 1.6); if (p.on) H.txt('💉 ' + tr('cl_go'), p.x, p.y - 20 * kk, 12 * kk, '#ffd23f'); }
    else if (v.oops > 0) H.txt(tr('cl_oops'), w / 2, h * 0.3, 18 * kk, '#ff9f9f');
    else { H.txt(tr('cl_hold'), w / 2, h * 0.27, 17 * kk, '#fff'); if (v.t > 0) H.txt('' + Math.max(1, v.need - Math.floor(v.t)), w / 2, h * 0.36, (64 - (v.t % 1) * 18) * kk, '#ffd23f'); H.bar(w / 2 - 90 * kk, h * 0.43, 180 * kk, 9 * kk, v.t / v.need, '#7CFF6B'); }
  }
});

// ---------- screen ----------
C.open = function () { if (!C.ready || !Game.G) return; UI.paused = true; St().visits++; UI.show('clinic'); };
UI.SCREENS.clinic = {
  cls: 'glass center', hideHud: true,
  html: () => {
    const D = C.DATA, sv = D.services, tip = C.tip(), sp = C.sponsor(), wait = C.checkupWait(), left = C.buffLeft(), s = St(), day = C.dayKey(), G = Game.G, act = G ? G.cats[G.active].name : 'mimo';
    const row = (id, extra, dis) => `<button class="btn ${dis ? 'ghost' : 'teal'} sm" data-act="clinic" data-s="${id}" ${dis ? 'disabled' : ''} style="text-align:left;display:block;width:100%;margin:6px 0">${sv[id].icon} <b>${esc(L2(sv[id].name))}</b>${extra ? ' · ' + extra : ''}<br><span class="small">${esc(L2(sv[id].desc))}</span></button>`;
    return `<div class="wrap narrow"><h2 class="teal">🏥 ${esc(L2(D.name))}</h2>
      <div class="panel t"><p>🐱 “${esc(tr('cl_hello', L2(D.vet.name)))}”</p>
        ${row('heal')}
        ${row('checkup', left > 0 ? '✓ ' + Math.ceil(left / 60) + ' min' : wait > 0 ? esc(tr('cl_checkWait', Math.ceil(wait / 60))) : '', wait > 0)}
        ${row('vaccine', esc(tr('cl_vaxGo', tr(act))) + (s.vax[act] === day ? ' (' + esc(tr('cl_vaxDone')) + ')' : ''))}
        <p class="small">💉 ${esc(tr('cl_card'))}: ${NAMES.map(n => (s.vax[n] === day ? '✅' : '⬜') + ' ' + tr(n)).join(' &nbsp; ')}</p></div>
      <div class="panel t"><p><b>${tip.icon} ${esc(tr('cl_tip'))}</b><br>${esc(L2(tip))}</p><button class="btn ghost sm" data-act="clinicTip">💡 ${esc(tr('cl_next'))}</button></div>
      ${sp.on ? `<p class="small gold">🤝 ${esc(tr('cl_sponsor'))}: <b>${esc(sp.name)}</b>${sp.tagline ? ' · ' + esc(sp.tagline) : ''}${sp.url ? ` · <a href="${esc(sp.url)}" target="_blank" rel="noopener sponsored">site</a>` : ''}</p>` : ''}
      <p class="small">${esc(tr('cl_free'))}</p>
      <button class="btn big" data-act="resume">${esc(tr('cl_bye'))}</button></div>`;
  },
};
UI.act.clinic = el => {
  const G = Game.G, id = el.dataset.s; if (!G) return;
  if (id === 'heal') { UI.toast(C.heal(G) ? tr('cl_healed') : tr('cl_fine'), 2200); UI.show('clinic'); }
  else if (id === 'checkup') { if (C.checkup(G)) { UI.toast('🩺 ' + tr('cl_check'), 2600); UI.confetti(); } UI.show('clinic'); }
  else if (id === 'vaccine') { UI.act.resume(); C.startVaccine(G); FX.say('💉 ' + tr('cl_go'), '#ffd23f', 3); }
};
UI.act.clinicTip = () => { St().tip = (St().tip || 0) + 1; VP.persist(); UI.show('clinic'); };

// ---------- mission type: clinic_visit {service: 'vaccine' | 'checkup', fight?: [[type, n]]} ----------
function regType() {
  const M = VP.Missions, TY = M._.TYPES, E = VP.Enemies;
  TY.clinic_visit = { setup(B) {
    const p = B.p, G = B.G, k = B.W.clinic;
    B.begin(B.front('arena', 's'), { traffic: 6 }); G.noPolice = true; G.noHeat = true;
    if (p.fight && E && E.ready) { const pt = B.farPoint(300, 620); for (const [t, n] of p.fight) E.group(G, t, pt, { n, lv: B.m.lv, tag: 'c', force: true, spread: 90 }); B.step({ txt: 'o_foe_clear', args: [p.fight.map(f => E.name(f[0])).join(' + ')], act: 'attack', foeFight: true, at() { let b = null, bd = 1e12; const a = G.cats[G.active]; for (const e of G.foes) { if (e.dead || e.gone || e.tag !== 'c') continue; const d = U.d2(e.x, e.y, a.x, a.y); if (d < bd) { bd = d; b = e; } } return b ? { x: b.x, y: b.y } : null; }, done: () => E.alive(G, 'c') === 0 }); }
    if (!k) return; // (no clinic on this map: the mission is just the walk)
    B.goto(k.door, 'o_clinic_go');
    if (p.service === 'vaccine') B.step({ txt: 'o_clinic_vax', mini: true, at: () => k.table, enter() { G.vaxKeep = true; C.startVaccine(G); }, done: () => !!(G.vax && G.vax.done), prog: () => [G.vax ? Math.min(3, Math.floor(G.vax.t)) : 0, 3] });
    else B.step({ txt: 'o_clinic_check', mini: true, t: 0, at: () => k.table, tick(dt) { const a = G.cats[G.active]; if (U.d2(a.x, a.y, k.table.x, k.table.y) < 40 * 40) this.t += dt; }, done() { return this.t >= 2.5; }, prog() { return [Math.min(5, Math.floor(this.t * 2)), 5]; }, exit() { C.checkup(G, true); FX.say('🩺 ' + tr('cl_check'), '#7CFF6B', 2.6); } });
  } };
}

// ---------- boot ----------
C.load = function () {
  return Ext.json('data/clinic.json').then(d => { C.DATA = d; VP.L.cl_title = [d.name.pt, d.name.en]; return new Promise(res => Ext.whenData(res)); })
    .then(() => { regType(); C.install(VP.Missions.world()); C.ready = true; })
    .catch(e => console.warn('[clinic] not loaded', e));
};
C.whenLoaded = C.load();
})();
