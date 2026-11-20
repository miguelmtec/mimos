'use strict';
// VICE PAWS — showing off: "Mais Bonitos" (style board with one like per day), levels and tiers on the ranking and the gallery.
// Likes are stored locally and sent to /api/style, which is a stub for now (one like per account per day is enforced there later; no paid votes ever).
(function () {
const VP = window.VP, UI = VP.UI, M = VP.Missions, P = VP.Prog, ACT = UI.act, SC = UI.SCREENS, t = (...a) => VP.t(...a);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Object.assign(VP.L, {
  so_title: ['Mais Bonitos', 'Best Dressed'], so_sub: ['O quadro da semana do Gato Mais Estiloso. Você pode dar 1 curtida por dia. Curtida não se compra.', 'The weekly Most Stylish Cat board. You get 1 like a day. Likes cannot be bought.'], so_like: ['Curtir', 'Like'], so_liked: ['Curtido hoje', 'Liked today'],
  so_used: ['Você já curtiu hoje. Volte amanhã!', 'You already liked today. Come back tomorrow!'], so_me: ['Seu time', 'Your team'], so_style: ['Estilo {0}', 'Style {0}'], so_local: ['Curtidas guardadas neste aparelho até o ranking online abrir.', 'Likes are kept on this device until the online board opens.'],
  so_you: ['Você: {0} nível {1} · {2} · Poder {3}', 'You: {0} level {1} · {2} · Power {3}'],
});
const So = VP.Social = {};
const S = () => { const l = VP.Long.S(); if (!l.likes) l.likes = { day: 0, id: null, wk: 0, n: {} }; const wk = VP.Long.weekKey(); if (l.likes.wk !== wk) { l.likes.wk = wk; l.likes.n = {}; } return l.likes; };
So.canLike = () => S().day !== M.dayKey();
So.like = function (id) { const s = S(); if (!So.canLike()) return false; s.day = M.dayKey(); s.id = id; s.n[id] = (s.n[id] || 0) + 1; VP.persist(); try { fetch('/api/style', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cat: id }) }).catch(() => {}); } catch (e) { /* offline */ } return true; };
// style of a gallery cat: accessories and a patterned coat count
So.styleOf = c => 20 + ((c.spec && c.spec.accessories) || []).length * 15 + (c.spec && c.spec.pattern !== 'solid' ? 10 : 0) + (c.spec && c.spec.eyeColor2 ? 10 : 0);
SC.style = {
  cls: 'glass', hideHud: true,
  html: () => { const s = S(), A = VP.Acct, best = P.CATS.reduce((a, n) => (P.level(n).lv > P.level(a).lv ? n : a), 'mimo'), lv = P.level(best).lv;
    const rows = ((A && A.gallery) || []).map(c => ({ id: c.id, name: c.name, sub: c.breed || '', style: So.styleOf(c), likes: s.n[c.id] || 0, img: A.thumbs[c.id] })).sort((a, b) => b.likes * 50 + b.style - (a.likes * 50 + a.style));
    return `<div class="corner l"><button class="chip" data-act="catcity">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="gold">✨ ${t('so_title')}</h2><p class="small">${t('so_sub')}</p>
      <div class="pg-item" style="border-color:${P.tier(lv).col}"><div class="ic">💛</div><div class="tx"><b>${t('so_me')} · ${t('so_style', VP.Long.style())}</b><span>${t('pg_lv')} ${lv} · ${t('tr_' + P.tier(lv).id)} · ⚡ ${P.power()}</span></div><div class="do"><button class="btn ghost sm" data-act="wardrobe">👕</button></div></div>
      ${rows.map((r, i) => `<div class="pg-item"><div class="ic">${r.img ? `<img src="${r.img}" alt="" style="width:44px;height:44px;border-radius:12px">` : '🐱'}<i>${i + 1}º</i></div><div class="tx"><b>${esc(r.name)}</b><span>${esc(r.sub)} · ${t('so_style', r.style)} · ❤ ${r.likes}</span></div><div class="do"><button class="btn ${So.canLike() ? '' : 'ghost'} sm" data-act="soLike" data-id="${esc(r.id)}">${s.id === r.id && !So.canLike() ? '❤ ' + t('so_liked') : '❤ ' + t('so_like')}</button></div></div>`).join('') || `<p class="small">${t('gc_empty')}</p>`}
      <p class="small">${t('so_local')}</p></div>`; },
};
ACT.style = () => UI.show('style');
ACT.soLike = el => { if (So.like(el.dataset.id)) VP.Audio.sfx('paw'); else UI.toast(t('so_used')); UI.show('style'); };
const wrap = (id, fn) => { const s = SC[id]; if (!s) return; const h0 = s.html; s.html = a => fn(h0(a), a); };
const meLine = () => { const best = P.CATS.reduce((a, n) => (P.level(n).lv > P.level(a).lv ? n : a), 'mimo'), lv = P.level(best).lv, tr = P.tier(lv); return `<p class="small" style="color:${tr.col}">🪪 ${t('so_you', esc(t(best)), lv, t('tr_' + tr.id), P.power())}</p>`; };
wrap('catcity', html => html.replace('<div class="catgrid">', `<div class="row"><button class="btn gold sm" data-act="style">✨ ${t('so_title')}</button><button class="btn ghost sm" data-act="profile">🪪 ${t('pf_title')}</button></div>${meLine()}<div class="catgrid">`));
wrap('rank', html => html.replace('<button class="btn ghost" data-act="back">', meLine() + '<button class="btn ghost" data-act="back">'));
})();
