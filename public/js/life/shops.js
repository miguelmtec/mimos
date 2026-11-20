'use strict';
// VICE PAWS — food stalls and shops (data/stalls.json): walk up, press the action button, buy with in-game Coins, eat, get the buff.
// Every stall also has a free "favor": a tiny minigame that pays in food. No real money, no chance-based rewards.
(function () {
const VP = window.VP, U = VP.U, I = VP.I, T = VP.TILE, LL = VP.LifeLogic, Game = VP.Game, Life = VP.Life, _ = Life._;
const sfx = (n, g) => VP.Audio && VP.Audio.sfx(n, g);
const tr = (...a) => VP.t(...a), lg = () => (VP.lang() === 'pt' ? 'pt' : 'en'), nm = o => o[lg()];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

// ---------- wallet (same bookkeeping as the HUD: banked coins + what this stroll earned) ----------
Life.wallet = function (G) { const S = VP.S; G = G || Game.G; if (G && G.free && !G.over) { S.cash += G.stat.cash - (G.bank || 0); G.bank = G.stat.cash; } return S.cash; };

// ---------- placement ----------
function addStall(L, def, x, y, out, prop) {
  const s = { def, x, y, a: Math.atan2(out[1], out[0]), ox: out[0], oy: out[1], fx: x + out[0] * 50, fy: y + out[1] * 50, prop: prop || null, favorCd: 0, r: def.model === 'cart' ? 30 : def.model === 'fair' ? 40 : 44, id: L.stalls.length };
  const v = _.makePed(L, 'vendor', x - out[0] * (prop ? 34 : 30), y - out[1] * (prop ? 34 : 30), 0, 0);
  v.st = 'vendor'; v.fixed = true; v.fade = 1; v.stall = s; v.home = { x: v.x, y: v.y, a: s.a }; v.a = s.a; v.homeSt = 'vendor'; s.vendor = v;
  L.stalls.push(s); return s;
}
const farFrom = (L, x, y, d) => { for (const s of L.stalls) if (U.d2(s.x, s.y, x, y) < d * d) return false; for (const p of L.G.props) if (p.k === 'stand' && U.d2(p.x, p.y, x, y) < d * d) return false; for (const p of L.props) if (U.d2(p.x, p.y, x, y) < d * d) return false; return true; };
_.farFrom = farFrom;
_.placeStalls = function (L) {
  const W = L.W, D = Life.D.stalls, G = L.G, by = id => D.stalls.find(s => s.id === id);
  // the stands the city already had become real stalls
  for (const p of G.props) if (p.k === 'stand') { const def = D.stalls.find(s => s.stand === p.food); if (def) addStall(L, def, p.x, p.y, [0, 1], p); }
  if (!W.real) {
    for (let d = 0; d < W.roles.length; d++) for (const rule of D.placement.home) {
      const def = by(rule.stall), role = rule.roles.find(r => W.roles[d] && W.roles[d][r]); if (!def || !role) continue;
      const lot = W.roles[d][role], out = OUT[rule.side], tw = lot.tw || 8;
      for (const along of [2.2, 5.6, 1.2, 6.6, 3.9]) {
        const x = (rule.side === 'n' || rule.side === 's' ? lot.tx + along : rule.side === 'w' ? lot.tx + 0.55 : lot.tx + tw - 0.55) * T, y = (rule.side === 'w' || rule.side === 'e' ? lot.ty + along : rule.side === 'n' ? lot.ty + 0.55 : lot.ty + tw - 0.55) * T;
        if (!W.clear(x, y) || !W.clear(x - out[0] * 30, y - out[1] * 30) || !W.clear(x + out[0] * 50, y + out[1] * 50) || !farFrom(L, x, y, 118)) continue;
        addStall(L, def, x, y, out); break;
      }
    }
  } else {
    // real cities: one of each along the streets around the arrival point
    const net = L.net, st = W.tourStart || { x: W.pw / 2, y: W.ph / 2 }, P = D.placement.real, pool = LL.nodesInRing(net, st.x, st.y, 120, 1500, []).sort((a, b) => U.d2(net.x[a], net.y[a], st.x, st.y) - U.d2(net.x[b], net.y[b], st.x, st.y));
    let k = 0;
    // the stall stands just off the street, facing it; dense neighbourhoods get a second, tighter pass
    for (const [sep, off, rad] of [[P.spacing, 54, 22], [P.spacing * 0.7, 46, 18], [P.spacing * 0.5, 40, 15]]) for (const i of pool) {
      if (k >= P.order.length) break; const nx = net.x[i], ny = net.y[i];
      if (!farFrom(L, nx, ny, sep)) continue;
      for (const out of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const x = nx - out[0] * off, y = ny - out[1] * off, gi = Math.floor(y / T) * W.W + Math.floor(x / T);
        if (W.blocked(x, y, rad, 0) || W.gnd[gi] === 1 || !W.clear(x - out[0] * 30, y - out[1] * 30) || !W.los(nx, ny, x, y, 0)) continue;
        addStall(L, by(P.order[k++]), x, y, out); break;
      }
    }
  }
};

// ---------- buffs ----------
function toast(L, item, kind) { L.toast.push({ icon: item.icon, name: nm(item.name), kind, t: 3 }); if (L.toast.length > 3) L.toast.shift(); }
function eatFx(L, c, item) {
  c.mouth = 1; c.emote = { k: 'sit', t: 1.6 }; sfx('eat', 0.05); setTimeout(() => sfx('eat', 0.05), 220); setTimeout(() => sfx('eat', 0.05), 440);
  Game.fx.burst(c.x, c.y - 24, 7, ['#ffb347', '#fff3a8'], 100, 'dot', 4, 0.5);
  Game.fx.text(c.x, c.y - 60, item.icon + ' ' + tr('lf_bought', nm(item.name)), '#fff', 16);
  for (let i = 0; i < 3; i++) setTimeout(() => { const G = Game.G; if (G && G.cats.includes(c)) { c.mouth = 1; Game.fx.part({ x: c.x + U.rand(-8, 8), y: c.y - 26, k: 'dot', size: 4, life: 0.4, vy: -40, col: '#ffb347' }); } }, 180 * (i + 1));
}
// apply an item's effect to the team (used by purchases, favors and by anything else that hands out stall food)
Life.applyItem = function (L, item, opts) {
  const G = L.G, b = item.buff, c = G.cats[G.active], mimo = G.cats[0], mort = G.cats[2]; opts = opts || {};
  // pet-shop consumables go to the progression backpack when that module is present (and it has room)
  if (item.prog && !opts.eatNow && VP.Prog && typeof VP.Prog.give === 'function' && VP.Prog.ITEMS && VP.Prog.ITEMS[item.prog]) {
    if (VP.Prog.give(item.prog, 1) > 0) { if (VP.Prog.save) VP.Prog.save(); Game.fx.say(item.icon + ' ' + tr('lf_toBag', nm(item.name)), '#ffd23f', 2.4); sfx('pickup'); toast(L, item, b.kind); return 'bag'; }
  }
  eatFx(L, c, item);
  const timed = (k, amount, dur) => { L.buffs[k] = { t: dur, dur, amount, icon: item.icon }; };
  switch (b.kind) {
    case 'energy': mimo.energy = Math.min(100, mimo.energy + b.amount); mimo.exhausted = false; if (b.dur) timed('energy', b.amount, b.dur); break;
    case 'heal': Game.healTeam(b.amount); break;
    case 'life': VP.S.lives = Math.max(VP.S.lives, Math.min(9, VP.S.lives + b.amount)); Game.fx.burst(c.x, c.y - 20, 12, ['#ff4f5e', '#fff'], 160, 'heart', 7, 0.8); sfx('paw'); break;
    case 'speed': timed('speed', b.amount, b.dur); break;
    case 'cooldown': for (const k of G.cats) { k.cd2 = 0; k.cdS = Math.min(k.cdS, 0); } if (b.dur) timed('cooldown', 1, b.dur); sfx('switch'); break;
    case 'belly': mort.belly = Math.min(100, mort.belly + b.amount); if (b.heal) Game.healTeam(b.heal); break;
    case 'regen': timed('regen', b.amount, b.dur); break;
    case 'catnip': G.catnip = Math.max(G.catnip, b.dur); for (const k of G.cats) k.root = 0; timed('catnip', 1, b.dur); break;
    case 'toy': if (_.giveToy) _.giveToy(L, b.toy, c); break;
  }
  toast(L, item, b.kind); VP.persist();
  return 'ate';
};
function tickBuffs(L, dt) {
  const G = L.G, B = L.buffs;
  for (const k in B) { B[k].t -= dt; if (B[k].t <= 0) delete B[k]; }
  if (B.energy) { const m = G.cats[0]; m.energy = Math.max(m.energy, 92); m.exhausted = false; }
  if (B.regen) for (const c of G.cats) if (!c.down && c.hp < c.max) c.hp = Math.min(c.max, c.hp + B.regen.amount * dt);
  if (B.cooldown) for (const c of G.cats) { if (c.cd2 > 0) c.cd2 -= dt; if (c.cdS > 0) c.cdS -= dt; }
  // speed: multiply the cat's own speed while the buff lasts and undo exactly that afterwards
  const want = B.speed ? B.speed.amount : 1;
  for (const c of G.cats) { const cur = c._lifeSpd || 1; if (cur !== want) { c.spd = c.spd / cur * want; c._lifeSpd = want; } }
  for (const t of L.toast) t.t -= dt; L.toast = L.toast.filter(t => t.t > 0);
}

// ---------- buying ----------
Life.buy = function (stall, itemId) {
  const G = Game.G, L = G && G.life; if (!L) return { ok: false };
  const item = stall.def.items.find(i => i.id === itemId), res = LL.buy(Life.wallet(G), item);
  if (!res.ok) { sfx('tink'); return res; }
  VP.S.cash = res.cash; L.stats.bought++; sfx('cash');
  res.how = Life.applyItem(L, item); _.say(stall.vendor, Life.line('lf_thanks'), 2.4); VP.persist();
  return res;
};

// ---------- shop panel (DOM, touch friendly; the game is paused underneath) ----------
let root = null;
function ui() { if (!root) { root = document.createElement('div'); root.id = 'life-ui'; document.body.appendChild(root); root.addEventListener('click', onClick); } return root; }
Life.uiRoot = ui;
Life.panel = null;
Life.openPanel = function (html, cls, keepRunning) {
  ui().innerHTML = '<div class="lf-back" data-life="close"></div><div class="lf-sheet ' + (cls || '') + '">' + html + '</div>';
  root.className = 'on k-' + (cls || 'panel'); Life.openedAt = performance.now(); Life.panel = cls || 'panel'; if (!keepRunning) VP.UI.paused = true; I.enabled = false; I.reset();
};
Life.closePanel = function () { if (!root || !Life.panel) return; root.className = ''; root.innerHTML = ''; Life.panel = null; VP.UI.paused = false; I.enabled = true; I.reset(); };
const ACT = Life.act = {};
function onClick(e) {
  if (performance.now() - (Life.openedAt || 0) < 320) return; // the tap that opened the panel must not also press something in it
  const el = e.target.closest('[data-life]'); if (!el) return; if (VP.Audio) VP.Audio.unlock(); const f = ACT[el.dataset.life]; if (f) f(el, e); }
ACT.close = () => { sfx('click'); Life.closePanel(); };
let cur = null;
function shopHtml(stall, msg) {
  const d = stall.def, cash = Life.wallet(), L = Game.G.life, busy = L.favor, cd = Math.ceil(stall.favorCd);
  return `<div class="lf-head"><div class="lf-ico">${d.icon}</div><div><h3>${esc(nm(d.name))}</h3><p>“${esc(nm(d.hello))}”</p></div><button class="lf-x" data-life="close" aria-label="${esc(tr('lf_close'))}">✕</button></div>
  <div class="lf-wallet">🪙 <b id="lf-cash">${cash}</b> ${esc(tr('lf_coins'))}${msg ? `<span class="lf-msg">${esc(msg)}</span>` : ''}</div>
  <div class="lf-items">${d.items.map(it => `<button class="lf-item ${cash >= it.price ? '' : 'poor'}" data-life="buy" data-i="${it.id}"><span class="lf-ii">${it.icon}</span><span class="lf-it"><b>${esc(nm(it.name))}</b><i>${esc(nm(it.desc))}</i></span><span class="lf-price">🪙 ${it.price}</span></button>`).join('')}</div>
  <button class="lf-favor" data-life="favor" ${busy || cd > 0 ? 'disabled' : ''}>🤝 ${esc(cd > 0 ? tr('lf_favorWait', cd) : busy ? tr('lf_favorBusy') : tr('lf_favor'))}<small>${esc(nm(d.favor.name))}: ${esc(nm(d.favor.desc))} → ${d.items.find(i => i.id === d.favor.reward).icon}</small></button>
  <p class="lf-note">${esc(tr('lf_onlyCoins'))}</p>`;
}
Life.openShop = function (stall) { cur = stall; Life.openPanel(shopHtml(stall), 'shop'); _.say(stall.vendor, nm(stall.def.hello), 3); };
ACT.buy = el => {
  if (!cur) return; const res = Life.buy(cur, el.dataset.i), it = cur.def.items.find(i => i.id === el.dataset.i);
  if (res.ok) { Life.closePanel(); return; } // close so the player sees the cat eat and the buff appear
  ui().querySelector('.lf-sheet').innerHTML = shopHtml(cur, tr('lf_noCoins', res.need)); void it;
};
ACT.favor = () => { if (!cur) return; const s = cur; Life.closePanel(); Life.startFavor(s); };

// ---------- favors: tiny minigames that pay in food ----------
Life.startFavor = function (stall) {
  const G = Game.G, L = G.life, W = L.W, def = stall.def.favor, c = G.cats[G.active]; if (L.favor || stall.favorCd > 0) return false;
  const F = L.favor = { stall, kind: def.kind, t: 0, limit: 45, n: 0, need: 1, at: null, txt: '', ents: [] };
  const spotNear = (x, y, r0, r1) => { for (let k = 0; k < 30; k++) { const an = Math.random() * 6.283, d = U.rand(r0, r1), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d; if (!W.blocked(px, py, 14, 0) && (L.G.field ? W.distAt(L.G.field, px, py) >= 0 : true)) return { x: px, y: py }; } return null; };
  if (def.kind === 'meow') { F.need = 3; F.limit = 60; }
  else if (def.kind === 'photo') {
    const p = spotNear(stall.fx, stall.fy, 60, 150) || { x: stall.fx, y: stall.fy }; F.at = p; F.hold = 0; F.limit = 45;
    const q = spotNear(p.x, p.y, 70, 110) || { x: p.x + 80, y: p.y }, m = _.makePed(L, 'tourist', q.x, q.y, 0, 0); m.st = 'model'; m.fixed = true; m.fade = 0; m.a = Math.atan2(p.y - q.y, p.x - q.x); F.ents.push(m);
  } else if (def.kind === 'pigeons') {
    F.need = 0; F.limit = 45;
    for (let i = 0; i < 3; i++) { const p = spotNear(stall.x, stall.y, 70, 190); if (p) F.need += _.spawnFlock(L, p.x, p.y, 3, F).length; }
    if (!F.need) { L.favor = null; return false; }
  } else if (def.kind === 'mouse') {
    const p = spotNear(stall.fx, stall.fy, 40, 110) || { x: stall.fx, y: stall.fy }; F.limit = 25;
    F.mouse = { x: p.x, y: p.y, a: Math.random() * 6.283, t: 0, turn: 0, spd: 0 }; L.toys.push(F.toy = { k: 'mouse', x: p.x, y: p.y, a: 0, t: 0, ref: F.mouse }); F.at = F.mouse;
  } else if (def.kind === 'delivery') {
    F.limit = 38; let q = null;
    for (const b of L.benches) { const d = Math.hypot(b.x - stall.x, b.y - stall.y); if (d > 240 && d < 720 && (!b.by || b.by.st === 'sit')) { q = b; break; } }
    if (q) { F.at = { x: q.x + Math.cos(q.a) * 26, y: q.y + Math.sin(q.a) * 26 }; if (!q.by) { const m = _.makePed(L, 'walker', q.x, q.y, 0, 0); m.st = 'customer'; m.sitting = true; m.fixed = true; m.a = q.a; m.fade = 0; F.ents.push(m); F.cust = m; q.by = m; F.bench = q; } else F.cust = q.by; }
    else { const p = spotNear(stall.x, stall.y, 300, 560); if (!p) { L.favor = null; return false; } F.at = p; const m = _.makePed(L, 'walker', p.x + 20, p.y, 0, 0); m.st = 'customer'; m.fixed = true; m.fade = 0; F.ents.push(m); F.cust = m; }
    F.carry = true;
  }
  L.favorHook = (ev, e) => {
    if (F.kind === 'meow' && ev === 'meow' && U.d2(e.x, e.y, stall.x, stall.y) < 420 * 420) F.n++;
    if (F.kind === 'pigeons' && ev === 'bird' && e.tag === F) F.n++;
  };
  Game.fx.say('🤝 ' + tr('lf_favorGo', nm(def.name)), '#ffd23f', 2.6); sfx('step'); void c;
  return true;
};
function endFavor(L, ok) {
  const F = L.favor; if (!F) return; const G = L.G, c = G.cats[G.active], st = F.stall;
  for (const e of F.ents) { e.fixed = false; e.out = true; if (F.bench && F.bench.by === e) F.bench.by = null; }
  if (F.toy) F.toy.dead = true;
  for (const b of L.birds) if (b.tag === F) b.tag = null;
  L.favor = null; L.favorHook = null;
  if (ok) {
    const item = st.def.items.find(i => i.id === st.def.favor.reward);
    st.favorCd = 120; L.stats.favors++; sfx('win'); Game.fx.burst(c.x, c.y - 20, 14, ['#ffd23f', '#ff4fb8', '#2de2e6'], 200, 'star', 7, 0.9);
    Game.fx.say('🤝 ' + tr('lf_favorDone', item.icon + ' ' + nm(item.name)), '#7CFF6B', 3);
    Life.applyItem(L, item, { eatNow: true });
  } else { st.favorCd = 15; Game.fx.say(tr('lf_favorFail'), '#fff', 2.6); sfx('tink'); }
}
Life.endFavor = ok => { const L = Game.G && Game.G.life; if (L) endFavor(L, ok); };
function tickFavor(L, dt, c) {
  const F = L.favor, W = L.W; if (!F) return;
  F.t += dt;
  if (F.kind === 'meow') { F.txt = tr('lf_meowAt', F.n, F.need); if (F.n >= F.need) return endFavor(L, true); }
  else if (F.kind === 'pigeons') { F.txt = tr('lf_scare', F.n, F.need); if (F.n >= F.need) return endFavor(L, true); }
  else if (F.kind === 'photo') {
    const on = U.d2(c.x, c.y, F.at.x, F.at.y) < 34 * 34, pose = on && c.emote && (c.emote.k === 'sit' || c.emote.k === 'wave' || c.emote.k === 'dance');
    F.txt = tr(pose ? 'lf_holdPose' : 'lf_goPose'); F.hold = pose ? F.hold + dt : 0; F.prog = F.hold / 1.4;
    if (F.hold > 1.4) { L.G.flashT = 0.35; sfx('star'); _.say(F.ents[0], Life.line('lf_photo'), 2.2); return endFavor(L, true); }
  } else if (F.kind === 'mouse') {
    const m = F.mouse, d = Math.hypot(c.x - m.x, c.y - m.y); F.txt = tr('lf_catchMouse'); m.t += dt; m.turn -= dt;
    if (d < 24) { Game.fx.poof(m.x, m.y - 4, 8, '#fff'); Game.fx.text(m.x, m.y - 30, tr('lf_mouseCaught'), '#7CFF6B', 15); return endFavor(L, true); }
    // scurries away from the cat in short bursts, with pauses that let any of the three catch up
    if (m.turn <= 0) { m.turn = U.rand(0.35, 0.9); const away = Math.atan2(m.y - c.y, m.x - c.x); m.a = (d < 170 ? away : Math.random() * 6.283) + U.rand(-0.9, 0.9); m.spd = Math.random() < 0.28 ? 0 : d < 170 ? 150 : 70; }
    const nx = m.x + Math.cos(m.a) * m.spd * dt, ny = m.y + Math.sin(m.a) * m.spd * dt;
    if (!W.blocked(nx, ny, 7, 0) && U.d2(nx, ny, F.stall.x, F.stall.y) < 330 * 330) { m.x = nx; m.y = ny; } else m.turn = 0;
    F.toy.x = m.x; F.toy.y = m.y; F.toy.a = m.a; F.toy.t = m.t; F.toy.moving = m.spd > 0;
  } else if (F.kind === 'delivery') {
    F.txt = tr('lf_deliver');
    if (U.d2(c.x, c.y, F.at.x, F.at.y) < 46 * 46) { Game.fx.text(c.x, c.y - 56, tr('lf_delivered'), '#7CFF6B', 15); if (F.cust) { _.say(F.cust, Life.line('lf_thanks'), 2.4); _.hearts(F.cust.x, F.cust.y, 4); } return endFavor(L, true); }
  }
  if (F.t > F.limit) endFavor(L, false);
}

// ---------- per-frame ----------
_.updShops = function (L, dt, c) {
  tickBuffs(L, dt); tickFavor(L, dt, c);
  const G = L.G;
  for (const s of L.stalls) {
    if (s.favorCd > 0) s.favorCd -= dt;
    // stalls are solid for the cats (soft push, no tile changes)
    if (Math.abs(s.x - c.x) > 200 || Math.abs(s.y - c.y) > 200 || s.prop) continue;
    for (const k of G.cats) { const dx = k.x - s.x, dy = k.y - s.y, d = Math.hypot(dx, dy); if (d < s.r && d > 0.1 && !k.down) { const nx = k.x + dx / d * (s.r - d), ny = k.y + dy / d * (s.r - d); if (!L.W.blocked(nx, ny, k.r, 0)) { k.x = nx; k.y = ny; } } }
  }
};
addEventListener('keydown', e => { if (e.key === 'Escape' && Life.panel) { e.stopPropagation(); Life.closePanel(); if (I.pressed) I.pressed.pause = false; } }, true);
document.addEventListener('visibilitychange', () => { if (document.hidden && Life.panel) Life.closePanel(); });
})();
