'use strict';
// VICE PAWS — mission catalogue (50 + bonus districts), builders and objective steps
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, Game = VP.Game, World = VP.World;
const M = VP.Missions = {};

// Content is data-driven: public/data/missions.json + activities.json (see DESIGN.md for the schema).
M.DIST = []; M.list = []; M.side = [];
M.load = function (data, act) {
  M.DIST = data.districts.map(d => Object.assign({}, d));
  for (const d of M.DIST) VP.L['d' + d.id] = [d.name.pt, d.name.en];
  M.list = data.missions.map(r => {
    const d = M.DIST.find(x => r.n >= x.from && r.n <= x.to);
    if (!d) return null;
    return { n: r.n, geo: r.geo === undefined ? d.geo : r.geo, d: d.id, type: r.type, name: [r.name.pt, r.name.en], p: r.params || {}, lv: r.lv || r.n, par: r.par, hunger: (r.params && r.params.hunger) || 1, boss: r.boss || null, bonus: !!d.grant || !!d.arc, arc: !!d.arc, talk: r.talk || null };
  }).filter(m => m && TYPES[m.type]);
  M.act = act || { trials: [], quests: [], pawsPerDistrict: 0 };
  // time trials become side missions (n >= 100)
  M.side = (M.act.trials || []).map((t, i) => ({ n: 100 + i, id: t.id, geo: t.d, d: t.d, type: 'race', name: [t.name.pt, t.name.en], p: { route: t.cps, time: t.time, cps: t.cps.length, start: t.start, reward: t.reward || 100 }, lv: t.lv || 5, par: Math.round(t.time * 0.8), hunger: 1, boss: null, bonus: true, side: true }));
};
M.tourList = [];
M.get = n => M.list.find(m => m.n === n) || M.side.find(m => m.n === n) || M.tourList.find(m => m.n === n);
M.next = n => { const i = M.list.findIndex(m => m.n === n); const nx = M.list[i + 1]; return nx && nx.d === M.list[i].d ? nx : (n === 50 ? null : (nx && n < 50 ? nx : null)); };
M.dist = id => M.DIST.find(d => d.id === id);
// chapters ("arcs") open with total stars and/or after a story mission; inside a chapter missions open one by one
M.distOpen = d => { if (!d) return false; if (d.grant) return !!(VP.Shop && VP.Shop.has(d.grant)); const r = d.req || {}; return (!r.stars || VP.totalStars() >= r.stars) && (!r.after || !!VP.S.stars[r.after]); };
M.unlocked = m => {
  if (m.side || M.allOpen) return true;
  if (!m.bonus) return m.n <= VP.S.unlocked;
  const d = M.dist(m.d);
  if (!M.distOpen(d)) return false;
  return m.n === d.from || !!VP.S.stars[m.n - 1] || !!VP.S.stars[m.n];
};
M.par = m => m.par || (m.p.time ? Math.round(m.p.time * 0.72) : 120);

// ---------- builder helpers ----------
function pack(B, n) {
  const lv = B.lv, pool = ['mutt', 'mutt', 'chi'];
  if (lv >= 4) pool.push('cop'); if (lv >= 8) pool.push('shooter'); if (lv >= 9) pool.push('catcher');
  if (lv >= 14) pool.push('heavy'); if (lv >= 25) pool.push('cop', 'shooter'); if (lv >= 35) pool.push('heavy', 'catcher');
  const out = []; for (let i = 0; i < n; i++) out.push(B.rng.pick(pool)); return out;
}
const gsize = B => 3 + Math.floor(B.lv / 14);
function mk(B) {
  const W = B.W, G = B.G;
  B.steps = [];
  const D = B.D = World.DREG.find(r => r.d === B.geo);
  B.cols = D.cw; B.rows = D.rh;
  B.R = role => W.roles[B.geo][role];
  B.front = (role, side) => W.front(B.R(role), side);
  B.corner = (c, r, side) => W.front(W.lot(D.c0 + c, D.r0 + r), side);
  B.ix = (i, j, ox, oy) => ({ x: W.RX[D.c0 + i] + (ox || 0), y: W.RY[D.r0 + j] + (oy || 0) });
  B.rw = () => W.randWalkD(B.geo, B.rng);
  B.begin = (pt, pop) => { Game.addCats(pt.x, pt.y); Game.populate(pop || {}); G.fieldT = 0; B.startPt = pt; };
  B.dogs = (pt, types, o) => {
    const out = [];
    for (const t of types) {
      let p = null;
      for (let i = 0; i < 12 && !p; i++) { const a = B.rng() * 6.283, d = 20 + B.rng() * (o && o.spread || 70), x = pt.x + Math.cos(a) * d, y = pt.y + Math.sin(a) * d; if (!W.blocked(x, y, 16, 0)) p = { x, y }; }
      if (!p) p = pt;
      out.push(Game.addDog(t, p.x, p.y, Object.assign({ guard: true, tag: 'g' }, o)));
    }
    return out;
  };
  B.farPoint = (min, max) => { for (let i = 0; i < 60; i++) { const p = B.rw(), d = Math.hypot(p.x - B.startPt.x, p.y - B.startPt.y); if (d > min && (!max || d < max)) return p; } return B.rw(); };
  B.step = s => { B.steps.push(s); return s; };
  B.goto = (pt, txt, o) => B.step(Object.assign({ txt: txt || 'o_goto', at: () => pt, done: () => { const a = G.car || G.cats[G.active]; return U.d2(a.x, a.y, pt.x, pt.y) < 85 * 85 && (!o || !o.car || !!G.car); } }, o));
  B.wave = (list, o) => {
    o = o || {};
    return B.step({
      txt: o.txt || 'o_wave', args: o.args, cat: null, fight: true,
      enter() {
        this.total = list.length;
        for (const t of list) {
          const p = Game.spawnPoint(420, 700) || Game.spawnPoint(300, 900) || B.rw();
          const e = Game.addDog(t, p.x, p.y, { tag: 'w', raid: !!o.raid }); e.hunt = true; e.state = 'chase';
        }
        VP.Audio.sfx('alarm');
      },
      left() { let n = 0; for (const e of G.dogs) if (e.tag === 'w' && !e.dead) n++; return n; },
      done() { return this.left() === 0; },
      prog() { return [this.total - this.left(), this.total]; },
      at() { let b = null, bd = 1e12; const a = G.cats[G.active]; for (const e of G.dogs) if (e.tag === 'w' && !e.dead) { const d = U.d2(e.x, e.y, a.x, a.y); if (d < bd) { bd = d; b = e; } } return o.hold || b; },
    });
  };
  B.wait = (sec, txt, args) => B.step({ txt: txt || 'o_ready', args, t: 0, tick(dt) { this.t += dt; }, done() { return this.t >= sec; }, at: () => null });
  B.propOf = (lot, k) => G.props.find(p => p.k === k && p.lot === lot);
  B.wantedOn = w => { G.minWanted = w; G.heat = Math.max(G.heat, w); };
  B.getaway = () => (VP.Shop && VP.Shop.skin('car')) ? 'gold' : 'pink';
  return B;
}
const GATE_CAT = { fence: 'mimosa', switch: 'mimo', gap: 'morticia', key: null, open: null };
const GATE_TXT = { fence: 'o_gateFence', switch: 'o_gateSwitch', gap: 'o_gateGap', key: 'o_gateKey' };
// adds the "open this compound" steps; returns the gate prop
function gateSteps(B, lot, gate) {
  const G = B.G;
  if (gate === 'open') return null;
  if (gate === 'key') {
    const kp = B.farPoint(380, 900);
    const holder = B.dogs(kp, [B.lv >= 30 ? 'heavy' : 'cop'], { carry: 'key' })[0];
    B.dogs(kp, pack(B, gsize(B) - 1));
    B.step({ txt: 'o_getKey', cat: 'morticia', act: 'attack', at: () => holder.dead ? G.items.find(i => i.k === 'key') || null : holder, done: () => G.keys > 0 || !!(B.propOf(lot, 'sdoor') || {}).done });
  }
  const prop = gate === 'fence' ? B.propOf(lot, 'fgate') : gate === 'switch' ? B.propOf(lot, 'laser') : B.propOf(lot, 'sdoor');
  const sw = gate === 'switch' ? G.props.find(p => p.k === 'switch' && p.lot === lot && p.link === prop.id) : null;
  const lever = gate === 'gap' ? G.props.find(p => p.k === 'lever' && p.lot === lot) : null;
  B.step({
    txt: GATE_TXT[gate], cat: GATE_CAT[gate], act: gate === 'fence' || gate === 'switch' ? 'attack' : null, gate, lot, mode: gate === 'gap' ? 1 : 0,
    at: () => gate === 'switch' ? { x: sw.x, y: sw.y - 20, shoot: true } : gate === 'gap' ? lever : { x: lot.gateX, y: lot.gateY },
    done: () => prop.done,
  });
  return prop;
}
function compGuards(B, lot, n, extra) {
  const gap = lot.gate === 'gap', inner = lot.vault ? (gap ? [[3, 6], [4, 6], [6, 5], [6, 6]] : [[1, 3], [6, 4], [3, 6], [4, 1]]) : gap ? [[2, 5], [5, 5], [3, 5], [4, 4]] : [[2, 2], [5, 2], [2, 5], [5, 5], [3, 3]];
  // behind a cat flap only Morticia gets in, so those guards are fewer, lighter and less alert
  const types = pack(B, gap ? Math.max(1, n - 1) : n).map(t => (gap && (t === 'heavy' || t === 'shooter') ? 'mutt' : t)).concat(extra || []);
  types.forEach((t, i) => { const s = inner[i % inner.length]; Game.addDog(t, (lot.tx + s[0] + 0.5) * T, (lot.ty + s[1] + 0.5) * T, { guard: true, tag: 'g', aggro: gap ? 110 : 150 }); });
}

// ---------- mission types ----------
const TYPES = {
  reach: {
    setup(B) {
      const p = B.p, G = B.G, a = B.corner(0, 0, 'w'), b = B.corner(B.cols - 1, B.rows - 1, 'e');
      B.begin(a);
      for (let i = 0; i < p.groups; i++) { const f = (i + 1) / (p.groups + 0.3); let pt = null, bd = 1e12; for (let k = 0; k < 40; k++) { const q = B.rw(), d = U.d2(q.x, q.y, U.lerp(a.x, b.x, f), U.lerp(a.y, b.y, f)); if (d < bd && U.d2(q.x, q.y, a.x, a.y) > 380 * 380) { bd = d; pt = q; } } if (pt) B.dogs(pt, pack(B, gsize(B))); }
      if (p.tut) { B.step({ txt: 'o_tutSwitch', at: () => null, seen: {}, tick() { this.seen[G.active] = 1; }, done() { return this.seen[0] && this.seen[1] && this.seen[2]; } }); }
      const guards = B.dogs({ x: b.x - 60, y: b.y }, pack(B, gsize(B)));
      B.goto(b, 'o_reach');
      B.step({ txt: 'o_clear', fight: true, at: () => guards.find(e => !e.dead) || null, done: () => guards.every(e => e.dead), prog: () => [guards.filter(e => e.dead).length, guards.length] });
      if (p.time) G.mtimer = p.time;
    },
  },
  waves: {
    setup(B) {
      const p = B.p, A = B.R('arena');
      B.begin(p.arena ? { x: A.cx, y: A.cy } : B.ix(2, 2), p.arena ? { traffic: 0 } : {});
      if (p.arena) arenaStuff(B);
      const waves = Array.isArray(p.waves) ? p.waves : Array.from({ length: p.waves }, (_, i) => pack(B, Math.min(10, Math.round(4 + i * 1.3 + B.lv / 14))));
      B.G.noPolice = true; B.G.noHeat = true;
      waves.forEach((w, i) => { B.wait(i ? 2.2 : 1.5, 'o_waveIn', [i + 1, waves.length]); B.wave(w, { args: [i + 1, waves.length] }); });
    },
  },
  eat: {
    setup(B) {
      const p = B.p, G = B.G;
      B.begin(B.front('arena', 's'));
      for (const c of ['plaza1', 'plaza2', 'plaza3']) B.dogs(B.front(c, 'n'), pack(B, gsize(B) - 1), { carry: B.rng.pick(['bone', 'steak', 'donut']) });
      G.mtimer = p.time; G.restock = 9;
      B.step({ txt: 'o_eat', args: [p.n], cat: 'morticia', act: 'attack', eat: true, at: () => nearestFood(G), done: () => G.stat.eaten >= p.n, prog: () => [Math.min(p.n, G.stat.eaten), p.n] });
    },
  },
  steal: {
    setup(B) {
      const p = B.p, G = B.G;
      B.begin(B.front('arena', 's'));
      const carriers = [];
      for (let i = 0; i < p.n + 3; i++) { const pt = B.farPoint(300); const t = B.rng.pick(B.lv > 30 ? ['cop', 'shooter', 'catcher', 'heavy', 'mutt'] : ['mutt', 'cop', 'mutt', 'shooter']); const e = Game.addDog(t, pt.x, pt.y, { guard: true, tag: 'g', aggro: 190, carry: t === 'shooter' ? 'ammo' : t === 'catcher' ? 'net' : B.rng.pick(['bone', 'donut', 'steak', 'sushi', 'hotdog']) }); carriers.push(e); }
      G.mtimer = p.time;
      B.step({ txt: 'o_steal', args: [p.n], cat: 'morticia', act: 'attack', at: () => { let b = null, bd = 1e12; const a = G.cats[G.active]; for (const e of G.dogs) if (!e.dead && e.carry) { const d = U.d2(e.x, e.y, a.x, a.y); if (d < bd) { bd = d; b = e; } } return b; }, done: () => G.stat.stolen >= p.n, prog: () => [Math.min(p.n, G.stat.stolen), p.n],
        tick() { if (!G.dogs.some(e => !e.dead && e.carry)) { const pt = Game.spawnPoint(300, 700) || B.rw(); Game.addDog('mutt', pt.x, pt.y, { guard: true, tag: 'g', carry: 'bone' }); } } });
    },
  },
  cash: {
    setup(B) {
      const p = B.p, G = B.G, W = B.W;
      B.begin(B.front('arena', 's'));
      for (let i = 0; i < 26; i++) { const q = B.rw(), tx = Math.floor(q.x / T), ty = Math.floor(q.y / T); const onWalk = W.gnd[ty * W.W + tx] === 2; if (onWalk && W.grid[ty * W.W + tx] === 0 && U.d2(q.x, q.y, B.startPt.x, B.startPt.y) > 120 * 120 && !G.props.some(o => o.tx === tx && o.ty === ty)) Game.addProp({ k: 'crate', tx, ty }); }
      for (let i = 0; i < 6; i++) B.dogs(B.farPoint(320), pack(B, gsize(B)));
      G.mtimer = p.time; G.fieldT = 0;
      B.step({ txt: 'o_cash', args: [p.cash], fight: true, smash: true, at: () => nearestLoot(G), done: () => G.stat.cash >= p.cash, prog: () => [Math.min(p.cash, G.stat.cash), p.cash] });
    },
  },
  rescue: {
    plan(B) { B.p.cages.forEach((c, i) => { B.comps['comp' + 'ACBD'[i]] = { gate: c[0] }; }); },
    setup(B) {
      const p = B.p, G = B.G;
      const start = B.front('arena', 's');
      B.begin(start); G.noHeat = true;
      p.cages.forEach((c, i) => {
        const lot = B.R('comp' + 'ACBD'[i]), gate = c[0], lock = c[1];
        const gp = gate === 'fence' ? B.propOf(lot, 'fgate') : gate === 'switch' ? B.propOf(lot, 'laser') : gate === 'open' ? null : B.propOf(lot, 'sdoor');
        const cage = Game.addProp({ k: 'cage', x: lot.cx, y: lot.cy - 10, friend: 'f' + (i % 4), lock: lock === 'link' ? 'bolt' : lock, link: lock === 'link' ? gp.id : null, lot });
        compGuards(B, lot, Math.min(3, Math.max(1, gsize(B) - 1)));
        gateSteps(B, lot, gate);
        if (lock === 'key') {
          const holder = B.dogs(B.farPoint(350, 1000), ['cop'], { carry: 'key' })[0];
          B.step({ txt: 'o_getKey', cat: 'morticia', act: 'attack', at: () => cage.done ? null : holder.dead ? G.items.find(k => k.k === 'key') || null : holder, done: () => G.keys > 0 || cage.done });
        }
        B.step({ txt: lock === 'bite' ? 'o_cageBite' : 'o_cage', cat: lock === 'bite' ? 'mimosa' : null, act: lock === 'bite' ? 'attack' : null, at: () => ({ x: cage.x, y: cage.y + 30 }), done: () => cage.done, prog: () => [G.stat.freed, p.cages.length] });
      });
      B.step({ txt: 'o_ambush', enter() { B.wantedOn(Math.min(3, 1 + Math.floor(B.lv / 15))); }, done: () => true, at: () => null });
      B.goto(start, 'o_escort');
    },
  },
  truck: {
    plan(B) { B.comps.compA = { gate: B.p.gate }; },
    setup(B) {
      const p = B.p, G = B.G, lot = B.R('compA');
      B.begin(B.front('arena', 's')); G.noHeat = true;
      const truck = Game.addCar('truck', lot.cx, lot.cy - 30, Math.PI / 2, { locked: true }); truck.hp = truck.max = 420;
      compGuards(B, lot, gsize(B), p.heavy ? ['heavy'] : []);
      B.dogs({ x: lot.frontX + 120, y: lot.frontY + 30 }, pack(B, 1));
      const gp = gateSteps(B, lot, p.gate);
      const hl = B.W.roles[0].house, dest = { x: hl.cx + 60, y: (hl.ty + 9.6) * T };
      B.step({ txt: 'o_enterTruck', act: 'ctx', enter() { truck.locked = false; }, tick() { if (gp && gp.done) truck.locked = false; }, at: () => truck, done: () => G.car === truck });
      B.step({ txt: 'o_driveTruck', car: true, enter() { B.wantedOn(p.wanted); }, at: () => dest, done: () => G.car === truck && U.d2(truck.x, truck.y, dest.x, dest.y) < 110 * 110, fail: () => truck.dead ? 'truck' : null });
      B.step({ txt: 'o_done', enter() { G.minWanted = 0; G.heat = 0; G.noPolice = true; }, done: () => true, at: () => null });
    },
  },
  vault: {
    plan(B) { B.comps.compC = { gate: B.p.gate, vault: true }; },
    setup(B) {
      const p = B.p, G = B.G, lot = B.R('compC'), start = B.front('arena', 's');
      B.begin(start); G.noHeat = true;
      compGuards(B, lot, gsize(B) + 1);
      B.dogs({ x: lot.frontX - 100, y: lot.frontY + 40 }, pack(B, 2));
      gateSteps(B, lot, p.gate);
      const vl = B.propOf(lot, 'vlaser'), sw = G.props.find(q => q.k === 'switch' && q.link === vl.id), loot = B.propOf(lot, 'loot');
      B.step({ txt: 'o_vaultSwitch', cat: 'mimo', act: 'attack', at: () => ({ x: sw.x, y: sw.y - 20, shoot: true, from: { x: (lot.tx + 6.5) * T, y: (lot.ty + 4.5) * T } }), done: () => vl.done });
      B.step({ txt: 'o_vaultLoot', cat: 'morticia', act: 'attack', mode: 1, at: () => ({ x: (lot.tx + 3.5) * T, y: (lot.ty + 4.5) * T }), done: () => loot.done });
      B.step({ txt: 'o_ambush', enter() { B.wantedOn(p.wanted); VP.Audio.sfx('alarm'); }, done: () => true, at: () => null });
      B.goto(start, 'o_escape');
      B.step({ txt: 'o_done', enter() { G.minWanted = 0; G.heat = 0; G.noPolice = true; }, done: () => true, at: () => null });
    },
  },
  escape: {
    setup(B) {
      const p = B.p, G = B.G, W = B.W;
      B.begin(B.corner(0, B.rows - 1, 'n'));
      B.wantedOn(p.wanted);
      if (p.survive) B.step({ txt: 'o_survive', t: 0, fight: true, tick(dt) { this.t += dt; }, done() { return this.t >= p.survive; }, prog() { return [Math.floor(this.t), p.survive]; }, at: () => null, roam: true });
      if (p.car) {
        const cp = B.ix(B.cols - 1, B.rows - 1, 48, -120), car = Game.addCar(B.getaway(), cp.x, cp.y, -Math.PI / 2);
        const hl = W.roles[B.geo === 0 ? 2 : 0].house, dest = { x: hl.cx + 60, y: (hl.ty + 9.6) * T };
        B.step({ txt: 'o_enterCar', act: 'ctx', at: () => car, done: () => G.car === car, fail: () => car.dead ? 'car' : null });
        B.step({ txt: 'o_driveSafe', car: true, at: () => dest, done: () => !!G.car && U.d2(G.car.x, G.car.y, dest.x, dest.y) < 110 * 110 });
      } else B.goto(B.corner(B.cols - 1, 0, 's'), 'o_hideout');
      B.step({ txt: 'o_done', enter() { G.minWanted = 0; G.heat = 0; G.noPolice = true; for (const e of G.dogs) if (e.police) { e.state = 'flee'; e.st = 6; } void W; }, done: () => true, at: () => null });
    },
  },
  chase: {
    setup(B) {
      const p = B.p, G = B.G;
      const sp = B.ix(1, B.rows - 1, 60, 48);
      B.begin(sp);
      const car = Game.addCar(B.getaway(), sp.x, sp.y, 0); car.hp = car.max = 260; Game.enterCar(car);
      G.noHeat = true; G.mtimer = p.time;
      const cw = B.cols, rh = B.rows, loops = [[[1, 1], [cw - 1, 1], [cw - 1, rh - 1], [1, rh - 1]], [[0, 0], [cw, 0], [cw, rh], [0, rh]], [[1, 0], [2, 0], [2, rh], [1, rh]]];
      p.targets.forEach((type, i) => {
        const loop = loops[(B.m.n + i) % loops.length], route = loop.map(q => B.ix(q[0], q[1]));
        let tc = null;
        B.step({
          txt: 'o_chase', args: [i + 1, p.targets.length], car: true, ram: true,
          enter() { tc = Game.addCar(type, route[0].x, route[0].y, 0, { ai: 'target', route, wi: 1, drop: p.drop || 0 }); tc.hp = tc.max = tc.max * (4.5 + B.lv * 0.04); tc.top *= 0.82 + Math.min(0.14, B.lv * 0.003); },
          at: () => tc, done: () => !!tc && tc.dead, prog: () => tc ? [Math.round((1 - Math.max(0, tc.hp) / tc.max) * 100), 100] : [0, 100],
          fail: () => (!G.car && car.dead) ? 'car' : null,
        });
      });
    },
  },
  race: {
    setup(B) {
      const p = B.p, G = B.G;
      const sp = p.start ? { x: B.W.RX[p.start[0]] + 60, y: B.W.RY[p.start[1]] + 48 } : B.ix(1, B.rows - 1, 60, 48);
      B.begin(sp);
      const car = Game.addCar(B.getaway(), sp.x, sp.y, 0); Game.enterCar(car);
      G.noHeat = true; G.mtimer = p.time;
      const W = B.W; let i = B.D.c0 + 1, j = B.D.r0 + B.rows - 1;
      for (let k = 0; k < p.cps; k++) {
        let ni = i, nj = j;
        if (p.route) { ni = p.route[k][0]; nj = p.route[k][1]; }
        else
        for (let t = 0; t < 40 && (Math.abs(ni - i) + Math.abs(nj - j) < 2 || Math.abs(ni - i) + Math.abs(nj - j) > 4); t++) { ni = U.clamp(i + B.rng.int(-3, 3), 0, W.cols); nj = U.clamp(j + B.rng.int(-3, 3), 0, W.rows); }
        i = ni; j = nj; const pt = { x: W.RX[i], y: W.RY[j] };
        B.step({ txt: 'o_checkpoint', args: [k + 1, p.cps], car: true, at: () => pt, done: () => !!G.car && U.d2(G.car.x, G.car.y, pt.x, pt.y) < 100 * 100, enter() { if (k) { G.mtimer += 2; VP.Audio.sfx('cash'); G.stat.cash += 40; } }, fail: () => (!G.car && car.dead) ? 'car' : null });
      }
    },
  },
  defend: {
    setup(B) {
      const p = B.p, G = B.G, W = B.W, lot = B.R('house');
      B.begin({ x: lot.cx, y: lot.cy + 90 });
      const h = Game.addProp({ k: 'house', gen: !!p.gen, tree: B.m.d === 6, x: (lot.tx + 4) * T, y: (lot.ty + 3) * T, hp: 900 + B.lv * 30 });
      G.houseField = W.field(h.x, h.y + T * 1.6, 0);
      G.noPolice = true; G.noHeat = true;
      for (let i = 0; i < p.waves; i++) { B.wait(i ? 2.5 : 2, 'o_waveIn', [i + 1, p.waves]); B.wave(pack(B, Math.min(10, Math.round(4 + i * 1.3 + B.lv / 14))), { raid: true, txt: 'o_defend', args: [i + 1, p.waves], hold: { x: h.x, y: h.y + 90 } }); }
    },
  },
  // the "tour" type (real maps) lives in minigames.js
  boss: {
    setup(B) {
      const G = B.G, A = B.R('arena');
      B.begin({ x: A.cx, y: A.cy + 150 }, { traffic: 0 });
      arenaStuff(B);
      G.noPolice = true; G.noHeat = true;
      const boss = Game.addDog(B.m.boss, A.cx, A.cy - 140);
      boss.stun = 2.2;
      B.step({ txt: 'o_boss', args: [VP.t('boss_' + B.m.boss)], fight: true, boss: true, at: () => boss, done: () => !!G.bossDead });
    },
  },
};
function arenaStuff(B) {
  const L = B.R('arena'), r = B.rng, A = { x0: (L.tx - 3) * T, y0: (L.ty - 3) * T, x1: (L.tx + 11) * T, y1: (L.ty + 11) * T };
  for (let i = 0; i < 3; i++) Game.addItem('coffee', r.range(A.x0 + 120, A.x1 - 120), r.range(A.y0 + 120, A.y1 - 120));
  for (let i = 0; i < 2; i++) Game.addItem('milk', r.range(A.x0 + 120, A.x1 - 120), r.range(A.y0 + 120, A.y1 - 120));
  for (let i = 0; i < 10; i++) Game.addItem('treat', r.range(A.x0 + 80, A.x1 - 80), r.range(A.y0 + 80, A.y1 - 80));
  for (const [fx, fy] of [[0.5, 0.5], [7.5, 0.5], [0.5, 7.5], [7.5, 7.5]]) Game.addProp({ k: 'stand', x: (L.tx + fx) * T, y: (L.ty + fy) * T, food: r.pick(['sushi', 'hotdog', 'donut']), free: true });
}
const FOODS = ['treat', 'bone', 'donut', 'steak', 'sushi', 'hotdog'];
function nearestFood(G) {
  const a = G.cats[G.active]; let b = null, bd = 1e12;
  for (const it of G.items) if (FOODS.includes(it.k)) { const d = U.d2(it.x, it.y, a.x, a.y); if (d < bd) { bd = d; b = it; } }
  for (const p of G.props) if (p.k === 'stand' && p.left > 0) { const d = U.d2(p.x, p.y, a.x, a.y) * 0.5; if (d < bd) { bd = d; b = { x: p.x, y: p.y + 34, stand: p }; } }
  return b;
}
function nearestLoot(G) {
  const a = G.cats[G.active]; let b = null, bd = 1e12;
  for (const it of G.items) if (it.k === 'cash') { const d = U.d2(it.x, it.y, a.x, a.y) * 0.6; if (d < bd) { bd = d; b = it; } }
  for (const p of G.props) if (p.k === 'crate' && !p.done) { const d = U.d2(p.x, p.y, a.x, a.y); if (d < bd) { bd = d; b = p; } }
  for (const e of G.dogs) if (!e.dead) { const d = U.d2(e.x, e.y, a.x, a.y) * 1.4; if (d < bd) { bd = d; b = e; } }
  return b;
}

// ---------- lifecycle ----------
M.world = () => VP.City || (VP.City = World.gen({ seed: 7 }));
M.start = function (m) {
  const type = TYPES[m.type], p = m.p, W = m.tourCity ? VP.CityCache[m.tourCity] : M.world();
  if (m.tourCity && !W.tourStart) { M.startTour(m.tourCity); Game.end(); }
  const B = { m, p, lv: Game.eff(m.lv), geo: m.geo, rng: U.rng(m.n * 977 + 13), comps: {} };
  if (type.plan) type.plan(B);
  W.reset();
  if (!W.real) for (const role in B.comps) { const lot = W.roles[m.geo][role]; lot.props = W.setComp(lot, B.comps[role]); }
  const G = Game.create(W, m);
  B.W = W; B.G = G; mk(B);
  G.mtimer = null;
  type.setup(B);
  G.steps = B.steps; G.step = 0; G.fieldT = 0;
  return G;
};
// open-world free roam: mission beams, collectibles, light ambient trouble
M.startFree = function (pos, opts) {
  opts = opts || {};
  const W = M.world(); W.reset();
  const m = { n: 0, d: 0, geo: 0, type: 'free', name: ['Cidade livre', 'Free roam'], p: {}, lv: Math.max(1, Math.min(40, VP.S.unlocked)), hunger: 0.35, free: true };
  const G = Game.create(W, m);
  const B = mk({ m, p: {}, lv: Game.eff(m.lv), geo: 0, rng: U.rng(99), W, G });
  const sp = pos && W.clear(pos.x, pos.y) ? pos : W.front(W.roles[0].arena, 's');
  B.begin(sp, { paws: 2 });
  G.free = true; G.steps = []; G.markers = []; G.npcs = [];
  const S = VP.S; S.paws = S.paws || {}; S.quests = S.quests || {};
  // collectible golden paws (counted per district)
  for (let d = 0; d < 5; d++) { const r = U.rng(500 + d * 17); for (let i = 0; i < (M.act.pawsPerDistrict || 0); i++) { const q = W.randWalkD(d, r), id = d + '_' + i; if (!S.paws[id]) { const it = Game.addItem('gpaw', q.x, q.y); it.pid = id; } } }
  // time trials + NPC side quests
  if (!opts.trial) {
    for (const m of M.side) { const st = m.p.start || [1, 1]; G.markers.push({ x: W.RX[st[0]] + 150, y: W.RY[st[1]] + 130, k: 'race', n: m.n, col: '#2de2e6', label: VP.mname(m) }); }
    for (const q of M.act.quests || []) { if (S.quests[q.id]) continue; const lot = W.roles[q.d][q.spot] || W.roles[q.d].plaza1, pt = W.front(lot, 'e'); const f = Game.addFriend(pt.x, pt.y, q.npc); f.stay = true; G.markers.push({ x: pt.x, y: pt.y, k: 'npc', q, col: '#7CFF6B', label: q.name[VP.lang() === 'pt' ? 'pt' : 'en'], thin: true }); }
  }
  for (let d = 0; d < 5; d++) {
    const R = M.dist(d); let nx = null;
    for (let n = R.from; n <= R.to; n++) if (n <= VP.S.unlocked && !VP.S.stars[n]) { nx = n; break; }
    if (!nx && VP.S.unlocked > R.to) nx = R.to; // replay the boss
    const pt = W.front(W.roles[d].arena, 'n');
    if (nx) G.markers.push({ x: pt.x, y: pt.y, k: 'mission', n: nx, col: '#ff4fb8' });
    for (let i = 0; i < 2; i++) { B.geo = d; const q = W.randWalkD(d, B.rng); if (U.d2(q.x, q.y, sp.x, sp.y) > 500 * 500) B.dogs(q, pack(B, 2 + (d > 1 ? 1 : 0)), { aggro: 170 }); }
  }
  // chapters ("arcs"): one teal beam per open chapter, in its own district
  { const slot = {}; for (const D of M.DIST) { if (!D.arc || !M.distOpen(D)) continue; const nx = M.list.find(x => x.d === D.id && !VP.S.stars[x.n]); if (!nx) continue; const k = slot[D.geo] = (slot[D.geo] || 0) + 1; if (k > 3) continue; const lot = W.roles[D.geo][['plaza2', 'plaza3', 'plaza1'][k - 1]]; if (!lot) continue; const q = W.front(lot, 'e'); G.markers.push({ x: q.x, y: q.y, k: 'mission', n: nx.n, col: '#2de2e6' }); } }
  const shop = W.front(W.roles[0].plaza1, 's'); G.markers.push({ x: shop.x, y: shop.y, k: 'shop', col: '#ffd23f' });
  if (VP.Shop && VP.Shop.has('vip')) { const q = W.front(W.roles[2].plaza3, 'n'); const n = M.list.find(x => x.d === 5 && !VP.S.stars[x.n]) || M.get(51); G.markers.push({ x: q.x, y: q.y, k: 'mission', n: n.n, col: '#ffd23f' }); }
  if (VP.Shop && VP.Shop.has('season')) { const q = W.front(W.roles[1].plaza2, 'n'); const n = M.list.find(x => x.d === 6 && !VP.S.stars[x.n]) || M.get(61); G.markers.push({ x: q.x, y: q.y, k: 'mission', n: n.n, col: '#7CFF6B' }); }
  // the player's own cat tags along; other players' public cats stroll around ("Cidade dos Gatos")
  if (S.avatar && !opts.trial) { const f = Game.addFriend(sp.x + 30, sp.y + 50, 'avatar'); f.spec = S.avatar; f.label = S.avatar.label || ''; }
  const gal = (VP.Acct && VP.Acct.gallery) || [];
  if (!opts.trial) gal.slice(0, 24).forEach((c, i) => { const d = i % 5, r = U.rng(900 + i * 31), q = W.randWalkD(d, r); const f = Game.addFriend(q.x, q.y, 'f' + (i % 4)); f.spec = VP.Acct.toSpec(c.spec); f.label = c.name + (c.instagram ? ' @' + c.instagram : ''); f.stay = true; f.wander = true; f.home = { x: q.x, y: q.y }; });
  if (opts.trial) {
    const cp = { x: sp.x + 40, y: sp.y + 60 }, car = Game.addCar('gold', cp.x, cp.y, 0); Game.enterCar(car);
    G.noHeat = true; G.noPolice = true; G.mtimer = 20; G.trial = true; G.forceVip = true; G.markers = [];
  }
  return G;
};
// ---------- Volta ao Mundo (real cities) ----------
M.cities = [];
M.loadCities = idx => { M.cities = (idx && idx.cities) || []; M.osm = (idx && idx.attribution) || '© OpenStreetMap contributors'; };
// City mission packs (data/citypacks.json): hand-written packs per city, a default template of 10 for any new city,
// and a positive-only template for maps tagged "comunidade".
M.packs = { templates: [], comunidade: [], packs: {} };
M.loadPacks = d => { if (d) M.packs = d; };
const cityHash = id => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 500; return h; };
M.tourBase = meta => 1000 + (meta && meta.order !== undefined && meta.order < 400 ? meta.order : 400 + cityHash(meta ? meta.id : 'x')) * 10;
M.tourMissions = function (id) {
  const ci = M.cities.findIndex(c => c.id === id), meta = M.cities[ci], W = VP.CityCache[id], tags = (W ? W.real.tags : meta.tags) || [], comu = tags.includes('comunidade');
  const pk = M.packs.packs[id];
  let defs = pk && pk.missions && pk.missions.length ? pk.missions : comu ? M.packs.comunidade : M.packs.templates;
  if (comu) defs = defs.filter(d => M.COMU_SAFE.includes(d.kind)); // hard rule: comunidade maps only get positive missions
  defs = defs.filter(d => !d.needs || d.needs.every(t => tags.includes(t))).slice(0, 10);
  const base = M.tourBase(meta), L = VP.lang;
  const list = defs.map((d, k) => ({ n: base + k, type: 'tour', tourCity: id, name: [d.name.pt, d.name.en], story: d.story || null, p: Object.assign({ kind: d.kind, comu, seed: k }, d.params || {}, d.at ? { at: d.at } : {}), lv: Math.min(40, d.lv || 4 + (ci > 0 ? ci : 0) + k * 2), par: Math.round((d.par || (d.kind === 'race' ? 260 : d.kind === 'deliver' || d.kind === 'kiterun' ? 160 : 190)) * (tags.includes('morro') ? 1.4 : 1)), hunger: 1, boss: null, bonus: true, side: true, d: 0, geo: 0 }));
  void L;
  M.tourList = M.tourList.filter(m => m.tourCity !== id).concat(list);
  return list;
};
M.startTour = function (id) {
  const W = VP.CityCache[id], meta = W.meta, C = W.real, comu = (C.tags || []).includes('comunidade'); W.reset();
  const m = { n: 0, d: 0, geo: 0, type: 'free', name: [C.name, C.name], p: {}, lv: Math.max(1, Math.min(30, VP.S.unlocked)), hunger: 0.35, free: true };
  const G = Game.create(W, m);
  const B = mk({ m, p: {}, lv: m.lv, geo: 0, rng: U.rng(321 + id.length), W, G });
  const S = VP.S;
  if (!W.tourStart) { let best = W.snap(W.pw / 2, W.ph / 2) || W.randWalk(B.rng), bd = 1e18; for (const rd of W.roads) if (rd.w >= 6) for (const q of rd.pts) { const d = U.d2(q.x, q.y, W.pw / 2, W.ph / 2); if (d < bd && !W.blocked(q.x, q.y, 40, 0)) { bd = d; best = { x: q.x, y: q.y }; } } W.tourStart = best;
    // keep everything on the street network connected to the start (courtyards and islands are skipped)
    const fm = W.fieldMax; W.fieldMax = 0; const conn = W.field(best.x, best.y, 0); W.fieldMax = fm; W.conn = conn;
    W.walkList = W.walkList.filter(i => conn[i] >= 0);
    const snapC = (x, y) => { const cx = Math.floor(x / T), cy = Math.floor(y / T); for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const X = cx + dx, Y = cy + dy; if (X > 1 && Y > 1 && X < W.W - 2 && Y < W.H - 2 && conn[Y * W.W + X] >= 0 && W.gnd[Y * W.W + X] <= 2) return { x: (X + 0.5) * T, y: (Y + 0.5) * T }; } return null; };
    W.landmarks = W.landmarks.filter(l => { const q = snapC(l.x, l.y); if (!q) return false; l.gx = q.x; l.gy = q.y; return true; });
    // extra named places of the city pack (lat/lon -> map), used as mission waypoints
    const pk = M.packs.packs[id], C0 = W.real, half = C0.half, MPT = World.MPT;
    W.places = ((pk && pk.places) || []).map(pl => { const mx = (pl[2] - C0.lon) * Math.cos(C0.lat * Math.PI / 180) * 111320, mz = -(pl[1] - C0.lat) * 110540; if (Math.abs(mx) > half - 25 || Math.abs(mz) > half - 25) return null; const q = snapC((mx + half) / MPT * T, (mz + half) / MPT * T); return q ? { name: pl[0], x: q.x, y: q.y, gx: q.x, gy: q.y, h: 8, place: true } : null; }).filter(Boolean);
    for (const rd of W.roads) rd.pts = rd.pts.filter(q => conn[Math.floor(q.y / T) * W.W + Math.floor(q.x / T)] >= 0);
    W.roads = W.roads.filter(rd => rd.pts.length >= 2);
  }
  const sp = W.tourStart;
  if (comu && !W.pitch && M.helpers) W.pitch = M.helpers.patch(W, sp.x, sp.y, 14, 3, (g, x, y) => (g === 7 || g === 3 ? 120 : 0) - (Math.abs(W.hpx(x + 90, y) - W.hpx(x - 90, y)) + Math.abs(W.hpx(x, y + 60) - W.hpx(x, y - 60))) * 60); // the little football pitch
  B.begin(sp, { paws: 1, traffic: comu ? 0 : (meta.traffic || 10), coffee: 10, parked: comu ? 0 : 14 });
  G.free = true; G.tour = id; G.steps = []; G.markers = []; G.npcs = [];
  S.paws = S.paws || {}; S.quests = S.quests || {}; S.tour = S.tour || {}; S.tour[id] = S.tour[id] || { seen: {} };
  if (comu) { G.noPolice = true; G.noHeat = true; } // community maps: friendly, no cops, no wanted level
  else for (let i = 0; i < 6; i++) { const q = W.randWalk(B.rng); if (U.d2(q.x, q.y, sp.x, sp.y) > 600 * 600) B.dogs(q, pack(B, 2), { aggro: 170 }); }
  const r = U.rng(700 + id.length * 7); for (let i = 0; i < 5; i++) { const q = W.randWalk(r), pid = id + '_' + i; if (!S.paws[pid]) { const it = Game.addItem('gpaw', q.x, q.y); it.pid = pid; } }
  const ms = M.tourMissions(id);
  // mission beams: spread around the start so they are easy to find
  ms.forEach((mm, k) => { let q = null; for (let i = 0; i < 40 && !q; i++) { const c = W.randWalk(r), d = Math.hypot(c.x - sp.x, c.y - sp.y); if (d > 180 + k * 60 && d < 520 + k * 130 && !G.markers.some(o => U.d2(o.x, o.y, c.x, c.y) < 200 * 200)) q = c; } q = q || W.randWalk(r); G.markers.push({ x: q.x, y: q.y, k: 'mission', n: mm.n, col: VP.S.stars[mm.n] ? '#2de2e6' : '#ff4fb8' }); });
  if (S.avatar) { const f = Game.addFriend(sp.x + 30, sp.y + 50, 'avatar'); f.spec = S.avatar; f.label = S.avatar.label || ''; }
  // friendly neighbours: elder cats in the comunidade, farmers at the Rio Verde fair
  if (comu || id === 'rioverde') for (let i = 0; i < 4; i++) { const q = Game.nearFree(sp.x, sp.y, 120 + i * 70, 0); if (q) { const f = Game.addFriend(q.x, q.y, id === 'rioverde' ? 'farmer' : i % 2 ? 'elder' : 'f' + i); f.stay = true; f.wander = true; f.home = { x: q.x, y: q.y }; } }
  return G;
};
M.current = G => G.steps[G.step] || null;
M._ = { TYPES, mk, pack, gsize, arenaStuff, gateSteps, compGuards, nearestFood, nearestLoot };
M.update = function (G, dt) {
  if (G.over) return;
  if (G.ticks) for (const f of G.ticks) { const r = f(dt); if (r) return Game.fail(r); }
  if (G.mtimer !== null) {
    G.mtimer -= dt;
    if (G.mtimer <= 10 && Math.floor(G.mtimer) !== Math.floor(G.mtimer + dt) && G.mtimer > 0) VP.Audio.sfx('tick');
    if (G.mtimer <= 0) { G.mtimer = 0; if (G.trial) { G.over = true; VP.Audio.engine(0, false); setTimeout(() => VP.UI.trialEnd(), 0); return; } return Game.fail('time'); }
  }
  if (G.free) {
    const a = G.car || G.cats[G.active]; let on = null;
    for (const mk of G.markers) if (U.d2(a.x, a.y, mk.x, mk.y) < 62 * 62) on = mk;
    if (on && G.onMarker !== on && !(G.car && Math.abs(G.car.spd) > 160)) VP.UI.marker(on);
    G.onMarker = on;
    if (G.tour) { const seen = VP.S.tour[G.tour].seen; for (const l of G.W.landmarks) if (!seen[l.name] && U.d2(a.x, a.y, l.gx, l.gy) < 110 * 110) { seen[l.name] = 1; VP.S.cash += 20; VP.persist(); VP.Audio.sfx('paw'); Game.fx.say('📸 ' + l.name + ' (' + Object.keys(seen).length + '/' + G.W.landmarks.length + ')', '#ffd23f', 3); } }
    // persist where the player is every few seconds
    G.saveT = (G.saveT || 0) + dt; if (G.saveT > 5 && !G.car && !G.trial) { G.saveT = 0; if (!G.tour) VP.S.pos = { x: Math.round(a.x), y: Math.round(a.y) }; VP.S.cash += G.stat.cash - (G.bank || 0); G.bank = G.stat.cash; VP.persist(); }
    return;
  }
  const st = G.steps[G.step];
  if (!st) {
    if (G.cats.some(c => c.down)) { G.needRevive = true; return; }
    G.needRevive = false; Game.win(); return;
  }
  if (!st.on) { st.on = true; if (st.enter) st.enter(); }
  if (st.tick) st.tick(dt);
  if (st.fail) { const f = st.fail(); if (f) return Game.fail(f); }
  if (st.done()) {
    if (st.exit) st.exit();
    G.step++;
    if (G.steps[G.step] && st.txt !== 'o_ready' && st.txt !== 'o_waveIn' && st.txt !== 'o_ambush') { VP.Audio.sfx('step'); G.objFlash = 1; }
  }
};
// what the HUD shows
M.objective = function (G) {
  if (G.free && G.quest) { const q = G.quest, cur = Math.min(q.def.n, Math.round(G.stat[q.key] - q.base)), done = cur >= q.def.n; return { txt: done ? VP.t('q_return', q.def.name[VP.lang() === 'pt' ? 'pt' : 'en']) : VP.t('q_' + q.def.type, q.def.n), prog: [cur, q.def.n], at: done ? q.mk : null, cat: null, free: true }; }
  if (G.free) { let b = null, bd = 1e12; const a = G.cats[G.active]; for (const mk of G.markers) if (mk.k === 'mission') { const d = U.d2(a.x, a.y, mk.x, mk.y); if (d < bd) { bd = d; b = mk; } } return { txt: G.tour ? VP.t('o_tour', G.W.real.name) : VP.t(G.trial ? 'o_trial' : 'o_free'), at: b, cat: null, free: true }; }
  const st = G.steps[G.step];
  if (!st) return { txt: G.needRevive ? VP.t('o_reviveAll') : VP.t('o_done'), at: G.needRevive ? G.cats.find(c => c.down) : null, cat: null };
  return { txt: VP.t.apply(null, [st.txt].concat(st.args || [])), prog: st.prog ? st.prog() : null, at: st.at ? st.at() : null, cat: st.cat || null, car: !!st.car, step: st };
};
// ---------- daily challenges (3 per day, generated from the date) and weekly events ----------
M.dayKey = d => { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const DAILY_GOALS = [['win', 150], ['nofaint', 250], ['par', 400]];
// Deterministic: the same date and the same unlocked missions always give the same three challenges.
M.daily = function (date) {
  const key = M.dayKey(date), r = U.rng(key * 7919 + 17); for (let i = 0; i < 5; i++) r();
  let pool = M.list.filter(m => !m.boss && M.unlocked(m)); if (!pool.length) pool = M.list.slice(0, 1);
  const out = [], used = {};
  DAILY_GOALS.forEach((g, i) => {
    let m = null; for (let k = 0; k < 12 && !m; k++) { const c = pool[Math.floor(r() * pool.length)]; if (!used[c.n] && (k > 7 || !used['t' + c.type])) m = c; }
    m = m || pool[Math.floor(r() * pool.length)]; used[m.n] = used['t' + m.type] = 1;
    out.push({ i, n: m.n, goal: g[0], reward: g[1] });
  });
  return { key, list: out };
};
M.dailyState = function (date) { const S = VP.S, key = M.dayKey(date); if (!S.daily || S.daily.k !== key) S.daily = { k: key, done: [0, 0, 0], all: 0, list: M.daily(date).list }; return S.daily; };
// called with the result of a won mission; returns the reward lines to show
M.dailyCheck = function (r, date) {
  const st = M.dailyState(date), S = VP.S, out = [];
  st.list.forEach(c => {
    if (st.done[c.i] || c.n !== r.m.n) return;
    if (c.goal === 'nofaint' && !r.noFaint) return; if (c.goal === 'par' && !r.underPar) return;
    st.done[c.i] = 1; S.cash += c.reward; out.push(VP.t('dc_done', c.reward));
  });
  if (out.length && !st.all && st.done.every(Boolean)) {
    st.all = 1; S.lives = Math.max(S.lives, Math.min(9, S.lives + 1));
    const y = M.dayKey(new Date((date || new Date()).getTime() - 864e5)); S.streak = S.streak && S.streak.k === y ? { k: st.k, n: S.streak.n + 1 } : { k: st.k, n: 1 };
    out.push(VP.t('dc_all', S.streak.n));
  }
  return out;
};
M.events = [];
M.loadEvents = d => { M.events = (d && d.events) || []; M.eventEpoch = (d && d.epoch) || '2026-01-05'; };
// one event per ISO-like week, rotating through data/events.json
M.weekly = function (date) {
  if (!M.events.length) return null;
  const t0 = new Date(M.eventEpoch + 'T00:00:00').getTime(), w = Math.floor(((date || new Date()).getTime() - t0) / (7 * 864e5));
  const ev = M.events[((w % M.events.length) + M.events.length) % M.events.length];
  return Object.assign({ week: w, endsIn: 7 - Math.floor((((date || new Date()).getTime() - t0) / 864e5) % 7 + 7) % 7 }, ev);
};
M.weeklyHooks = []; // future: (event, result) => extra reward lines
M.weeklyBonus = function (r, date) {
  const ev = M.weekly(date); if (!ev) return null;
  const kind = r.m.type === 'tour' ? r.m.p.kind : r.m.type;
  if (!(ev.types || []).includes(kind) && !(ev.tour && r.m.tourCity)) return null;
  return { ev, coins: Math.round(r.cash * ((ev.mult || 1.5) - 1)) };
};
})();
