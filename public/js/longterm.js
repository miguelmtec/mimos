'use strict';
// VICE PAWS — long-term play, with no hard "end":
//   * Adote do Abrigo: rescue stray cats (72 variants in data/shelter.json), care for them, find them a home, fill the album
//   * Missões da Cidade: an endless board of missions generated from the hand-made ones, seeded per day, scaled to the cats' level
//   * mastery (gold time per mission), 100+ achievements with badges, weekly points (local for now), the profile card
// Nothing here can be bought: rare cats come from exploring, everything else from playing.
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, UI = VP.UI, Game = VP.Game, M = VP.Missions, World = VP.World, P = VP.Prog, ACT = UI.act, SC = UI.SCREENS;
const Lg = VP.Long = { data: null };
const t = (...a) => VP.t(...a), L = () => (VP.lang() === 'pt' ? 'pt' : 'en');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Object.assign(VP.L, {
  lg_shelter: ['Adote do Abrigo', 'Shelter Adoption'], lg_album: ['Álbum', 'Album'], lg_albumN: ['{0} de {1} gatinhos conhecidos · {2} lares encontrados', '{0} of {1} cats met · {2} homes found'], lg_empty: ['Nenhum gatinho no abrigo agora. Resgate um em missões, patrulhas ou explorando a cidade!', 'No cats in the shelter right now. Rescue one in missions, patrols or by exploring the city!'],
  lg_cap: ['{0}/{1} vagas', '{0}/{1} places'], lg_full: ['Abrigo cheio: encontre um lar para alguém primeiro', 'Shelter full: find someone a home first'], lg_ready: ['Pronto para um lar!', 'Ready for a home!'], lg_home: ['Encontrar um lar', 'Find a home'], lg_care: ['Cuidados {0}/4', 'Care {0}/4'],
  lg_wait: ['{0}s', '{0}s'], lg_rescued: ['Resgatado: {0}!', 'Rescued: {0}!'], lg_new: ['NOVO no álbum', 'NEW in the album'], lg_stray: ['Gatinho perdido', 'Lost kitten'], lg_strayGot: ['{0} vai para o abrigo!', '{0} is going to the shelter!'],
  lg_homeCard: ['{0} ganhou um lar! A nova família já está apaixonada.', '{0} found a home! The new family is already in love.'], lg_homeRw: ['+{0} moedas · +{1} XP', '+{0} coins · +{1} XP'], lg_r0: ['comum', 'common'], lg_r1: ['incomum', 'uncommon'], lg_r2: ['raro', 'rare'],
  lg_rareTip: ['Os raros só aparecem perdidos pela cidade: explore todos os bairros.', 'Rare ones only turn up lost around town: explore every neighbourhood.'], lg_unknown: ['???', '???'], lg_closed: ['O abrigo ainda está fechado. Termine o capítulo 1 para abrir as primeiras vagas.', 'The shelter is still shut. Finish chapter 1 to open the first places.'],
  bd_title: ['Missões da Cidade', 'City Missions'], bd_sub: ['Novas todo dia, sem fim. Ficam mais difíceis conforme seus gatos sobem de nível.', 'New every day, endless. They get harder as your cats level up.'], bd_more: ['Mais missões', 'More missions'], bd_done: ['feita', 'done'], bd_rw: ['🪙 +{0} bônus', '🪙 +{0} bonus'], bd_bonus: ['Quadro da cidade: +{0} moedas', 'City board: +{0} coins'],
  ms_gold: ['Tempo de ouro!', 'Gold time!'], ms_goldT: ['Ouro: {0}', 'Gold: {0}'],
  ah_title: ['Conquistas', 'Achievements'], ah_got: ['Conquista: {0}', 'Achievement: {0}'], ah_n: ['{0} de {1}', '{0} of {1}'],
  pf_title: ['Perfil', 'Profile'], pf_power: ['Poder', 'Power'], pf_style: ['Estilo', 'Style'], pf_week: ['Pontos da semana', 'Weekly points'], pf_weekSub: ['Ranking semanal local por enquanto; o online chega com a API.', 'Local weekly board for now; the online one arrives with the API.'], pf_best: ['Melhor semana: {0}', 'Best week: {0}'],
  tr_bronze: ['Bronze', 'Bronze'], tr_prata: ['Prata', 'Silver'], tr_ouro: ['Ouro', 'Gold'], tr_diamante: ['Diamante', 'Diamond'], tr_lenda: ['Lenda', 'Legend'],
  ah_wins: ['Missões vencidas', 'Missions won'], ah_stars: ['Estrelas', 'Stars'], ah_three: ['Missões com 3 estrelas', '3-star missions'], ah_gold: ['Tempos de ouro', 'Gold times'], ah_ko: ['Cachorros nocauteados', 'Dogs knocked out'], ah_patrols: ['Patrulhas derrotadas', 'Patrols beaten'],
  ah_fish: ['Peixes pescados', 'Fish caught'], ah_used: ['Itens usados', 'Items used'], ah_rescued: ['Gatinhos resgatados', 'Cats rescued'], ah_homes: ['Lares encontrados', 'Homes found'], ah_album: ['Variantes no álbum', 'Album variants'], ah_levels: ['Níveis somados dos gatos', 'Combined cat levels'],
  ah_ups: ['Melhorias compradas', 'Upgrades bought'], ah_paws: ['Patinhas douradas', 'Golden paws'], ah_lands: ['Cartões-postais', 'Landmarks'], ah_board: ['Missões da Cidade', 'City Missions'], ah_care: ['Cuidados no abrigo', 'Shelter care actions'], ah_coins: ['Moedas ganhas', 'Coins earned'],
});
const S = () => { const s = VP.S; if (!s.long || typeof s.long !== 'object') s.long = {}; const l = s.long, f = { res: [], album: {}, cnt: {}, ach: {}, gold: {}, week: { k: 0, pts: 0, best: 0 }, board: { k: 0, done: {} }, strays: { k: 0, got: {} } }; for (const k in f) if (!l[k]) l[k] = f[k]; return l; };
Lg.S = S;
const cnt = (k, n) => { const c = S().cnt; c[k] = (c[k] || 0) + (n === undefined ? 1 : n); };
fetch('data/shelter.json').then(r => (r.ok ? r.json() : null)).then(d => { if (d && d.cats) Lg.data = d; }).catch(() => {});
const D = () => Lg.data || { cats: [], care: [], rewards: { care: { coins: 10, xp: 5 }, home: [{ coins: 150, xp: 60 }] }, names: ['Mingau'], breeds: [] };
const catDef = id => D().cats.find(c => c.id === id);
const CARE_NEED = 4;

// ---------- shelter ----------
Lg.cap = () => { const st = VP.Story ? VP.Story.stage() : 5; return st <= 0 && !M.allOpen ? 0 : 2 + (M.allOpen ? 5 : st); };
// pick a variant: rarity 0/1 from missions and patrols (weights 85/15); rarity 2 only through Lg.rescue(…, 'stray')
Lg.pick = function (r, rare) {
  const all = D().cats; if (!all.length) return null;
  const pool = all.filter(c => (rare ? c.rarity === 2 : c.rarity === (r() < 0.15 ? 1 : 0)));
  const list = pool.length ? pool : all.filter(c => c.rarity < 2);
  return list[Math.floor(r() * list.length)];
};
Lg.rescue = function (def, why) {
  if (!def) return null; const s = S();
  if (s.res.length >= Lg.cap()) return null;
  const names = D().names, isNew = !s.album[def.id];
  const cat = { v: def.id, name: names[Math.floor(Math.random() * names.length)], care: {}, n: 0, t: Date.now() };
  s.res.push(cat); s.album[def.id] = s.album[def.id] || { seen: 1, homes: 0 }; cnt('rescued'); VP.persist();
  return { cat, def, isNew, why };
};
// one care action at a time: after each one the cat rests for that action's cooldown before the next
Lg.careLeft = (cat, a) => { if (cat.care[a.id]) return 0; const last = Math.max(0, ...Object.values(cat.care)); return Math.max(0, Math.ceil((last + a.cd * 1000 - Date.now()) / 1000)); };
Lg.doCare = function (i, id) {
  const s = S(), cat = s.res[i], a = D().care.find(x => x.id === id); if (!cat || !a || cat.care[id] || Lg.careLeft(cat, a) > 0 || cat.n >= CARE_NEED) return false;
  cat.care[id] = Date.now(); cat.n++; const rw = D().rewards.care; VP.S.cash += rw.coins; for (const n of P.CATS) P.addXp(n, rw.xp, null); cnt('care'); P.save(); return true;
};
Lg.findHome = function (i) {
  const s = S(), cat = s.res[i]; if (!cat || cat.n < CARE_NEED) return null;
  const def = catDef(cat.v) || { rarity: 0, name: { pt: 'Gatinho', en: 'Kitten' } }, rw = D().rewards.home[def.rarity] || D().rewards.home[0];
  s.res.splice(i, 1); s.album[cat.v] = s.album[cat.v] || { seen: 1, homes: 0 }; s.album[cat.v].homes++; VP.S.cash += rw.coins; for (const n of P.CATS) P.addXp(n, rw.xp, null); cnt('homes'); P.save();
  return { cat, def, rw };
};
const thumbs = {};
const thumb = def => { if (thumbs[def.id] !== undefined) return thumbs[def.id]; const R3 = VP.R3; if (!R3 || !R3.ok || !R3.snapshot) return ''; try { const cv = R3.snapshot([{ spec: def.spec, s: 1.3 }], 128, 128); thumbs[def.id] = cv ? cv.toDataURL('image/jpeg', 0.8) : ''; } catch (e) { thumbs[def.id] = ''; } return thumbs[def.id]; };
const RAR = ['#c9ced6', '#2de2e6', '#ffd23f'];
{ const css = document.createElement('style'); css.textContent = `.lg-cat{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.07);border:2px solid var(--r,rgba(255,255,255,.16));border-radius:16px;padding:8px 10px;margin:7px 0;text-align:left}.lg-cat img,.lg-cat .ph{width:64px;height:64px;border-radius:14px;background:#2a0b4a;object-fit:cover;flex:0 0 64px;display:grid;place-items:center;font-size:30px}
.lg-cat .tx{flex:1;min-width:0}.lg-cat b{display:block;font-size:15px}.lg-cat .small{display:block}.lg-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}.lg-acts button{min-height:40px;border-radius:11px;border:2px solid rgba(255,255,255,.3);background:rgba(18,4,31,.5);color:#fff;font:800 11px system-ui;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:3px}.lg-acts button span{font-size:17px}.lg-acts button.done{border-color:#7CFF6B;background:rgba(124,255,107,.15)}.lg-acts button.cd{opacity:.5}
.lg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:7px;margin:8px 0}.lg-cell{background:rgba(255,255,255,.06);border:2px solid var(--r);border-radius:14px;padding:6px 4px;text-align:center;font-size:11px;line-height:1.2;min-height:118px}.lg-cell img,.lg-cell .ph{width:64px;height:64px;border-radius:12px;background:#2a0b4a;display:grid;place-items:center;margin:0 auto 3px;font-size:26px;object-fit:cover}.lg-cell.no{opacity:.5}.lg-cell em{font-style:normal;color:#ffd23f;display:block}
.ah-row{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.06);border-radius:14px;padding:7px 10px;margin:5px 0;text-align:left}.ah-row .bd{display:flex;gap:3px}.ah-row .bd i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-style:normal;background:rgba(18,4,31,.6);border:2px solid rgba(255,255,255,.2);opacity:.45}.ah-row .bd i.on{opacity:1;border-color:var(--c);box-shadow:0 0 8px var(--c)}.ah-row .tx{flex:1;font-size:13px}.ah-row .tx b{display:block}
.pf-cats{display:flex;gap:8px;justify-content:center;margin:8px 0}.pf-cat{flex:1;text-align:center;font-size:12px}.pf-cat img,.pf-cat .ph{width:74px;height:74px;border-radius:50%;object-fit:cover;border:4px solid var(--c);box-shadow:0 0 16px var(--c);background:#2a0b4a;display:inline-grid;place-items:center;font-size:30px}.pf-cat b{display:block;font-size:14px}.pf-big{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center}.pf-big div{background:rgba(18,4,31,.55);border-radius:14px;padding:8px 4px;font-size:11.5px}.pf-big b{display:block;font-size:22px;color:#ffd23f}`; document.head.appendChild(css); }
const back = `<div class="corner l"><button class="chip" data-act="pgBack">‹ ${'{b}'}</button></div>`;
const head = (title, cls) => back.replace('{b}', t('back')) + `<div class="wrap narrow" style="margin-top:46px"><h2 class="${cls || 'gold'}">${title}</h2>`;
const pic = def => { const u = thumb(def); return u ? `<img src="${u}" alt="">` : '<span class="ph">🐱</span>'; };
SC.shelter = {
  cls: 'glass', hideHud: true,
  html: () => {
    const s = S(), cap = Lg.cap(), d = D(), known = Object.keys(s.album).length, homes = Object.values(s.album).reduce((a, b) => a + (b.homes || 0), 0);
    return head('🏠 ' + t('lg_shelter')) + `<p class="small">${VP.Story ? t('sy_stage', VP.Story.stage()) + ' · ' : ''}${t('lg_cap', s.res.length, cap)} · 📖 ${known}/${d.cats.length}</p>
      ${cap === 0 ? `<div class="panel t"><p>${t('lg_closed')}</p></div>` : s.res.length ? s.res.map((c, i) => { const def = catDef(c.v) || { id: c.v, name: { pt: '?', en: '?' }, rarity: 0, spec: {} }, ready = c.n >= CARE_NEED; return `<div class="lg-cat" style="--r:${RAR[def.rarity]}">${pic(def)}<div class="tx"><b>${esc(c.name)}</b><span class="small">${esc(def.name[L()])} · ${t('lg_r' + def.rarity)}</span><span class="small ${ready ? 'gold' : ''}">${ready ? '💛 ' + t('lg_ready') : t('lg_care', c.n)}</span>
        ${ready ? `<button class="btn gold sm" style="margin:6px 0 0" data-act="lgHome" data-i="${i}">🏡 ${t('lg_home')}</button>` : `<div class="lg-acts">${d.care.map(a => { const left = Lg.careLeft(c, a), did = !!c.care[a.id]; return `<button class="${did ? 'done' : ''} ${left ? 'cd' : ''}" data-act="lgCare" data-i="${i}" data-id="${a.id}"><span>${a.icon}</span>${left ? t('lg_wait', left) : esc(a.name[L()])}</button>`; }).join('')}</div>`}</div></div>`; }).join('') : `<div class="panel t"><p>${t('lg_empty')}</p></div>`}
      <div class="grid2"><button class="btn teal sm" data-act="album">📖 ${t('lg_album')}</button><button class="btn ghost sm" data-act="board">📌 ${t('bd_title')}</button></div><p class="small">${t('lg_albumN', known, d.cats.length, homes)}</p></div>`;
  },
};
Lg.openShelter = () => { if (UI.state === 'play' && Game.G) UI.paused = true; UI.show('shelter'); };
ACT.shelter = Lg.openShelter;
ACT.lgCare = el => { if (Lg.doCare(+el.dataset.i, el.dataset.id)) VP.Audio.sfx('pickup'); UI.show('shelter'); };
ACT.lgHome = el => { const r = Lg.findHome(+el.dataset.i); if (!r) return; VP.Audio.sfx('win'); UI.confetti(); checkAch(); if (VP.Story) VP.Story.show('home' + Date.now(), [{ who: 'all', emo: '🏡', pt: t('lg_homeCard', r.cat.name) + ' ' + t('lg_homeRw', r.rw.coins, r.rw.xp), en: t('lg_homeCard', r.cat.name) + ' ' + t('lg_homeRw', r.rw.coins, r.rw.xp) }], () => UI.show('shelter'), '🏡 ' + t('lg_home')); else UI.show('shelter'); };
SC.album = {
  cls: 'glass', hideHud: true,
  html: () => { const s = S(), d = D(); return head('📖 ' + t('lg_album'), 'teal') + `<p class="small">${t('lg_albumN', Object.keys(s.album).length, d.cats.length, Object.values(s.album).reduce((a, b) => a + (b.homes || 0), 0))}<br>💡 ${t('lg_rareTip')}</p>
    ${d.breeds.map(b => `<h3 style="margin:10px 0 0">${esc(b.name[L()])}</h3><div class="lg-grid">${d.cats.filter(c => c.breed === b.id).map(c => { const a = s.album[c.id]; return `<div class="lg-cell ${a ? '' : 'no'}" style="--r:${RAR[c.rarity]}">${a ? pic(c) : '<span class="ph">❔</span>'}${a ? esc(c.name[L()]) : t('lg_unknown')}<em>${t('lg_r' + c.rarity)}${a && a.homes ? ' · 🏡' + a.homes : ''}</em></div>`; }).join('')}</div>`).join('')}
    <button class="btn ghost" data-act="shelter">${t('back')}</button></div>`; },
};
ACT.album = () => UI.show('album');

// strays lost around the open neighbourhoods: three a day, at least one of them a rare variant
Lg.freeSetup = function (G, B) {
  const W = G.W, s = S(), key = M.dayKey(); if (!D().cats.length || G.trial) return;
  if (s.strays.k !== key) s.strays = { k: key, got: {} };
  const r = U.rng(key * 17 + (W.real ? W.real.id.length * 131 : 5)), n = W.real ? 1 : 3;
  for (let i = 0; i < n; i++) {
    const def = Lg.pick(r, i === 0), id = (W.real ? W.real.id : 'home') + '_' + i; let q = null;
    for (let k = 0; k < 40 && !q; k++) { const c = W.randWalk(r); if (!(G.lockedHoods && G.lockedHoods[World.distAt(W, c.x, c.y)]) && !World.edgeAt(W, c.x, c.y)) q = c; }
    if (!q || !def || s.strays.got[id]) continue;
    const f = Game.addFriend(q.x, q.y, 'f' + (i % 4)); f.spec = def.spec; f.stay = true; f.stray = true;
    const mk = { x: q.x, y: q.y, k: 'stray', col: RAR[def.rarity], lbl: '🐱 ' + t('lg_stray'), thin: true, quiet: true, sid: id, def, f };
    mk.act = () => { const got = Lg.rescue(def, 'stray'); if (!got) { Game.fx.say('🏠 ' + t(Lg.cap() ? 'lg_full' : 'lg_closed'), '#ffb347', 3); return; } s.strays.got[id] = 1; G.markers.splice(G.markers.indexOf(mk), 1); G.friends.splice(G.friends.indexOf(f), 1); Game.fx.burst(f.x, f.y - 16, 16, ['#ff7ac0', '#fff', '#ffd23f'], 180, 'heart', 8, 0.9); VP.Audio.sfx('revive'); Game.fx.say('💛 ' + t('lg_strayGot', def.name[L()]) + (got.isNew ? ' · ' + t('lg_new') : ''), '#ffd23f', 3.5); if (G.guide && G.guide.src === mk) G.guide = null; VP.persist(); };
    G.markers.push(mk); (G.strays = G.strays || []).push(mk);
  }
};

// ---------- Missões da Cidade: endless, seeded per day ----------
const BOARD0 = 6000, SAFE = ['waves', 'eat', 'steal', 'cash', 'race', 'defend', 'photo', 'kites', 'fish', 'volley', 'chain', 'parkour', 'duel', 'escape', 'kittens', 'stealth', 'escort', 'reach', 'rescue'];
Lg.boardLv = i => { const avg = P.CATS.reduce((a, n) => a + P.level(n).lv, 0) / 3; return Math.max(1, Math.min(50, Math.round(1 + avg * 0.55 + Math.min(40, VP.S.unlocked) * 0.35 + Math.floor(i / 6) * 2))); };
Lg.boardMission = function (i, day) {
  const key = day || M.dayKey(), r = U.rng(key * 613 + i * 7919 + 3);
  const open = M.list.filter(m => SAFE.includes(m.type) && !m.boss && (M.allOpen || (m.d <= 4 ? m.n < VP.S.unlocked || m.n === 1 : M.unlocked(m)) && (!VP.Story || VP.Story.hoodOpen(m.geo))));
  const pool = open.length ? open : M.list.filter(m => m.n === 1), tp = pool[Math.floor(r() * pool.length)], lv = Lg.boardLv(i);
  return { n: BOARD0 + i, board: i, geo: tp.geo, d: tp.d, type: tp.type, name: ['📌 ' + tp.name[0], '📌 ' + tp.name[1]], p: Object.assign({}, tp.p, { reward: 60 + lv * 6 }), lv, par: tp.par, hunger: tp.hunger, boss: null, bonus: true, side: true, talk: null, tpl: tp.n };
};
{ const get0 = M.get; M.get = n => (n >= BOARD0 && n < BOARD0 + 5000 ? Lg.boardMission(n - BOARD0) : get0(n)); }
const boardState = () => { const s = S(), key = M.dayKey(); if (s.board.k !== key) s.board = { k: key, done: {}, more: 0 }; return s.board; };
SC.board = {
  cls: 'glass', hideHud: true,
  html: () => { const b = boardState(), n = 6 + (b.more || 0) * 6; let rows = ''; for (let i = 0; i < n; i++) { const m = Lg.boardMission(i), st = b.done[i]; rows += `<div class="mrow ${st ? 'done' : ''}"><div style="flex:1"><b>${esc(VP.mname(m))}</b><br><span class="small">${t('b_' + m.type).split('.')[0]} · ${t('pg_lv')} ${m.lv} · ${t('bd_rw', m.p.reward)}</span></div>${st ? `<span class="okb">${'★'.repeat(st)} ${t('bd_done')}</span>` : ''}<button class="btn sm" data-act="brief" data-n="${m.n}">▶</button></div>`; }
    return head('📌 ' + t('bd_title')) + `<p class="small">${t('bd_sub')}</p>${rows}<div class="grid2"><button class="btn teal sm" data-act="boardMore">＋ ${t('bd_more')}</button><button class="btn ghost sm" data-act="pgBack">${t('back')}</button></div></div>`; },
};
ACT.board = () => { if (UI.state === 'play' && Game.G) UI.paused = true; UI.show('board'); };
ACT.boardMore = () => { const b = boardState(); b.more = (b.more || 0) + 1; VP.persist(); UI.show('board'); const sc = document.getElementById('s-board'); if (sc) sc.scrollTop = sc.scrollHeight; };
{ const s = SC.brief, h0 = s.html; s.html = n => { let html = h0(n); const m = M.get(n); if (m && m.board !== undefined) html = html.replace(t('b_trial'), t('b_' + m.type)).replace('🏁 ' + t('trial'), '📌 ' + t('bd_title')).replace(/data-act="(closeBrief|map)"/g, 'data-act="board"'); else if (m && !m.side) html = html.replace('<p class="small">⏱', `<p class="small">🥇 ${t('ms_goldT', U.fmtTime(Lg.goldTime(m)))}${S().gold[n] ? ' ✔' : ''} · ⏱`); return html; }; }

// ---------- mastery, weekly points, achievements ----------
Lg.goldTime = m => Math.max(10, Math.round(M.par(m) * 0.6));
Lg.weekKey = d => { d = d || new Date(); return Math.floor((d.getTime() - new Date('2026-01-05T00:00:00').getTime()) / (7 * 864e5)); };
const TIERS = [1, 5, 15, 40, 100, 250], TCOL = ['#c98f4b', '#c9ced6', '#ffd23f', '#8ff3ff', '#ff7ac0', '#b967ff'], SCALE = { stars: 3, ko: 10, coins: 500, levels: 1, album: 0.4, ups: 0.07, lands: 1, used: 1, care: 2, paws: 0.25, gold: 0.5, three: 0.6, patrols: 0.6, fish: 2, homes: 0.4, rescued: 0.5, board: 0.6, wins: 1 };
const ICON = { wins: '🎯', stars: '⭐', three: '🌟', gold: '🥇', ko: '💥', patrols: '🚨', fish: '🎣', used: '🎒', rescued: '🐱', homes: '🏡', album: '📖', levels: '⬆', ups: '🧬', paws: '🐾', lands: '📸', board: '📌', care: '🪮', coins: '🪙' };
Lg.ACH = Object.keys(ICON); // 18 counters x 6 tiers = 108 achievements
Lg.goalOf = (k, i) => Math.max(i + 1, Math.round(TIERS[i] * (SCALE[k] || 1)));
Lg.value = function (k) {
  const VS = VP.S, s = S(), ps = P.S();
  switch (k) {
    case 'wins': return Object.values(VS.stars).filter(v => v > 0).length + (s.cnt.board || 0);
    case 'stars': return VP.totalStars(); case 'three': return Object.values(VS.stars).filter(v => v === 3).length; case 'gold': return Object.keys(s.gold).length;
    case 'patrols': return ps.stats.patrols || 0; case 'fish': return ps.stats.fish || 0; case 'used': return ps.stats.used || 0;
    case 'album': return Object.keys(s.album).length; case 'levels': return P.CATS.reduce((a, n) => a + P.level(n).lv, 0); case 'ups': return Object.keys(ps.up).length;
    case 'paws': return Object.keys(VS.paws || {}).length; case 'lands': { let n = 0; for (const id in VS.tour || {}) n += Object.keys(VS.tour[id].seen || {}).length; return n; }
    default: return s.cnt[k] || 0;
  }
};
function checkAch(G) {
  const s = S(); let got = 0;
  for (const k of Lg.ACH) { const v = Lg.value(k); for (let i = 0; i < TIERS.length; i++) { const id = k + i; if (!s.ach[id] && v >= Lg.goalOf(k, i)) { s.ach[id] = 1; got++; const rw = 40 * (i + 1); VP.S.cash += rw; const msg = '🏅 ' + t('ah_got', t('ah_' + k) + ' ' + Lg.goalOf(k, i)) + ' · 🪙 +' + rw; if (G && !G.over && !UI.screen) Game.fx.say(msg, TCOL[i], 3); else UI.toast(msg, 2600); } } }
  if (got) VP.persist(); return got;
}
Lg.checkAch = checkAch;
Lg.achCount = () => Object.keys(S().ach).length;
SC.ach = {
  cls: 'glass', hideHud: true,
  html: () => { const s = S(); return head('🏅 ' + t('ah_title')) + `<p class="small">${t('ah_n', Lg.achCount(), Lg.ACH.length * TIERS.length)}</p>
    ${Lg.ACH.map(k => { const v = Lg.value(k), nx = TIERS.findIndex((_, i) => !s.ach[k + i]); return `<div class="ah-row"><span style="font-size:24px">${ICON[k]}</span><div class="tx"><b>${t('ah_' + k)}</b>${nx < 0 ? '✔ ' + v : Math.min(v, Lg.goalOf(k, nx)) + ' / ' + Lg.goalOf(k, nx)}</div><div class="bd">${TIERS.map((_, i) => `<i class="${s.ach[k + i] ? 'on' : ''}" style="--c:${TCOL[i]}">${s.ach[k + i] ? '★' : ''}</i>`).join('')}</div></div>`; }).join('')}
    <button class="btn ghost" data-act="profile">${t('back')}</button></div>`; },
};
ACT.ach = () => { checkAch(); UI.show('ach'); };
// profile card: level tiers (frame + glow), Poder, style, weekly points
Lg.style = function () { const Wd = VP.Wardrobe; if (!Wd || !Wd.data) return 0; let sc = 0; for (const n of P.CATS) { const w = Wd.wearing(n); for (const sl in w) { const it = Wd.data.items.find(x => x.id === w[sl]); if (it) sc += it.free ? 5 : it.grant ? 40 : 10 + Math.min(40, Math.round((it.price || 0) / 25)); } } return sc; };
SC.profile = {
  cls: 'glass', hideHud: true,
  html: () => { const s = S(), wk = Lg.weekKey(), pts = s.week.k === wk ? s.week.pts : 0;
    const img = n => { const u = (VP.Party && VP.Party.portrait(n)) || VP.Assets.get('portrait_' + n); return u ? `<img src="${u}" alt="">` : '<span class="ph">🐱</span>'; };
    return head('🪪 ' + t('pf_title'), 'teal') + `<p class="small">${esc(VP.S.name || '')}</p>
      <div class="pf-cats">${P.CATS.map(n => { const l = P.level(n), tr = P.tier(l.lv); return `<div class="pf-cat" style="--c:${tr.col}">${img(n)}<b>${esc(t(n))}</b>${t('pg_lv')} ${l.lv} · ${t('tr_' + tr.id)}</div>`; }).join('')}</div>
      <div class="pf-big"><div><b>${P.power()}</b>⚡ ${t('pf_power')}</div><div><b>${Lg.style()}</b>✨ ${t('pf_style')}</div><div><b>${Lg.achCount()}</b>🏅 ${t('ah_title')}</div><div><b>${VP.totalStars()}</b>⭐</div><div><b>${Object.keys(s.gold).length}</b>🥇</div><div><b>${Object.keys(s.album).length}/${D().cats.length}</b>📖</div></div>
      <div class="panel t"><b>📅 ${t('pf_week')}: ${pts}</b><p class="small">${t('pf_best', s.week.best || pts)} · ${t('pf_weekSub')}</p></div>
      <div class="grid2"><button class="btn gold sm" data-act="ach">🏅 ${t('ah_title')}</button><button class="btn teal sm" data-act="upg">⬆ ${t('pg_up')}</button><button class="btn ghost sm" data-act="shelter">🏠 ${t('lg_shelter')}</button><button class="btn ghost sm" data-act="pgBack">${t('back')}</button></div></div>`; },
};
ACT.profile = () => { if (UI.state === 'play' && Game.G) UI.paused = true; UI.show('profile'); };

// ---------- hooks: mission results feed everything above ----------
{ const on0 = P.onResult; P.onResult = function (r, G) {
    on0(r, G); if (!r.win) return;
    const s = S(), m = r.m, wk = Lg.weekKey();
    if (s.week.k !== wk) s.week = { k: wk, pts: 0, best: s.week.best || 0 }; s.week.pts += r.score; s.week.best = Math.max(s.week.best || 0, s.week.pts);
    cnt('coins', r.cash); if (G) cnt('ko', G.stat.ko);
    if (m.board === undefined && !m.side && r.stars === 3 && r.time <= Lg.goldTime(m) && !s.gold[m.n]) { s.gold[m.n] = 1; r.rewards.push('🥇 ' + t('ms_gold')); VP.S.cash += 50; }
    if (m.board !== undefined) { const b = boardState(); if (!b.done[m.board]) { r.rewards.push('📌 ' + t('bd_bonus', m.p.reward)); cnt('board'); } b.done[m.board] = Math.max(b.done[m.board] || 0, r.stars); }
    // a stray rescued along the way (never a rare one: those are found by exploring)
    const rr = U.rng((m.n * 31 + Math.round(r.time * 7) + s.cnt.rescued * 13) >>> 0);
    if (rr() < 0.3 + r.stars * 0.1) { const got = Lg.rescue(Lg.pick(rr, false), 'mission'); if (got) r.rewards.push('🐱 ' + t('lg_rescued', got.def.name[L()]) + (got.isNew ? ' · ' + t('lg_new') : '')); }
    checkAch();
  }; }
// board missions are not part of the ranking or the map: their stars live in the day's board
{ const res0 = UI.result; UI.result = function (win, why) { const G = Game.G, m = G && G.m; res0(win, why); if (m && m.board !== undefined) { delete VP.S.stars[m.n]; delete VP.S.best[m.n]; VP.persist(); } }; }
{ const s = SC.result, h0 = s.html; s.html = r => { let html = h0(r); if (r && r.m.board !== undefined) html = html.replace(/<button class="btn big" data-act="start" data-n="\d+">▶[^]*?<\/button>/, r.win ? `<button class="btn big" data-act="board">📌 ${t('bd_title')}</button>` : '$&'); return html; }; }
// free roam: strays to find; activities list gets the shelter and the board
{ const f0 = P.freeSetup; P.freeSetup = function (G, B, sp, opts) { f0(G, B, sp, opts); if (!(opts && (opts.trial || opts.comu || opts.online))) Lg.freeSetup(G, B); }; }
{ const a0 = P.activities; P.activities = function (G) {
    const out = a0(G); G = G || Game.G; if (!G || !G.free) return out;
    const a = G.car || G.cats[G.active], extra = [];
    for (const mk of (G.strays || []).filter(m => G.markers.includes(m)).sort((p, q) => U.d2(p.x, p.y, a.x, a.y) - U.d2(q.x, q.y, a.x, a.y)).slice(0, 1)) extra.push({ k: 'stray', icon: '🐱', title: t('lg_stray'), sub: t('lg_r' + mk.def.rarity), x: mk.x, y: mk.y, m: Math.round(Math.hypot(mk.x - a.x, mk.y - a.y) / 24), src: mk });
    if (G.shelter) extra.push({ k: 'shelter', icon: '🏠', title: t('lg_shelter'), sub: t('lg_cap', S().res.length, Lg.cap()), x: G.shelter.x, y: G.shelter.y, m: Math.round(Math.hypot(G.shelter.x - a.x, G.shelter.y - a.y) / 24), src: G.shelter });
    extra.push({ k: 'board', icon: '📌', title: t('bd_title'), sub: t('bd_sub').split('.')[0], x: a.x, y: a.y, m: 0, src: null, open: 'board' });
    const i = out.findIndex(x => x.k !== 'mission'); out.splice(i < 0 ? out.length : i, 0, ...extra); return out;
  }; }
{ const go0 = ACT.actGo; ACT.actGo = el => { const list = P.lastActs || []; const a = list[+el.dataset.i]; if (a && a.open === 'board') { ACT.board(); return; } go0(el); }; }
// title + pause: ways in
const wrapScreen = (id, fn) => { const s = SC[id]; if (!s) return; const h0 = s.html; s.html = arg => fn(h0(arg), arg); };
wrapScreen('pause', html => html.replace('<div class="grid2">', `<div class="grid2"><button class="btn ghost sm" data-act="board">📌 ${t('bd_title')}</button><button class="btn ghost sm" data-act="profile">🪪 ${t('pf_title')}</button>`));
})();
