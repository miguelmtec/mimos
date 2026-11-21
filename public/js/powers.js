'use strict';
// VICE PAWS — powers: the main attack (Space) and the four special powers (Z X C V) of each cat.
// Data-driven (public/data/powers.json). Official cats get their own set; a custom cat (VP.S.avatar) brings the attack and
// the 4 powers picked in the cat creator. The simulation (game.js) calls assign / cast / catTick / land / reflect.
// Cartoon and kid-friendly: nobody dies, everything is confetti, stars, hearts and silly noises.
(function () {
const VP = window.VP, U = VP.U, I = VP.I;
const P = VP.Powers = { D: null, ready: false };
Object.assign(VP.L, {
  pw_blocked: ['BLOQUEOU!', 'BLOCKED!'], pw_tired: ['Sem fôlego!', 'Out of breath!'], pw_none: ['Ninguém por perto', 'Nobody near'], pw_yawn: ['AAAAH-HUM…', 'YAAAWN…'],
  pw_pillow: ['Travesseiro!', 'Pillow!'], pw_spiky: ['Arrepiado!', 'Spiky!'], pw_frozen: ['CONGELOU!', 'FROZEN!'], pw_magnet: ['Ímã!', 'Magnet!'], pw_nothing: ['Sem lanche!', 'No snack!'],
  pw_burp: ['BURRRP!', 'BURRRP!'], pw_charm: ['Miaaau fofo~', 'Cute meeeow~'], pw_reflect: ['DEVOLVEU!', 'REFLECTED!'], pw_noEnergy: ['Sem energia!', 'No energy!'],
  k_atk: ['ATACAR', 'ATTACK'], k_space: ['Espaço', 'Space'], k_jump: ['PULAR', 'JUMP'], k_run: ['CORRER', 'RUN'], k_lock: ['Tab: travar alvo', 'Tab: lock target'], k_stam: ['Fôlego', 'Stamina'], k_aim: ['Mira', 'Aim'],
});
const lang = () => (VP.lang && VP.lang() === 'pt' ? 'pt' : 'en');
P.load = function (d) { P.D = d; P.ready = true; };
P.attacks = () => (P.D ? P.D.attacks : {});
P.defs = () => (P.D ? P.D.powers : {});
P.nameOf = id => { const d = P.defs()[id]; return d ? d.name[lang()] : id; };
P.attackName = id => { const d = P.attacks()[id]; return d ? d.name[lang()] : id; };
P.emoji = id => { const d = P.defs()[id]; return d ? d.emoji : '?'; };
P.cdMax = id => { const d = P.defs()[id]; if (!d) return 1; const pv = (k, x) => (VP.Prog ? VP.Prog.v(k) : x); return d.cd * (id === 'lightning' ? pv('dashCd', 1) : id === 'furball' ? pv('hairCd', 1) : 1); };
P.cost = id => { const d = P.defs()[id]; return d ? d.cost : 0; };
const valid = L => !!(L && P.attacks()[L.attack] && Array.isArray(L.powers) && L.powers.length === 4 && L.powers.every(p => P.defs()[p]) && new Set(L.powers).size === 4);
// the loadout of a slot (mimo / mimosa / morticia): the player's own cat brings its picks, everybody else uses the official set
P.loadout = function (name) {
  const D = P.D, Pa = VP.Party;
  if (Pa && Pa.active && Pa.active() && Pa.slotOf() === name && VP.S.avatar) {
    const a = VP.S.avatar;
    if (valid(a)) return { attack: a.attack, powers: a.powers.slice() };
    if (a.personality && D.personalities[a.personality]) { const q = D.personalities[a.personality]; return { attack: q.attack, powers: q.powers.slice() }; }
  }
  return { attack: D.official[name].attack, powers: D.official[name].powers.slice() };
};
P.assign = function (G) { for (const c of G.cats) { const L = P.loadout(c.name); c.atkId = L.attack; c.pw = L.powers; } };
// which power sits in slot i right now (in the stealth mission the 4th slot becomes "Esconde-Esconde" so everybody can vanish)
P.slot = function (c, i) { const G = VP.Game.G; if (G && G.solo !== null && c.idx === G.solo && i === 3 && !c.pw.includes('hide')) return 'hide'; return c.pw[i]; };
P.cdOf = (c, i) => (i === 0 ? c.cdS : c.pcd[i]) || 0;
const setCd = (c, i, v) => { if (i === 0) c.cdS = v; else c.pcd[i] = v; };
P.ready1 = (c, i) => { const id = P.slot(c, i); return !!id && P.cdOf(c, i) <= 0 && c.pe >= P.cost(id); };

// ---------- helpers on the simulation ----------
const X = () => VP.Game.X;
const foes = G => { const out = []; for (const e of G.dogs) if (!e.dead) out.push(e); if (G.foes) for (const e of G.foes) if (!e.dead && !e.gone) out.push(e); return out; };
const hit = (G, e, dmg, src, x, y, kb) => { if (e.kind === 'foe') { if (VP.Enemies && VP.Enemies.hit) VP.Enemies.hit(G, e, dmg, src, x, y, kb); } else X().hurtDog(e, dmg, src, x, y, kb); };
const stun = (e, t) => { e.stun = Math.max(e.stun || 0, e.isBoss ? Math.min(t, 1.2) : t); };
const near = (G, c, R) => foes(G).filter(e => U.d2(e.x, e.y, c.x, c.y) < (R + (e.r || 12)) * (R + (e.r || 12)));
const rings = (c, col, n, size, grow) => { for (let i = 0; i < n; i++) X().part({ x: c.x, y: c.y - 14, k: 'ring', col, size: size || 20, life: 0.5 + i * 0.12, grow: grow || 420 }); };
const say = (G, c, txt, col) => X().text(c.x, c.y - 56, txt, col || '#fff', 16);
const tr = (...a) => VP.t(...a);
const sfx = (n, g) => VP.Audio.sfx(n, g);
const aimDir = (G, c) => { let ang = c.aim || 0; if (c.idx === G.active && Math.hypot(I.mx, I.my) > 0.3) ang = Math.atan2(I.my, I.mx); return ang; };
const best = (G, c, R) => { // the enemy to look at: the locked one, else the nearest in sight
  if (G.lock && !G.lock.dead && !G.lock.gone && U.d2(G.lock.x, G.lock.y, c.x, c.y) < R * R) return G.lock;
  let b = null, bd = R * R; for (const e of foes(G)) { const d = U.d2(e.x, e.y, c.x, c.y); if (d < bd && G.W.los(c.x, c.y - 4, e.x, e.y - 4, 2)) { bd = d; b = e; } } return b;
};

// ---------- the powers ----------
const IMPL = {
  nap(G, c) {
    const T = X().pv('napT', 0); G.nap = 4.5 + T; c.energy = Math.min(100, c.energy + 50 + T * 16); c.exhausted = false; sfx('nap'); X().say(tr('nap') + '!', '#bfe9ff', 1.6);
    X().part({ x: c.x, y: c.y - 16, k: 'ring', col: '#bfe9ff', size: 30, life: 0.7, grow: 500 });
  },
  yawn(G, c) {
    const list = near(G, c, 240); if (!list.length) { say(G, c, tr('pw_none'), '#bfe9ff'); return false; }
    c.mouth = 1; sfx('nap', 0.4); rings(c, '#bfe9ff', 2, 20, 360); say(G, c, tr('pw_yawn'), '#bfe9ff');
    for (const e of list) { stun(e, 3); e.zz = e.isBoss ? 1.2 : 3; if (e.state === 'wind') e.state = 'chase'; e.wind = 0; X().part({ x: e.x + 8, y: e.y - 44, k: 'icon', icon: 'zzz', vy: -26, vx: 10, size: 10, life: 1.1 }); }
  },
  pillow(G, c) { c.shieldT = 3; sfx('nap', 0.3); say(G, c, '🛏️ ' + tr('pw_pillow'), '#bfe9ff'); rings(c, '#e8f4ff', 2, 16, 200); },
  snore(G, c) {
    const a = aimDir(G, c); c.aim = a; c.mouth = 1; c.atk = 1; sfx('hairball', 0.3); X().shake(5); say(G, c, 'ZZZZ…', '#bfe9ff');
    for (let i = 0; i < 6; i++) X().part({ x: c.x + Math.cos(a) * (20 + i * 22), y: c.y - 16 + Math.sin(a) * (20 + i * 22), k: 'icon', icon: 'zzz', vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 10, size: 9 + i, life: 0.7 });
    X().part({ x: c.x + Math.cos(a) * 60, y: c.y - 14 + Math.sin(a) * 60, k: 'ring', col: '#bfe9ff', size: 18, life: 0.4, grow: 260 });
    for (const e of foes(G)) { const d = Math.hypot(e.x - c.x, e.y - c.y); if (d > 210 || (d > 50 && Math.abs(U.angDiff(a, Math.atan2(e.y - c.y, e.x - c.x))) > 0.75)) continue; hit(G, e, 8, 'roar', c.x, c.y, 430); if (!e.dead) stun(e, 0.7); }
    for (const b of G.bullets) if (b.from === 'dog' && Math.hypot(b.x - c.x, b.y - c.y) < 200 && Math.abs(U.angDiff(a, Math.atan2(b.y - c.y, b.x - c.x))) < 0.75) b.life = 0;
  },
  tantrum(G, c) {
    X().shake(14); X().hitstop(0.08); sfx('roar'); X().say(tr('roar') + '!', '#ff7ac0', 1.4); c.mouth = 1; c.atk = 1; c.roarEv = true;
    for (let i = 0; i < 3; i++) X().part({ x: c.x, y: c.y - 14, k: 'ring', col: '#ff4fb8', size: 20, life: 0.5 + i * 0.12, grow: 420 });
    const RR = 210 * X().pv('roarR', 1);
    for (const e of G.dogs) if (!e.dead && U.d2(e.x, e.y, c.x, c.y) < RR * RR) { X().hurtDog(e, 16, 'roar', c.x, c.y, 260); if (!e.dead) { if (e.armor > 0) e.armor = Math.max(0, e.armor - 55); e.stun = Math.max(e.stun, e.isBoss ? 1.2 : 3 + X().pv('roarStun', 0)); e.wind = 0; if (e.state === 'wind') e.state = 'chase'; } }
    for (const b of G.bullets) if (b.from === 'dog' && U.d2(b.x, b.y, c.x, c.y) < 210 * 210) b.life = 0;
    for (const k of G.cats) k.root = 0;
  },
  lightning(G, c) {
    const ang = aimDir(G, c);
    c.dashT = 0.2; c.dashK = 'swipe'; c.dx = Math.cos(ang); c.dy = Math.sin(ang); c.aim = ang; c.inv = Math.max(c.inv, 0.3); c.hitSet = new Set(); c.face = c.dx >= 0 ? 1 : -1; sfx('dash');
  },
  spiky(G, c) { c.spikeT = 8; sfx('hairball', 0.2); say(G, c, '🦔 ' + tr('pw_spiky'), '#ff7ac0'); X().burst(c.x, c.y - 18, 14, ['#ff7ac0', '#fff'], 150, 'star', 6, 0.5); rings(c, '#ff7ac0', 1, 14, 220); },
  glare(G, c) {
    const e = best(G, c, 400); if (!e) { say(G, c, tr('pw_none'), '#8ff3ff'); return false; }
    c.face = e.x > c.x ? 1 : -1; c.aim = Math.atan2(e.y - c.y, e.x - c.x); stun(e, 3.5); e.wind = 0; if (e.state === 'wind') e.state = 'chase'; e.zz = 0;
    sfx('tink', 0.3); X().burst(e.x, e.y - 20, 14, ['#bff4ff', '#fff'], 170, 'star', 6, 0.6); X().part({ x: e.x, y: e.y - 18, k: 'ring', col: '#8ff3ff', size: 14, life: 0.4, grow: 200 });
    X().text(e.x, e.y - 60, tr('pw_frozen'), '#8ff3ff', 16); say(G, c, '👁️', '#ff7ac0');
  },
  feast(G, c) {
    const full = c.belly >= 99.5 || c.feastReady;
    c.bigT = 8 + X().pv('feastT', 0) + (full ? 2 : 0); G.feast = c.bigT; c.feastReady = false; c.belly = Math.max(c.belly, 80); c.kx = c.ky = 0;
    sfx('feast'); X().shake(8); X().say(tr('feast') + '!', '#ffb347', 1.8); X().burst(c.x, c.y - 20, 18, ['#ffb347', '#fff3a8', '#ff7ac0'], 200, 'star', 7, 0.8); rings(c, '#ffb347', 2, 20, 380);
    return full ? 'free' : true;
  },
  magnet(G, c) { c.magT = 6; sfx('paw', 0.4); say(G, c, '🧲 ' + tr('pw_magnet'), '#ffb347'); rings(c, '#ffb347', 2, 30, 520); },
  pilfer(G, c) {
    let tg = null, bd = 300 * 300;
    for (const e of G.dogs) { if (e.dead || !e.carry || (e.isBoss && e.boss.phase !== 'exposed' && e.stun <= 0)) continue; const d = U.d2(e.x, e.y, c.x, c.y); if (d < bd && G.W.los(c.x, c.y - 4, e.x, e.y - 4, 2)) { bd = d; tg = e; } }
    if (tg) { c.face = tg.x > c.x ? 1 : -1; c.aim = Math.atan2(tg.y - c.y, tg.x - c.x); c.atk = 1; c.mouth = 1; if (X().stealFrom(c, tg)) { X().part({ x: c.x, y: c.y - 20, k: 'ring', col: '#ffd23f', size: 12, life: 0.3, grow: 200 }); return true; } }
    const e = best(G, c, 260); if (!e) { say(G, c, tr('pw_none'), '#ffb347'); return false; }
    c.atk = 1; hit(G, e, 8, 'snatch', c.x, c.y, 90); stun(e, 0.8); X().text(e.x, e.y - 54, tr('pw_nothing'), '#c0c7d1', 13);
  },
  burp(G, c) {
    c.mouth = 1; sfx('hairball', 0.5); sfx('dash', 0.3); X().shake(9); X().hitstop(0.05); X().text(c.x, c.y - 60, tr('pw_burp'), '#b6ff7a', 20);
    for (let i = 0; i < 2; i++) X().part({ x: c.x, y: c.y - 14, k: 'ring', col: '#b6ff7a', size: 20, life: 0.45 + i * 0.12, grow: 400 });
    X().burst(c.x, c.y - 16, 12, ['#b6ff7a', '#fff'], 200, 'puff', 12, 0.6);
    for (const e of near(G, c, 180)) { hit(G, e, 14 * X().dm(c), 'roar', c.x, c.y, 360); if (!e.dead) stun(e, 1); }
    for (const b of G.bullets) if (b.from === 'dog' && U.d2(b.x, b.y, c.x, c.y) < 180 * 180) b.life = 0;
  },
  charm(G, c) {
    const list = near(G, c, 220); c.mouth = 1; sfx('paw', 0.5); say(G, c, tr('pw_charm'), '#ff7ac0'); rings(c, '#ff7ac0', 2, 20, 380);
    for (const e of list) { stun(e, 2.5); e.wind = 0; if (e.state === 'wind') e.state = 'chase'; if (e.target) e.target = null; X().burst(e.x, e.y - 30, 5, ['#ff7ac0', '#fff'], 90, 'heart', 7, 0.9); }
  },
  furball(G, c) {
    const ap = c.idx === G.active && G.ret ? Math.atan2(G.ret.y - c.y, G.ret.x - c.x) : null;
    const tgt = X().autoAim(c, 300, 'bolt'); const a = I.aim !== null && c.idx === G.active ? I.aim : (ap !== null ? ap : (tgt === null ? aimDir(G, c) : tgt));
    let dist = 190; for (const e of foes(G)) { const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < 320 && Math.abs(U.angDiff(a, Math.atan2(e.y - c.y, e.x - c.x))) < 0.3) { dist = d; break; } }
    G.bullets.push({ k: 'hair', x: c.x, y: c.y, sx: c.x, sy: c.y, tx: c.x + Math.cos(a) * dist, ty: c.y + Math.sin(a) * dist, t: 0, dur: 0.5, from: 'cat', life: 1, r: 8 }); c.aim = a; sfx('hairball');
  },
  doublejump(G, c) { return X().jumpCat(c, 10.5); },
  spin(G, c) {
    c.hitSet = new Set(); const a0 = c.aim || 0; let n = 0;
    for (let k = 0; k < 6; k++) n += X().biteHit(c, a0 + k * 1.047, 24 * X().dm(c), 34, 32, 280, 'bite');
    c.hitSet = null; c.atk = 1; c.spinT = 0.45; sfx('bite3'); X().shake(4); rings(c, '#ff9fd6', 1, 16, 300);
    if (n) X().hitstop(0.05);
  },
  catnap(G, c) {
    c.hp = Math.min(c.max, c.hp + c.max * 0.3); c.inv = Math.max(c.inv, 0.8); X().text(c.x, c.y - 46, '+' + Math.round(c.max * 0.3), '#7CFF6B', 15);
    X().healTeam(12); sfx('nap', 0.4); say(G, c, '😸 zzz', '#7CFF6B');
    for (let i = 0; i < 3; i++) X().part({ x: c.x + 8, y: c.y - 40, k: 'icon', icon: 'zzz', vy: -30 - i * 8, vx: 10 + i * 6, size: 10, life: 1 + i * 0.2 });
    rings(c, '#7CFF6B', 1, 14, 220);
  },
  catleap(G, c) {
    const ang = aimDir(G, c); c.dashT = 0.22; c.dashK = 'leap'; c.dx = Math.cos(ang); c.dy = Math.sin(ang); c.aim = ang; c.inv = Math.max(c.inv, 0.3); c.face = c.dx >= 0 ? 1 : -1; c.vz = 7.6; if (c.z <= 0) c.z = 0.001; sfx('dash');
  },
  hide(G, c) {
    const ang = aimDir(G, c);
    c.dashT = 0.16; c.dashK = 'smoke'; c.dx = Math.cos(ang); c.dy = Math.sin(ang); c.invis = 2.2 + X().pv('invisT', 0); c.inv = Math.max(c.inv, 0.4); sfx('dash'); X().poof(c.x, c.y - 12, 6, '#b9a6d9');
    for (const e of G.dogs) if (e.target === c) e.target = null;
  },
  zoomies(G, c) { c.zoomT = 4; sfx('dash', 0.2); say(G, c, '💨', '#8ff3ff'); X().burst(c.x, c.y - 4, 10, '#fff', 120, 'puff', 10, 0.5); },
};
P.cast = function (G, c, i) {
  if (!P.ready || !c || c.down || G.over) return false;
  const id = P.slot(c, i), d = P.defs()[id]; if (!d || !IMPL[id]) return false;
  if (P.cdOf(c, i) > 0) return false;
  if (c.root > 0 && (id === 'lightning' || id === 'catleap' || id === 'hide')) return false; // netted cats cannot dash
  const cost = d.cost;
  if (c.pe < cost) { if (c.idx === G.active && (!c.noEnT || c.noEnT < G.real)) { c.noEnT = G.real + 1; X().text(c.x, c.y - 50, tr('pw_noEnergy'), '#bfe9ff', 13); } return false; }
  const r = IMPL[id](G, c, d); if (r === false) return false;
  c.pe -= r === 'free' ? 0 : cost; setCd(c, i, P.cdMax(id));
  G.stat.powers = (G.stat.powers || 0) + 1; c.lastPower = id;
  return true;
};
// per-frame upkeep of long-lived effects
P.catTick = function (c, dt) {
  const G = VP.Game.G, x = X();
  if (c.spinT > 0) c.spinT -= dt;
  if (c.magT > 0) for (const it of G.items) { if (!(x.FOODS.includes(it.k) || it.k === 'cash' || it.k === 'gcoin')) continue; const d = U.d2(it.x, it.y, c.x, c.y); if (d < 430 * 430 && d > 9) { const l = Math.sqrt(d); it.x += (c.x - it.x) / l * 520 * dt; it.y += (c.y - it.y) / l * 520 * dt; } }
  c.fxT = (c.fxT || 0) - dt;
  if (c.fxT <= 0) {
    c.fxT = 0.3;
    if (c.shieldT > 0) x.part({ x: c.x, y: c.y - 14, k: 'ring', col: '#bfe9ff', size: 18, life: 0.3, grow: 60 });
    if (c.spikeT > 0) x.burst(c.x, c.y - 20, 2, '#ff7ac0', 90, 'star', 5, 0.4);
    if (c.bigT > 0 && c.walk) { x.poof(c.x, c.y - 2, 3, '#e9c9a0'); if (c.idx === G.active) x.shake(1.2); }
    if (c.zoomT > 0) x.burst(c.x, c.y - 6, 2, '#fff', 60, 'puff', 8, 0.4);
  }
};
// Cat Leap landing
P.land = function (c) {
  const G = VP.Game.G, x = X(); c.dashK = null;
  x.shake(7); sfx('slam', 0.15); x.part({ x: c.x, y: c.y, k: 'ring', col: '#fff', size: 14, life: 0.3, grow: 300 }); x.poof(c.x, c.y - 4, 6, '#fff');
  for (const e of near(G, c, 60)) { hit(G, e, 22 * x.dm(c), 'bite', c.x, c.y, 300); if (!e.dead) stun(e, 0.8); }
};
// Spiky Fur: the next hit bounces back at whoever sent it
P.reflect = function (c, dmg, fx, fy) {
  const G = VP.Game.G, x = X(); let b = null, bd = 140 * 140;
  for (const e of foes(G)) { const d = U.d2(e.x, e.y, fx, fy); if (d < bd) { bd = d; b = e; } }
  x.text(c.x, c.y - 52, tr('pw_reflect'), '#ff7ac0', 16); x.burst(c.x, c.y - 18, 16, ['#ff7ac0', '#fff'], 200, 'star', 7, 0.6); sfx('tink', 0.2); x.shake(5);
  if (b) { hit(G, b, Math.max(24, dmg * 2.2), 'roar', c.x, c.y, 320); if (!b.dead) stun(b, 1); }
};
})();
