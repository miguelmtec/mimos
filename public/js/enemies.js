'use strict';
// VICE PAWS — "Bicharada": the new enemy roster (fleas, monster vacuum, thief pigeon, ninja rats, bath robot, scary cucumber).
// Cartoon and kid-friendly: nobody dies, a beaten enemy turns into confetti or runs away.
// Everything is data-driven (public/data/enemies.json). This file also owns VP.Ext, a tiny extension bus that lets new
// modules (enemies, boss, clinic, season; other branches are welcome to use it) plug into the game through a handful of
// one-line hooks in the existing files instead of editing them. See DESIGN.md §10.
(function () {
const VP = window.VP, U = VP.U, I = VP.I || {};
const HAS_DOM = typeof document !== 'undefined';

// ---------- VP.Ext: extension bus ----------
const Ext = VP.Ext = VP.Ext || {};
for (const k of ['init', 'update', 'render', 'hud', 'aim', 'foe', 'clinic']) Ext[k] = Ext[k] || [];
Ext.slots = Ext.slots || {}; Ext._q = Ext._q || []; Ext.ready = !!Ext.ready;
// game.js: once per frame of the simulation (dt = real, sdt = slowed by Mimo's nap). `init` runs once for every new game.
Ext.tick = function (G, dt, sdt) { if (!G._ext) { G._ext = 1; for (const f of Ext.init) f(G); } for (const f of Ext.update) f(G, dt, sdt); };
Ext.draw = function (G, dt, gfx) { for (const f of Ext.render) f(G, dt, gfx); };   // render.js: once per rendered frame
Ext.paint = function (G, api) { for (const f of Ext.hud) f(G, api); };            // hud.js: world labels pass
Ext.aimAt = function (G, consider, kind, c) { for (const f of Ext.aim) f(G, consider, kind, c); }; // game.js autoAim
Ext.addSlot = (name, f) => { (Ext.slots[name] = Ext.slots[name] || []).push(f); };
Ext.slot = name => (Ext.slots[name] || []).map(f => { try { return f() || ''; } catch (e) { return ''; } }).join(''); // ui.js: extra HTML
Ext.json = url => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
Ext.whenData = cb => { if (Ext.ready) cb(); else Ext._q.push(cb); };              // after missions.json & co. are loaded
if (HAS_DOM && !Ext._poll) { Ext._poll = 1; (function wait() { if (VP.Missions && VP.Missions.list.length && VP.UI && VP.UI.ready) { Ext.ready = true; for (const f of Ext._q.splice(0)) { try { f(); } catch (e) { console.error('ext', e); } } } else setTimeout(wait, 25); })(); }
// append districts + missions that follow the missions.json schema (district ids are given here: they are list indexes)
Ext.addMissions = function (data) {
  const M = VP.Missions, TY = M._.TYPES, added = [];
  for (const d of data.districts || []) { if (M.DIST.some(x => x.key === d.key)) continue; const D = Object.assign({}, d, { id: M.DIST.length }); M.DIST.push(D); VP.L['d' + D.id] = [d.name.pt, d.name.en]; }
  for (const r of data.missions || []) {
    if (M.get(r.n)) { console.warn('[ext] mission id already in use:', r.n); continue; }
    const D = M.DIST.find(x => r.n >= x.from && r.n <= x.to); if (!D || !TY[r.type]) { console.warn('[ext] mission skipped:', r.n, r.type); continue; }
    const m = { n: r.n, geo: r.geo === undefined ? D.geo : r.geo, d: D.id, type: r.type, name: [r.name.pt, r.name.en], p: r.params || {}, lv: r.lv || 1, par: r.par, hunger: (r.params && r.params.hunger) || 1, boss: r.boss || null, bonus: true, arc: !!D.arc, talk: r.talk || null, ext: D.key };
    M.list.push(m); added.push(m);
  }
  return added;
};

// ---------- strings (pt-BR first, en second) ----------
Object.assign(VP.L || (VP.L = {}), {
  f_itch: ['Coça-coça!', 'Itchy!'], f_wet: ['MOLHADO!', 'SOAKED!'], f_scare: ['AAH! PEPINO!', 'AAH! CUCUMBER!'], f_safe: ['Protegido!', 'Protected!'],
  f_stole: ['LEVOU ${0}!', 'TOOK ${0}!'], f_stoleSnack: ['Levou o lanche!', 'Took the snack!'], f_back: ['RECUPERADO!', 'GOT IT BACK!'], f_nhac: ['NHAC!', 'NOM!'],
  f_fled: ['fugiu!', 'ran away!'], f_bye: ['Tchau!', 'Bye!'], f_dodge: ['desviou', 'dodged'], f_broke: ['QUEBROU!', 'BROKEN!'], f_escaped: ['ESCAPOU!', 'ESCAPED!'],
  f_gone: ['O pombo fugiu com o saque…', 'The pigeon got away with the loot…'], f_sucked: ['SUGADO!', 'SUCKED IN!'], f_mash: ['APERTE ATACAR!', 'MASH ATTACK!'],
  f_mashK: ['APERTE o botão do mouse / J', 'MASH the mouse button / J'], f_high: ['Alto demais! Só o Mimo alcança', 'Too high! Only Mimo can reach'],
  f_sItch: ['com coceira', 'itchy'], f_sWet: ['molhado', 'wet'], f_sHealthy: ['saúde em dia', 'healthy'],
  o_foe_clear: ['Mande embora: {0}', 'Chase off: {0}'], o_foe_wave: ['Onda {0}/{1}: espante a bicharada', 'Wave {0}/{1}: chase the critters off'],
  o_foe_cash: ['Recupere as moedas dos Pombos Ladrões', 'Get the coins back from the Thief Pigeons'], o_foe_cheese: ['Mortícia: roube o queijo dos Ratos Ninjas', 'Morticia: steal the cheese from the Ninja Rats'],
  o_foe_gift: ['Recupere os presentes roubados pelos Pombos', 'Get back the gifts the Pigeons stole'], o_foe_survive: ['Aguente firme sem desmaiar!', 'Hold on without fainting!'],
  b_foe_hunt: ['A bicharada tomou o bairro. Vá até cada grupo e mande todos embora. Cada gato tem um truque: troque à vontade!', 'Critters took over the district. Find each group and chase them off. Every cat has a trick: switch freely!'],
  b_foe_waves: ['Ondas de bichos na arena. Ninguém se machuca de verdade: eles viram confete ou saem correndo.', 'Waves of critters in the arena. Nobody really gets hurt: they turn into confetti or run away.'],
  b_foe_recover: ['Eles levaram o que é nosso! Corra atrás: o Mimo acerta quem voa e a Mortícia pega tudo de volta.', 'They took what is ours! Chase them: Mimo hits the flyers and Morticia takes it all back.'],
  b_foe_survive: ['Sobreviva até o relógio zerar. Fuja do jato de água e não deixe as pulgas te pararem.', 'Survive until the clock runs out. Dodge the water jet and do not let the fleas slow you down.'],
  b_foe_boss: ['Três fases: a Mimosa quebra a grade do caminhão, vocês limpam as bugigangas e depois é desviar e atacar!', 'Three phases: Mimosa breaks the truck grille, you clear the gadgets, then dodge and attack!'],
});

// ---------- data + pure helpers (unit-tested in tests/enemies.test.mjs) ----------
const E = VP.Enemies = { DATA: null, ready: false, pool: [] };
E.TYPES = ['pulga', 'aspirador', 'pombo', 'rato', 'robo', 'pepino'];
E.HINT = { pulga: 'mimosa', pepino: 'mimo', pombo: 'mimo', rato: 'morticia', robo: 'mimosa', aspirador: 'mimosa' }; // the cat that shines against each one
E.eff = lv => { lv = lv || 1; return lv <= 20 ? lv : 20 + (lv - 20) * 0.5; };
// stats of an enemy type at a given (mission or player) level
E.stats = function (type, lv, data) {
  const D = data || E.DATA, d = D.enemies[type], s = D.scaling, n = Math.max(0, Math.min(E.eff(lv), s.maxLevel) - 1);
  return { hp: Math.round(d.hp * (1 + s.hpPerLevel * n)), armor: Math.round((d.armor || 0) * (1 + s.hpPerLevel * n)), dmg: +(d.dmg * (1 + s.dmgPerLevel * n)).toFixed(2), spd: Math.round(d.spd * (1 + s.spdPerLevel * n)), coins: Math.round(d.coins * (1 + s.coinsPerLevel * n)) };
};
E.eligible = function (district, lv, data) { const D = data || E.DATA; return Object.keys(D.enemies).filter(k => D.enemies[k].minLevel <= lv && D.enemies[k].districts.includes(district)); };
E.groupSize = function (type, lv, data) { const D = data || E.DATA, g = D.enemies[type].group; return Math.min(g[1], g[0] + Math.floor(E.eff(lv) / D.scaling.groupEvery)); };
// Player level. feat/progression owns XP/levels: when it exposes VP.Progress.level() we use it; until then the story progress stands in.
E.playerLevel = function () { const P = VP.Progress; if (P && typeof P.level === 'function') { const v = +P.level(); if (v >= 1) return Math.min(60, Math.floor(v)); } return U.clamp((VP.S && VP.S.unlocked) || 1, 1, 40); };
E.name = type => { const d = E.DATA.enemies[type] || E.DATA.bosses[type]; return d ? d.name[VP.lang() === 'pt' ? 'pt' : 'en'] : type; };

if (!HAS_DOM) return; // Node (unit tests): only the pure helpers above

const Game = VP.Game, T = VP.TILE, S3 = 1 / 24;
const sfx = (n, g) => VP.Audio.sfx(n, g), tr = (...a) => VP.t(...a), FX = Game.fx;
const CONF = ['#ff4fb8', '#2de2e6', '#ffd23f', '#7CFF6B', '#ffffff'];
const tmp = { x: 0, y: 0 };
const turnTo = (cur, target, k) => cur + U.angDiff(cur, target) * Math.min(1, k);

function state(G) {
  if (!G.foeS) { G.foes = []; G.fshots = []; G.picks = G.picks || []; G.foeS = { prev: [], head: [], dashId: 0, hold: null, ambT: 8, feastT: 0, stat: { defeated: 0, by: {}, recovered: 0, cheese: 0, gifts: 0, broken: 0, escaped: 0, scares: 0 } }; }
  return G.foeS;
}
E.state = state;
E.alive = (G, tag) => { let n = 0; for (const e of G.foes || []) if (!e.dead && !e.gone && (!tag || e.tag === tag)) n++; return n; };

// ---------- spawning (pooled objects, hard caps) ----------
E.spawn = function (G, type, x, y, o) {
  o = o || {}; const St = state(G), d = E.DATA && E.DATA.enemies[type]; if (!d) return null;
  if (!o.force && G.foes.length >= E.DATA.cap.total) return null;
  const lv = o.lv || (G.free ? E.playerLevel() : G.m.lv) || 1, s = E.stats(type, lv), e = E.pool.pop() || {};
  for (const k in e) delete e[k];
  Object.assign(e, { kind: 'foe', type, d, x, y, r: d.r, hp: s.hp, max: s.hp, armor: s.armor, maxArmor: s.armor, spd: s.spd, dmg: s.dmg, coins: s.coins, lv,
    t: Math.random() * 6, st: 0, state: o.state || 'patrol', home: { x, y }, z: 0, vz: 0, a: Math.random() * 6.283, walk: 0, stun: 0, flash: 0, squash: 0, kx: 0, ky: 0,
    cd: U.rand(0.4, 1.4), cd2: 0, carry: null, dead: false, gone: false, tag: o.tag || null, aggro: o.aggro || d.aggro || 260, ambient: !!o.ambient, fly: false, stuck: 0, wt: 0, dodge: 0 });
  if (d.carry) e.carry = { k: d.carry, n: 1 };
  if (o.carry) e.carry = o.carry;
  if (type === 'pombo') { e.fly = true; e.z = d.params.flyZ; if (e.carry) { e.state = 'flee'; e.fleeT = 0; e.st = 0; } }
  void St; G.foes.push(e); return e;
};
// a group around a point (free spots only)
E.group = function (G, type, pt, o) {
  o = o || {}; const n = o.n || E.groupSize(type, o.lv || (G.free ? E.playerLevel() : G.m.lv)), out = [], W = G.W, r = E.DATA.enemies[type].r;
  for (let i = 0; i < n; i++) {
    let p = null;
    for (let k = 0; k < 14 && !p; k++) { const a = Math.random() * 6.283, d = 14 + Math.random() * (o.spread || 70), x = pt.x + Math.cos(a) * d, y = pt.y + Math.sin(a) * d; if (!W.blocked(x, y, r + 3, 0)) p = { x, y }; }
    const e = E.spawn(G, type, (p || pt).x, (p || pt).y, o); if (e) out.push(e);
  }
  return out;
};
function ambientInit(G) {
  const St = state(G); if (!E.ready || !G.free || G.W.real || G.trial) return;
  St.ambient = true;
  const lv = E.playerLevel(), rng = U.rng(4242 + lv * 7), a = G.cats[G.active];
  for (let d = 0; d < 5; d++) {
    const types = E.eligible(d, lv); if (!types.length) continue;
    for (let g = 0; g < E.DATA.cap.ambientGroupsPerDistrict; g++) { const type = rng.pick(types), pt = G.W.randWalkD(d, rng); if (G.foes.length > 20 || U.d2(pt.x, pt.y, a.x, a.y) < 520 * 520) continue; E.group(G, type, pt, { lv, ambient: true }); }
  }
}
function ambientTick(G, St, dt) {
  St.ambT -= dt; if (St.ambT > 0) return; St.ambT = E.DATA.cap.respawnSeconds;
  const a = G.cats[G.active], d = VP.World.distAt(G.W, a.x, a.y), lv = E.playerLevel(), types = E.eligible(d, lv); if (!types.length) return;
  let near = 0; for (const e of G.foes) if (!e.dead && !e.gone && U.d2(e.x, e.y, a.x, a.y) < 1300 * 1300) near++;
  if (near >= 4) return;
  const pt = Game.spawnPoint(650, 1000); if (pt && !Game.onScreen(pt.x, pt.y, 0)) E.group(G, U.pick(types), pt, { lv, ambient: true });
}

// ---------- cat status effects (itchy = slow, wet = slow + slower attacks, scare = short stun with a jump) ----------
function deb(c) { return c.fdeb || (c.fdeb = { itch: 0, wet: 0, spd0: c.spd, regenT: 0 }); }
const buffNow = () => (VP.Clinic && VP.Clinic.buff ? VP.Clinic.buff() : null);
E.itch = function (G, c) {
  const b = buffNow(); if (b && b.noItch) { if (!c.fsafeT || c.fsafeT < G.real) { c.fsafeT = G.real + 1.5; FX.text(c.x, c.y - 52, '🛡 ' + tr('f_safe'), '#7CFF6B', 13); } return false; }
  const d = deb(c); if (d.itch <= 0) FX.text(c.x, c.y - 52, tr('f_itch'), '#ffb347', 14); d.itch = E.DATA.debuffs.itch.seconds; return true;
};
E.wet = function (G, c) { const d = deb(c); if (d.wet <= 0) { FX.text(c.x, c.y - 52, '💦 ' + tr('f_wet'), '#6fd3ff', 15); if (c.idx === G.active) sfx('hurt', 0.3); } d.wet = E.DATA.debuffs.wet.seconds; };
E.scare = function (G, c) {
  if (c.down || G.car) return false;
  c.root = Math.max(c.root, E.DATA.debuffs.scare.seconds); c.hopT = 0.5; c.kx = c.ky = 0; c.emote = null;
  FX.text(c.x, c.y - 60, tr('f_scare'), '#7CFF6B', 17); FX.burst(c.x, c.y - 24, 8, ['#7CFF6B', '#fff'], 150, 'star', 6, 0.5); sfx('alarm', 0.4); if (c.idx === G.active) FX.shake(6);
  state(G).stat.scares++; return true;
};
// small, never-fainting damage (fleas, water, the vacuum): annoying, not dangerous
function nibble(G, c, dmg) { if (c.down || c.inv > 0.2 || dmg <= 0) return; const v = Math.max(1, Math.round(dmg)); if (c.hp - v < 1) return; c.hp -= v; c.flash = 0.1; G.stat.dmg += v; FX.text(c.x, c.y - 44, '-' + v, '#ff9f9f', 13); }
function debuffTick(G, dt) {
  const D = E.DATA.debuffs, b = buffNow();
  for (const c of G.cats) {
    const d = deb(c);
    if (d.itch > 0) { d.itch -= dt; if (Math.random() < dt * 5) FX.part({ x: c.x + U.rand(-10, 10), y: c.y - U.rand(4, 26), k: 'dot', col: '#7a2f2a', size: 3, life: 0.3, vy: -40 }); }
    if (d.wet > 0) { d.wet -= dt; if (Math.random() < dt * 7) FX.part({ x: c.x + U.rand(-10, 10), y: c.y - 8, k: 'dot', col: '#6fd3ff', size: 3, life: 0.35, vy: 30 }); }
    c.spd = d.spd0 * (d.itch > 0 ? D.itch.slow : 1) * (d.wet > 0 ? D.wet.slow : 1) * (b ? b.speed || 1 : 1);
    if (b && b.regen && !c.down && c.hp < c.max) { d.regenT += dt; if (d.regenT >= 1) { d.regenT = 0; c.hp = Math.min(c.max, c.hp + b.regen); } }
  }
}
E.clearDebuffs = function (G) { for (const c of G.cats) { const d = deb(c); d.itch = d.wet = 0; } };

// ---------- hits, steals, "defeat" (confetti or running away) ----------
E.hit = function (G, e, dmg, src, fxx, fyy, kb) {
  if (e.dead || e.gone || e.dodge > 0) return false;
  if (e.guard && e.guard(G, e, dmg, src) === false) return true; // bosses: shield phases
  if (G.catnip > 0) dmg *= 1.6;
  dmg *= (e.d.weak && e.d.weak[src]) || 1;
  let shown = dmg, tink = false;
  if (e.armor > 0) {
    const hard = src === 'bite' || src === 'roar' || src === 'car';
    e.armor -= dmg * (hard ? 1.7 : 0.3); shown = dmg * (hard ? 0.35 : 0.12); tink = !hard;
    if (e.armor <= 0) { e.armor = 0; FX.burst(e.x, e.y - 20, 12, '#c0c7d1', 200, 'dot', 6); sfx('break'); FX.shake(7); if (e.type === 'aspirador') breakVac(G, e); }
  }
  shown = Math.max(1, Math.round(shown));
  e.hp -= shown; e.flash = 0.14; e.squash = 1;
  if (e.floor !== undefined && e.hp < e.floor) e.hp = e.floor; // bosses: a phase cannot be skipped
  if (e.state === 'patrol') e.state = 'act';
  if (kb && fxx !== undefined && !e.isBoss) { const a = Math.atan2(e.y - fyy, e.x - fxx); e.kx += Math.cos(a) * kb; e.ky += Math.sin(a) * kb; }
  FX.text(e.x, e.y - 34 - e.r - e.z, tink ? tr('tink') : '' + shown, tink ? '#c0c7d1' : src === 'bite' ? '#ff7ac0' : src === 'bolt' ? '#8ff3ff' : '#fff', tink ? 12 : 15);
  FX.burst(e.x, e.y - 12 - e.z, 3, '#ffd23f', 110, 'star', 5, 0.3);
  if (tink) sfx('tink', 0.08);
  VP.haptic(9, 170);
  if (e.hp <= 0) E.defeat(G, e, src);
  return true;
};
function giveBack(G, St, e, c) {
  const k = e.carry; if (!k) return; e.carry = null;
  if (k.k === 'cash') { G.stat.cash += k.n + 5; St.stat.recovered++; FX.text(e.x, e.y - 50, '💰 ' + tr('f_back'), '#ffd23f', 16); sfx('cash'); }
  else if (k.k === 'gift') { St.stat.recovered++; St.stat.gifts++; G.stat.cash += 15; FX.text(e.x, e.y - 50, '🎁 ' + tr('f_back'), '#ffd23f', 16); sfx('paw', 0.1); }
  else if (k.k === 'snack') { const m = G.cats[2]; m.belly = Math.min(100, m.belly + 14); St.stat.recovered++; FX.text(e.x, e.y - 50, tr('f_back'), '#ffd23f', 15); sfx('eat'); }
  else if (k.k === 'cheese') { if (c && c.name === 'morticia') { const m = G.cats[2]; m.belly = Math.min(100, m.belly + 12); m.mouth = 1; Game.healTeam(6); G.stat.eaten++; G.stat.cash += 8; St.stat.cheese++; FX.text(c.x, c.y - 52, '🧀 ' + tr('f_nhac'), '#ffd23f', 16); sfx('eat'); } }
  FX.burst(e.x, e.y - 20, 8, ['#ffd23f', '#fff'], 160, 'star', 6, 0.5);
}
// Morticia takes what the enemy carries (the pigeon's loot, the rats' cheese); empty-pawed it then leaves
function steal(G, St, e, c) {
  if (!e.carry || e.dead || e.gone) return false;
  G.stat.stolen++; FX.part({ x: e.x, y: e.y - 30 - e.z, k: 'fly', tx: c, life: 0.25, size: 12, col: '#ffd23f' }); FX.text(e.x, e.y - 64, tr('stolen'), '#ffd23f', 15); sfx('steal');
  giveBack(G, St, e, c); E.defeat(G, e, 'snatch', true);
  return true;
}
E.defeat = function (G, e, how, quiet) {
  if (e.dead || e.gone) return;
  const St = state(G);
  if (e.carry && e.carry.k !== 'cheese') giveBack(G, St, e, null);
  if (St.hold && St.hold.foe === e) release(G, St, true);
  St.stat.defeated++; St.stat.by[e.type] = (St.stat.by[e.type] || 0) + 1; G.stat.ko++; G.stat.cash += e.coins;
  for (const f of Ext.foe) { try { f(e.type, G, e); } catch (er) { /* ignore */ } }
  if (e.onDefeat) e.onDefeat(G, e);
  sfx('ko', 0.04); FX.shake(3);
  if (e.d.defeat === 'flee') { // runs (or flies) away and pops out of sight
    e.gone = true; e.state = 'gone'; e.st = 0; e.carry = null; e.stun = 0;
    if (!quiet) FX.text(e.x, e.y - 50 - e.z, tr('f_fled'), '#fff', 13);
    FX.poof(e.x, e.y - 10 - e.z, 5);
  } else { // confetti!
    e.dead = true;
    FX.burst(e.x, e.y - 16, 18, CONF, 230, 'star', 7, 0.9); FX.burst(e.x, e.y - 16, 10, CONF, 150, 'dot', 5, 0.7); FX.poof(e.x, e.y - 12, 6);
  }
  if (Math.random() < 0.35 && !G.W.blocked(e.x, e.y, 10, 0)) Game.addItem('treat', e.x, e.y, true);
};
function breakVac(G, e) { if (e.broken) return; const St = state(G); e.broken = true; e.armor = 0; e.stun = Math.max(e.stun, 3); e.hp = Math.min(e.hp, e.max * 0.5); St.stat.broken++; FX.text(e.x, e.y - 70, '🔧 ' + tr('f_broke'), '#ffd23f', 18); if (St.hold && St.hold.foe === e) release(G, St, true); }
function release(G, St, freed) {
  const h = St.hold; if (!h) return; St.hold = null;
  const c = h.cat, e = h.foe, a = e.a;
  c.root = 0; c.inv = Math.max(c.inv, 1.2); c.kx = Math.cos(a) * 300; c.ky = Math.sin(a) * 300;
  e.cd = e.d.params.cooldown; e.stun = Math.max(e.stun, 1.6); e.suck = 0;
  if (freed) { FX.text(c.x, c.y - 56, tr('f_escaped'), '#7CFF6B', 17); sfx('revive', 0.2); FX.burst(c.x, c.y - 20, 10, CONF, 180, 'star', 6, 0.5); }
}

// ---------- movement ----------
function stepE(W, e, dx, dy) {
  if (e.fly && e.z > 20) { e.x = U.clamp(e.x + dx, 80, W.pw - 80); e.y = U.clamp(e.y + dy, 80, W.ph - 80); return false; }
  let hit = false;
  if (dx) { if (!W.blocked(e.x + dx, e.y, e.r, 0)) e.x += dx; else hit = true; }
  if (dy) { if (!W.blocked(e.x, e.y + dy, e.r, 0)) e.y += dy; else hit = true; }
  return hit;
}
function go(G, e, tx, ty, spd, dt, field) {
  let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  if (field && G.field && !(e.fly && e.z > 20) && (e.stuck > 0 || d > 60) && !G.W.los(e.x, e.y, tx, ty, 0)) { if (G.W.fieldDir(G.field, e.x, e.y, tmp) > 0) { dx = tmp.x; dy = tmp.y; } }
  const hit = stepE(G.W, e, dx * spd * dt, dy * spd * dt);
  if (hit) e.stuck = 0.6; else if (e.stuck > 0) e.stuck -= dt;
  e.a = turnTo(e.a, Math.atan2(dy, dx), dt * 12); e.walk = 1;
  return d;
}
function wander(G, e, dt, spd, rad) {
  e.wt -= dt;
  if (e.wt <= 0) { e.wt = U.rand(1.5, 4); const an = Math.random() * 6.283, d = U.rand(20, rad || 110); e.gx = e.home.x + Math.cos(an) * d; e.gy = e.home.y + Math.sin(an) * d; }
  if (e.gx !== undefined && e.wt > 0.8 && U.d2(e.x, e.y, e.gx, e.gy) > 14 * 14) { const px = e.x, py = e.y; go(G, e, e.gx, e.gy, spd, dt); if (px === e.x && py === e.y) e.wt = 0; }
}
function pickCat(G, e) {
  const a = G.cats[G.active]; let best = null, bd = 1e12;
  for (const c of G.cats) { if (c.down || c.invis > 0) continue; const d = U.d2(c.x, c.y, e.x, e.y) * (c === a ? 0.6 : 1); if (d < bd) { bd = d; best = c; } }
  return best;
}
function shot(G, o) { if (G.fshots.length < E.DATA.cap.shots) G.fshots.push(Object.assign({ t: 0, life: 1.2, r: 7 }, o)); }

// ---------- behaviours ----------
const AI = {
  boss(G, St, e, c, d, dt) { VP.Boss.tick(G, St, e, c, d, dt); }, // see boss.js
  // Pulgas Gigantes: a hopping swarm; landing on a cat makes it itchy (slow) for a moment
  swarm(G, St, e, c, d, dt) {
    const p = e.d.params;
    if (e.z > 0 || e.vz > 0) { // airborne
      e.z += e.vz * dt; e.vz -= 900 * dt; stepE(G.W, e, e.hx * dt, e.hy * dt);
      if (e.z <= 0) {
        e.z = 0; e.vz = 0; e.squash = 0.8; e.cd = U.rand(p.rest[0], p.rest[1]);
        if (c && d < 22 + c.r && !G.car) { if (E.itch(G, c)) nibble(G, c, e.dmg); const a = Math.atan2(e.y - c.y, e.x - c.x) + U.rand(-0.6, 0.6); e.kx = Math.cos(a) * 200; e.ky = Math.sin(a) * 200; e.cd = 0.7; }
      }
      return;
    }
    e.cd -= dt; if (e.cd > 0) return;
    let tx, ty;
    if (e.state === 'act' && c) { tx = c.x + U.rand(-12, 12); ty = c.y + U.rand(-12, 12); }
    else { const an = Math.random() * 6.283, r = U.rand(20, 90); tx = e.home.x + Math.cos(an) * r; ty = e.home.y + Math.sin(an) * r; }
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1, air = 2 * p.hop / 900, v = Math.min(e.spd, l / air);
    e.hx = dx / l * v; e.hy = dy / l * v; e.vz = p.hop * (e.state === 'act' ? 1 : 0.6); e.a = Math.atan2(dy, dx);
  },
  // Pepino Assustador: creeps up behind the cat; a cat that turns around into it jumps (short stun). Freezes while watched.
  ambush(G, St, e, c, d, dt) {
    const p = e.d.params;
    if (e.state === 'giggle') { e.st += dt; e.a += dt * 14; if (e.st > 1) { e.state = 'hide'; e.st = 0; } return; }
    if (e.state === 'hide') { e.st += dt; if (c) go(G, e, e.x + (e.x - c.x), e.y + (e.y - c.y), e.spd * 1.3, dt); if (e.st > 2) e.state = 'act'; return; }
    if (e.state !== 'act' || !c) { e.watched = false; return; }
    const hd = St.head[c.idx] === undefined ? c.aim : St.head[c.idx], toMe = Math.atan2(e.y - c.y, e.x - c.x), facing = Math.abs(U.angDiff(hd, toMe)) < p.behind;
    e.watched = facing; e.cd -= dt;
    if (!facing) {
      if (d < p.trigger) e.armT = (e.armT || 0) + dt; // it got behind the cat unnoticed
      const bx = c.x - Math.cos(hd) * 54, by = c.y - Math.sin(hd) * 54;
      if (d > 46) go(G, e, bx, by, e.spd, dt, true); else e.a = turnTo(e.a, toMe + Math.PI, dt * 8);
    } else {
      e.a = turnTo(e.a, toMe + Math.PI, dt * 10);
      if (d < p.trigger && (e.armT || 0) > 0.35 && e.cd <= 0 && c.idx === G.active) { if (E.scare(G, c)) { e.state = 'giggle'; e.st = 0; e.cd = p.cooldown; } }
      e.armT = 0;
    }
  },
  // Pombo Ladrão: circles, swoops, takes coins (or a snack) and flies off; it tires and lands, so it can be caught
  thief(G, St, e, c, d, dt) {
    const p = e.d.params;
    if (e.state === 'flee') {
      e.fleeT = (e.fleeT || 0) + dt; e.st += dt;
      if (e.fleeT > p.escape && e.carry) { St.stat.escaped++; e.carry = null; e.gone = true; e.state = 'gone'; e.st = 0; if (Game.onScreen(e.x, e.y, 100)) FX.say(tr('f_gone'), '#ffb347', 2.2); return; }
      if (e.rest > 0) { // landed, out of breath
        e.rest -= dt; e.z = Math.max(0, e.z - 160 * dt);
        if (e.rest <= 0) { e.st = 0; e.dest = null; }
        return;
      }
      if (!e.dest) e.dest = Game.spawnPoint(380, 720) || Game.spawnPoint(250, 900) || { x: e.home.x, y: e.home.y };
      e.z = Math.min(p.flyZ * 0.75, e.z + 140 * dt);
      const dd = go(G, e, e.dest.x, e.dest.y, e.spd, dt);
      if (dd < 16 || e.st > p.flight) { if (!G.W.blocked(e.x, e.y, e.r + 2, 0)) { e.rest = p.rest; } else { e.dest = Game.nearFree(e.x, e.y, 120, 0) || e.dest; e.st = p.flight - 0.6; } }
      return;
    }
    if (e.state === 'swoop') {
      e.st += dt; e.z = Math.max(0, e.z - 150 * dt);
      const t = e.tgt && !e.tgt.down ? e.tgt : c; if (!t) { e.state = 'act'; return; }
      const dd = go(G, e, t.x, t.y, p.swoop, dt);
      if (dd < 20 + t.r && !G.car && t.dashT <= 0 && t.invis <= 0) {
        const n = Math.min(p.steal, Math.floor(G.stat.cash));
        if (n > 0) { G.stat.cash -= n; e.carry = { k: 'cash', n }; FX.text(t.x, t.y - 56, tr('f_stole', n), '#ff6b6b', 16); }
        else { const m = G.cats[2]; m.belly = Math.max(0, m.belly - 12); e.carry = { k: 'snack', n: 1 }; FX.text(t.x, t.y - 56, tr('f_stoleSnack'), '#ff6b6b', 15); }
        sfx('steal'); FX.burst(t.x, t.y - 20, 6, '#ffd23f', 150, 'star', 5, 0.4); if (t.idx === G.active) FX.shake(5);
        e.state = 'flee'; e.st = 0; e.fleeT = 0; e.dest = null; e.rest = 0;
      } else if (e.st > 1.3) { e.state = 'act'; e.cd = 2.6; }
      return;
    }
    e.z = Math.min(p.flyZ, e.z + 120 * dt);
    if (e.state !== 'act' || !c) { e.st += dt; const r = 80; go(G, e, e.home.x + Math.cos(e.st * 0.9) * r, e.home.y + Math.sin(e.st * 0.9) * r, e.spd * 0.5, dt); return; }
    e.cd -= dt;
    if (d > 150) go(G, e, c.x, c.y, e.spd, dt); else { e.st += dt; go(G, e, c.x + Math.cos(e.st * 1.6) * 120, c.y + Math.sin(e.st * 1.6) * 120, e.spd, dt); }
    if (e.cd <= 0 && d < 190) { e.state = 'swoop'; e.st = 0; e.tgt = c; sfx('dash', 0.2); }
  },
  // Ratos Ninjas: keep their distance, strafe, dodge shots and throw cheese stars
  ninja(G, St, e, c, d, dt) {
    const p = e.d.params;
    if (e.dashT > 0) { e.dashT -= dt; stepE(G.W, e, e.hx * dt, e.hy * dt); return; }
    if (e.state !== 'act' || !c) { wander(G, e, dt, e.spd * 0.4); return; }
    e.cd -= dt; e.cd2 -= dt; e.sideT = (e.sideT || 0) - dt; if (e.sideT <= 0) { e.sideT = U.rand(0.8, 1.6); e.side = Math.random() < 0.5 ? 1 : -1; }
    const toC = Math.atan2(c.y - e.y, c.x - e.x);
    if (e.cd2 <= 0 && e.stun <= 0) { // dodge an incoming bubble
      for (const b of G.bullets) { if (b.from !== 'cat' || b.k !== 'bolt') continue; const bd = U.d2(b.x, b.y, e.x, e.y); if (bd > 95 * 95) continue; const dot = (e.x - b.x) * b.vx + (e.y - b.y) * b.vy; if (dot <= 0) continue; e.cd2 = p.dodgeEvery; if (Math.random() < p.dodge) { const s = Math.random() < 0.5 ? 1 : -1, an = Math.atan2(b.vy, b.vx) + s * 1.57; e.hx = Math.cos(an) * 430; e.hy = Math.sin(an) * 430; e.dashT = 0.17; e.dodge = 0.3; FX.text(e.x, e.y - 40, tr('f_dodge'), '#c0c7d1', 11); FX.poof(e.x, e.y - 8, 3); } break; }
    }
    if (d < p.keep[0]) go(G, e, e.x - Math.cos(toC) * 40 + Math.cos(toC + 1.57) * 30 * e.side, e.y - Math.sin(toC) * 40 + Math.sin(toC + 1.57) * 30 * e.side, e.spd * 0.62, dt);
    else if (d > p.keep[1]) go(G, e, c.x, c.y, e.spd, dt, true);
    else go(G, e, e.x + Math.cos(toC + 1.57) * 40 * e.side, e.y + Math.sin(toC + 1.57) * 40 * e.side, e.spd * 0.7, dt);
    e.a = turnTo(e.a, toC, dt * 14);
    if (e.cd <= 0 && e.carry && d < 320 && G.W.los(e.x, e.y, c.x, c.y, 2)) { e.cd = p.throwEvery; e.throwT = 0.25; const an = toC + U.rand(-0.08, 0.08); shot(G, { k: 'star', x: e.x, y: e.y - 6, vx: Math.cos(an) * p.starSpeed, vy: Math.sin(an) * p.starSpeed, dmg: e.dmg, life: 1.3 }); sfx('dash', 0.15); }
  },
  // Robô do Banho: rolls closer, warns with a red line, then sprays water. Wet cats are slow for a while.
  sprayer(G, St, e, c, d, dt) {
    const p = e.d.params;
    if (e.state !== 'act' || !c) { wander(G, e, dt, e.spd * 0.5); return; }
    const toC = Math.atan2(c.y - e.y, c.x - e.x);
    if (e.spray > 0) { // spraying along the locked angle
      e.spray -= dt; e.dropT = (e.dropT || 0) - dt;
      while (e.dropT <= 0) { e.dropT += 0.085; const an = e.sa + U.rand(-0.2, 0.2), sp = p.dropSpeed * U.rand(0.85, 1.1); shot(G, { k: 'water', x: e.x + Math.cos(e.sa) * 18, y: e.y + Math.sin(e.sa) * 18 - 8, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, dmg: e.dmg, life: 0.8 }); }
      return;
    }
    if (e.wind > 0) { e.wind -= dt; e.a = turnTo(e.a, e.sa, dt * 10); if (e.wind <= 0) { e.spray = p.spray; e.cd = p.every; sfx('net', 0.2); } return; }
    e.cd -= dt;
    if (d > p.range * 0.8 || !G.W.los(e.x, e.y, c.x, c.y, 2)) go(G, e, c.x, c.y, e.spd, dt, true); else e.a = turnTo(e.a, toC, dt * 5);
    if (e.cd <= 0 && d < p.range && G.W.los(e.x, e.y, c.x, c.y, 2)) { e.wind = p.windup; e.sa = toC; G.teles.push({ t: 0, dur: p.windup, k: 'line', x: e.x, y: e.y, a: toC, len: p.range + 30, w: 70 }); sfx('tink', 0.2); }
  },
  // Aspirador Monstro: chases and sucks the cat in. Mash ATTACK to wriggle out. Mimosa's bite or roar breaks it.
  vacuum(G, St, e, c, d, dt) {
    const p = e.d.params;
    if (St.hold && St.hold.foe === e) { holdTick(G, St, e, dt); return; }
    e.suck = 0;
    if (e.state !== 'act' || !c) { wander(G, e, dt, e.spd * 0.4); return; }
    if (e.broken) { go(G, e, e.x + (e.x - c.x), e.y + (e.y - c.y), e.spd * 0.45, dt); e.a += Math.sin(e.t * 9) * 0.1; return; }
    e.cd -= dt;
    const los = G.W.los(e.x, e.y, c.x, c.y, 0);
    if (e.cd > 0 || d > p.range || !los) { go(G, e, c.x, c.y, e.spd * (e.cd > 0 ? 0.5 : 1), dt, true); return; }
    e.suck = 1; const toC = Math.atan2(c.y - e.y, c.x - e.x); e.a = turnTo(e.a, toC, dt * 9);
    if (Math.random() < dt * 26) { const an = toC + U.rand(-0.5, 0.5), r = U.rand(40, p.range); FX.part({ x: e.x + Math.cos(an) * r, y: e.y + Math.sin(an) * r, k: 'suck', tx: e, life: 0.35, col: '#d9c8f0', size: 4 }); }
    go(G, e, c.x, c.y, e.spd * 0.45, dt);
    if (St.hold || c.down || G.car || c.dashT > 0 || c.inv > 0.6) return;
    const l = d || 1, px = (e.x - c.x) / l * p.pull * dt, py = (e.y - c.y) / l * p.pull * dt;
    if (!G.W.blocked(c.x + px, c.y, c.r, 0)) c.x += px; if (!G.W.blocked(c.x, c.y + py, c.r, 0)) c.y += py;
    if (d < e.r + c.r + 6) { St.hold = { foe: e, cat: c, n: 0, t: 0, prev: true, tick: 0 }; FX.text(c.x, c.y - 60, tr('f_sucked'), '#b967ff', 18); sfx('down', 0.5); if (c.idx === G.active) FX.shake(8); }
  },
};
function holdTick(G, St, e, dt) {
  const h = St.hold, c = h.cat, p = e.d.params;
  h.t += dt; e.suck = 1;
  if (c.down || e.stun > 0 || G.car) { release(G, St, !c.down); return; }
  c.x = e.x + Math.cos(e.a) * 12; c.y = e.y + Math.sin(e.a) * 12; c.root = Math.max(c.root, 0.25); c.kx = c.ky = 0; c.inv = Math.max(c.inv, 0.25);
  if (c.idx === G.active) { const press = !!(I.attack || I.ctxHeld); if (press && !h.prev) { h.n++; sfx('tink', 0.03); FX.burst(c.x, c.y - 20, 2, '#fff', 120, 'star', 5, 0.25); VP.haptic(12, 60); } h.prev = press; }
  h.n += dt * p.autoEscape; // it always lets go after a few seconds, mashing is just faster
  h.tick += dt; if (h.tick >= 1) { h.tick = 0; const v = Math.round(e.dmg); if (c.hp - v >= 1) { c.hp -= v; c.flash = 0.1; G.stat.dmg += v; } }
  if (h.n >= p.mash) release(G, St, true);
}

function updFoe(G, St, e, dt, awake) {
  e.t += dt; e.walk = 0;
  if (e.flash > 0) e.flash -= dt; if (e.squash > 0) e.squash = Math.max(0, e.squash - dt * 5); if (e.dodge > 0) e.dodge -= dt; if (e.throwT > 0) e.throwT -= dt;
  if (e.gone) { // running (or flying) away, then gone for good
    e.st += dt; const a = G.cats[G.active], an = Math.atan2(e.y - a.y, e.x - a.x); e.a = an; e.walk = 1;
    if (e.fly) { e.z += 220 * dt; e.x += Math.cos(an) * 260 * dt; e.y += Math.sin(an) * 260 * dt; } else stepE(G.W, e, Math.cos(an) * 300 * dt, Math.sin(an) * 300 * dt);
    if (e.st > 1.1) { e.dead = true; FX.poof(e.x, e.y - 10 - e.z, 6); }
    return;
  }
  if (e.kx || e.ky) { stepE(G.W, e, e.kx * dt, e.ky * dt); const f = Math.pow(0.0008, dt); e.kx *= f; e.ky *= f; if (Math.abs(e.kx) + Math.abs(e.ky) < 6) e.kx = e.ky = 0; }
  if (e.stun > 0) { e.stun -= dt; e.suck = 0; if (e.fly) e.z = Math.max(0, e.z - 200 * dt); if (e.type === 'pulga' && e.z > 0) { e.z = Math.max(0, e.z - 400 * dt); e.vz = 0; } return; }
  const c = pickCat(G, e), d = c ? Math.hypot(c.x - e.x, c.y - e.y) : 1e9;
  if (e.state === 'patrol') { if (c && d < e.aggro && awake.n < E.DATA.cap.awake && (e.fly || G.W.los(e.x, e.y, c.x, c.y, 0))) { e.state = 'act'; awake.n++; FX.part({ x: e.x, y: e.y - 40 - e.z, k: 'txt', txt: '!', col: '#ffd23f', size: 18, life: 0.5, vy: -20 }); } }
  else if (e.state === 'act' && e.ambient && (d > 900 || !c)) { e.state = 'patrol'; e.home.x = e.x; e.home.y = e.y; }
  AI[e.d.behavior](G, St, e, c, d, dt);
}

// ---------- the cats' moves, read from the state the simulation already exposes (no changes to the combat code) ----------
function catMoves(G, St, dt) {
  const active = G.cats[G.active];
  for (const c of G.cats) {
    const p = St.prev[c.idx] || (St.prev[c.idx] = { atk: 0, cdS: c.cdS, dash: 0, recoil: 0 });
    const atk = !c.down && c.atk > p.atk + 0.3, roar = c.name === 'mimosa' && c.cdS > p.cdS + 5, dashing = c.dashT > 0, shotNow = c.recoil > p.recoil + 0.3;
    if (dashing && !p.dash) St.dashId++;
    p.atk = c.atk; p.cdS = c.cdS; p.dash = dashing; p.recoil = c.recoil;
    // where the cat is heading (the cucumber cares): movement first, then the last attack
    if (c === active && Math.hypot(I.mx, I.my) > 0.25) St.head[c.idx] = Math.atan2(I.my, I.mx); else if (atk || shotNow) St.head[c.idx] = c.aim; else if (St.head[c.idx] === undefined) St.head[c.idx] = c.aim;
    const wet = deb(c).wet > 0;
    if (wet && (atk || shotNow) && c.cd > 0) c.cd *= E.DATA.debuffs.wet.attackSlow;
    if (c.down) continue;
    if (roar) { // Mimosa's ROAR: stuns, scatters fleas, breaks the vacuum, clears enemy shots
      for (const e of G.foes) if (!e.dead && !e.gone && U.d2(e.x, e.y, c.x, c.y) < 215 * 215) { if (e.type === 'aspirador') breakVac(G, e); E.hit(G, e, 16, 'roar', c.x, c.y, 260); if (!e.dead && !e.gone) { e.stun = Math.max(e.stun, e.isBoss ? 0.8 : 3); if (!e.isBoss) { e.wind = 0; e.spray = 0; } if (e.state === 'swoop') e.state = 'act'; } }
      for (const s of G.fshots) if (U.d2(s.x, s.y, c.x, c.y) < 215 * 215) s.life = 0;
      for (const k of G.cats) { const d = deb(k); if (U.d2(k.x, k.y, c.x, c.y) < 215 * 215) d.itch = 0; }
    }
    if (c.name === 'mimosa') {
      if (atk && !roar) { const third = c.combo === 0, hx = c.x + Math.cos(c.aim) * 30, hy = c.y + Math.sin(c.aim) * 30, rad = third ? 34 : 28; for (const e of G.foes) if (!e.dead && !e.gone && e.z < 30 && U.d2(e.x, e.y, hx, hy) < (rad + e.r) * (rad + e.r)) E.hit(G, e, (third ? 34 : 21) * (c === active ? 1 : 0.7), 'bite', c.x, c.y, third ? 330 : 120); }
      if (dashing) for (const e of G.foes) if (!e.dead && !e.gone && e.z < 30 && e.dashMark !== St.dashId && U.d2(e.x, e.y, c.x, c.y) < (34 + e.r) * (34 + e.r)) { e.dashMark = St.dashId; E.hit(G, e, 38, 'bite', c.x, c.y, 380); }
    } else if (c.name === 'morticia' && atk) { // steal first, scratch otherwise
      let best = null, bd = 1e12, high = false;
      for (const e of G.foes) { if (e.dead || e.gone) continue; const dd = U.d2(e.x, e.y, c.x, c.y), rr = 54 + e.r; if (dd > rr * rr) continue; if (e.z >= 30) { high = true; continue; } const s = dd * (e.carry ? 0.3 : 1); if (s < bd) { bd = s; best = e; } }
      if (best) { if (!steal(G, St, best, c)) E.hit(G, best, 9, 'snatch', c.x, c.y, 90); } else if (high && c === active) FX.text(c.x, c.y - 52, tr('f_high'), '#c0c7d1', 12);
    }
  }
  // Morticia's FEAST pulls loot out of everyone around
  if (G.feast > 0) { St.feastT -= dt; if (St.feastT <= 0) { St.feastT = 0.22; const m = G.cats[2]; for (const e of G.foes) if (!e.dead && !e.gone && e.carry && U.d2(e.x, e.y, m.x, m.y) < 230 * 230) { steal(G, St, e, m); break; } } }
  // Mimo's bubbles (and the hairball) against the new enemies
  for (const b of G.bullets) {
    if (b.from !== 'cat' || b.life <= 0) continue;
    if (b.k === 'hair') { if (!b.foeDone && b.t + dt >= b.dur) { b.foeDone = 1; for (const e of G.foes) if (!e.dead && !e.gone && U.d2(e.x, e.y, b.tx, b.ty) < 95 * 95) { E.hit(G, e, 22, 'hair', b.tx, b.ty, 140); if (!e.dead && !e.gone) e.stun = Math.max(e.stun, 1.8); } } continue; }
    for (const e of G.foes) { if (e.dead || e.gone) continue; const rr = e.r + 9; if (U.d2(e.x, e.y - 10, b.x, b.y) < rr * rr) { if (E.hit(G, e, b.dmg, 'bolt', b.x - b.vx, b.y - b.vy, 70)) { b.life = 0; FX.burst(b.x, b.y, 4, ['#8ff3ff', '#fff'], 130, 'dot', 4, 0.25); } break; } }
  }
  // followers lend a paw: Mimo shoots what is close, Mimosa snaps at what touches her
  if (G.solo === null && !G.car) {
    const mimo = G.cats[0], mimosa = G.cats[1];
    if (mimo !== active && !mimo.down && !mimo.exhausted && mimo.cd <= 0) {
      let best = null, bd = 330 * 330; for (const e of G.foes) { if (e.dead || e.gone || e.state === 'patrol') continue; const dd = U.d2(e.x, e.y, mimo.x, mimo.y); if (dd < bd && G.W.los(mimo.x, mimo.y - 4, e.x, e.y - 4, 2)) { bd = dd; best = e; } }
      if (best) { const an = Math.atan2(best.y - mimo.y, best.x - mimo.x), mx = mimo.x + Math.cos(an) * 22, my = mimo.y - 12 + Math.sin(an) * 22; G.bullets.push({ k: 'bolt', x: mx, y: my, vx: Math.cos(an) * 640, vy: Math.sin(an) * 640, life: 0.8, dmg: 9, from: 'cat', r: 6, t: 0 }); mimo.cd = 0.5; mimo.recoil = 1; mimo.aim = an; sfx('shoot', 0.08); }
    }
    if (mimosa !== active && !mimosa.down) { mimosa.fbT = (mimosa.fbT || 0) - dt; if (mimosa.fbT <= 0) for (const e of G.foes) if (!e.dead && !e.gone && e.state !== 'patrol' && e.z < 30 && U.d2(e.x, e.y, mimosa.x, mimosa.y) < (40 + e.r) * (40 + e.r)) { mimosa.fbT = 0.6; mimosa.atk = 1; mimosa.mouth = 1; St.prev[1].atk = 1; mimosa.aim = Math.atan2(e.y - mimosa.y, e.x - mimosa.x); E.hit(G, e, 15, 'bite', mimosa.x, mimosa.y, 120); FX.part({ x: e.x, y: e.y - 14, k: 'bite', a: mimosa.aim, size: 26, life: 0.16, col: '#fff' }); sfx('bite', 0.1); break; } }
  }
  // a moving car bumps them away
  if (G.car && Math.abs(G.car.spd) > 90) for (const e of G.foes) if (!e.dead && !e.gone && e.z < 30 && U.d2(e.x, e.y, G.car.x, G.car.y) < (30 + e.r) * (30 + e.r)) E.hit(G, e, 45, 'car', G.car.x, G.car.y, 320);
}
function updShots(G, dt) {
  for (const s of G.fshots) {
    s.t += dt; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (!G.W.pass(s.x, s.y + 10, 2)) { s.life = 0; continue; }
    if (G.car) continue;
    for (const c of G.cats) {
      if (c.down || U.d2(c.x, c.y - 12, s.x, s.y) > (c.r + s.r) * (c.r + s.r)) continue;
      if (s.k === 'water') { E.wet(G, c); nibble(G, c, s.dmg); }
      else if (c.name === 'morticia') { c.mouth = 1; c.belly = Math.min(100, c.belly + 4); FX.text(c.x, c.y - 50, '🧀 ' + tr('f_nhac'), '#ffd23f', 13); sfx('eat', 0.1); } // she eats the cheese stars
      else Game.hurtCat(c, s.dmg, s.x - s.vx, s.y - s.vy);
      s.life = 0; break;
    }
  }
}
// pickups owned by missions (gifts, ornaments...): the leading cat collects them by touch
function updPicks(G, dt) {
  if (!G.picks || !G.picks.length) return; const a = G.car || G.cats[G.active];
  for (const p of G.picks) { p.t = (p.t || 0) + dt; if (p.taken || p.locked) continue; if (U.d2(a.x, a.y, p.x, p.y) < 30 * 30) { p.taken = true; sfx('pickup', 0.05); FX.burst(p.x, p.y - 12, 8, CONF, 150, 'star', 6, 0.5); if (p.on) p.on(p); } }
}
E.addPick = function (G, k, x, y, o) { state(G); const p = Object.assign({ k, x, y, t: Math.random() * 5, taken: false }, o || {}); G.picks.push(p); return p; };

E.update = function (G, dt, sdt) {
  if (!E.ready) return; const St = state(G);
  debuffTick(G, dt);
  catMoves(G, St, dt);
  const a = G.cats[G.active], awake = { n: 0 };
  for (const e of G.foes) if (!e.dead && !e.gone && e.state !== 'patrol') awake.n++;
  for (const e of G.foes) {
    if (e.dead) continue;
    if (!e.gone && e.state === 'patrol' && U.d2(e.x, e.y, a.x, a.y) > 1500 * 1500) continue; // far away and asleep: skip
    updFoe(G, St, e, sdt, awake);
  }
  if (St.hold && (St.hold.foe.dead || St.hold.foe.gone)) release(G, St, true);
  updShots(G, sdt); updPicks(G, dt);
  let w = 0; for (let i = 0; i < G.foes.length; i++) { const e = G.foes[i]; if (e.dead) { if (E.pool.length < 40) E.pool.push(e); } else G.foes[w++] = e; } G.foes.length = w;
  w = 0; for (let i = 0; i < G.fshots.length; i++) if (G.fshots[i].life > 0) G.fshots[w++] = G.fshots[i]; G.fshots.length = w;
  if (St.ambient) ambientTick(G, St, dt);
};
Ext.init.push(G => { state(G); ambientInit(G); });
Ext.update.push(E.update);
// touch auto-aim (and the follower AI) can lock on the new enemies too
Ext.aim.push((G, consider, kind) => { if (!G.foes) return; for (const e of G.foes) { if (e.dead || e.gone || (kind !== 'bolt' && e.z >= 30)) continue; consider(e, e.x, e.y, e.state === 'patrol' ? 1.6 : 1); } });

// ---------- 3D: low-poly models, one InstancedMesh per part (a handful of draw calls for the whole roster) ----------
const INK = '#1a0d24';
const MODELS = {
  pulga: { cap: 20, h: 0.9, parts: [{ build(b) {
    b.sph('#7a2f2a', 0, 0.3, -0.04, 0.24, 0.26, 0.32); b.sph('#93403a', 0, 0.4, 0.28, 0.17, 0.16, 0.17);
    for (const s of [-1, 1]) { b.sph('#ffffff', s * 0.09, 0.47, 0.4, 0.07); b.sph(INK, s * 0.09, 0.47, 0.455, 0.035); b.cyl('#4a1c19', s * 0.06, 0.62, 0.34, 0.015, 0.2, 0.015, 0.5, 0, s * 0.3); b.cyl('#4a1c19', s * 0.27, 0.24, -0.16, 0.04, 0.52, 0.04, 0.9); b.cyl('#4a1c19', s * 0.2, 0.12, 0.14, 0.03, 0.24, 0.03, -0.4); }
    b.cone('#ffd9d0', 0, 0.34, 0.46, 0.03, 0.12, 0.03, Math.PI / 2 + 0.5);
  } }] },
  pepino: { cap: 8, h: 1.5, parts: [{ build(b) {
    b.cyl('#4f9d3a', 0, 0.6, 0, 0.27, 0.8, 0.27); b.sph('#4f9d3a', 0, 1.0, 0, 0.27, 0.22, 0.27); b.sph('#4f9d3a', 0, 0.2, 0, 0.27, 0.2, 0.27);
    for (let i = 0; i < 9; i++) { const a = i * 2.4 + 1; b.lo('#3b7a2b', Math.sin(a) * 0.25, 0.25 + (i % 5) * 0.17, Math.cos(a) * 0.25 - 0.02, 0.05); }
    for (const s of [-1, 1]) { b.sph('#ffffff', s * 0.11, 0.84, 0.22, 0.1, 0.11, 0.06); b.sph(INK, s * 0.1, 0.83, 0.27, 0.045, 0.05, 0.03); b.box(INK, s * 0.11, 0.98, 0.25, 0.18, 0.04, 0.04, 0, 0, s * -0.5); b.cyl('#3b7a2b', s * 0.33, 0.62, 0.05, 0.04, 0.3, 0.04, 0, 0, s * 0.9); }
    b.box(INK, 0, 0.66, 0.26, 0.14, 0.05, 0.03); b.cyl('#7bc462', 0, 1.2, 0, 0.05, 0.1, 0.05);
  } }] },
  pombo: { cap: 10, h: 1.1, parts: [
    { build(b) {
      b.sph('#9aa3b5', 0, 0.3, 0, 0.25, 0.23, 0.36); b.sph('#8892a6', 0, 0.52, 0.28, 0.17); b.tor('#63d6a8', 0, 0.42, 0.2, 0.15, 0.15, 0.15, Math.PI / 2 - 0.5);
      b.cone('#ff9f43', 0, 0.5, 0.47, 0.05, 0.14, 0.05, Math.PI / 2); b.box(INK, 0, 0.56, 0.37, 0.32, 0.09, 0.14);
      for (const s of [-1, 1]) { b.sph('#ffffff', s * 0.08, 0.56, 0.44, 0.04); b.cyl('#ff9f43', s * 0.1, 0.06, 0.02, 0.025, 0.14, 0.025); }
      b.box('#6f7890', 0, 0.3, -0.42, 0.2, 0.05, 0.24, 0.2);
    } },
    { build(b) { b.box('#7d869c', 0.3, 0, 0, 0.58, 0.05, 0.3); b.box('#5f6880', 0.5, 0, -0.04, 0.2, 0.052, 0.22); }, at(e, o) { o.x = 0.16; o.y = 0.4; o.rz = e.z > 4 ? Math.sin(e.t * 22) * 0.75 : -1.25; } },
    { build: null, share: 1, at(e, o) { o.x = -0.16; o.y = 0.4; o.ry = Math.PI; o.rz = e.z > 4 ? Math.sin(e.t * 22) * 0.75 : -1.25; } },
    { build(b) { b.sph('#c9a27e', 0, 0, 0, 0.17, 0.2, 0.17); b.cone('#c9a27e', 0, 0.22, 0, 0.1, 0.12, 0.1, Math.PI); b.box('#ffd23f', 0, 0.02, 0.17, 0.1, 0.1, 0.02); }, at(e, o) { if (!e.carry) return false; o.y = 0.02; o.z = 0.1; } },
  ] },
  rato: { cap: 10, h: 1.0, parts: [
    { build(b) {
      b.sph('#8d8f9c', 0, 0.3, -0.02, 0.21, 0.24, 0.28); b.sph('#9a9cab', 0, 0.52, 0.2, 0.19, 0.18, 0.19); b.cone('#b9bbc8', 0, 0.48, 0.4, 0.08, 0.16, 0.08, Math.PI / 2); b.lo('#ff7ac0', 0, 0.48, 0.49, 0.035);
      b.box('#e01e37', 0, 0.58, 0.19, 0.4, 0.07, 0.4); b.box('#e01e37', 0.12, 0.56, -0.08, 0.05, 0.05, 0.3, 0.4); b.box('#e01e37', -0.06, 0.52, -0.1, 0.05, 0.05, 0.26, 0.7);
      for (const s of [-1, 1]) { b.lo('#8d8f9c', s * 0.17, 0.72, 0.14, 0.12, 0.12, 0.05); b.lo('#f4a9b8', s * 0.17, 0.72, 0.165, 0.08, 0.08, 0.03); b.box('#ffffff', s * 0.09, 0.585, 0.385, 0.08, 0.03, 0.02); b.sph('#8d8f9c', s * 0.2, 0.34, 0.16, 0.06, 0.06, 0.12); b.sph('#8d8f9c', s * 0.12, 0.08, 0, 0.07, 0.08, 0.1); }
      b.cyl('#f4a9b8', 0, 0.2, -0.4, 0.025, 0.4, 0.025, 1.2);
    } },
    { build(b) { b.cyl('#ffd23f', 0, 0, 0, 0.11, 0.05, 0.11); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; b.cone('#ffb347', Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15, 0.06, 0.16, 0.025, Math.PI / 2, 0, -a); } }, at(e, o) { if (!e.carry) return false; o.x = 0.26; o.y = 0.42 + (e.throwT > 0 ? 0.25 : 0); o.z = 0.2; o.ry = e.t * 6; o.rx = 0.5; } },
  ] },
  robo: { cap: 6, h: 1.7, parts: [{ build(b) {
    b.box('#e9f6ff', 0, 0.62, 0, 0.72, 0.7, 0.6); b.box('#bfe9ff', 0, 1.14, 0, 0.5, 0.3, 0.44); b.cyl('#4cc9f0', 0, 0.68, -0.4, 0.2, 0.62, 0.2); b.lo('#ffffff', 0.08, 1.04, -0.4, 0.09); b.lo('#ffffff', -0.07, 1.12, -0.42, 0.06);
    for (const s of [-1, 1]) { b.lo('#ff4fb8', s * 0.12, 1.16, 0.23, 0.07); b.cyl('#2a2f45', s * 0.4, 0.18, 0, 0.18, 0.1, 0.18, 0, 0, Math.PI / 2); }
    b.box(INK, 0, 1.06, 0.225, 0.2, 0.03, 0.02); b.cyl('#8a90ad', 0, 1.36, 0, 0.02, 0.18, 0.02); b.lo('#ffd23f', 0, 1.47, 0, 0.05);
    b.cyl('#8a90ad', 0.44, 0.78, 0.26, 0.06, 0.6, 0.06, Math.PI / 2); b.cyl('#c0c7d1', 0.44, 0.78, 0.6, 0.17, 0.08, 0.17, Math.PI / 2); b.box('#2de2e6', 0, 0.62, 0.31, 0.4, 0.3, 0.02);
  } }] },
  aspirador: { cap: 5, h: 1.6, parts: [{ build(b) {
    b.sph('#6a3fb8', 0, 0.56, -0.1, 0.6, 0.5, 0.72); b.tor('#ff4fb8', 0, 0.56, -0.1, 0.6, 0.5, 0.72, Math.PI / 2); b.sph('#ff7ac0', 0, 0.62, -0.72, 0.3, 0.32, 0.26);
    b.box('#2a1048', 0, 0.3, 0.62, 0.74, 0.3, 0.3); b.box('#12041f', 0, 0.3, 0.775, 0.6, 0.18, 0.02);
    for (let i = 0; i < 5; i++) { b.cone('#ffffff', -0.26 + i * 0.13, 0.4, 0.76, 0.045, 0.12, 0.045, Math.PI); b.cone('#ffffff', -0.2 + i * 0.13, 0.2, 0.76, 0.045, 0.12, 0.045); }
    for (const s of [-1, 1]) { b.sph('#ffffff', s * 0.22, 0.98, 0.3, 0.17); b.sph(INK, s * 0.2, 0.98, 0.43, 0.08); b.box(INK, s * 0.22, 1.17, 0.36, 0.3, 0.06, 0.06, 0, 0, s * -0.45); b.cyl('#17101c', s * 0.56, 0.2, -0.2, 0.2, 0.1, 0.2, 0, 0, Math.PI / 2); }
    b.cyl('#8a90ad', 0, 1.0, -0.3, 0.07, 0.5, 0.07, -0.7);
  } }] },
};
const SHOTS = {
  star: b => { b.cyl('#ffd23f', 0, 0, 0, 0.13, 0.05, 0.13); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; b.cone('#ffb347', Math.sin(a) * 0.17, 0, Math.cos(a) * 0.17, 0.07, 0.18, 0.03, Math.PI / 2, 0, -a); } },
  water: b => { b.sph('#6fd3ff', 0, 0, 0, 0.12, 0.12, 0.18); b.lo('#e9fbff', 0.03, 0.04, 0.04, 0.05); },
};
const PICKS = {
  gift: b => { b.box('#e01e37', 0, 0.22, 0, 0.42, 0.42, 0.42); b.box('#ffd23f', 0, 0.22, 0, 0.44, 0.1, 0.44); b.box('#ffd23f', 0, 0.22, 0, 0.1, 0.44, 0.44); b.lo('#ffd23f', -0.08, 0.5, 0, 0.1, 0.07, 0.06); b.lo('#ffd23f', 0.08, 0.5, 0, 0.1, 0.07, 0.06); },
  ornament: b => { b.sph('#ff4fb8', 0, 0.3, 0, 0.22); b.cyl('#ffd23f', 0, 0.54, 0, 0.07, 0.08, 0.07); b.tor('#ffd23f', 0, 0.62, 0, 0.05, 0.05, 0.05); b.lo('#ffffff', 0.08, 0.38, 0.14, 0.05); },
  star: b => { b.cyl('#ffd23f', 0, 0.35, 0, 0.14, 0.08, 0.14, Math.PI / 2); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; b.cone('#ffe680', Math.sin(a) * 0.2, 0.35 + Math.cos(a) * 0.2, 0, 0.08, 0.24, 0.04, 0, 0, -a); } },
};
let gx = null; // { inst: {type: [InstancedMesh per part]}, shots, picks, temps }
function ensureGfx(gfx) {
  if (gx) return gx;
  const TH = gfx.THREE, scene = VP.R3.three.scene;
  const mk = (build, cap) => { const b = new gfx.GB(); build(b); const m = new TH.InstancedMesh(b.geo(), gfx.MAT.lit, cap); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
  gx = { inst: {}, shots: {}, picks: {}, m1: new TH.Matrix4(), m2: new TH.Matrix4(), m3: new TH.Matrix4(), q: new TH.Quaternion(), e: new TH.Euler(), p: new TH.Vector3(), s: new TH.Vector3(), o: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 } };
  for (const type in MODELS) { const M = MODELS[type], arr = []; let last = null; for (const part of M.parts) { let m; if (part.share && last) { m = new TH.InstancedMesh(last.geometry, gfx.MAT.lit, M.cap); m.frustumCulled = false; m.count = 0; scene.add(m); } else m = mk(part.build, M.cap); last = m; arr.push(m); } gx.inst[type] = arr; }
  for (const k in SHOTS) gx.shots[k] = mk(SHOTS[k], E.DATA ? E.DATA.cap.shots : 48);
  for (const k in PICKS) gx.picks[k] = mk(PICKS[k], 24);
  E.gx = gx; return gx;
}
function compose(g, m, x, y, z, rx, ry, rz, sx, sy, sz) { g.e.set(rx, ry, rz, 'YXZ'); g.q.setFromEuler(g.e); m.compose(g.p.set(x, y, z), g.q, g.s.set(sx, sy, sz)); return m; }
E.render = function (G, dt, gfx) {
  if (!G.foes || !gfx) return; const g = ensureGfx(gfx), a = G.cats[G.active], near = 1500 * 1500, cnt = {};
  for (const type in g.inst) cnt[type] = g.inst[type].map(() => 0);
  for (const e of G.foes) {
    if (e.dead || U.d2(e.x, e.y, a.x, a.y) > near) continue;
    const M = MODELS[e.type], arr = g.inst[e.type]; if (!arr || cnt[e.type][0] >= M.cap) continue;
    const gy = gfx.hAt(e.x, e.y), x = e.x * S3, zz = e.y * S3, sc = e.r / 10 * (e.type === 'pulga' ? 1.5 : 1.15);
    let y = gy + e.z * S3, rz = 0, rx = 0, sq = e.squash * 0.25;
    if (e.walk && !e.fly && e.type !== 'pulga') y += Math.abs(Math.sin(e.t * 12)) * 0.07;
    if (e.stun > 0) rz = Math.sin(e.t * 9) * 0.3;
    if (e.type === 'aspirador') { if (e.suck) sq += Math.sin(e.t * 30) * 0.05; if (e.broken) rz += 0.25; }
    if (e.type === 'pepino') { rz += e.state === 'giggle' ? Math.sin(e.t * 26) * 0.2 : (e.watched ? 0 : Math.sin(e.t * 7) * 0.06); if (e.state === 'giggle') y += Math.abs(Math.sin(e.t * 13)) * 0.25; }
    if (e.type === 'robo' && e.wind > 0) rx = -0.12;
    if (e.fly && e.z > 4) rx = e.state === 'swoop' ? 0.5 : 0.1;
    compose(g, g.m1, x, y, zz, rx, Math.PI / 2 - e.a, rz, sc * (1 + sq), sc * (1 - sq), sc * (1 + sq));
    for (let i = 0; i < M.parts.length; i++) {
      const part = M.parts[i], n = cnt[e.type][i];
      if (part.at) { const o = g.o; o.x = o.y = o.z = o.rx = o.ry = o.rz = 0; if (part.at(e, o) === false) continue; compose(g, g.m2, o.x, o.y, o.z, o.rx, o.ry, o.rz, 1, 1, 1); g.m3.multiplyMatrices(g.m1, g.m2); arr[i].setMatrixAt(n, g.m3); }
      else arr[i].setMatrixAt(n, g.m1);
      cnt[e.type][i] = n + 1;
    }
    if (e.type !== 'pulga' || cnt.pulga[0] < 7) gfx.shadow(x, zz, gy, e.r * S3 * 1.1, e.r * S3 * 1.1);
    if (e.flash > 0) gfx.glow(x, y + M.h * 0.5 * sc, zz, '#ffffff', 4.5);
    if (e.type === 'robo' && (e.wind > 0 || e.spray > 0)) gfx.glow(x, y + 1.1, zz, e.spray > 0 ? '#6fd3ff' : '#ff3355', 4);
    if (e.type === 'aspirador' && e.suck) gfx.glow(x + Math.cos(e.a) * 0.8, y + 0.4, zz + Math.sin(e.a) * 0.8, '#b967ff', 4 + Math.sin(e.t * 20));
    if (e.carry && e.carry.k !== 'cheese') gfx.glow(x, y + 0.2, zz, '#ffd23f', 3.5);
  }
  for (const type in g.inst) g.inst[type].forEach((m, i) => { m.count = cnt[type][i]; m.instanceMatrix.needsUpdate = true; });
  const sc = { star: 0, water: 0 };
  for (const s of G.fshots) { const m = g.shots[s.k]; if (!m) continue; compose(g, g.m1, s.x * S3, gfx.hAt(s.x, s.y) + 0.7, (s.y + 12) * S3, s.k === 'star' ? 0.4 : 0, s.k === 'star' ? s.t * 14 : Math.PI / 2 - Math.atan2(s.vy, s.vx), 0, 1.25, 1.25, 1.25); m.setMatrixAt(sc[s.k]++, g.m1); }
  for (const k in g.shots) { g.shots[k].count = sc[k]; g.shots[k].instanceMatrix.needsUpdate = true; }
  const pc = {}; for (const k in g.picks) pc[k] = 0;
  if (G.picks) for (const p of G.picks) { const m = g.picks[p.k]; if (!m || p.taken || pc[p.k] >= 24 || U.d2(p.x, p.y, a.x, a.y) > near) continue; const px = p.x * S3, pz = p.y * S3, py = gfx.hAt(p.x, p.y) + (p.h || 0) + 0.15 + Math.sin(p.t * 3) * 0.1; compose(g, g.m1, px, py, pz, 0, p.t * 1.8, 0, p.s || 1.2, p.s || 1.2, p.s || 1.2); m.setMatrixAt(pc[p.k]++, g.m1); if (!p.locked) gfx.glow(px, py + 0.3, pz, p.col || '#ffd23f', 3.5); }
  for (const k in g.picks) { g.picks[k].count = pc[k]; g.picks[k].instanceMatrix.needsUpdate = true; }
};
Ext.render.push(E.render);

// ---------- HUD: health bars, what they carry, the "mash!" prompt, status of the leading cat ----------
E.hud = function (G, H) {
  if (!G.foes) return; const a = G.cats[G.active], k = H.k, St = G.foeS;
  for (const e of G.foes) {
    if (e.dead || e.gone || Math.abs(e.x - a.x) > 900 || Math.abs(e.y - a.y) > 900) continue;
    if (e.isBoss) continue;
    const p = H.R3.project(e.x, e.y, MODELS[e.type].h * (e.r / 10) * 1.15 + 0.3 + e.z * S3); if (!p.on) continue;
    if (e.carry) H.txt(e.carry.k === 'cheese' ? '🧀' : e.carry.k === 'gift' ? '🎁' : e.carry.k === 'snack' ? '🐟' : '💰', p.x, p.y - 13 * k, 15 * k, '#fff', 'center', false);
    if (e.hp < e.max) H.bar(p.x - 15 * k, p.y, 30 * k, 5 * k, e.hp / e.max, '#ff4f5e');
    if (e.armor > 0) H.bar(p.x - 15 * k, p.y + 5 * k, 30 * k, 4 * k, e.armor / e.maxArmor, '#c0c7d1');
    if (e.rest > 0) H.txt('💤', p.x + 16 * k, p.y - 12 * k, 13 * k, '#fff', 'center', false);
    if (e.type === 'pepino' && e.watched) H.txt('👀', p.x, p.y - 12 * k, 13 * k, '#fff', 'center', false);
  }
  const d = a.fdeb, b = buffNow(), tags = [];
  if (d && d.itch > 0) tags.push('🦟 ' + tr('f_sItch')); if (d && d.wet > 0) tags.push('💦 ' + tr('f_sWet')); if (b) tags.push('🩺 ' + tr('f_sHealthy'));
  if (tags.length && !G.car) { const p = H.R3.project(a.x, a.y, 2.5); if (p.on) H.txt(tags.join('  '), p.x, p.y - 4 * k, 11 * k, '#fff'); }
  if (St && St.hold && St.hold.cat === a) {
    const w = H.w, h = H.h, f = Math.min(1, St.hold.n / St.hold.foe.d.params.mash), bw = Math.min(260 * k, w - 60 * k);
    H.txt('🌀 ' + tr(I.touch ? 'f_mash' : 'f_mashK'), w / 2, h * 0.34, (20 + Math.sin(H.t * 16) * 2) * k, '#ffd23f');
    H.bar(w / 2 - bw / 2, h * 0.34 + 20 * k, bw, 10 * k, f, '#7CFF6B');
  }
};
Ext.hud.push(E.hud);

// ---------- missions (types registered next to the existing ones; data in missions_enemies.json) ----------
function regTypes() {
  const M = VP.Missions, TY = M._.TYPES, arenaStuff = M._.arenaStuff;
  const label = list => list.map(([t, n]) => (n > 1 ? n + '× ' : '') + E.name(t)).join(' + ');
  // nearest enemy of a set (objective marker + the bot's target). Flyers are marked as "shoot from afar".
  const nearest = (G, ok) => { const a = G.cats[G.active]; let b = null, bd = 1e12; for (const e of G.foes) { if (e.dead || e.gone || !ok(e)) continue; const d = U.d2(e.x, e.y, a.x, a.y); if (d < bd) { bd = d; b = e; } } return b; };
  const mark = e => (e ? { x: e.x, y: e.y, shoot: e.z > 26 || e.type === 'pepino' || undefined, foe: e } : null);
  const fightStep = (B, o) => { const G = B.G, st = Object.assign({ act: 'attack', foeFight: true, at() { return mark(nearest(G, o.ok)); } }, o); if (!o.cat) Object.defineProperty(st, 'cat', { get() { const e = nearest(G, o.ok); return e ? E.HINT[e.type] : null; }, enumerable: true }); return B.step(st); };
  const quiet = G => { G.noPolice = true; G.noHeat = true; };

  TY.foe_hunt = { setup(B) {
    const p = B.p, G = B.G; state(G);
    B.begin(B.front('arena', 's'), { traffic: 6 }); quiet(G);
    const spots = p.spots || 2, total = spots * p.foes.reduce((s, f) => s + f[1], 0);
    for (let s = 0; s < spots; s++) {
      const pt = B.farPoint(330 + s * 260, 700 + s * 380), tag = 'h' + s, n = p.foes.reduce((a2, f) => a2 + f[1], 0);
      for (const [type, cnt] of p.foes) E.group(G, type, pt, { n: cnt, lv: B.m.lv, tag, force: true, spread: 90 });
      fightStep(B, { txt: 'o_foe_clear', args: [label(p.foes)], cat: p.cat, ok: e => e.tag === tag, done: () => E.alive(G, tag) === 0, prog: () => [s * n + n - E.alive(G, tag), total] });
    }
  } };
  TY.foe_waves = { setup(B) {
    const p = B.p, G = B.G, A = B.R('arena'); state(G);
    B.begin({ x: A.cx, y: A.cy }, { traffic: 0 }); arenaStuff(B); quiet(G);
    p.waves.forEach((w, i) => {
      B.wait(i ? 2.2 : 1.5, 'o_waveIn', [i + 1, p.waves.length]);
      fightStep(B, { txt: 'o_foe_wave', args: [i + 1, p.waves.length], fight: true, ok: e => e.tag === 'w',
        enter() { this.total = w.length; for (const t of w) { const q = Game.spawnPoint(260, 430) || Game.spawnPoint(200, 600) || { x: A.cx, y: A.cy - 200 }; const e = E.spawn(G, t, q.x, q.y, { lv: B.m.lv, tag: 'w', state: 'act', force: true }); if (e) e.aggro = 2000; } sfx('alarm'); },
        done() { return E.alive(G, 'w') === 0; }, prog() { return [this.total - E.alive(G, 'w'), this.total]; } });
    });
  } };
  TY.foe_recover = { setup(B) {
    const p = B.p, G = B.G, St = state(G), loot = p.loot || 'cash', type = loot === 'cheese' ? 'rato' : 'pombo', key = loot === 'cheese' ? 'cheese' : 'recovered';
    B.begin(B.front('arena', 's'), { traffic: 6 }); quiet(G);
    const live = Math.min(3, p.n), carry = () => (loot === 'cheese' ? undefined : { k: loot, n: loot === 'cash' ? 30 : 1 });
    const add = () => { const q = Game.spawnPoint(300, 620) || B.farPoint(250, 800); const e = E.spawn(G, type, q.x, q.y, { lv: B.m.lv, tag: 'r', force: true, carry: carry(), state: type === 'rato' ? 'act' : undefined }); if (e) e.aggro = 2000; return e; };
    fightStep(B, { txt: 'o_foe_' + loot, cat: loot === 'cheese' ? 'morticia' : undefined, ok: e => e.tag === 'r' && !!e.carry,
      enter() { for (let i = 0; i < live; i++) add(); }, t: 0,
      tick(dt) { this.t += dt; if (this.t > 1) { this.t = 0; let n = 0; for (const e of G.foes) if (e.tag === 'r' && !e.dead && !e.gone && e.carry) n++; if (n < Math.min(live, p.n - St.stat[key])) add(); } },
      done: () => St.stat[key] >= p.n, prog: () => [Math.min(p.n, St.stat[key]), p.n] });
    if (p.time) G.mtimer = p.time;
  } };
  TY.foe_survive = { setup(B) {
    const p = B.p, G = B.G; state(G);
    const A = B.R('plaza2') || B.R('arena'), pt = B.W.front(A, 'n'); B.begin(pt, { traffic: 4 }); quiet(G);
    const add = t => { const q = Game.spawnPoint(260, 460) || B.farPoint(200, 600); const e = E.spawn(G, t, q.x, q.y, { lv: B.m.lv, tag: 's', state: 'act', force: true }); if (e) e.aggro = 2000; };
    B.wait(1.5, 'o_ready');
    B.step({ txt: 'o_foe_survive', t: 0, rt: 0, roam: true, foeFight: true, enter() { for (const t of p.foes) add(t); sfx('alarm'); },
      tick(dt) { this.t += dt; this.rt += dt; if (this.rt > 4) { this.rt = 0; if (E.alive(G, 's') < p.foes.length) add(p.foes[(Math.random() * p.foes.length) | 0]); } },
      done() { return this.t >= p.time; }, prog() { return [Math.floor(this.t), p.time]; }, at: () => null,
      exit() { for (const e of G.foes) if (e.tag === 's') E.defeat(G, e, 'time', true); } });
  } };
  TY.foe_boss = { setup(B) {
    const G = B.G, A = B.R('arena'); state(G);
    B.begin({ x: A.cx, y: A.cy + 150 }, { traffic: 0 }); arenaStuff(B); quiet(G);
    const boss = VP.Boss.start(G, B.p.boss || 'carrocinha', { x: A.cx, y: A.cy - 130, lv: B.m.lv, arena: { x0: (A.tx - 2) * T, y0: (A.ty - 2) * T, x1: (A.tx + 10) * T, y1: (A.ty + 10) * T } });
    fightStep(B, { txt: 'o_boss', args: [E.name(boss.type)], fight: true, boss: true, ok: e => e.tag === 'bossMinion',
      at() { const e = nearest(G, x => x.tag === 'bossMinion'); return e && boss.shield ? mark(e) : { x: boss.x, y: boss.y, kind: 'dog', r: boss.r }; }, done: () => boss.done });
  } };
}

// ---------- boot ----------
E.load = function () {
  return Ext.json('data/enemies.json').then(d => { E.DATA = d; return new Promise(res => Ext.whenData(res)); })
    .then(() => { regTypes(); E.ready = true; return Ext.json('data/missions_enemies.json'); })
    .then(d => Promise.resolve(VP.Clinic && VP.Clinic.whenLoaded).then(() => d)) // clinic_visit must be registered first
    .then(d => { E.missions = Ext.addMissions(d); E.loaded = true; if (VP.UI.screen === 'map') VP.UI.relabel(); })
    .catch(e => { console.warn('[enemies] not loaded', e); E.loaded = true; });
};
E.whenLoaded = E.load();
// test/dev helper: __vp.VP.Enemies.debugSpawn('rato', 3)
E.debugSpawn = function (type, n) { const G = Game.G; if (!G) return []; const a = G.cats[G.active]; return E.group(G, type, { x: a.x, y: a.y - 150 }, { n: n || 1, force: true, state: 'act', spread: 60 }); };
})();
