// City life smoke run: node tests/e2e/citylife.cjs [shots]   -> checks + screenshots in $VP_SHOTS (default /tmp)
// Pedestrians, street cats, traffic that brakes, stalls (buy / favor), cat activities, minimap + waypoint, photo mode,
// celebrities, day/night, rain, ambient life in missions and in a real city. Phone viewport first.
const L = require('./lib.cjs');
// own port: several checkouts of the game may be running their e2e servers on this machine at the same time
const PORT = +process.env.VP_PORT || 8791; let srv = null;
L.URL = 'http://localhost:' + PORT + '/';
L.serve = () => new Promise(r => { srv = require('child_process').spawn('python3', ['-m', 'http.server', String(PORT), '--directory', require('path').resolve(__dirname, '../../public')], { stdio: 'ignore' }); setTimeout(r, 900); });
L.stop = () => srv && srv.kill();
const onlyShots = process.argv[2] === 'shots';
const bad = [], ok = (c, m) => { if (!c) { bad.push(m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const boot = async (mobile, pre) => { const o = await L.open(mobile); await o.page.evaluate(pre || (() => {})); await o.page.evaluate(() => { VP.Audio.sfx = () => {}; VP.S.cash = 300; window.sim = s => { for (let i = 0; i < s * 30; i++) { if (!__vp.G || __vp.G.over) break; VP.I.poll(); VP.Game.update(1 / 30); } }; window.tp = (x, y) => { const G = __vp.G; G.cats.forEach((k, i) => { k.x = x + i * 4; k.y = y + i * 4; k.plat = null; }); G.cam.x = x; G.cam.y = y; G.fieldT = 0; }; __vp.free(); }); await o.page.waitForFunction(() => VP.Life.ready && VP.LifeGfx); await o.page.waitForTimeout(900); return o; };

(async () => {
  await L.serve();
  // ---------- 1. phone: the city is alive ----------
  let { browser, page, errors } = await boot(true);
  console.log('free roam (phone)');
  let r = await page.evaluate(() => {
    const G = __vp.G, Lf = G.life, W = G.W, T = 48; sim(40);
    const walkers = Lf.peds.filter(p => !p.fixed), c = G.cats[G.active];
    const inWall = walkers.filter(p => W.tile(p.x, p.y) !== 0).length, near = walkers.filter(p => Math.hypot(p.x - c.x, p.y - c.y) < 1000).length;
    const onRoad = walkers.filter(p => W.gnd[Math.floor(p.y / T) * W.W + Math.floor(p.x / T)] === 1 && !p.cross && !(VP.LifeLogic.edge(Lf.net, p.from, p.to) || { axis: 0 }).axis && p.st === 'walk').length; // zebras without a light (outer districts) count as crossings too
    return { peds: walkers.length, cap: Lf.caps.peds, inWall, near, onRoad, roles: [...new Set(walkers.map(p => p.role))], cats: Lf.animals.filter(a => a.kind === 'cat').length, dogs: Lf.animals.filter(a => a.kind === 'dog').length, birds: Lf.birds.length,
      veh: Lf.vehicles.map(v => v.kind), stalls: [...new Set(Lf.stalls.map(s => s.def.id))], nStalls: Lf.stalls.length, props: [...new Set(Lf.props.map(p => p.k))], windows: Lf.windows.length, gang: Lf.animals.filter(a => a.gang).length, hp: G.cats.map(k => k.hp + '/' + k.max), pk: !!G.pk };
  });
  ok(r.peds >= r.cap * 0.75 && r.near >= 8, `streets are full: ${r.peds}/${r.cap} people, ${r.near} around the cats (${r.roles.join(', ')})`);
  ok(r.inWall === 0, 'nobody walks inside a wall'); ok(r.onRoad <= 1, 'people keep to sidewalks and zebras (' + r.onRoad + ' on the road)');
  ok(r.roles.length >= 5, 'variety of people'); ok(r.cats >= 3 && r.gang >= 4 && r.birds >= 3 && r.windows > 10, `animals: ${r.cats} cats (${r.gang} in the gang), ${r.dogs} dogs, ${r.birds} pigeons, ${r.windows} window cats`);
  ok(r.veh.length >= 2, 'ambient traffic: ' + r.veh.join(', '));
  ok(['hotdog', 'sushi', 'donut', 'peixaria', 'padaria', 'sorveteria', 'petshop', 'feirinha'].every(s => r.stalls.includes(s)) && r.nStalls >= 25, r.nStalls + ' stalls: ' + r.stalls.join(', '));
  ok(['bench', 'box', 'table', 'sofa', 'sun', 'laser', 'climb', 'gang', 'yarn'].every(k => r.props.includes(k)) && r.pk, 'activities: ' + r.props.join(', '));
  ok(r.hp.every(h => h.split('/')[0] === h.split('/')[1]), 'nothing hurt the cats: ' + r.hp);

  // ---------- 2. traffic brakes for cats ----------
  console.log('traffic');
  r = await page.evaluate(() => {
    const G = __vp.G, Lf = G.life, c = G.cats[G.active]; let min = 1e9, ufa0 = Lf.stats.ufa, tries = 0, tested = 0;
    for (const v of Lf.vehicles.slice()) { if (v.road || tries++ > 4) break; const d = [[1, 0], [0, 1], [-1, 0], [0, -1]][v.dir]; v.spd = v.top; Lf.missCd = 0; tp(v.x + d[0] * (v.half + 56), v.y + d[1] * (v.half + 56)); tested++;
      for (let i = 0; i < 90; i++) { VP.Game.update(1 / 30); G.cats.forEach(k => { k.x = c.x; k.y = c.y; }); const f = (c.x - v.x) * d[0] + (c.y - v.y) * d[1]; if (Math.abs((c.x - v.x) * d[1] - (c.y - v.y) * d[0]) < 20) min = Math.min(min, f - v.half); } }
    // lights: over a whole cycle no traffic car ever sits in the box on red... simply: both kinds of traffic stop somewhere
    let held = 0; for (let i = 0; i < 30 * 30; i++) { VP.Game.update(1 / 30); for (const k of G.cars) if (k._hold) held++; }
    return { min: Math.round(min), ufa: Lf.stats.ufa - ufa0, tested, held, hp: c.hp === c.max, light: VP.Life.traffic.light(1, 1), api: Object.keys(VP.Life.traffic) };
  });
  ok(r.tested > 0 && r.min > 0, `vehicles stop before the cat (closest bumper ${r.min}px, ${r.tested} tested)`); ok(r.ufa > 0, '"Ufa!" near miss fired ' + r.ufa + 'x'); ok(r.hp, 'no damage from traffic');
  ok(r.held > 0 && r.light && 'ns' in r.light, 'the city traffic waits at red lights; API: ' + r.api.join(', '));

  // ---------- 3. stall: prompt, shop, buy, buff ----------
  console.log('stalls');
  await page.evaluate(() => { const Lf = __vp.G.life, s = Lf.stalls.find(s => s.def.id === 'hotdog'); window.st = s; __vp.G.cats[0].energy = 20; tp(s.fx, s.fy + 6); sim(0.2); });
  r = await page.evaluate(() => ({ ctx: __vp.G.ctx && __vp.G.ctx.k, label: __vp.G.ctx && __vp.G.ctx.label }));
  ok(r.ctx === 'life' && /Comprar/.test(r.label), 'walking up to the hot-dog stand shows the prompt: ' + r.label);
  await page.waitForTimeout(400);
  { const b = await page.evaluate(() => VP.HUD.btn.ctx); await page.touchscreen.tap(b.x, b.y); await page.waitForTimeout(500); }
  ok(await page.evaluate(() => VP.Life.panel === 'shop' && VP.UI.paused), 'tapping the action button opens the shop (game paused)');
  await L.shot(page, 'citylife-shop-m');
  const cash0 = await page.evaluate(() => { const b = VP.Life.buy; VP.Life.buy = (s, i) => (window.__buy = b(s, i)); return VP.Life.wallet(__vp.G); });
  await page.tap('.lf-item[data-i="salsicha"]'); await page.waitForTimeout(700);
  r = await page.evaluate(() => { const G = __vp.G; return { cash: window.__buy.cash, panel: VP.Life.panel, buff: !!G.life.buffs.energy, energy: G.cats[0].energy, toast: G.life.toast.length, emote: G.cats[G.active].emote && G.cats[G.active].emote.k }; });
  ok(cash0 - r.cash === 15 && r.buff && r.energy >= 99 && !r.panel, `bought a sausage: coins ${cash0} → ${r.cash}, energy ${r.energy}, buff on the HUD`);
  await page.waitForTimeout(350); await L.shot(page, 'citylife-buff-m');
  r = await page.evaluate(() => { VP.S.cash = 3; const G = __vp.G; G.bank = G.stat.cash; const res = VP.Life.buy(window.st, 'salsicha'); return { ok: res.ok, cash: VP.S.cash }; });
  ok(!r.ok && r.cash === 3, 'no coins, no sausage (and nothing is charged)');
  // favors: free food for a tiny job
  r = await page.evaluate(() => {
    const G = __vp.G, Lf = G.life, out = {}, c = G.cats[G.active];
    const run = (id, play) => { const s = Lf.stalls.find(s => s.def.id === id && s.favorCd <= 0); tp(s.fx, s.fy); sim(0.3); const f0 = Lf.stats.favors; VP.Life.startFavor(s); const F = Lf.favor; if (!F) return 'no favor'; for (let i = 0; i < 900 && Lf.favor; i++) { play(F, s); VP.I.poll(); VP.Game.update(1 / 30); } return (Lf.stats.favors > f0 ? 'done' : 'failed') + ' in ' + Math.round(F.t) + 's'; };
    out.mouse = run('peixaria', F => { tp(F.mouse.x, F.mouse.y); });
    out.delivery = run('padaria', F => { tp(F.at.x, F.at.y); });
    out.photo = run('sushi', F => { if (Math.hypot(c.x - F.at.x, c.y - F.at.y) > 20) tp(F.at.x, F.at.y); else if (!c.emote) VP.Game.emote('sit'); });
    out.pigeons = run('donut', F => { const b = Lf.birds.find(b => b.tag === F && b.st !== 'fly'); if (b) { tp(b.x + 10, b.y); c.walk = 1; } });
    out.meow = run('hotdog', (F, s) => { const p = Lf.peds.find(p => !p.fixed && p.st === 'walk' && p.cool <= 0 && !p.leader); if (p) { p.x = s.fx + 60; p.y = s.fy + 40; } if (!c.emote) VP.Game.emote('miau'); else if (c.emote.t < 0.9) c.emote = null; });
    out.fail = (() => { const s = Lf.stalls.find(s => s.def.id === 'petshop'); tp(s.fx, s.fy); VP.Life.startFavor(s); const f0 = Lf.stats.favors; tp(s.fx + 400, s.fy); for (let i = 0; i < 40 * 30 && Lf.favor; i++) { const F = Lf.favor; if (F.mouse && Math.hypot(F.mouse.x - c.x, F.mouse.y - c.y) < 120) tp(F.mouse.x + 300, F.mouse.y); VP.Game.update(1 / 30); } return !Lf.favor && Lf.stats.favors === f0 && s.favorCd > 0; })();
    return out;
  });
  for (const k of ['mouse', 'delivery', 'photo', 'pigeons', 'meow']) ok(/^done/.test(r[k]), 'favor "' + k + '": ' + r[k]);
  ok(r.fail, 'a favor that runs out of time just ends (no penalty, short cooldown)');

  // ---------- 4. people and animals react ----------
  console.log('reactions');
  r = await page.evaluate(() => {
    const G = __vp.G, Lf = G.life, c = G.cats[G.active], out = {}; VP.S.cash = 300;
    const rnd = Math.random; let p = Lf.peds.find(p => !p.fixed && p.st === 'walk' && !p.leader && p.role === 'walker'); p.cool = 0; tp(p.x + 12, p.y + 8); Math.random = () => 0.1; VP.Game.emote('miau'); sim(0.1); out.aw = p.st + ' "' + (p.bub && p.bub.txt) + '"'; const hp0 = (c.hp = c.max - 30); sim(6); out.pet = Lf.stats.pets > 0 && c.hp > hp0; Math.random = rnd;
    // Morticia steals a snack: comic chase, no damage, the owner gives up
    VP.Game.switchTo(2); const m = G.cats[2]; let e = Lf.peds.find(p => p.snack && !p.fixed && p.st === 'walk'); if (!e) { e = Lf.peds.find(p => !p.fixed && p.st === 'walk' && !p.leader); e.snack = 'hotdog'; }
    tp(e.x + 30, e.y); const belly = (m.belly = 30); VP.I.bot = () => { VP.I.mx = 0; VP.I.my = 0; VP.I.attack = true; VP.I.aim = null; }; sim(0.2); VP.I.bot = null; VP.I.attack = false; out.stole = e.st === 'chase' && m.belly > belly && !e.snack; out.line = e.bub && e.bub.txt;
    const hp1 = m.hp; for (let i = 0; i < 12 * 30; i++) { if (Math.hypot(e.x - m.x, e.y - m.y) < 90) { const q = VP.Game.nearFree(m.x, m.y, 200, 0); if (q) tp(q.x, q.y); } VP.Game.update(1 / 30); } out.gaveUp = e.st !== 'chase'; out.noDamage = m.hp >= hp1; VP.Game.switchTo(0);
    // street cat: befriend (or get hissed at)
    const k = Lf.animals.find(a => a.kind === 'cat' && !a.gang && !a.friend) || Lf.animals.find(a => a.kind === 'cat' && !a.gang); k.friend = false; k.cool = 0; delete VP.Life.S().friends[k.fid]; tp(k.x + 30, k.y); sim(0.2); out.catPrompt = G.ctx && G.ctx.label; Math.random = () => 0.99; VP.Life.befriend(Lf, k); out.hiss = k.st === 'flee' && k.bub && k.bub.txt; k.cool = 0; k.st = 'idle'; Math.random = () => 0.01; VP.Life.befriend(Lf, k); Math.random = rnd; out.friend = k.friend && k.st === 'follow' && !!VP.Life.S().friends[k.fid];
    // kid follows
    const kid = Lf.peds.find(p => p.role === 'kid' && !p.fixed) || (() => { const q = Lf.peds.find(p => !p.fixed && p.st === 'walk' && !p.leader); q.role = 'kid'; return q; })(); kid.cool = 0; kid.st = 'walk'; tp(kid.x + 60, kid.y); Math.random = () => 0.1; sim(0.3); Math.random = rnd; out.kid = kid.st;
    // waiter shoos, three meows soften him
    const t = Lf.props.find(p => p.k === 'table'), g = t.guard; tp(g.x + 70, g.y); sim(0.3); out.shoo = g.bub && g.bub.txt; const hp2 = c.hp; tp(g.x + 30, g.y); sim(0.2); out.pushed = Math.hypot(c.x - g.x, c.y - g.y) > 30 && c.hp >= hp2; for (let i = 0; i < 3; i++) { tp(g.x + 100, g.y); c.emote = null; Lf.miau = false; VP.Game.emote('miau'); sim(0.1); } out.soft = g.soft > 0;
    return out;
  });
  ok(/^react/.test(r.aw) && r.pet, 'meow → ' + r.aw + ' → petting heals a little'); ok(r.stole && r.gaveUp && r.noDamage, 'Morticia steals a snack → "' + r.line + '" → the owner chases and gives up, no damage');
  ok(/amizade/.test(r.catPrompt) && r.hiss && r.friend, 'street cat: prompt "' + r.catPrompt + '", can hiss (' + r.hiss + ') or become a friend that follows'); ok(r.kid === 'follow', 'kids follow the cats');
  ok(r.shoo && r.pushed && r.soft, 'the waiter shoos ("' + r.shoo + '") and is softened by three meows');

  // ---------- 5. cat activities ----------
  console.log('activities');
  r = await page.evaluate(() => {
    const G = __vp.G, Lf = G.life, c = G.cats[G.active], out = {}, S = VP.Life.S(); const press = () => { VP.I.pressed.ctx = true; sim(0.1); };
    const t = Lf.props.find(p => p.k === 'table' && p.cups.some(k => k.st === 'on')); const p0 = S.pts; tp(t.x + 40, t.y); sim(0.2); out.knockLabel = G.ctx && G.ctx.label; press(); sim(1.2); out.knock = S.pts - p0 >= 10 && Lf.knock.some(k => k.st !== 'on');
    const s = Lf.props.find(p => p.k === 'sofa'); tp(s.x, s.y + 44); sim(0.2); const p1 = S.pts; for (let i = 0; i < 3; i++) press(); out.scratch = S.pts - p1 >= 36 && s.guard.st === 'chase'; sim(9); out.sofaHome = s.guard.st !== 'chase';
    const b = Lf.props.find(p => p.k === 'box'); c.hp = 20; tp(b.x + 20, b.y); sim(0.2); out.boxLabel = G.ctx && G.ctx.label; const ck = Lf.clock; press(); sim(3.2); out.sleep = c.hp === c.max && Lf.clock !== ck && VP.S.pos && Math.abs(VP.S.pos.x - c.x) < 5;
    const sun = Lf.props.find(p => p.k === 'sun'); Lf.clock = 0.5; Lf.rain = 0; c.hp = 50; tp(sun.x, sun.y); sim(2); out.sun = c.hp > 55;
    const cl = Lf.props.find(p => p.k === 'climb'), top = Lf.tops[0], ac = G.pk.plats.find(p => p.life === 'ac' && Math.hypot(p.x - cl.x, p.y - cl.y) < 10), aw = G.pk.plats.find(p => p.life === 'awning' && Math.hypot(p.x - cl.x, p.y - cl.y) < 120);
    tp(ac.x - 60, ac.y); let hmax = 0; const walk = (tx, ty, n) => { for (let i = 0; i < n; i++) { VP.I.bot = () => { const d = Math.hypot(tx - c.x, ty - c.y) || 1; VP.I.mx = (tx - c.x) / d; VP.I.my = (ty - c.y) / d; VP.I.attack = false; VP.I.aim = null; }; VP.I.poll(); VP.Game.update(1 / 30); hmax = Math.max(hmax, c.plat ? c.plat.h : 0); if (Math.hypot(tx - c.x, ty - c.y) < 8) break; } VP.I.bot = null; };
    walk(ac.x, ac.y, 60); walk(aw.x, aw.y, 60); walk(top.x, top.y, 90); out.climb = hmax + ' ' + !!top.lifeDone; VP.I.mx = VP.I.my = 0;
    const y = Lf.toys.find(t => t.k === 'yarn'); tp(y.x - 16, y.y); c.walk = 1; const y0 = y.x; VP.I.bot = () => { VP.I.mx = 1; VP.I.my = 0; VP.I.attack = false; VP.I.aim = null; }; sim(0.8); VP.I.bot = null; out.yarn = Math.abs(y.x - y0) > 20;
    const lz = Lf.props.find(p => p.k === 'laser'); lz.cd = 0; Lf.toys = Lf.toys.filter(t => t.k !== 'laser'); tp(lz.x + 30, lz.y); sim(0.3); const dot = Lf.toys.find(t => t.k === 'laser'); out.laserInfo = 'no dot: car ' + !!G.car + ' cd ' + lz.cd + ' d ' + Math.round(Math.hypot(c.x - lz.x, c.y - lz.y)) + ' sleep ' + !!Lf.sleep + ' toys ' + Lf.toys.map(t => t.k); out.laser = !!dot; if (dot) { for (let i = 0; i < 400 && !dot.dead; i++) { tp(dot.x, dot.y); VP.Game.update(1 / 30); } out.laserInfo = dot.n + '/' + dot.need + ' life ' + Math.round(dot.life) + ' car ' + !!G.car; out.laser = dot.dead && dot.n >= 5; }
    const gp = Lf.props.find(p => p.k === 'gang'); S.gang = 0; const cash = G.stat.cash; tp(gp.x + 60, gp.y + 20); sim(0.2); out.gangLabel = G.ctx && G.ctx.label; press(); out.gang = G.stat.cash - cash >= 25;
    Lf.flies.push({ hx: c.x, hy: c.y, x: c.x, y: c.y, z: 1, t: 0, ph: 0, col: '#fff' }); const fl = Lf.flies[Lf.flies.length - 1], p2 = S.pts; for (let i = 0; i < 20 && !fl.dead; i++) { tp(fl.x, fl.y); VP.Game.update(1 / 30); } out.fly = S.pts > p2;
    return out;
  });
  ok(r.knock, 'knock a cup off a table ("' + r.knockLabel + '") for points'); ok(r.scratch && r.sofaHome, 'scratch the showroom sofa → the owner chases, then goes back');
  ok(r.sleep, 'cardboard box ("' + r.boxLabel + '"): full health, time passes, game saved'); ok(r.sun, 'sunny spot heals'); ok(/^2\.4 true/.test(r.climb), 'climb AC unit → awning → roof: ' + r.climb);
  ok(r.yarn, 'yarn rolls when pushed'); ok(r.laser, 'laser dot: five catches (' + r.laserInfo + ')'); ok(r.gang, 'the Alley Crew says hi ("' + r.gangLabel + '") and chips in'); ok(r.fly, 'butterflies can be caught');

  if (process.env.VP_STOP === '5') { console.log(errors, bad); await browser.close(); L.stop(); process.exit(bad.length ? 1 : 0); }
  // ---------- 6. minimap, waypoint, activities, phone, radio, photo ----------
  console.log('GTA-style UX');
  await page.evaluate(() => { const G = __vp.G, a = G.W.roles[0].arena; tp(a.cx, a.cy + 300); sim(0.3); });
  { const m = await page.evaluate(() => VP.HUD.map); await page.waitForTimeout(300); await page.touchscreen.tap(m.x, m.y); await page.waitForTimeout(700); }
  ok(await page.evaluate(() => VP.Life.panel === 'map' && !!document.getElementById('lf-map')), 'tapping the radar opens the big map');
  await L.shot(page, 'citylife-map-m');
  // the start district can be fenced in (story chapters), so tap a spot that can really be walked to: ~60 tiles away on the open ground
  { const b = await page.locator('#lf-map').boundingBox();
    const tgt = await page.evaluate(() => { const G = __vp.G, W = G.W, l = VP.Life.lead(G), fm = W.fieldMax; W.fieldMax = 0; const f = W.field(l.x, l.y, 0); W.fieldMax = fm; let best = null;
      for (let y = 4; y < W.H - 4; y += 3) for (let x = 4; x < W.W - 4; x += 3) { const d = f[y * W.W + x]; if (d >= 40 && d <= 90 && W.grid[y * W.W + x] === 0 && (!best || d < best.d)) best = { d, x: (x + 0.5) * 48, y: (y + 0.5) * 48 }; }
      const m = W.mini; return best && { x: best.x, y: best.y, mw: m.width, mh: m.height }; });
    const sc = Math.min(b.width / tgt.mw, b.height / tgt.mh);
    await page.touchscreen.tap(b.x + b.width / 2 + (tgt.x / 24 - tgt.mw / 2) * sc, b.y + b.height / 2 + (tgt.y / 24 - tgt.mh / 2) * sc); await page.waitForTimeout(800); }
  r = await page.evaluate(() => { const Lf = __vp.G.life; sim(0.5); return { wp: !!Lf.wp, route: Lf.route ? Lf.route.length : 0, panel: VP.Life.panel, acts: VP.Life.activities(__vp.G).length, cats: [...new Set(VP.Life.activities(__vp.G).map(a => a.cat))] }; });
  ok(r.wp && r.route > 3 && !r.panel, 'a tap sets the waypoint and draws the GPS route (' + r.route + ' points)'); ok(r.acts > 30 && ['food', 'shop', 'fun', 'mission', 'friend'].every(c => r.cats.includes(c)), 'Atividades: ' + r.acts + ' entries (' + r.cats.join(', ') + ')');
  await page.waitForTimeout(500); await L.shot(page, 'citylife-waypoint-m');
  r = await page.evaluate(() => { const G = __vp.G, Lf = G.life; tp(Lf.wp.x, Lf.wp.y); sim(0.2); return !Lf.wp; }); ok(r, 'arriving clears the waypoint');
  { const b = await page.evaluate(() => { VP.LifeHUD.draw; return VP.LifeHUD.btn; }); await page.touchscreen.tap(b.x, b.y); await page.waitForTimeout(500); }
  ok(await page.evaluate(() => VP.Life.panel === 'menu'), 'phone button opens the menu'); await L.shot(page, 'citylife-phone-m');
  await page.tap('[data-life="mRadio"]'); r = await page.evaluate(() => ({ radio: VP.Life.S().radio, song: VP.Audio.song })); ok(r.radio === 0, 'radio: station 1 of 3');
  await page.tap('[data-life="mActs"]'); await page.waitForTimeout(500); ok(await page.evaluate(() => document.querySelectorAll('.lf-item[data-life="goAct"]').length >= 8), 'Atividades list near you'); await L.shot(page, 'citylife-activities-m');
  await page.tap('.lf-item[data-life="goAct"]'); await page.waitForTimeout(300); ok(await page.evaluate(() => !!__vp.G.life.wp && !VP.Life.panel), 'picking an activity sets the waypoint');
  r = await page.evaluate(() => { sim(0.5); const s = VP.Audio.song; VP.Life.radio(1); sim(0.2); const s1 = VP.Audio.song; VP.Life.radio(2); sim(0.2); const s2 = VP.Audio.song; VP.Life.radio(-1); return [s, s1, s2]; }); ok(new Set(r).size === 3, 'three stations play three different songs: ' + r);
  r = await page.evaluate(() => { VP.Life.photo.open(); return VP.Life.panel === 'photo' && VP.HUD.hidden; }); ok(r, 'photo mode hides the HUD'); await page.waitForTimeout(500);
  await page.tap('[data-life="phPose"][data-p="wave"]'); await page.waitForTimeout(400); await L.shot(page, 'citylife-photo-m');
  r = await page.evaluate(() => { const u = VP.Life.photo.snap(); VP.Life.photo.close(); return { len: u ? u.length : 0, hud: !VP.HUD.hidden, panel: VP.Life.panel }; }); ok(r.len > 20000 && r.hud && !r.panel, 'snap gives a framed JPEG (' + Math.round(r.len / 1024) + ' KB) to save on the device');

  // ---------- 7. night, rain ----------
  console.log('day / night / rain');
  r = await page.evaluate(() => { const G = __vp.G, Lf = G.life, a = G.W.roles[0].plaza2; tp(a.cx - 290, a.cy - 120); VP.R3.snapCamera(0.5); Lf.clock = 0.92; sim(8); return Lf.night; }); await page.waitForTimeout(1500); await L.shot(page, 'citylife-night-m'); ok(r === 1, 'night falls (street lamps and stall lights come on)');
  r = await page.evaluate(() => { const Lf = __vp.G.life; Lf.clock = 0.5; Lf.raining = true; Lf.rainT = 99; Lf.rain = 1; Lf.wet = 1; sim(0.3); let n = 0; for (let x = 0; x < 40; x++) for (let y = 0; y < 40; y++) if (VP.LifeLogic.puddleAt(x, y)) n++; return n; }); await page.waitForTimeout(1500); await L.shot(page, 'citylife-rain-m'); ok(r > 100, 'rain with puddles (' + r + ' puddle spots in a 40×40 patch)');
  r = await page.evaluate(() => ({ fps: VP.R3.fps, dc: VP.R3.draws, tri: VP.R3.tris, q: VP.R3.quality })); console.log('  phone frame: ' + JSON.stringify(r)); ok(r.dc < 260 && r.tri < 260000, 'draw calls and triangles stay in budget on the phone');
  ok(errors.length === 0, 'no console errors (phone): ' + errors.slice(0, 3).join(' | '));
  await browser.close();

  // ---------- 8. celebrities ----------
  console.log('celebrity Mimos');
  ({ browser, page, errors } = await boot(true, () => { window.__pre = 1; }));
  r = await page.evaluate(() => { const none = (__vp.G.life.celebs || []).length; VP.Life.forceCelebs = true; __vp.free(); sim(1); const Lf = __vp.G.life, s = Lf.celebSpot, look = VP.Life.showcaseLook(); tp(s.x + 30, s.y + 150); sim(0.3); VP.R3.snapCamera(-Math.PI / 2); return { none, n: Lf.celebs.length, fans: Lf.peds.filter(p => p.st === 'fan').length, look, acc: Object.keys(Lf.celebs[1].spec.acc), lookOk: ['mimo', 'mimosa', 'morticia'].every(n => look[n] && Object.keys(look[n]).length > 0), accOk: ['mimo', 'mimosa', 'morticia'].every(n => Object.values(look[n]).every(id => VP.Wardrobe.data.items.some(i => i.id === id))) }; });
  ok(r.none === 0 && r.n === 3 && r.fans >= 5, 'playing as the Mimos: no celebrities; otherwise the three stars pose for ' + r.fans + ' fans'); ok(!r.look.stub && r.lookOk && r.acc.length > 0 && r.accOk, 'showcase look comes from the real getMimosShowcaseLook(): items for mimo, mimosa, morticia exist in the wardrobe data');
  await page.waitForTimeout(1800); await L.shot(page, 'citylife-celebs-m');
  r = await page.evaluate(() => { const G = __vp.G, Lf = G.life, c = Lf.celebs[0]; tp(c.x, c.y + 70); sim(0.3); const label = G.ctx && G.ctx.label; VP.I.pressed.ctx = true; sim(0.1); return { label, panel: VP.Life.panel }; }); ok(r.panel === 'celeb', 'walking up to a star: "' + r.label + '" → selfie / Quero esse look');
  await page.waitForTimeout(500); await page.tap('[data-life="selfie"]'); await page.waitForTimeout(900); ok(await page.evaluate(() => VP.Life.panel === 'photo' && !!__vp.G.life.selfie), 'selfie mode with the star'); await L.shot(page, 'citylife-selfie-m');
  await page.tap('[data-life="wantLook"]'); await page.waitForTimeout(400); ok(await page.evaluate(() => VP.Life.panel === 'look' && document.querySelectorAll('.lf-item.still').length >= 1), '"Quero esse look" opens the item info'); await L.shot(page, 'citylife-look-m');
  await page.tap('[data-life="lookWardrobe"]'); await page.waitForTimeout(600); ok(await page.evaluate(() => VP.UI.screen === 'wardrobe' && !VP.Life.panel && !VP.HUD.hidden === false), 'and from there the wardrobe');
  r = await page.evaluate(() => { window.getMimosShowcaseLook = () => ({ name: 'Semana Neon', look: { mimo: ['shades_gold', 'gold_suit'], mimosa: { body: 'neon_biker' }, morticia: ['crown_gold'] } }); const l = VP.Life.showcaseLook(); delete window.getMimosShowcaseLook; return l; }); ok(!r.stub && r.title === 'Semana Neon' && r.mimo.eyes === 'shades_gold' && r.mimosa.body === 'neon_biker', 'a real getMimosShowcaseLook() is picked up when present');
  ok(errors.length === 0, 'no console errors (celebrities): ' + errors.slice(0, 3).join(' | '));
  await browser.close();

  // ---------- 9. missions (ambient only) and a real city ----------
  console.log('missions and real cities');
  ({ browser, page, errors } = await boot(true));
  r = await page.evaluate(() => { __vp.unlockAll(); __vp.start(1); sim(3); const Lf = __vp.G.life; return { amb: Lf && Lf.ambient, peds: Lf ? Lf.peds.length : 0, veh: Lf ? Lf.vehicles.length : -1, stalls: Lf ? Lf.stalls.length : -1, ctx: __vp.G.ctx }; });
  ok(r.amb && r.peds >= 4 && r.veh === 0 && r.stalls === 0, 'in a mission the streets still have people (' + r.peds + '), but no shops or extra traffic');
  r = await page.evaluate(async () => { await VP.Tour.load('rio'); VP.UI.tour('rio'); sim(4); const G = __vp.G, Lf = G.life, W = G.W, w = Lf.peds.filter(p => !p.fixed); return { net: Lf.net.n, peds: w.length, wall: w.filter(p => W.tile(p.x, p.y) !== 0).length, stalls: Lf.stalls.map(s => s.def.id), veh: Lf.vehicles.length, props: [...new Set(Lf.props.map(p => p.k))], lights: Lf.lightsOn }; });
  ok(r.net > 300 && r.peds >= 8 && r.wall === 0, `Copacabana: ${r.net} sidewalk nodes, ${r.peds} people, none in walls`); ok(r.stalls.length >= 5 && r.props.includes('bench'), 'stalls along the real streets: ' + r.stalls.join(', ') + '; props: ' + r.props.join(', '));
  await page.evaluate(() => { const G = __vp.G, s = G.life.stalls[0]; tp(s.fx + s.ox * 90, s.fy + s.oy * 90); VP.R3.snapCamera(Math.atan2(-s.oy, -s.ox)); sim(2); }); await page.waitForTimeout(5200); await L.shot(page, 'citylife-rio-m');
  r = await page.evaluate(async () => { await VP.Tour.load('rio_santamarta'); VP.UI.tour('rio_santamarta'); sim(3); const Lf = __vp.G.life; return { peds: Lf.peds.filter(p => !p.fixed).length, veh: Lf.vehicles.length, comu: Lf.comu }; }); ok(r.comu && r.veh === 0 && r.peds >= 4, 'comunidade maps: neighbours on foot (' + r.peds + '), no traffic');
  ok(errors.length === 0, 'no console errors (missions / cities): ' + errors.slice(0, 3).join(' | '));
  await browser.close();

  // ---------- 10. desktop: busy street + keyboard ----------
  console.log('desktop');
  ({ browser, page, errors } = await boot(false));
  await page.evaluate(() => { const G = __vp.G, W = G.W, a = W.roles[0].plaza1; tp((a.tx - 0.5) * 48, (a.ty + 8.5) * 48); VP.R3.snapCamera(-0.42); sim(25); });
  await page.waitForTimeout(2500); await L.shot(page, 'citylife-street-d');
  await page.evaluate(() => { const s = __vp.G.life.stalls.find(s => s.def.id === 'sorveteria'); tp(s.fx + s.ox * 40, s.fy + s.oy * 40); VP.R3.snapCamera(Math.atan2(-s.oy, -s.ox)); sim(0.3); }); await page.waitForTimeout(1200); await L.shot(page, 'citylife-stall-d');
  await page.keyboard.press('e'); await page.waitForTimeout(500); ok(await page.evaluate(() => VP.Life.panel === 'shop'), 'E opens the shop'); await L.shot(page, 'citylife-shop-d'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.keyboard.press('n'); await page.waitForTimeout(600); ok(await page.evaluate(() => VP.Life.panel === 'map'), 'N opens the map'); await L.shot(page, 'citylife-map-d'); await page.keyboard.press('n'); await page.waitForTimeout(200);
  await page.keyboard.press('t'); await page.waitForTimeout(300); ok(await page.evaluate(() => VP.Life.panel === 'menu'), 'T opens the phone'); await page.keyboard.press('t');
  ok(await page.evaluate(() => !VP.Life.panel && !VP.UI.paused), 'panels close cleanly and the game resumes');
  r = await page.evaluate(() => ({ fps: VP.R3.fps, dc: VP.R3.draws, tri: VP.R3.tris })); console.log('  desktop frame: ' + JSON.stringify(r));
  ok(errors.length === 0, 'no console errors (desktop): ' + errors.slice(0, 3).join(' | '));
  await browser.close();
  // phone: busy street for the eye
  ({ browser, page, errors } = await boot(true));
  await page.evaluate(() => { const G = __vp.G, W = G.W, a = W.roles[0].plaza1; tp((a.tx - 0.5) * 48, (a.ty + 8.5) * 48); VP.R3.snapCamera(-0.42); sim(25); }); await page.waitForTimeout(2500); await L.shot(page, 'citylife-street-m');
  await browser.close();
  L.stop(); void onlyShots;
  console.log(bad.length ? '\nFAILED: ' + bad.length + '\n' + bad.join('\n') : '\nALL GOOD');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
