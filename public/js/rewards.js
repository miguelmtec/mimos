'use strict';
// VICE PAWS — special rewards with controlled scarcity (client side).
// The server decides everything rare (POST /api/rewards/claim: caps scale with the number of players, each copy has a serial).
// Guests and offline play only get common things locally; rare items need an account. Nothing here is bought: premium only
// doubles the odds of the performance drop and reveals the golden caches. See api/_lib/rewards.js and data/rewards.json.
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, UI = VP.UI, Game = VP.Game, M = VP.Missions, World = VP.World, P = VP.Prog, ACT = UI.act, SC = UI.SCREENS;
const Rw = VP.Rewards = { cfg: null, rarity: null };
const t = (...a) => VP.t(...a), L = () => (VP.lang() === 'pt' ? 'pt' : 'en');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Object.assign(VP.L, {
  rw_title: ['Raridade', 'Rarity'], rw_sub: ['Itens especiais existem em quantidade limitada: quanto mais jogadores, mais cópias. Ganham-se jogando; nunca se compram, nunca viram dinheiro.', 'Special items exist in limited numbers: the more players, the more copies. They are earned by playing; never bought, never cashed out.'],
  rw_raro: ['Raro', 'Rare'], rw_epico: ['Épico', 'Epic'], rw_lendario: ['Lendário', 'Legendary'], rw_unico: ['Único', 'Unique'], rw_rule: ['1 para cada {0} jogadores', '1 per {0} players'], rw_rule1: ['1 por temporada', '1 per season'],
  rw_exist: ['{0} de {1} existem', '{0} of {1} exist'], rw_first: ['#1 é de {0}', '#1 belongs to {0}'], rw_serial: ['#{0} de {1}', '#{0} of {1}'], rw_got: ['ITEM {0}: {1} {2}', '{0} ITEM: {1} {2}'], rw_sold: ['Esgotado desta vez: +{0} moedas', 'Sold out this time: +{0} coins'],
  rw_guest: ['Achado comum. Entre na conta para concorrer a itens raros!', 'Common find. Sign in to be in the running for rare items!'], rw_cache: ['Caixa secreta!', 'Secret box!'], rw_gold: ['Caixa dourada (Passe)', 'Golden box (Pass)'], rw_natal: ['Presente escondido {0}/25', 'Hidden gift {0}/25'],
  rw_mine: ['Seus itens especiais', 'Your special items'], rw_none: ['Nenhum ainda. 3 estrelas + tempo de ouro + sem desmaios dá chance de um; caixas secretas também.', 'None yet. 3 stars + gold time + no faints gives a chance of one; so do secret boxes.'],
  rw_vault: ['Cofre dos Mimos', "Mimos' Vault"], rw_vaultSub: ['Cada compra na loja enche o cofre de todo mundo. Cheio, a cidade inteira ganha 1 h de chuva de itens.', "Every shop purchase fills everyone's vault. When full, the whole city gets a 1 h item rain."], rw_rain: ['CHUVA DE ITENS! O Cofre dos Mimos encheu.', "ITEM RAIN! Mimos' Vault is full."],
  rw_shop: ['Itens raros não estão à venda. O Passe só dobra a chance do prêmio de desempenho e mostra as caixas douradas; tudo se ganha jogando.', 'Rare items are not for sale. The Pass only doubles the odds of the performance reward and shows the golden boxes; everything is earned by playing.'], rw_perf: ['Desempenho perfeito: concorrendo a um item especial…', 'Perfect run: in the running for a special item…'],
});
const TCOL = { raro: '#2de2e6', epico: '#b967ff', lendario: '#ffd23f', unico: '#ff4fb8' };
const S = () => { const s = VP.S; if (!s.rw || typeof s.rw !== 'object') s.rw = { items: [], caches: {}, season: null }; if (Rw.cfg && s.rw.season !== Rw.cfg.season) { s.rw.season = Rw.cfg.season; s.rw.caches = {}; } return s.rw; };
Rw.S = S;
const api = (path, body) => fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }).then(async r => Object.assign({ status: r.status }, await r.json().catch(() => ({})))).catch(() => ({ status: 0 }));
Rw.api = api;
fetch('data/rewards.json').then(r => (r.ok ? r.json() : null)).then(d => { if (d && d.items) { Rw.cfg = d; Rw.pull(); } }).catch(() => {});
Rw.pull = async function () { const r = await api('/api/rewards/rarity'); if (r.status === 200 && r.items) Rw.rarity = r; if (VP.Acct && VP.Acct.status === 'in') { const m = await api('/api/rewards/mine'); if (m.status === 200 && m.items) { S().items = m.items; VP.persist(); } } return Rw.rarity; };
Rw.logged = () => !!(VP.Acct && VP.Acct.status === 'in');
Rw.premium = () => !!(VP.Shop && (VP.Shop.has('vip') || VP.Shop.has('season')));
Rw.rainOn = () => { const v = Rw.rarity && Rw.rarity.vault; return !!(v && v.filledAt && Rw.cfg && Date.now() - new Date(v.filledAt).getTime() < Rw.cfg.vault.eventMinutes * 60e3); };
const itemDef = id => (Rw.cfg ? Rw.cfg.items.find(i => i.id === id) : null);
const say = (msg, col) => { const G = Game.G; if (G && !G.over && !UI.screen) Game.fx.say(msg, col, 3.6); else UI.toast(msg, 3600); };
// what the server answered -> save + tell the player
Rw.apply = function (r) {
  if (r.status === 200 && r.item) { const s = S(); s.items = s.items.filter(x => x.id !== r.item.id).concat([{ id: r.item.id, tier: r.item.tier, serial: r.serial, minted: r.cap, season: r.season }]); VP.persist(); VP.Audio.sfx('win'); if (UI.confetti) UI.confetti(); say('🌟 ' + t('rw_got', t('rw_' + r.item.tier).toUpperCase(), (r.item.icon || '') + ' ' + r.item.name[L()], t('rw_serial', r.serial, r.cap)), TCOL[r.item.tier]); return 'item'; }
  if (r.status === 200 && r.consolation) { VP.S.cash += r.consolation.coins; VP.persist(); say('🪙 ' + t('rw_sold', r.consolation.coins), '#7CFF6B'); return 'consolation'; }
  return r.status === 200 ? 'miss' : 'none';
};
const common = () => { const id = P.roll(); P.give(id, 1); VP.S.cash += 60; VP.persist(); say('🎁 ' + P.ITEMS[id].icon + ' +60 🪙 · ' + t('rw_guest'), '#ffd23f'); };
Rw.claim = async function (body) { if (!Rw.logged()) { if (body.source === 'cache') common(); return 'guest'; } const r = await api('/api/rewards/claim', body); const out = Rw.apply(r); if (out === 'none' && body.source === 'cache') common(); return out; };
// a) performance drop: 3 stars + gold time + no faints
{ const on0 = P.onResult; P.onResult = function (r, G) {
    on0(r, G); const m = r.m;
    if (!r.win || r.stars !== 3 || !r.noFaint || m.board !== undefined || !VP.Long || r.time > VP.Long.goldTime(m)) return;
    r.perfect = true;
    if (Rw.logged()) { r.rewards.push('🌟 ' + t('rw_perf')); Rw.claim({ source: 'mission', n: m.n, stars: 3, downs: 0, time: Math.round(r.time * 10) / 10, gold: true }); }
    else if (Math.random() < 0.25) { const id = P.roll(); if (P.give(id, 1)) r.rewards.push('🎁 ' + P.ITEMS[id].icon + ' ' + t('it_' + id) + ' · ' + t('rw_guest')); }
  }; }
// b) hidden caches: little glowing boxes tucked in alleys, on pier tips and dead ends (same spots for everyone, per season)
Rw.cachesFor = function (G) {
  const W = G.W, cfg = Rw.cfg; if (!cfg || W.real) return [];
  const month = new Date().getMonth() + 1, r = U.rng(4711 + cfg.season.length * 97), spots = [];
  for (let y = 10; y < W.H - 10; y++) for (let x = 10; x < W.W - 10; x++) { const i = y * W.W + x; if (W.pristine[i] === 0 && W.gnd[i] === 7) { let walls = 0; for (const j of [i - 1, i + 1, i - W.W, i + W.W]) if (W.pristine[j] === 1) walls++; if (walls >= 2) spots.push({ x: (x + 0.5) * T, y: (y + 0.5) * T }); } } // alley corners
  for (const f of W.fish) spots.push({ x: f.x - 20, y: f.y });                                                                                                                                                                       // pier tips
  r.shuffle(spots);
  return cfg.caches.filter(c => !c.month || c.month === month).map((c, k) => Object.assign({ at: spots[(k * 7) % spots.length] }, c)).filter(c => c.at);
};
{ const f0 = P.freeSetup; P.freeSetup = function (G, B, sp, opts) {
    f0(G, B, sp, opts); if (!Rw.cfg || G.W.real || (opts && opts.trial)) return;
    const s = S(), prem = Rw.premium(); G.caches = [];
    for (const c of Rw.cachesFor(G)) { if (s.caches[c.id] || (c.premium && !prem) || (G.lockedHoods && G.lockedHoods[World.distAt(G.W, c.at.x, c.at.y)])) continue; const it = Game.addItem('c_cache', c.at.x, c.at.y); it.cache = c; G.caches.push(it); }
    if (Rw.rainOn()) { const r = U.rng(Date.now() >>> 12); for (let i = 0; i < 40; i++) { const q = G.W.randWalk(r); if (!(G.lockedHoods && G.lockedHoods[World.distAt(G.W, q.x, q.y)])) Game.addItem('c_' + P.roll(r), q.x, q.y); } setTimeout(() => { if (Game.G === G) Game.fx.say('🌧 ' + t('rw_rain'), '#ffd23f', 5); }, 2500); }
  };
  const pick0 = P.pick; P.pick = function (G, c, it) {
    if (!it.cache) return pick0(G, c, it);
    const k = it.cache, s = S(); s.caches[k.id] = 1; VP.persist(); Game.fx.burst(it.x, it.y - 10, 16, [TCOL[k.tier] || '#ffd23f', '#fff'], 200, 'star', 8, 0.9); VP.Audio.sfx('paw');
    const n = Object.keys(s.caches).filter(x => x.startsWith('natal_')).length; Game.fx.text(it.x, it.y - 30, k.month ? '🎁 ' + t('rw_natal', n) : k.premium ? '✨ ' + t('rw_gold') : '📦 ' + t('rw_cache'), '#ffd23f', 15);
    Rw.claim({ source: 'cache', id: k.id }); return true;
  }; }
// ---------- "Raridade": how many of each exist, who owns #1, the vault ----------
SC.rarity = {
  cls: 'glass', hideHud: true,
  html: () => { const cfg = Rw.cfg, ra = Rw.rarity, mine = S().items; if (!cfg) return `<div class="wrap narrow"><p>…</p><button class="btn" data-act="pgBack">${t('back')}</button></div>`;
    const v = ra && ra.vault;
    return `<div class="corner l"><button class="chip" data-act="pgBack">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="gold">💎 ${t('rw_title')}</h2><p class="small">${t('rw_sub')}</p>
      <h3>${t('rw_mine')}</h3>${mine.length ? mine.map(x => { const d = itemDef(x.id) || { name: { pt: x.id, en: x.id }, icon: '🎁' }; return `<div class="pg-item" style="border-color:${TCOL[x.tier]}"><div class="ic">${d.icon}</div><div class="tx"><b>${esc(d.name[L()])}</b><span style="color:${TCOL[x.tier]}">${t('rw_' + x.tier)} · ${t('rw_serial', x.serial, x.minted)}</span></div></div>`; }).join('') : `<p class="small">${t('rw_none')}</p>`}
      ${cfg.vault ? `<div class="panel t"><b>🏦 ${t('rw_vault')}${v ? ' · ' + (v.orders % v.goal) + '/' + v.goal : ''}</b><div class="pg-xp" style="margin:6px 0"><i style="width:${v ? Math.round((v.orders % v.goal) / v.goal * 100) : 0}%"></i></div><p class="small">${t('rw_vaultSub')}${Rw.rainOn() ? '<br>🌧 ' + t('rw_rain') : ''}</p></div>` : ''}
      ${['unico', 'lendario', 'epico', 'raro'].map(tier => `<h3 style="color:${TCOL[tier]}">${t('rw_' + tier)} <span class="small">· ${tier === 'unico' ? t('rw_rule1') : t('rw_rule', cfg.ratios[tier])}</span></h3>${cfg.items.filter(i => i.tier === tier).map(i => { const r = ra && ra.items.find(x => x.id === i.id); return `<div class="pg-item"><div class="ic">${i.icon}</div><div class="tx"><b>${esc(i.name[L()])}</b><span>${r ? t('rw_exist', r.minted, r.cap) + (r.firstOwner ? ' · ' + t('rw_first', esc(r.firstOwner)) : '') : '—'}</span></div></div>`; }).join('')}`).join('')}
      <p class="small">${t('rw_shop')}</p></div>`; },
  after: () => { if (!Rw.pulled) { Rw.pulled = true; Rw.pull().then(() => { if (UI.screen === 'rarity') UI.show('rarity'); }); } },
};
ACT.rarity = () => { if (UI.state === 'play' && Game.G) UI.paused = true; Rw.pulled = false; UI.show('rarity'); };
const wrap = (id, fn) => { const s = SC[id]; if (!s) return; const h0 = s.html; s.html = a => fn(h0(a), a); };
wrap('profile', html => { const mine = S().items; return html.replace('<div class="grid2">', `${mine.length ? `<div class="panel t"><b>💎 ${t('rw_mine')}</b><p class="small">${mine.map(x => { const d = itemDef(x.id) || { name: { pt: x.id, en: x.id }, icon: '🎁' }; return `<span style="color:${TCOL[x.tier]}">${d.icon} ${esc(d.name[L()])} ${t('rw_serial', x.serial, x.minted)}</span>`; }).join('<br>')}</p></div>` : ''}<div class="grid2"><button class="btn ghost sm wide" data-act="rarity">💎 ${t('rw_title')}</button>`); });
wrap('shop', html => html.replace(/<\/div>\s*$/, `<p class="small" style="margin-top:10px">💎 ${t('rw_shop')} <a href="#" data-act="rarity" style="color:#ffd23f">${t('rw_title')} ›</a></p></div>`));
})();
