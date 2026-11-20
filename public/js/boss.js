'use strict';
// VICE PAWS — reusable boss module. Bosses are data (public/data/enemies.json → "bosses"): hp, phases, a move list per phase.
// The fight only: no story text here (feat/progression owns the story and calls this).
//
//   const boss = VP.Boss.start(G, 'carrocinha', { x, y, lv, arena: {x0, y0, x1, y1}, onPhase(n, boss), onDefeat(boss) });
//   boss.done      -> true once it has been beaten (it drives off; nobody gets hurt)
//   boss.phase     -> 0-based phase index;  VP.Boss.MOVES.myMove = { start(G, b), tick(G, b, c, dt) -> true when finished }
//
// The mission type `foe_boss {boss: id}` (enemies.js) wraps this for missions that are plain data.
(function () {
const VP = window.VP, U = VP.U;
const Boss = VP.Boss = { MOVES: {} };
if (typeof document === 'undefined') return;
const Game = VP.Game, E = VP.Enemies, Ext = VP.Ext, FX = Game.fx, S3 = 1 / 24, tr = (...a) => VP.t(...a), sfx = (n, g) => VP.Audio.sfx(n, g);
const CONF = ['#ff4fb8', '#2de2e6', '#ffd23f', '#7CFF6B', '#ffffff'];
Object.assign(VP.L, {
  boss_carrocinha: ['Dr. Carrocinha', 'Dr. Dogcatcher'], fb_shield: ['ESCUDO!', 'SHIELD!'], fb_shieldTip: ['Espante as bugigangas para baixar o escudo!', 'Chase off the gadgets to drop the shield!'],
  fb_open: ['ESCUDO CAIU! ATAQUEM!', 'SHIELD DOWN! ATTACK!'], fb_grille: ['GRADE QUEBRADA!', 'GRILLE BROKEN!'], fb_out: ['Ele foi embora! Ufa!', 'He drove off! Phew!'],
});

Boss.start = function (G, id, o) {
  o = o || {}; E.state(G);
  const def = E.DATA.bosses[id], lv = o.lv || G.m.lv || 1, hp = Math.round(def.hp * (1 + (def.hpPerLevel || 0.03) * (E.eff(lv) - 1)));
  const b = { kind: 'foe', type: id, isBoss: true, def, d: { behavior: 'boss', defeat: def.defeat || 'flee', weak: {}, params: {}, r: def.r }, x: o.x, y: o.y, r: def.r, hp, max: hp, armor: 0, maxArmor: 0,
    spd: 90, dmg: def.dmg * (1 + 0.02 * (E.eff(lv) - 1)), coins: def.coins, lv, t: 0, st: 0, state: 'act', home: { x: o.x, y: o.y }, z: 0, vz: 0, a: Math.PI / 2, walk: 0, stun: 1.6, flash: 0, squash: 0, kx: 0, ky: 0,
    cd: 1.2, cd2: 0, carry: null, dead: false, gone: false, tag: 'boss', aggro: 5000, fly: false, stuck: 0, wt: 0, dodge: 0,
    phase: -1, move: null, mt: 0, mi: 0, shield: false, exposed: false, done: false, opts: o,
    arena: o.arena || { x0: o.x - 420, y0: o.y - 420, x1: o.x + 420, y1: o.y + 420 } };
  b.guard = guard; b.onDefeat = defeated;
  G.foes.push(b); G.boss = b; G.fboss = b;
  setPhase(G, b, 0, true);
  return b;
};
function setPhase(G, b, n, first) {
  b.phase = n; b.P = b.def.phases[n]; b.move = null; b.mi = 0; b.cd = first ? 1.2 : 2;
  b.armor = b.maxArmor = Math.round((b.P.armor || 0) * (1 + 0.02 * (E.eff(b.lv) - 1)));
  if (!first) { b.stun = 1.4; FX.burst(b.x, b.y - 30, 26, CONF, 260, 'star', 8, 0.9); FX.shake(12); sfx('boss'); for (const s of G.fshots) s.life = 0; }
  FX.say(b.P.label[VP.lang() === 'pt' ? 'pt' : 'en'], '#ffd23f', 2.6);
  if (b.opts.onPhase) b.opts.onPhase(n, b);
}
function guard(G, b, dmg, src) {
  if (b.shield) { if (!b.tipT || b.tipT < G.real) { b.tipT = G.real + 0.5; FX.text(b.x, b.y - 90, '🛡 ' + tr('fb_shield'), '#c0c7d1', 14); sfx('tink', 0.1); } if (!b.tip2 || b.tip2 < G.real) { b.tip2 = G.real + 7; FX.say(tr('fb_shieldTip'), '#ffd23f', 2.4); } return false; }
  void dmg; void src; return true;
}
function defeated(G, b) {
  b.done = true; b.exposed = false; G.bossDead = true;
  for (const e of G.foes) if (e !== b && e.tag === 'bossMinion') E.defeat(G, e, 'boss', true);
  for (const s of G.fshots) s.life = 0; for (const bl of G.bullets) if (bl.from === 'dog') bl.life = 0;
  FX.burst(b.x, b.y - 30, 40, CONF, 300, 'star', 9, 1.2); FX.shake(16); FX.say(tr('fb_out'), '#7CFF6B', 3);
  for (let i = 0; i < 8; i++) Game.addItem(i % 2 ? 'cash' : 'treat', b.x, b.y, true);
  if (b.opts.onDefeat) b.opts.onDefeat(b);
}
const inArena = (b, x, y) => x > b.arena.x0 && x < b.arena.x1 && y > b.arena.y0 && y < b.arena.y1;
function move(G, b, dx, dy) { const nx = b.x + dx, ny = b.y + dy; let hit = false; if (inArena(b, nx, b.y) && !G.W.blocked(nx, b.y, 24, 0)) b.x = nx; else hit = true; if (inArena(b, b.x, ny) && !G.W.blocked(b.x, ny, 24, 0)) b.y = ny; else hit = true; return hit; }
const net = (G, b, an, sp) => G.bullets.push({ k: 'net', x: b.x + Math.cos(an) * 30, y: b.y + Math.sin(an) * 30 - 10, vx: Math.cos(an) * (sp || 300), vy: Math.sin(an) * (sp || 300), life: 1.7, dmg: b.dmg * 0.5, from: 'dog', r: 12, t: 0 });
const tele = (G, o) => { const t = Object.assign({ t: 0, dur: 1 }, o); G.teles.push(t); return t; };

// ---- moves: start(G, b, c) once, tick(G, b, c, dt) every frame until it returns true ----
const MV = Boss.MOVES;
MV.charge = {
  start(G, b, c) { b.ca = c ? Math.atan2(c.y - b.y, c.x - b.x) : b.a; tele(G, { k: 'line', x: b.x, y: b.y, a: b.ca, len: 560, w: 96, dur: 0.9 }); sfx('alarm', 0.3); },
  tick(G, b, c, dt) {
    if (b.mt < 0.9) { b.a = b.ca; return false; }
    const sp = 600 * b.P.speed, hit = move(G, b, Math.cos(b.ca) * sp * dt, Math.sin(b.ca) * sp * dt); b.walk = 1;
    for (const k of G.cats) if (!k.down && U.d2(k.x, k.y, b.x, b.y) < (b.r + k.r + 8) * (b.r + k.r + 8)) Game.hurtCat(k, b.dmg * 1.4, b.x, b.y);
    if (Math.random() < dt * 30) FX.part({ x: b.x - Math.cos(b.ca) * 40, y: b.y - Math.sin(b.ca) * 40, k: 'puff', size: 9, life: 0.4, col: 'rgba(255,255,255,.6)' });
    if (hit) { FX.shake(9); sfx('crash', 0.3); b.stun = 0.9; return true; }
    return b.mt > 0.9 + 560 / sp;
  },
};
MV.nets = {
  start(G, b) { b.shots = 0; },
  tick(G, b, c, dt) { if (c) b.a += U.angDiff(b.a, Math.atan2(c.y - b.y, c.x - b.x)) * Math.min(1, dt * 6); if (b.shots < 3 && b.mt > 0.35 + b.shots * 0.5) { b.shots++; const live = G.cats.filter(k => !k.down), t = live[(b.shots + G.active) % (live.length || 1)] || c; if (t) { net(G, b, Math.atan2(t.y - b.y, t.x - b.x)); sfx('net'); } } return b.mt > 1.9; },
};
MV.netRing = {
  start(G, b) { b.shots = 0; tele(G, { k: 'circle', x: b.x, y: b.y, r: 90, dur: 0.6 }); },
  tick(G, b, c, dt) { b.a += dt * 5; if (!b.shots && b.mt > 0.6) { b.shots = 1; for (let i = 0; i < 10; i++) net(G, b, i / 10 * 6.283 + b.t, 240); sfx('net'); FX.shake(5); } return b.mt > 1.5; },
};
MV.netRain = {
  start(G, b) { b.rain = []; const pts = G.cats.filter(k => !k.down).map(k => ({ x: k.x, y: k.y })); for (let i = 0; i < 4; i++) pts.push({ x: U.rand(b.arena.x0 + 80, b.arena.x1 - 80), y: U.rand(b.arena.y0 + 80, b.arena.y1 - 80) }); pts.forEach((p, i) => b.rain.push({ x: p.x, y: p.y, at: 0.5 + i * 0.22, tl: null, hit: false })); },
  tick(G, b, c, dt) {
    for (const r of b.rain) {
      if (!r.tl && b.mt >= r.at) r.tl = tele(G, { k: 'circle', x: r.x, y: r.y, r: 72, dur: 1.0 });
      if (r.tl && !r.hit && b.mt >= r.at + 1.0) { r.hit = true; FX.burst(r.x, r.y - 10, 10, '#ffffff', 170, 'dot', 5, 0.4); sfx('net', 0.1); for (const k of G.cats) if (!k.down && k.inv <= 0 && !G.car && U.d2(k.x, k.y, r.x, r.y) < 76 * 76) { k.root = k.name === 'mimosa' ? 0.6 : 1.8; Game.hurtCat(k, b.dmg * 0.5, r.x, r.y); k.kx = k.ky = 0; } }
    }
    void dt; return b.mt > 0.5 + b.rain.length * 0.22 + 1.2;
  },
};
MV.summon = {
  start(G, b) { if (E.alive(G, 'bossMinion') >= 3) return; sfx('alarm'); for (const [type, n] of b.P.minions || []) for (const e of E.group(G, type, { x: b.x, y: b.y + 70 }, { n, lv: Math.max(1, b.lv - 6), tag: 'bossMinion', state: 'act', force: true, spread: 130 })) e.aggro = 3000; FX.poof(b.x, b.y, 14, '#b967ff'); },
  tick(G, b) { return b.mt > 1.2; },
};
MV.spray = {
  start(G, b, c) { b.sa = c ? Math.atan2(c.y - b.y, c.x - b.x) : b.a; b.dropT = 0; b.sdir = Math.random() < 0.5 ? 1 : -1; tele(G, { k: 'line', x: b.x, y: b.y, a: b.sa, len: 330, w: 90, dur: 0.8 }); },
  tick(G, b, c, dt) {
    b.a = b.sa; if (b.mt < 0.8) return false;
    b.sa += b.sdir * dt * 0.7; b.dropT -= dt;
    while (b.dropT <= 0) { b.dropT += 0.06; const an = b.sa + U.rand(-0.16, 0.16), sp = 340 * U.rand(0.85, 1.1); if (G.fshots.length < E.DATA.cap.shots) G.fshots.push({ k: 'water', t: 0, life: 0.95, r: 7, x: b.x + Math.cos(b.sa) * 36, y: b.y + Math.sin(b.sa) * 36 - 8, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, dmg: 3 }); }
    return b.mt > 2.2;
  },
};
Boss.tick = function (G, St, b, c, d, dt) {
  // phases
  const frac = b.hp / b.max, P = b.P;
  if (b.phase < b.def.phases.length - 1 && frac <= P.until) { setPhase(G, b, b.phase + 1); return; }
  const minions = E.alive(G, 'bossMinion'), was = b.shield;
  b.shield = !!P.shieldWhileMinions && minions > 0;
  if (was && !b.shield) { FX.say(tr('fb_open'), '#ffd23f', 2.2); b.stun = Math.max(b.stun, b.def.exposeSeconds || 5); b.cd = 0.4; sfx('break'); return; }
  if (b.maxArmor && b.armor <= 0 && !b.broke) { b.broke = b.phase + 1; FX.say(tr('fb_grille'), '#ffd23f', 2); b.stun = Math.max(b.stun, 2.5); }
  if (b.broke && b.broke !== b.phase + 1) b.broke = 0;
  b.exposed = !b.shield && b.armor <= 0;
  if (b.move) { b.mt += dt; if (MV[b.move].tick(G, b, c, dt)) { b.move = null; b.cd = (b.shield ? 2.6 : 1.5) / Math.max(0.8, P.speed); } return; }
  b.cd -= dt;
  // between moves: roll around the arena, facing the cats
  if (c) { const an = Math.atan2(c.y - b.y, c.x - b.x); b.a += U.angDiff(b.a, an) * Math.min(1, dt * 3); if (d > 230) { move(G, b, Math.cos(an) * b.spd * P.speed * dt, Math.sin(an) * b.spd * P.speed * dt); b.walk = 1; } }
  if (b.cd <= 0) { let name = P.moves[b.mi++ % P.moves.length]; if (name === 'summon' && minions >= 3) name = 'netRing'; b.move = name; b.mt = 0; MV[name].start(G, b, c); }
};
// enemies.js runs it through AI.boss like any other enemy

// ---------- 3D: the net truck ----------
let gx = null;
function build(gfx) {
  const TH = gfx.THREE, g = new TH.Group(), b = new gfx.GB(), n = new gfx.GB(), INK = '#1a0d24';
  b.box('#3a3f55', 0, 0.55, 0, 2.2, 0.4, 4.6); b.box('#eef0f5', 0, 1.45, 1.35, 2.15, 1.4, 1.7); b.box('#e01e37', 0, 0.95, 1.36, 2.18, 0.18, 1.72); b.box('#2a2f45', 0, 0.5, 2.36, 2.3, 0.3, 0.2);
  b.box('#7fd6e8', 0, 1.7, 2.21, 1.75, 0.6, 0.04); for (const s of [-1, 1]) { b.box('#7fd6e8', s * 1.08, 1.7, 1.45, 0.04, 0.55, 0.9); for (const z of [1.5, -1.35]) b.cyl('#17101c', s * 1.1, 0.42, z, 0.42, 0.3, 0.42, 0, 0, Math.PI / 2); for (const z of [1.5, -1.35]) b.cyl('#c0c7d1', s * 1.27, 0.42, z, 0.18, 0.02, 0.18, 0, 0, Math.PI / 2); }
  // the cage on the back: posts, top and a white net
  b.box('#596080', 0, 0.82, -0.9, 2.2, 0.12, 2.6); b.box('#596080', 0, 2.3, -0.9, 2.2, 0.1, 2.6);
  for (const s of [-1, 1]) for (const z of [0.35, -0.9, -2.15]) b.cyl('#8a90ad', s * 1.05, 1.56, z, 0.06, 1.4, 0.06);
  for (let i = 0; i < 6; i++) { b.box('#ffffff', -1.06, 1.56, 0.2 - i * 0.44, 0.03, 1.4, 0.04); b.box('#ffffff', 1.06, 1.56, 0.2 - i * 0.44, 0.03, 1.4, 0.04); }
  for (let i = 0; i < 4; i++) { b.box('#ffffff', -1.06, 1.05 + i * 0.34, -0.9, 0.03, 0.04, 2.5); b.box('#ffffff', 1.06, 1.05 + i * 0.34, -0.9, 0.03, 0.04, 2.5); }
  // net cannon on the roof
  b.cyl('#596080', 0, 2.3, 1.3, 0.3, 0.3, 0.3); b.cyl('#8a90ad', 0, 2.55, 1.75, 0.2, 0.9, 0.2, Math.PI / 2 - 0.25); b.tor('#ffffff', 0, 2.68, 2.2, 0.3, 0.3, 0.3, -0.25);
  // Dr. Carrocinha at the hatch: lab coat, green goggles, a big moustache, a cap
  b.sph('#ffffff', 0, 2.72, 0.75, 0.34, 0.4, 0.3); b.sph('#d9c3a5', 0, 3.2, 0.78, 0.3, 0.29, 0.29); b.cyl('#3a3f55', 0, 3.44, 0.78, 0.31, 0.14, 0.31); b.box('#3a3f55', 0, 3.4, 1.06, 0.5, 0.05, 0.26);
  for (const s of [-1, 1]) { b.sph('#e9e9ee', s * 0.13, 3.08, 1.05, 0.15, 0.06, 0.06, 0, 0, s * 0.35); b.box('#ffffff', s * 0.38, 2.76, 0.86, 0.14, 0.4, 0.14, 0.5); }
  b.box(INK, 0, 3.24, 1.02, 0.5, 0.14, 0.08);
  for (const s of [-1, 1]) { n.lo('#7CFF6B', s * 0.12, 3.24, 1.07, 0.08, 0.08, 0.03); n.lo('#fff6b0', s * 0.75, 0.75, 2.32, 0.16, 0.16, 0.06); }
  n.box('#ff3355', 0, 2.9, 1.9, 0.5, 0.14, 0.14); n.box('#2de2e6', 0, 1.02, 2.23, 1.2, 0.08, 0.02);
  const inner = new TH.Group(); inner.add(b.mesh(gfx.MAT.lit), n.mesh(gfx.MAT.glow)); g.add(inner); g.userData.inner = inner; g.visible = false;
  VP.R3.three.scene.add(g); return g;
}
Ext.render.push((G, dt, gfx) => {
  const b = G.fboss; if (!b || b.dead) { if (gx) gx.visible = false; return; }
  if (!gx) gx = build(gfx);
  const gy = gfx.hAt(b.x, b.y), x = b.x * S3, z = b.y * S3, inner = gx.userData.inner;
  gx.visible = true; gx.position.set(x, gy, z); gx.rotation.y = Math.PI / 2 - b.a;
  const wind = b.move === 'charge' && b.mt < 0.9;
  inner.position.set(wind ? Math.sin(b.t * 60) * 0.05 : 0, b.walk ? Math.abs(Math.sin(b.t * 14)) * 0.05 : 0, 0);
  inner.rotation.z = b.stun > 0 ? Math.sin(b.t * 10) * 0.07 : 0; inner.rotation.x = wind ? -0.06 : 0;
  const k = 1 + b.squash * 0.06; gx.scale.set(k, 2 - k, k);
  gfx.shadow(x, z, gy, 1.5, 2.6, gx.rotation.y);
  if (b.flash > 0) gfx.glow(x, gy + 1.6, z, '#ffffff', 9);
  if (b.shield) { gfx.glow(x, gy + 1.6, z, '#2de2e6', 13 + Math.sin(b.t * 6)); } else if (b.exposed) gfx.glow(x, gy + 3.4, z, '#ffd23f', 7);
});
})();
