'use strict';
// VICE PAWS — the main story ("Abrigo dos Mimos"), the always-visible goal, a world that opens chapter by chapter,
// hints + a gentler mode after two failures, the release calendar and the community-goal hooks.
// Content comes from data/story.json, data/calendar.json and data/community.json (all optional: the game runs without them).
(function () {
const VP = window.VP, U = VP.U, I = VP.I, T = VP.TILE, UI = VP.UI, H = VP.HUD, Game = VP.Game, M = VP.Missions, World = VP.World, P = VP.Prog, ACT = UI.act, SC = UI.SCREENS;
const St = VP.Story = { data: { chapters: [], intro: [], hints: {} }, cal: { releases: [] }, com: { goals: [], total: 0 }, fails: {}, easy: {} };
const t = (...a) => VP.t(...a), L = () => (VP.lang() === 'pt' ? 'pt' : 'en');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Object.assign(VP.L, {
  sy_goal: ['OBJETIVO ATUAL', 'CURRENT GOAL'], sy_skip: ['Pular', 'Skip'], sy_next: ['Continuar', 'Continue'], sy_shelter: ['Abrigo dos Mimos', "Mimos' Shelter"], sy_stage: ['{0}/5 partes reformadas', '{0}/5 parts restored'],
  sy_free: ['{0} — vá até o feixe da missão {1}', '{0} — go to the beam of mission {1}'], sy_all: ['O abrigo reabriu! Cuide dos gatinhos, veja o quadro de Missões da Cidade e viaje pelo mundo', 'The shelter is open again! Care for the kittens, check the City Missions board and travel the world'],
  sy_works: ['Em obras — termine o capítulo {0}', 'Under construction — finish chapter {0}'], sy_worksCal: ['Em obras — abre em {0}', 'Under construction — opens on {0}'], sy_opened: ['Novo bairro liberado: {0}!', 'New neighbourhood open: {0}!'],
  sy_hint: ['Dica', 'Hint'], sy_easy: ['Tentar no modo suave', 'Try the gentle mode'], sy_easyOn: ['Modo suave: cachorros mais fracos e mais tempo', 'Gentle mode: weaker dogs and more time'], sy_easySub: ['Sem penalidade: as estrelas valem igual.', 'No penalty: stars count the same.'],
  sy_story: ['História', 'Story'], sy_ch: ['Capítulo {0}', 'Chapter {0}'], sy_soon: ['Abre em {0}', 'Opens on {0}'],
  co_title: ['Meta da comunidade', 'Community goal'], co_row: ['{0} de {1} missões de todos os jogadores → {2}', '{0} of {1} missions by all players → {2}'],
});
const S = () => { const s = VP.S; if (!s.story || typeof s.story !== 'object') s.story = { seen: {}, open: null }; if (!s.story.seen) s.story.seen = {}; return s.story; };
St.S = S;
// how many chapters are finished (bosses 10, 20, 30, 40, 50) = parts of the shelter restored
St.stage = () => [10, 20, 30, 40, 50].filter(n => VP.S.stars[n] > 0).length;
St.chapter = () => Math.min(5, St.stage() + 1);
St.load = function (d, cal, com) { if (d && d.chapters) St.data = d; if (cal && cal.releases) St.cal = cal; if (com && com.goals) St.com = Object.assign({ total: 0 }, com); };
Promise.all(['story', 'calendar', 'community'].map(f => fetch('data/' + f + '.json').then(r => (r.ok ? r.json() : null)).catch(() => null))).then(d => { St.load(d[0], d[1], d[2]); St.ready = true; if (UI.screen === 'title') UI.relabel(); St.pullCommunity(); });

// ---------- cutscene cards ----------
let play = null;
SC.story = {
  cls: 'glass center', hideHud: true,
  html: () => {
    const c = play.cards[play.i], who = c.who || 'mimo', img = VP.Assets.get(who === 'boss' ? 'boss_5' : 'portrait_' + who) || (who === 'boss' ? VP.Assets.get('boss_1') : null);
    const name = who === 'boss' ? 'Dr. Carrocinha' : who === 'all' ? 'Mimo, Mimosa & Mortícia' : t(who);
    return `<div class="wrap narrow sy-card"><p class="small gold">${esc(play.title || t('sy_story'))}</p>
      <div class="sy-art">${who === 'all' ? ['mimo', 'mimosa', 'morticia'].map(n => `<img src="${VP.Assets.get('portrait_' + n) || ''}" alt="">`).join('') : img ? `<img class="one" src="${img}" alt="">` : `<span class="sy-emo">${c.emo || '🐱'}</span>`}</div>
      <div class="panel t"><b>${esc(name)}</b><p>${esc(c[L()])}</p></div>
      <div class="sy-dots">${play.cards.map((_, i) => `<i class="${i === play.i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row"><button class="btn ghost sm" data-act="syEnd">⏭ ${t('sy_skip')}</button><button class="btn" data-act="syNext">${t('sy_next')} ▶</button></div></div>`;
  },
};
St.show = function (key, cards, then, title) {
  if (!cards || !cards.length) { if (then) then(); return false; }
  S().seen[key] = 1; VP.persist(); play = { cards, i: 0, then, title }; UI.show('story'); return true;
};
ACT.syNext = () => { if (!play) return; if (++play.i >= play.cards.length) ACT.syEnd(); else UI.show('story'); };
ACT.syEnd = () => { const p = play; play = null; if (p && p.then) p.then(); else UI.show('title'); };
{ const css = document.createElement('style'); css.textContent = `.sy-card{text-align:center}.sy-art{display:flex;justify-content:center;gap:8px;margin:6px 0 10px}.sy-art img{width:30%;max-width:120px;aspect-ratio:1;border-radius:22px;object-fit:cover;border:3px solid #ffd23f;box-shadow:0 0 24px #ff4fb866}.sy-art img.one{width:52%;max-width:210px}.sy-emo{font-size:90px}
.sy-card .panel{text-align:left;font-size:15.5px;line-height:1.4}.sy-dots{display:flex;gap:6px;justify-content:center;margin:8px 0}.sy-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3)}.sy-dots i.on{background:#ffd23f}
.sy-ch{display:flex;gap:10px;align-items:center;background:rgba(18,4,31,.55);border:2px solid rgba(255,210,63,.6);border-radius:16px;padding:8px 12px;margin:8px 0;text-align:left;font-size:13px}.sy-ch b{display:block;font-size:14px;color:#ffd23f}.sy-ch .em{font-size:28px}`; document.head.appendChild(css); }

// intro before the first game; one card set after each chapter boss
// (a brand-new player gets the training first and the story right after it; whoever already trained sees it on the next "play")
const wantIntro = () => !S().seen.intro && St.data.intro && St.data.intro.length && VP.S.unlocked <= 1 && !VP.totalStars();
{ const play0 = ACT.play; ACT.play = () => { if (VP.S.tut && wantIntro()) St.show('intro', St.data.intro, play0); else play0(); }; }
{ const end0 = UI.endTutorial; UI.endTutorial = function (skipped) { if (wantIntro()) { VP.S.tut = 1; St.show('intro', St.data.intro, () => end0(skipped)); const sk = document.getElementById('tutskip'); if (sk) sk.remove(); } else end0(skipped); }; }
{ const res0 = UI.result; UI.result = function (win, why) {
    const G = Game.G, m = G && G.m, first = m && m.boss && !VP.S.stars[m.n];
    res0(win, why);
    if (!m || m.free || m.type === 'tutorial') return;
    if (!win) { St.fails[m.n] = (St.fails[m.n] || 0) + 1; if (St.fails[m.n] >= 2 && UI.screen === 'result') UI.show('result', UI.last()); return; }
    St.fails[m.n] = 0;
    if (first && win) { const ch = St.data.chapters.find(c => c.boss === m.n); if (ch && ch.done) St.show('done' + ch.n, ch.done, () => UI.show('result', UI.last()), t('sy_ch', ch.n) + ' · ' + ch.name[L()]); }
  }; }

// ---------- gentle mode + hints ----------
St.diff = m => (m && St.easy[m.n] ? 0.68 : 1);
{ const start0 = UI.startMission; UI.startMission = function (n) { start0(n); const G = Game.G; if (G && G.m.n === n && St.easy[n]) { if (G.mtimer != null) G.mtimer = Math.round(G.mtimer * 1.4); G.easy = true; setTimeout(() => { if (Game.G === G && !G.over) Game.fx.say('🕊 ' + t('sy_easyOn'), '#bfe9ff', 3); }, 600); } }; }
St.hint = function (m) { const h = St.data.hints || {}, k = m.type === 'tour' ? m.p.kind : m.type; const e = h[m.boss ? 'boss' : k]; return e ? e[L()] : t(m.boss ? 'bossTip' : m.tourCity ? 'bk_' + m.p.kind : 'b_' + m.type); };
ACT.syHint = el => { const m = M.get(+el.dataset.n); if (!m) return; const box = document.getElementById('sy-hint'); if (box) { box.style.display = 'block'; box.innerHTML = '💡 ' + esc(St.hint(m)); } };
ACT.syEasy = el => { const n = +el.dataset.n; St.easy[n] = 1; UI.startMission(n); };
{ const s = SC.result, h0 = s.html; s.html = r => { let html = h0(r); if (r && !r.win && (St.fails[r.m.n] || 0) >= 2) html = html.replace('<div class="grid2">', `<div class="panel t" id="sy-hint" style="display:none"></div><div class="grid2"><button class="btn gold sm" data-act="syHint" data-n="${r.m.n}">💡 ${t('sy_hint')}</button><button class="btn teal sm" data-act="syEasy" data-n="${r.m.n}">🕊 ${t('sy_easy')}</button></div><p class="pg-tip">${t('sy_easySub')}</p><div class="grid2">`); return html; }; }

// ---------- the goal that is always on screen ----------
St.nextStory = () => M.list.find(m => !m.bonus && m.n <= VP.S.unlocked && !VP.S.stars[m.n]) || null;
{ const ob0 = M.objective; M.objective = function (G) {
    const ob = ob0(G);
    if (G.free && !G.tour && !G.guide && !G.quest && !G.trial && St.data.chapters.length) {
      const m = St.nextStory(), ch = St.data.chapters[St.chapter() - 1];
      if (m && ch) { const mk = G.markers.find(k => k.k === 'mission' && k.n === m.n); ob.txt = t('sy_free', ch.goal[L()], m.n); if (mk) ob.at = mk; }
      else if (!m) ob.txt = t('sy_all');
    }
    return ob;
  }; }
St.hudDraw = function (c, G, h) {
  const ob = H.ob; if (!ob || G.tutorial) return;
  const k = H.k, a = G.car || G.cats[G.active], bx = H.obBox; if (!bx) return;
  const dist = ob.at ? Math.round(Math.hypot(ob.at.x - a.x, ob.at.y - a.y) / 24) : null, s = '🎯 ' + t('sy_goal') + (dist !== null ? ' · ' + dist + ' m' : '') + (G.easy ? ' · 🕊' : '');
  c.font = '900 ' + 9.5 * k + 'px system-ui,sans-serif'; const tw = c.measureText(s).width + 14 * k;
  const ty = bx.y + bx.h - 5 * k; // a small tab hanging from the bottom-left corner of the goal box
  h.pill(bx.x + 12 * k, ty, tw, 15 * k, '#ffd23f', null); h.txt(s, bx.x + 12 * k + tw / 2, ty + 7.8 * k, 9.5 * k, '#12041f', 'center', false);
};

// ---------- release calendar: chapters (and with them their neighbourhoods) can open on a date ----------
St.releaseOf = id => (St.cal.releases || []).find(r => r.id === id) || null;
St.released = function (id, now) { const r = St.releaseOf(id); return !r || !r.date || M.allOpen || (now || Date.now()) >= new Date(r.date + 'T00:00:00').getTime(); };
St.fmtDate = d => { const p = String(d).split('-'); return L() === 'pt' ? p[2] + '/' + p[1] : p[1] + '/' + p[2]; };
{ const open0 = M.distOpen; M.distOpen = d => open0(d) && (!d || St.released('district:' + d.id)); }

// ---------- a world that opens chapter by chapter ----------
// which chapter (1-4) has to be finished for each neighbourhood; 0 = open from the start
St.NEED = [0, 1, 2, 3, 4, 0, 1, 3, 2];
St.hoodOpen = function (d) {
  if (M.allOpen) return true;
  if (!St.released('hood:' + d)) return false;
  const com = (St.com.goals || []).find(g => g.opens === 'hood:' + d); if (com && St.com.total < com.need) return false;
  return St.stage() >= St.NEED[d] || VP.S.unlocked > St.NEED[d] * 10;
};
St.lockText = function (d) { const r = St.releaseOf('hood:' + d); return r && !St.released('hood:' + d) ? t('sy_worksCal', St.fmtDate(r.date)) : t('sy_works', St.NEED[d]); };
St.freeSetup = function (G, B, sp, opts) {
  const W = G.W; G.lockedHoods = null;
  if (W.real || opts.trial || opts.tour || opts.online) return;
  // the shelter: a real place that grows with the story
  const lot = W.roles[5] && W.roles[5].garden;
  if (lot) { const x = lot.cx, y = lot.cy - 20, stage = St.stage(); Game.addProp({ k: 'shelter', x, y, stage }); const mk = { x: x, y: y + 150, k: 'shelter', col: '#ffd23f', lbl: '🏠 ' + t('sy_shelter') + ' · ' + t('sy_stage', stage), thin: true, quiet: true }; mk.act = () => { if (VP.Long && VP.Long.openShelter) VP.Long.openShelter(); else Game.fx.say('🏠 ' + t('sy_shelter') + ': ' + t('sy_stage', stage), '#ffd23f', 3); }; G.markers.push(mk); G.shelter = mk; }
  // locked neighbourhoods: fenced with friendly barriers until their chapter is done
  const locked = {}; let any = false;
  for (let d = 0; d < World.HOODS; d++) if (!St.hoodOpen(d)) { locked[d] = 1; any = true; }
  for (const mk of G.markers) if (mk.k === 'mission' || mk.k === 'shop') { const d = World.distAt(W, mk.x, mk.y); if (locked[d]) delete locked[d]; }
  const st = S(), now = []; for (let d = 0; d < World.HOODS; d++) if (!locked[d]) now.push(d);
  if (st.open && !M.allOpen) { const fresh = now.filter(d => !st.open.includes(d)); if (fresh.length) setTimeout(() => { if (Game.G === G) { Game.fx.say('🎉 ' + t('sy_opened', fresh.map(d => t(World.hoodKey(d))).join(' + ')), '#7CFF6B', 4.5); VP.Audio.sfx('win'); } }, 1500); }
  if (!M.allOpen) st.open = now;
  if (!any || !Object.keys(locked).length) return;
  G.lockedHoods = locked;
  const dOf = (x, y) => World.distAt(W, (x + 0.5) * T, (y + 0.5) * T), labels = [];
  for (let y = 1; y < W.H - 1; y++) for (let x = 1; x < W.W - 1; x++) {
    const i = y * W.W + x; if (W.grid[i] !== 0) continue; const d = dOf(x, y); if (!locked[d]) continue;
    let side = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * W.W + x + dx; if (!locked[dOf(x + dx, y + dy)] && W.grid[j] !== 1 && W.grid[j] !== 2) side = dx ? 'v' : 'h'; }
    if (!side) continue;
    W.setTile(x, y, 3);
    const road = W.gnd[i] === 1, px = (x + 0.5) * T, py = (y + 0.5) * T;
    if ((side === 'h' ? x : y) % 2 === 0) Game.addProp({ k: 'works', x: px + (side === 'h' ? T / 2 : 0), y: py + (side === 'v' ? T / 2 : 0), hor: side === 'h', len: 96 });
    if (road && !labels.some(q => U.d2(q.x, q.y, px, py) < 420 * 420)) labels.push({ x: px, y: py, d });
  }
  for (const q of labels) G.markers.push({ x: q.x, y: q.y, k: 'works', col: '#ffb347', lbl: '🚧 ' + St.lockText(q.d), thin: true, quiet: true });
  // never start inside a closed area; items and strays in there wait for later
  const home = W.front(W.roles[0].arena, 's'), inLocked = e => locked[World.distAt(W, e.x, e.y)];
  if (inLocked(G.cats[0])) { G.cats.forEach((c, i) => { c.x = home.x + (i - 1) * 34; c.y = home.y + (i ? 22 : 0); }); G.cam.x = home.x; G.cam.y = home.y; for (const f of G.friends) if (f.name === 'avatar') { f.x = home.x + 30; f.y = home.y + 50; } }
  G.dogs = G.dogs.filter(e => !inLocked(e));
  for (const mk of G.markers.slice()) if ((mk.k === 'npc' || mk.k === 'race') && inLocked(mk)) G.markers.splice(G.markers.indexOf(mk), 1);
  if (G.feira && inLocked(G.feira)) { const p = W.front(W.roles[5].kiosk1, 's'); G.feira.x = p.x; G.feira.y = p.y; G.feira.d = 5; for (const f of G.friends) if (f.name === 'farmer') { f.x = p.x + 26; f.y = p.y - 20; } }
  G.fieldT = 0;
};

// ---------- community goals (client side only: data + a stub endpoint; the counter service comes later) ----------
St.pullCommunity = function () { return fetch('/api/community', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { if (j && typeof j.total === 'number') St.com.total = j.total; }).catch(() => {}); };
St.communityRow = function () { const g = (St.com.goals || []).find(x => St.com.total < x.need) || null; return g ? { icon: '🌍', title: t('co_title'), sub: t('co_row', St.com.total, g.need, g.name[L()]) } : null; };

// ---------- title: where the story stands ----------
{ const s = SC.title, h0 = s.html; s.html = a => { let html = h0(a); const d = St.data, ch = d.chapters[St.chapter() - 1]; if (ch && (VP.S.unlocked > 1 || S().seen.intro)) html = html.replace('<div class="grid2">', `<div class="sy-ch"><span class="em">🏠</span><div><b>${t('sy_shelter')} · ${t('sy_stage', St.stage())}</b>${St.stage() >= 5 ? esc(t('sy_all')) : t('sy_ch', ch.n) + ': ' + esc(ch.goal[L()])}</div></div><div class="grid2">`); return html; }; }
})();
