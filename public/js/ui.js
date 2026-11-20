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
  UI.screen = id; UI.arg = arg; if (id !== 'title') UI.sheet = null;
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
  if (el.dataset.act === 'play' && UI.screen === 'title' && UI.needLogin()) { UI.openSheet('login'); return; }
  const f = ACT[el.dataset.act]; if (f) f(el, e);
}
const corner = back => `<div class="corner l">${back ? `<button class="chip" data-act="${back}">‹ ${t('back')}</button>` : ''}</div><div class="corner"><button class="chip" data-act="lang">${VP.lang() === 'pt' ? '🇧🇷 PT' : '🇺🇸 EN'}</button><button class="chip" data-act="mute">${VP.Audio.muted ? '🔇' : '🔊'}</button></div>`;
const foot = () => `<div class="foot"><a href="${IG}" target="_blank" rel="noopener">📸 ${t('follow')} @mimo.mimosa.morticia</a><br>${t('fan')}</div>`;

// ---------- title ----------
// Layout: logo on top, ONE big play button, an icon dock at the bottom; everything else lives in two sheets (Meu Gato, Mais).
// Other modules add to the title through markers: <!--vp:toast--> (small pill), <!--vp:look--> (small card), <!--vp:story--> (inside "Mais"),
// plus VP.Ext.slot('title') (inside "Mais").
const lvTop = () => { try { return Math.max(1, ...VP.Prog.CATS.map(n => VP.Prog.level(n).lv)); } catch (e) { return 1; } };
const acctChip = () => (VP.Acct && VP.Acct.status === 'in'
  ? `<button class="acct in" data-act="account" aria-label="${esc(t('account'))}"><span class="av">🐱</span><span class="lvb">${t('pg_lv')} ${lvTop()}</span></button>`
  : `<button class="acct" data-act="account" aria-label="${esc(t('tl_enter'))}"><span class="av">👤</span><span>${t('tl_enter')}</span></button>`);
const dock = (act, ic, label, extra) => `<button class="dk ${extra && extra.cls || ''}" data-act="${act}"><span class="ic">${ic}</span><span class="lb">${label}</span>${extra && extra.badge ? `<small class="newtag">${extra.badge}</small>` : ''}</button>`;
const tile = (act, ic, label, extra) => `<button class="si ${extra || ''}" data-act="${act}"><span class="ic">${ic}</span><span class="lb">${label}</span></button>`;
const sheet = (id, title, body) => `<div class="sheet-wrap" data-sheet="${id}"><div class="scrim" data-act="sheetClose"></div><div class="sheet" role="dialog" aria-label="${esc(title)}"><i class="grab"></i><button class="x" data-act="sheetClose" aria-label="${esc(t('back'))}">✕</button><h3 class="sh-t">${title}</h3>${body}</div></div>`;
function catSheet() {
  const has = !!VP.S.avatar, Pa = VP.Party;
  return sheet('cat', '🐱 ' + t('tl_mycat'), `<div class="sgrid">${tile(has ? 'party' : 'myCat', '🐱', has ? (Pa && Pa.active && Pa.active() ? t('pa_on', esc(VP.S.avatar.label || '')) : t('pa_title')) : t('ac_create'), 'hot')}
    ${tile('wardrobe', '👕', t('wardrobe'))}${tile('profile', '🪪', t('pf_title'))}${tile('upg', '⬆', t('pg_up'))}${tile('ach', '🏅', t('ah_title'))}${tile('shelter', '🏠', t('lg_shelter'))}</div>`);
}
function moreSheet() {
  return sheet('more', '✨ ' + t('tl_more'), `<!--vp:story--><div class="sgrid">${VP.Ext ? VP.Ext.slot('title') /* [hook:ext] */ : ''}${tile('rank', '🏆', t('ranking'))}${tile('world', '✈', t('world'))}${tile('board', '📌', t('bd_title'))}${tile('catcity', '🐱', t('gc_title'))}${tile('how', '❓', t('how'))}${tile('settings', '⚙', t('settings'))}</div>${foot()}`);
}
function loginSheet() {
  return sheet('login', '🐾 ' + t('tl_loginT'), `<p class="small lg-sub">${t('tl_loginSub')}</p>
    <button class="btn big" data-act="loginGo">👤 ${t('tl_enter')}</button>
    <button class="btn ghost" data-act="guestPlay">${t('tl_guest')}</button>
    <p class="small lg-note">${t('tl_guestNote')}</p>`);
}
SCREENS.title = {
  hideHud: true,
  html: () => `<div class="bg"${bg('title_bg')}></div><div class="shade"></div>
    <div class="tbar"><div class="tl"><button class="ib" data-act="settings" aria-label="${esc(t('settings'))}">⚙</button><button class="ib" data-act="lang" aria-label="${esc(t('lang'))}">${VP.lang() === 'pt' ? '🇧🇷' : '🇺🇸'}</button><button class="ib" data-act="mute" aria-label="${esc(t('sound'))}">${VP.Audio.muted ? '🔇' : '🔊'}</button></div><div class="tr">${acctChip()}</div></div>
    <div class="top"><h1 class="logo">VICE<span>PAWS</span></h1><p class="tag">${t('tagline')}</p></div>
    <div class="art"></div>
    <div class="in"><!--vp:toast--><!--vp:look-->
      <button class="btn big play" data-act="play">▶ ${VP.S.unlocked > 1 || VP.S.pos ? t('cont') : t('play')}</button>
      <div class="chips">${UI.challenge ? `<button class="dailybar chal" data-act="chalPlay">⚔️ <span><b>${esc(UI.challenge.name || t('ch_friend'))}</b> ${t('ch_dares', UI.challenge.score)}<small>${esc(VP.mname(M.get(UI.challenge.n)))}</small></span><i>▶</i></button>` : ''}${dailyBar()}</div>
      <nav class="dock">${dock('map', '🗺', t('tl_missions'))}${dock('shop', '🛍', t('tl_shop'), { cls: 'gold' })}${dock('sheetCat', '🐱', t('tl_mycat'))}${dock('online', '🌐', t('tl_online'), { badge: t('on_new') })}${dock('sheetMore', '☰', t('tl_more'))}</nav></div>
    ${catSheet()}${moreSheet()}${loginSheet()}`,
  after: () => { const el = $('#s-title'); if (el && UI.sheet) el.dataset.open = UI.sheet; },
};
// sheets (Meu Gato, Mais, login) toggle a data attribute, so opening one never re-renders the title
UI.sheet = null;
UI.openSheet = id => { UI.sheet = id; const el = root && root.querySelector('#s-title'); if (el) { if (id) el.dataset.open = id; else delete el.dataset.open; } };
ACT.sheetCat = () => UI.openSheet('cat');
ACT.sheetMore = () => UI.openSheet('more');
ACT.sheetClose = () => UI.openSheet(null);
// JOGAR: a player who is not signed in is offered "Entrar" or "Jogar como visitante" (at most once a day once they chose guest)
const today = () => new Date().toISOString().slice(0, 10);
UI.needLogin = () => { const A = VP.Acct; if (!A || A.status === 'in' || A.status === 'offline' || A.status === 'unknown') return false; return VP.ls.get('vp_guest') !== today(); };
ACT.loginGo = () => { UI.openSheet(null); UI.show('account'); };
ACT.guestPlay = () => { VP.ls.set('vp_guest', today()); UI.openSheet(null); ACT.play(); };
ACT.haptic = () => { const off = VP.ls.get('vp_haptic') === '0'; VP.ls.set('vp_haptic', off ? '1' : '0'); if (off) VP.haptic(30); UI.relabel(); };
ACT.lang = () => VP.setLang(VP.lang() === 'pt' ? 'en' : 'pt');
ACT.mute = () => { VP.Audio.toggleMute(); UI.relabel(); };
ACT.title = () => { endGame(); VP.Audio.music(6); UI.show('title'); };
ACT.play = () => { if (!VP.S.tut && VP.S.unlocked <= 1 && !VP.totalStars() && M._.TYPES.tutorial) { UI.startTutorial(); return; } if (G && G.W && G.W.real) UI.tour(G.W.real.id); else UI.free(); };
ACT.daily = () => UI.show('daily');
function dailyBar() {
  const st = M.dailyState(), n = st.done.filter(Boolean).length, ev = M.weekly();
  return `<button class="dailybar" data-act="daily">🎯 <span><b>${t('daily')}</b> ${n}/3${ev ? `<small>${ev.icon || '🎉'} ${esc(ev.name[VP.lang() === 'pt' ? 'pt' : 'en'])}</small>` : ''}</span><i>${[0, 1, 2].map(i => (st.done[i] ? '★' : '☆')).join('')}</i></button>`;
}
// ---------- daily challenges + weekly event ----------
SCREENS.daily = {
  hideHud: true,
  html: () => {
    const st = M.dailyState(), ev = M.weekly(), L = VP.lang() === 'pt' ? 'pt' : 'en';
    return `${corner('back')}<div class="wrap narrow" style="margin-top:46px"><h2 class="gold">🎯 ${t('daily')}</h2><p class="small">${t('dc_sub')}</p>
      ${st.list.map(c => { const m = M.get(c.n) || M.list[0], done = st.done[c.i]; return `<div class="mrow ${done ? 'done' : ''}"><div style="flex:1"><b>${esc(VP.mname(m))}</b><br><span class="small">${t('dc_' + c.goal, U.fmtTime(M.par(m)))} · 🪙 ${c.reward}</span></div>${done ? `<span class="okb">✔ ${t('dc_ok')}</span>` : `<button class="btn sm" data-act="brief" data-n="${m.n}">▶ ${t('dc_go')}</button>`}</div>`; }).join('')}
      <p class="small">🔥 ${t('dc_streak', VP.S.streak ? VP.S.streak.n : 0)} · ${t('dc_reset')}</p>
      ${ev ? `<div class="panel t"><b>${ev.icon || '🎉'} ${t('wk_title')}: ${esc(ev.name[L])}</b><p class="small">${esc(ev.desc[L])} · ${t('wk_left', ev.endsIn)}</p></div>` : ''}
      <button class="btn ghost" data-act="back">${t('back')}</button>${foot()}</div>`;
  },
};
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
    <div class="sw"><span>${t('fpsShow')}</span><button class="tab ${VP.ls.get('vp_fps') === '1' ? 'on' : ''}" data-act="fps">${VP.ls.get('vp_fps') === '1' ? t('on') : t('off')}${VP.R3 && VP.R3.ok ? ' · ' + VP.R3.fps + ' fps' : ''}</button></div>
    <div class="sw"><span>${t('sound')}</span><button class="tab on" data-act="mute">${VP.Audio.muted ? t('off') : t('on')}</button></div>
    <div class="sw"><span>📳 ${t('haptic')}</span><button class="tab on" data-act="haptic">${VP.ls.get('vp_haptic') === '0' ? t('off') : t('on')}</button></div>
    <div class="sw"><span>${t('lang')}</span><button class="tab on" data-act="lang">${VP.lang() === 'pt' ? 'Português' : 'English'}</button></div>
    ${VP.Shop.has('season') ? `<div class="sw"><span>🎄 ${t('xmasOn')}</span><button class="tab on" data-act="xmas">${VP.S.xmas ? t('on') : t('off')}</button></div>` : ''}
    <div class="sw"><span>${t('tu_replay')}</span><button class="tab" data-act="tutorial">🎓</button></div>
    <div class="sw"><span>${t('restore')}</span><button class="tab" data-act="restore">🔑</button></div>
    <div class="sw" style="border:0"><span>${t('resetSave')}</span><button class="tab" data-act="reset">🗑</button></div></div>
    <button class="btn" data-act="back">${t('back')}</button>${foot()}</div>`; },
};
ACT.q = el => { const v = el.dataset.v; if (v === 'a') { VP.ls.set('vp_quality', ''); } else if (VP.R3) VP.R3.setQuality(+v); UI.relabel(); };
ACT.fps = () => { VP.ls.set('vp_fps', VP.ls.get('vp_fps') === '1' ? '0' : '1'); UI.relabel(); };
ACT.tutorial = () => UI.startTutorial();
ACT.xmas = () => { VP.S.xmas = !VP.S.xmas; VP.persist(); UI.relabel(); };
ACT.reset = () => { if (confirm(t('resetAsk'))) { VP.resetSave(); endGame(); UI.show('title'); } };
ACT.restore = () => VP.Shop.restorePrompt();

// ---------- missions map ----------
SCREENS.map = {
  hideHud: true,
  html: () => {
    const d = UI.tab, D = M.DIST[d], list = M.list.filter(m => m.d === d), locked = D.grant && !VP.Shop.has(D.grant), L = VP.lang() === 'pt' ? 'pt' : 'en';
    const done = list.filter(m => VP.S.stars[m.n]).length, st = list.reduce((a, m) => a + (VP.S.stars[m.n] || 0), 0);
    const grp = x => (x.arc ? 1 : x.grant ? 2 : 0), g = grp(D), closed = D.arc && !M.distOpen(D) && !M.allOpen;
    const dcount = x => M.list.filter(m => m.d === x.id && VP.S.stars[m.n]).length;
    return `${corner('back')}<div class="wrap" style="margin-top:46px"><h2 class="teal">${t('map')} <small class="cnt">${M.list.filter(m => VP.S.stars[m.n]).length}/${M.list.length}</small></h2>
      <div class="row grp">${[['story', 0], ['chapters', 1], ['bonusTab', 2]].map(([k, i]) => `<button class="tab ${g === i ? 'on' : ''}" data-act="tab" data-d="${M.DIST.find(x => grp(x) === i).id}">${['📖', '🧶', '👑'][i]} ${t(k)}</button>`).join('')}</div>
      <div class="tabs">${M.DIST.filter(x => grp(x) === g).map(x => `<button class="tab ${x.id === d ? 'on' : ''} ${x.grant === 'vip' ? 'vip' : x.grant ? 'sea' : ''}" data-act="tab" data-d="${x.id}">${x.grant === 'vip' ? '👑 ' : x.grant ? '🎄 ' : x.arc && !M.distOpen(x) && !M.allOpen ? '🔒 ' : ''}${t('d' + x.id)}${x.arc && dcount(x) === 10 ? ' ✔' : ''}</button>`).join('')}</div>
      <div class="dhead" style="background:${D.col ? 'linear-gradient(120deg,' + D.col + ')' : DCOL[d % DCOL.length]}"><b>${t('d' + d)}</b><span>${done}/${list.length} · ${st}⭐ / ${list.length * 3}</span>${D.intro ? `<p>${esc(D.intro[L])}</p>` : ''}</div>
      ${closed ? `<div class="mrow">🔒 <div style="flex:1">${t('ch_need', D.req.stars, VP.totalStars())}</div></div>` : ''}
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
const NEED = { stealth: ['morticia'], kittens: 'all', duel: ['mimosa', 'mimo'], escort: ['mimosa', 'mimo'], heist: ['mimo'], fish: null, volley: null, kites: null, photo: null, chain: null, parkour: null, reach: null, waves: null, eat: ['morticia'], steal: ['morticia'], cash: ['mimosa', 'morticia'], rescue: 'all', truck: 'gate', vault: 'all', escape: null, chase: ['mimo'], race: null, defend: ['mimosa', 'mimo'], boss: 'all' };
const GATECAT = { fence: 'mimosa', switch: 'mimo', gap: 'morticia', key: 'morticia' };
SCREENS.brief = {
  cls: 'glass', hideHud: true,
  html: n => {
    const m = M.get(n), D = M.DIST[m.d];
    let need = m.side ? null : NEED[m.type]; const L = VP.lang() === 'pt' ? 'pt' : 'en', LI = L === 'pt' ? 1 : 2; if (need === 'gate') need = [GATECAT[m.p.gate]]; if (need === 'all') need = ['mimo', 'mimosa', 'morticia'];
    const hero = m.boss ? (art('boss_' + (m.d + 1)) || art('title_bg')) : m.d === 6 ? art('shop_season') : m.d === 5 ? art('shop_vip') : art('title_bg');
    const best = VP.S.best[n];
    return `${corner(G ? 'closeBrief' : 'map')}<div class="wrap narrow" style="margin-top:46px">
      <div class="hero" style="background-image:url('${hero}');${m.boss ? 'box-shadow:inset 0 0 0 3px #ffd23f,0 0 30px #ffd23f66' : ''}"><div class="cap"><span>${m.boss ? '👑 ' + t('bossM') + ' · ' : ''}${m.tourCity ? '✈ ' + esc(VP.CityCache[m.tourCity].real.name).toUpperCase() : t('d' + m.d).toUpperCase() + ' · ' + (m.side ? '🏁 ' + t('trial') : t('mission').toUpperCase() + ' ' + (m.bonus ? '★' + (m.n - D.from + 1) : m.n))}</span><b>${esc(VP.mname(m))}</b></div></div>
      <div class="panel">${(m.talk || []).map(l => `<div class="talk">${art('portrait_' + l[0]) ? `<img src="${art('portrait_' + l[0])}" alt="">` : `<span class="pfb">${{ mimo: '😴', mimosa: '😾', morticia: '😋' }[l[0]]}</span>`}<p><b>${t(l[0])}</b> “${esc(l[LI])}”</p></div>`).join('')}<p>${m.tourCity ? esc(m.story ? m.story[L] : t('b_tour')) + '<br><span class="small">' + t('bk_' + m.p.kind) + '</span>' : t(m.side ? 'b_trial' : 'b_' + m.type)}</p>${m.boss ? `<p class="small">💡 ${t('bossTip')}</p>` : ''}
        ${need ? `<div class="need">${need.map(c => `<img src="${art('portrait_' + c)}" alt="">`).join('')}<div><b>${need.length === 3 ? t('need_all') : need.map(c => t('need_' + c)).join(' · ')}</b></div></div>` : ''}
        <p class="small">⏱ ${t('par')}: ${U.fmtTime(M.par(m))}${m.p.time ? ' · ⌛ ' + U.fmtTime(m.p.time) : ''} ${best ? ' · ' + t('best') + ': ' + best : ''} ${VP.S.stars[n] ? ' · ' + stars(VP.S.stars[n]) : ''}</p></div>
      ${UI.challenge && UI.challenge.n === n ? `<p class="small gold">⚔️ ${t('ch_beat', esc(UI.challenge.name || t('ch_friend')), UI.challenge.score)}</p>` : ''}
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
    ${G && !G.free ? `<p><b>${esc(VP.mname(G.m))}</b><br><span class="small">${esc(M.objective(G).txt)}</span></p>` : `<p class="small">${G && G.online ? esc(M.objective(G).txt) : t('o_free')}</p>`}
    <button class="btn big" data-act="resume">▶ ${t('resume')}</button>
    <div class="grid2">${G && G.online ? `<button class="btn ghost sm wide" data-act="onLeave">🚪 ${t('on_leave')}</button>` : G && G.free && VP.Online ? `<button class="btn teal sm wide" data-act="online">🌐 ${t('on_title')}</button>` : ''}${G && !G.free ? `<button class="btn ghost sm" data-act="restart">↻ ${t('restart')}</button><button class="btn ghost sm" data-act="quit">🌴 ${t('quit')}</button>` : `<button class="btn teal sm" data-act="map">🗺 ${t('map')}</button><button class="btn gold sm" data-act="shop">🛍 ${t('shop')}</button>`}
    <button class="btn ghost sm" data-act="world">✈ ${t('world')}</button><button class="btn ghost sm" data-act="account">👤 ${t('account')}</button>
    <button class="btn ghost sm" data-act="how">❓ ${t('how')}</button><button class="btn ghost sm" data-act="settings">⚙ ${t('settings')}</button>
    <button class="btn ghost sm" data-act="wardrobe">👕 ${t('wardrobe')}</button><button class="btn ghost sm" data-act="title">🏠 Menu</button></div></div>`,
};
ACT.resume = () => { UI.hide(); UI.paused = false; VP.Audio.pause(false); };
ACT.restart = () => (G.tutorial ? UI.startTutorial() : UI.startMission(G.m.n));
ACT.quit = () => (G && G.tutorial ? UI.endTutorial(true) : ACT.play());

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
      ${r.chal ? `<p class="small ${r.chal.won ? 'gold' : ''}">⚔️ ${t(r.chal.won ? 'ch_won' : 'ch_lost', esc(r.chal.name || t('ch_friend')), r.chal.score)}</p>` : ''}
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
  if (m.type === 'tutorial') { UI.endTutorial(); return; }
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
    const wk = M.weeklyBonus(r); if (wk && wk.coins > 0) { S.cash += wk.coins; r.rewards.push((wk.ev.icon || '🎉') + ' ' + t('wk_bonus', wk.coins)); }
    for (const line of M.dailyCheck(r)) r.rewards.push('🎯 ' + line);
    if (VP.Prog) VP.Prog.onResult(r, G);
    const ch = UI.challenge; if (ch && ch.n === m.n) { r.chal = { name: ch.name, score: ch.score, won: r.score > ch.score }; if (r.chal.won) UI.challenge = null; }
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
    <div class="panel t"><p class="small">${t('rk_all')}</p><p class="small">${t('yourName')} · 🎯 ${doneCount()} · ⭐ ${mainStars()} · ${mainScore()} pts</p><div class="row" style="flex-wrap:nowrap"><input class="txt" id="nick" maxlength="12" value="${esc(VP.S.name || '')}" placeholder="Mimo"><button class="btn sm" data-act="sendScore">${t('send')}</button></div></div>
    <button class="btn ghost" data-act="back">${t('back')}</button>${foot()}</div>`,
  after: () => loadRank(),
};
// the ranking counts every mission: story, chapters, bonus districts, time trials and World Tour cities
const mainStars = () => VP.totalStars();
const mainScore = () => VP.totalScore();
const doneCount = () => Object.values(VP.S.stars).filter(v => v > 0).length;
UI.mainStars = mainStars; UI.mainScore = mainScore; UI.doneCount = doneCount; UI.last = () => lastResult;
const mainLevel = () => { let l = 0; for (let n = 1; n <= 50; n++) if (VP.S.stars[n]) l = n; return l; };
function drawRank(top) {
  const ol = $('#rk'); if (!ol) return;
  if (!top || !top.length) { ol.innerHTML = `<li>${t('rankEmpty')}</li>`; return; }
  const me = (VP.S.name || '').toLowerCase();
  ol.innerHTML = top.map((r, i) => { const vip = r.vip || (me && String(r.name).toLowerCase() === me && VP.Shop.has('vip')), sup = me && String(r.name).toLowerCase() === me && VP.Shop.has('supporter'); return `<li class="${String(r.name).toLowerCase() === me ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="nm ${vip || sup ? 'gold-name' : ''}">${vip ? '👑 ' : ''}${esc(r.name)}${sup ? ' 💖' : ''}</span><span class="small">${r.missions ? '🎯' + r.missions : 'M' + r.level} · ${r.stars}⭐</span><span class="sc">${r.score}</span></li>`; }).join('');
}
function loadRank() {
  fetch('/api/scores', { cache: 'no-store' }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => drawRank(j.top)).catch(() => { const ol = $('#rk'); if (ol) ol.innerHTML = `<li>${t('rankOff')}</li>`; });
}
ACT.sendScore = () => {
  const inp = $('#nick'), name = (inp.value || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 12);
  if (!name) { inp.focus(); return; }
  if (VP.Acct && VP.Acct.minorBlock && VP.Acct.minorBlock()) { UI.toast(t('ac_guardBlock'), 3500); return; }
  VP.S.name = name; VP.persist();
  const level = Math.max(1, mainLevel()), missions = doneCount(); if (!missions) { UI.toast(t('rankEmpty')); return; }
  fetch('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, score: mainScore(), level, missions, stars: mainStars(), vip: VP.Shop.has('vip') }) })
    .then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => { UI.toast(t('sent')); drawRank(j.top); }).catch(() => UI.toast(t('rankOff'), 3000));
};
// ---------- no webgl ----------
SCREENS.nowebgl = { cls: 'center', hideHud: true, html: () => `<div class="wrap narrow"><h1 class="logo">VICE<span>PAWS</span></h1><div class="panel" style="margin-top:20px;text-align:center"><p>😿 ${t('noWebgl')}</p><p class="small">${t('openOut')}</p></div><a class="btn" href="${IG}" target="_blank" rel="noopener">📸 ${t('follow')}</a>${foot()}</div>` };

// ---------- game flow ----------
function endGame() { tutSkip(false); if (VP.Online) VP.Online.left(); if (G) { Game.end(); G = null; } UI.state = 'menu'; UI.paused = false; }
function begin(g) {
  G = g; UI.state = 'play'; UI.paused = false; UI.hide();
  if (VP.R3 && VP.R3.ok) { VP.R3.attach(G); VP.R3.snapCamera(-Math.PI / 2); }
  I.reset(); I.enabled = true; VP.Audio.unlock(); VP.Audio.pause(false);
}
UI.begin = function (make) { endGame(); begin(make()); };   // for modes that build their own world (Cidade Online): end first, then build
UI.free = function (pos, keep, opts) {
  if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; }
  const p = pos || (G && !G.trial && G.cats && !G.W.real ? { x: G.cats[G.active].x, y: G.cats[G.active].y } : VP.S.pos);
  endGame(); begin(M.startFree(p, opts)); void keep;
  UI.songD = -1;
};
UI.tour = function (id) { if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; } if (!VP.CityCache[id]) return; endGame(); begin(M.startTour(id)); if (VP.R3.arrive) VP.R3.arrive(); const meta = VP.CityCache[id].meta; VP.Audio.music(UI.citySong(id)); UI.songD = -2; Game.fx.say(meta.hometown ? '💛 ' + t('wt_homeHello', VP.CityCache[id].real.name.split(' — ')[0]) : '✈ ' + VP.CityCache[id].real.name, '#ffd23f', meta.hometown ? 4.5 : 3); };
// walking across to a neighbour tile of the same city: no flight, the cats arrive at the matching spot on the other side
UI.tourTile = function (id, at) { if (!VP.CityCache[id]) return; endGame(); begin(M.startTour(id, { at })); VP.Audio.music(UI.citySong(id)); UI.songD = -2; Game.fx.say('🗺 ' + VP.CityCache[id].real.name, '#ffd23f', 2.4); };
UI.citySong = id => (id === 'rioverde' ? 7 : [0, 1, 2, 3, 4, 2, 6][(VP.CityCache[id] && VP.CityCache[id].meta.mood) || 0]);
UI.startMission = function (n) {
  if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; }
  const m = M.get(n); if (!m || !(M.unlocked(m) || (UI.challenge && UI.challenge.n === n))) return;
  endGame(); begin(M.start(m));
  if (m.talk && m.talk[0]) setTimeout(() => { if (G && G.m === m && !G.over) Game.fx.say(t(m.talk[0][0]) + ': “' + m.talk[0][VP.lang() === 'pt' ? 1 : 2] + '”', '#ffd23f', 4.2); }, 2700);
  VP.Audio.music(m.boss ? 5 : m.tourCity ? UI.citySong(m.tourCity) : M.DIST[m.d].song);
  if (m.boss) { VP.Audio.sfx('boss'); Game.fx.say(t('boss_' + m.boss).toUpperCase() + '!', '#ffd23f', 3); } else Game.fx.say(VP.mname(m), '#fff', 2.6);
};
// ---------- first-play tutorial ----------
M.tutorial = { n: -1, d: 0, geo: 0, type: 'tutorial', name: ['Treino', 'Training'], p: {}, lv: 1, par: 60, hunger: 0.2, boss: null, bonus: true, side: true };
const tutSkip = on => { let el = document.getElementById('tutskip'); if (!on) { if (el) el.remove(); return; } if (!el) { el = document.createElement('button'); el.id = 'tutskip'; el.className = 'chip'; el.addEventListener('click', () => UI.endTutorial(true)); document.body.appendChild(el); } el.textContent = '⏭ ' + t('tu_skip'); };
UI.startTutorial = function () {
  if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; }
  endGame(); begin(M.start(M.tutorial)); VP.Audio.music(0); tutSkip(true);
};
UI.endTutorial = function (skipped) {
  if (G && G.tutLives !== undefined) VP.S.lives = Math.max(G.tutLives, 3);
  VP.S.tut = 1; VP.persist(); tutSkip(false);
  if (!skipped) { UI.confetti(); }
  UI.free();
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
      if (G && G.free && !G.tour) { const d = VP.World.distAt(G.W, G.cats[G.active].x, G.cats[G.active].y); if (d !== UI.songD) { UI.songD = d; VP.Audio.music(M.DIST[VP.World.baseOf(d)].song); } }
    }
    if (G && G.over) { G.real += dt; for (const c of G.cats) c.t += dt; }
  }
  if (VP.Online) VP.Online.update(dt); // remote cats keep moving while a menu is open
  if (R3 && R3.ok) { const full = UI.screen && SCREENS[UI.screen] && SCREENS[UI.screen].hideHud && !SCREENS[UI.screen].cls && R3.mode !== 'stage'; if (!full || R3.mode === 'stage') R3.render(G, dt); }
  VP.HUD.draw(G && UI.state === 'play' ? G : null, dt);
}

VP.DATA = {};
UI.boot = function () {
  const files = ['missions', 'items', 'outfits', 'activities', 'cities/index', 'citypacks', 'events'];
  Promise.all(files.map(f => fetch('data/' + f + '.json').then(r => r.json()))).then(d => {
    files.forEach((f, i) => { VP.DATA[f] = d[i]; });
    M.load(d[0], d[3]); M.loadCities(d[4]); M.loadPacks(d[5]); M.loadEvents(d[6]); if (VP.Wardrobe) VP.Wardrobe.load(d[2]);
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
  const startGfx = () => { if (VP.R3 && !VP.R3.ok && !UI.gfxTried) { UI.gfxTried = true; let ok = false; try { ok = VP.R3.init(document.getElementById('gl')); } catch (e) { ok = false; console.warn('gfx', e); } if (!ok) { UI.noGfx = true; UI.show('nowebgl'); } } };
  if (VP.R3) startGfx(); else addEventListener('vp-gfx', startGfx);
  if (VP.Share) VP.Share.boot();
  UI.ready = true;
  if (VP.Acct) VP.Acct.init();
  requestAnimationFrame(frame);
}
// ---------- test hooks ----------
window.__vp = {
  VP, get G() { return G; }, start: n => UI.startMission(n), free: p => UI.free(p), win: () => Game.win(), fail: w => Game.fail(w || 'time'),
  unlockAll: () => { VP.S.unlocked = 51; M.allOpen = true; VP.persist(); }, state: () => ({ screen: UI.screen, state: UI.state, paused: UI.paused, mission: G ? G.m.n : null, step: G ? G.step : -1, over: G ? G.over : null }),
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', UI.boot); else UI.boot();
})();
