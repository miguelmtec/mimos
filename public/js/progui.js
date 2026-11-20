'use strict';
// VICE PAWS — progression UI: quick-use slots and level badges on the HUD, backpack, upgrade tree, activities panel,
// the daily market, the edge prompt, and the extra buttons on the title / pause / result screens.
// Kept apart from hud.js and ui.js on purpose: it hooks in through VP.Prog.hudHit / hudDraw and by wrapping screens.
(function () {
const VP = window.VP, U = VP.U, I = VP.I, UI = VP.UI, H = VP.HUD, P = VP.Prog, Game = VP.Game, M = VP.Missions, ACT = UI.act, SC = UI.SCREENS;
const t = (...a) => VP.t(...a);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', GOLD = '#ffd23f', TEAL = '#2de2e6', INK = '#12041f';
const CATCOL = { mimo: '#8ff3ff', mimosa: '#ff7ac0', morticia: '#ffb347' };

// ---------- styles (injected, so css/style.css stays untouched) ----------
const css = document.createElement('style');
css.textContent = `
.pg-coins{display:inline-flex;gap:6px;align-items:center;font-weight:900;color:#7CFF6B;background:rgba(18,4,31,.6);border-radius:999px;padding:4px 12px;margin:0 0 8px}
.pg-item{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.14);border-radius:16px;padding:9px 10px;margin:7px 0;text-align:left}
.pg-item .ic{font-size:30px;width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;background:rgba(18,4,31,.55);border-radius:12px;position:relative}
.pg-item .ic i{position:absolute;right:-6px;bottom:-6px;font:900 12px system-ui;background:#ffd23f;color:#12041f;border-radius:999px;padding:1px 6px;font-style:normal}
.pg-item .tx{flex:1;min-width:0}.pg-item .tx b{display:block;font-size:15px}.pg-item .tx span{display:block;font-size:12px;opacity:.85;line-height:1.25}
.pg-item.zero{opacity:.62}
.pg-item .do{display:flex;flex-direction:column;gap:5px;align-items:stretch}
.pg-item .btn.sm{margin:0;padding:8px 12px;min-height:38px}
.pg-slots{display:flex;gap:4px}.pg-slots button{flex:1;min-width:30px;min-height:30px;border-radius:9px;border:2px solid rgba(255,255,255,.3);background:rgba(18,4,31,.5);color:#fff;font:900 12px system-ui;cursor:pointer}
.pg-slots button.on{background:#2de2e6;color:#12041f;border-color:#2de2e6}
.pg-cats{display:flex;gap:6px;margin:6px 0 10px}.pg-cats button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.16);border-radius:16px;padding:8px 4px;color:#fff;font:800 13px system-ui;cursor:pointer}
.pg-cats button.on{border-color:var(--c);background:rgba(255,255,255,.14);box-shadow:0 0 0 2px var(--c) inset}
.pg-cats img,.pg-cats .ph{width:52px;height:52px;border-radius:50%;object-fit:cover;background:#2a0b4a;display:grid;place-items:center;font-size:26px}
.pg-xp{height:8px;border-radius:99px;background:rgba(18,4,31,.7);overflow:hidden;width:100%}.pg-xp i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#ff9d3d);border-radius:99px}
.pg-track{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0 12px}
.pg-node{position:relative;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.16);border-radius:14px;padding:8px 7px 9px;text-align:center;display:flex;flex-direction:column;gap:4px;min-height:132px}
.pg-node b{font-size:13px;line-height:1.15}.pg-node span{font-size:11px;opacity:.85;line-height:1.2;flex:1}
.pg-node.owned{border-color:#7CFF6B;background:rgba(124,255,107,.12)}.pg-node.ok{border-color:#ffd23f}.pg-node.lock{opacity:.6}
.pg-node .btn.sm{margin:0;padding:6px 4px;min-height:34px;font-size:12px}
.pg-node em{font-style:normal;font-size:11px;font-weight:800;color:#ffd23f}
.pg-node:not(:last-child)::after{content:'›';position:absolute;right:-9px;top:44%;font:900 16px system-ui;color:rgba(255,255,255,.6);z-index:1}
.pg-act{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.14);border-radius:16px;padding:8px 10px;margin:6px 0;text-align:left;width:100%;color:#fff;font:inherit;cursor:pointer}
.pg-act .ic{font-size:24px;width:40px;height:40px;flex:0 0 40px;display:grid;place-items:center;background:rgba(18,4,31,.55);border-radius:12px}
.pg-act .tx{flex:1;min-width:0}.pg-act .tx b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pg-act .tx span{display:block;font-size:12px;opacity:.85}
.pg-act .go{font:900 12px system-ui;background:#ff4fb8;color:#fff;border-radius:999px;padding:8px 12px;white-space:nowrap}.pg-act.k-mission{border-color:rgba(255,79,184,.7)}
.pg-how{margin:4px 0 8px;padding-left:20px;font-size:13px;line-height:1.35;text-align:left}.pg-how li{margin:2px 0}
.pg-card{display:flex;gap:10px;align-items:center;background:linear-gradient(120deg,rgba(255,79,184,.3),rgba(45,226,230,.25));border:2px solid #ffd23f;border-radius:18px;padding:10px 12px;margin:8px 0;text-align:left}
.pg-card .em{font-size:34px}.pg-card div{flex:1}.pg-card b{display:block;font-size:15px}.pg-card span{font-size:12.5px;opacity:.92}
.pg-card .btn.sm{margin:0}
.pg-tip{font-size:12.5px;opacity:.9;margin:6px 0 2px}
`;
document.head.appendChild(css);

// ---------- HUD ----------
const QK = ['4', '5', '6'];
function layout(G) {
  const k = H.k, w = H.w, by = H.h - H.bot, touch = I.touch, b = {};
  const lift = (!touch && G.boss && !G.boss.dead ? 62 : 0) * k, y = by - 32 * k - lift, r = 21 * k, gap = 49 * k, free = G.free && !G.trial;
  const n = free ? 5 : 4, x0 = w / 2 - (n - 1) * gap / 2;
  b.inv = { x: x0, y, r: r * 0.92 };
  for (let i = 0; i < 3; i++) b['q' + i] = { x: x0 + (i + 1) * gap, y, r };
  if (free) b.acts = { x: x0 + 4 * gap, y, r: r * 0.92 };
  if (G.edge && free) { const pw = Math.min(w - 20 * k, 400 * k); b.edge = { x: w / 2 - pw / 2, y: H.h * 0.6, w: pw, h: 58 * k, rect: 1 }; }
  return b;
}
const hudOn = G => !!G && !G.tutorial && !G.trial && !G.over && !G.online;
P.hudHit = function (G, x, y) {
  if (!hudOn(G)) return null;
  const b = layout(G);
  for (const id in b) { const q = b[id]; if (q.rect ? (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) : U.d2(x, y, q.x, q.y) < (q.r + 5) * (q.r + 5)) return id; }
  return null;
};
P.hudLayout = layout;
let c = null;
function txt(s, x, y, size, col, align, stroke, weight) {
  c.font = (weight || '900') + ' ' + size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (stroke !== false) { c.lineJoin = 'round'; c.lineWidth = Math.max(2.5, size * 0.22); c.strokeStyle = stroke || INK; c.strokeText(s, x, y); }
  c.fillStyle = col || '#fff'; c.fillText(s, x, y);
}
const emoji = (s, x, y, size) => { c.font = size + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(s, x, y + size * 0.06); };
function wrapLines(s, maxW, size) { c.font = '800 ' + size + 'px ' + FONT; const words = s.split(' '), lines = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (c.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; } if (cur) lines.push(cur); return lines; }
P.hudDraw = function (ctx, G, dt, h) {
  c = ctx; if (!hudOn(G)) return;
  const k = H.k, touch = I.touch, b = layout(G), s = P.S(), tt = G.real;
  // level badge on each portrait, with the XP ring
  G.cats.forEach((cat, i) => {
    const pb = H.btn['c' + i], lv = P.level(cat.name), x = pb.x + pb.r * 0.74, y = pb.y + pb.r * 0.66, r = 9.5 * k;
    c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fillStyle = INK; c.fill();
    c.beginPath(); c.arc(x, y, r - 1.2 * k, -Math.PI / 2, -Math.PI / 2 + 6.283 * (lv.max ? 1 : lv.cur / lv.need)); c.lineWidth = 2.4 * k; c.strokeStyle = P.tier(lv.lv).col; c.stroke();
    txt('' + lv.lv, x, y + 0.5, 10.5 * k, '#fff', 'center', false);
  });
  // nameplate over the leading cat: level badge in the colour of its tier (what other players will see in the shared city)
  if (VP.R3 && VP.R3.ok && !G.car) { const a = G.cats[G.active], lv = P.level(a.name).lv, tr = P.tier(lv), p = VP.R3.project(a.x, a.y, 2.75); if (p.on && !a.down) { const s2 = t('pg_lv') + ' ' + lv; c.font = '900 ' + 10.5 * k + 'px ' + FONT; const tw = c.measureText(s2).width + 14 * k; h.pill(p.x - tw / 2, p.y - 8 * k, tw, 16 * k, 'rgba(18,4,31,.8)', tr.col); txt(s2, p.x, p.y + 0.5, 10.5 * k, tr.col, 'center', false); } }
  // buffs running
  { const buffs = []; if (G.omega > 0) buffs.push(['🐟', G.omega, '#8ff3ff']); if (G.catnip > 0) buffs.push(['🌿', G.catnip, '#7CFF6B']); if (G.milkT > 0) buffs.push(['🥛', G.milkT, '#ffffff']);
    buffs.forEach((bf, i) => { const x = H.w / 2 + (i - (buffs.length - 1) / 2) * 62 * k, y = b.q0.y - 40 * k; h.pill(x - 27 * k, y - 11 * k, 54 * k, 22 * k, 'rgba(18,4,31,.75)', bf[2]); emoji(bf[0], x - 13 * k, y, 13 * k); txt(Math.ceil(bf[1]) + 's', x + 9 * k, y + 0.5, 11.5 * k, '#fff', 'center', false); }); }
  // quick-use slots
  for (let i = 0; i < 3; i++) {
    const q = b['q' + i], id = s.quick[i], it = P.ITEMS[id], n = id ? P.count(id) : 0, used = P.usedT > 0 && P.usedId === id;
    c.save(); c.globalAlpha = n ? 0.95 : 0.5;
    c.beginPath(); c.arc(q.x, q.y, q.r * (used ? 1.12 : 1), 0, 6.283); c.fillStyle = 'rgba(18,4,31,.68)'; c.fill(); c.lineWidth = 2.6; c.strokeStyle = n && it ? it.col : 'rgba(255,255,255,.5)'; c.stroke();
    if (it) emoji(it.icon, q.x, q.y - 1 * k, 21 * k); else txt('+', q.x, q.y, 18 * k, 'rgba(255,255,255,.6)', 'center', false);
    c.restore();
    if (it) { c.beginPath(); c.arc(q.x + q.r * 0.72, q.y + q.r * 0.66, 8.5 * k, 0, 6.283); c.fillStyle = n ? GOLD : '#59536b'; c.fill(); txt('' + n, q.x + q.r * 0.72, q.y + q.r * 0.66 + 0.5, 10.5 * k, n ? INK : '#ddd', 'center', false); }
    if (!touch) txt(QK[i], q.x - q.r * 0.8, q.y - q.r * 0.8, 10.5 * k, GOLD);
  }
  for (const [id, ic, key] of [['inv', '🎒', 'B'], ['acts', '📋', 'T']]) {
    const q = b[id]; if (!q) continue;
    c.beginPath(); c.arc(q.x, q.y, q.r, 0, 6.283); c.fillStyle = 'rgba(18,4,31,.68)'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = id === 'acts' ? '#ff4fb8' : 'rgba(255,255,255,.75)'; c.stroke();
    emoji(ic, q.x, q.y, 18 * k); if (!touch) txt(key, q.x - q.r * 0.8, q.y - q.r * 0.8, 10.5 * k, GOLD);
    if (id === 'acts' && !s.seen.acts) { const f = (tt * 0.9) % 1; c.beginPath(); c.arc(q.x, q.y, q.r * (1 + f * 0.5), 0, 6.283); c.strokeStyle = 'rgba(255,210,63,' + (1 - f) + ')'; c.lineWidth = 3; c.stroke(); }
  }
  // fishing prompt
  const ft = G.free ? P.fishText(G) : null;
  if (ft) { const bite = G.fishing.phase === 'bite', fs = (bite ? 17 : 14) * k; c.font = '800 ' + fs + 'px ' + FONT; const tw = Math.min(H.w - 20, c.measureText(ft).width + 30 * k), y = H.h * 0.3 + 42 * k; h.pill(H.w / 2 - tw / 2, y - 17 * k, tw, 34 * k, 'rgba(18,4,31,.86)', bite ? GOLD : TEAL); txt(ft, H.w / 2, y, fs, bite ? GOLD : '#fff', 'center', false, '800'); }
  // edge prompt: one tap opens the World Tour (or walks on to the neighbour tile)
  if (b.edge) {
    const e = b.edge, tile = G.edge.tile && G.edge.tile.state !== 'missing' ? G.edge.tile : null, bw = 104 * k, pad = 12 * k;
    const msg = tile ? t('ed_next', tile.name) : t(G.W.real ? 'ed_real' : 'ed_home'), lines = wrapLines(msg, e.w - bw - pad * 2.4, 13.5 * k).slice(0, 2);
    h.pill(e.x, e.y, e.w, e.h, 'rgba(18,4,31,.9)', GOLD);
    lines.forEach((l, i) => txt(l, e.x + pad, e.y + e.h / 2 + (i - (lines.length - 1) / 2) * 17 * k, 13.5 * k, '#fff', 'left', false, '800'));
    const bx = e.x + e.w - bw - 7 * k, bh = e.h - 14 * k, pulse = 0.5 + Math.sin(tt * 5) * 0.5;
    h.pill(bx, e.y + 7 * k, bw, bh, tile ? TEAL : '#ff4fb8', 'rgba(255,255,255,' + (0.5 + pulse * 0.5) + ')');
    txt((tile ? '➡ ' + t('ed_cross') : '✈ ' + t('ed_go')) + (touch ? '' : ' [E]'), bx + bw / 2, e.y + e.h / 2 + 0.5, 13 * k, tile ? INK : '#fff', 'center', false);
  }  if (VP.Story) VP.Story.hudDraw(c, G, { txt, pill: h.pill });
};
addEventListener('keydown', e => {
  if (UI.state !== 'play' || UI.screen || UI.paused || !Game.G || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const G = Game.G, key = (e.key || '').toLowerCase(); if (!hudOn(G)) return;
  if (key === '4' || key === '5' || key === '6') I.pressed['q' + (+key - 4)] = true;
  else if (key === 'b' || key === 'i') I.pressed.inv = true;
  // T belongs to the city-life phone menu (which lists Atividades too); the activities button on touch still opens this screen
  else if (key === 'e' && G.edge && G.free && !G.ctx) I.pressed.edge = true;
});

// ---------- shared bits ----------
const inPlay = () => UI.state === 'play' && !!Game.G;
const head = (title, cls) => `<div class="corner l"><button class="chip" data-act="pgBack">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="${cls || 'teal'}">${title}</h2>`;
const coins = () => `<div class="pg-coins">🪙 ${P.wallet()}</div>`;
const openIn = id => { if (inPlay()) { UI.paused = true; } UI.show(id); };
ACT.pgBack = () => { if (inPlay() && !Game.G.over) ACT.resume(); else if (inPlay()) UI.show('result', UI.last()); else UI.show('title'); };
const portrait = n => { const u = (VP.Party && VP.Party.portrait(n)) || VP.Assets.get('portrait_' + n); return u ? `<img src="${u}" alt="">` : `<span class="ph">${{ mimo: '😴', mimosa: '😾', morticia: '😋' }[n]}</span>`; };

// ---------- backpack ----------
SC.inv = {
  cls: 'glass', hideHud: true,
  html: () => { const s = P.S(), cap = P.cap(); return head('🎒 ' + t('pg_inv')) + `<p class="small">${t('pg_invSub')}</p>${coins()}
    ${P.ORDER.map(id => { const it = P.ITEMS[id], n = P.count(id); return `<div class="pg-item ${n ? '' : 'zero'}"><div class="ic">${it.icon}<i>${n}/${cap}</i></div><div class="tx"><b>${t('it_' + id)}</b><span>${t('id_' + id)}</span>
      <div class="pg-slots" style="margin-top:6px">${[0, 1, 2].map(i => `<button class="${s.quick[i] === id ? 'on' : ''}" data-act="invSlot" data-id="${id}" data-i="${i}" aria-label="${t('pg_slot', i + 1)}">${t('pg_slot', i + 1)}</button>`).join('')}</div></div>
      <div class="do"><button class="btn sm ${n && inPlay() ? '' : 'ghost'}" data-act="invUse" data-id="${id}">${t('pg_use')}</button></div></div>`; }).join('')}
    <div class="grid2"><button class="btn teal sm" data-act="upg">⬆ ${t('pg_up')}</button><button class="btn ghost sm" data-act="${inPlay() && Game.G.free ? 'acts' : 'pgBack'}">${inPlay() && Game.G.free ? '📋 ' + t('ac_btn') : t('back')}</button></div></div>`; },
};
ACT.inv = () => openIn('inv');
ACT.invSlot = el => { const s = P.S(), i = +el.dataset.i, id = el.dataset.id, j = s.quick.indexOf(id); if (j >= 0 && j !== i) s.quick[j] = s.quick[i]; s.quick[i] = id; P.save(); UI.show('inv'); };
ACT.invUse = el => { if (!inPlay()) { UI.toast(t('pg_hintUse')); return; } const ok = P.use(el.dataset.id, Game.G); if (ok) { P.save(); ACT.resume(); } else UI.show('inv'); };

// ---------- upgrade tree ----------
let upCat = 'mimo';
SC.upg = {
  cls: 'glass', hideHud: true,
  html: () => {
    const s = P.S(), lv = P.level(upCat), bn = P.bonus(upCat), list = P.UP[upCat];
    const node = u => { const st = P.canBuy(u.id), short = st === 'cash' ? u.cost - P.wallet() : 0; return `<div class="pg-node ${st === 'owned' ? 'owned' : st === 'ok' ? 'ok' : 'lock'}"><b>${t('up_' + u.id)}</b><span>${t('ud_' + u.id)}</span>${st === 'owned' ? `<em>✔ ${t('pg_owned')}</em>` : st === 'ok' ? `<button class="btn gold sm" data-act="upBuy" data-id="${u.id}">🪙 ${u.cost}</button>` : `<em>🪙 ${u.cost}</em><em style="color:#ffb3b3">${st === 'lv' ? '🔒 ' + t('pg_needLv', u.lv) : st === 'prev' ? '🔒 ' + t('pg_needPrev') : t('pg_needCash', short)}</em>`}</div>`; };
    return head('⬆ ' + t('pg_up'), 'gold') + `<p class="small">${t('pg_upSub')}</p>${coins()}
      <div class="pg-cats">${P.CATS.map(n => { const l = P.level(n); return `<button class="${n === upCat ? 'on' : ''}" style="--c:${CATCOL[n]}" data-act="upCat" data-n="${n}">${portrait(n)}<span>${esc(P.nameOf(n))}</span><span class="small">${t('pg_lv')} ${l.lv}</span><span class="pg-xp"><i style="width:${l.max ? 100 : Math.round(l.cur / l.need * 100)}%"></i></span></button>`; }).join('')}</div>
      <div class="panel t"><b>${esc(P.nameOf(upCat))} · ${t('pg_lv')} ${lv.lv}${lv.max ? ' (' + t('pg_max') + ')' : ''}</b><p class="small">${lv.max ? '' : lv.cur + ' / ' + lv.need + ' XP · '}${t('pg_stats')}: ${t('st_' + upCat, bn[0], bn[1])}</p></div>
      ${[0, 1].map(b => `<div class="pg-track">${list.filter(u => u.b === b).map(node).join('')}</div>`).join('')}
      <div class="grid2"><button class="btn ghost sm" data-act="inv">🎒 ${t('pg_inv')}</button><button class="btn ghost sm" data-act="pgBack">${t('back')}</button></div></div>`; void s;
  },
};
ACT.upg = () => openIn('upg');
ACT.upCat = el => { upCat = el.dataset.n; UI.show('upg'); };
ACT.upBuy = el => { const id = el.dataset.id; if (P.buy(id)) { VP.Audio.sfx('win'); UI.toast('⬆ ' + t('pg_bought', t('up_' + id))); if (UI.confetti) UI.confetti(); } UI.show('upg'); };

// ---------- activities ----------
let acts = [];
SC.acts = {
  cls: 'glass', hideHud: true,
  html: () => {
    const G = Game.G; acts = P.lastActs = P.activities(G); const s = P.S(), first = !s.seen.acts; s.seen.acts = 1;
    const row = (a, i) => `<button class="pg-act k-${a.k}" data-act="actGo" data-i="${i}"><span class="ic">${a.icon}</span><span class="tx"><b>${esc(a.title)}</b><span>${esc(a.sub)}${a.src ? ' · ' + a.m + ' m' : ''}</span></span><span class="go">${a.open ? t('ac_open') : '➡ ' + t('ac_go')}</span></button>`;
    return head('📋 ' + t('ac_title'), 'gold') + `
      <details class="panel t" ${first ? 'open' : ''}><summary><b>❓ ${t('ac_how')}</b></summary><ol class="pg-how"><li>${t('ac_how1')}</li><li>${t('ac_how2')}</li><li>${t('ac_how3')}</li><li>${t('ac_how4')}</li></ol></details>
      <h3 style="margin:10px 0 2px">📍 ${t('ac_near')}${G && !G.W.real ? ' · ' + esc(t(VP.World.hoodKey(VP.World.distAt(G.W, G.cats[G.active].x, G.cats[G.active].y)))) : ''}</h3>
      ${acts.map(row).join('') || `<p class="small">${t('ac_none')}</p>`}
      <div class="grid2"><button class="btn ghost sm" data-act="inv">🎒 ${t('pg_inv')}</button><button class="btn teal sm" data-act="upg">⬆ ${t('pg_up')}</button></div></div>`;
  },
};
ACT.acts = () => { if (!inPlay() || !Game.G.free) return; P.save(); openIn('acts'); };
ACT.actGo = el => {
  const a = acts[+el.dataset.i], G = Game.G; if (!a || !G) return;
  if (a.open === 'world') { if (VP.Tour) VP.Tour.open(); return; }
  P.guideTo(G, a); ACT.resume(); Game.fx.say('➡ ' + t('ac_guide', a.title), GOLD, 2.4);
};

// ---------- Feira de Petiscos ----------
SC.feira = {
  cls: 'glass', hideHud: true,
  html: () => { const f = P.feira(), s = P.S(); return head('🧺 ' + t('fe_title'), 'gold') + `<p class="small">${t('fe_sub')}</p>${coins()}
    ${f.list.map(r => { const it = P.ITEMS[r.id], left = r.limit - (s.feira.b[r.id] || 0); return `<div class="pg-item ${left ? '' : 'zero'}"><div class="ic">${it.icon}<i>${P.count(r.id)}/${P.cap()}</i></div><div class="tx"><b>${t('it_' + r.id)}${r.deal ? ' <span style="display:inline;color:#ffd23f">★ ' + t('fe_deal') + '</span>' : ''}</b><span>${t('id_' + r.id)}</span><span>${left ? t('fe_left', left) : t('fe_sold')}</span></div>
      <div class="do"><button class="btn ${left ? 'gold' : 'ghost'} sm" data-act="feBuy" data-id="${r.id}">🪙 ${r.price}</button></div></div>`; }).join('')}
    <button class="btn ghost" data-act="pgBack">${t('back')}</button></div>`; },
};
P.openFeira = () => openIn('feira');
ACT.feira = P.openFeira;
ACT.feBuy = el => { const id = el.dataset.id, r = P.feiraBuy(id); if (r === 'ok') { VP.Audio.sfx('cash'); UI.toast(P.ITEMS[id].icon + ' ' + t('fe_bought', t('it_' + id))); } else UI.toast(r === 'cash' ? t('pg_needCash', P.feira().list.find(x => x.id === id).price - P.wallet()) : r === 'full' ? t('pg_full', t('it_' + id)) : t('fe_sold')); UI.show('feira'); };

// ---------- extra buttons on the existing screens (wrapped, not edited) ----------
const wrapScreen = (id, fn) => { const s = SC[id]; if (!s) return; const h0 = s.html; s.html = arg => fn(h0(arg), arg); };
wrapScreen('pause', html => html.replace('<div class="grid2">', `<div class="grid2"><button class="btn ghost sm" data-act="inv">🎒 ${t('pg_inv')}</button><button class="btn ghost sm" data-act="upg">⬆ ${t('pg_up')}</button>${Game.G && Game.G.free ? `<button class="btn ghost sm wide" data-act="acts">📋 ${t('ac_title')}</button>` : ''}`));
wrapScreen('result', (html, r) => {
  if (!r || !r.win) return html;
  const nx = !/data-act="start"/.test(html) ? P.nextMission(r.m) : null;
  const add = (nx ? `<button class="btn big" data-act="start" data-n="${nx.n}">▶ ${t('rs_next')}<small style="display:block;font-size:12px;font-weight:700;opacity:.9">${esc(VP.mname(nx))}</small></button>` : '') + `<p class="pg-tip">💡 ${t('rs_tip')}</p>`;
  return html.replace(/<div class="grid2">(?![\s\S]*<div class="grid2">)/, add + '<div class="grid2">').replace(/(data-act="map">[^<]*<\/button>)/, `$1<button class="btn ghost sm" data-act="upg">⬆ ${t('pg_up')}</button><button class="btn ghost sm" data-act="inv">🎒 ${t('pg_inv')}</button>`);
});
})();
