'use strict';
// VICE PAWS — mission catalogue (50 + bonus districts), builders and objective steps
(function () {
const VP = window.VP, U = VP.U, T = VP.TILE, Game = VP.Game, World = VP.World;
const M = VP.Missions = {};

// districts: 0-4 story, 5 = VIP marina, 6 = season (Natal Neon)
M.DIST = [
  { id: 0, song: 0, from: 1, to: 10 }, { id: 1, song: 1, from: 11, to: 20 }, { id: 2, song: 2, from: 21, to: 30 },
  { id: 3, song: 3, from: 31, to: 40 }, { id: 4, song: 4, from: 41, to: 50 },
  { id: 5, song: 2, from: 51, to: 55, grant: 'vip' }, { id: 6, song: 6, from: 61, to: 64, grant: 'season' },
];
const BOSS = { 10: 'chief', 20: 'poodle', 30: 'rott', 40: 'pug', 50: 'dogcatcher' };
// [type, PT name, EN name, params]
const RAW = {
  1: ['reach', 'Rolê na Orla', 'Boardwalk Stroll', { cols: 2, rows: 2, groups: 1, tut: 1 }],
  2: ['waves', 'Vira-latas na Areia', 'Beach Mutts', { cols: 2, rows: 2, waves: [['mutt', 'mutt'], ['mutt', 'chi', 'chi'], ['mutt', 'mutt', 'chi', 'chi']] }],
  3: ['eat', 'Rodízio da Mortícia', "Morticia's Buffet", { n: 12, time: 100 }],
  4: ['rescue', 'Miau por Socorro', 'Meow for Help', { cages: [['fence', 'bite']] }],
  5: ['truck', 'O Caminhão de Petiscos', 'The Treat Truck', { gate: 'switch', wanted: 1 }],
  6: ['rescue', 'A Portinha Secreta', 'The Secret Cat Flap', { cages: [['gap', 'link']] }],
  7: ['race', 'Entrega de Sushi', 'Sushi Delivery', { cps: 4, time: 80 }],
  8: ['defend', 'Nossa Casinha', 'Home Sweet Home', { waves: 3 }],
  9: ['escape', 'Fuga da Carrocinha', 'Dodge the Dog Catchers', { wanted: 2, car: 1 }],
  10: ['boss', 'Delegado Bulldogão', 'Chief Bulldog', {}],
  11: ['steal', 'Mão Leve', 'Sticky Paws', { n: 5, time: 130 }],
  12: ['truck', 'A Chave do Baú', 'Key to the Truck', { gate: 'key', wanted: 2 }],
  13: ['waves', 'Briga no Beco', 'Alley Brawl', { arena: 1, waves: 4 }],
  14: ['chase', 'Pega a Van!', 'Catch That Van!', { targets: ['van'], time: 90 }],
  15: ['vault', 'O Cofre de Atum', 'The Tuna Vault', { gate: 'fence', wanted: 2 }],
  16: ['eat', 'Feira Noturna', 'Night Market', { n: 20, time: 110, hunger: 1.4 }],
  17: ['rescue', 'Gatinhos do Fliperama', 'Arcade Kittens', { cages: [['switch', 'key'], ['fence', 'bite']] }],
  18: ['reach', 'Travessia Neon', 'Neon Crossing', { cols: 4, rows: 3, groups: 5, time: 150 }],
  19: ['escape', 'Sirenes na Avenida', 'Sirens on the Avenue', { wanted: 3, car: 1 }],
  20: ['boss', 'Madame Poodle', 'Madame Poodle', {}],
  21: ['race', 'Peixe Fresco Expresso', 'Fresh Fish Express', { cps: 6, time: 100 }],
  22: ['defend', 'Churrasco no Píer', 'Pier Barbecue', { waves: 4 }],
  23: ['truck', 'Carga do Cais', 'Dock Cargo', { gate: 'gap', wanted: 2 }],
  24: ['cash', 'Quebra-Caixotes', 'Crate Cracker', { cash: 450, time: 140 }],
  25: ['rescue', 'Resgate na Marina', 'Marina Rescue', { cages: [['fence', 'bite'], ['open', 'key'], ['gap', 'link']] }],
  26: ['waves', 'Maré de Latidos', 'Tide of Barks', { arena: 1, waves: 5 }],
  27: ['chase', 'A Limusine do Capitão', "The Captain's Limo", { targets: ['limo'], time: 110, drop: 3.5 }],
  28: ['vault', 'Cofre do Iate Clube', 'Yacht Club Vault', { gate: 'key', wanted: 3 }],
  29: ['escape', 'Cerco no Porto', 'Harbor Lockdown', { wanted: 3, survive: 70 }],
  30: ['boss', 'Capitão Rottweiler', 'Captain Rott', {}],
  31: ['reach', 'Tempestade no Cais', 'Storm on the Docks', { cols: 4, rows: 3, groups: 6, time: 170 }],
  32: ['truck', 'Contêiner 32', 'Container 32', { gate: 'switch', wanted: 3, heavy: 1 }],
  33: ['eat', 'Fome de Trovão', 'Thunder Hunger', { n: 24, time: 110, hunger: 1.7 }],
  34: ['defend', 'O Gerador', 'The Generator', { waves: 5, gen: 1 }],
  35: ['chase', 'Comboio da Carrocinha', 'Catcher Convoy', { targets: ['van', 'van'], time: 150, drop: 3 }],
  36: ['rescue', 'Jaulas na Chuva', 'Cages in the Rain', { cages: [['switch', 'link'], ['key', 'bite'], ['fence', 'key']] }],
  37: ['steal', 'Lanche dos Estivadores', "Dockworkers' Lunch", { n: 9, time: 150 }],
  38: ['vault', 'Cofre do Contrabando', "Smuggler's Vault", { gate: 'switch', wanted: 3 }],
  39: ['escape', 'Quatro Estrelas', 'Four Stars', { wanted: 4, car: 1 }],
  40: ['boss', 'Don Pug', 'Don Pug', {}],
  41: ['cash', 'Cobertura de Luxo', 'Penthouse Payday', { cash: 750, time: 160 }],
  42: ['race', 'Corrida das Colinas', 'Hillside Rush', { cps: 8, time: 120, cols: 4 }],
  43: ['truck', 'O Grande Golpe do Sachê', 'The Great Sachet Heist', { gate: 'key', wanted: 4, heavy: 1 }],
  44: ['defend', 'Última Trincheira', 'Last Stand', { waves: 6 }],
  45: ['rescue', 'Ninguém Fica Pra Trás', 'No Cat Left Behind', { cages: [['fence', 'key'], ['switch', 'link'], ['gap', 'link'], ['key', 'bite']] }],
  46: ['chase', 'Caça ao Caminhão-Jaula', 'Hunt the Cage Truck', { targets: ['van', 'limo'], time: 170, drop: 2.6 }],
  47: ['waves', 'Tropa de Elite Canina', 'Canine Elite Squad', { arena: 1, waves: 6 }],
  48: ['vault', 'O Cofre do Rei', "The King's Vault", { gate: 'gap', wanted: 4 }],
  49: ['escape', 'Cinco Estrelas', 'Five Stars', { wanted: 5, survive: 50, car: 1 }],
  50: ['boss', 'O Rei da Carrocinha', 'The Dog Catcher King', {}],
  // VIP bonus district: Marina Dourada
  51: ['race', 'Volta de Ouro', 'Golden Lap', { cps: 7, time: 110, lv: 12 }],
  52: ['eat', 'Buffet do Iate', 'Yacht Buffet', { n: 22, time: 110, lv: 16 }],
  53: ['vault', 'Cofre do Comodoro', "Commodore's Vault", { gate: 'fence', wanted: 2, lv: 20 }],
  54: ['waves', 'Festa no Convés', 'Deck Party', { arena: 1, waves: 5, lv: 24 }],
  55: ['chase', 'Regata Dourada', 'Golden Regatta', { targets: ['limo', 'limo'], time: 160, drop: 3, lv: 28 }],
  // Season: Natal Neon
  61: ['race', 'Entrega de Presentes', 'Gift Delivery', { cps: 6, time: 100, lv: 10 }],
  62: ['eat', 'Ceia de Natal', 'Christmas Feast', { n: 20, time: 110, lv: 14 }],
  63: ['rescue', 'Gatinhos de Natal', 'Christmas Kittens', { cages: [['fence', 'bite'], ['switch', 'link'], ['gap', 'link']], lv: 18 }],
  64: ['defend', 'A Árvore de Natal', 'The Christmas Tree', { waves: 5, lv: 22 }],
};
M.list = [];
for (const k in RAW) {
  const n = +k, r = RAW[k], d = M.DIST.find(x => n >= x.from && n <= x.to);
  M.list.push({ n, geo: [0, 1, 2, 3, 4, 2, 1][d.id], d: d.id, type: r[0], name: [r[1], r[2]], p: r[3], lv: r[3].lv || n, hunger: r[3].hunger || 1, boss: BOSS[n] || null, bonus: d.id > 4 });
}
M.get = n => M.list.find(m => m.n === n);
M.next = n => { const i = M.list.findIndex(m => m.n === n); const nx = M.list[i + 1]; return nx && nx.d === M.list[i].d ? nx : (n === 50 ? null : (nx && n < 50 ? nx : null)); };
M.unlocked = m => {
  if (!m.bonus) return m.n <= VP.S.unlocked;
  const d = M.DIST[m.d];
  if (!VP.Shop || !VP.Shop.has(d.grant)) return false;
  return m.n === d.from || !!VP.S.stars[m.n - 1];
};
M.par = m => {
  const p = m.p;
  if (p.time) return Math.round(p.time * 0.72);
  return { reach: 60, waves: 45 + (Array.isArray(p.waves) ? p.waves.length : p.waves) * 22, rescue: 60 + p.cages ? 50 + p.cages.length * 45 : 90, truck: 110, defend: 40 + p.waves * 30, escape: 80 + (p.survive || 0), boss: 150, vault: 150 }[m.type] || 120;
};

// ---------- builder helpers ----------
function pack(B, n) {
  const lv = B.lv, pool = ['mutt', 'mutt', 'chi'];
  if (lv >= 4) pool.push('cop'); if (lv >= 8) pool.push('shooter'); if (lv >= 9) pool.push('catcher');
  if (lv >= 14) pool.push('heavy'); if (lv >= 25) pool.push('cop', 'shooter'); if (lv >= 35) pool.push('heavy', 'catcher');
  const out = []; for (let i = 0; i < n; i++) out.push(B.rng.pick(pool)); return out;
}
const gsize = B => 2 + Math.floor(B.lv / 13);
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
const GATE_CAT = { fence: 'mimosa', switch: 'mimo', gap: 'morticia', key: 'morticia', open: null };
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
  const inner = lot.vault ? [[1, 3], [6, 4], [3, 6], [4, 1]] : [[2, 2], [5, 2], [2, 5], [5, 5], [3, 3]];
  const types = pack(B, n).concat(extra || []);
  types.forEach((t, i) => { const s = inner[i % inner.length]; Game.addDog(t, (lot.tx + s[0] + 0.5) * T, (lot.ty + s[1] + 0.5) * T, { guard: true, tag: 'g', aggro: 150 }); });
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
      const waves = Array.isArray(p.waves) ? p.waves : Array.from({ length: p.waves }, (_, i) => pack(B, 3 + i + Math.floor(B.lv / 10)));
      B.G.noPolice = true; B.G.noHeat = true;
      waves.forEach((w, i) => { B.wait(i ? 2.2 : 1.5, 'o_waveIn', [i + 1, waves.length]); B.wave(w, { args: [i + 1, waves.length] }); });
    },
  },
  eat: {
    setup(B) {
      const p = B.p, G = B.G;
      B.begin(B.front('arena', 's'));
      for (const c of ['plaza1', 'plaza2', 'plaza3']) B.dogs(B.front(c, 'n'), pack(B, gsize(B) - 1), { carry: B.rng.pick(['bone', 'steak', 'donut']) });
      G.mtimer = p.time;
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
      B.begin(start);
      p.cages.forEach((c, i) => {
        const lot = B.R('comp' + 'ACBD'[i]), gate = c[0], lock = c[1];
        const gp = gate === 'fence' ? B.propOf(lot, 'fgate') : gate === 'switch' ? B.propOf(lot, 'laser') : gate === 'open' ? null : B.propOf(lot, 'sdoor');
        const cage = Game.addProp({ k: 'cage', x: lot.cx, y: lot.cy - 10, friend: 'f' + (i % 4), lock: lock === 'link' ? 'bolt' : lock, link: lock === 'link' ? gp.id : null, lot });
        compGuards(B, lot, Math.max(1, gsize(B) - 1));
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
      B.begin(B.front('arena', 's'));
      const truck = Game.addCar('truck', lot.cx, lot.cy - 30, Math.PI / 2, { locked: true });
      compGuards(B, lot, gsize(B), p.heavy ? ['heavy'] : []);
      B.dogs({ x: lot.frontX + 120, y: lot.frontY + 30 }, pack(B, 1));
      const gp = gateSteps(B, lot, p.gate);
      const dest = B.ix(B.cols, 0, -48, 80);
      B.step({ txt: 'o_enterTruck', act: 'ctx', enter() { truck.locked = false; }, tick() { if (gp && gp.done) truck.locked = false; }, at: () => truck, done: () => G.car === truck });
      B.step({ txt: 'o_driveTruck', car: true, enter() { B.wantedOn(p.wanted); }, at: () => dest, done: () => G.car === truck && U.d2(truck.x, truck.y, dest.x, dest.y) < 110 * 110, fail: () => truck.dead ? 'truck' : null });
      B.step({ txt: 'o_done', enter() { G.minWanted = 0; G.heat = 0; G.noPolice = true; }, done: () => true, at: () => null });
    },
  },
  vault: {
    plan(B) { B.comps.compC = { gate: B.p.gate, vault: true }; },
    setup(B) {
      const p = B.p, G = B.G, lot = B.R('compC'), start = B.front('arena', 's');
      B.begin(start);
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
        const dest = B.ix(B.cols, 0, -48, 90);
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
      const car = Game.addCar(B.getaway(), sp.x, sp.y, 0); Game.enterCar(car);
      G.noHeat = true; G.mtimer = p.time;
      const cw = B.cols, rh = B.rows, loops = [[[1, 1], [cw - 1, 1], [cw - 1, rh - 1], [1, rh - 1]], [[0, 0], [cw, 0], [cw, rh], [0, rh]], [[1, 0], [2, 0], [2, rh], [1, rh]]];
      p.targets.forEach((type, i) => {
        const loop = loops[(B.m.n + i) % loops.length], route = loop.map(q => B.ix(q[0], q[1]));
        let tc = null;
        B.step({
          txt: 'o_chase', args: [i + 1, p.targets.length], car: true, ram: true,
          enter() { tc = Game.addCar(type, route[0].x, route[0].y, 0, { ai: 'target', route, wi: 1, drop: p.drop || 0 }); tc.hp = tc.max = tc.max * (1 + B.lv * 0.012); tc.top *= 0.82 + Math.min(0.14, B.lv * 0.003); },
          at: () => tc, done: () => tc.dead, prog: () => [Math.round((1 - Math.max(0, tc.hp) / tc.max) * 100), 100],
          fail: () => (!G.car && car.dead) ? 'car' : null,
        });
      });
    },
  },
  race: {
    setup(B) {
      const p = B.p, G = B.G;
      const sp = B.ix(1, B.rows - 1, 60, 48);
      B.begin(sp);
      const car = Game.addCar(B.getaway(), sp.x, sp.y, 0); Game.enterCar(car);
      G.noHeat = true; G.mtimer = p.time;
      let i = 1, j = B.rows - 1;
      for (let k = 0; k < p.cps; k++) {
        let ni = i, nj = j;
        for (let t = 0; t < 30 && (Math.abs(ni - i) + Math.abs(nj - j) < 2 || Math.abs(ni - i) + Math.abs(nj - j) > 4); t++) { ni = B.rng.int(0, B.cols); nj = B.rng.int(0, B.rows); }
        i = ni; j = nj; const pt = B.ix(i, j);
        B.step({ txt: 'o_checkpoint', args: [k + 1, p.cps], car: true, at: () => pt, done: () => !!G.car && U.d2(G.car.x, G.car.y, pt.x, pt.y) < 100 * 100, enter() { if (k) { G.mtimer += 2; VP.Audio.sfx('cash'); G.stat.cash += 40; } }, fail: () => (!G.car && car.dead) ? 'car' : null });
      }
    },
  },
  defend: {
    setup(B) {
      const p = B.p, G = B.G, W = B.W, lot = B.R('house');
      B.begin({ x: lot.cx, y: lot.cy + 90 });
      const h = Game.addProp({ k: 'house', gen: !!p.gen, tree: B.m.d === 6, x: (lot.tx + 4) * T, y: (lot.ty + 3) * T, hp: 260 + B.lv * 6 });
      G.houseField = W.field(h.x, h.y + T * 1.6, 0);
      G.noPolice = true; G.noHeat = true;
      for (let i = 0; i < p.waves; i++) { B.wait(i ? 2.5 : 2, 'o_waveIn', [i + 1, p.waves]); B.wave(pack(B, 3 + i + Math.floor(B.lv / 9)), { raid: true, txt: 'o_defend', args: [i + 1, p.waves], hold: { x: h.x, y: h.y + 90 } }); }
    },
  },
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
  const type = TYPES[m.type], p = m.p, W = M.world();
  const B = { m, p, lv: m.lv, geo: m.geo, rng: U.rng(m.n * 977 + 13), comps: {} };
  if (type.plan) type.plan(B);
  W.reset();
  for (const role in B.comps) { const lot = W.roles[m.geo][role]; lot.props = W.setComp(lot, B.comps[role]); }
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
  const B = mk({ m, p: {}, lv: m.lv, geo: 0, rng: U.rng(99), W, G });
  const sp = pos && W.clear(pos.x, pos.y) ? pos : W.front(W.roles[0].arena, 's');
  B.begin(sp, { paws: 4 });
  G.free = true; G.steps = []; G.markers = [];
  for (let d = 0; d < 5; d++) {
    const R = M.DIST[d]; let nx = null;
    for (let n = R.from; n <= R.to; n++) if (n <= VP.S.unlocked && !VP.S.stars[n]) { nx = n; break; }
    if (!nx && VP.S.unlocked > R.to) nx = R.to; // replay the boss
    const pt = W.front(W.roles[d].arena, 'n');
    if (nx) G.markers.push({ x: pt.x, y: pt.y, k: 'mission', n: nx, col: '#ff4fb8' });
    for (let i = 0; i < 2; i++) { B.geo = d; const q = W.randWalkD(d, B.rng); if (U.d2(q.x, q.y, sp.x, sp.y) > 500 * 500) B.dogs(q, pack(B, 2 + (d > 1 ? 1 : 0)), { aggro: 170 }); }
  }
  const shop = W.front(W.roles[0].plaza1, 's'); G.markers.push({ x: shop.x, y: shop.y, k: 'shop', col: '#ffd23f' });
  if (VP.Shop && VP.Shop.has('vip')) { const q = W.front(W.roles[2].plaza3, 'n'); const n = M.list.find(x => x.d === 5 && !VP.S.stars[x.n]) || M.get(51); G.markers.push({ x: q.x, y: q.y, k: 'mission', n: n.n, col: '#ffd23f' }); }
  if (VP.Shop && VP.Shop.has('season')) { const q = W.front(W.roles[1].plaza2, 'n'); const n = M.list.find(x => x.d === 6 && !VP.S.stars[x.n]) || M.get(61); G.markers.push({ x: q.x, y: q.y, k: 'mission', n: n.n, col: '#7CFF6B' }); }
  if (opts.trial) {
    const cp = { x: sp.x + 40, y: sp.y + 60 }, car = Game.addCar('gold', cp.x, cp.y, 0); Game.enterCar(car);
    G.noHeat = true; G.noPolice = true; G.mtimer = 20; G.trial = true; G.forceVip = true; G.markers = [];
  }
  return G;
};
M.current = G => G.steps[G.step] || null;
M.update = function (G, dt) {
  if (G.over) return;
  if (G.mtimer !== null) {
    G.mtimer -= dt;
    if (G.mtimer <= 10 && Math.floor(G.mtimer) !== Math.floor(G.mtimer + dt) && G.mtimer > 0) VP.Audio.sfx('tick');
    if (G.mtimer <= 0) { G.mtimer = 0; if (G.trial) { G.over = true; VP.Audio.engine(0, false); VP.UI.trialEnd(); return; } return Game.fail('time'); }
  }
  if (G.free) {
    const a = G.car || G.cats[G.active]; let on = null;
    for (const mk of G.markers) if (U.d2(a.x, a.y, mk.x, mk.y) < 62 * 62) on = mk;
    if (on && G.onMarker !== on && !(G.car && Math.abs(G.car.spd) > 160)) VP.UI.marker(on);
    G.onMarker = on;
    // persist where the player is every few seconds
    G.saveT = (G.saveT || 0) + dt; if (G.saveT > 5 && !G.car && !G.trial) { G.saveT = 0; VP.S.pos = { x: Math.round(a.x), y: Math.round(a.y) }; VP.S.cash += G.stat.cash - (G.bank || 0); G.bank = G.stat.cash; VP.persist(); }
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
    G.step++;
    if (G.steps[G.step] && st.txt !== 'o_ready' && st.txt !== 'o_waveIn' && st.txt !== 'o_ambush') { VP.Audio.sfx('step'); G.objFlash = 1; }
  }
};
// what the HUD shows
M.objective = function (G) {
  if (G.free) { let b = null, bd = 1e12; const a = G.cats[G.active]; for (const mk of G.markers) if (mk.k === 'mission') { const d = U.d2(a.x, a.y, mk.x, mk.y); if (d < bd) { bd = d; b = mk; } } return { txt: VP.t(G.trial ? 'o_trial' : 'o_free'), at: b, cat: null, free: true }; }
  const st = G.steps[G.step];
  if (!st) return { txt: G.needRevive ? VP.t('o_reviveAll') : VP.t('o_done'), at: G.needRevive ? G.cats.find(c => c.down) : null, cat: null };
  return { txt: VP.t.apply(null, [st.txt].concat(st.args || [])), prog: st.prog ? st.prog() : null, at: st.at ? st.at() : null, cat: st.cat || null, car: !!st.car, step: st };
};
})();
