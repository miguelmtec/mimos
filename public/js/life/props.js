'use strict';
// VICE PAWS — cat activities around town: knock things off tables, nap in cardboard boxes, scratch the showroom sofa, climb,
// sunbathe, chase laser dots and butterflies, push yarn; plus the day/night clock, rain and puddles, the radio and the
// "what can I do here" focus that feeds the action button and the Atividades list.
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, LL = VP.LifeLogic, Game = VP.Game, Life = VP.Life, _ = Life._;
const sfx = (n, g) => VP.Audio && VP.Audio.sfx(n, g);
const tr = (...a) => VP.t(...a);
const DAY = 600; // seconds for a full day

// ---------- placement ----------
function add(L, k, x, y, a, o) { const p = Object.assign({ k, x, y, a: a || 0, t: 0, cd: 0, id: L.props.length }, o); L.props.push(p); if (k === 'bench') L.benches.push(p); return p; }
function guard(L, x, y, a, role, lineKey) { const g = _.makePed(L, role || 'waiter', x, y, 0, 0); g.st = 'guard'; g.fixed = true; g.fade = 1; g.a = a; g.home = { x, y, a }; g.homeSt = 'guard'; g.chaseLine = lineKey; return g; }
function tables(L, x, y) {
  const W = L.W, set = [];
  for (const [dx, dy] of [[0, 0], [58, 30], [-10, 62]]) { const tx = x + dx, ty = y + dy; if (W.blocked(tx, ty, 16, 0) || !_.farFrom(L, tx, ty, 50)) continue; const t = add(L, 'table', tx, ty, 0, { r: 17, cups: [] }); for (let i = 0; i < 3; i++) { const an = i * 2.1 + 0.4, c = { x: tx + Math.cos(an) * 9, y: ty + Math.sin(an) * 9, z: 1.02, st: 'on', vx: 0, vy: 0, vz: 0, t: 0, kind: i, table: t }; t.cups.push(c); L.knock.push(c); } set.push(t); }
  if (set.length) { const g = guard(L, x - 44, y + 20, 0, 'waiter', 'lf_table'); for (const t of set) t.guard = g; }
  return set.length;
}
_.placeProps = function (L) {
  const W = L.W, r = U.rng(4242 + (W.real ? W.real.id.length : 0)), G = L.G, C = L.N.chance;
  const px = (lot, fx) => (lot.tx + fx) * T, py = (lot, fy) => (lot.ty + fy) * T, ok = (x, y, d) => !W.blocked(x, y, 14, 0) && _.farFrom(L, x, y, d || 70);
  L.flySpots = [];
  if (!W.real) {
    const plats = [];
    for (let d = 0; d < W.roles.length; d++) {
      const lots = W.lots.filter(l => l.d === d), of = t => lots.filter(l => l.type === t), R = W.roles[d] || {};
      for (const lot of lots) if (lot.type === 'plaza' || lot.type === 'park' || lot.type === 'arena') for (const [fx, fy, a] of [[0.55, 5.2, 0], [7.45, 2.2, Math.PI]]) { const x = px(lot, fx), y = py(lot, fy); if (ok(x, y, 60)) add(L, 'bench', x, y, a, { r: 15 }); }
      const tl = R.plaza2 || of('plaza')[0]; if (tl) for (const [fx, fy] of [[4.6, 4.4], [2.2, 4.6], [4.4, 1.8]]) if (ok(px(tl, fx), py(tl, fy), 90) && tables(L, px(tl, fx), py(tl, fy))) break;
      for (const lot of [of('lot')[0], R.arena, of('dock')[0] || of('beach')[0]]) { if (!lot) continue; for (const [fx, fy] of [[6.5, 4.4], [0.7, 0.7], [1.5, 3.5]]) { const x = px(lot, fx), y = py(lot, fy); if (ok(x, y, 70)) { add(L, 'box', x, y, r() * 6.283, { r: 0 }); break; } } }
      const sl = R.plaza1 || of('plaza')[1]; if (sl) for (const [fx, fy] of [[4.5, 6.3], [5.5, 2.4], [2.4, 5.6]]) { const x = px(sl, fx), y = py(sl, fy); if (ok(x, y, 96) && ok(x + 56, y - 30, 40)) { const s = add(L, 'sofa', x, y, Math.PI / 2, { r: 24, n: 0 }); s.guard = guard(L, x + 56, y - 30, Math.PI / 2, 'vendor', 'lf_sofa'); s.guard.look.apron = '#b967ff'; break; } }
      for (const [lot, fx, fy] of [[of('park')[0], 2.2, 1.7], [of('beach')[0], 3.5, 1.5], [R.house, 1.5, 6.2], [of('pool')[0], 6.5, 5]]) if (lot && ok(px(lot, fx), py(lot, fy), 60)) add(L, 'sun', px(lot, fx), py(lot, fy), 0, { r: 0 });
      if (R.plaza3 && ok(px(R.plaza3, 3.2), py(R.plaza3, 2.8), 80)) add(L, 'laser', px(R.plaza3, 3.2), py(R.plaza3, 2.8), 0, { r: 0 });
      for (const lot of [of('park')[0], R.house]) if (lot) { L.flySpots.push({ x: px(lot, 4), y: py(lot, 4) }); add(L, 'fly', px(lot, 4), py(lot, 5.4), 0, { r: 0, soft: true }); }
      if (R.house && ok(px(R.house, 5.8), py(R.house, 5.8), 60)) { add(L, 'yarn', px(R.house, 5.8), py(R.house, 5.8), 0, { r: 0, soft: true }); L.toys.push({ k: 'yarn', x: px(R.house, 5.8), y: py(R.house, 5.8), vx: 0, vy: 0, t: 0, n: 0, keep: true }); }
      // climbing spot on the arena plaza: AC unit, shop awning, low roof
      if (R.arena && !G.pk) { const A = R.arena, c1 = { x: px(A, 6.5), y: py(A, 1.1) }; if (ok(c1.x, c1.y, 60) && ok(px(A, 6.3), py(A, 4.6), 60)) { plats.push({ x: c1.x, y: c1.y, hw: 22, hh: 22, h: 0.8, style: 'crate', col: '#c9ced6', life: 'ac' }, { x: px(A, 6.5), y: py(A, 2.55), hw: 34, hh: 36, h: 1.6, style: 'awning', solid: false, along: 'y', col: L.rng.pick(['#e01e37', '#2a6bff', '#ff4fb8']), life: 'awning' }, { x: px(A, 6.3), y: py(A, 4.6), hw: 46, hh: 46, h: 2.4, style: 'roof', solid: false, life: 'roof', col: '#2de2e6' }); add(L, 'climb', c1.x, c1.y, 0, { r: 0, soft: true, topAt: { x: px(A, 6.3), y: py(A, 4.6) } }); } }
      // the Alley Crew hangs out in two of the districts
      if ((d === 1 || d === 3 || W.roles.length < 3) && of('lot')[0]) { const lot = of('lot')[0], x = px(lot, 4.6), y = py(lot, 4.4); if (ok(x, y, 80)) { add(L, 'gang', x, y, 0, { r: 0 }); for (let i = 0; i < L.N.gang.size; i++) { const an = i / L.N.gang.size * 6.283 + 0.5, c = _.makeCat(L, x + Math.cos(an) * 38, y + Math.sin(an) * 38, i * 3 + d); c.gang = true; c.sit = 1; c.a = an + Math.PI; c.fade = 1; c.friend = true; c.acc = L.N.gang.acc[i % L.N.gang.acc.length]; c.size = 0.85; } } }
    }
    if (plats.length) { const pk = Game.addCourse(plats, []); L.tops = pk.plats.filter(p => p.life === 'roof'); }
    // house cats watching the street from window sills
    for (const b of W.blds) { if (L.windows.length >= 70 || r() > C.window) continue; const x = b.x + b.w * r.range(0.25, 0.75), y = b.y + b.h + 3; if (W.clear(x, y + 22)) L.windows.push({ x, y, h: 2.1 + (b.ht > 3 ? r.int(0, 1) * 2 : 0), vi: r.int(0, L.N.streetCats.length - 1), t: r() * 9 }); }
  } else {
    const net = L.net, st = W.tourStart || { x: W.pw / 2, y: W.ph / 2 }, pool = LL.nodesInRing(net, st.x, st.y, 90, 1300, []);
    const off = (dist, sep) => { for (let k = 0; k < 40; k++) { const i = pool[Math.floor(r() * pool.length)]; if (i === undefined) return null; for (const o of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const x = net.x[i] - o[0] * dist, y = net.y[i] - o[1] * dist, gi = Math.floor(y / T) * W.W + Math.floor(x / T); if (!W.blocked(x, y, 20, 0) && W.gnd[gi] !== 1 && W.los(net.x[i], net.y[i], x, y, 0) && _.farFrom(L, x, y, sep)) return { x, y, a: Math.atan2(o[1], o[0]) }; } } return null; };
    for (let i = 0; i < 6; i++) { const p = off(40, 150); if (p) add(L, 'bench', p.x, p.y, p.a, { r: 15 }); }
    for (let i = 0; i < 2; i++) { const p = off(46, 240); if (p) add(L, 'box', p.x, p.y, r() * 6, { r: 0 }); }
    for (let i = 0; i < 2; i++) { const p = off(60, 240); if (p) { add(L, 'sun', p.x, p.y, 0, { r: 0 }); L.flySpots.push(p); } }
    { const p = off(64, 200); if (p) tables(L, p.x, p.y); }
    { const p = off(60, 200); if (p) add(L, 'laser', p.x, p.y, 0, { r: 0 }); }
  }
};

// ---------- toys ----------
_.giveToy = function (L, kind, c) {
  if (kind === 'yarn') L.toys.push({ k: 'yarn', x: c.x + Math.cos(c.aim || 0) * 30, y: c.y + Math.sin(c.aim || 0) * 30, vx: 0, vy: 0, t: 0, n: 0, life: 150 });
  else startLaser(L, c.x, c.y, 70);
};
function startLaser(L, x, y, life) { if (L.toys.some(t => t.k === 'laser')) return; L.toys.push({ k: 'laser', x, y, hx: x, hy: y, gx: x + 60, gy: y, n: 0, need: 5, t: 0, life: life || 60, hold: 0 }); sfx('tink'); }
function updToys(L, dt, c) {
  const W = L.W, G = L.G;
  for (const t of L.toys) {
    t.t += dt; if (t.life !== undefined) { t.life -= dt; if (t.life <= 0) t.dead = true; }
    if (t.k === 'yarn') {
      const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy);
      if (d < 24 && !G.car && c.walk) { const k = 250 / (d || 1); t.vx = dx * k; t.vy = dy * k; if (!t.cd || t.cd < L.t) { t.cd = L.t + 0.45; t.n++; sfx('step', 0.1); _.points(L, 2, t.x, t.y, t.n % 5 === 0 ? 'lf_yarn' : null); } }
      const nx = t.x + t.vx * dt, ny = t.y + t.vy * dt;
      if (W.blocked(nx, t.y, 8, 0)) t.vx *= -0.6; else t.x = nx; if (W.blocked(t.x, ny, 8, 0)) t.vy *= -0.6; else t.y = ny;
      t.roll = (t.roll || 0) + Math.hypot(t.vx, t.vy) * dt * 0.08; const f = Math.pow(0.12, dt); t.vx *= f; t.vy *= f;
    } else if (t.k === 'laser') {
      t.hold -= dt; const d = Math.hypot(t.gx - t.x, t.gy - t.y);
      if (d < 6 || t.hold <= 0) { for (let k = 0; k < 8; k++) { const an = Math.random() * 6.283, r = U.rand(40, 150), gx = t.hx + Math.cos(an) * r, gy = t.hy + Math.sin(an) * r; if (!W.blocked(gx, gy, 8, 0)) { t.gx = gx; t.gy = gy; break; } } t.hold = U.rand(0.5, 1.3); }
      else { const s = Math.min(d, 300 * dt); t.x += (t.gx - t.x) / d * s; t.y += (t.gy - t.y) / d * s; }
      if (!G.car && U.d2(t.x, t.y, c.x, c.y) < 24 * 24) { t.n++; t.hold = 0; sfx('pickup', 0.1); Game.fx.text(t.x, t.y - 30, tr('lf_laser', t.n, t.need), '#ff4f5e', 15); c.hopT = 0.4; if (t.n >= t.need) { t.dead = true; _.points(L, 25, c.x, c.y, 'lf_laserWin'); sfx('star'); } }
    }
  }
  L.toys = L.toys.filter(t => !t.dead);
}

// ---------- props ----------
function knock(L, t, c) {
  const cup = t.cups.find(k => k.st === 'on'); if (!cup) return;
  const d = Math.hypot(cup.x - c.x, cup.y - c.y) || 1; cup.st = 'fall'; cup.vx = (cup.x - c.x) / d * 90; cup.vy = (cup.y - c.y) / d * 90; cup.vz = 2.2; cup.t = 0;
  c.atk = 1; sfx('tink'); L.stats.knocked++; _.points(L, 10, cup.x, cup.y, 'lf_knocked');
  if (t.guard && t.guard.cool <= 0 && !(t.guard.soft > 0)) { t.guard.cool = 3; _.say(t.guard, Life.line('lf_table'), 2); }
  t.cd = 40;
}
function sleep(L, box, c) { if (L.sleep) return; L.sleep = { t: 0, box }; c.emote = { k: 'sit', t: 3.2 }; sfx('nap'); }
function scratch(L, s, c) {
  if (s.cd > 0) return; c.atk = 1; s.n++; sfx('bite', 0.05); s.shake = 0.3;
  for (let i = 0; i < 5; i++) Game.fx.part({ x: s.x + U.rand(-16, 16), y: s.y - 20 + U.rand(-8, 8), k: 'slash', a: U.rand(0.8, 2.2), size: 12, life: 0.18, col: '#fff3d6' });
  _.points(L, 12, s.x, s.y, 'lf_scratched');
  if (s.n >= 3 && s.guard && s.guard.st === 'guard') { s.n = 0; s.cd = 25; const g = s.guard; g.st = 'chase'; g.stT = 6.5; g.chaseSpd = 122; g.chaseLine = 'lf_sofa'; _.say(g, Life.line('lf_sofa'), 2.2); }
}
function gangTalk(L, p) {
  const S = Life.S(), day = VP.Missions.dayKey(), cats = L.animals.filter(c => c.gang && U.d2(c.x, c.y, p.x, p.y) < 90 * 90), who = cats[(Math.random() * cats.length) | 0]; if (!who) return;
  _.say(who, Life.line('lf_gang'), 3.4); _.hearts(who.x, who.y, 3); sfx('paw', 0.3);
  if (S.gang !== day) { S.gang = day; L.G.stat.cash += L.N.gang.gift; Game.fx.say('🐾 ' + tr('lf_gangGift', L.N.gang.gift), '#ffd23f', 3); VP.persist(); }
}
_.updProps = function (L, dt, c) {
  const G = L.G, W = L.W;
  updToys(L, dt, c);
  for (const k of L.knock) {
    if (k.st === 'fall') { k.t += dt; k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt; k.vz -= 9 * dt; if (k.z <= 0.08) { k.z = 0.08; k.st = 'gone'; k.t = 0; sfx('break', 0.2); Game.fx.burst(k.x, k.y, 6, ['#fff', '#9fe0ff', '#ffd23f'], 120, 'dot', 4, 0.4); } }
    else if (k.st === 'gone') { k.t += dt; if (k.t > 45 && U.d2(k.x, k.y, c.x, c.y) > 500 * 500) { const an = k.kind * 2.1 + 0.4; k.x = k.table.x + Math.cos(an) * 9; k.y = k.table.y + Math.sin(an) * 9; k.z = 1.02; k.st = 'on'; } }
  }
  for (const p of L.props) {
    p.t += dt; if (p.cd > 0) p.cd -= dt; if (p.shake > 0) p.shake -= dt;
    if (Math.abs(p.x - c.x) > 260 || Math.abs(p.y - c.y) > 260) continue;
    if (p.r) for (const k of G.cats) { const dx = k.x - p.x, dy = k.y - p.y, d = Math.hypot(dx, dy); if (d < p.r + 6 && d > 0.1 && !k.down && !k.plat) { const nx = k.x + dx / d * (p.r + 6 - d), ny = k.y + dy / d * (p.r + 6 - d); if (!W.blocked(nx, ny, k.r, 0)) { k.x = nx; k.y = ny; } } }
    if (p.k === 'sun' && !G.car && L.night < 0.5 && L.rain < 0.3 && U.d2(p.x, p.y, c.x, c.y) < 46 * 46) {
      const sit = c.emote && c.emote.k === 'sit'; for (const k of G.cats) if (!k.down && U.d2(p.x, p.y, k.x, k.y) < 70 * 70) k.hp = Math.min(k.max, k.hp + (sit ? 11 : 4) * dt);
      if (Math.random() < dt * (sit ? 3 : 1)) _.hearts(c.x, c.y, 1);
      if (!p.said || p.said < L.t) { p.said = L.t + 20; Game.fx.text(c.x, c.y - 56, tr('lf_sunny'), '#ffd23f', 14); }
    }
    if (p.k === 'laser' && p.cd <= 0 && !G.car && U.d2(p.x, p.y, c.x, c.y) < 120 * 120) { p.cd = 75; startLaser(L, p.x, p.y, 60); }
  }
  // reaching the roof of a climbing spot
  if (L.tops && c.plat && L.tops.includes(c.plat) && !c.plat.lifeDone) { c.plat.lifeDone = true; _.points(L, 30, c.x, c.y, 'lf_top'); sfx('star'); Game.fx.burst(c.x, c.y - 20, 12, ['#ffd23f', '#2de2e6'], 180, 'star', 7, 0.8); }
  // box nap: full health, a few hours go by, the game is saved
  if (L.sleep) {
    const s = L.sleep; s.t += dt;
    if (!c.emote || c.emote.k !== 'sit') L.sleep = null;
    else {
      if (Math.random() < dt * 3) Game.fx.part({ x: c.x + 8, y: c.y - 44, k: 'icon', icon: 'zzz', vy: -30, vx: 12, size: 9, life: 0.9 });
      if (s.t > 2.6) { for (const k of G.cats) if (!k.down) k.hp = k.max; G.cats[0].energy = 100; G.cats[0].exhausted = false; L.clock = (L.clock + 0.14) % 1; Life.S().clock = L.clock; if (!G.tour) VP.S.pos = { x: Math.round(c.x), y: Math.round(c.y) }; Life.wallet(G); VP.persist(); Game.fx.say('📦 ' + tr('lf_slept'), '#7CFF6B', 3); sfx('revive'); _.hearts(c.x, c.y, 6); c.emote = null; L.sleep = null; }
    }
  }
};

// ---------- clock, weather, radio ----------
const STATIONS = Life.STATIONS = [{ song: 1, key: 'lf_st0' }, { song: 0, key: 'lf_st1' }, { song: 7, key: 'lf_st2' }];
Life.radio = function (i) { // -1 off, 0..2 station; no argument = next
  const S = Life.S(), G = Game.G; if (i === undefined) i = S.radio >= STATIONS.length - 1 ? -1 : S.radio + 1;
  S.radio = i; VP.persist(); sfx('switch');
  if (i < 0) { if (G && G.tour && VP.UI.citySong) VP.Audio.music(VP.UI.citySong(G.tour)); else VP.UI.songD = -1; if (G) Game.fx.say('📻 ' + tr('lf_radioOff'), '#fff', 1.8); }
  else if (G) Game.fx.say(tr('lf_nowPlaying', tr(STATIONS[i].key)), '#ffd23f', 2.4);
  return i;
};
_.updWorld = function (L, dt, c) {
  const G = L.G, S = Life.S(), n0 = L.night;
  L.clock = (L.clock + dt / DAY) % 1; L.night = LL.night(L.clock);
  if (n0 < 0.5 && L.night >= 0.5) Game.fx.say('🌙 ' + tr('lf_night'), '#b8c7ff', 3); else if (n0 >= 0.5 && L.night < 0.5) Game.fx.say('🌅 ' + tr('lf_morning'), '#ffd23f', 2.6);
  L.saveT = (L.saveT || 0) + dt; if (L.saveT > 20) { L.saveT = 0; S.clock = L.clock; }
  // rain comes and goes; the streets stay wet for a while
  L.rainT -= dt;
  if (L.rainT <= 0) { L.raining = !L.raining; L.rainT = L.raining ? U.rand(45, 80) : U.rand(150, 300); if (!G.over) Game.fx.say(tr(L.raining ? 'lf_rainStart' : 'lf_rainEnd'), '#bcd8ff', 2.6); }
  L.rain += ((L.raining ? 1 : 0) - L.rain) * Math.min(1, dt * 0.6); L.wet += ((L.raining ? 1 : 0) - L.wet) * Math.min(1, dt * (L.raining ? 0.12 : 0.035));
  if (L.wet > 0.25 && c.walk && !G.car) { const p = LL.puddleAt(Math.floor(c.x / 192), Math.floor(c.y / 192)); if (p && U.d2(p.x, p.y, c.x, c.y) < p.r * p.r && (!L.splashT || L.splashT < L.t)) { L.splashT = L.t + 0.3; Game.fx.burst(c.x, c.y, 6, ['#bcd8ff', '#ffffff'], 110, 'dot', 4, 0.35); sfx('step', 0.25); if (Math.random() < 0.3) Game.fx.text(c.x, c.y - 50, tr('lf_puddle'), '#bcd8ff', 13); } }
  // radio keeps its station across districts
  if (S.radio >= 0 && STATIONS[S.radio]) { VP.Audio.music(STATIONS[S.radio].song); if (!G.tour) VP.UI.songD = VP.World.distAt(G.W, c.x, c.y); }
};

// ---------- focus: the one thing the action button would do right now, and the list of things to do nearby ----------
const ACTS = { box: ['📦', 'lf_a_box'], table: ['🍽️', 'lf_a_table'], sofa: ['🛋️', 'lf_a_sofa'], sun: ['☀️', 'lf_a_sun'], climb: ['🧗', 'lf_a_climb'], laser: ['🔴', 'lf_a_laser'], fly: ['🦋', 'lf_a_fly'], yarn: ['🧶', 'lf_a_yarn'], gang: ['😼', 'lf_a_gang'] };
Life.ACTS = ACTS;
_.updFocus = function (L, dt, c) {
  const G = L.G; let best = null;
  const offer = (x, y, r, icon, label, act, ref) => { const d2 = U.d2(x, y, c.x, c.y); if (d2 < r * r && (!best || d2 < best.d2)) best = { x, y, d2, icon, label, act, ref }; };
  if (!G.car && !c.down && !L.sleep) {
    for (const s of L.stalls) { if (Math.abs(s.x - c.x) > 160 || Math.abs(s.y - c.y) > 160) continue; offer(s.fx, s.fy, 62, s.def.icon, tr('lf_buy'), () => Life.openShop(s), s); offer(s.x, s.y, s.r + 34, s.def.icon, tr('lf_buy'), () => Life.openShop(s), s); }
    for (const p of L.props) {
      if (Math.abs(p.x - c.x) > 120 || Math.abs(p.y - c.y) > 120) continue;
      if (p.k === 'box') offer(p.x, p.y, 46, '📦', tr('lf_sleep'), () => sleep(L, p, c), p);
      else if (p.k === 'table' && p.cups.some(k => k.st === 'on')) offer(p.x, p.y, 54, '🥤', tr('lf_knock'), () => knock(L, p, c), p);
      else if (p.k === 'sofa' && p.cd <= 0) offer(p.x, p.y, 58, '🛋️', tr('lf_scratch'), () => scratch(L, p, c), p);
      else if (p.k === 'gang') offer(p.x, p.y, 84, '😼', tr('lf_greet'), () => gangTalk(L, p), p);
    }
    for (const a of L.animals) { if (a.kind !== 'cat' || a.gang || a.st === 'flee' || a.st === 'follow' || a.out) continue; if (a.celeb) offer(a.x, a.y, 84, '⭐', a.name, () => Life.celebPanel && Life.celebPanel(a), a); else offer(a.x, a.y, 62, a.friend ? '💛' : '🐱', tr(a.friend ? 'lf_pet' : 'lf_befriend'), () => Life.befriend(L, a), a); }
  }
  L.focus = best;
  // arriving at the waypoint clears it
  if (L.wp && U.d2(L.wp.x, L.wp.y, c.x, c.y) < 70 * 70) { L.wp = null; L.route = null; Game.fx.say('📍 ' + tr('lf_wpHere'), '#7CFF6B', 2); sfx('paw', 0.3); }
  L.nearT = (L.nearT || 0) - dt; if (L.nearT <= 0) { L.nearT = 0.6; L.near = Life.activities(G); }
};
// everything there is to do around the leader, closest first: [{icon, title, x, y, d (metres), cat}]
Life.activities = function (G) {
  const L = G.life, out = []; if (!L) return out; const a = Life.lead(G), lang = VP.lang() === 'pt' ? 'pt' : 'en';
  const push = (icon, title, x, y, cat) => out.push({ icon, title, x, y, cat, d: Math.round(Math.hypot(x - a.x, y - a.y) / 24) });
  for (const s of L.stalls) push(s.def.icon, s.def.name[lang], s.fx, s.fy, s.def.model === 'shop' && s.def.id === 'petshop' ? 'shop' : 'food');
  for (const p of L.props) if (ACTS[p.k]) push(ACTS[p.k][0], tr(ACTS[p.k][1]), p.x, p.y, 'fun');
  for (const c of L.animals) if (c.kind === 'cat' && !c.gang && !c.out) push(c.celeb ? '⭐' : c.friend ? '💛' : '🐱', c.celeb ? c.name : tr('lf_a_cat', c.name), c.x, c.y, 'friend');
  if (G.markers) for (const m of G.markers) { if (m.k === 'mission' || m.k === 'race') { const mm = VP.Missions.get(m.n); push(m.k === 'race' ? '🏁' : '▶', mm ? VP.mname(mm) : tr('lf_a_mission'), m.x, m.y, 'mission'); } else if (m.k === 'shop') push('🛍', tr('shop'), m.x, m.y, 'shop'); else if (m.k === 'npc') push('💬', m.label, m.x, m.y, 'mission'); else if (/clinic|vet/.test(m.k)) push('➕', m.label || tr('lf_legClinic'), m.x, m.y, 'clinic'); }
  out.sort((p, q) => p.d - q.d); return out;
};
// puddles sit at fixed spots (a hash of the 192 px cell), so the renderer and the splash check agree without sharing state
LL.puddleAt = function (cx, cy) { let h = (cx * 73856093) ^ (cy * 19349663); h = (h ^ (h >>> 13)) >>> 0; if (h % 5 > 1) return null; return { x: (cx + 0.2 + ((h >>> 3) % 60) / 100) * 192, y: (cy + 0.2 + ((h >>> 9) % 60) / 100) * 192, r: 22 + (h >>> 15) % 20 }; };
})();
