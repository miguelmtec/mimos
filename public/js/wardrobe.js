'use strict';
// VICE PAWS — "Guarda-roupa": slot-based outfits applied to the parametric cat builder. Items come from data/outfits.json.
(function () {
const VP = window.VP, UI = VP.UI, t = (...a) => VP.t(...a);
const Wd = VP.Wardrobe = { cat: 'mimo', slot: 'body' };
const NAMES = ['mimo', 'mimosa', 'morticia'];
let D = { slots: [], defaults: {}, sets: {}, items: [] }, byId = {};
Wd.load = function (data) { D = data; byId = {}; for (const it of D.items) byId[it.id] = it; Wd.data = D; };
const S = () => { const s = VP.S; if (!s.wear) s.wear = {}; if (!s.owned) s.owned = []; return s; };
Wd.owns = it => !!it.free || (it.grant ? VP.Shop.has(it.grant) : S().owned.includes(it.id));
Wd.wearing = function (name, force) {
  if (force) return Object.assign({}, D.defaults[name], D.sets[force] && D.sets[force][name]);
  const w = Object.assign({}, D.defaults[name], S().wear[name]);
  for (const sl in w) { const it = byId[w[sl]]; if (w[sl] && (!it || !Wd.owns(it))) w[sl] = (D.defaults[name] || {})[sl] || null; } // lost grant -> default
  return w;
};
// final spec for buildCat(): base cat + accessories of every equipped slot
Wd.spec = function (name, forceVip) {
  const R3 = VP.R3, base = (name === 'avatar' && VP.S.avatar) ? VP.S.avatar : R3.SPECS[name];
  if (!base) return R3.SPECS.mimo;
  const out = Object.assign({}, base, { acc: {} });
  if (!NAMES.includes(name)) { out.acc = Object.assign({}, base.acc); return out; }
  const w = Wd.wearing(name, forceVip ? 'vip' : null);
  for (const sl of D.slots) { const it = byId[w[sl]]; if (!it) continue; if (it.acc) Object.assign(out.acc, it.acc); if (it.trail) out.trail = it.trail; if (it.grant === 'vip' && sl === 'body') out.shiny = 1; }
  return out;
};
Wd.equipSet = function (set) { const s = S(); for (const n of NAMES) s.wear[n] = Object.assign({}, s.wear[n], D.sets[set][n]); VP.persist(); if (VP.R3.refreshCats) VP.R3.refreshCats(); };

const packOf = it => (D.packs && D.packs[it.grant]) || null;
const price = it => it.free ? t('wd_free') : it.grant ? (it.grant === 'vip' ? '👑 VIP' : packOf(it) ? packOf(it).icon + ' R$' + ((VP.Shop.PRICE || {})[packOf(it).product] || '') : '🎄') : '🪙 ' + it.price;
UI.SCREENS.wardrobe = {
  cls: 'clear', hideHud: true, stage: true,
  html: () => {
    const w = Wd.wearing(Wd.cat), items = D.items.filter(i => i.slot === Wd.slot && (!i.cats || i.cats.includes(Wd.cat)));
    return `<div class="corner l"><button class="chip" data-act="wdBack">‹ ${t('back')}</button></div><div class="corner"><span class="chip" style="display:flex;align-items:center">🪙 ${VP.S.cash}</span></div>
    <div class="wrap narrow" style="margin-top:auto">
      <div class="row">${NAMES.map(n => `<button class="tab ${n === Wd.cat ? 'on' : ''}" data-act="wdCat" data-c="${n}">${t(n)}</button>`).join('')}</div>
      <div class="tabs" style="justify-content:center;flex-wrap:wrap">${D.slots.map(sl => `<button class="tab ${sl === Wd.slot ? 'on' : ''}" data-act="wdSlot" data-s="${sl}">${t('slot_' + sl)}</button>`).join('')}</div>
      <div class="wdgrid">${Wd.slot !== 'body' ? `<button class="wdi ${!w[Wd.slot] ? 'on' : ''}" data-act="wdItem" data-i=""><b>✖</b><span>${t('wd_none')}</span></button>` : ''}
      ${items.map(it => { const own = Wd.owns(it), on = w[Wd.slot] === it.id; return `<button class="wdi ${on ? 'on' : ''} ${own ? '' : 'lock'} ${it.grant === 'vip' ? 'vip' : it.grant ? 'pk' : ''}" data-act="wdItem" data-i="${it.id}"><b>${it.name[VP.lang() === 'pt' ? 'pt' : 'en']}</b><span>${on ? '✓ ' + t('wd_equipped') : own ? '✓' : price(it)}</span></button>`; }).join('')}</div>
      <p class="small">${t('wd_sub')}</p></div>`;
  },
  after: () => { if (Wd.tryPack) { const w = Object.assign({}, S().wear[Wd.cat]); for (const it of D.items) if (it.grant === Wd.tryPack) w[it.slot] = w[it.slot] && byId[w[it.slot]] && byId[w[it.slot]].grant === Wd.tryPack ? w[it.slot] : it.id; Wd.tryPack = null; Wd.preview(w); } else Wd.preview(); },
};
Wd.preview = function (wearOverride) {
  const R3 = VP.R3; if (!R3 || !R3.ok) return;
  let spec = Wd.spec(Wd.cat);
  if (wearOverride) { const s = VP.S, old = s.wear[Wd.cat]; s.wear[Wd.cat] = wearOverride; const keepOwn = Wd.owns; Wd.owns = () => true; spec = Wd.spec(Wd.cat); Wd.owns = keepOwn; s.wear[Wd.cat] = old; }
  R3.showcase([{ spec, x: 0, z: 0, s: 1 }], { dist: 7.2, shift: 2.5, lookY: 1.0 });
};
Wd.open = () => UI.show('wardrobe');
UI.act.wdBack = () => { const G = VP.Game.G; if (VP.R3.refreshCats) VP.R3.refreshCats(); if (G && UI.state === 'play') { UI.hide(); UI.paused = false; } else UI.show('title'); };
UI.act.wdCat = el => { Wd.cat = el.dataset.c; UI.show('wardrobe'); };
UI.act.wdSlot = el => { Wd.slot = el.dataset.s; UI.show('wardrobe'); };
UI.act.wdItem = el => {
  const s = S(), id = el.dataset.i, it = byId[id];
  s.wear[Wd.cat] = s.wear[Wd.cat] || {};
  if (!id) { s.wear[Wd.cat][Wd.slot] = null; VP.persist(); UI.show('wardrobe'); return; }
  if (!Wd.owns(it)) {
    if (it.grant) { Wd.preview(Object.assign({}, s.wear[Wd.cat], { [Wd.slot]: id })); UI.toast((it.grant === 'vip' ? '👑 ' : packOf(it) ? packOf(it).icon + ' ' : '🎄 ') + t('wd_shop') + ' → ' + t('shop'), 2600); return; }
    if (VP.S.cash < it.price) { Wd.preview(Object.assign({}, s.wear[Wd.cat], { [Wd.slot]: id })); UI.toast(t('wd_poor', it.price - VP.S.cash), 2600); return; }
    VP.S.cash -= it.price; s.owned.push(id); UI.toast('🛍 ' + t('wd_bought')); VP.Audio.sfx('cash');
  }
  s.wear[Wd.cat][Wd.slot] = id; VP.persist(); UI.show('wardrobe');
};
})();
