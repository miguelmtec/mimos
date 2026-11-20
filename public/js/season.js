'use strict';
// VICE PAWS — seasons. Reads public/data/seasons/index.json + one file per season (start/end dates, decoration, seasonal
// missions, cosmetics, a free progress track and an optional cosmetic-only pass). First season: "Natal Neon" (December 2026).
//   dev/test:  ?season=natal  (force a season)   ?season=off  (none)   ?seasondate=2026-12-10  (pretend it is that day)
// Honest by design: no random rewards anywhere (no loot boxes), the free track pays out just for playing, the pass only adds
// cosmetics, its price lives in api/pix/_products.js and the entitlement comes from the server (Pix status), never from here.
(function () {
const VP = window.VP, U = VP.U;
const Sn = VP.Season = { defs: [], cur: null, ready: false };
// ---------- pure logic (unit-tested in tests/season.test.mjs) ----------
Sn.dateKey = d => { d = d || new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
Sn.validKey = k => /^\d{4}-\d{2}-\d{2}$/.test(k || '') && !isNaN(Date.parse(k + 'T12:00:00'));
Sn.isActive = (def, key) => !!def && Sn.validKey(def.start) && Sn.validKey(def.end) && def.start <= key && key <= def.end; // inclusive, local dates
// override: a season id forces it, 'off' forces none, anything else falls back to the dates
Sn.pick = function (defs, key, override) {
  if (override === 'off' || override === 'none') return null;
  if (override) { const f = defs.find(d => d.id === override); if (f) return f; }
  return defs.find(d => Sn.isActive(d, key)) || null;
};
Sn.params = function (search) {
  const out = { season: null, date: null }, m = /[?&]season=([a-z_]+)/.exec(search || ''), d = /[?&]seasondate=(\d{4}-\d{2}-\d{2})/.exec(search || '');
  if (m) out.season = m[1]; if (d && Sn.validKey(d[1])) out.date = d[1]; return out;
};
Sn.daysLeft = (def, key) => Math.max(0, Math.round((Date.parse(def.end + 'T12:00:00') - Date.parse(key + 'T12:00:00')) / 86400000));
// tier reached with `pts` points; a head start (Pass + Bundle) adds tiers on top
Sn.tier = (pts, track, headStart) => (track ? Math.min(track.tiers, Math.floor(Math.max(0, pts) / track.tierPoints) + (headStart || 0)) : 0);
// rewards that can be collected now. st = {pts, f: {tier: 1}, p: {tier: 1}}; has = {pass, plus}
Sn.claimable = function (def, st, has) {
  if (!def || !def.track) return [];
  const t = Sn.tier(st.pts || 0, def.track, has && has.plus ? (def.pass && def.pass.headStart) || 0 : 0), out = [];
  for (const r of def.track.free) if (r.tier <= t && !(st.f || {})[r.tier]) out.push({ k: 'f', tier: r.tier, r });
  if (has && has.pass) for (const r of def.track.premium || []) if (r.tier <= t && !(st.p || {})[r.tier]) out.push({ k: 'p', tier: r.tier, r });
  return out;
};
Sn.saveKey = def => def.id + (def.year || '');
if (typeof document === 'undefined') return;

const Game = VP.Game, Ext = VP.Ext, UI = VP.UI, FX = Game.fx, T = VP.TILE, S3 = 1 / 24, sfx = (n, g) => VP.Audio.sfx(n, g), tr = (...a) => VP.t(...a);
const L2 = o => (o ? o[VP.lang() === 'pt' ? 'pt' : 'en'] : '') || '';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Q = Sn.params(location.search);
Object.assign(VP.L, {
  se_btn: ['Temporada', 'Season'], se_until: ['até {0} · faltam {1} dias', 'until {0} · {1} days left'], se_track: ['Trilha da temporada', 'Season track'], se_tier: ['Nível', 'Tier'],
  se_pts: ['{0} ❄ · próximo nível em {1}', '{0} ❄ · next tier in {1}'], se_max: ['{0} ❄ · trilha completa!', '{0} ❄ · track complete!'], se_free: ['GRÁTIS', 'FREE'], se_prem: ['PASSE', 'PASS'],
  se_claim: ['Pegar prêmios ({0})', 'Collect rewards ({0})'], se_none: ['Jogue para ganhar flocos ❄ e subir de nível', 'Play to earn snowflakes ❄ and climb tiers'], se_got: ['Prêmios da temporada recebidos!', 'Season rewards collected!'],
  se_coins: ['{0} moedas', '{0} coins'], se_life: ['+{0} vida', '+{0} life'], se_passOn: ['Passe ativo: trilha premium aberta', 'Pass active: premium track open'], se_plusOn: ['Passe + Pacote ativo', 'Pass + Bundle active'],
  se_cos: ['Só enfeite: nenhuma vantagem no jogo. Sem sorteio. A trilha grátis continua completa para todo mundo.', 'Cosmetics only: no gameplay advantage. Nothing random. The free track stays complete for everyone.'],
  se_adult: ['Compras só com um adulto responsável.', 'Purchases only with a responsible adult.'], se_soon: ['Em breve', 'Coming soon'], se_missions: ['Missões de Natal', 'Christmas missions'], se_play: ['Jogar missões', 'Play missions'],
  se_up: ['🎄 Trilha: nível {0}! Tem prêmio esperando.', '🎄 Track: tier {0}! A reward is waiting.'], se_santa: ['Ho ho miau! Veja a trilha da temporada.', 'Ho ho meow! Check the season track.'],
  se_wear: ['Os enfeites ficam no Guarda-roupa.', 'Cosmetics go to your Wardrobe.'], se_excl: ['Roupa exclusiva', 'Exclusive outfit'],
  p_season_natal: ['Passe Natal Neon', 'Neon Christmas Pass'], p_season_natal_plus: ['Passe + Pacote Natal Neon', 'Neon Christmas Pass + Bundle'],
  o_gift_go: ['Entregue o presente {0}/{1}', 'Deliver gift {0}/{1}'], o_collect_ornament: ['Junte os enfeites espalhados pelo bairro', 'Collect the ornaments around the district'], o_collect_star: ['Acenda as estrelas do bairro', 'Light up the stars of the district'],
  o_decorate: ['Leve tudo para a árvore do Abrigo', "Bring everything to the Shelter's tree"], o_runway: ['Desfile: pare na marca {0}/{1} e faça pose', 'Runway: stop on mark {0}/{1} and strike a pose'],
  b_gift_run: ['O Papai Noel Gato precisa de ajuda! Leve os presentes de casa em casa antes do tempo acabar.', 'Santa Cat needs help! Take the gifts from door to door before time runs out.'],
  b_collect: ['Siga o feixe de luz e pegue tudo encostando. Sem briga: é só correr e juntar.', 'Follow the light beam and grab everything by touch. No fighting: just run and collect.'],
  b_runway: ['Concurso do suéter feio! Ande até cada marca e fique parado para fazer a pose. Os jurados dão nota 10.', 'Ugly sweater contest! Walk to each mark and stand still to strike a pose. The judges give a 10.'],
  se_delivered: ['Entregue!', 'Delivered!'], se_pose: ['POSE!', 'POSE!'], se_ten: ['Nota 10!', 'A perfect 10!'], se_decor: ['O Abrigo está brilhando!', 'The Shelter is shining!'],
});

// ---------- state ----------
const stOf = def => { const s = VP.S; if (!s.season) s.season = {}; const k = Sn.saveKey(def); if (!s.season[k]) s.season[k] = { pts: 0, f: {}, p: {}, items: [], done: {}, clinic: '' }; return s.season[k]; };
Sn.state = () => (Sn.cur ? stOf(Sn.cur) : null);
Sn.today = () => Q.date || Sn.dateKey();
// The pass is an entitlement that only the server hands out (Shop.apply runs on the answer of /api/pix/status).
Sn.has = function (def) { def = def || Sn.cur; const p = def && def.pass, Sh = VP.Shop; if (!p || !Sh) return { pass: false, plus: false }; const plus = !!(p.plusGrant && Sh.has(p.plusGrant)); return { pass: plus || !!(p.grant && Sh.has(p.grant)), plus }; };
// Hook kept for the paid track: there is no client-side way to unlock it.
Sn.pass = { info: () => (Sn.cur ? Sn.cur.pass : null), buy: () => ({ ok: false, reason: 'use-shop-pix-flow' }) };
Sn.tierNow = function (def) { def = def || Sn.cur; if (!def || !def.track) return 0; const h = Sn.has(def); return Sn.tier(stOf(def).pts, def.track, h.plus ? def.pass.headStart : 0); };
Sn.add = function (n, why) {
  const def = Sn.cur; if (!def || !def.track || !(n > 0)) return 0;
  const st = stOf(def), before = Sn.tierNow(def); st.pts += Math.round(n); const after = Sn.tierNow(def);
  VP.persist(); void why;
  if (after > before) { const msg = tr('se_up', after); if (Game.G && UI.state === 'play' && !UI.screen) FX.say(msg, '#7CFF6B', 3); else UI.toast(msg, 3000); sfx('star', 0.5); }
  return st.pts;
};
// wardrobe: cosmetics won on a track (and the bundle's exclusive outfit) become normal, already-owned wardrobe items
Sn.syncWardrobe = function () {
  const Wd = VP.Wardrobe; if (!Wd || !Wd.data) return; let changed = false;
  for (const def of Sn.defs) {
    if (!def.items || !def.items.length) continue; const st = (VP.S.season || {})[Sn.saveKey(def)], owned = new Set((st && st.items) || []), h = Sn.has(def);
    if (h.plus && def.pass.exclusive) owned.add(def.pass.exclusive);
    for (const it of def.items) { const has = Wd.data.items.find(x => x.id === it.id); if (owned.has(it.id) && !has) { const o = { id: it.id, slot: it.slot, name: it.name, free: true, seasonal: def.id }; if (it.acc) o.acc = it.acc; if (it.trail) o.trail = it.trail; Wd.data.items.push(o); changed = true; } }
  }
  if (changed) Wd.load(Wd.data);
};
Sn.claim = function () {
  const def = Sn.cur; if (!def) return []; const st = stOf(def), list = Sn.claimable(def, st, Sn.has(def));
  for (const c of list) {
    const r = c.r; st[c.k][c.tier] = 1;
    if (r.item && !st.items.includes(r.item)) st.items.push(r.item);
    if (c.k === 'f') { if (r.coins) VP.S.cash += r.coins; if (r.lives) VP.S.lives = Math.max(VP.S.lives, Math.min(9, VP.S.lives + r.lives)); } // the paid track never gives coins or lives
  }
  if (list.length) { VP.persist(); Sn.syncWardrobe(); }
  return list;
};
const itemOf = (def, id) => def.items.find(i => i.id === id);
const SLOT_ICON = { head: '🎩', neck: '🧣', body: '👕', back: '🎁', trail: '✨', eyes: '🕶' };
const rewardTxt = (def, r) => (r.item ? (SLOT_ICON[(itemOf(def, r.item) || {}).slot] || '🎁') + ' ' + L2((itemOf(def, r.item) || {}).name) : r.coins ? '🪙 ' + tr('se_coins', r.coins) : r.lives ? '❤️ ' + tr('se_life', r.lives) : '');

// ---------- points: only from playing ----------
function onMission(r) {
  const def = Sn.cur; if (!def || !def.track || !r || !r.win) return; const P = def.points, st = stOf(def), m = r.m;
  let n = P.mission + (r.stars || 0) * P.star;
  if (m.ext === def.district.key && !st.done[m.n]) { st.done[m.n] = 1; n += P.seasonalFirst; }
  Sn.add(n, 'mission');
}
{ const prev = VP.onProgress; VP.onProgress = r => { if (prev) prev(r); try { onMission(r); } catch (e) { console.warn(e); } }; }
Ext.foe.push((type, G) => { const def = Sn.cur; if (!def || !def.track) return; G.seasonFoe = (G.seasonFoe || 0) + 1; if (G.seasonFoe <= def.points.foeCapPerGame) Sn.add(def.points.foe, 'foe'); });
Ext.clinic.push(() => { const def = Sn.cur; if (!def || !def.track) return; const st = stOf(def), day = Sn.dateKey(); if (st.clinic !== day) { st.clinic = day; Sn.add(def.points.clinic, 'clinic'); } });

// ---------- world: Santa Cat + markers in free roam ----------
Ext.init.push(G => {
  Sn.syncWardrobe();
  const def = Sn.cur, W = G.W; if (!def || W.real) return;
  if (def.decor && def.decor.santa && def.santa && G.free && !G.trial) {
    const lot = W.roles[def.santa.district][def.santa.lot], p = W.front(lot, def.santa.side || 'e'), f = Game.addFriend(p.x + 34, p.y - 26, 'f2');
    f.spec = def.santa.spec; f.stay = true; f.label = L2(def.santa.name); G.santa = f;
    G.markers.push({ x: p.x + 34, y: p.y + 30, k: 'season', col: '#e01e37', thin: true, act: () => Sn.open() });
    const nx = VP.Missions.list.find(x => x.ext === def.district.key && !VP.S.stars[x.n]);
    if (nx) G.markers.push({ x: p.x - 60, y: p.y + 30, k: 'mission', n: nx.n, col: '#7CFF6B' });
  }
});

// ---------- decoration: light strings on the buildings, trees, pretend snow ----------
let dec = null;
function buildDecor(gfx, W, def) {
  const TH = gfx.THREE, g = new TH.Group(), cols = def.colors || ['#e01e37', '#7CFF6B', '#ffd23f'], low = VP.R3.quality === 0, step = low ? 3.2 : 1.7, D = def.decor;
  if (D.lights) {
    const per = [0, 1, 2, 3, 4].map(() => new gfx.GB()); let i = 0;
    for (const b of W.blds) {
      const B = per[b.d] || per[0], x0 = b.x * S3 - 0.06, z0 = b.y * S3 - 0.06, x1 = (b.x + b.w) * S3 + 0.06, z1 = (b.y + b.h) * S3 + 0.06, y = 2.75;
      const line = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / step)); for (let k = 0; k <= n; k++) { const f = k / n; B.box(cols[i++ % cols.length], ax + (bx - ax) * f, y - Math.sin(f * n * Math.PI) * 0.0 - (k % 2) * 0.14, az + (bz - az) * f, 0.15, 0.15, 0.15); } };
      line(x0, z1, x1, z1); line(x0, z0, x1, z0); line(x0, z0, x0, z1); line(x1, z0, x1, z1);
    }
    for (const B of per) if (B.p.length) g.add(B.mesh(gfx.MAT.glow));
  }
  if (D.trees) {
    const b = new gfx.GB(), n = new gfx.GB(); g.userData.treePts = [];
    for (const l of W.lots) if (l.type === 'plaza' || l.type === 'park') {
      const x = (l.tx + 7.4) * 2, z = (l.ty + 0.6) * 2, y = 0.14;
      b.cyl('#6a4a3b', x, y + 0.4, z, 0.25, 0.8, 0.25); for (let i = 0; i < 4; i++) b.cone('#1f8f5a', x, y + 1.4 + i * 0.95, z, 1.7 - i * 0.36, 1.6, 1.7 - i * 0.36);
      b.box('#e01e37', x + 1.2, y + 0.25, z + 0.9, 0.5, 0.5, 0.5); b.box('#2de2e6', x - 1.1, y + 0.2, z + 1.0, 0.4, 0.4, 0.4); b.box('#ffd23f', x + 0.2, y + 0.18, z + 1.4, 0.36, 0.36, 0.36);
      n.sph('#ffd23f', x, y + 5.3, z, 0.3); for (let i = 0; i < 14; i++) { const a = i * 2.4, yy = y + 1.0 + i * 0.29, r = 1.5 - i * 0.09; n.lo(cols[i % cols.length], x + Math.sin(a) * r, yy, z + Math.cos(a) * r, 0.14); }
      g.userData.treePts.push({ x, z });
    }
    const tm = b.mesh(gfx.MAT.flat), tn = n.mesh(gfx.MAT.glow); g.add(tm, tn); g.userData.trees = [tm, tn];
  }
  g.userData.W = W; g.userData.id = def.id; g.userData.low = low;
  VP.R3.three.scene.add(g); return g;
}
Ext.render.push((G, dt, gfx) => {
  const def = Sn.cur, W = G.W, on = !!(def && def.decor && !W.real && (def.decor.lights || def.decor.trees || def.decor.snow));
  if (!on) { if (dec) dec.visible = false; return; }
  if (!dec || dec.userData.W !== W || dec.userData.id !== def.id || dec.userData.low !== (VP.R3.quality === 0)) { if (dec) { VP.R3.three.scene.remove(dec); dec.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } dec = buildDecor(gfx, W, def); Sn.dec = dec; }
  dec.visible = true;
  const xmasMood = VP.R3.moodOf(G) === 6; // the older "Natal Neon" bonus district already brings trees and snow of its own
  if (dec.userData.trees) for (const m of dec.userData.trees) m.visible = !xmasMood;
  const cam = VP.R3.three.camera.position, t = G.real;
  if (dec.userData.treePts && !xmasMood) for (const p of dec.userData.treePts) if (Math.abs(p.x - cam.x) < 40 && Math.abs(p.z - cam.z) < 40) gfx.glow(p.x, 5.5, p.z, '#ffd23f', 6 + Math.sin(t * 4 + p.x));
  if (def.decor.snow && !xmasMood) { const n = VP.R3.quality === 0 ? 45 : 100, a = G.car || G.cats[G.active], cx = a.x * S3, cz = a.y * S3; for (let i = 0; i < n; i++) { const hx = (i * 0.618034) % 1, hz = (i * 0.754877) % 1, y = 10 - ((t * (1.3 + (i % 4) * 0.3) + i * 0.77) % 10); gfx.pt(cx + (hx - 0.5) * 34 + Math.sin(t + i) * 0.6, y, cz + (hz - 0.5) * 34, '#ffffff', 0.9, 0.13, 0); } }
});
Ext.hud.push((G, H) => {
  const def = Sn.cur; if (!def || !G.santa) return; const a = G.cats[G.active], f = G.santa;
  if (U.d2(a.x, a.y, f.x, f.y) < 1500 * 1500) { const p = H.R3.project(f.x, f.y + 40, 3.4); if (p.on) H.lab((def.icon || '🎉') + ' ' + L2(def.name), p.x, p.y, 13 * H.k, '#ff6b6b'); }
});

// ---------- screen ----------
Sn.open = function () { if (!Sn.cur) return; if (Game.G && UI.state === 'play') UI.paused = true; UI.show('season'); };
UI.SCREENS.season = {
  hideHud: true, cls: 'glass',
  html: () => {
    const def = Sn.cur; if (!def) return `<div class="wrap narrow"><p>${esc(tr('se_soon'))}</p><button class="btn" data-act="seasonBack">${esc(tr('back'))}</button></div>`;
    const st = stOf(def), h = Sn.has(def), tk = def.track, tier = Sn.tierNow(def), can = Sn.claimable(def, st, h), P = def.pass, price = VP.Shop && VP.Shop.PRICE ? VP.Shop.PRICE : {};
    const into = st.pts % tk.tierPoints, head = `<h2 class="gold">${def.icon} ${esc(L2(def.name))}</h2><p class="small">${esc(L2(def.theme))}<br>📅 ${esc(tr('se_until', def.end.split('-').reverse().join('/'), Sn.daysLeft(def, Sn.today())))}</p>`;
    const cell = (k, t) => { const r = (k === 'f' ? tk.free : tk.premium || []).find(x => x.tier === t); if (!r) return '<td></td>'; const got = st[k][t], open = t <= tier && (k === 'f' || h.pass); return `<td style="padding:3px 6px;opacity:${got ? 0.55 : 1}">${got ? '✅' : open ? '🎁' : '🔒'} ${esc(rewardTxt(def, r))}</td>`; };
    let rows = ''; for (let t = 1; t <= tk.tiers; t++) rows += `<tr style="${t <= tier ? 'background:rgba(124,255,107,.10)' : ''}"><td style="padding:3px 6px;text-align:center"><b>${t}</b></td>${cell('f', t)}${cell('p', t)}</tr>`;
    const missions = VP.Missions.list.filter(m => m.ext === def.district.key), mdone = missions.filter(m => VP.S.stars[m.n]).length;
    const buy = (prod, name, desc) => `<div class="mrow"><div style="flex:1"><b>${esc(name)}</b><br><span class="small">${esc(desc)}</span></div>${price[prod] ? `<button class="btn gold sm" data-act="buy" data-p="${prod}">R$ ${price[prod]}</button>` : `<span class="small">${esc(tr('se_soon'))}</span>`}</div>`;
    return `<div class="corner l"><button class="chip" data-act="seasonBack">‹ ${esc(tr('back'))}</button></div><div class="wrap narrow" style="margin-top:46px">${head}
      <div class="panel t"><b>❄ ${esc(tr('se_track'))} · ${esc(tr('se_tier'))} ${tier}/${tk.tiers}</b>
        <div style="height:10px;border-radius:6px;background:rgba(10,4,25,.7);margin:6px 0;overflow:hidden"><div style="height:100%;width:${tier >= tk.tiers ? 100 : Math.round(into / tk.tierPoints * 100)}%;background:#7CFF6B"></div></div>
        <p class="small">${esc(tier >= tk.tiers ? tr('se_max', st.pts) : tr('se_pts', st.pts, tk.tierPoints - into))}<br>${esc(L2(def.points.note))}</p>
        <button class="btn ${can.length ? 'big' : 'ghost'}" data-act="seasonClaim" ${can.length ? '' : 'disabled'}>🎁 ${esc(can.length ? tr('se_claim', can.length) : tr('se_none'))}</button></div>
      ${missions.length ? `<div class="mrow">🎄 <div style="flex:1"><b>${esc(tr('se_missions'))}</b> ${mdone}/${missions.length}</div><button class="btn teal sm" data-act="seasonMap">▶ ${esc(tr('se_play'))}</button></div>` : ''}
      <div class="panel t" style="max-height:38vh;overflow:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left"><tr><th>${esc(tr('se_tier'))}</th><th>${esc(tr('se_free'))}</th><th>👑 ${esc(tr('se_prem'))}${h.pass ? '' : ' 🔒'}</th></tr>${rows}</table></div>
      ${P && P.awaitingOwnerApproval ? `<p class="small">👑 ${esc(L2(P.name))}: ${esc(tr('se_soon'))}. ${esc(tr('se_cos'))}</p>` : P ? `<div class="panel t">${h.plus ? `<p class="gold">👑 ${esc(tr('se_plusOn'))}</p>` : h.pass ? `<p class="gold">👑 ${esc(tr('se_passOn'))}</p>` : ''}
        ${h.pass ? '' : buy(P.product, L2(P.name), L2(P.desc))}${h.plus ? '' : buy(P.plusProduct, L2(P.plusName), L2(P.plusDesc) + ' (' + tr('se_excl') + ': ' + L2((itemOf(def, P.exclusive) || {}).name) + ')')}
        <p class="small">${esc(tr('se_cos'))}<br>${esc(tr('se_adult'))} ${esc(tr('se_wear'))}</p></div>` : ''}
      <button class="btn ghost" data-act="seasonBack">${esc(tr('back'))}</button></div>`;
  },
  after: () => Sn.syncWardrobe(),
};
UI.act.seasonClaim = () => { const got = Sn.claim(); if (got.length) { UI.toast('🎁 ' + tr('se_got'), 2600); UI.confetti(); sfx('win', 0.5); if (VP.R3 && VP.R3.refreshCats) VP.R3.refreshCats(); } UI.show('season'); };
UI.act.seasonBack = () => { if (Game.G && UI.state === 'play' && !Game.G.over) { UI.hide(); UI.paused = false; } else UI.show('title'); };
UI.act.seasonMap = () => { const D = VP.Missions.DIST.find(d => Sn.cur && d.key === Sn.cur.district.key); if (D) { UI.tab = D.id; UI.show('map'); } };
UI.act.season = () => Sn.open();
Ext.addSlot('title', () => (Sn.cur ? `<button class="btn ghost sm wide" data-act="season" style="border-color:#7CFF6B">${Sn.cur.icon || '🎉'} ${esc(tr('se_btn'))}: ${esc(L2(Sn.cur.name))}${Sn.cur.track && Sn.claimable(Sn.cur, stOf(Sn.cur), Sn.has()).length ? ' 🎁' : ''}</button>` : ''));

// ---------- seasonal mission types: gift_run, collect, runway ----------
function regTypes() {
  const M = VP.Missions, TY = M._.TYPES, E = VP.Enemies;
  const reach = (G, x, y) => !G.field || G.W.distAt(G.field, x, y) >= 0;
  const chain = (B, from, n, dmin, dmax) => { const out = []; let cur = from; for (let k = 0; k < n; k++) { let best = null, bs = -1e9; for (let i = 0; i < 40; i++) { const q = B.rw(), d = Math.hypot(q.x - cur.x, q.y - cur.y); if (!reach(B.G, q.x, q.y) || out.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 150)) continue; const s = d >= dmin && d <= dmax ? 1e6 - Math.abs(d - (dmin + dmax) / 2) : -Math.abs(d - dmin); if (s > bs) { bs = s; best = q; } } out.push(best || B.rw()); cur = out[out.length - 1]; } return out; };
  const quiet = G => { G.noPolice = true; G.noHeat = true; };
  const santa = (B, pt) => { const def = Sn.cur || Sn.defs.find(d => d.id === 'natal'); if (!def || !def.santa) return; const f = Game.addFriend(pt.x + 40, pt.y - 20, 'f2'); f.spec = def.santa.spec; f.stay = true; f.label = L2(def.santa.name); };

  TY.gift_run = { setup(B) {
    const p = B.p, G = B.G, start = B.front('plaza1', 'e'); E.state(G);
    B.begin(start, { traffic: 6 }); quiet(G); santa(B, start);
    const stops = chain(B, start, p.stops, 300, 620);
    stops.forEach((pt, i) => {
      const f = Game.addFriend(pt.x + 22, pt.y - 10, 'f' + (i % 4)); f.stay = true;
      B.goto(pt, 'o_gift_go', { args: [i + 1, stops.length], exit() {
        E.addPick(G, 'gift', pt.x - 16, pt.y - 8, { locked: true }); G.stat.cash += 20; sfx('paw', 0.05);
        FX.text(pt.x, pt.y - 60, '🎁 ' + tr('se_delivered'), '#7CFF6B', 16); FX.burst(pt.x, pt.y - 20, 12, ['#e01e37', '#7CFF6B', '#ffd23f'], 190, 'heart', 7, 0.7);
        if (p.thieves && E.ready && (i === 1 || i === 3)) for (let k = 0; k < p.thieves; k++) { const q = Game.spawnPoint(260, 420); if (q) { const e = E.spawn(G, 'pombo', q.x, q.y, { lv: B.m.lv, state: 'act', force: true }); if (e) e.aggro = 2000; } }
      } });
    });
    if (p.time) G.mtimer = p.time;
  } };
  TY.collect = { setup(B) {
    const p = B.p, G = B.G, start = B.front('plaza1', 'e'), kind = p.kind || 'ornament'; E.state(G);
    B.begin(start, { traffic: 6 }); quiet(G);
    const pts = chain(B, start, p.n, 220, 520), picks = pts.map(q => E.addPick(G, kind, q.x, q.y, { col: kind === 'star' ? '#ffd23f' : '#ff4fb8', on: () => { G.stat.cash += 10; } }));
    B.step({ txt: 'o_collect_' + kind, at() { const a = G.cats[G.active]; let b = null, bd = 1e12; for (const k of picks) if (!k.taken) { const d = U.d2(k.x, k.y, a.x, a.y); if (d < bd) { bd = d; b = k; } } return b ? { x: b.x, y: b.y } : null; }, done: () => picks.every(k => k.taken), prog: () => [picks.filter(k => k.taken).length, picks.length] });
    if (p.to) { const lot = B.R(p.to) || B.R('arena'), pt = B.W.front(lot, 's'); B.goto(pt, 'o_decorate', { exit() { for (let i = 0; i < picks.length; i++) { const a = i / picks.length * 6.283; E.addPick(G, kind, pt.x + Math.cos(a) * 46, pt.y + Math.sin(a) * 30 - 30, { locked: true, h: 0.3 + (i % 3) * 0.5 }); } E.addPick(G, 'star', pt.x, pt.y - 30, { locked: true, h: 2.2, s: 1.8 }); FX.burst(pt.x, pt.y - 30, 24, ['#e01e37', '#7CFF6B', '#ffd23f', '#2de2e6'], 240, 'star', 8, 1); FX.say('🎄 ' + tr('se_decor'), '#7CFF6B', 3); } }); B.wait(1.2, 'o_done'); }
    if (p.time) G.mtimer = p.time;
  } };
  TY.runway = { setup(B) {
    const p = B.p, G = B.G, lot = B.R('plaza3') || B.R('plaza1'), start = B.W.front(lot, 'n'); E.state(G);
    B.begin(start, { traffic: 2 }); quiet(G); G.noCars = true;
    const free = B.W.lotFree(lot), n = p.marks || 5, marks = [];
    for (let i = 0; i < n; i++) { const want = { x: (lot.tx + 1.5 + (i % 2) * 5) * T, y: (lot.ty + 1.2 + i * (5.6 / Math.max(1, n - 1))) * T }; let b = free[0], bd = 1e12; for (const q of free) { const d = U.d2(q.x, q.y, want.x, want.y); if (d < bd && !marks.some(m => U.d2(m.x, m.y, q.x, q.y) < 60 * 60)) { bd = d; b = q; } } marks.push(b); }
    for (let i = 0; i < 3; i++) { const f = Game.addFriend(start.x - 50 + i * 50, start.y - 4, 'f' + i); f.stay = true; f.label = '⭐'; }
    marks.forEach((mk, i) => {
      const pk = E.addPick(G, 'star', mk.x, mk.y, { locked: true, s: 0.9 });
      B.step({ txt: 'o_runway', args: [i + 1, n], mini: true, t: 0, at: () => mk,
        tick(dt) { const c = G.cats[G.active], I = VP.I, still = Math.hypot(I.mx || 0, I.my || 0) < 0.25; if (U.d2(c.x, c.y, mk.x, mk.y) < 30 * 30 && still) { if (this.t === 0) { Game.emote(['dance', 'wave', 'miau', 'dance', 'sit'][i % 5], c); FX.text(c.x, c.y - 70, '📸 ' + tr('se_pose'), '#ff4fb8', 17); } this.t += dt; } else if (this.t > 0 && !still) this.t = 0; },
        done() { return this.t >= 1.6; }, prog() { return [Math.min(4, Math.floor(this.t / 0.4)), 4]; },
        exit() { pk.taken = true; G.stat.cash += 25; sfx('star', 0.05); FX.text(mk.x, mk.y - 70, '⭐ ' + tr('se_ten'), '#ffd23f', 18); FX.burst(mk.x, mk.y - 20, 14, ['#ff4fb8', '#2de2e6', '#ffd23f'], 210, 'star', 8, 0.8); } });
    });
  } };
}

// ---------- boot ----------
Sn.load = function () {
  return Ext.json('data/seasons/index.json')
    .then(ix => Promise.all(ix.seasons.map(id => Ext.json('data/seasons/' + id + '.json').catch(() => null))))
    .then(defs => { Sn.defs = defs.filter(Boolean); Sn.cur = Sn.pick(Sn.defs, Sn.today(), Q.season); return new Promise(res => Ext.whenData(res)); })
    .then(() => Promise.resolve(VP.Enemies && VP.Enemies.whenLoaded))
    .then(() => {
      regTypes();
      const def = Sn.cur;
      if (def && def.missions && def.missions.length) Ext.addMissions({ districts: [def.district], missions: def.missions });
      Sn.syncWardrobe(); Sn.ready = true;
      if (UI.screen === 'title' || UI.screen === 'map') UI.relabel();
    })
    .catch(e => { console.warn('[season] not loaded', e); Sn.ready = true; });
};
Sn.whenLoaded = Sn.load();
})();
