'use strict';
// VICE PAWS — city life simulation: pedestrians, street cats and dogs, pigeons, ambient traffic and traffic lights.
// Same layer as game.js (2D, px, no Three.js). State lives in G.life; life/gfx.js draws it, life/hud.js labels it.
// Kid-safe by construction: nothing in here deals damage. People pet, feed, shoo and (comically) chase; vehicles brake.
(function () {
const VP = window.VP, U = VP.U, I = VP.I, T = VP.TILE, LL = VP.LifeLogic, Game = VP.Game;
const Life = VP.Life = { ready: false, on: true, D: { stalls: null, npcs: null }, _: {} };
const tmp = { x: 0, y: 0 };
const sfx = (n, g) => VP.Audio && VP.Audio.sfx(n, g);
const tr = (...a) => VP.t(...a);
// one of the "|" separated variants of a line
const line = Life.line = function (k, ...args) { const s = VP.t(k, ...args).split('|'); return s[(Math.random() * s.length) | 0]; };
const lead = Life.lead = G => G.car || G.cats[G.active];

// ---------- data ----------
Life.load = function () {
  const get = f => fetch('data/' + f + '.json').then(r => r.json());
  return Promise.all([get('stalls'), get('npcs')]).then(([s, n]) => {
    const bad = LL.checkStalls(s);
    if (bad.length) { console.warn('stalls.json', bad); return; }
    Life.D.stalls = s; Life.D.npcs = n; Life.ready = true;
  }).catch(e => console.warn('life data', e));
};
// persisted bits (friends, mischief points, clock)
Life.S = function () { const S = VP.S; if (!S.life || typeof S.life !== 'object') S.life = { friends: {}, pts: 0, clock: 0.42, gang: 0, snaps: 0, radio: -1 }; if (!S.life.friends) S.life.friends = {}; return S.life; };

// ---------- network per world (cached on the world object: the home city lives for the whole session) ----------
function netOf(W) {
  if (W._lifeNet) return W._lifeNet;
  let net;
  if (W.real) {
    const C = W.real, half = C.half, MPT = VP.World.MPT, toPx = m => (m + half) / MPT * T;
    const ok = (x, y) => { if (x < T * 2 || y < T * 2 || x > W.pw - T * 2 || y > W.ph - T * 2 || !W.clear(x, y)) return false; return !W.conn || W.conn[Math.floor(y / T) * W.W + Math.floor(x / T)] >= 0; };
    net = LL.roadNet(C.roads, toPx, ok, (a, b, c, d) => W.los(a, b, c, d, 0), { mpt: MPT });
  } else net = LL.gridNet(W);
  W._lifeNet = net; return net;
}
Life.net = netOf;

// ---------- init ----------
function init(G) {
  const W = G.W, S = Life.S(), free = !!G.free, comu = !!(W.real && (W.real.tags || []).includes('comunidade'));
  const L = {
    G, W, t: 0, free, ambient: !free, comu, rng: U.rng(977 + (G.id || 0) * 31 + (W.real ? W.real.id.length * 7 : 0)), net: netOf(W), N: Life.D.npcs,
    peds: [], animals: [], birds: [], flies: [], vehicles: [], stalls: [], props: [], benches: [], windows: [], toys: [], knock: [],
    buffs: {}, toast: [], favor: null, focus: null, near: [], wp: null, route: null,
    clock: free ? S.clock || 0.42 : 0.5, rain: 0, wet: 0, rainT: free ? U.rand(70, 150) : 1e9, night: 0,
    capScale: 1, caps: null, spawnT: 0, first: true, fpsT: 0, id: 1, miau: false, missCd: 0, lightsOn: free && !W.real && !!W.RX && W.RX.length > 1,
    stats: { ufa: 0, pets: 0, stolen: 0, bought: 0, favors: 0, friends: 0, knocked: 0, scared: 0, pts: 0 },
  };
  L.caps = LL.caps(L.N.caps, VP.R3 ? VP.R3.quality : 1, !!(VP.R3 && VP.R3.mobile), 1, L.ambient);
  if (free && Life._.placeStalls) Life._.placeStalls(L);
  if (free && Life._.placeProps) Life._.placeProps(L);
  if (free && Life._.placeCelebs) Life._.placeCelebs(L);
  return L;
}
Life.state = G => (G && G.life) || null;

// ---------- bubbles / fx helpers ----------
function say(e, txt, dur) { e.bub = { txt, t: dur || 2.4, d: dur || 2.4 }; }
function hearts(x, y, n) { for (let i = 0; i < (n || 4); i++) Game.fx.part({ x: x + U.rand(-12, 12), y: y - 14 + U.rand(-8, 8), k: 'heart', size: 6, life: 0.7, vy: -46, vx: U.rand(-14, 14), col: '#ff7ac0' }); }
function points(L, n, x, y, key) { const S = Life.S(); S.pts = (S.pts || 0) + n; L.stats.pts += n; L.G.stat.cash += Math.max(1, Math.round(n / 5)); if (key) Game.fx.text(x, y - 46, tr(key, n), '#ffd23f', 15); }
function turnTo(e, a, k) { e.a += U.angDiff(e.a, a) * Math.min(1, k); }
Life._.say = say; Life._.hearts = hearts; Life._.points = points; Life._.turnTo = turnTo;

// ---------- pedestrians ----------
function makePed(L, role, x, y, from, to) {
  const R = L.N.roles.find(r => r.id === role) || { spd: [50, 70] }, r = L.rng;
  const p = { kind: 'ped', id: L.id++, role, x, y, a: r() * 6.283, from, to, lane: r.range(8, 15), spd: r.range(R.spd[0], R.spd[1]), st: 'walk', t: r() * 9, timer: r.range(4, 14), walk: 0,
    look: LL.look(L.N, r, role), fade: L.first ? 1 : 0, bub: null, cool: 0, snack: null, pose: 0, arm: 0 };
  if (role === 'eater') p.snack = r.pick(L.N.snacks);
  if (role === 'tourist') p.cam = 1;
  if (role === 'jogger') p.lane = 4;
  L.peds.push(p); return p;
}
Life._.makePed = makePed;
function edgeTarget(L, p, out) {
  const n = L.net, tx = n.x[p.to], ty = n.y[p.to], ux = tx - n.x[p.from], uy = ty - n.y[p.from], l = Math.hypot(ux, uy);
  if (l > 1) { out.x = tx - uy / l * p.lane; out.y = ty + ux / l * p.lane; } else { out.x = tx; out.y = ty; }
}
function canCross(L, e) { const cols1 = L.W.cols + 1; return LL.canWalk(L.t, e.light % cols1, Math.floor(e.light / cols1), e.axis); }
function arrive(L, p) {
  const nx = LL.nextNode(L.net, p.to, p.from, L.rng, p.role === 'jogger' ? 0.2 : 0.5);
  p.from = p.to; p.to = nx < 0 ? p.from : nx;
  const e = L.lightsOn ? LL.edge(L.net, p.from, p.to) : null;
  p.cross = e && e.light >= 0 ? e : null;
  if (p.cross && !canCross(L, p.cross)) p.waiting = true;
}
function walkEdge(L, p, dt, spd) {
  if (p.waiting) { if (canCross(L, p.cross)) p.waiting = false; else { const n = L.net; turnTo(p, Math.atan2(n.y[p.to] - p.y, n.x[p.to] - p.x), dt * 5); return; } }
  edgeTarget(L, p, tmp);
  const dx = tmp.x - p.x, dy = tmp.y - p.y, d = Math.hypot(dx, dy);
  if (d < 9) { arrive(L, p); return; }
  const s = Math.min(d, spd * dt); p.x += dx / d * s; p.y += dy / d * s; p.walk = 1; turnTo(p, Math.atan2(dy, dx), dt * 8);
}
// run with collision; cuts corners through the flow field towards the leader when there is no line of sight
function runTo(L, p, tx, ty, spd, dt, useField) {
  const W = L.W; let dx = tx - p.x, dy = ty - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  if (useField && L.G.field && !W.los(p.x, p.y, tx, ty, 0) && W.fieldDir(L.G.field, p.x, p.y, tmp) > 0) { dx = tmp.x; dy = tmp.y; }
  const nx = p.x + dx * spd * dt, ny = p.y + dy * spd * dt;
  if (!W.blocked(nx, p.y, 8, 0)) p.x = nx; if (!W.blocked(p.x, ny, 8, 0)) p.y = ny;
  p.walk = 1; turnTo(p, Math.atan2(dy, dx), dt * 10); return d;
}
Life._.runTo = runTo;
// back to the sidewalk network after a detour (petting, chasing, following); leaves quietly if there is no way back
function rejoin(L, p) {
  const pool = LL.nodesInRing(L.net, p.x, p.y, 0, 300, []); let best = -1, bd = 1e12;
  for (const i of pool) { const d = U.d2(p.x, p.y, L.net.x[i], L.net.y[i]); if (d < bd && L.W.los(p.x, p.y, L.net.x[i], L.net.y[i], 0)) { bd = d; best = i; } }
  if (best < 0) { p.out = true; return; }
  p.from = p.to = best; p.st = 'walk'; p.waiting = false; p.cross = null; p.timer = U.rand(5, 12);
}
Life._.rejoin = rejoin;
function face(p, o, dt) { turnTo(p, Math.atan2(o.y - p.y, o.x - p.x), dt * 9); }

function updPed(L, p, dt, a, near) {
  const G = L.G;
  p.t += dt; p.walk = 0; if (p.cool > 0) p.cool -= dt; if (p.fade < 1 && !p.out) p.fade = Math.min(1, p.fade + dt * 2.2);
  if (p.out) { p.fade -= dt * 2; if (p.fade <= 0) p.dead = true; return; }
  if (p.bub) { p.bub.t -= dt; if (p.bub.t <= 0) p.bub = null; }
  const spd = p.spd * (L.rain > 0.4 ? 1.18 : 1);
  switch (p.st) {
    case 'walk': {
      if (p.leader) { // second half of a pair: walks on the leader's left, the inner side of the sidewalk
        const l = p.leader; if (l.dead || l.out) { p.leader = null; rejoin(L, p); break; }
        if (l.st === 'talk') { face(p, l, dt); break; }
        const tx = l.x + Math.sin(l.a) * 22, ty = l.y - Math.cos(l.a) * 22, d = Math.hypot(tx - p.x, ty - p.y);
        if (d > 5) { const s = Math.min(d, spd * (d > 40 ? 1.5 : 1.08) * dt); p.x += (tx - p.x) / d * s; p.y += (ty - p.y) / d * s; p.walk = l.walk || d > 14 ? 1 : 0; }
        turnTo(p, l.a, dt * 6); break;
      }
      walkEdge(L, p, dt, spd);
      if (!near) break;
      p.timer -= dt;
      if (p.timer <= 0 && !p.waiting) {
        p.timer = U.rand(9, 18);
        if (p.role === 'tourist') { p.st = 'photo'; p.stT = 2.6; say(p, line('lf_photo'), 2.2); }
        else if (p.mate) { p.st = 'talk'; p.stT = U.rand(4, 6.5); p.talkN = 0; }
        else if (p.role === 'jogger' && Math.random() < 0.4) say(p, line('lf_jog'), 1.8);
        else if (L.rain > 0.5 && Math.random() < 0.25) say(p, line('lf_rain'), 2);
        else if (p.role === 'walker' && Math.random() < 0.3) { p.st = 'idle'; p.stT = U.rand(2, 4.5); p.pose = 1; }
      }
      // kids love cats
      if (p.role === 'kid' && L.free && !G.car && p.cool <= 0 && U.d2(p.x, p.y, a.x, a.y) < 170 * 170) { p.cool = 40; if (Math.random() < L.N.chance.kidFollow) { p.st = 'follow'; p.stT = U.rand(9, 14); say(p, line('lf_kid'), 2.4); } }
      break;
    }
    case 'idle': p.stT -= dt; if (p.stT <= 0) { p.st = 'walk'; p.pose = 0; } break;
    case 'photo': p.stT -= dt; p.pose = 2; if (p.stT < 1.2 && !p.flashed) { p.flashed = true; if (near) Game.fx.part({ x: p.x + Math.cos(p.a) * 14, y: p.y + Math.sin(p.a) * 14 - 40, k: 'flash', size: 16, life: 0.16, col: '#ffffff' }); } if (p.stT <= 0) { p.st = 'walk'; p.pose = 0; p.flashed = false; } break;
    case 'talk': {
      const m = p.mate; if (!m || m.dead) { p.st = 'walk'; break; }
      face(p, m, dt); p.stT -= dt; p.pose = Math.sin(p.t * 5) > 0.6 ? 3 : 0;
      const n = Math.floor((6.5 - p.stT) / 2.1); if (near && n > p.talkN) { p.talkN = n; say(n % 2 ? p : m, line(n % 2 ? 'lf_talkB' : 'lf_talkA'), 1.9); }
      if (p.stT <= 0) { p.st = 'walk'; p.pose = 0; }
      break;
    }
    case 'sit': {
      p.pose = 4;
      if (near && L.free && !G.car) { const d2 = U.d2(p.x, p.y, a.x, a.y); if (d2 < 60 * 60 && p.cool <= 0) { p.cool = 14; say(p, line(a.emote && a.emote.k === 'sit' ? 'lf_petting' : 'lf_bench'), 2.4); if (a.emote && a.emote.k === 'sit') { hearts(a.x, a.y, 5); a.hp = Math.min(a.max, a.hp + 8); L.stats.pets++; } } }
      break;
    }
    case 'react': { // "own, que gatinho!"
      face(p, a, dt); p.pose = 3; p.stT -= dt;
      if (p.stT <= 0) { p.pose = 0; if (p.then === 'pet' && !G.car) { p.st = 'pet'; p.stT = 5; p.petT = 0; } else if (p.then === 'snack') { p.st = 'offer'; p.stT = 1.2; say(p, line('lf_snack'), 2); } else p.st = 'walk'; }
      break;
    }
    case 'pet': {
      p.stT -= dt; const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d > 34) { runTo(L, p, a.x, a.y, 92, dt, false); if (d > 260 || p.stT <= 0) { p.st = 'walk'; p.pose = 0; } }
      else {
        face(p, a, dt); p.pose = 5; p.petT += dt;
        if (!p.petSaid) { p.petSaid = true; say(p, line('lf_petting'), 2); }
        if (Math.random() < dt * 5) hearts(a.x, a.y, 1);
        if (p.petT > 1.7) { a.hp = Math.min(a.max, a.hp + 10); L.stats.pets++; points(L, 5); sfx('pickup', 0.2); if (L.favorHook) L.favorHook('pet', p); p.st = 'walk'; p.pose = 0; p.petSaid = false; p.cool = 25; }
      }
      break;
    }
    case 'offer': {
      face(p, a, dt); p.pose = 6; p.stT -= dt;
      if (p.stT <= 0) { const q = Game.nearFree(p.x + Math.cos(p.a) * 30, p.y + Math.sin(p.a) * 30, 14, 0) || p; Game.addItem(p.snack || 'treat', q.x, q.y, true); if (p.snack) p.snack = null; p.st = 'walk'; p.pose = 0; p.cool = 30; }
      break;
    }
    case 'follow': { // a kid trailing the cat
      p.stT -= dt; const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d > 52) runTo(L, p, a.x, a.y, Math.min(170, 70 + d * 0.6), dt, true); else face(p, a, dt);
      if (Math.random() < dt * 0.22 && near) say(p, line('lf_kid'), 2);
      if (p.stT <= 0 || d > 520 || G.car) rejoin(L, p);
      break;
    }
    case 'chase': { // comic chase: flailing arms, slower than any of the cats, gives up quickly, never hurts
      p.stT -= dt; p.pose = 7; if (p.shock > 0) { p.shock -= dt; face(p, a, dt); break; } // a moment of outrage first: the cat gets a head start
      const d = runTo(L, p, a.x, a.y, p.chaseSpd || 128, dt, true);
      if (Math.random() < dt * 0.5 && near) say(p, line(p.chaseLine || 'lf_thief'), 1.8);
      if (d < 26 && !G.car) { say(p, line('lf_caught'), 2.6); a.hopT = 0.5; Game.fx.poof(a.x, a.y - 10, 5); p.st = 'scold'; p.stT = 2.2; p.pose = 3; }
      else if (p.stT <= 0 || d > 620 || G.car) { say(p, line('lf_gaveup'), 2.6); if (d > 120) points(L, 15, a.x, a.y, 'lf_escaped'); p.st = 'scold'; p.stT = 2; p.pose = 0; }
      break;
    }
    case 'scold': p.stT -= dt; face(p, a, dt); if (p.stT <= 0) { p.pose = 0; if (p.home) { p.st = 'gohome'; } else rejoin(L, p); } break;
    case 'gohome': { const d = runTo(L, p, p.home.x, p.home.y, 80, dt, false); p.goT = (p.goT || 0) + dt; if (d < 12 || p.goT > 12) { p.x = p.home.x; p.y = p.home.y; p.goT = 0; p.st = p.homeSt; p.a = p.home.a; } break; }
    case 'dodge': p.stT -= dt; { const nx = p.x + p.dx * 150 * dt, ny = p.y + p.dy * 150 * dt; if (!L.W.blocked(nx, ny, 8, 0)) { p.x = nx; p.y = ny; } p.walk = 1; p.pose = 7; } if (p.stT <= 0) { p.pose = 0; p.st = p.st0 || 'walk'; if (p.st === 'walk' && !p.leader) rejoin(L, p); } break;
    case 'vendor': { // behind the counter
      const d2 = U.d2(p.x, p.y, a.x, a.y);
      if (d2 < 220 * 220) { face(p, a, dt); p.pose = d2 < 120 * 120 ? 3 : 0; } else { turnTo(p, p.home.a, dt * 3); p.pose = 0; }
      p.timer -= dt; if (p.timer <= 0) { p.timer = U.rand(7, 13); if (d2 < 520 * 520 && p.stall) say(p, line('lf_vendor_' + p.stall.def.id), 2.4); }
      break;
    }
    case 'guard': { // waiter / shop owner minding the place; shoos the cat off, softened by meows
      const d2 = U.d2(p.x, p.y, a.x, a.y);
      if (p.soft > 0) { p.soft -= dt; face(p, a, dt); p.pose = 0; break; }
      if (d2 < 130 * 130 && !G.car) {
        face(p, a, dt); p.pose = 3;
        if (p.cool <= 0) { p.cool = 2.6; say(p, line('lf_shoo'), 2); }
        if (d2 < 62 * 62) { const d = Math.sqrt(d2) || 1; a.kx = (a.x - p.x) / d * 210; a.ky = (a.y - p.y) / d * 210; Game.fx.poof(a.x, a.y - 8, 3); } // a gentle nudge with the dish towel
      } else { turnTo(p, p.home.a, dt * 3); p.pose = 0; }
      break;
    }
    case 'model': p.pose = 2; break; // posing photographer of the photo favor
    case 'customer': p.pose = p.sitting ? 4 : 3; break;
    default: if (Life._.pedState && Life._.pedState[p.st]) Life._.pedState[p.st](L, p, dt, a, near);
  }
}

// ---------- reactions ----------
// The leader meowed. People melt, street cats answer, the waiter softens.
function onMeow(L, a) {
  const G = L.G, C = L.N.chance; let aw = 0;
  for (const p of L.peds) {
    if (p.out || U.d2(p.x, p.y, a.x, a.y) > 190 * 190) continue;
    if (p.st === 'guard') { p.meows = (p.meows || 0) + 1; if (p.meows >= 3 && !(p.soft > 0)) { p.meows = 0; p.soft = 30; say(p, line('lf_softened'), 3); const q = Game.nearFree(p.x, p.y, 40, 0) || p; Game.addItem('sushi', q.x, q.y, true); } continue; }
    if (p.st === 'vendor') { if (p.cool <= 0) { p.cool = 8; say(p, line('lf_aw'), 2); } continue; }
    if (p.st !== 'walk' || p.cool > 0 || p.leader) continue;
    p.cool = 20; aw++;
    const r = Math.random(); p.st = 'react'; p.stT = 1.1; p.waiting = false; p.then = r < C.petOnMeow ? 'pet' : r < C.petOnMeow + C.snackOnMeow ? 'snack' : null;
    say(p, line('lf_aw'), 2.2);
    if (L.favorHook) L.favorHook('meow', p);
    if (aw >= 3) break;
  }
  for (const c of L.animals) {
    if (U.d2(c.x, c.y, a.x, a.y) > 170 * 170) continue;
    if (c.kind === 'dog') { say(c, line('lf_dog'), 1.6); c.wag = 2; if (c.owner && c.owner.cool <= 0) { c.owner.cool = 9; say(c.owner, line('lf_dogowner', c.name), 2.2); } }
    else if (c.gang || c.celeb) say(c, line(c.celeb ? 'lf_celebHi' : 'lf_cat_yes'), 1.6);
    else if (c.st !== 'flee') Life.befriend(L, c);
  }
  for (const w of L.windows) if (U.d2(w.x, w.y, a.x, a.y) < 270 * 270) { w.bub = { txt: line('lf_cat_window'), t: 1.8, d: 1.8 }; w.hop = 0.5; }
  void G;
}
Life.befriend = function (L, c) {
  const G = L.G, a = G.cats[G.active], S = Life.S();
  if (c.friend) { hearts(c.x, c.y, 4); say(c, line('lf_cat_yes'), 1.8); c.st = 'follow'; c.timer = 30; Game.fx.say(tr('lf_friendFollows', c.name), '#ffd23f', 2); return true; }
  if (c.cool > 0) return false;
  const base = c.mood === 'friendly' ? 0.85 : c.mood === 'shy' ? 0.5 : 0.32, calm = a.emote && a.emote.k === 'sit' ? 0.3 : 0; // sitting down calms shy cats
  if (Math.random() < base + calm) {
    c.friend = true; c.st = 'follow'; c.timer = 40; hearts(c.x, c.y, 8); say(c, line('lf_cat_yes'), 2.2); sfx('paw', 0.3);
    if (!S.friends[c.fid]) { S.friends[c.fid] = 1; G.stat.cash += 10; L.stats.friends++; VP.persist(); }
    Game.fx.say(tr('lf_newFriend', c.name), '#ffd23f', 2.6); return true;
  }
  say(c, line('lf_cat_hiss'), 1.6); c.st = 'flee'; c.timer = 2.4; c.cool = 14; const d = Math.hypot(c.x - a.x, c.y - a.y) || 1; c.dx = (c.x - a.x) / d; c.dy = (c.y - a.y) / d; return false;
};
// Morticia helps herself to a passer-by's snack: the owner gives chase, arms in the air, and gives up after a few seconds
function trySteal(L, a) {
  let best = null, bd = 66 * 66;
  for (const p of L.peds) if (p.snack && !p.out && p.st !== 'chase') { const d = U.d2(p.x, p.y, a.x, a.y); if (d < bd) { bd = d; best = p; } }
  if (!best) return false;
  const G = L.G, p = best, m = G.cats[2];
  Game.fx.part({ x: p.x, y: p.y - 30, k: 'fly', icon: p.snack, tx: a, life: 0.3, size: 11 });
  m.belly = Math.min(100, m.belly + 28); G.stat.eaten++; a.mouth = 1; sfx('steal', 0.1); Game.fx.text(a.x, a.y - 56, tr('stolen'), '#ffb347', 16);
  p.snack = null; p.st = 'chase'; p.stT = 8; p.shock = 1; p.chaseLine = 'lf_thief'; p.waiting = false; say(p, line('lf_thief'), 2); L.stats.stolen++; points(L, 10);
  if (p.mate) { p.mate.leader = null; p.mate.mate = null; p.mate = null; }
  return true;
}
// the player is driving towards people: they hop out of the way (and the car is slowed, never the other way round)
function carVsPeds(L) {
  const car = L.G.car; if (!car || Math.abs(car.spd) < 40) return;
  const ca = Math.cos(car.a), sa = Math.sin(car.a), sg = car.spd > 0 ? 1 : -1;
  for (const p of L.peds) {
    const dx = p.x - car.x, dy = p.y - car.y; if (dx * dx + dy * dy > 150 * 150) continue;
    const f = (dx * ca + dy * sa) * sg, s = -dx * sa + dy * ca;
    if (f > -10 && f < 110 && Math.abs(s) < 40 && p.st !== 'dodge') {
      if (p.st !== 'sit') { p.st0 = p.home ? p.st : 'walk'; p.st = 'dodge'; p.stT = 0.55; const k = s >= 0 ? 1 : -1; p.dx = -sa * k; p.dy = ca * k; say(p, line('lf_eita'), 1.4); }
      if (f < 46) { car.spd *= 0.55; sfx('honk', 1); }
    }
  }
}

// ---------- animals ----------
function makeCat(L, x, y, i) {
  const defs = L.N.streetCats, d = defs[i % defs.length];
  const c = { kind: 'cat', id: L.id++, x, y, a: L.rng() * 6.283, st: 'idle', timer: L.rng.range(2, 7), t: L.rng() * 9, walk: 0, sit: L.rng() < 0.5 ? 1 : 0, mood: d.mood, def: d, name: d.name[VP.lang() === 'pt' ? 'pt' : 'en'],
    fid: (L.W.real ? L.W.real.id : 'home') + ':' + (i % defs.length), cool: 0, bub: null, fade: L.first ? 1 : 0, spd: 62, size: L.rng.range(0.62, 0.8), vi: i % defs.length };
  c.friend = !!Life.S().friends[c.fid];
  L.animals.push(c); return c;
}
function makeDog(L, x, y, owner) {
  const d = L.rng.pick(L.N.petDogs);
  const c = { kind: 'dog', id: L.id++, x, y, a: 0, st: owner ? 'leash' : 'idle', timer: 3, t: L.rng() * 9, walk: 0, def: d, name: d.name, owner: owner || null, bub: null, fade: L.first ? 1 : 0, wag: 0, cool: 0, spd: 60 };
  L.animals.push(c); return c;
}
Life._.makeCat = makeCat; Life._.makeDog = makeDog;
function wanderGoal(L, c, r) {
  for (let k = 0; k < 6; k++) { const an = Math.random() * 6.283, d = U.rand(40, r), x = c.x + Math.cos(an) * d, y = c.y + Math.sin(an) * d; if (!L.W.blocked(x, y, 9, 0) && L.W.los(c.x, c.y, x, y, 0) && (L.W.real || L.W.gnd[Math.floor(y / T) * L.W.W + Math.floor(x / T)] !== 1)) { c.gx = x; c.gy = y; return true; } }
  return false;
}
function updAnimal(L, c, dt, a) {
  const G = L.G;
  c.t += dt; c.walk = 0; if (c.cool > 0) c.cool -= dt; if (c.wag > 0) c.wag -= dt; if (c.fade < 1 && !c.out) c.fade = Math.min(1, c.fade + dt * 2.2);
  if (c.out) { c.fade -= dt * 2; if (c.fade <= 0) c.dead = true; return; }
  if (c.bub) { c.bub.t -= dt; if (c.bub.t <= 0) c.bub = null; }
  if (c.st === 'leash') {
    const o = c.owner; if (!o || o.dead || o.out) { c.out = true; return; }
    let tx = o.x + Math.cos(o.a) * 30 + Math.sin(o.a) * 12, ty = o.y + Math.sin(o.a) * 30 - Math.cos(o.a) * 12;
    const dc = Math.hypot(a.x - c.x, a.y - c.y);
    if (dc < 130 && !G.car) { // strains at the leash towards the cat, tail going like a propeller
      const k = 34 / (Math.hypot(a.x - o.x, a.y - o.y) || 1); tx = o.x + (a.x - o.x) * k; ty = o.y + (a.y - o.y) * k; c.wag = 0.5;
      if (c.cool <= 0) { c.cool = 7; say(c, line('lf_dog'), 1.5); if (o.cool <= 0) { o.cool = 9; say(o, line('lf_dogowner', c.name), 2.2); } }
    }
    const d = Math.hypot(tx - c.x, ty - c.y); if (d > 4) { const s = Math.min(d, 150 * dt); c.x += (tx - c.x) / d * s; c.y += (ty - c.y) / d * s; c.walk = d > 8 ? 1 : 0; turnTo(c, dc < 130 ? Math.atan2(a.y - c.y, a.x - c.x) : Math.atan2(ty - c.y, tx - c.x), dt * 8); }
    return;
  }
  switch (c.st) {
    case 'idle':
      c.timer -= dt;
      if (c.kind === 'cat' && !G.car && U.d2(c.x, c.y, a.x, a.y) < 120 * 120) turnTo(c, Math.atan2(a.y - c.y, a.x - c.x), dt * 3);
      if (c.timer <= 0) { if (c.gang) { c.timer = U.rand(4, 9); if (Math.random() < 0.3 && U.d2(c.x, c.y, a.x, a.y) < 300 * 300) say(c, line('lf_cat_yes'), 1.4); } else if (wanderGoal(L, c, 150)) { c.st = 'wander'; c.sit = 0; } else c.timer = 2; }
      break;
    case 'wander': { const d = Math.hypot(c.gx - c.x, c.gy - c.y); if (d < 8) { c.st = 'idle'; c.timer = U.rand(3, 9); c.sit = Math.random() < 0.6 ? 1 : 0; } else { const s = Math.min(d, c.spd * dt); c.x += (c.gx - c.x) / d * s; c.y += (c.gy - c.y) / d * s; c.walk = 1; turnTo(c, Math.atan2(c.gy - c.y, c.gx - c.x), dt * 8); } break; }
    case 'follow': {
      c.timer -= dt; c.sit = 0; const d = Math.hypot(a.x - c.x, a.y - c.y);
      if (d > 54) runTo(L, c, a.x, a.y, Math.min(215, 80 + d), dt, true); else { turnTo(c, Math.atan2(a.y - c.y, a.x - c.x), dt * 5); c.sit = a.emote && a.emote.k === 'sit' ? 1 : 0; }
      if (Math.random() < dt * 0.3) hearts(c.x, c.y, 1);
      if (c.timer <= 0 || d > 640 || G.car) { c.st = 'idle'; c.timer = U.rand(2, 5); }
      break;
    }
    case 'flee': { c.timer -= dt; const nx = c.x + c.dx * 215 * dt, ny = c.y + c.dy * 215 * dt; if (!L.W.blocked(nx, c.y, 8, 0)) c.x = nx; if (!L.W.blocked(c.x, ny, 8, 0)) c.y = ny; c.walk = 1; c.sit = 0; turnTo(c, Math.atan2(c.dy, c.dx), dt * 12); if (c.timer <= 0) { c.st = 'idle'; c.timer = U.rand(3, 6); } break; }
    default: if (Life._.animalState && Life._.animalState[c.st]) Life._.animalState[c.st](L, c, dt, a);
  }
}

// ---------- pigeons and butterflies ----------
function spawnFlock(L, x, y, n, tag) {
  const out = [];
  for (let i = 0; i < n; i++) { const b = { x: x + U.rand(-34, 34), y: y + U.rand(-34, 34), a: Math.random() * 6.283, z: 0, st: 'peck', t: Math.random() * 5, timer: U.rand(0.5, 3), tag: tag || null, fade: L.first ? 1 : 0 }; if (L.W.blocked(b.x, b.y, 6, 0)) { b.x = x; b.y = y; } L.birds.push(b); out.push(b); }
  return out;
}
Life._.spawnFlock = spawnFlock;
function updBird(L, b, dt, a) {
  b.t += dt; if (b.fade < 1) b.fade = Math.min(1, b.fade + dt * 2);
  if (b.st === 'fly') { b.z += dt * 2.6; b.x += Math.cos(b.a) * 210 * dt; b.y += Math.sin(b.a) * 210 * dt; b.timer -= dt; if (b.timer <= 0) b.dead = true; return; }
  const G = L.G, fast = G.car ? Math.abs(G.car.spd) > 30 : true, d2 = U.d2(b.x, b.y, a.x, a.y), r = G.car ? 110 : a.walk && fast ? 84 : 44;
  if (d2 < r * r) { b.st = 'fly'; b.timer = 2.4; b.a = Math.atan2(b.y - a.y, b.x - a.x) + U.rand(-0.5, 0.5); L.stats.scared++; if (L.favorHook) L.favorHook('bird', b); if (!L.flockT || L.flockT < L.t) { L.flockT = L.t + 1.2; sfx('dash', 0.4); points(L, 3, b.x, b.y, null); } return; }
  b.timer -= dt; if (b.timer <= 0) { b.timer = U.rand(0.6, 2.6); b.a += U.rand(-1.4, 1.4); b.hop = 0.25; const nx = b.x + Math.cos(b.a) * 9, ny = b.y + Math.sin(b.a) * 9; if (!L.W.blocked(nx, ny, 5, 0)) { b.x = nx; b.y = ny; } }
  if (b.hop > 0) b.hop -= dt;
}
function updFly(L, f, dt, a) {
  f.t += dt; f.x = f.hx + Math.sin(f.t * 0.9 + f.ph) * 46 + Math.sin(f.t * 2.3) * 12; f.y = f.hy + Math.cos(f.t * 0.7 + f.ph * 2) * 40; f.z = 0.8 + Math.sin(f.t * 1.7 + f.ph) * 0.35;
  if (!L.G.car && L.free && U.d2(f.x, f.y, a.x, a.y) < 24 * 24) { f.dead = true; points(L, 5, f.x, f.y, 'lf_butterfly'); sfx('star', 0.1); Game.fx.burst(f.x, f.y - 20, 6, [f.col, '#fff'], 120, 'star', 5, 0.5); }
}

// ---------- spawn / despawn ----------
function spawnStuff(L, a, yaw) {
  const N = L.N, R = N.radius, net = L.net, r = L.rng, first = L.first, C = L.caps;
  const taken = (x, y) => { for (const p of L.peds) if (U.d2(p.x, p.y, x, y) < 44 * 44) return true; return false; };
  const spot = () => LL.pickSpawn(net, a.x, a.y, first ? null : yaw, first ? R.first : R.spawnMin, first ? R.spawnMax * 0.92 : R.spawnMax, r, taken);
  let walkers = 0; for (const p of L.peds) if (!p.fixed) walkers++;
  if (walkers < C.peds) {
    const sp = spot();
    if (sp) {
      let role = LL.weighted(N.roles, r).id;
      if (L.ambient && (role === 'eater' || role === 'sitter')) role = 'walker';
      if (role === 'dogwalker') { let dogs = 0; for (const c of L.animals) if (c.kind === 'dog') dogs++; if (dogs >= C.dogs) role = 'walker'; }
      if (role === 'sitter') { // only where a free bench is close
        let bench = null; for (const b of L.benches) if (!b.by && Math.abs(b.x - net.x[sp.node]) < 420 && Math.abs(b.y - net.y[sp.node]) < 420 && (first || U.d2(b.x, b.y, a.x, a.y) > 300 * 300)) { bench = b; break; }
        if (bench) { const p = makePed(L, 'sitter', bench.x, bench.y, sp.node, sp.to); p.st = 'sit'; p.a = bench.a; p.bench = bench; bench.by = p; p.fixed = false; p.sitting = true; return; }
        role = 'walker';
      }
      const p = makePed(L, role, net.x[sp.node], net.y[sp.node], sp.node, sp.to);
      if (role === 'pair') { const q = makePed(L, 'pair', p.x + 18, p.y + 6, sp.node, sp.to); q.leader = p; p.mate = q; q.mate = p; q.spd = p.spd; }
      if (role === 'dogwalker') makeDog(L, p.x + 20, p.y, p);
    }
  }
  if (L.ambient && L.G.m && L.G.m.type !== 'free' && L.t > 1) { /* missions: people only */ }
  let cats = 0, dogs = 0; for (const c of L.animals) { if (c.kind === 'cat' && !c.gang && !c.fixed) cats++; else if (c.kind === 'dog' && !c.owner) dogs++; }
  if (cats < C.cats) { const sp = spot(); if (sp) { const x = net.x[sp.node], y = net.y[sp.node]; let i = r.int(0, N.streetCats.length - 1); for (let k = 0; k < 6 && L.animals.some(c => c.kind === 'cat' && c.vi === i); k++) i = (i + 1) % N.streetCats.length; makeCat(L, x, y, i); } }
  if (dogs < 1 && C.dogs > 1 && r() < 0.02) { const sp = spot(); if (sp) makeDog(L, net.x[sp.node], net.y[sp.node], null); }
  if (L.birds.length < C.birds - 3 && r() < (first ? 1 : 0.2)) { const sp = spot(); if (sp) spawnFlock(L, net.x[sp.node] + r.range(-30, 30), net.y[sp.node] + r.range(-30, 30), r.int(3, 5)); }
  if (L.free && L.night < 0.5 && L.rain < 0.3 && L.flies.length < C.flies && L.flySpots && L.flySpots.length) { const s = r.pick(L.flySpots); if (U.d2(s.x, s.y, a.x, a.y) < 1100 * 1100) L.flies.push({ hx: s.x + r.range(-60, 60), hy: s.y + r.range(-60, 60), x: s.x, y: s.y, z: 1, t: r() * 9, ph: r() * 6, col: r.pick(['#ffd23f', '#ff7ac0', '#8ff3ff', '#ffffff', '#ff8a5c']) }); }
  if (L.vehicles.length < C.vehicles && !L.comu && Life._.spawnVehicle) Life._.spawnVehicle(L, a, yaw);
}
function despawn(L, a) {
  const R = L.N.radius.despawn, on = (x, y) => Game.onScreen(x, y, 80);
  for (const p of L.peds) { if (p.fixed || p.out) continue; const busy = p.st === 'chase' || p.st === 'follow' || p.st === 'pet'; if (LL.shouldDespawn(p.x - a.x, p.y - a.y, R, on(p.x, p.y), busy)) { if (p.bench) p.bench.by = null; p.dead = true; if (p.mate) { p.mate.leader = null; p.mate.mate = null; p.mate.dead = true; } } }
  for (const c of L.animals) { if (c.gang || c.owner || c.fixed) { if (c.owner && c.owner.dead) c.dead = true; continue; } if (LL.shouldDespawn(c.x - a.x, c.y - a.y, R, on(c.x, c.y), c.st === 'follow')) c.dead = true; }
  for (const b of L.birds) if (!b.tag && LL.shouldDespawn(b.x - a.x, b.y - a.y, R, on(b.x, b.y), false)) b.dead = true;
  for (const f of L.flies) if (LL.shouldDespawn(f.x - a.x, f.y - a.y, R, true, false) || L.night > 0.7) f.dead = true;
  for (const v of L.vehicles) if (LL.shouldDespawn(v.x - a.x, v.y - a.y, R * 1.25, on(v.x, v.y), false)) v.dead = true;
  const live = o => !o.dead;
  L.peds = L.peds.filter(live); L.animals = L.animals.filter(live); L.birds = L.birds.filter(live); L.flies = L.flies.filter(live); L.vehicles = L.vehicles.filter(live);
}

// ---------- main update (HOOK: called once per Game.update) ----------
Life.update = function (G, dt) {
  if (!Life.ready || !Life.on || !G || G.over || G.tutorial || G.trial) return;
  const L = G.life || (G.life = init(G));
  const a = lead(G), cat = G.cats[G.active], yaw = VP.R3 && VP.R3.yaw !== undefined ? VP.R3.yaw : -Math.PI / 2;
  L.t += dt;
  // crowd size follows the measured frame rate
  L.fpsT += dt; if (L.fpsT > 2) { L.fpsT = 0; if (VP.R3 && VP.R3.ok && !I.bot) L.capScale = LL.govern(L.capScale, VP.R3.fps, L.N.caps.min); L.caps = LL.caps(L.N.caps, VP.R3 ? VP.R3.quality : 1, !!(VP.R3 && VP.R3.mobile), L.capScale, L.ambient); }
  // spawn: the first frames fill the streets right away, afterwards a few per second
  if (L.first) { for (let i = 0; i < 90; i++) spawnStuff(L, a, yaw); L.first = false; }
  else { L.spawnT -= dt; if (L.spawnT <= 0) { L.spawnT = 0.22; spawnStuff(L, a, yaw); despawn(L, a); } }
  const lod = L.N.radius.lod, lod2 = lod * lod;
  for (const p of L.peds) { const near = U.d2(p.x, p.y, a.x, a.y) < lod2; p.near = near; if (near || p.st !== 'walk' || ((p.id + (L.tick | 0)) & 1)) updPed(L, p, near || p.st !== 'walk' ? dt : dt * 2, cat, near); }
  L.tick = (L.tick | 0) + 1;
  for (const c of L.animals) updAnimal(L, c, dt, cat);
  for (const b of L.birds) updBird(L, b, dt, a);
  for (const f of L.flies) updFly(L, f, dt, cat);
  for (const w of L.windows) { if (w.bub) { w.bub.t -= dt; if (w.bub.t <= 0) w.bub = null; } if (w.hop > 0) w.hop -= dt; }
  if (L.missCd > 0) L.missCd -= dt;
  if (Life._.updTraffic) Life._.updTraffic(L, dt, a);
  carVsPeds(L);
  if (!L.free) return;
  // meow (rising edge of the emote) and Morticia's snack theft
  const miau = !!(cat.emote && cat.emote.k === 'miau');
  if (miau && !L.miau) onMeow(L, cat);
  L.miau = miau;
  if (cat.name === 'morticia' && I.attack && !G.car && !cat.down && (!L.stealCd || L.stealCd < L.t)) { if (trySteal(L, cat)) L.stealCd = L.t + 0.8; }
  if (Life._.updShops) Life._.updShops(L, dt, cat);
  if (Life._.updProps) Life._.updProps(L, dt, cat);
  if (Life._.updWorld) Life._.updWorld(L, dt, cat);
  if (Life._.updFocus) Life._.updFocus(L, dt, cat);
};

// ---------- context action (HOOK: called from updContext before the "enter car" check) ----------
// Returns true when city life owns the action button this frame.
Life.context = function (G, c) {
  const L = G.life; if (!L || !L.free || G.car) return false;
  const f = L.focus; if (!f) return false;
  for (const k of G.cars) if (!k.dead && k.ai !== 'cop' && k.ai !== 'target' && U.d2(k.x, k.y, c.x, c.y) < Math.min(70 * 70, f.d2)) return false; // a car is closer: E enters it
  G.ctx = { k: 'life', icon: f.icon, label: f.label, f };
  if (I.take('ctx')) { sfx('click'); f.act(); }
  return true;
};
Life.near = function (x, y, r) { const L = Game.G && Game.G.life, out = []; if (!L) return out; for (const p of L.peds) if (U.d2(p.x, p.y, x, y) < r * r) out.push(p); return out; };
Life.load();
})();
