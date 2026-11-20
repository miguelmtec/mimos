'use strict';
// VICE PAWS — screens (title, missions map, briefing, pause, results, ranking), main loop, test hooks
(function () {
const VP = window.VP, U = VP.U, I = VP.I, Game = VP.Game, M = VP.Missions, t = (...a) => VP.t(...a);
const UI = VP.UI = { screen: null, state: 'menu', paused: false, tab: 0, sessionVipCard: false };
const IG = 'https://www.instagram.com/mimo.mimosa.morticia/';
const SITE = 'https://vice-paws.vercel.app/';
let root, G = null, last = 0, pending = null, lastResult = null;
const $ = s => root.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const art = k => VP.Assets.get(k) || '';
const bg = k => art(k) ? ` style="background-image:url('${art(k)}')"` : '';
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const DCOL = ['linear-gradient(120deg,#ff8a5c,#ff4fb8)', 'linear-gradient(120deg,#3a1560,#b0189a)', 'linear-gradient(120deg,#27c4d6,#3fc27f)', 'linear-gradient(120deg,#262d3a,#4c7fa8)', 'linear-gradient(120deg,#8a2a8a,#ff4fb8)', 'linear-gradient(120deg,#b8860b,#ffd23f)', 'linear-gradient(120deg,#0f5f3a,#e01e37)'];

UI.toast = function (msg, ms) { const el = document.getElementById('toast'); el.textContent = msg; el.style.display = 'block'; clearTimeout(UI._tt); UI._tt = setTimeout(() => { el.style.display = 'none'; }, ms || 2200); };
UI.confetti = function () {
  const d = document.createElement('div'); d.className = 'confetti';
  for (let i = 0; i < 70; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = U.pick(['#ff4fb8', '#2de2e6', '#ffd23f', '#7CFF6B', '#fff']); p.style.animationDuration = 1.6 + Math.random() * 2 + 's'; p.style.animationDelay = Math.random() * 0.6 + 's'; d.appendChild(p); }
  document.body.appendChild(d); setTimeout(() => d.remove(), 4600);
};

// ---------- screen plumbing ----------
const SCREENS = UI.SCREENS = {};
UI.show = function (id, arg) {
  UI.screen = id; UI.arg = arg;
  const def = SCREENS[id];
  root.innerHTML = `<div class="screen on ${def.cls || ''}" id="s-${id}">${def.html(arg)}</div>`;
  if (def.after) def.after(arg);
  VP.HUD.hidden = !!def.hideHud; I.enabled = false; I.reset();
  if (VP.R3 && VP.R3.ok && !def.stage && VP.R3.mode === 'stage') VP.R3.endShowcase();
};
UI.hide = function () { UI.screen = null; root.innerHTML = ''; VP.HUD.hidden = false; I.enabled = true; I.reset(); if (VP.R3 && VP.R3.mode === 'stage') VP.R3.endShowcase(); };
UI.relabel = function () { if (UI.screen) UI.show(UI.screen, UI.arg); };
const ACT = UI.act = {};
function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el) return;
  VP.Audio.unlock(); VP.Audio.sfx('click');
  const f = ACT[el.dataset.act]; if (f) f(el, e);
}
const corner = back => `<div class="corner l">${back ? `<button class="chip" data-act="${back}">‹ ${t('back')}</button>` : ''}</div><div class="corner"><button class="chip" data-act="lang">${VP.lang() === 'pt' ? '🇧🇷 PT' : '🇺🇸 EN'}</button><button class="chip" data-act="mute">${VP.Audio.muted ? '🔇' : '🔊'}</button></div>`;
const foot = () => `<div class="foot"><a href="${IG}" target="_blank" rel="noopener">📸 ${t('follow')} @mimo.mimosa.morticia</a><br>${t('fan')}</div>`;

// ---------- title ----------
SCREENS.title = {
  hideHud: true,
  html: () => `<div class="bg"${bg('title_bg')}></div><div class="shade"></div>${corner()}
    <div class="top"><h1 class="logo">VICE<span>PAWS</span></h1></div>
    <div class="in"><p class="tag">${t('tagline')}</p>
      <button class="btn big" data-act="play">▶ ${VP.S.unlocked > 1 || VP.S.pos ? t('cont') : t('play')}</button>
      <div class="grid2"><button class="btn teal sm" data-act="map">🗺 ${t('map')}</button><button class="btn gold sm" data-act="shop">🛍 ${t('shop')}</button>
      <button class="btn ghost sm" data-act="wardrobe">👕 ${t('wardrobe')}</button><button class="btn ghost sm" data-act="rank">🏆 ${t('ranking')}</button>
      <button class="btn ghost sm" data-act="account">👤 ${VP.Acct && VP.Acct.status === 'in' ? t('ac_mycats') : t('account')}</button><button class="btn ghost sm" data-act="world">✈ ${t('world')}</button>
      <button class="btn ghost sm" data-act="how">❓ ${t('how')}</button><button class="btn ghost sm" data-act="settings">⚙ ${t('settings')}</button></div>
      ${foot()}</div>`,
};
ACT.lang = () => VP.setLang(VP.lang() === 'pt' ? 'en' : 'pt');
ACT.mute = () => { VP.Audio.toggleMute(); UI.relabel(); };
ACT.title = () => { endGame(); VP.Audio.music(6); UI.show('title'); };
ACT.play = () => { if (G && G.W && G.W.real) UI.tour(G.W.real.id); else UI.free(); };
ACT.map = () => UI.show('map');
ACT.how = () => UI.show('how');
ACT.rank = () => UI.show('rank');
ACT.settings = () => UI.show('settings');
ACT.shop = () => VP.Shop.open();
ACT.world = () => { if (VP.Tour) VP.Tour.open(); else UI.toast('✈'); };
ACT.wardrobe = () => { if (VP.Wardrobe && VP.Wardrobe.open) VP.Wardrobe.open(); else UI.toast('🐾'); };
ACT.back = () => { if (G && UI.state === 'play') UI.show('pause'); else UI.show('title'); };

// ---------- how to play ----------
SCREENS.how = {
  hideHud: true,
  html: () => `${corner('back')}<div class="wrap" style="margin-top:44px"><h2>${t('how')}</h2>
    <div class="cats">${['mimo', 'mimosa', 'morticia'].map(n => `<div class="cat ${n}"><img src="${art('portrait_' + n)}" alt=""><b>${t(n)}</b><i>${t('role_' + n)}</i><span>${t('desc_' + n)}</span></div>`).join('')}</div>
    <div class="panel t"><p>${t('howTxt')}</p></div>
    <button class="btn" data-act="back">${t('back')}</button></div>`,
};
// ---------- settings ----------
SCREENS.settings = {
  hideHud: true,
  html: () => { const q = VP.ls.get('vp_quality'); return `${corner('back')}<div class="wrap narrow" style="margin-top:48px"><h2 class="teal">⚙</h2><div class="panel">
    <div class="sw"><span>${t('quality')}</span><span class="row">${['a', 0, 1, 2].map(v => `<button class="tab ${(v === 'a' ? !q : q === '' + v) ? 'on' : ''}" data-act="q" data-v="${v}">${t('q' + v)}</button>`).join('')}</span></div>
    <div class="sw"><span>${t('sound')}</span><button class="tab on" data-act="mute">${VP.Audio.muted ? t('off') : t('on')}</button></div>
    <div class="sw"><span>${t('lang')}</span><button class="tab on" data-act="lang">${VP.lang() === 'pt' ? 'Português' : 'English'}</button></div>
    ${VP.Shop.has('season') ? `<div class="sw"><span>🎄 ${t('xmasOn')}</span><button class="tab on" data-act="xmas">${VP.S.xmas ? t('on') : t('off')}</button></div>` : ''}
    <div class="sw"><span>${t('restore')}</span><button class="tab" data-act="restore">🔑</button></div>
    <div class="sw" style="border:0"><span>${t('resetSave')}</span><button class="tab" data-act="reset">🗑</button></div></div>
    <button class="btn" data-act="back">${t('back')}</button>${foot()}</div>`; },
};
ACT.q = el => { const v = el.dataset.v; if (v === 'a') { VP.ls.set('vp_quality', ''); } else if (VP.R3) VP.R3.setQuality(+v); UI.relabel(); };
ACT.xmas = () => { VP.S.xmas = !VP.S.xmas; VP.persist(); UI.relabel(); };
ACT.reset = () => { if (confirm(t('resetAsk'))) { VP.resetSave(); endGame(); UI.show('title'); } };
ACT.restore = () => VP.Shop.restorePrompt();

// ---------- missions map ----------
SCREENS.map = {
  hideHud: true,
  html: () => {
    const d = UI.tab, D = M.DIST[d], list = M.list.filter(m => m.d === d), locked = D.grant && !VP.Shop.has(D.grant);
    const done = list.filter(m => VP.S.stars[m.n]).length, st = list.reduce((a, m) => a + (VP.S.stars[m.n] || 0), 0);
    return `${corner('back')}<div class="wrap" style="margin-top:46px"><h2 class="teal">${t('map')}</h2>
      <div class="tabs">${M.DIST.map(x => `<button class="tab ${x.id === d ? 'on' : ''} ${x.grant === 'vip' ? 'vip' : x.grant ? 'sea' : ''}" data-act="tab" data-d="${x.id}">${x.grant === 'vip' ? '👑 ' : x.grant ? '🎄 ' : ''}${t('d' + x.id)}</button>`).join('')}</div>
      <div class="dhead" style="background:${DCOL[d]}"><b>${t('d' + d)}</b><span>${done}/${list.length} · ${st}⭐ / ${list.length * 3}</span></div>
      <div class="path">${list.map(m => { const un = M.unlocked(m), s = VP.S.stars[m.n] || 0, next = un && !s; return `<button class="node ${s ? 'done' : ''} ${next ? 'next' : ''} ${un ? '' : 'lock'} ${m.boss ? 'boss' : ''}" data-act="${un ? 'brief' : locked ? 'shop' : 'nop'}" data-n="${m.n}">${un ? (m.bonus ? m.n - D.from + 1 : m.n) : '🔒'}<small>${s ? stars(s) : ''}</small></button>`; }).join('')}</div>
      ${locked ? `<div class="mrow">🔒 <div style="flex:1">${t('bonusLock')}</div><button class="btn gold sm" data-act="shop">${t('shop')}</button></div>` : ''}
      <div class="mrow"><div style="flex:1">❤️ ${t('lives')}: <b>${VP.S.lives}</b> &nbsp; ⭐ <b>${VP.totalStars()}</b> &nbsp; 🪙 <b>${VP.S.cash}</b></div><button class="btn sm" data-act="play">🌴 ${t('city')}</button></div>
      ${foot()}</div>`;
  },
};
ACT.tab = el => { UI.tab = +el.dataset.d; UI.show('map'); };
ACT.nop = () => UI.toast('🔒 ' + t('locked'));
ACT.brief = el => UI.show('brief', +el.dataset.n);

// ---------- briefing ----------
const NEED = { reach: null, waves: null, eat: ['morticia'], steal: ['morticia'], cash: ['mimosa', 'morticia'], rescue: 'all', truck: 'gate', vault: 'all', escape: null, chase: ['mimo'], race: null, defend: ['mimosa', 'mimo'], boss: 'all' };
const GATECAT = { fence: 'mimosa', switch: 'mimo', gap: 'morticia', key: 'morticia' };
SCREENS.brief = {
  cls: 'glass', hideHud: true,
  html: n => {
    const m = M.get(n), D = M.DIST[m.d];
    let need = m.side ? null : NEED[m.type]; if (need === 'gate') need = [GATECAT[m.p.gate]]; if (need === 'all') need = ['mimo', 'mimosa', 'morticia'];
    const hero = m.boss ? (art('boss_' + (m.d + 1)) || art('title_bg')) : m.d === 6 ? art('shop_season') : m.d === 5 ? art('shop_vip') : art('title_bg');
    const best = VP.S.best[n];
    return `${corner(G ? 'closeBrief' : 'map')}<div class="wrap narrow" style="margin-top:46px">
      <div class="hero" style="background-image:url('${hero}');${m.boss ? 'box-shadow:inset 0 0 0 3px #ffd23f,0 0 30px #ffd23f66' : ''}"><div class="cap"><span>${m.boss ? '👑 ' + t('bossM') + ' · ' : ''}${m.tourCity ? '✈ ' + esc(VP.CityCache[m.tourCity].real.name).toUpperCase() : t('d' + m.d).toUpperCase() + ' · ' + (m.side ? '🏁 ' + t('trial') : t('mission').toUpperCase() + ' ' + (m.bonus ? '★' + (m.n - D.from + 1) : m.n))}</span><b>${esc(VP.mname(m))}</b></div></div>
      <div class="panel"><p>${t(m.tourCity ? 'b_tour' : m.side ? 'b_trial' : 'b_' + m.type)}</p>${m.boss ? `<p class="small">💡 ${t('bossTip')}</p>` : ''}
        ${need ? `<div class="need">${need.map(c => `<img src="${art('portrait_' + c)}" alt="">`).join('')}<div><b>${need.length === 3 ? t('need_all') : need.map(c => t('need_' + c)).join(' · ')}</b></div></div>` : ''}
        <p class="small">⏱ ${t('par')}: ${U.fmtTime(M.par(m))}${m.p.time ? ' · ⌛ ' + U.fmtTime(m.p.time) : ''} ${best ? ' · ' + t('best') + ': ' + best : ''} ${VP.S.stars[n] ? ' · ' + stars(VP.S.stars[n]) : ''}</p></div>
      <button class="btn big" data-act="start" data-n="${n}">▶ ${t('start')}</button>
      <button class="btn ghost" data-act="${G ? 'closeBrief' : 'map'}">${t('back')}</button></div>`;
  },
};
ACT.closeBrief = () => { if (G && !G.over) { UI.hide(); UI.paused = false; } else UI.show('map'); };
ACT.start = el => UI.startMission(+el.dataset.n);

// ---------- pause ----------
SCREENS.pause = {
  cls: 'glass center', hideHud: true,
  html: () => `${corner()}<div class="wrap narrow"><h2>${t('paused')}</h2>
    ${G && !G.free ? `<p><b>${esc(VP.mname(G.m))}</b><br><span class="small">${esc(M.objective(G).txt)}</span></p>` : `<p class="small">${t('o_free')}</p>`}
    <button class="btn big" data-act="resume">▶ ${t('resume')}</button>
    <div class="grid2">${G && !G.free ? `<button class="btn ghost sm" data-act="restart">↻ ${t('restart')}</button><button class="btn ghost sm" data-act="quit">🌴 ${t('quit')}</button>` : `<button class="btn teal sm" data-act="map">🗺 ${t('map')}</button><button class="btn gold sm" data-act="shop">🛍 ${t('shop')}</button>`}
    <button class="btn ghost sm" data-act="world">✈ ${t('world')}</button><button class="btn ghost sm" data-act="account">👤 ${t('account')}</button>
    <button class="btn ghost sm" data-act="how">❓ ${t('how')}</button><button class="btn ghost sm" data-act="settings">⚙ ${t('settings')}</button>
    <button class="btn ghost sm" data-act="wardrobe">👕 ${t('wardrobe')}</button><button class="btn ghost sm" data-act="title">🏠 Menu</button></div></div>`,
};
ACT.resume = () => { UI.hide(); UI.paused = false; VP.Audio.pause(false); };
ACT.restart = () => UI.startMission(G.m.n);
ACT.quit = () => ACT.play();

// ---------- results ----------
SCREENS.result = {
  cls: 'clear', hideHud: true,
  html: r => {
    const m = r.m, nx = r.win ? nextOf(m) : null;
    const vipCard = r.win && r.districtClear && !VP.Shop.has('vip') && !UI.sessionVipCard;
    if (vipCard) UI.sessionVipCard = true;
    return `<div class="wrap narrow" style="margin-top:auto">
      <h2 class="${r.win ? 'gold' : ''}">${r.win ? (r.districtClear ? t('districtClear') : t('win')) : t('lose')}</h2>
      <p class="small"><b>${esc(VP.mname(m))}</b>${r.win ? '' : ' · ' + t('f_' + r.why)}</p>
      ${r.win ? `<div class="stars">${[1, 2, 3].map(i => `<span class="${i <= r.stars ? 'on' : ''}">⭐</span>`).join('')}</div>
      <div class="panel"><div class="checks"><div class="ok"><span>✔ ${t('s_done')}</span><span>⭐</span></div><div class="${r.noFaint ? 'ok' : 'no'}"><span>${r.noFaint ? '✔' : '✖'} ${t('s_nofaint')}</span><span>⭐</span></div><div class="${r.underPar ? 'ok' : 'no'}"><span>${r.underPar ? '✔' : '✖'} ${t('s_par')} (${U.fmtTime(r.time)} / ${U.fmtTime(r.par)})</span><span>⭐</span></div></div>
      <div class="row" style="justify-content:space-between;margin-top:6px"><span>${t('score')}</span><span class="bigscore">${r.score}</span></div>
      <p class="small">🪙 +${r.cash} ${t('coins')} ${r.rewards.map(x => '<br>🎁 ' + x).join('')}${m.n === 50 ? '<br>💖 ' + t('theEnd') : ''}</p></div>` : `<div class="panel"><p class="small">💡 ${t(m.boss ? 'bossTip' : 'b_' + m.type)}</p></div>`}
      ${vipCard ? `<div class="vipcard"><img src="${art('shop_vip')}" alt=""><div style="flex:1"><b>${t('vipCard')}</b>${t('vipCardSub')}</div><div><button class="btn gold sm" data-act="shop">${t('see')}</button><br><button class="btn ghost sm" data-act="noVip">${t('noThanks')}</button></div></div>` : ''}
      ${r.win && nx ? `<button class="btn big" data-act="start" data-n="${nx.n}">▶ ${t('next')}</button>` : ''}
      ${!r.win ? `<button class="btn big" data-act="start" data-n="${m.n}">↻ ${t('retry')}</button>` : ''}
      <div class="grid2"><button class="btn teal sm" data-act="play">🌴 ${t('toCity')}</button><button class="btn ghost sm" data-act="map">🗺 ${t('toMap')}</button>
      ${r.win ? `<button class="btn ghost sm" data-act="share">📤 ${t('share')}</button><button class="btn ghost sm" data-act="rank">🏆 ${t('ranking')}</button>` : ''}</div></div>`;
  },
};
ACT.noVip = el => { const c = el.closest('.vipcard'); if (c) c.remove(); };
function nextOf(m) { if (m.side) return null; const nx = M.list[M.list.indexOf(m) + 1]; return nx && nx.d === m.d && M.unlocked(nx) ? nx : (nx && !m.bonus && !nx.bonus && M.unlocked(nx) ? nx : null); }
UI.result = function (win, why) {
  if (!G) return;
  const m = G.m;
  if (m.free) { if (!win) { VP.S.lives = Math.max(VP.S.lives, 1); VP.persist(); UI.free(null, true); } return; }
  const r = { win, why: why || 'allDown', m, time: G.time, par: M.par(m), stars: 0, score: 0, cash: 0, rewards: [], districtClear: false };
  if (win) {
    r.noFaint = G.stat.downs === 0; r.underPar = G.time <= r.par;
    r.stars = 1 + (r.noFaint ? 1 : 0) + (r.underPar ? 1 : 0);
    r.cash = Math.round(G.stat.cash) + (m.side ? Math.round(m.p.reward * (VP.S.stars[m.n] ? 0.25 : 1)) : 0);
    r.score = Math.min(24000, Math.round(G.stat.cash + r.stars * 1000 + Math.min(3000, Math.max(0, r.par * 1.5 - G.time) * 12)));
    const S = VP.S, old = S.stars[m.n] || 0;
    if (r.stars === 3 && old < 3) { S.lives = Math.max(S.lives, Math.min(9, S.lives + 1)); r.rewards.push(t('lifeReward')); }
    if (m.boss && !old) { S.lives = Math.max(S.lives, Math.min(9, S.lives + 1)); r.rewards.push(t('lifeBoss')); }
    S.stars[m.n] = Math.max(old, r.stars); S.best[m.n] = Math.max(S.best[m.n] || 0, r.score); S.cash += r.cash;
    if (!m.bonus && m.n === S.unlocked && S.unlocked < 50) S.unlocked++; else if (!m.bonus && m.n === 50) S.unlocked = 51;
    r.districtClear = !!m.boss || (m.bonus && !m.side && m.n === M.DIST[m.d].to);
    VP.persist();
    if (VP.onProgress) VP.onProgress(r);
  }
  lastResult = r;
  VP.Audio.music(win ? 6 : -1);
  UI.show('result', r);
  if (win && r.stars === 3) UI.confetti();
};

// ---------- ranking ----------
SCREENS.rank = {
  hideHud: true,
  html: () => `${corner('back')}<div class="wrap narrow" style="margin-top:46px"><h2 class="gold">🏆 ${t('ranking')}</h2>
    <div class="panel"><ol class="rank" id="rk"><li>${t('loading')}</li></ol></div>
    <div class="panel t"><p class="small">${t('yourName')} · ⭐ ${mainStars()} · ${mainScore()} pts</p><div class="row" style="flex-wrap:nowrap"><input class="txt" id="nick" maxlength="12" value="${esc(VP.S.name || '')}" placeholder="Mimo"><button class="btn sm" data-act="sendScore">${t('send')}</button></div></div>
    <button class="btn ghost" data-act="back">${t('back')}</button>${foot()}</div>`,
  after: () => loadRank(),
};
const mainStars = () => { let s = 0; for (let n = 1; n <= 50; n++) s += VP.S.stars[n] || 0; return s; };
const mainScore = () => { let s = 0; for (let n = 1; n <= 50; n++) s += VP.S.best[n] || 0; return s; };
const mainLevel = () => { let l = 0; for (let n = 1; n <= 50; n++) if (VP.S.stars[n]) l = n; return l; };
function drawRank(top) {
  const ol = $('#rk'); if (!ol) return;
  if (!top || !top.length) { ol.innerHTML = `<li>${t('rankEmpty')}</li>`; return; }
  const me = (VP.S.name || '').toLowerCase();
  ol.innerHTML = top.map((r, i) => { const vip = r.vip || (me && String(r.name).toLowerCase() === me && VP.Shop.has('vip')), sup = me && String(r.name).toLowerCase() === me && VP.Shop.has('supporter'); return `<li class="${String(r.name).toLowerCase() === me ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="nm ${vip || sup ? 'gold-name' : ''}">${vip ? '👑 ' : ''}${esc(r.name)}${sup ? ' 💖' : ''}</span><span class="small">M${r.level} · ${r.stars}⭐</span><span class="sc">${r.score}</span></li>`; }).join('');
}
function loadRank() {
  fetch('/api/scores', { cache: 'no-store' }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => drawRank(j.top)).catch(() => { const ol = $('#rk'); if (ol) ol.innerHTML = `<li>${t('rankOff')}</li>`; });
}
ACT.sendScore = () => {
  const inp = $('#nick'), name = (inp.value || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 12);
  if (!name) { inp.focus(); return; }
  VP.S.name = name; VP.persist();
  const level = mainLevel(); if (!level) { UI.toast(t('rankEmpty')); return; }
  fetch('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, score: mainScore(), level, stars: mainStars(), vip: VP.Shop.has('vip') }) })
    .then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => { UI.toast(t('sent')); drawRank(j.top); }).catch(() => UI.toast(t('rankOff'), 3000));
};
ACT.share = () => {
  const text = t('shareTxt', mainStars() || (lastResult ? lastResult.stars : 0));
  const done = () => UI.toast(t('copied'));
  try {
    if (navigator.share) { navigator.share({ title: 'Vice Paws', text, url: SITE }).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text + ' ' + SITE).then(done, done); return; }
  } catch (e) { /* fall through */ }
  const ta = document.createElement('textarea'); ta.value = text + ' ' + SITE; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); done();
};

// ---------- no webgl ----------
SCREENS.nowebgl = { cls: 'center', hideHud: true, html: () => `<div class="wrap narrow"><h1 class="logo">VICE<span>PAWS</span></h1><div class="panel" style="margin-top:20px;text-align:center"><p>😿 ${t('noWebgl')}</p><p class="small">${t('openOut')}</p></div><a class="btn" href="${IG}" target="_blank" rel="noopener">📸 ${t('follow')}</a>${foot()}</div>` };

// ---------- game flow ----------
function endGame() { if (G) { Game.end(); G = null; } UI.state = 'menu'; UI.paused = false; }
function begin(g) {
  G = g; UI.state = 'play'; UI.paused = false; UI.hide();
  if (VP.R3 && VP.R3.ok) { VP.R3.attach(G); VP.R3.snapCamera(-Math.PI / 2); }
  I.reset(); I.enabled = true; VP.Audio.unlock(); VP.Audio.pause(false);
}
UI.free = function (pos, keep, opts) {
  if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; }
  const p = pos || (G && !G.trial && G.cats && !G.W.real ? { x: G.cats[G.active].x, y: G.cats[G.active].y } : VP.S.pos);
  endGame(); begin(M.startFree(p, opts)); void keep;
  UI.songD = -1;
};
UI.tour = function (id) { if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; } if (!VP.CityCache[id]) return; endGame(); begin(M.startTour(id)); const meta = VP.CityCache[id].meta; VP.Audio.music([0, 1, 2, 3, 4, 2, 6][meta.mood || 0]); UI.songD = -2; Game.fx.say('✈ ' + VP.CityCache[id].real.name, '#ffd23f', 3); };
UI.startMission = function (n) {
  if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; }
  const m = M.get(n); if (!m || !M.unlocked(m)) return;
  endGame(); begin(M.start(m));
  VP.Audio.music(m.boss ? 5 : m.tourCity ? [0, 1, 2, 3, 4, 2, 6][VP.CityCache[m.tourCity].meta.mood || 0] : M.DIST[m.d].song);
  if (m.boss) { VP.Audio.sfx('boss'); Game.fx.say(t('boss_' + m.boss).toUpperCase() + '!', '#ffd23f', 3); } else Game.fx.say(VP.mname(m), '#fff', 2.6);
};
UI.marker = function (mk) {
  if (mk.k === 'shop') { UI.paused = true; VP.Shop.open(); return; }
  if (mk.k === 'mission' || mk.k === 'race') { UI.paused = true; UI.show('brief', mk.n); return; }
  if (mk.k === 'npc') { UI.quest(mk); return; }
  if (mk.act) mk.act(mk);
};
UI.quest = function (mk) {
  const q = mk.q, L = VP.lang() === 'pt' ? 'pt' : 'en';
  if (G.quest && G.quest.def === q) {
    if (G.stat[G.quest.key] - G.quest.base < q.n) return;
    VP.S.quests[q.id] = 1; VP.S.cash += q.reward; VP.persist(); G.quest = null; G.markers.splice(G.markers.indexOf(mk), 1);
    UI.confetti(); VP.Audio.sfx('win'); Game.fx.say(t('q_done', q.reward), '#7CFF6B', 3.5); return;
  }
  if (G.quest) { UI.toast(t('q_busy')); return; }
  UI.paused = true; UI.show('quest', mk);
};
SCREENS.quest = { cls: 'glass center', hideHud: true, html: mk => { const q = mk.q, L = VP.lang() === 'pt' ? 'pt' : 'en'; return `<div class="wrap narrow"><h2 class="teal">💬 ${esc(q.name[L])}</h2><div class="panel t"><p>“${esc(q.text[L])}”</p><p class="small">🎁 ${q.reward} ${t('coins')}</p></div><div class="row"><button class="btn ghost" data-act="resume">${t('q_later')}</button><button class="btn" data-act="qAccept">${t('q_accept')}</button></div></div>`; } };
ACT.qAccept = () => { const mk = UI.arg, q = mk.q, key = { eat: 'eaten', ko: 'ko', steal: 'stolen', cash: 'cash' }[q.type]; G.quest = { def: q, key, base: G.stat[key], mk }; ACT.resume(); };
UI.trialEnd = function () { UI.toast(t('trialEnd')); endGame(); VP.Shop.open(); };
UI.pause = function () { if (UI.state !== 'play' || UI.screen) return; UI.paused = true; VP.Audio.pause(true); UI.show('pause'); };

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  const R3 = VP.R3;
  if (G && UI.state === 'play') {
    if (!UI.paused && !UI.screen) {
      I.poll();
      if (I.take('pause')) UI.pause(); else Game.update(dt);
      if (G && G.free && !G.tour) { const d = VP.World.distAt(G.W, G.cats[G.active].x, G.cats[G.active].y); if (d !== UI.songD) { UI.songD = d; VP.Audio.music(M.DIST[d].song); } }
    }
    if (G && G.over) { G.real += dt; for (const c of G.cats) c.t += dt; }
  }
  if (R3 && R3.ok) { const full = UI.screen && SCREENS[UI.screen] && SCREENS[UI.screen].hideHud && !SCREENS[UI.screen].cls && R3.mode !== 'stage'; if (!full || R3.mode === 'stage') R3.render(G, dt); }
  VP.HUD.draw(G && UI.state === 'play' ? G : null, dt);
}

VP.DATA = {};
UI.boot = function () {
  const files = ['missions', 'items', 'outfits', 'activities', 'cities/index'];
  Promise.all(files.map(f => fetch('data/' + f + '.json').then(r => r.json()))).then(d => {
    files.forEach((f, i) => { VP.DATA[f] = d[i]; });
    M.load(d[0], d[3]); M.loadCities(d[4]); if (VP.Wardrobe) VP.Wardrobe.load(d[2]);
    boot2();
  }).catch(e => { console.error('data', e); document.getElementById('ui').innerHTML = '<div class="screen on center"><p>😿 Não deu para carregar o jogo. Recarregue a página.<br>Could not load the game. Please reload.</p></div>'; });
};
function boot2() {
  root = document.getElementById('ui');
  root.addEventListener('click', onClick);
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (UI.state === 'play' && !UI.screen) UI.pause(); VP.Audio.pause(true); } else if (!UI.paused) VP.Audio.pause(false); });
  addEventListener('pointerdown', () => VP.Audio.unlock(), { passive: true });
  VP.Assets.onchange = k => { if (UI.screen === 'title' && k === 'title_bg') UI.relabel(); };
  VP.Assets.load();
  try { document.documentElement.lang = VP.lang() === 'pt' ? 'pt-BR' : 'en'; } catch (e) { /* ignore */ }
  const hud = document.getElementById('hud');
  VP.HUD.init(hud); I.bind(hud);
  VP.Audio.music(6);
  UI.show('title');
  const startGfx = () => { if (VP.R3 && !VP.R3.ok && !UI.gfxTried) { UI.gfxTried = true; let ok = false; try { ok = VP.R3.init(document.getElementById('gl')); } catch (e) { ok = false; console.warn('gfx', e); } if (!ok) UI.noGfx = true; } };
  if (VP.R3) startGfx(); else addEventListener('vp-gfx', startGfx);
  UI.ready = true;
  if (VP.Acct) VP.Acct.init();
  requestAnimationFrame(frame);
}
// ---------- test hooks ----------
window.__vp = {
  VP, get G() { return G; }, start: n => UI.startMission(n), free: p => UI.free(p), win: () => Game.win(), fail: w => Game.fail(w || 'time'),
  unlockAll: () => { VP.S.unlocked = 51; VP.persist(); }, state: () => ({ screen: UI.screen, state: UI.state, paused: UI.paused, mission: G ? G.m.n : null, step: G ? G.step : -1, over: G ? G.over : null }),
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', UI.boot); else UI.boot();
})();
