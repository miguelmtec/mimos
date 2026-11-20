'use strict';
// VICE PAWS — the Mimos are the showcase.
//   * "Coleção Mimos": the signature line of the three official cats (data/mimos.json), merged into the wardrobe
//   * the owner's account (user.admin from /api/me) has the "Edição dos Mimos": every item, vehicle and paint, serial #0,
//     outside the scarcity caps (nothing is minted for it). Ownership comes from the account, never from "is it Mimo":
//     guests and other players wear only what they earned or bought.
//   * "Look dos Mimos da semana": a rotating outfit, shown on the title, with "Quero esse look" (how to get each piece)
//   * window.getMimosShowcaseLook(): the look as buildCat specs, for other modules (celebrity NPCs, share card…)
(function () {
const VP = window.VP, UI = VP.UI, Wd = VP.Wardrobe, P = VP.Prog, ACT = UI.act, SC = UI.SCREENS, t = (...a) => VP.t(...a), L = () => (VP.lang() === 'pt' ? 'pt' : 'en');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Mm = VP.Mimos = { data: null };
const NAMES = ['mimo', 'mimosa', 'morticia'];
Object.assign(VP.L, {
  mm_line: ['Coleção Mimos', 'Mimos Collection'], mm_look: ['Look dos Mimos da semana', "Mimos' look of the week"], mm_want: ['Quero esse look', 'I want this look'], mm_edition: ['Edição dos Mimos · #0', "Mimos' Edition · #0"],
  mm_how_earn: ['conquista', 'earned'], mm_how_hidden: ['caixa secreta', 'secret box'], mm_how_raro: ['raro', 'rare'], mm_how_epico: ['épico', 'epic'], mm_how_lendario: ['lendário', 'legendary'], mm_how_unico: ['único', 'unique'],
  mm_get_coins: ['Compre no guarda-roupa por {0} moedas', 'Buy it in the wardrobe for {0} coins'], mm_get_pack: ['Vem no pacote {0} da loja (R$ {1})', 'Comes in the {0} shop pack (R$ {1})'], mm_get_earn: ['Ganhe com a conquista “{0}” {1}', 'Earn it with the “{0}” achievement {1}'],
  mm_get_hidden: ['Escondido numa caixa secreta da cidade', 'Hidden in a secret box somewhere in town'], mm_get_reward: ['Vem com o item {0} “{1}” (desempenho perfeito ou caixas secretas)', 'Comes with the {0} item “{1}” (perfect runs or secret boxes)'], mm_have: ['Você já tem', 'You have it'], mm_wear: ['Vestir o que eu já tenho', 'Wear what I already own'],
  mm_unlocked: ['Novo na Coleção Mimos: {0}!', 'New in the Mimos Collection: {0}!'],
});
Mm.isAdmin = () => !!(VP.Acct && VP.Acct.status === 'in' && VP.Acct.user && VP.Acct.user.admin);
const byId = id => (Mm.data ? Mm.data.items.find(i => i.id === id) : null) || (Wd.data ? Wd.data.items.find(i => i.id === id) : null);
// the collection joins the wardrobe catalogue (same item format)
let base = null;
{ const load0 = Wd.load; const merge = () => { if (!base) return; const d = Object.assign({}, base, { items: base.items.filter(i => i.line !== 'mimos').concat(Mm.data ? Mm.data.items.map(i => Object.assign({ cats: [i.star] }, i)) : []) }); load0(d); if (UI.screen === 'title' && UI.relabel) UI.relabel(); };
  Wd.load = d => { base = d; merge(); };
  fetch('data/mimos.json').then(r => (r.ok ? r.json() : null)).then(d => { if (d && d.items) { Mm.data = d; merge(); } }).catch(() => {}); }
// ownership: the account decides. Admin = everything; others = bought, granted, or earned (hidden boxes, achievements, rare rewards)
{ const owns0 = Wd.owns; Wd.owns = it => { if (!it) return false; if (Mm.isAdmin()) return true; if (it.how) return Mm.earned(it); return owns0(it); }; }
Mm.earned = function (it) {
  const s = VP.S; if ((s.owned || []).includes(it.id)) return true;
  if (it.how === 'earn' && it.earn && VP.Long) return VP.Long.value(it.earn.k) >= it.earn.n;
  if (it.reward) return !!(s.rw && s.rw.items || []).find(x => x.id === it.reward);
  return false;
};
// hidden pieces come out of the secret boxes, one per box, in order
if (VP.Rewards) { const c0 = VP.Rewards.claim; VP.Rewards.claim = async function (body) { const out = await c0(body); if (body.source === 'cache' && Mm.data && !Mm.isAdmin()) { const s = VP.S; s.owned = s.owned || []; const it = Mm.data.items.find(i => i.how === 'hidden' && !s.owned.includes(i.id)); if (it) { s.owned.push(it.id); VP.persist(); UI.toast('🎁 ' + t('mm_unlocked', it.name[L()]), 3200); } } return out; }; }
// admin: vehicles and paints too
if (VP.Veh) { const u0 = VP.Veh.unlocked; VP.Veh.unlocked = k => (Mm.isAdmin() && !!VP.Veh.TYPES[k]) || u0(k); VP.vehicles.unlocked = VP.Veh.unlocked; }
Mm.howText = function (it) {
  if (it.price) return '🪙 ' + t('mm_get_coins', it.price);
  if (it.grant) { const pk = Wd.data.packs && Wd.data.packs[it.grant]; return '🛍 ' + t('mm_get_pack', pk ? pk.icon + ' ' + t('p_' + it.grant) : it.grant, pk ? (VP.Shop.PRICE || {})[pk.product] || '' : ''); }
  if (it.how === 'earn') return '🏅 ' + t('mm_get_earn', t('ah_' + it.earn.k), it.earn.n);
  if (it.how === 'hidden') return '📦 ' + t('mm_get_hidden');
  if (it.reward) { const d = VP.Rewards && VP.Rewards.cfg && VP.Rewards.cfg.items.find(x => x.id === it.reward); return '💎 ' + t('mm_get_reward', t('mm_how_' + it.how), d ? d.name[L()] : it.reward); }
  return '';
};
// ---------- look of the week ----------
Mm.weekOf = d => Math.floor(((d || new Date()).getTime() - new Date('2026-01-05T00:00:00').getTime()) / (7 * 864e5));
Mm.look = function (date) { const d = Mm.data; if (!d || !d.looks.length) return null; const m = (date || new Date()).getMonth() + 1, season = d.looks.find(l => l.month === m); if (season) return season; const pool = d.looks.filter(l => !l.month), w = Mm.weekOf(date); return pool[((w % pool.length) + pool.length) % pool.length]; };
Mm.specFor = function (name, look) {
  const R3 = VP.R3, baseSpec = R3 && R3.SPECS ? R3.SPECS[name] : {}, out = Object.assign({}, baseSpec, { acc: {} }), wear = Object.assign({}, Wd.data && Wd.data.defaults[name], look ? look.wear[name] : null);
  for (const sl of (Wd.data ? Wd.data.slots : [])) { const it = byId(wear[sl]); if (!it) continue; if (it.acc) Object.assign(out.acc, it.acc); if (it.trail) out.trail = it.trail; }
  return out;
};
/** The outfit the three official cats are wearing this week: {id, name, week, cats: {mimo: {spec, items}, …}}. */
Mm.showcaseLook = function (date) { const look = Mm.look(date); if (!look) return null; const cats = {}; for (const n of NAMES) cats[n] = { spec: Mm.specFor(n, look), items: Object.values(look.wear[n] || {}) }; return { id: look.id, name: look.name, week: Mm.weekOf(date), edition: 'Edição dos Mimos #0', cats }; };
window.getMimosShowcaseLook = Mm.showcaseLook;
let thumb = null, thumbId = null;
Mm.thumb = function () { const lk = Mm.look(), R3 = VP.R3; if (!lk || !R3 || !R3.ok || !R3.snapshot) return ''; if (thumbId === lk.id && thumb) return thumb; try { const cv = R3.snapshot(NAMES.map((n, i) => ({ spec: Mm.specFor(n, lk), s: 1, x: (i - 1) * 1.5 })), 480, 240); thumb = cv ? cv.toDataURL('image/jpeg', 0.85) : ''; thumbId = lk.id; } catch (e) { thumb = ''; } return thumb; };
SC.look = {
  cls: 'glass', hideHud: true,
  html: () => { const lk = Mm.look(); if (!lk) return `<div class="wrap narrow"><button class="btn" data-act="title">${t('back')}</button></div>`; const img = Mm.thumb();
    return `<div class="corner l"><button class="chip" data-act="title">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="gold">✨ ${esc(lk.name[L()])}</h2><p class="small">${t('mm_look')} · ${t('mm_edition')}</p>
      ${img ? `<img src="${img}" alt="" style="width:100%;border-radius:18px;border:3px solid #ffd23f">` : ''}
      ${NAMES.map(n => `<h3>${esc(t(n))}</h3>${Object.values(lk.wear[n] || {}).map(id => { const it = byId(id); if (!it) return ''; const own = Wd.owns(it); return `<div class="pg-item ${own ? '' : 'zero'}"><div class="ic">${own ? '✔' : '👕'}</div><div class="tx"><b>${esc(it.name[L()])}</b><span>${own ? t('mm_have') : esc(Mm.howText(it))}</span></div></div>`; }).join('')}`).join('')}
      <div class="grid2"><button class="btn sm" data-act="lookWear">👕 ${t('mm_wear')}</button><button class="btn ghost sm" data-act="wardrobe">${t('wardrobe')}</button></div></div>`; },
};
ACT.look = () => UI.show('look');
ACT.lookWear = () => { const lk = Mm.look(), s = VP.S; s.wear = s.wear || {}; for (const n of NAMES) for (const sl in lk.wear[n]) { const it = byId(lk.wear[n][sl]); if (it && Wd.owns(it)) { s.wear[n] = s.wear[n] || {}; s.wear[n][sl] = it.id; } } VP.persist(); if (VP.R3.refreshCats) VP.R3.refreshCats(); UI.toast('👕 ✔'); UI.show('look'); };
{ const s = SC.title, h0 = s.html; s.html = a => { let html = h0(a); const lk = Mm.look(); if (!lk) return html; const img = Mm.thumb(); return html.replace(/<div class="foot">/, `<button class="pg-card" data-act="look" style="width:100%;color:#fff;font:inherit;cursor:pointer">${img ? `<img src="${img}" alt="" style="width:108px;border-radius:12px">` : '<span class="em">✨</span>'}<div><b>✨ ${t('mm_look')}</b><span>${esc(lk.name[L()])}</span></div><span class="btn gold sm" style="margin:0">${t('mm_want')}</span></button><div class="foot">`); }; }
})();
