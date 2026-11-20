'use strict';
// VICE PAWS — accounts client: e-mail code login, "Meus gatos" creator (parametric cat), cloud save, public gallery
(function () {
const VP = window.VP, UI = VP.UI, t = (...a) => VP.t(...a);
const A = VP.Acct = { user: null, cats: [], status: 'unknown', gallery: [], email: '' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = (path, method, body) => fetch(path, { method: method || 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  .then(async r => Object.assign({ status: r.status }, await r.json().catch(() => ({})))).catch(() => ({ status: 0, error: 'network' }));
A.api = api;
const BREEDS = ['persa', 'siames', 'vira-lata', 'srd', 'maine-coon', 'sphynx', 'angora', 'bengal', 'ragdoll', 'british', 'sem-raca', 'outro'];
const FACES = ['round', 'flat', 'wedge', 'square', 'long'], PATTERNS = ['solid', 'calico', 'tuxedo', 'tabby', 'bicolor', 'pointed'];
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
  const fur = s.furBase || '#d9a066', pat = { bicolor: 'tuxedo', pointed: 'points' }[s.pattern] || s.pattern || 'solid';
  return { size: Math.max(0.6, Math.min(1.2, (s.size || 1) * 0.92)), fur, fur2: pat === 'tuxedo' ? (pc[0] || '#ffffff') : light(fur), pattern: pat, patchA: pc[0] || (pat === 'points' ? '#5a4030' : '#f28a2e'), patchB: pc[1] || pc[0] || '#2b1f24',
    eye: s.eyeColor || '#7bc86c', earIn: '#f4a9b8', face: s.faceShape === 'flat' ? 'flat' : 'round', headShape: s.faceShape || 'round', fluff: s.faceShape === 'flat' ? 1 : 0.6, acc };
};
const blank = () => ({ name: '', breed: 'vira-lata', bio: '', instagram: '', isPublic: true, spec: { size: 1, faceShape: 'round', furBase: '#d9a066', pattern: 'solid', patchColors: ['#ffffff', '#2b1f24'], eyeColor: '#7bc86c', accessories: [] } });

// ---------- boot + cloud save ----------
A.init = async function () {
  const me = await api('/api/me');
  if (me.status === 200 && me.user) { A.user = me.user; A.cats = me.cats || []; A.status = 'in'; A.pull(); }
  else A.status = me.status === 401 ? 'guest' : 'offline';
  if (UI.screen === 'title' || UI.screen === 'account') UI.relabel();
  A.loadGallery();
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
    if (A.status === 'offline' || A.status === 'unknown') return head + `<div class="panel t"><p>${t('ac_offline')}</p></div><button class="btn" data-act="creator" data-i="local">🐱 ${t('ac_create')}</button><button class="btn ghost" data-act="privacy">🔒 ${t('ac_privacy')}</button></div>`;
    if (A.status !== 'in') return head + `<div class="panel t"><p>${t('ac_why')}</p>
      ${A.step === 'code' ? `<p class="small">${t('ac_sent', esc(A.email))}</p><input class="txt" id="acode" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"><div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="acBackEmail">${t('ac_other')}</button><button class="btn" data-act="acVerify">${t('ac_enter')}</button></div>`
        : `<input class="txt" id="aemail" type="email" inputmode="email" placeholder="voce@email.com" value="${esc(A.email)}" autocomplete="email"><div class="row" style="margin-top:10px"><button class="btn" data-act="acStart">✉ ${t('ac_send')}</button></div>`}
      <p class="small" style="margin-top:10px">🔒 ${t('ac_note')}</p></div>
      <button class="btn ghost" data-act="creator" data-i="local">🐱 ${t('ac_create')} (${t('ac_local')})</button><button class="btn ghost sm" data-act="privacy">🔒 ${t('ac_privacy')}</button></div>`;
    return head + `<div class="panel t"><p class="small">✉ ${esc(A.user.email)} · ☁ ${t('ac_cloud')}</p></div>
      <h3>🐱 ${t('ac_mycats')} (${A.cats.length}/5)</h3>
      ${A.cats.map((c, i) => `<div class="mrow"><div style="flex:1"><b>${esc(c.name)}</b> <span class="small">· ${esc(c.breed)} ${c.isPublic ? '· 🌍' : '· 🔒'}</span></div><button class="btn ghost sm" data-act="acUse" data-i="${i}">${VP.S.avatarId === c.id ? '✓ ' + t('ac_playing') : t('ac_play')}</button><button class="btn sm" data-act="creator" data-i="${i}">✎</button></div>`).join('')}
      ${A.cats.length < 5 ? `<button class="btn" data-act="creator" data-i="new">＋ ${t('ac_create')}</button>` : ''}
      <div class="row"><button class="btn ghost sm" data-act="acLogout">${t('ac_logout')}</button><button class="btn ghost sm" data-act="privacy">🔒 ${t('ac_privacy')}</button><button class="btn ghost sm" data-act="acDelete" style="color:#ff6b6b">🗑 ${t('ac_delete')}</button></div></div>`;
  },
};
UI.act.account = () => UI.show('account');
UI.act.acBackEmail = () => { A.step = null; UI.show('account'); };
const errMsg = r => r.status === 503 ? t('ac_offline') : r.status === 429 ? t('ac_rate') : r.error === 'invalid-code' ? t('ac_badcode') : r.status === 422 ? t('ac_mod') : r.status === 400 ? t('ac_invalid') + (r.field ? ' (' + r.field + ')' : '') : r.status === 409 ? t('ac_limit') : t('ac_err');
UI.act.acStart = async el => {
  const email = (document.getElementById('aemail').value || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { UI.toast(t('ac_invalid')); return; }
  el.disabled = true; const r = await api('/api/auth/start', 'POST', { email, lang: VP.lang() }); el.disabled = false;
  if (r.status === 200) { A.email = email; A.step = 'code'; UI.show('account'); } else { if (r.status === 503) A.status = 'offline'; UI.toast(errMsg(r), 3200); if (r.status === 503) UI.show('account'); }
};
UI.act.acVerify = async el => {
  const code = (document.getElementById('acode').value || '').replace(/\D/g, ''); if (code.length !== 6) return;
  el.disabled = true; const r = await api('/api/auth/verify', 'POST', { email: A.email, code }); el.disabled = false;
  if (r.status === 200 && r.user) { A.user = r.user; A.status = 'in'; A.step = null; const me = await api('/api/me'); A.cats = me.cats || []; UI.confetti(); UI.show('account'); await A.pull(); A.push(); }
  else UI.toast(errMsg(r), 3200);
};
UI.act.acLogout = async () => { await api('/api/auth/logout', 'POST'); A.user = null; A.cats = []; A.status = 'guest'; UI.show('account'); };
UI.act.acDelete = async () => { if (!confirm(t('ac_delAsk'))) return; const r = await api('/api/me', 'DELETE'); if (r.status === 200) { A.user = null; A.cats = []; A.status = 'guest'; VP.S.avatarId = null; UI.toast(t('ac_deleted'), 3000); UI.show('account'); } else UI.toast(errMsg(r)); };
UI.act.acUse = el => { const c = A.cats[+el.dataset.i]; if (VP.S.avatarId === c.id) { VP.S.avatar = null; VP.S.avatarId = null; } else { VP.S.avatar = Object.assign(A.toSpec(c.spec), { label: c.name }); VP.S.avatarId = c.id; } VP.persist(); UI.show('account'); };
UI.SCREENS.privacy = { hideHud: true, html: () => `<div class="corner l"><button class="chip" data-act="account">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="teal">🔒 ${t('ac_privacy')}</h2><div class="panel t">${t('ac_privTxt')}</div><a class="btn ghost" href="privacy.html" target="_blank" rel="noopener">${t('ac_privFull')}</a></div>` };
UI.act.privacy = () => UI.show('privacy');

// ---------- cat creator ----------
let ed = null, edIdx = null;
const sw = (key, val, on) => `<button class="tab ${on ? 'on' : ''}" data-act="crSet" data-k="${key}" data-v="${val}">${t('cr_' + val) === 'cr_' + val ? val : t('cr_' + val)}</button>`;
UI.SCREENS.creator = {
  cls: 'clear', hideHud: true, stage: true,
  html: () => { const s = ed.spec; return `<div class="corner l"><button class="chip" data-act="account">‹ ${t('back')}</button></div>
    <div class="wrap narrow" style="margin-top:auto"><div class="panel" style="max-height:46vh;overflow-y:auto">
      <div class="row" style="flex-wrap:nowrap;gap:6px"><input class="txt" id="cname" maxlength="20" placeholder="${t('cr_name')}" value="${esc(ed.name)}"><select class="txt" id="cbreed" style="max-width:42%">${BREEDS.map(b => `<option ${b === ed.breed ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
      <h3>${t('cr_face')}</h3><div class="row">${FACES.map(f => sw('faceShape', f, s.faceShape === f)).join('')}</div>
      <h3>${t('cr_pattern')}</h3><div class="row">${PATTERNS.map(f => sw('pattern', f, s.pattern === f)).join('')}</div>
      <h3>${t('cr_colors')}</h3><div class="row"><label class="small">${t('cr_fur')} <input type="color" data-c="furBase" value="${s.furBase}"></label><label class="small">${t('cr_p1')} <input type="color" data-c="p0" value="${s.patchColors[0] || '#ffffff'}"></label><label class="small">${t('cr_p2')} <input type="color" data-c="p1" value="${s.patchColors[1] || '#2b1f24'}"></label><label class="small">${t('cr_eyes')} <input type="color" data-c="eyeColor" value="${s.eyeColor}"></label></div>
      <div class="row" style="margin-top:6px"><label class="small">${t('cr_size')} <input type="range" min="0.8" max="1.2" step="0.05" value="${s.size}" data-c="size"></label>${A.status === 'in' ? `<label class="btn ghost sm" style="margin:0">📷 ${t('cr_photo')}<input type="file" accept="image/*" id="cphoto" style="display:none"></label>` : ''}</div>
      <h3>${t('cr_acc')} (${s.accessories.length}/4)</h3><div class="row">${ACCS.map(a => `<button class="tab ${s.accessories.includes(a) ? 'on' : ''}" data-act="crAcc" data-v="${a}">${ACC_ICON[a]} ${t('cr_' + a) === 'cr_' + a ? a : t('cr_' + a)}</button>`).join('')}</div>
      <input class="txt" id="cbio" maxlength="120" placeholder="${t('cr_bio')}" value="${esc(ed.bio)}" style="margin-top:8px"><div class="row" style="flex-wrap:nowrap;gap:6px;margin-top:6px"><input class="txt" id="cig" maxlength="30" placeholder="@instagram" value="${esc(ed.instagram || '')}"><button class="tab ${ed.isPublic ? 'on' : ''}" data-act="crPub">${ed.isPublic ? '🌍 ' + t('cr_public') : '🔒 ' + t('cr_private')}</button></div>
    </div><div class="row">${edIdx !== 'local' && edIdx !== 'new' ? `<button class="btn ghost sm" data-act="crDelete">🗑</button>` : ''}<button class="btn" data-act="crSave">💾 ${t('cr_save')}</button></div></div>`; },
  after: () => {
    preview();
    const root = document.getElementById('s-creator');
    root.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.c; if (!k) return; const s = ed.spec, v = e.target.value; if (k === 'p0') s.patchColors[0] = v; else if (k === 'p1') { s.patchColors[0] = s.patchColors[0] || '#ffffff'; s.patchColors[1] = v; } else if (k === 'size') s.size = +v; else s[k] = v; preview(); });
    const ph = document.getElementById('cphoto'); if (ph) ph.addEventListener('change', photo);
  },
};
function keep() { const g = id => { const el = document.getElementById(id); return el ? el.value : null; }; if (g('cname') !== null) { ed.name = g('cname'); ed.breed = g('cbreed'); ed.bio = g('cbio'); ed.instagram = g('cig'); } }
function preview() { const R3 = VP.R3; if (R3 && R3.ok) R3.showcase([{ spec: A.toSpec(ed.spec), x: 0, z: 0, s: 1 }], { dist: 7.2, shift: 2.8, lookY: 1.0 }); }
UI.act.creator = el => {
  const i = el.dataset.i; edIdx = i === 'new' || i === 'local' ? i : +i;
  if (edIdx === 'local') ed = VP.S.avatarLocal ? JSON.parse(JSON.stringify(VP.S.avatarLocal)) : blank(); else if (edIdx === 'new') ed = blank(); else ed = JSON.parse(JSON.stringify(A.cats[edIdx]));
  ed.spec = Object.assign(blank().spec, ed.spec); ed.spec.patchColors = (ed.spec.patchColors || []).slice(0, 4); ed.spec.accessories = (ed.spec.accessories || []).slice();
  UI.show('creator');
};
UI.act.crSet = el => { keep(); ed.spec[el.dataset.k] = el.dataset.v; UI.show('creator'); };
UI.act.crAcc = el => { keep(); const a = ed.spec.accessories, v = el.dataset.v, i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else if (a.length < 4) a.push(v); UI.show('creator'); };
UI.act.crPub = () => { keep(); ed.isPublic = !ed.isPublic; UI.show('creator'); };
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
  if (edIdx === 'local' || A.status !== 'in') { VP.S.avatarLocal = body; VP.S.avatar = Object.assign(A.toSpec(body.spec), { label: name }); VP.S.avatarId = 'local'; VP.persist(); UI.toast('🐱 ' + t('cr_saved')); UI.show('account'); return; }
  el.disabled = true;
  const r = edIdx === 'new' ? await api('/api/cats', 'POST', body) : await api('/api/cats?id=' + encodeURIComponent(ed.id), 'PUT', body);
  el.disabled = false;
  if ((r.status === 200 || r.status === 201) && r.cat) { if (edIdx === 'new') A.cats.push(r.cat); else A.cats[edIdx] = r.cat; VP.S.avatar = Object.assign(A.toSpec(r.cat.spec), { label: r.cat.name }); VP.S.avatarId = r.cat.id; VP.persist(); UI.toast('🐱 ' + t('cr_saved')); A.loadGallery(); UI.show('account'); }
  else UI.toast(errMsg(r), 3200);
};
UI.act.crDelete = async () => { if (!confirm(t('cr_delAsk'))) return; const r = await api('/api/cats?id=' + encodeURIComponent(ed.id), 'DELETE'); if (r.status === 200) { A.cats.splice(edIdx, 1); if (VP.S.avatarId === ed.id) { VP.S.avatar = null; VP.S.avatarId = null; VP.persist(); } UI.show('account'); } else UI.toast(errMsg(r)); };
})();
