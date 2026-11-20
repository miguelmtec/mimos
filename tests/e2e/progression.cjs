// Progression wave: world size + soft edges, levels, inventory, upgrades, activities, creator, "Jogar com meu gato",
// story + gated neighbourhoods, shelter, city board, achievements, vehicles, neighbour tiles, first-load weight.
// Usage: node tests/e2e/progression.cjs [section]
const L = require('./lib.cjs'); const fs = require('fs');
const only = process.argv[2] || '';
let fails = 0; const ok = (name, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(extra === undefined ? '' : extra))); };
const sec = async (name, fn) => { if (only && only !== name) return; console.log('--- ' + name + ' ---'); await fn(); };
const WIN = `window.winNow = n => { const st0 = setTimeout; window.setTimeout = f => { f(); return 0; }; try { __vp.start(n); __vp.win(); } finally { window.setTimeout = st0; } return VP.UI.last(); };`;
const boot = async (mobile, opts) => { const r = await L.open(mobile, opts); await r.page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') }); await r.page.evaluate(() => { VP.Audio.sfx = () => {}; }); await r.page.addScriptTag({ content: WIN }); await r.page.waitForFunction(() => VP.Story.ready && VP.Long.data, null, { timeout: 10000 }); return r; };
(async () => {
  await L.serve();
  await sec('world', async () => {
    const { browser, page, errors } = await boot(false);
    const w = await page.evaluate(() => { __vp.unlockAll(); const W = VP.Missions.world(), n = {}; for (const l of W.lots) n[l.d] = (n[l.d] || 0) + 1; return { cols: W.cols, rows: W.rows, W: W.W, H: W.H, hoods: n, fish: W.fish.length, roles: [5, 6, 7, 8].map(d => Object.keys(W.roles[d]).length) }; });
    ok('home city is 18 x 12 blocks (was 12 x 8): 2.25x the blocks', w.cols === 18 && w.rows === 12, w);
    ok('walkable area more than doubled (tiles ' + w.W + ' x ' + w.H + ' vs 176 x 120)', w.W * w.H > 176 * 120 * 2.2, w);
    ok('four new neighbourhoods: boardwalk, lake park, industrial, hillside', w.hoods[5] === 24 && w.hoods[6] === 36 && w.hoods[7] === 36 && w.hoods[8] === 24, w.hoods);
    ok('story districts kept their size', w.hoods[0] === 16 && w.hoods[1] === 24 && w.hoods[2] === 16 && w.hoods[3] === 16 && w.hoods[4] === 24, w.hoods);
    ok('fishing piers exist', w.fish >= 20, w.fish);
    // walk into every edge: the prompt shows up and nobody is stuck (still connected to the city)
    const edges = await page.evaluate(() => {
      const W = VP.Missions.world(), T = 48, out = {}, I = VP.I;
      const from = { n: [9, 0, 330, 0, 0, -1], s: [2, 12, 330, 0, 0, 1], s2: [9, 12, 330, 0, 0, 1], w: [0, 6, 0, 330, -1, 0], w2: [0, 10, 0, 330, -1, 0], e: [18, 6, 0, 330, 1, 0], ne: [18, 0, 0, 0, 1, -1], sw: [0, 12, 0, 0, -1, 1], nw: [0, 0, 0, 0, -1, -1], se: [18, 12, 0, 0, 1, 1] };
      for (const k in from) {
        const f = from[k]; __vp.free({ x: W.RX[f[0]] + f[2], y: W.RY[f[1]] + f[3] }); const G = __vp.G; let seen = null, said = false;
        I.bot = () => { I.mx = f[4]; I.my = f[5]; I.attack = false; I.aim = null; I.ctxHeld = false; };
        for (let i = 0; i < 30 * 14; i++) { I.poll(); VP.Game.update(1 / 30); if (G.edge) seen = G.edge.side; if (G.banner && /viajar/.test(G.banner.txt)) said = true; }
        const hit = VP.Prog.hudHit(G, VP.HUD.w / 2, VP.HUD.h * 0.6 + 20);
        // walk back: the cat must be able to reach the arena again
        const home = W.front(W.roles[0].arena, 's'), g = W.grid.slice(); W.grid.set(W.pristine); const fld = W.field(home.x, home.y, 0); W.grid.set(g);
        const conn = G.cats.map(c => fld[Math.floor(c.y / T) * W.W + Math.floor(c.x / T)] >= 0);
        const a = G.cats[G.active]; I.bot = () => { const tmp = { x: 0, y: 0 }; W.fieldDir(fld, a.x, a.y, tmp); I.mx = tmp.x; I.my = tmp.y; I.attack = false; I.aim = null; I.ctxHeld = false; };
        const d0 = fld[Math.floor(a.y / T) * W.W + Math.floor(a.x / T)]; for (let i = 0; i < 30 * 6; i++) { I.poll(); VP.Game.update(1 / 30); }
        const d1 = fld[Math.floor(a.y / T) * W.W + Math.floor(a.x / T)];
        out[k] = { seen, said, hit, conn: conn.every(Boolean), back: d1 < d0 - 10, edgeGone: !G.edge };
      }
      I.bot = null; return out;
    });
    for (const k in edges) ok('edge ' + k + ': prompt shown, tappable, not stuck, can walk back', !!edges[k].seen && edges[k].said && edges[k].hit === 'edge' && edges[k].conn && edges[k].back && edges[k].edgeGone, edges[k]);
    const tr = await page.evaluate(() => { const W = VP.Missions.world(); __vp.free({ x: W.RX[2] + 330, y: W.RY[12] + 300 }); for (let i = 0; i < 10; i++) VP.Game.update(1 / 30); VP.Prog.edgeAct(__vp.G); return __vp.state().screen; });
    ok('edge prompt opens the World Tour', tr === 'world', tr);
    ok('world: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  await sec('cities', async () => {
    // real maps: every side ends in a soft edge with the travel prompt; neighbour tiles load when index.json lists them
    const idx = JSON.parse(fs.readFileSync(__dirname + '/../../public/data/cities/index.json', 'utf8'));
    const routes = async page => { await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })); await page.route('**/data/cities/index.json', r => { const j = JSON.parse(JSON.stringify(idx)); const c = j.cities.find(x => x.id === 'miami'); c.tiles = [{ id: 'miami_n', dir: 'n', file: 'miami.json', name: 'Miami Norte' }, { id: 'miami_e', dir: 'e', file: 'nope.json' }]; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); }); };
    const { browser, page, errors } = await boot(false, { routes });
    for (const c of idx.cities) {
      const r = await page.evaluate(async id => {
        __vp.unlockAll(); await VP.Tour.load(id); VP.UI.tour(id); const G = __vp.G, W = G.W, T = 48, out = {};
        const best = { n: [1e9], s: [-1e9], w: [1e9], e: [-1e9] };
        for (const i of W.walkList) { const x = i % W.W, y = Math.floor(i / W.W); if (y < best.n[0]) best.n = [y, x, y]; if (y > best.s[0]) best.s = [y, x, y]; if (x < best.w[0]) best.w = [x, x, y]; if (x > best.e[0]) best.e = [x, x, y]; }
        for (const k in best) { const b = best[k]; G.cats.forEach(c => { c.x = (b[1] + 0.5) * T; c.y = (b[2] + 0.5) * T; }); G.edge = null; G.edgeSaid = 0; for (let i = 0; i < 20; i++) VP.Game.update(1 / 30); out[k] = { edge: G.edge && G.edge.side, near: Math.min(b[1], b[2], W.W - b[1], W.H - b[2]), conn: W.conn[b[2] * W.W + b[1]] >= 0, hit: VP.Prog.hudHit(G, VP.HUD.w / 2, VP.HUD.h * 0.6 + 20) }; }
        return out;
      }, c.id);
      const bad = Object.keys(r).filter(k => !(r[k].conn && (r[k].near > 7 || (r[k].edge && r[k].hit === 'edge'))));
      ok(c.id + ': all four sides end in a soft edge with the travel prompt, connected to the streets', bad.length === 0, r);
    }
    const tiles = await page.evaluate(async () => {
      await VP.Tour.load('miami'); VP.UI.tour('miami'); const G = __vp.G, W = G.W, T = 48, o = {};
      let top = null; for (const i of W.walkList) { const y = Math.floor(i / W.W); if (!top || y < top[1]) top = [i % W.W, y]; }
      G.cats.forEach(c => { c.x = (top[0] + 0.5) * T; c.y = (top[1] + 0.5) * T; }); for (let i = 0; i < 5; i++) VP.Game.update(1 / 30);
      o.tile = G.edge && G.edge.tile && G.edge.tile.id; for (let i = 0; i < 100 && G.edge.tile.state === 'loading'; i++) await new Promise(r => setTimeout(r, 150)); o.state = G.edge.tile.state;
      VP.Prog.edgeAct(G); const G2 = __vp.G; o.now = G2.tour; o.y = G2.cats[0].y / G2.W.ph; o.missions = VP.Missions.tourMissions('miami_n').length; o.markers = G2.markers.filter(m => m.k === 'mission').length;
      // and back south into the main tile
      let bot = null; for (const i of G2.W.walkList) { const y = Math.floor(i / G2.W.W); if (!bot || y > bot[1]) bot = [i % G2.W.W, y]; }
      G2.cats.forEach(c => { c.x = (bot[0] + 0.5) * T; c.y = (bot[1] + 0.5) * T; }); for (let i = 0; i < 5; i++) VP.Game.update(1 / 30); o.backTile = G2.edge && G2.edge.tile && G2.edge.tile.id;
      // a listed tile whose file is missing falls back to the soft edge
      const te = VP.Tour.neighbor('miami', 'e'); o.missing = te && (await VP.Tour.loadTile(te.id)) === null ? 'soft' : 'loaded'; o.none = VP.Tour.neighbor('miami', 's');
      return o;
    });
    ok('neighbour tile listed in index.json loads at the edge and the cats walk across', tiles.tile === 'miami_n' && tiles.state === 'ready' && tiles.now === 'miami_n' && tiles.y > 0.7, tiles);
    ok('neighbour tile has no missions of its own and leads back to the main tile', tiles.missions === 0 && tiles.markers === 0 && tiles.backTile === 'miami', tiles);
    ok('missing neighbour file (or no neighbour listed) leaves the soft edge', tiles.missing === 'soft' && tiles.none === null, tiles);
    ok('cities: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  await sec('progression', async () => {
    const { browser, page, errors } = await boot(true);
    const r = await page.evaluate(() => {
      const P = VP.Prog, o = {}; __vp.unlockAll();
      o.fresh = [P.v('boltDmg'), P.v('biteDmg'), P.v('stealCd'), P.v('bolts'), P.v('hp_mimosa'), P.level('mimo').lv];
      const res = winNow(1); o.win = res.win; o.xp = Object.assign({}, P.S().xp); o.inv = Object.assign({}, P.S().inv); o.last = VP.UI.last && VP.UI.last();
      // level-ups change the stats
      P.addXp('mimo', 5000); P.addXp('mimosa', 5000); P.addXp('morticia', 5000); P.recalc();
      o.lv = P.CATS.map(n => P.level(n).lv); o.grown = [P.v('boltDmg'), P.v('energyCost'), P.v('biteDmg'), P.v('hp_mimosa'), P.v('stealCd'), P.v('feastR')];
      __vp.start(2); o.hp = __vp.G.cats.map(c => c.max);
      // inventory + consumables
      const G = __vp.G; P.S().inv = {}; o.give = P.give('racao', 3); o.cap = [P.give('sache', 99), P.cap()];
      G.cats[0].energy = 5; G.cats[0].exhausted = true; o.useRacao = P.use('racao', G); o.energy = G.cats[0].energy; o.left = P.count('racao');
      G.cats[1].hp = 20; P.use('sache', G); o.healed = G.cats[1].hp > 20;
      P.give('omega', 1); P.use('omega', G); o.omega = G.omega > 0; P.give('catnip', 1); P.use('catnip', G); o.catnip = G.catnip > 0;
      P.give('leite', 1); G.cats[2].root = 2; P.use('leite', G); o.milk = G.cats[2].root === 0;
      o.noneLeft = P.use('omega', G);
      // quick slots on the HUD are touch targets
      const b = P.hudLayout(G); o.slot = b.q0.r * 2; o.hit = P.hudHit(G, b.q1.x, b.q1.y); o.hitInv = P.hudHit(G, b.inv.x, b.inv.y);
      // upgrades: bought with coins, gated by level and order
      VP.S.cash = 0; o.poor = P.canBuy('m_a1'); VP.S.cash = 5000; o.prev = P.canBuy('m_a2'); o.buy = P.buy('m_a1'); o.bolts = P.v('bolts'); o.cashLeft = VP.S.cash;
      P.buy('m_a2'); P.buy('s_a1'); P.buy('s_a2'); P.buy('c_a1'); P.buy('c_a2'); o.tri = P.v('bolts'); o.spin = P.v('spin'); o.pocket = P.cap();
      __vp.start(2); const G2 = __vp.G; VP.I.bot = () => { VP.I.mx = VP.I.my = 0; VP.I.attack = true; VP.I.aim = 0; }; VP.I.poll(); for (let i = 0; i < 4; i++) VP.Game.update(1 / 30); o.bullets = G2.bullets.filter(x => x.k === 'bolt').length; VP.I.bot = null;
      o.save = JSON.stringify(VP.S.prog).length; VP.persist(); o.stored = JSON.parse(localStorage.getItem('vp_save_v4')).prog.up.m_a2;
      o.shop = Object.keys(VP.Shop.PRICE || {}).join(',');
      return o;
    });
    ok('fresh save: every stat is neutral', r.fresh.join() === '1,1,1,1,1,1', r.fresh);
    ok('winning a mission gives XP to the three cats and a drop', r.win && r.xp.mimo > 0 && r.xp.mimosa > 0 && r.xp.morticia > 0 && Object.keys(r.inv).length >= 1, [r.xp, r.inv]);
    ok('levels grow the role stats (blaster/energy, bite/toughness, steal speed/feast radius)', r.lv.every(l => l > 5) && r.grown[0] > 1 && r.grown[1] < 1 && r.grown[2] > 1 && r.grown[3] > 1 && r.grown[4] < 1 && r.grown[5] > 1, [r.lv, r.grown]);
    ok('max health follows the level', r.hp[1] > 150 && r.hp[0] > 100, r.hp);
    ok('inventory: items stack up to the cap', r.give === 3 && r.cap[0] === r.cap[1], r);
    ok('ração restores energy and is consumed', r.useRacao && r.energy === 100 && r.left === 2, r);
    ok('sachê heals, ômega 3 shields, catnip speeds, leite frees', r.healed && r.omega && r.catnip && r.milk, r);
    ok('an empty slot does nothing', r.noneLeft === false);
    ok('quick slots are touch friendly and hit-testable', r.slot >= 42 && r.hit === 'q1' && r.hitInv === 'inv', r);
    ok('upgrades cost coins, need the previous tier', r.poor === 'cash' && r.prev === 'prev' && r.buy === true && r.bolts === 2 && r.cashLeft === 4700, r);
    ok('Bolhas Triplas, Mordida Giratória, Bolso Sem Fundo take effect', r.tri === 3 && r.spin === 1 && r.pocket === 12 && r.bullets === 3, r);
    ok('progression is part of the normal save', r.stored === 1 && r.save < 2000, r);
    ok('the shop sells no stats, XP, items or upgrades', !/xp|upgrade|racao|omega|sache|catnip|leite|level|coin/i.test(r.shop), r.shop);
    const ui = await page.evaluate(() => { const o = {}; __vp.free(); VP.UI.act.inv(); o.inv = document.querySelectorAll('.pg-item').length; VP.UI.act.upg(); o.nodes = document.querySelectorAll('.pg-node').length; VP.UI.act.resume(); VP.UI.act.acts(); o.acts = [...document.querySelectorAll('.pg-act')].map(e => e.className.replace('pg-act k-', '')); VP.UI.act.actGo({ dataset: { i: '0' } }); o.guide = !!__vp.G.guide; o.ob = VP.Missions.objective(__vp.G).txt; VP.Prog.openFeira(); o.feira = document.querySelectorAll('.pg-item').length; VP.S.cash = 1000; const id = VP.Prog.feira().list[0].id, n0 = VP.Prog.count(id); VP.UI.act.feBuy({ dataset: { id } }); o.bought = VP.Prog.count(id) - n0; o.cash = VP.S.cash; return o; });
    ok('backpack lists the five consumables, tree shows six nodes per cat', ui.inv === 5 && ui.nodes === 6, ui);
    ok('activities panel lists missions, patrols, fishing, races, paws, favours, market', ['mission', 'patrol', 'fish', 'race', 'paw', 'npc', 'feira', 'tour'].every(k => ui.acts.includes(k)), ui.acts);
    ok('picking an activity sets a guided goal with an arrow', ui.guide && /^➡/.test(ui.ob), ui);
    ok('Feira de Petiscos sells consumables for coins', ui.feira === 4 && ui.bought === 1 && ui.cash < 1000, ui);
    const loop = await page.evaluate(() => {
      const o = {}, P = VP.Prog; __vp.free(); const G = __vp.G, pat = G.patrols[0], a = G.cats[G.active]; o.patrols = G.patrols.length; const cash0 = G.stat.cash, n0 = P.S().stats.patrols;
      for (const e of pat.dogs) VP.Game.hurtDogFx(e, 99999, 'bite', e.x, e.y, 0); for (let i = 0; i < 10; i++) VP.Game.update(1 / 30); o.patrolDone = pat.done && G.stat.cash > cash0 && P.S().stats.patrols === n0 + 1; o.drop = G.items.some(i => i.k.slice(0, 2) === 'c_' && Math.hypot(i.x - pat.x, i.y - pat.y) < 200);
      const f = G.fishSpots[0]; G.cats.forEach(c => { c.x = f.x; c.y = f.y; }); P.fishStart(G, f); G.fishing.t = 0.01; VP.I.bot = () => { VP.I.mx = VP.I.my = 0; VP.I.attack = G.fishing && G.fishing.phase === 'bite' && G.fishing.t < 1; }; const c0 = G.stat.cash;
      for (let i = 0; i < 90 && G.stat.cash === c0; i++) { VP.I.poll(); VP.Game.update(1 / 30); } VP.I.bot = null; o.fish = G.stat.cash > c0; void a; return o;
    });
    ok('dog-catcher patrol: beating it pays coins and drops an item', loop.patrols >= 3 && loop.patrolDone && loop.drop, loop);
    ok('fishing spot pays out on a timed tap', loop.fish, loop);
    const next = await page.evaluate(() => { VP.S.stars = {}; VP.S.unlocked = 1; VP.Missions.allOpen = false; const r = __bot.run(1, 200); VP.UI.result(true); const st0 = setTimeout; return { win: r.win }; });
    await page.evaluate(() => { VP.Missions.allOpen = false; VP.S.unlocked = 1; VP.S.stars = {}; __vp.start(1); __vp.win(); }); await page.waitForFunction(() => __vp.state().screen === 'result', null, { timeout: 8000 });
    const res = await page.evaluate(() => ({ next: !!document.querySelector('[data-act=start][data-n="2"]'), text: document.querySelector('#s-result').textContent, city: !!document.querySelector('[data-act=play]') }));
    ok('result screen: "Próxima missão", XP, drop and a way back to the city', next.win && res.next && /XP/.test(res.text) && res.city, res.text.slice(0, 200));
    await page.evaluate(() => VP.UI.act.play()); await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const G = __vp.G, ob = VP.Missions.objective(G); return { free: G.free, at: !!ob.at, n: ob.at && ob.at.n, txt: ob.txt }; });
    ok('after a mission: free roam with the next mission beam as the goal', after.free && after.at && after.n === 2, after);
    ok('progression: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  await sec('creator', async () => {
    const { browser, page, errors } = await boot(true);
    const t0 = await page.evaluate(() => ({ btn: !!document.querySelector('[data-act=myCat]'), card: !!document.querySelector('.pg-card') }));
    ok('title: "Crie seu gato" button and a first-launch card', t0.btn && t0.card, t0);
    await page.locator('.pg-card [data-act=myCat]').click({ force: true }); await page.waitForTimeout(500);
    const c1 = await page.evaluate(() => ({ screen: VP.UI.screen, looks: document.querySelectorAll('[data-act=crLook]').length, pats: document.querySelectorAll('[data-k=pattern]').length, furs: document.querySelectorAll('[data-act=crCol][data-k=furBase]').length, eyes: document.querySelectorAll('[data-act=crCol][data-k=eyeColor]').length, ears: document.querySelectorAll('[data-k=ears]').length, tails: document.querySelectorAll('[data-k=tail]').length, roles: document.querySelectorAll('[data-k=role]').length, sliders: document.querySelectorAll('#s-creator input[type=range]').length }));
    ok('creator opens from the title with presets, coats, colours, ears, tails, fur length, size and role', c1.screen === 'creator' && c1.looks === 10 && c1.pats === 8 && c1.furs === 13 && c1.eyes === 8 && c1.ears === 5 && c1.tails === 5 && c1.roles === 3 && c1.sliders === 2, c1);
    await page.fill('#cname', 'Pipoca');
    const tap = async s => { await page.locator(s).first().click({ force: true }); await page.waitForTimeout(250); };
    await tap('[data-act=crLook][data-v=tricolor]'); await tap('[data-k=ears][data-v=fold]'); await tap('[data-k=tail][data-v=bob]'); await tap('[data-act=crCol][data-k=eyeColor][data-v="#3fa9f5"]'); await tap('[data-act=crOdd]'); await tap('[data-k=role][data-v=glutton]');
    const kept = await page.evaluate(() => document.getElementById('cname').value);
    ok('the name survives every tap', kept === 'Pipoca', kept);
    await L.shot(page, 'v6-creator-m');
    await tap('[data-act=crPlay]'); await page.waitForTimeout(400); await page.evaluate(() => { if (VP.UI.screen === 'story') VP.UI.act.syEnd(); }); await page.waitForTimeout(900);
    const g = await page.evaluate(() => { const G = __vp.G, sp = VP.R3.catSpec('morticia', G); return { play: __vp.state().state, party: VP.S.party, names: G.cats.map(c => VP.t(c.name)), sp: [sp.pattern, sp.ears, sp.tail, sp.eye, sp.eye2, sp.tongue], mimo: VP.R3.catSpec('mimo', G).tool, active: G.active, hudImg: !!VP.Party.portrait('morticia'), local: VP.S.avatarLocal && VP.S.avatarLocal.spec.role }; });
    ok('"Salvar e jogar": my cat is the glutton of the team, with its looks', g.play === 'play' && g.party.on && g.party.role === 'morticia' && g.names[2] === 'Pipoca' && g.sp[0] === 'calico' && g.sp[1] === 'fold' && g.sp[2] === 'bob' && g.sp[3] === '#3fa9f5' && !!g.sp[4] && g.local === 'glutton', g);
    ok('the other two stay the stars; portraits follow', g.names[0] === 'Mimo' && g.names[1] === 'Mimosa' && g.mimo === 'blaster' && g.hudImg, g);
    await page.waitForTimeout(700); await L.shot(page, 'v6-mycat-play-m');
    const p2 = await page.evaluate(() => { VP.UI.show('party'); const o = { roles: document.querySelectorAll('[data-act=paRole]').length, comps: document.querySelectorAll('[data-act=paComp]').length }; VP.UI.act.paRole({ dataset: { n: 'mimo' } }); VP.UI.act.paComp({ dataset: { s: 'mimosa', id: 'frajola' } }); o.role = VP.S.party.role; o.names = ['mimo', 'mimosa', 'morticia'].map(n => VP.t(n)); o.spec = VP.R3.catSpec('mimosa', null).pattern; o.tool = VP.R3.catSpec('mimo', null).tool; VP.UI.act.paOff(); o.off = ['mimo', 'mimosa', 'morticia'].map(n => VP.t(n)); o.star = VP.R3.catSpec('mimo', null).pattern; return o; });
    ok('party screen: change role, pick up to two companion presets', p2.roles === 3 && p2.comps === 14 && p2.role === 'mimo' && p2.names[0] === 'Pipoca' && p2.names[1] === 'Frajola' && p2.spec === 'tuxedo' && p2.tool === 'blaster', p2);
    ok('back to the original trio in one tap (default for guests and the owner)', p2.off.join() === 'Mimo,Mimosa,Mortícia' && p2.star === 'points', p2);
    const m = await page.evaluate(() => { VP.UI.act.paOn(); __vp.unlockAll(); const r = __bot.run(1, 200); return r.win; });
    ok('missions are winnable with my cat in the team', m === true);
    ok('creator: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  await sec('story', async () => {
    const { browser, page, errors } = await boot(true);
    await page.locator('[data-act=play]').first().click({ force: true }); await page.waitForTimeout(400);
    const s0 = await page.evaluate(() => ({ screen: VP.UI.screen, img: document.querySelectorAll('.sy-art img').length, skip: !!document.querySelector('[data-act=syEnd]') }));
    ok('first play opens the story cards with portrait art and a skip button', s0.screen === 'story' && s0.img >= 1 && s0.skip, s0);
    await page.locator('[data-act=syNext]').click({ force: true }); await page.waitForTimeout(200); await page.locator('[data-act=syEnd]').click({ force: true }); await page.waitForTimeout(700);
    const g = await page.evaluate(() => { const G = __vp.G, ob = VP.Missions.objective(G); for (let i = 0; i < 5; i++) VP.Game.update(1 / 30); return { free: G.free, txt: ob.txt, at: !!ob.at, locked: Object.keys(G.lockedHoods || {}).map(Number), works: G.props.filter(p => p.k === 'works').length, signs: G.markers.filter(m => m.k === 'works').map(m => m.lbl)[0], shelter: G.props.find(p => p.k === 'shelter').stage, intro: VP.S.story.seen.intro }; });
    ok('free roam shows the chapter goal with an arrow target', g.free && /potinhos/.test(g.txt) && g.at && g.intro === 1, g);
    ok('closed neighbourhoods are fenced with "Em obras — termine o capítulo N" barriers', g.locked.join() === '1,2,3,4,6,7,8' && g.works > 20 && /Em obras — termine o capítulo/.test(g.signs), g);
    const stuck = await page.evaluate(() => { const G = __vp.G, W = G.W, T = 48, I = VP.I, out = []; for (const dir of [[0, -1], [1, 0]]) { const s = W.front(W.roles[0].arena, 's'); G.cats.forEach(c => { c.x = s.x; c.y = s.y; }); I.bot = () => { I.mx = dir[0]; I.my = dir[1]; I.attack = false; I.aim = null; }; for (let i = 0; i < 30 * 25; i++) { I.poll(); VP.Game.update(1 / 30); } const a = G.cats[G.active]; out.push(VP.World.distAt(W, a.x, a.y)); } I.bot = null; return out; });
    ok('barriers hold: walking north or east stays in the open area', stuck.every(d => d === 0 || d === 5), stuck);
    await L.shot(page, 'v6-works-m');
    const ch = await page.evaluate(() => { const st0 = setTimeout; window.setTimeout = f => { f(); return 0; }; VP.S.unlocked = 10; for (let n = 1; n < 10; n++) VP.S.stars[n] = 1; __vp.start(10); __vp.win(); window.setTimeout = st0; const o = { screen: VP.UI.screen, title: document.querySelector('.sy-card .small').textContent }; VP.UI.act.syEnd(); o.then = VP.UI.screen; o.stage = VP.Story.stage(); VP.UI.act.play(); const G = __vp.G; o.locked = Object.keys(G.lockedHoods || {}).map(Number); o.shelter = G.props.find(p => p.k === 'shelter').stage; o.cap = VP.Long.cap(); return o; });
    ok('beating the chapter boss plays its cards, then the result', ch.screen === 'story' && /Capítulo 1/.test(ch.title) && ch.then === 'result', ch);
    ok('chapter 1 done: Downtown and the lake park open, the shelter grows, places open', ch.stage === 1 && ch.locked.join() === '2,3,4,7,8' && ch.shelter === 1 && ch.cap === 3, ch);
    const hint = await page.evaluate(() => { const st0 = setTimeout; window.setTimeout = f => { f(); return 0; }; __vp.start(11); __vp.fail('time'); const a = !!document.querySelector('[data-act=syHint]'); __vp.start(11); __vp.fail('time'); const o = { first: a, hint: !!document.querySelector('[data-act=syHint]'), easy: !!document.querySelector('[data-act=syEasy]') }; VP.UI.act.syHint({ dataset: { n: '11' } }); o.txt = document.getElementById('sy-hint').textContent; VP.UI.act.syEasy({ dataset: { n: '11' } }); window.setTimeout = st0; const G = __vp.G; o.diff = G.hpMul; o.easy2 = G.easy; o.normal = 1 + VP.Game.eff(11) * 0.016; return o; });
    ok('two failures offer a "Dica" and a gentler mode', !hint.first && hint.hint && hint.easy && hint.txt.length > 20 && hint.easy2 && hint.diff < hint.normal * 0.75, hint);
    const cal = await page.evaluate(async () => { const St = VP.Story, o = {}; o.open = St.hoodOpen(1); St.cal.releases.push({ id: 'hood:1', date: '2999-01-01' }, { id: 'district:7', date: '2999-01-01' }); o.dated = St.hoodOpen(1); o.txt = St.lockText(1); VP.S.stars[1] = 3; VP.S.stars[2] = 3; VP.S.stars[3] = 3; o.chap = VP.Missions.distOpen(VP.Missions.dist(7)); St.cal.releases.length = 0; o.chap2 = VP.Missions.distOpen(VP.Missions.dist(7)); St.com.goals.push({ id: 't', need: 10, opens: 'hood:1', name: { pt: 'x', en: 'x' } }); o.com = St.hoodOpen(1); St.com.total = 10; o.com2 = St.hoodOpen(1); o.row = !!St.communityRow(); await St.pullCommunity(); return o; });
    ok('release calendar: a future date keeps a neighbourhood or chapter closed', cal.open && !cal.dated && /abre em 01\/01/.test(cal.txt) && !cal.chap && cal.chap2, cal);
    ok('community goals: an area opens when the shared counter reaches its target', !cal.com && cal.com2 && cal.row, cal);
    ok('story: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  await sec('longterm', async () => {
    const { browser, page, errors } = await boot(true);
    const r = await page.evaluate(() => {
      const Lg = VP.Long, P = VP.Prog, o = {}; o.variants = Lg.data.cats.length; o.breeds = Lg.data.breeds.length; o.rare = Lg.data.cats.filter(c => c.rarity === 2).length;
      o.cap0 = Lg.cap(); o.closed = Lg.rescue(Lg.data.cats[0], 't'); __vp.unlockAll(); o.cap = Lg.cap();
      const rr = VP.U.rng(5); let rareFromMissions = 0; for (let i = 0; i < 400; i++) if (Lg.pick(rr, false).rarity === 2) rareFromMissions++; o.rareFromMissions = rareFromMissions;
      const got = Lg.rescue(Lg.data.cats[0], 't'); o.new = got.isNew; const cash0 = VP.S.cash; o.care = Lg.doCare(0, 'feed'); o.twice = Lg.doCare(0, 'feed'); o.wait = Lg.doCare(0, 'brush'); o.early = Lg.findHome(0);
      const c = VP.S.long.res[0]; for (const a of Lg.data.care) { c.care = {}; for (const k of Object.keys(c.care)) delete c.care[k]; } c.care = {}; c.n = 0; for (const a of Lg.data.care) { for (const k in c.care) c.care[k] = 1; Lg.doCare(0, a.id); } o.n = c.n; const h = Lg.findHome(0); o.home = !!h && VP.S.cash > cash0; o.album = VP.S.long.album[Lg.data.cats[0].id]; o.left = VP.S.long.res.length;
      // strays in free roam, with a rare one among them
      __vp.free(); const G = __vp.G; o.strays = (G.strays || []).map(s => s.def.rarity); const s0 = G.strays[0]; s0.act(); o.strayGot = VP.S.long.res.length === 1 && !G.markers.includes(s0);
      // endless board
      const b0 = Lg.boardMission(0), b1 = Lg.boardMission(0), b40 = Lg.boardMission(40); o.board = [b0.n, b0.type === b1.type, b40.lv >= b0.lv, VP.Missions.get(6003).board]; const run = winNow(6001); o.boardWin = run.win; o.boardDone = VP.S.long.board.done[1] > 0; o.noStar = VP.S.stars[6001] === undefined; o.cnt = VP.S.long.cnt.board;
      // mastery + achievements + weekly points
      const g1 = winNow(1); o.week = VP.S.long.week.pts > 0; o.gold = Lg.goldTime(VP.Missions.get(1)); o.total = Lg.ACH.length * 6; o.ach = Lg.achCount();
      o.max = P.MAXLV; o.tiers = [1, 19, 20, 40, 60, 80, 100].map(l => P.tier(l).id); o.power = P.power(); P.addXp('mimo', 1e7); o.lv100 = P.level('mimo'); P.recalc(); o.cap100 = P.v('boltDmg');
      VP.UI.show('profile'); o.profile = document.querySelectorAll('.pf-cat').length; VP.UI.show('ach'); o.rows = document.querySelectorAll('.ah-row').length; VP.UI.show('album'); o.cells = document.querySelectorAll('.lg-cell').length; void g1;
      return o;
    });
    ok('album: 72 variants of 12 breeds, 12 rare', r.variants === 72 && r.breeds === 12 && r.rare === 12, r);
    ok('shelter is shut before chapter 1 and has places after', r.cap0 === 0 && r.closed === null && r.cap === 7, r);
    ok('rare variants never come from missions or patrols (exploring only)', r.rareFromMissions === 0, r.rareFromMissions);
    ok('care: one action at a time, four to be ready, then a home with a reward', r.care && !r.twice && !r.wait && r.early === null && r.n === 4 && r.home && r.album.homes === 1 && r.left === 0, r);
    ok('strays wander the city every day, one of them rare; walking up rescues', r.strays.length === 3 && r.strays[0] === 2 && r.strayGot, r);
    ok('Missões da Cidade: endless, seeded per day, scaling, outside the ranking', r.board[0] === 6000 && r.board[1] && r.board[2] && r.board[3] === 3 && r.boardWin && r.boardDone && r.noStar && r.cnt === 1, r);
    ok('100+ achievements, weekly points, gold time per mission', r.total >= 100 && r.ach > 0 && r.week && r.gold > 0, r);
    ok('levels go to 100 with Bronze/Prata/Ouro/Diamante/Lenda tiers and a Poder number', r.max === 100 && r.tiers.join() === 'bronze,bronze,prata,ouro,diamante,lenda,lenda' && r.power > 0 && r.lv100.lv === 100 && r.cap100 < 1.8, r);
    ok('profile, achievements and album screens render', r.profile === 3 && r.rows === 18 && r.cells === 72, r);
    const so = await page.evaluate(() => { const So = VP.Social, o = {}; VP.Acct.gallery = [{ id: 'a', name: 'Nina', breed: 'siames', spec: { pattern: 'pointed', accessories: ['bow'] } }, { id: 'b', name: 'Bob', breed: 'srd', spec: { pattern: 'solid', accessories: [] } }]; VP.UI.show('style'); o.rows = document.querySelectorAll('#s-style .pg-item').length; o.l1 = So.like('b'); o.l2 = So.like('a'); VP.UI.show('style'); o.first = document.querySelectorAll('#s-style .pg-item b')[1].textContent; VP.UI.show('rank'); o.rank = /Poder|Power/.test(document.querySelector('#s-rank').textContent); return o; });
    ok('"Mais Bonitos": style board, one like per day, levels shown on the ranking', so.rows === 3 && so.l1 && !so.l2 && so.first === 'Bob' && so.rank, so);
    ok('longterm: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  await sec('vehicles', async () => {
    const { browser, page, errors } = await boot(true);
    const r = await page.evaluate(() => {
      const V = VP.Veh, o = {}; o.locked = V.ORDER.map(k => V.unlocked(k)); __vp.unlockAll(); __vp.free(); const G = __vp.G, W = G.W, T = 48;
      o.parked = VP.vehicles.list().reduce((m, v) => { m[v.type] = (m[v.type] || 0) + 1; return m; }, {}); o.api = VP.vehicles.types().length; o.garage = !!G.garage;
      // boat: water only, exit only by a pier
      const boat = G.cars.find(c => c.veh === 'lancha'); G.cats.forEach(c => { c.x = boat.x; c.y = boat.y - 50; }); VP.Game.enterCar(boat); const y0 = boat.y;
      VP.I.bot = () => { VP.I.mx = 0; VP.I.my = 1; VP.I.attack = false; VP.I.aim = null; }; for (let i = 0; i < 90; i++) { VP.I.poll(); VP.Game.update(1 / 30); } o.sailed = boat.y > y0 + 150; VP.Game.exitCar(); o.noExitAtSea = G.car === boat;
      VP.I.bot = () => { VP.I.mx = 0; VP.I.my = -1; }; for (let i = 0; i < 240; i++) { VP.I.poll(); VP.Game.update(1 / 30); } o.landBlocks = W.grid[Math.floor(boat.y / T) * W.W + Math.floor(boat.x / T)] === 2 || boat.y > W.H * T; VP.Game.exitCar(); o.exitAtPier = !G.car && W.grid[Math.floor(G.cats[0].y / T) * W.W + Math.floor(G.cats[0].x / T)] === 0;
      // helicopter: flies over buildings, altitude capped, soft edge, lands on a street
      const s = W.front(W.roles[0].arena, 's'), bl = W.lot(0, 8); G.cats.forEach(c => { c.x = s.x; c.y = s.y; }); const h = V.spawn('heli', bl.cx - 330, bl.cy, 0); VP.Game.enterCar(h);
      let overRoof = false, maxAlt = 0; VP.I.bot = () => { VP.I.mx = G.real % 1e9 < 0 ? 0 : (h.x < bl.cx + 500 && !h.south ? 1 : 0); VP.I.my = h.x >= bl.cx + 500 || h.south ? (h.south = 1) : 0; }; for (let i = 0; i < 30 * 40; i++) { VP.I.poll(); VP.Game.update(1 / 30); maxAlt = Math.max(maxAlt, h.alt); if (W.grid[Math.floor(h.y / T) * W.W + Math.floor(h.x / T)] === 1) overRoof = true; }
      o.overRoof = overRoof; o.alt = maxAlt; o.inMap = h.y < (W.H + 15) * T; o.edge = !!G.edge; VP.Game.exitCar(); o.noExitSea = G.car === h; h.x = s.x + 60; h.y = s.y; VP.Game.exitCar(); o.landed = !G.car && W.grid[Math.floor(G.cats[0].y / T) * W.W + Math.floor(G.cats[0].x / T)] === 0;
      VP.I.bot = null; G.cats.forEach(c => { c.x = s.x; c.y = s.y; }); const k = V.summon('moto', G); o.summon = !!k && Math.hypot(k.x - s.x, k.y - s.y) < 200; VP.UI.act.garage(); o.rows = document.querySelectorAll('#s-garage .pg-item').length; o.chal = document.querySelectorAll('#s-garage .mrow').length;
      return o;
    });
    ok('vehicles unlock by level (kart from the start, helicopter later)', r.locked.join() === 'true,false,false,false,false', r.locked);
    ok('vehicles are parked in the districts; garage marker; VP.vehicles API', r.parked.kart >= 5 && r.parked.bike >= 5 && r.parked.moto >= 5 && r.parked.lancha >= 3 && r.parked.heli >= 1 && r.api === 5 && r.garage, r);
    ok('lancha: sails on water, blocked by land, gets off only at a pier', r.sailed && r.noExitAtSea && r.landBlocks && r.exitAtPier, r);
    ok('helicóptero: flies over roofs, capped height, stays near the map, lands on a street', r.overRoof && r.alt > 10 && r.alt <= 15.01 && r.inMap && r.edge && r.landed, r);
    ok('garage summons a vehicle next to the cats and lists 5 vehicles + 5 challenges', r.summon && r.rows === 5 && r.chal === 5, r);
    for (const n of [5000, 5001, 5002, 5003, 5004]) { const w = await page.evaluate(n => __bot.run(n, 300), n); ok('vehicle challenge ' + n + ' (' + w.type + ') is winnable', w.win === true, w); }
    ok('vehicles: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  await sec('rewards', async () => {
    // guest: common finds only, no rare claim; the Mimos wear nothing they did not earn
    { const { browser, page, errors } = await boot(true);
      await page.waitForFunction(() => VP.Rewards.cfg && VP.Mimos.data, null, { timeout: 8000 });
      const g = await page.evaluate(async () => { const o = {}, Rw = VP.Rewards, Mm = VP.Mimos, Wd = VP.Wardrobe; __vp.unlockAll(); __vp.free(); const G = __vp.G; o.caches = G.caches.length; o.gold = G.caches.filter(c => c.cache.premium).length; o.natal = Rw.cfg.caches.filter(c => c.month === 12).length;
        const it = G.caches[0], cash = VP.S.cash; G.cats[0].x = it.x; G.cats[0].y = it.y; G.active = 0; for (let i = 0; i < 20; i++) VP.Game.update(1 / 30); await new Promise(r => setTimeout(r, 200)); o.opened = VP.S.rw.caches[it.cache.id] === 1 && VP.S.cash >= cash + 60; o.rare = VP.S.rw.items.length; o.hiddenPiece = VP.S.owned.filter(x => x.startsWith('mm_')).length;
        o.items = Mm.data.items.length; o.inWardrobe = Wd.data.items.filter(i => i.line === 'mimos').length; const leg = Wd.data.items.find(i => i.id === 'mm_coroa_lanche'), coin = Wd.data.items.find(i => i.id === 'mm_pijama'), ach = Wd.data.items.find(i => i.id === 'mm_caneca');
        o.guestOwns = [Wd.owns(leg), Wd.owns(coin), Wd.owns(ach), Mm.isAdmin()]; VP.S.wear = { morticia: { head: 'mm_coroa_lanche' } }; o.gated = !VP.R3.spec('morticia', false).acc.crown; o.how = [Mm.howText(leg), Mm.howText(coin), Mm.howText(ach)];
        const lk = window.getMimosShowcaseLook(); o.look = lk && [lk.id, Object.keys(lk.cats).length, !!lk.cats.mimo.spec.fur, lk.cats.morticia.items.length]; o.rot = new Set([0, 1, 2, 3].map(w => Mm.look(new Date(2026, 1, 2 + w * 7)).id)).size; o.dec = Mm.look(new Date(2026, 11, 10)).id;
        VP.UI.show('title'); o.card = !!document.querySelector('[data-act=look]'); VP.UI.show('look'); o.rows = document.querySelectorAll('#s-look .pg-item').length; VP.UI.show('rarity'); o.rar = document.querySelectorAll('#s-rarity .pg-item').length; return o; });
      ok('hidden caches in the city (golden ones hidden from non-premium); 25 Natal gifts in the data', g.caches >= 8 && g.gold === 0 && g.natal === 25, g);
      ok('guest opening a cache: a common find, never a rare item; one hidden Coleção piece', g.opened && g.rare === 0 && g.hiddenPiece === 1, g);
      ok('Coleção Mimos: 30+ items merged into the wardrobe', g.items >= 30 && g.inWardrobe === g.items, g);
      ok('guests do not own the collection; wearing an unowned piece falls back to the default', g.guestOwns.join() === 'false,false,false,false' && g.gated, g);
      ok('"Quero esse look": every piece says how to get it (coins, achievement, rare reward)', /moedas/.test(g.how[1]) && /conquista/.test(g.how[2]) && g.how[0].length > 10 && g.card && g.rows >= 6, g);
      ok('getMimosShowcaseLook(): specs for the three cats, rotating weekly, Natal in December', g.look[1] === 3 && g.look[2] && g.rot === 4 && g.dec === 'natal', g);
      ok('Raridade page lists every special item', g.rar >= 10, g);
      ok('rewards (guest): zero console errors', errors.length === 0, errors.slice(0, 3));
      await browser.close(); }
    // logged in as the owner: full wardrobe; claims go to the server and come back with a serial
    { const calls = []; const routes = async page => page.route('**/api/**', r => { const u = new URL(r.request().url()), j = (st, b) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(b) });
        if (u.pathname === '/api/me') return j(200, { user: { id: 'u1', email: 'dono@x.com', admin: true }, cats: [] }); if (u.pathname === '/api/rewards/claim') { const b = JSON.parse(r.request().postData()); calls.push(b); return j(200, b.source === 'mission' ? { item: { id: 'coleira_neon', tier: 'raro', name: { pt: 'Coleira Neon', en: 'Neon Collar' }, icon: '📿' }, serial: 7, cap: 23, season: '2026-natal' } : { consolation: { coins: 150, tier: 'raro' } }); }
        if (u.pathname === '/api/rewards/rarity') return j(200, { season: '2026-natal', active: 230, items: [{ id: 'coleira_neon', tier: 'raro', minted: 7, cap: 23, firstOwner: 'Pipoca' }], vault: { orders: 20, goal: 50, fills: 0, filledAt: null } }); if (u.pathname === '/api/rewards/mine') return j(200, { items: calls.some(c => c.source === 'mission') ? [{ id: 'coleira_neon', tier: 'raro', serial: 7, minted: 23, season: '2026-natal' }] : [] }); if (u.pathname === '/api/save') return j(200, { data: null }); return j(200, { cats: [], top: [] }); });
      const { browser, page, errors } = await boot(true, { routes });
      await page.waitForFunction(() => VP.Acct.status === 'in' && VP.Rewards.cfg && VP.Mimos.data, null, { timeout: 8000 });
      const a = await page.evaluate(async () => { const o = {}, Wd = VP.Wardrobe; o.admin = VP.Mimos.isAdmin(); o.all = Wd.data.items.every(i => Wd.owns(i)); VP.S.wear = { morticia: { head: 'mm_coroa_lanche' } }; o.wears = !!VP.R3.spec('morticia', false).acc.crown; o.veh = VP.Veh.ORDER.every(k => VP.Veh.unlocked(k));
        __vp.unlockAll(); const st0 = setTimeout; window.setTimeout = f => { f(); return 0; }; __vp.start(1); __vp.G.time = 5; __vp.win(); window.setTimeout = st0; o.perfect = VP.UI.last().perfect; await new Promise(r => setTimeout(r, 400)); for (let i = 0; i < 40 && !((VP.S.rw || {}).items || []).length; i++) await new Promise(r => setTimeout(r, 150)); o.items = (VP.S.rw || {}).items || []; o.dbg = [VP.UI.last().stars, VP.UI.last().time, VP.Long.goldTime(VP.UI.last().m), VP.UI.last().noFaint]; VP.UI.show("rarity"); await new Promise(r => setTimeout(r, 400)); o.text = document.querySelector('#s-rarity').textContent; VP.UI.show('profile'); o.profile = /#7/.test(document.querySelector('#s-profile').textContent); return o; });
      ok('owner account (admin): the whole wardrobe and every vehicle, read from the account', a.admin && a.all && a.wears && a.veh, a);
      ok('perfect run (3 stars, gold time, no faints) claims on the server; item arrives with serial and tier', a.perfect && calls.some(c => c.source === 'mission' && c.stars === 3 && c.gold === true) && a.items.length === 1 && a.items[0].serial === 7, [a.items, a.direct, a.ap, a.err]);
      ok('serial shows on the profile and the Raridade page ("#7 de 23", who owns #1, the vault)', a.profile && /#7 de 23/.test(a.text) && /7 de 23 existem/.test(a.text) && /Pipoca/.test(a.text) && /20\/50/.test(a.text), a.text.slice(0, 300));
      ok('rewards (account): zero console errors', errors.length === 0, errors.slice(0, 3));
      await browser.close(); }
  });
  await sec('weight', async () => {
    const { browser, page, errors } = await L.open(true, { routes: async page => { await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })); } });
    await page.waitForTimeout(1500);
    const sizes = await page.evaluate(() => performance.getEntriesByType('resource').map(e => [e.name.split('/').slice(3).join('/'), e.transferSize || e.encodedBodySize || 0]));
    let bytes = 0; const root = __dirname + '/../../public/'; for (const [name] of sizes) { const f = root + name.split('?')[0]; if (fs.existsSync(f) && fs.statSync(f).isFile()) bytes += fs.statSync(f).size; }
    bytes += fs.statSync(root + 'index.html').size;
    ok('first load stays under 2.6 MB uncompressed (' + (bytes / 1048576).toFixed(2) + ' MB, ' + sizes.length + ' files, no city map)', bytes < 2.6 * 1048576 && !sizes.some(s => /cities\/(?!index)/.test(s[0])), { bytes });
    ok('weight: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  });
  console.log(fails + ' failures'); L.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
