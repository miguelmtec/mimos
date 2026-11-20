'use strict';
// VICE PAWS — accounts client: Sign in with Google + e-mail code login, age step / guardian approval, "Meus gatos" creator (parametric cat), cloud save, public gallery
(function () {
const VP = window.VP, UI = VP.UI, t = (...a) => VP.t(...a);
const A = VP.Acct = { user: null, cats: [], status: 'unknown', gallery: [], email: '' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = (path, method, body) => fetch(path, { method: method || 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  .then(async r => Object.assign({ status: r.status }, await r.json().catch(() => ({})))).catch(() => ({ status: 0, error: 'network' }));
A.api = api;
const BREEDS = ['persa', 'siames', 'vira-lata', 'srd', 'maine-coon', 'sphynx', 'angora', 'bengal', 'ragdoll', 'british', 'sem-raca', 'outro'];
const FACES = ['round', 'flat', 'wedge', 'square', 'long'], PATTERNS = ['solid', 'tabby', 'spotted', 'tuxedo', 'bicolor', 'calico', 'tortie', 'pointed'];
const EARS = ['pointy', 'big', 'round', 'fold', 'tuft'], TAILS = ['long', 'fluffy', 'short', 'bob', 'curl'], ROLES = ['shooter', 'biter', 'glutton'];
// real coat and eye colours, one tap each (the colour picker stays for anything else)
const FURS = ['#17141a', '#3a2e45', '#5b5f6b', '#9aa0a8', '#c9ced6', '#ffffff', '#f7ead0', '#e8c9a0', '#d9a066', '#f28a2e', '#b5642a', '#6b4326', '#8a8f6a'];
const EYES = ['#7bc86c', '#3fae6a', '#f2b01e', '#ffc928', '#c98f4b', '#3fa9f5', '#8fd3ff', '#b9a6d9'];
// starting points: tap one, then fine-tune
const LOOKS = { frajola: { pattern: 'tuxedo', furBase: '#17141a', patchColors: ['#ffffff'], eyeColor: '#f2b01e' }, laranja: { pattern: 'tabby', furBase: '#f28a2e', patchColors: ['#b5642a'], eyeColor: '#7bc86c' }, tigrado: { pattern: 'tabby', furBase: '#9aa0a8', patchColors: ['#5b5f6b'], eyeColor: '#7bc86c' },
  siames: { pattern: 'pointed', furBase: '#f7ead0', patchColors: ['#5a4030'], eyeColor: '#3fa9f5', faceShape: 'wedge', furLength: 0.15, ears: 'big' }, tricolor: { pattern: 'calico', furBase: '#ffffff', patchColors: ['#f28a2e', '#17141a'], eyeColor: '#f2b01e' }, escaminha: { pattern: 'tortie', furBase: '#2b1f24', patchColors: ['#f28a2e', '#b5642a'], eyeColor: '#ffc928' },
  preto: { pattern: 'solid', furBase: '#17141a', patchColors: [], eyeColor: '#ffc928' }, branco: { pattern: 'solid', furBase: '#ffffff', patchColors: [], eyeColor: '#3fa9f5' }, persa: { pattern: 'solid', furBase: '#f7ead0', patchColors: [], eyeColor: '#c98f4b', faceShape: 'flat', furLength: 0.9, tail: 'fluffy' }, bengal: { pattern: 'spotted', furBase: '#d9a066', patchColors: ['#6b4326'], eyeColor: '#3fae6a', furLength: 0.15 } };
const ACCS = ['collar', 'bell', 'bow', 'bowtie', 'bandana', 'scarf', 'sunglasses', 'glasses', 'hat', 'cap', 'crown', 'flower', 'chain'];
const ACC_ICON = { collar: '📿', bell: '🔔', bow: '🎀', bowtie: '🤵', bandana: '🧣', scarf: '🧣', sunglasses: '🕶', glasses: '👓', hat: '🎩', cap: '🧢', crown: '👑', flower: '🌼', chain: '⛓' };
const light = hex => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
// server Spec -> buildCat() spec
A.toSpec = function (s) {
  s = s || {}; const pc = s.patchColors || [], acc = {}, a = s.accessories || [];
  if (a.includes('collar')) acc.collar = '#ff4fb8'; if (a.includes('chain')) acc.collar = '#ffd23f'; if (a.includes('bell')) { acc.collar = acc.collar || '#e01e37'; acc.bell = '#ffd23f'; }
  if (a.includes('bow')) acc.bow = '#ff3fa4'; if (a.includes('flower')) acc.bow = '#ffd23f'; if (a.includes('bowtie')) acc.bowtie = '#17101c';
  if (a.includes('bandana')) acc.scarf = '#2de2e6'; if (a.includes('scarf')) acc.scarf = '#e01e37';
  if (a.includes('sunglasses')) acc.glasses = '#17101c'; else if (a.includes('glasses')) acc.glasses = '#8ff3ff';
  if (a.includes('hat')) acc.hat = '#17101c'; if (a.includes('cap')) acc.hat = '#2de2e6'; if (a.includes('crown')) { acc.crown = '#ffd23f'; delete acc.hat; }
  const tortie = s.pattern === 'tortie', fur = s.furBase || '#d9a066', pat = { bicolor: 'tuxedo', pointed: 'points', tortie: 'calico' }[s.pattern] || s.pattern || 'solid';
  const fl = typeof s.furLength === 'number' ? s.furLength * 1.4 : (s.faceShape === 'flat' ? 1 : 0.6);
  return { size: Math.max(0.6, Math.min(1.2, (s.size || 1) * 0.92)), fur, fur2: pat === 'tuxedo' ? (pc[0] || '#ffffff') : tortie ? fur : light(fur), pattern: pat, patchA: pc[0] || (pat === 'points' ? '#5a4030' : pat === 'spotted' || pat === 'tabby' ? shade(fur) : '#f28a2e'), patchB: pc[1] || pc[0] || '#2b1f24',
    eye: s.eyeColor || '#7bc86c', eye2: s.eyeColor2 || undefined, earIn: '#f4a9b8', face: s.faceShape === 'flat' ? 'flat' : 'round', headShape: s.faceShape || 'round', fluff: fl, ears: s.ears || 'pointy', tail: s.tail || (fl > 1 ? 'fluffy' : 'long'), acc };
};
const shade = hex => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * 0.62).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
const blank = () => ({ name: '', breed: 'vira-lata', bio: '', instagram: '', isPublic: true, spec: { size: 1, faceShape: 'round', furBase: '#d9a066', pattern: 'solid', patchColors: ['#ffffff', '#2b1f24'], eyeColor: '#7bc86c', accessories: [] } });

// ---------- boot + cloud save ----------
A.init = async function () {
  api('/api/auth/config').then(c => { if (c.status === 200 && c.googleClientId) { A.googleId = c.googleClientId; if (UI.screen === 'account') UI.show('account'); } });
  const me = await api('/api/me');
  if (me.status === 200 && me.user) A.accept(me.user, me.cats);
  else A.status = me.status === 401 ? (pending() ? 'awaiting' : 'guest') : 'offline';
  if (UI.screen === 'title' || UI.screen === 'account') UI.relabel();
  A.loadGallery();
};
// A minor waiting for a guardian plays as a guest. The flag only survives a reload (no session exists for them);
// it is a courtesy lock on the client: guests are anonymous by design, the server cannot tell who they are.
const pending = () => { try { return localStorage.getItem('vp_guardian_pending') === '1'; } catch (e) { return false; } };
const setPending = on => { try { on ? localStorage.setItem('vp_guardian_pending', '1') : localStorage.removeItem('vp_guardian_pending'); } catch (e) { } };
A.minorBlock = () => A.status === 'awaiting' || pending();
// a logged-in session: 'in' (complete) or 'age' (the age step is still due: nothing else works until it is given)
A.accept = function (user, cats) {
  A.user = user;
  if (user.needsAge) { A.status = 'age'; A.cats = []; return; }
  A.status = 'in'; A.cats = cats || []; setPending(false); A.pull();
};
A.loadGallery = async function () { const g = await api('/api/cats/public?limit=24'); if (g.status === 200 && Array.isArray(g.cats)) A.gallery = g.cats; };
A.pull = async function () {
  const r = await api('/api/save'); if (r.status !== 200 || !r.data || !r.data.s) return;
  const cloud = r.data, local = VP.S;
  if ((cloud.s.ts || 0) > (local.ts || 0) && cloud.s.stars) { for (const k of Object.keys(local)) delete local[k]; Object.assign(local, cloud.s); VP.persist(true); UI.toast('☁ ' + t('ac_synced')); }
  if (cloud.p && cloud.p.ids) { const P = VP.Shop.P; let ch = false; for (const id in cloud.p.ids) if (!P.ids[id]) { P.ids[id] = cloud.p.ids[id]; ch = true; } for (const g in cloud.p.grants || {}) if (!P.grants[g]) { P.grants[g] = true; ch = true; } if (ch) { VP.ls.set('vp_purchases', JSON.stringify(P)); if (VP.R3.refreshCats) VP.R3.refreshCats(); } }
  if (UI.screen === 'title') UI.relabel();
};
let pushT = null;
A.push = function () { if (A.status !== 'in') return; clearTimeout(pushT); pushT = setTimeout(() => { api('/api/save', 'PUT', { data: { s: VP.S, p: { ids: VP.Shop.P.ids, grants: VP.Shop.P.grants } } }); }, 2500); };
VP.onProgress = () => A.push();

// ---------- account screen ----------
UI.SCREENS.account = {
  hideHud: true,
  html: () => {
    const head = `<div class="corner l"><button class="chip" data-act="back">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="teal">👤 ${t('account')}</h2>`;
    const local = `<button class="btn ghost" data-act="creator" data-i="local">🐱 ${t('ac_create')} (${t('ac_local')})</button>`;
    const priv = `<button class="btn ghost sm" data-act="privacy">🔒 ${t('ac_privacy')}</button>`;
    if (A.status === 'offline' || A.status === 'unknown') return head + `<div class="panel t"><p>${t('ac_offline')}</p></div><button class="btn" data-act="creator" data-i="local">🐱 ${t('ac_create')}</button><button class="btn ghost" data-act="privacy">🔒 ${t('ac_privacy')}</button></div>`;
    if (A.status === 'awaiting') return head + `<div class="panel t" id="gpend"><p><b>⏳ ${t('ac_gwTitle')}</b></p><p>${t('ac_gwTxt')}</p><p class="small">${t('ac_gwGuest')}</p></div>
      <input class="txt" id="gemail" type="email" inputmode="email" placeholder="${t('ac_gwYour')}" value="${esc(A.pendingEmail || '')}" autocomplete="email">
      <div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="acGResend">✉ ${t('ac_resend')}</button><button class="btn ghost sm" data-act="acGTry">${t('ac_gwTry')}</button></div>
      ${local}${priv}</div>`;
    if (A.status === 'age') return head + `<div class="panel t" id="agepanel"><p><b>🎂 ${t('ac_ageTitle')}</b></p><p class="small">${t('ac_ageWhy')}</p>
      <input class="txt" id="abirth" inputmode="numeric" maxlength="7" placeholder="${t('ac_birthPh')}" autocomplete="off">
      <div id="agbox" style="display:none;margin-top:10px"><p class="small">${t('ac_ageGuard')}</p><input class="txt" id="aguard" type="email" inputmode="email" placeholder="${t('ac_gmailPh')}" autocomplete="off"></div>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="acAge">${t('ac_ageOk')}</button></div>
      <p class="small" style="margin-top:10px">🔒 ${t('ac_lgpd')}</p></div>
      <div class="row"><button class="btn ghost sm" data-act="acLogout">${t('ac_logout')}</button>${priv}<button class="btn ghost sm" data-act="acDelete" style="color:#ff6b6b">🗑 ${t('ac_delete')}</button></div></div>`;
    if (A.status !== 'in') {
      const mailMode = A.step === 'email' || A.step === 'code' || !A.googleId;
      return head + `<div class="panel t"><p>${t('ac_why')}</p>
        ${A.googleId ? `<div id="gbtn" style="display:flex;justify-content:center;min-height:44px;margin:10px 0"></div>` : ''}
        ${!mailMode ? `<button class="btn ghost" data-act="acMail">✉ ${t('ac_codeBtn')}</button>`
          : A.step === 'code' ? `<p class="small">${t('ac_sent', esc(A.email))}</p><input class="txt" id="acode" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"><div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="acBackEmail">${t('ac_other')}</button><button class="btn" data-act="acVerify">${t('ac_enter')}</button></div>`
          : `${A.googleId ? `<p class="small" style="text-align:center">${t('ac_or')}</p>` : ''}<input class="txt" id="aemail" type="email" inputmode="email" placeholder="voce@email.com" value="${esc(A.email)}" autocomplete="email"><div class="row" style="margin-top:10px"><button class="btn ${A.googleId ? 'ghost' : ''}" data-act="acStart">✉ ${t('ac_send')}</button></div>`}
        <p class="small" style="margin-top:10px">🔒 ${t('ac_note')}</p></div>
        ${local}${VP.S.avatar ? `<button class="btn teal" data-act="party">🐱 ${t('pa_title')}</button>` : ''}${priv}</div>`;
    }
    const own = A.user.admin ? `<div class="panel t" style="border-color:#ffd23f"><h3 class="gold" style="margin:0 0 6px">👑 ${t('ac_ownTitle')}</h3><p>${t('ac_ownText')}</p><div class="row"><button class="btn gold" data-act="acMimos">🐾 ${t('ac_ownPlay')}</button></div></div>` : '';
    return head + `<div class="panel t"><p class="small">✉ ${esc(A.user.email)} · ☁ ${t('ac_cloud')}</p></div>${own}
      <h3>🐱 ${A.user.admin ? t('ac_otherCats') : t('ac_mycats')} (${A.cats.length}/5)</h3>
      ${A.cats.map((c, i) => `<div class="mrow"><div style="flex:1"><b>${esc(c.name)}</b> <span class="small">· ${esc(c.breed)} ${c.isPublic ? '· 🌍' : '· 🔒'}</span></div><button class="btn ghost sm" data-act="acUse" data-i="${i}">${VP.S.avatarId === c.id ? '✓ ' + t('ac_playing') : t('ac_play')}</button><button class="btn sm" data-act="creator" data-i="${i}">✎</button></div>`).join('')}
      ${A.cats.length < 5 ? `<button class="btn${A.user.admin ? ' ghost sm' : ''}" data-act="creator" data-i="new">＋ ${t('ac_create')}</button>` : ''}
      ${VP.S.avatar ? `<button class="btn teal" data-act="party">🐱 ${t('pa_title')}</button>` : ''}
      <div class="row"><button class="btn ghost sm" data-act="acLogout">${t('ac_logout')}</button><button class="btn ghost sm" data-act="privacy">🔒 ${t('ac_privacy')}</button><button class="btn ghost sm" data-act="acDelete" style="color:#ff6b6b">🗑 ${t('ac_delete')}</button></div></div>`;
  },
  after: () => {
    if (A.status === 'guest') A.gisRender();
    const b = document.getElementById('abirth');
    if (b) b.addEventListener('input', () => {
      const d = b.value.replace(/\D/g, '').slice(0, 6); b.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
      const y = A.parseBirth(b.value), box = document.getElementById('agbox');
      if (box) box.style.display = y && y.age < 18 ? 'block' : 'none';
    });
  },
};
UI.act.account = () => UI.show('account');
UI.act.acBackEmail = () => { A.step = 'email'; UI.show('account'); };
UI.act.acMail = () => { A.step = 'email'; UI.show('account'); };
const errMsg = r => r.status === 503 ? t('ac_offline') : r.status === 429 ? t('ac_rate') : r.error === 'invalid-code' ? t('ac_badcode') : r.status === 401 && r.error === 'invalid-credential' ? t('ac_gerr') : r.status === 502 ? t('ac_goff') : r.status === 422 ? t('ac_mod') : r.status === 400 ? t('ac_invalid') + (r.field ? ' (' + r.field + ')' : '') : r.status === 409 ? t('ac_limit') : t('ac_err');

// ---------- Sign in with Google (Google Identity Services); the button and One Tap only exist on this screen ----------
A.loadGis = function () {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(true);
  A._gis = A._gis || new Promise(ok => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => ok(true); s.onerror = () => { A._gis = null; ok(false); }; document.head.appendChild(s); });
  return A._gis;
};
A.gisRender = async function () {
  if (!A.googleId || !document.getElementById('gbtn')) return;
  if (!(await A.loadGis())) { const b = document.getElementById('gbtn'); if (b) b.innerHTML = `<p class="small">${t('ac_goff')}</p>`; return; }
  const g = window.google.accounts.id, box = document.getElementById('gbtn');
  if (!box || A.status !== 'guest') return;
  if (A._gisId !== A.googleId) { g.initialize({ client_id: A.googleId, callback: r => A.google(r && r.credential), auto_select: false, cancel_on_tap_outside: true }); A._gisId = A.googleId; }
  box.innerHTML = '';
  g.renderButton(box, { type: 'standard', theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', width: 280, locale: VP.lang() === 'en' ? 'en' : 'pt-BR' });
  if (UI.screen === 'account') g.prompt();       // One Tap: only on the account screen
};
A.google = async function (credential) {
  if (!credential) { UI.toast(t('ac_gerr'), 3200); return; }
  A.handleLogin(await api('/api/auth/google', 'POST', { credential, lang: VP.lang() }));
};
A.handleLogin = async function (r) {
  if (r.status === 200 && r.awaitingGuardian) { A.user = null; A.cats = []; A.status = 'awaiting'; setPending(true); A.step = null; UI.show('account'); return; }
  if (r.status === 200 && r.user) {
    A.step = null; const me = r.user.needsAge ? { cats: [] } : await api('/api/me');
    A.accept(Object.assign({}, r.user, (me && me.user) || {}), me.cats); if (A.status === 'in') UI.confetti(); UI.show('account'); if (A.status === 'in') { await A.pull(); A.push(); }
    return;
  }
  if (r.status === 503) { A.status = 'offline'; UI.show('account'); }
  UI.toast(errMsg(r), 3200);
};
UI.act.acStart = async el => {
  const email = (document.getElementById('aemail').value || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { UI.toast(t('ac_invalid')); return; }
  el.disabled = true; const r = await api('/api/auth/start', 'POST', { email, lang: VP.lang() }); el.disabled = false;
  if (r.status === 200) { A.email = email; A.step = 'code'; UI.show('account'); } else { if (r.status === 503) A.status = 'offline'; UI.toast(errMsg(r), 3200); if (r.status === 503) UI.show('account'); }
};
UI.act.acVerify = async el => {
  const code = (document.getElementById('acode').value || '').replace(/\D/g, ''); if (code.length !== 6) return;
  el.disabled = true; const r = await api('/api/auth/verify', 'POST', { email: A.email, code }); el.disabled = false;
  if (r.status === 200 && (r.user || r.awaitingGuardian)) { A.pendingEmail = A.email; await A.handleLogin(r); } else UI.toast(errMsg(r), 3200);
};

// ---------- age step (ECA Digital / LGPD art. 14): birth month/year, once ----------
// "MM/AAAA" -> {birth:'YYYY-MM', age} (age rounded to the protective side, like the server) or null
A.parseBirth = function (v) {
  const m = /^(\d{2})\/(\d{4})$/.exec(String(v || '').trim()); if (!m) return null;
  const mo = +m[1], y = +m[2], now = new Date(), ny = now.getFullYear(), nm = now.getMonth() + 1;
  if (mo < 1 || mo > 12 || y < 1900 || y > ny || (y === ny && mo > nm)) return null;
  return { birth: y + '-' + String(mo).padStart(2, '0'), age: ny - y - (nm <= mo ? 1 : 0) };
};
UI.act.acAge = async el => {
  const b = A.parseBirth((document.getElementById('abirth') || {}).value); if (!b) { UI.toast(t('ac_birthBad')); return; }
  const body = { birth: b.birth };
  if (b.age < 18) { const g = ((document.getElementById('aguard') || {}).value || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(g) || g.toLowerCase() === String((A.user || {}).email).toLowerCase()) { UI.toast(t('ac_guardBad'), 3200); return; } body.guardianEmail = g; }
  el.disabled = true; const r = await api('/api/auth/age', 'POST', body); el.disabled = false;
  if (r.status === 200 && r.awaitingGuardian) { A.pendingEmail = (A.user || {}).email || ''; A.user = null; A.cats = []; A.status = 'awaiting'; setPending(true); UI.show('account'); return; }
  if (r.status === 200) { A.user = Object.assign({}, A.user, { needsAge: false }); const me = await api('/api/me'); A.accept(Object.assign({}, A.user, (me && me.user) || {}), me.cats); UI.confetti(); if (r.band === 'teen') UI.toast(t('ac_teenNote'), 4000); UI.show('account'); await A.pull(); A.push(); return; }
  if (r.status === 409) { A.init(); return; }
  UI.toast(r.status === 400 && r.field === 'guardianEmail' ? t('ac_guardBad') : errMsg(r), 3200);
};
UI.act.acGResend = async el => {
  const email = ((document.getElementById('gemail') || {}).value || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { UI.toast(t('ac_invalid')); return; }
  el.disabled = true; const r = await api('/api/auth/guardian-resend', 'POST', { email }); el.disabled = false;
  UI.toast(r.status === 200 ? t('ac_resent') : errMsg(r), 3500);
};
UI.act.acGTry = () => { A.status = 'guest'; A.step = null; UI.show('account'); };    // "already approved? sign in"
UI.act.acLogout = async () => { await api('/api/auth/logout', 'POST'); A.user = null; A.cats = []; A.status = 'guest'; A.step = null; UI.show('account'); };
UI.act.acDelete = async () => { if (!confirm(t('ac_delAsk'))) return; const r = await api('/api/me', 'DELETE'); if (r.status === 200) { A.user = null; A.cats = []; A.status = 'guest'; A.step = null; VP.S.avatarId = null; setPending(false); UI.toast(t('ac_deleted'), 3000); UI.show('account'); } else UI.toast(errMsg(r)); };
UI.act.acMimos = () => { VP.S.avatar = null; VP.S.avatarId = null; VP.persist && VP.persist(); UI.toast(t('ac_ownOn')); UI.show('title'); };
UI.act.acUse = el => { const c = A.cats[+el.dataset.i]; if (VP.S.avatarId === c.id) { VP.S.avatar = null; VP.S.avatarId = null; } else { VP.S.avatar = Object.assign(A.toSpec(c.spec), { label: c.name }); VP.S.avatarId = c.id; if (VP.Party) VP.Party.S().role = VP.Party.roleSlot(c.spec.role || 'shooter'); } VP.persist(); if (VP.Party) VP.Party.apply(); UI.show('account'); };
UI.SCREENS.privacy = { hideHud: true, html: () => `<div class="corner l"><button class="chip" data-act="account">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="teal">🔒 ${t('ac_privacy')}</h2><div class="panel t">${t('ac_privTxt')}</div><a class="btn ghost" href="privacy.html" target="_blank" rel="noopener">${t('ac_privFull')}</a></div>` };
UI.act.privacy = () => UI.show('privacy');

// ---------- "Cidade dos Gatos": gallery of the cats players registered (public ones), each with a 3D portrait ----------
A.thumbs = {};
const STARS = () => ['mimo', 'mimosa', 'morticia'].map(n => ({ id: 'star_' + n, name: n === 'morticia' ? 'Mortícia' : n[0].toUpperCase() + n.slice(1), breed: 'persa', bio: t('gc_star_' + n), instagram: 'mimo.mimosa.morticia', star: n }));
A.cityCats = function () {
  const mine = VP.S.avatar ? [{ id: 'me', name: VP.S.avatar.label || t('gc_mine'), breed: '', bio: t('gc_mine_bio'), mine: true, built: VP.S.avatar }] : [];
  return mine.concat(A.gallery.filter(c => !VP.S.avatarId || c.id !== VP.S.avatarId)).concat(STARS());
};
const specOf = c => c.built || (c.star ? VP.R3.spec(c.star, false) : A.toSpec(c.spec));
UI.SCREENS.catcity = {
  hideHud: true,
  html: () => {
    const cats = A.cityCats(), n = A.gallery.length;
    return `<div class="corner l"><button class="chip" data-act="back">‹ ${t('back')}</button></div><div class="wrap" style="margin-top:46px"><h2 class="teal">🐱 ${t('gc_title')}</h2>
      <p class="small">${n ? t('gc_sub', n) : t('gc_empty')}</p>
      <div class="row"><button class="btn sm" data-act="gcWalk">🐾 ${t('gc_walk')}</button><button class="btn ghost sm" data-act="${A.status === 'in' && A.cats.length < 5 ? 'creator' : A.status === 'in' ? 'account' : 'creator'}" data-i="${A.status === 'in' ? 'new' : 'local'}">＋ ${t('ac_create')}</button></div>
      <div class="catgrid">${cats.map((c, i) => `<button class="catcard ${c.mine ? 'mine' : ''} ${c.star ? 'star' : ''}" data-act="gcView" data-i="${i}"><span class="ph"><img id="gc-${i}" alt="" ${A.thumbs[c.id] ? `src="${A.thumbs[c.id]}"` : ''}></span><b>${c.star ? '⭐ ' : c.mine ? '💛 ' : ''}${esc(c.name)}</b><small>${esc(c.breed || '')}</small>${c.instagram ? `<small class="ig">@${esc(c.instagram)}</small>` : ''}</button>`).join('')}</div>
      <p class="small">${t('gc_note')}</p></div>`;
  },
  after: () => {
    const cats = A.cityCats(), R3 = VP.R3; let i = 0;
    if (!A.gallery.length && !A.galleryTried) { A.galleryTried = true; A.loadGallery().then(() => { if (UI.screen === 'catcity' && A.gallery.length) UI.show('catcity'); }); }
    if (!R3 || !R3.ok || !R3.snapshot) return;
    // one 3D portrait per frame, cached, so the list opens at once and fills in
    const step = () => {
      if (UI.screen !== 'catcity') return;
      while (i < cats.length && A.thumbs[cats[i].id]) i++;
      if (i >= cats.length) return;
      const c = cats[i], img = document.getElementById('gc-' + i);
      try { const cv = R3.snapshot([{ spec: specOf(c), s: 1.3 }], 256, 256); if (cv) { A.thumbs[c.id] = cv.toDataURL('image/jpeg', 0.82); if (img) img.src = A.thumbs[c.id]; } else A.thumbs[c.id] = ''; } catch (e) { A.thumbs[c.id] = ''; }
      i++; requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
};
UI.SCREENS.catview = {
  cls: 'clear', hideHud: true, stage: true,
  html: i => { const c = A.cityCats()[i] || A.cityCats()[0]; return `<div class="corner l"><button class="chip" data-act="catcity">‹ ${t('back')}</button></div>
    <div class="wrap narrow" style="margin-top:auto"><div class="panel t"><h3 style="margin-top:0">${c.star ? '⭐ ' : ''}${esc(c.name)}</h3>${c.breed ? `<p class="small">${esc(c.breed)}</p>` : ''}${c.bio ? `<p>${esc(c.bio)}</p>` : ''}${c.instagram ? `<p class="small">📸 @${esc(c.instagram)}</p>` : ''}</div>
    <div class="row"><button class="btn ghost sm" data-act="catcity">‹ ${t('gc_title')}</button><button class="btn sm" data-act="gcWalk">🐾 ${t('gc_walk')}</button></div></div>`; },
  after: i => { const c = A.cityCats()[i] || A.cityCats()[0], R3 = VP.R3; if (R3 && R3.ok) R3.showcase([{ spec: specOf(c), x: 0, z: 0, s: 1 }], { dist: 7.2, shift: 2.4, lookY: 1.0 }); },
};
UI.act.catcity = () => UI.show('catcity');
UI.act.gcView = el => UI.show('catview', +el.dataset.i);
UI.act.gcWalk = () => UI.free(VP.S.pos || null);

// ---------- cat creator ----------
// One scrolling sheet under the live 3D preview: looks first (presets, coat, colours, fur, face, ears, tail), then extras and the game role.
let ed = null, edIdx = null, crScroll = 0;
const lab = (pre, v) => (t(pre + v) === pre + v ? v : t(pre + v));
const sw = (key, val, on) => `<button class="tab ${on ? 'on' : ''}" data-act="crSet" data-k="${key}" data-v="${val}">${lab('cr_', val)}</button>`;
const dots = (key, list, cur) => `<div class="cr-dots">${list.map(c => `<button class="${(cur || '').toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-act="crCol" data-k="${key}" data-v="${c}" aria-label="${c}"></button>`).join('')}<label class="cr-pick" title="+"><input type="color" data-c="${key}" value="${cur || '#ffffff'}">🎨</label></div>`;
UI.SCREENS.creator = {
  cls: 'clear', hideHud: true, stage: true,
  html: () => { const s = ed.spec, role = s.role || 'shooter', needs2 = ['calico', 'tortie'].includes(s.pattern), needs1 = s.pattern !== 'solid'; return `<div class="corner l"><button class="chip" data-act="account">‹ ${t('back')}</button></div><div class="corner"><button class="chip" data-act="crRandom">🎲 ${t('cr_random')}</button></div>
    <div class="wrap narrow" style="margin-top:auto"><div class="panel cr-sheet" id="crsheet" style="max-height:50vh;overflow-y:auto">
      <div class="row" style="flex-wrap:nowrap;gap:6px"><input class="txt" id="cname" maxlength="20" placeholder="${t('cr_name')}" value="${esc(ed.name)}"><select class="txt" id="cbreed" style="max-width:42%">${BREEDS.map(b => `<option ${b === ed.breed ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
      <h3>✨ ${t('cr_looks')}</h3><div class="row">${Object.keys(LOOKS).map(k => `<button class="tab" data-act="crLook" data-v="${k}">${lab('cl_', k)}</button>`).join('')}${A.status === 'in' ? `<label class="tab" style="margin:0;cursor:pointer">📷 ${t('cr_photo')}<input type="file" accept="image/*" id="cphoto" style="display:none"></label>` : ''}</div>
      <h3>${t('cr_pattern')}</h3><div class="row">${PATTERNS.map(f => sw('pattern', f, s.pattern === f)).join('')}</div>
      <h3>${t('cr_fur')}</h3>${dots('furBase', FURS, s.furBase)}
      ${needs1 ? `<h3>${t('cr_p1')}</h3>${dots('p0', FURS, s.patchColors[0] || '#ffffff')}` : ''}${needs2 ? `<h3>${t('cr_p2')}</h3>${dots('p1', FURS, s.patchColors[1] || '#2b1f24')}` : ''}
      <h3>${t('cr_eyes')}</h3>${dots('eyeColor', EYES, s.eyeColor)}
      <div class="row" style="margin-top:4px"><button class="tab ${s.eyeColor2 ? 'on' : ''}" data-act="crOdd">👁 ${t('cr_odd')}</button></div>${s.eyeColor2 ? dots('eyeColor2', EYES, s.eyeColor2) : ''}
      <h3>${t('cr_furLen')}</h3><div class="cr-range"><span>${t('cr_short')}</span><input type="range" min="0" max="1" step="0.05" value="${s.furLength === undefined ? (s.faceShape === 'flat' ? 0.7 : 0.4) : s.furLength}" data-c="furLength"><span>${t('cr_longf')}</span></div>
      <h3>${t('cr_size')}</h3><div class="cr-range"><span>${t('cr_small')}</span><input type="range" min="0.8" max="1.2" step="0.05" value="${s.size}" data-c="size"><span>${t('cr_bigc')}</span></div>
      <h3>${t('cr_face')}</h3><div class="row">${FACES.map(f => sw('faceShape', f, s.faceShape === f)).join('')}</div>
      <h3>${t('cr_ears')}</h3><div class="row">${EARS.map(f => sw('ears', f, (s.ears || 'pointy') === f)).join('')}</div>
      <h3>${t('cr_tail')}</h3><div class="row">${TAILS.map(f => sw('tail', f, (s.tail || 'long') === f)).join('')}</div>
      <h3>${t('cr_acc')} (${s.accessories.length}/4)</h3><div class="row">${ACCS.map(a => `<button class="tab ${s.accessories.includes(a) ? 'on' : ''}" data-act="crAcc" data-v="${a}">${ACC_ICON[a]} ${lab('cr_', a)}</button>`).join('')}</div>
      <h3>🎮 ${t('cr_role')}</h3><div class="row">${ROLES.map(r => `<button class="tab ${role === r ? 'on' : ''}" data-act="crSet" data-k="role" data-v="${r}">${{ shooter: '🫧', biter: '🦷', glutton: '🍖' }[r]} ${t('role_' + r)}</button>`).join('')}</div><p class="small" style="margin:4px 0">${t('rd_' + role)}</p>
      <input class="txt" id="cbio" maxlength="120" placeholder="${t('cr_bio')}" value="${esc(ed.bio)}" style="margin-top:8px"><div class="row" style="flex-wrap:nowrap;gap:6px;margin-top:6px"><input class="txt" id="cig" maxlength="30" placeholder="@instagram" value="${esc(ed.instagram || '')}"><button class="tab ${ed.isPublic ? 'on' : ''}" data-act="crPub">${ed.isPublic ? '🌍 ' + t('cr_public') : '🔒 ' + t('cr_private')}</button></div>
    </div><div class="row">${edIdx !== 'local' && edIdx !== 'new' ? `<button class="btn ghost sm" data-act="crDelete">🗑</button>` : ''}<button class="btn" data-act="crSave">💾 ${t('cr_save')}</button><button class="btn teal" data-act="crPlay">▶ ${t('cr_savePlay')}</button></div></div>`; },
  after: () => {
    preview();
    const root = document.getElementById('s-creator'), sheet = document.getElementById('crsheet'); if (sheet) { sheet.scrollTop = crScroll; sheet.addEventListener('scroll', () => { crScroll = sheet.scrollTop; }, { passive: true }); }
    root.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.c; if (!k) return; setCol(k, e.target.value); preview(); });
    const ph = document.getElementById('cphoto'); if (ph) ph.addEventListener('change', photo);
  },
};
function setCol(k, v) { const s = ed.spec; if (k === 'p0') s.patchColors[0] = v; else if (k === 'p1') { s.patchColors[0] = s.patchColors[0] || '#ffffff'; s.patchColors[1] = v; } else if (k === 'size' || k === 'furLength') s[k] = +v; else s[k] = v; }
{ const css = document.createElement('style'); css.textContent = `.cr-sheet h3{margin:10px 0 5px;font-size:13.5px}.cr-dots{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.cr-dots button{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.35);cursor:pointer;padding:0}.cr-dots button.on{border-color:#ffd23f;box-shadow:0 0 0 3px #ffd23f66;transform:scale(1.1)}
.cr-pick{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);cursor:pointer;position:relative;overflow:hidden;font-size:16px}.cr-pick input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.cr-range{display:flex;gap:8px;align-items:center;font-size:12px}.cr-range input{flex:1;min-height:30px}`; document.head.appendChild(css); }
Object.assign(VP.L, {
  cr_looks: ['Parece com…', 'Looks like…'], cr_random: ['Sortear', 'Random'], cr_odd: ['Um olho de cada cor', 'Odd eyes'], cr_furLen: ['Comprimento do pelo', 'Fur length'], cr_short: ['curto', 'short'], cr_longf: ['bem peludo', 'very fluffy'], cr_small: ['pequeno', 'small'], cr_bigc: ['grandão', 'big'],
  cr_ears: ['Orelhas', 'Ears'], cr_tail: ['Rabo', 'Tail'], cr_role: ['No jogo, seu gato é…', 'In the game, your cat is the…'], cr_savePlay: ['Salvar e jogar', 'Save and play'],
  cr_pointy: ['pontudas', 'pointy'], cr_big: ['grandes', 'big'], cr_fold: ['dobradas', 'folded'], cr_tuft: ['com tufos', 'tufted'], cr_fluffy: ['peludo', 'fluffy'], cr_short2: ['curto', 'short'], cr_bob: ['cotoco', 'bobtail'], cr_curl: ['enrolado', 'curled'], cr_spotted: ['pintado', 'spotted'], cr_tortie: ['escaminha', 'tortie'],
  cl_frajola: ['Frajola', 'Tuxedo'], cl_laranja: ['Laranja', 'Ginger'], cl_tigrado: ['Tigrado cinza', 'Grey tabby'], cl_siames: ['Siamês', 'Siamese'], cl_tricolor: ['Tricolor', 'Calico'], cl_escaminha: ['Escaminha', 'Tortie'], cl_preto: ['Preto', 'Black'], cl_branco: ['Branco', 'White'], cl_persa: ['Persa creme', 'Cream Persian'], cl_bengal: ['Bengal', 'Bengal'],
  cr_card: ['Tem um gato em casa?', 'Got a cat at home?'], cr_cardSub: ['Crie um igualzinho e jogue com ele.', 'Make one just like it and play as your cat.'], cr_cardGo: ['Criar', 'Create'],
});
VP.L.cr_long = VP.L.cr_long || ['longo', 'long']; VP.L.cr_short = VP.L.cr_short || ['curto', 'short'];
function keep() { const g = id => { const el = document.getElementById(id); return el ? el.value : null; }; for (const [id, k] of [['cname', 'name'], ['cbreed', 'breed'], ['cbio', 'bio'], ['cig', 'instagram']]) { const v = g(id); if (v !== null) ed[k] = v; } }
function preview() { const R3 = VP.R3; if (R3 && R3.ok) R3.showcase([{ spec: A.toSpec(ed.spec), x: 0, z: 0, s: 1 }], { dist: 7.2, shift: 2.8, lookY: 1.0 }); }
UI.act.creator = el => {
  const i = el.dataset.i; edIdx = i === 'new' || i === 'local' ? i : +i;
  if (edIdx === 'local') ed = VP.S.avatarLocal ? JSON.parse(JSON.stringify(VP.S.avatarLocal)) : blank(); else if (edIdx === 'new') ed = blank(); else ed = JSON.parse(JSON.stringify(A.cats[edIdx]));
  ed.spec = Object.assign(blank().spec, ed.spec); ed.spec.patchColors = (ed.spec.patchColors || []).slice(0, 4); ed.spec.accessories = (ed.spec.accessories || []).slice();
  UI.show('creator');
};
UI.act.crSet = el => { keep(); ed.spec[el.dataset.k] = el.dataset.v; UI.show('creator'); };
A.LOOKS = LOOKS;
UI.act.crAcc = el => { keep(); const a = ed.spec.accessories, v = el.dataset.v, i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else if (a.length < 4) a.push(v); UI.show('creator'); };
UI.act.crPub = () => { keep(); ed.isPublic = !ed.isPublic; UI.show('creator'); };
UI.act.crCol = el => { keep(); setCol(el.dataset.k, el.dataset.v); UI.show('creator'); };
UI.act.crOdd = () => { keep(); if (ed.spec.eyeColor2) delete ed.spec.eyeColor2; else ed.spec.eyeColor2 = ed.spec.eyeColor === '#3fa9f5' ? '#f2b01e' : '#3fa9f5'; UI.show('creator'); };
UI.act.crLook = el => { keep(); const L0 = LOOKS[el.dataset.v]; if (!L0) return; const s = ed.spec; delete s.eyeColor2; Object.assign(s, { faceShape: 'round', furLength: 0.4, ears: 'pointy', tail: 'long' }, JSON.parse(JSON.stringify(L0))); UI.show('creator'); };
UI.act.crRandom = () => { keep(); const pick = a => a[Math.floor(Math.random() * a.length)], s = ed.spec; Object.assign(s, { pattern: pick(PATTERNS), furBase: pick(FURS), patchColors: [pick(FURS), pick(FURS)], eyeColor: pick(EYES), faceShape: pick(FACES), ears: pick(EARS), tail: pick(TAILS), furLength: Math.round(Math.random() * 20) / 20, size: 0.8 + Math.round(Math.random() * 8) / 20 }); delete s.eyeColor2; UI.show('creator'); };
UI.act.crPlay = async el => { A.playAfterSave = true; await UI.act.crSave(el); };
// after a save: the cat becomes the avatar; "save and play" also puts it in the team, in the role picked above
function afterSave(spec, name) { crScroll = 0; if (VP.Party) { const P2 = VP.Party, slot = P2.roleSlot(spec.role || 'shooter'); if (A.playAfterSave) P2.set(true, slot); else { P2.S().role = slot; P2.apply(); } } const go = A.playAfterSave; A.playAfterSave = false; void name; if (go) { UI.act.play(); return true; } return false; }
async function photo(e) {
  const f = e.target.files && e.target.files[0]; if (!f) return; keep();
  try {
    const bmp = await createImageBitmap(f), s = Math.min(1, 128 / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * s)); cv.height = Math.max(1, Math.round(bmp.height * s)); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const r = await api('/api/cats/suggest-colors', 'POST', { image: cv.toDataURL('image/png') });
    if (r.status === 200 && r.spec) { if (r.spec.furBase) ed.spec.furBase = r.spec.furBase; if (r.spec.patchColors && r.spec.patchColors.length) ed.spec.patchColors = r.spec.patchColors.slice(0, 2); if (r.spec.pattern) ed.spec.pattern = r.spec.pattern; UI.toast('🎨 ' + t('cr_photoOk')); UI.show('creator'); }
    else UI.toast(errMsg(r), 3000);
  } catch (er) { UI.toast(t('ac_err')); }
}
UI.act.crSave = async el => {
  keep(); const name = (ed.name || '').trim(); if (!name) { UI.toast(t('cr_name') + '?'); return; }
  const body = { name, breed: ed.breed, bio: ed.bio || '', instagram: ed.instagram || null, isPublic: !!ed.isPublic, spec: ed.spec };
  if (edIdx === 'local' || A.status !== 'in') { VP.S.avatarLocal = body; VP.S.avatar = Object.assign(A.toSpec(body.spec), { label: name }); VP.S.avatarId = 'local'; VP.persist(); UI.toast('🐱 ' + t('cr_saved')); if (!afterSave(body.spec, name)) UI.show('account'); return; }
  el.disabled = true;
  const r = edIdx === 'new' ? await api('/api/cats', 'POST', body) : await api('/api/cats?id=' + encodeURIComponent(ed.id), 'PUT', body);
  el.disabled = false;
  if ((r.status === 200 || r.status === 201) && r.cat) { if (edIdx === 'new') A.cats.push(r.cat); else A.cats[edIdx] = r.cat; VP.S.avatar = Object.assign(A.toSpec(r.cat.spec), { label: r.cat.name }); VP.S.avatarId = r.cat.id; VP.persist(); UI.toast('🐱 ' + t('cr_saved')); A.loadGallery(); if (!afterSave(r.cat.spec, r.cat.name)) UI.show('account'); }
  else { A.playAfterSave = false; UI.toast(errMsg(r), 3200); }
};
UI.act.crDelete = async () => { if (!confirm(t('cr_delAsk'))) return; const r = await api('/api/cats?id=' + encodeURIComponent(ed.id), 'DELETE'); if (r.status === 200) { A.cats.splice(edIdx, 1); if (VP.S.avatarId === ed.id) { VP.S.avatar = null; VP.S.avatarId = null; VP.persist(); } UI.show('account'); } else UI.toast(errMsg(r)); };
})();
