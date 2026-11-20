'use strict';
// VICE PAWS — the official Mimos as city celebrities. When the player is NOT playing as Mimo, Mimosa and Morticia (own cat via
// "Jogar com meu gato", later: online), the three stars hang out in a plaza wearing the "Look dos Mimos da semana", posing for
// a little crowd of fans with cameras. The player can take a selfie with them and tap "Quero esse look" to see the items.
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, LL = VP.LifeLogic, Game = VP.Game, Life = VP.Life, _ = Life._;
const NAMES = ['mimo', 'mimosa', 'morticia'];
const tr = (...a) => VP.t(...a), lg = () => (VP.lang() === 'pt' ? 'pt' : 'en');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Object.assign(VP.L, {
  lf_celeb: ['Celebridade', 'Celebrity'], lf_lookWeek: ['Look dos Mimos da semana', "The Mimos' look of the week"], lf_selfie: ['Selfie com {0}', 'Selfie with {0}'], lf_wantLook: ['Quero esse look', 'I want this look'],
  lf_openWardrobe: ['Abrir o guarda-roupa', 'Open the wardrobe'], lf_lookOf: ['O look de {0}', "{0}'s look"], lf_free: ['Grátis', 'Free'], lf_inShop: ['Loja dos Mimos', 'Mimos Shop'], lf_noLook: ['Hoje é o visual clássico, sem acessórios.', 'Classic look today, no accessories.'],
  lf_fan: ['{0}! Aqui! 📸|É {0} de verdade!!|Tira uma foto comigo!|Sou muito fã!|Que look lindo!', '{0}! Over here! 📸|It is really {0}!!|Take a photo with me!|I am a huge fan!|What a gorgeous look!'],
  lf_celebHi: ['Miau, fãs! 💛|Prrr… obrigado!|Miau! Foto?', 'Meow, fans! 💛|Prrr… thank you!|Meow! Photo?'], lf_a_celeb: ['Os Mimos estão na praça!', 'The Mimos are at the plaza!'],
});

// Who is a celebrity right now? Every star that is not in the player's party.
Life.celebNames = function () {
  if (Life.forceCelebs) return NAMES.slice();
  const Pa = VP.Party; if (!Pa || typeof Pa.active !== 'function' || !Pa.active()) return [];
  return NAMES.filter(n => typeof Pa.specFor === 'function' && Pa.specFor(n));
};
// feat/progression exports the real getMimosShowcaseLook() ({ cats: { mimo: { items } } }); if it is missing or has no look this falls back to the
// default outfit ids of data/outfits.json. Accepted shapes: { mimo: { slot: itemId } | [itemId...], ... } optionally wrapped as { look, name }.
Life.showcaseLook = function () {
  const fn = VP.getMimosShowcaseLook || (VP.Prog && VP.Prog.getMimosShowcaseLook) || (VP.Wardrobe && VP.Wardrobe.getMimosShowcaseLook) || window.getMimosShowcaseLook;
  const D = (VP.Wardrobe && VP.Wardrobe.data) || { defaults: {}, items: [] }, byId = {}; for (const it of D.items) byId[it.id] = it;
  let raw = null, title = null; try { raw = typeof fn === 'function' ? fn() : null; } catch (e) { raw = null; }
  if (raw && raw.look) { title = raw.name || raw.title || null; raw = raw.look; }
  else if (raw && raw.cats) { // progression's real shape: { id, name, week, cats: { mimo: { spec, items: [itemId...] }, ... } }
    title = raw.name || raw.title || null; const c = {}; for (const n of NAMES) c[n] = raw.cats[n] && raw.cats[n].items; raw = c;
  }
  const out = { title: title && typeof title === 'object' ? title[lg()] : title, stub: !raw };
  for (const n of NAMES) {
    let w = raw && raw[n]; const m = {};
    if (Array.isArray(w)) { for (const id of w) if (byId[id]) m[byId[id].slot] = id; } else if (w && typeof w === 'object') { for (const sl in w) if (byId[w[sl]]) m[sl] = w[sl]; }
    else Object.assign(m, D.defaults[n]); // fallback stub: the default outfit
    out[n] = m;
  }
  return out;
};
Life.celebSpec = function (name) {
  const R3 = VP.R3, base = (R3 && R3.SPECS && R3.SPECS[name]) || {}, D = (VP.Wardrobe && VP.Wardrobe.data) || { slots: [], items: [] }, w = Life.showcaseLook()[name] || {};
  const out = Object.assign({}, base, { acc: {} }); let any = false;
  for (const sl of D.slots) { const it = D.items.find(i => i.id === w[sl]); if (!it) continue; any = true; if (it.acc) Object.assign(out.acc, it.acc); if (it.trail) out.trail = it.trail; }
  if (!any) out.acc = Object.assign({}, base.acc);
  return out;
};

// ---------- placement ----------
_.placeCelebs = function (L) {
  const names = Life.celebNames(); if (!names.length) return;
  const W = L.W, G = L.G, a = G.cats[G.active]; let spot = null, face = Math.PI / 2;
  const free = (x, y) => !W.blocked(x, y, 16, 0) && _.farFrom(L, x, y, 84) && (!G.field || W.distAt(G.field, x, y) >= 0);
  if (!W.real) {
    let bd = 1e12;
    for (const lot of W.lots) { if (lot.type !== 'plaza' && lot.type !== 'arena') continue; for (const [fx, fy] of [[4, 2.6], [4, 5.2], [2.6, 4]]) { const x = (lot.tx + fx) * T, y = (lot.ty + fy) * T, d = U.d2(x, y, a.x, a.y); if (d > 240 * 240 && d < bd && free(x, y) && free(x - 44, y) && free(x + 44, y) && free(x, y + 96)) { bd = d; spot = { x, y }; } } }
  } else {
    const pool = LL.nodesInRing(L.net, a.x, a.y, 200, 700, []);
    for (const i of pool) { const x = L.net.x[i], y = L.net.y[i]; if (free(x, y) && free(x - 44, y) && free(x + 44, y)) { spot = { x, y }; break; } }
  }
  if (!spot) return;
  L.celebSpot = spot; L.celebs = [];
  names.forEach((n, i) => {
    const x = spot.x + (i - (names.length - 1) / 2) * 46, c = { kind: 'cat', id: L.id++, x, y: spot.y, a: face, st: 'celeb', timer: i * 1.3, t: i * 2, walk: 0, sit: 0, emo: 'wave', name: tr(n), star: n, celeb: true, fixed: true, friend: true, lift: 0.52, cool: 0, bub: null, fade: 1, size: 1, spec: Life.celebSpec(n), mood: 'friendly' };
    L.animals.push(c); L.celebs.push(c);
  });
  // the fans: a half circle in front, cameras up
  const N = 7; let k = 0;
  for (let i = 0; i < N; i++) {
    if (i === 3) continue; const an = face + (i - (N - 1) / 2) * 0.4, r = 112 + (i % 2) * 28, x = spot.x + Math.cos(an) * r, y = spot.y + Math.sin(an) * r; if (W.blocked(x, y, 10, 0)) continue;
    const p = _.makePed(L, i % 3 === 1 ? 'kid' : i % 3 === 2 ? 'tourist' : 'walker', x, y, 0, 0); p.st = 'fan'; p.fixed = true; p.fade = 1; p.cam = i % 3 !== 1 ? 1 : 0; p.a = an + Math.PI; p.star = L.celebs[k++ % L.celebs.length]; p.timer = 1 + i * 0.9; p.home = { x, y, a: p.a }; p.homeSt = 'fan';
  }
  L.props.push({ k: 'celeb', x: spot.x, y: spot.y + 40, a: 0, t: 0, cd: 0, r: 0, soft: true, id: L.props.length });
  Life.ACTS.celeb = ['⭐', 'lf_a_celeb'];
};
// extra states plugged into the generic pedestrian / animal updates
_.pedState = _.pedState || {};
_.pedState.fan = function (L, p, dt, a, near) {
  const s = p.star; p.a += U.angDiff(p.a, Math.atan2(s.y - p.y, s.x - p.x)) * Math.min(1, dt * 6);
  p.timer -= dt; p.pose = p.cam ? 2 : Math.sin(p.t * 3 + p.id) > 0 ? 3 : 0; p.hop = !p.cam && Math.sin(p.t * 6 + p.id) > 0.7 ? 1 : 0;
  if (p.timer <= 0) { p.timer = U.rand(3.5, 8); if (!near) return; if (p.cam) Game.fx.part({ x: p.x + Math.cos(p.a) * 14, y: p.y + Math.sin(p.a) * 14 - 40, k: 'flash', size: 16, life: 0.16, col: '#ffffff' }); if (Math.random() < 0.6) _.say(p, Life.line('lf_fan', s.name), 2.2); }
};
_.animalState = _.animalState || {};
_.animalState.celeb = function (L, c, dt, a) {
  c.timer -= dt; if (c.timer <= 0) { c.timer = U.rand(3, 5.5); c.emo = c.emo === 'wave' ? 'sit' : c.emo === 'sit' ? 'dance' : 'wave'; if (Math.random() < 0.35 && U.d2(c.x, c.y, a.x, a.y) < 420 * 420) _.say(c, Life.line('lf_celebHi'), 2); }
  if (L.selfie === c) { c.emo = 'wave'; if (VP.R3 && VP.R3.yaw !== undefined) c.a += U.angDiff(c.a, VP.R3.yaw + Math.PI) * Math.min(1, dt * 6); } else c.a += U.angDiff(c.a, Math.PI / 2) * Math.min(1, dt * 3);
};

// ---------- panels ----------
Life.celebPanel = function (c) {
  const look = Life.showcaseLook();
  Life.openPanel(`<div class="lf-head"><div class="lf-ico">⭐</div><div><h3>${esc(c.name)}</h3><p>${esc(tr('lf_celeb'))} · ${esc(look.title || tr('lf_lookWeek'))}</p></div><button class="lf-x" data-life="close">✕</button></div>
  <div class="lf-items"><button class="lf-item" data-life="selfie" data-n="${c.star}"><span class="lf-ii">📸</span><span class="lf-it"><b>${esc(tr('lf_selfie', c.name))}</b><i>${esc(tr('lf_snapHint'))}</i></span></button>
  <button class="lf-item" data-life="wantLook" data-n="${c.star}"><span class="lf-ii">👗</span><span class="lf-it"><b>${esc(tr('lf_wantLook'))}</b><i>${esc(tr('lf_lookWeek'))}</i></span></button></div>`, 'celeb');
};
Life.lookInfo = function (name) {
  const D = (VP.Wardrobe && VP.Wardrobe.data) || { slots: [], items: [], packs: {} }, w = Life.showcaseLook()[name] || {}, rows = [];
  for (const sl of D.slots) { const it = D.items.find(i => i.id === w[sl]); if (!it) continue; const own = VP.Wardrobe.owns(it), how = it.free ? tr('lf_free') : it.grant ? (it.grant === 'vip' ? '👑 VIP · ' : '') + tr('lf_inShop') : '🪙 ' + it.price; rows.push(`<div class="lf-item still"><span class="lf-ii">${{ head: '🎩', eyes: '🕶️', neck: '🧣', body: '👕', back: '🎒', trail: '✨' }[sl] || '👗'}</span><span class="lf-it"><b>${esc(it.name[lg()])}</b><i>${esc(tr('slot_' + sl))}</i></span><span class="lf-price">${own ? '✓' : esc(how)}</span></div>`); }
  Life.openPanel(`<div class="lf-head"><div class="lf-ico">👗</div><div><h3>${esc(tr('lf_lookOf', tr(name)))}</h3><p>${esc(tr('lf_lookWeek'))}</p></div><button class="lf-x" data-life="close">✕</button></div>
  <div class="lf-items">${rows.join('') || `<p class="lf-note">${esc(tr('lf_noLook'))}</p>`}</div>
  <button class="lf-favor" data-life="lookWardrobe" data-n="${name}">👚 ${esc(tr('lf_openWardrobe'))}</button>`, 'look');
};
Life.act.selfie = el => { const G = Game.G, L = G && G.life, c = L && (L.celebs || []).find(k => k.star === el.dataset.n); Life.closePanel(); if (c && Life.photo) Life.photo.open({ celeb: c }); };
Life.act.wantLook = el => Life.lookInfo(el.dataset.n);
Life.act.lookWardrobe = el => { Life.closePanel(); if (Life.photo && Life.photo.on) Life.photo.close(); if (VP.Wardrobe) { VP.Wardrobe.cat = el.dataset.n; VP.UI.paused = true; VP.Wardrobe.open(); } };
})();
