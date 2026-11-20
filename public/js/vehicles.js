'use strict';
// VICE PAWS — vehicles the cats ride in the open world: carrinho (kart), bicicleta, moto, lancha (water only) and helicóptero.
// They are ordinary cars of the simulation (enter / exit with the action button) with three twists:
//   lancha: floats on water tiles (and the open sea just outside the map) and is blocked by land; get off next to a pier or the sand
//   helicóptero: flies over everything except the tall towers; lands on any street or square; the soft world edges still apply
// Unlocked by cat level (never sold). Paint jobs are looks only. VP.vehicles is the small API other modules (city life) can query.
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, UI = VP.UI, Game = VP.Game, M = VP.Missions, World = VP.World, P = VP.Prog, ACT = UI.act, SC = UI.SCREENS;
const Veh = VP.Veh = {};
const t = (...a) => VP.t(...a);
Object.assign(VP.L, {
  vh_garage: ['Garagem', 'Garage'], vh_sub: ['Veículos liberados pelo nível dos gatos. Chame um e ele aparece perto de você.', 'Vehicles unlocked by cat level. Summon one and it appears near you.'], vh_call: ['Chamar', 'Summon'], vh_lock: ['Nível {0}', 'Level {0}'], vh_paint: ['Pintura', 'Paint'],
  vh_kart: ['Carrinho', 'Kart'], vh_bike: ['Bicicleta', 'Bicycle'], vh_moto: ['Moto', 'Motorbike'], vh_lancha: ['Lancha', 'Speedboat'], vh_heli: ['Helicóptero', 'Helicopter'],
  vd_kart: ['Pequeno e esperto: ótimo nas ruas', 'Small and nimble: great on the streets'], vd_bike: ['Devagar e sempre, cabe em qualquer beco', 'Slow and steady, fits in any alley'], vd_moto: ['O mais rápido em terra', 'The fastest on land'], vd_lancha: ['Só anda na água: suba por um píer', 'Water only: board from a pier'], vd_heli: ['Voa por cima de tudo, menos dos arranha-céus', 'Flies over everything but the skyscrapers'],
  vh_needPier: ['Encoste num píer ou na areia para descer', 'Pull up to a pier or the sand to get off'], vh_needLand: ['Pouse numa rua ou praça para descer', 'Land on a street or square to get off'], vh_here: ['{0} chegou!', '{0} is here!'], vh_atPier: ['A lancha espera no píer marcado', 'The boat is waiting at the marked pier'],
  vh_play: ['Só na cidade livre', 'Free roam only'], vh_missions: ['Desafios de veículo', 'Vehicle challenges'],
  o_vcp: ['Checkpoint {0}/{1}', 'Checkpoint {0}/{1}'], b_vrace: ['Passe por todos os checkpoints com o veículo antes do tempo acabar.', 'Go through every checkpoint in the vehicle before time runs out.'],
});
// type: [min cat level, icon, flags]
Veh.TYPES = { kart: { lv: 1, icon: '🏎' }, bike: { lv: 2, icon: '🚲' }, moto: { lv: 5, icon: '🏍' }, lancha: { lv: 8, icon: '🚤', boat: 1 }, heli: { lv: 15, icon: '🚁', fly: 1 } };
Veh.ORDER = ['kart', 'bike', 'moto', 'lancha', 'heli'];
Veh.PAINTS = [null, ['#2de2e6', '#ff4fb8'], ['#ffd23f', '#17101c'], ['#7CFF6B', '#ffffff'], ['#b967ff', '#ffd23f'], ['#ff7a2e', '#ffffff'], ['#17101c', '#ff4fb8']];
const S = () => { const s = VP.S; if (!s.veh || typeof s.veh !== 'object') s.veh = { paint: {} }; return s.veh; };
const maxLv = () => Math.max(...P.CATS.map(n => P.level(n).lv));
Veh.unlocked = type => !!Veh.TYPES[type] && (M.allOpen || maxLv() >= Veh.TYPES[type].lv);
const OUT = 14; // tiles of open sea / sky around the map
const inSea = (W, tx, ty) => tx > -OUT && ty > -OUT && tx < W.W + OUT && ty < W.H + OUT;
function tall(W) { // tiles under towers the helicopter cannot clear (home city)
  if (W.tallMap) return W.tallMap; const m = W.tallMap = new Uint8Array(W.W * W.H);
  for (const b of W.blds || []) if (b.ht >= 7) for (let y = Math.floor(b.y / T); y < Math.ceil((b.y + b.h) / T); y++) for (let x = Math.floor(b.x / T); x < Math.ceil((b.x + b.w) / T); x++) if (x >= 0 && y >= 0 && x < W.W && y < W.H) m[y * W.W + x] = 1;
  return m;
}
Veh.blocked = function (W, c, x, y) {
  const pts = c.boat ? [[x - 15, y - 15], [x + 15, y - 15], [x - 15, y + 15], [x + 15, y + 15]] : [[x, y]];
  for (const [px, py] of pts) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T), inside = tx >= 0 && ty >= 0 && tx < W.W && ty < W.H;
    if (!inside) { if (!inSea(W, tx, ty) || (W.real && c.boat)) return true; continue; }
    if (c.boat ? W.grid[ty * W.W + tx] !== 2 : tall(W)[ty * W.W + tx]) return true;
  }
  return false;
};
// streets and squares connected to the rest of the city (so nobody gets off on an island or inside a closed yard)
function conn(G) { const W = G.W; if (W.conn) return W.conn; if (!W.connHome) { const p = W.front(W.roles[0].arena, 's'), g = W.grid.slice(); W.grid.set(W.pristine); W.connHome = W.field(p.x, p.y, 0); W.grid.set(g); } return W.connHome; }
Veh.exitPoint = function (G, car, maxR) {
  const W = G.W, C = conn(G), cx = Math.floor(car.x / T), cy = Math.floor(car.y / T);
  for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const X = cx + dx, Y = cy + dy;
    if (X < 1 || Y < 1 || X >= W.W - 1 || Y >= W.H - 1) continue; const i = Y * W.W + X;
    if (W.grid[i] === 0 && C[i] >= 0 && !(G.lockedHoods && G.lockedHoods[World.distAt(W, (X + 0.5) * T, (Y + 0.5) * T)])) return { x: (X + 0.5) * T, y: (Y + 0.5) * T };
  }
  return null;
};
Veh.spawn = function (type, x, y, a) {
  const K = Veh.TYPES[type]; if (!K || !Game.G) return null; const pi = S().paint[type] || 0;
  return Game.addCar(type, x, y, a || 0, { veh: type, boat: !!K.boat, fly: !!K.fly, alt: 0, col: Veh.PAINTS[pi] || null });
};
// nearest boarding spot for a boat: the water tile next to a pier tip
Veh.pierNear = function (G, x, y) { let b = null, bd = 1e18; for (const f of G.W.fish || []) { if (G.lockedHoods && G.lockedHoods[f.d]) continue; const d = U.d2(f.x, f.y, x, y); if (d < bd) { bd = d; b = f; } } return b; };
const boatAt = (W, f) => { for (const [dx, dy] of [[0, 1.15], [-1.9, 0], [0, -1.15], [1.9, 0]]) { const p = { x: f.x + dx * T, y: f.y + dy * T }; if (!Veh.blocked(W, { boat: 1 }, p.x, p.y)) return p; } return null; };
Veh.summon = function (type, G) {
  G = G || Game.G; if (!G || !G.free || !Veh.unlocked(type) || G.car) return null;
  const a = G.cats[G.active], K = Veh.TYPES[type]; let p = null, far = false;
  for (const c of G.cars.slice()) if (c.veh === type && c.summoned) c.dead = true; // one of each at a time
  if (K.boat) { const f = Veh.pierNear(G, a.x, a.y); p = f && boatAt(G.W, f); far = !!p && U.d2(p.x, p.y, a.x, a.y) > 200 * 200; if (p && far) P.guideTo(G, { x: f.x, y: f.y, title: t('vh_lancha'), src: null }); }
  else p = Game.nearFree(a.x, a.y, 70, 3) || Game.nearFree(a.x, a.y, 110, 0);
  if (!p) return null;
  const c = Veh.spawn(type, p.x, p.y, 0); c.summoned = true; Game.fx.poof(p.x, p.y - 10, 10); Game.fx.say(Veh.TYPES[type].icon + ' ' + (far ? t('vh_atPier') : t('vh_here', t('vh_' + type))), '#2de2e6', 2.6); VP.Audio.sfx('door');
  return c;
};
// parked around town (only the kinds already unlocked) + the garage
{ const f0 = P.freeSetup; P.freeSetup = function (G, B, sp, opts) {
    f0(G, B, sp, opts); const W = G.W; if (W.real || (opts && (opts.trial || opts.tour || opts.online))) return;
    const ok = d => !(G.lockedHoods && G.lockedHoods[d]), put = (type, pt, dx, dy) => { if (Veh.unlocked(type)) { const x = pt.x + dx, y = pt.y + dy; if (!W.blocked(x, y, 16, 0)) Veh.spawn(type, x, y, 0); } };
    for (let d = 0; d <= 4; d++) if (ok(d)) { put('kart', W.front(W.roles[d].arena, 's'), 120, 30); put('bike', W.front(W.roles[d].plaza1, 's'), -90, 26); put('moto', W.front(W.roles[d].house, 'e'), 30, 90); }
    for (const d of [5, 6, 8]) if (ok(d) && W.roles[d].kiosk1) put('bike', W.front(W.roles[d].kiosk1, 'e'), 30, 60);
    if (Veh.unlocked('lancha')) { const seen = {}; for (const f of W.fish) if (ok(f.d) && !seen[f.d]) { const p = boatAt(W, f); if (p) { seen[f.d] = 1; Veh.spawn('lancha', p.x, p.y, 0); } } }
    if (ok(8) && W.roles[8].mirante) put('heli', { x: W.roles[8].mirante.cx, y: W.roles[8].mirante.cy }, 0, 60);
    if (ok(4)) put('heli', W.front(W.roles[4].plaza2, 's'), 0, 40);
    const g = W.front(W.roles[0].house, 's'), mk = { x: g.x - 40, y: g.y + 20, k: 'garage', col: '#2de2e6', lbl: '🅿 ' + t('vh_garage'), thin: true }; mk.act = () => ACT.garage(); G.markers.push(mk); G.garage = mk;
  }; }
{ const tk = P.tick; P.tick = function (G, dt) { tk(G, dt); for (const c of G.cars) if (c.fly) { const up = G.car === c ? 15 : 0; c.alt += (up - c.alt) * Math.min(1, dt * 1.6); if (c.alt < 0.05 && !up) c.alt = 0; } }; }
{ const a0 = P.activities; P.activities = function (G) { const out = a0(G); G = G || Game.G; if (G && G.garage) { const a = G.cats[G.active]; out.splice(Math.max(0, out.length - 1), 0, { k: 'garage', icon: '🅿', title: t('vh_garage'), sub: Veh.ORDER.filter(Veh.unlocked).map(x => Veh.TYPES[x].icon).join(' '), x: a.x, y: a.y, m: 0, src: null, open: 'garage' }); } return out; };
  const go0 = ACT.actGo; ACT.actGo = el => { const a = (P.lastActs || [])[+el.dataset.i]; if (a && a.open === 'garage') { ACT.garage(); return; } go0(el); }; }

// ---------- garage ----------
SC.garage = {
  cls: 'glass', hideHud: true,
  html: () => { const s = S(), free = UI.state === 'play' && Game.G && Game.G.free && !Game.G.W.real; return `<div class="corner l"><button class="chip" data-act="pgBack">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="teal">🅿 ${t('vh_garage')}</h2><p class="small">${t('vh_sub')}</p>
    ${Veh.ORDER.map(k => { const K = Veh.TYPES[k], un = Veh.unlocked(k), pc = Veh.PAINTS[s.paint[k] || 0]; return `<div class="pg-item ${un ? '' : 'zero'}"><div class="ic">${K.icon}</div><div class="tx"><b>${t('vh_' + k)}</b><span>${t('vd_' + k)}</span>${un ? `<span><button class="tab" data-act="vhPaint" data-k="${k}" style="margin-top:4px">🎨 ${t('vh_paint')} <i style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;background:${pc ? pc[0] : 'linear-gradient(90deg,#ff4fb8,#2de2e6)'}"></i></button></span>` : ''}</div>
      <div class="do">${un ? `<button class="btn ${free ? 'teal' : 'ghost'} sm" data-act="vhCall" data-k="${k}">${t('vh_call')}</button>` : `<span class="small">🔒 ${t('vh_lock', K.lv)}</span>`}</div></div>`; }).join('')}
    <h3>🏁 ${t('vh_missions')}</h3>${Veh.missions.map(m => { const un = Veh.unlocked(m.p.veh), st = VP.S.stars[m.n] || 0; return `<div class="mrow ${st ? 'done' : ''}"><div style="flex:1"><b>${Veh.TYPES[m.p.veh].icon} ${VP.mname(m)}</b><br><span class="small">${st ? '★'.repeat(st) : ''} 🪙 ${m.p.reward}</span></div>${un ? `<button class="btn sm" data-act="brief" data-n="${m.n}">▶</button>` : `<span class="small">🔒 ${t('vh_lock', Veh.TYPES[m.p.veh].lv)}</span>`}</div>`; }).join('')}
    <button class="btn ghost" data-act="pgBack">${t('back')}</button></div>`; },
};
ACT.garage = () => { if (UI.state === 'play' && Game.G) UI.paused = true; UI.show('garage'); };
ACT.vhPaint = el => { const s = S(), k = el.dataset.k; s.paint[k] = ((s.paint[k] || 0) + 1) % Veh.PAINTS.length; VP.persist(); UI.show('garage'); };
ACT.vhCall = el => { const G = Game.G; if (!(UI.state === 'play' && G && G.free && !G.W.real)) { UI.toast(t('vh_play')); return; } ACT.resume(); if (!Veh.summon(el.dataset.k, G)) UI.toast('🚧'); };

// ---------- vehicle challenges (side missions 5000+) ----------
const mk = (n, veh, pt, en, time, reward, lv) => ({ n, d: 0, geo: 0, type: 'vrace', name: [pt, en], p: { veh, time, reward }, lv, par: Math.round(time * 0.7), hunger: 0.3, boss: null, bonus: true, side: true, talk: null });
Veh.missions = [mk(5000, 'kart', 'Grande Prêmio do Carrinho', 'Kart Grand Prix', 80, 150, 3), mk(5001, 'bike', 'Entrega de Bike', 'Bike Delivery', 110, 150, 4), mk(5002, 'moto', 'Corrida de Moto', 'Motorbike Race', 100, 200, 8), mk(5003, 'lancha', 'Resgate de Lancha', 'Speedboat Rescue', 110, 250, 10), mk(5004, 'heli', 'Tour de Helicóptero', 'Helicopter Tour', 150, 300, 14)];
{ const get0 = M.get; M.get = n => Veh.missions.find(m => m.n === n) || get0(n); }
M._.TYPES.vrace = {
  setup(B) {
    const G = B.G, W = B.W, p = B.p, X = i => W.RX[i], Y = j => W.RY[j], pt = (i, j) => ({ x: X(Math.floor(i)) + (i % 1) * 14 * T, y: Y(Math.floor(j)) + (j % 1) * 14 * T });
    let start, pts, vp;
    if (p.veh === 'lancha') { const f = W.fish.find(q => q.d === 0 && q.y > Y(12)); start = { x: f.x - 20, y: f.y - T }; vp = boatAt(W, f); const sy = (W.H + 4) * T; pts = [{ x: X(4), y: sy }, { x: X(9), y: sy + 2 * T }, { x: X(14), y: sy }, { x: X(9), y: sy - 1.5 * T }, { x: vp.x + 3 * T, y: (W.H + 1) * T }]; }
    else if (p.veh === 'heli') { start = pt(8.5, 1.2); vp = { x: start.x + 60, y: start.y + 30 }; pts = [pt(7.5, 4.5), pt(2.5, 6), pt(2, 10.5), pt(9, 10.5), pt(13, 6.5), pt(9.5, 4.5), pt(8.5, 1.2)]; }
    else { start = { x: X(1) + 60, y: Y(11) + 48 }; vp = { x: start.x + 40, y: start.y + 10 }; pts = (p.veh === 'kart' ? [[3, 11], [3, 9], [1, 9], [1, 11], [3, 11], [3, 9], [1, 9], [1, 11]] : p.veh === 'bike' ? [[2, 10], [4, 10], [5, 9], [6, 10], [5, 11], [3, 11], [1, 11]] : [[4, 11], [7, 11], [7, 9], [4, 9], [4, 8], [1, 8], [1, 11]]).map(q => ({ x: X(q[0]), y: Y(q[1]) })); }
    B.begin(start, { traffic: p.veh === 'kart' || p.veh === 'moto' ? 6 : 0 }); G.noHeat = true; G.noPolice = true;
    const car = Veh.spawn(p.veh, vp.x, vp.y, 0); Game.enterCar(car); G.mtimer = p.time;
    pts.forEach((q, i) => B.step({ txt: 'o_vcp', args: [i + 1, pts.length], car: true, at: () => q, done: () => G.car === car && U.d2(car.x, car.y, q.x, q.y) < 120 * 120, exit() { G.mtimer += 3; G.stat.cash += 15; VP.Audio.sfx('cash', 0.05); Game.fx.text(q.x, q.y - 50, p.veh === 'lancha' ? '🐱 ✔' : '✔', '#ffd23f', 18); }, fail: () => (car.dead ? 'car' : null) }));
  },
};
// ---------- API for other modules ----------
VP.vehicles = {
  types: () => Veh.ORDER.map(k => Object.assign({ id: k, unlocked: Veh.unlocked(k) }, Veh.TYPES[k])),
  list: () => (Game.G ? Game.G.cars.filter(c => c.veh && !c.dead).map(c => ({ type: c.veh, x: c.x, y: c.y, a: c.a, speed: c.spd, alt: c.alt || 0, driven: Game.G.car === c, boat: !!c.boat, fly: !!c.fly, ref: c })) : []),
  current: () => (Game.G && Game.G.car && Game.G.car.veh ? Game.G.car : null), spawn: Veh.spawn, summon: Veh.summon, unlocked: Veh.unlocked, blocked: Veh.blocked,
};
})();
