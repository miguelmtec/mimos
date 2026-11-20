// Smoke test of feat/enemies-season: enemy roster, boss, Clínica Patinhas, Natal Neon season (forced with ?season=natal).
//   node tests/e2e/enemies-season.cjs [smoke|bot|shots|all]     screenshots go to $VP_SHOTS (default /tmp)
const L = require('./lib.cjs'); const fs = require('fs');
const what = process.argv[2] || 'all', fails = [];
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails.push(msg); };
const ready = page => page.waitForFunction(() => VP.Enemies && VP.Enemies.loaded && VP.Clinic && VP.Clinic.ready && VP.Season && VP.Season.ready, null, { timeout: 20000 });
const step = (page, sec) => page.evaluate(sec => { const dt = 1 / 30; for (let t = 0; t < sec; t += dt) { VP.I.poll(); VP.Game.update(dt); } }, sec);
(async () => {
  await L.serve();
  const { browser, page, errors } = await L.open(false, { query: '?season=natal' });
  await ready(page);
  await page.evaluate(() => { __vp.unlockAll(); VP.Audio.sfx = () => {}; VP.S.lives = 5; });

  if (what === 'smoke' || what === 'all') {
    const info = await page.evaluate(() => ({ types: Object.keys(VP.Enemies.DATA.enemies), n: VP.Missions.list.filter(m => m.n >= 400 && m.n < 450).length, s: VP.Missions.list.filter(m => m.n >= 500 && m.n < 550).length, cur: VP.Season.cur && VP.Season.cur.id, clinic: !!VP.Missions.world().clinic, dist: VP.Missions.DIST.map((d, i) => d.id === i).every(Boolean), title: document.getElementById('ui').innerHTML.includes('data-act="season"') }));
    ok(info.types.length === 6, '6 enemy types loaded: ' + info.types); ok(info.n >= 15, info.n + ' enemy missions (400-449)'); ok(info.s >= 10, info.s + ' seasonal missions (500-549)');
    ok(info.cur === 'natal', '?season=natal forces Natal Neon'); ok(info.clinic, 'clinic installed in the home city'); ok(info.dist, 'district ids are their index'); ok(info.title, 'season button on the title screen');
    // free roam: ambient enemies, clinic marker, Santa
    await page.evaluate(() => { VP.S.unlocked = 51; __vp.free(); });
    await step(page, 1);
    const fr = await page.evaluate(() => { const G = __vp.G; return { foes: G.foes.length, kinds: [...new Set(G.foes.map(e => e.type))], clinicMk: G.markers.some(m => m.k === 'clinic'), santa: !!G.santa, seasonMk: G.markers.some(m => m.k === 'season') }; });
    ok(fr.foes > 0 && fr.foes <= 30, 'ambient enemies within the cap: ' + fr.foes + ' ' + fr.kinds); ok(fr.clinicMk, 'clinic marker'); ok(fr.santa && fr.seasonMk, 'Santa Cat + season marker');
    // every enemy type: spawn, take hits from each cat's move, end as confetti or fleeing; nobody stays as a "body"
    for (const type of ['pulga', 'pepino', 'pombo', 'rato', 'robo', 'aspirador']) {
      const r = await page.evaluate(type => { const G = __vp.G, E = VP.Enemies; for (const e of G.foes) e.dead = true; const es = E.debugSpawn(type, 2); let hits = 0; for (let i = 0; i < 80 && es.some(e => !e.dead && !e.gone); i++) for (const e of es) if (E.hit(G, e, 30, 'bite', e.x - 10, e.y)) hits++; return { n: es.length, hits, out: es.every(e => e.dead || e.gone), stat: G.foeS.stat.by[type] || 0 }; }, type);
      ok(r.n === 2 && r.out && r.stat >= 2, type + ': spawned, hit ' + r.hits + 'x, sent away');
    }
    await step(page, 2);
    ok(await page.evaluate(() => __vp.G.foes.length === 0), 'defeated enemies are removed (pooled)');
    // debuffs
    const db = await page.evaluate(() => { const G = __vp.G, E = VP.Enemies, c = G.cats[G.active], s0 = c.spd; E.itch(G, c); VP.Game.update(1 / 30); const slow = c.spd < s0; E.wet(G, c); E.scare(G, c); const root = c.root > 0; E.clearDebuffs(G); VP.Game.update(1 / 30); return { slow, root, back: Math.abs(c.spd - c.fdeb.spd0 * (VP.Clinic.buff() ? 1.1 : 1)) < 0.01 }; });
    ok(db.slow && db.root && db.back, 'itch slows, cucumber stuns, debuffs clear');
    // vacuum: sucked in, then released by mashing
    const vac = await page.evaluate(() => { const G = __vp.G, E = VP.Enemies, a = G.cats[G.active]; a.inv = 0; const e = E.spawn(G, 'aspirador', a.x + 40, a.y, { state: 'act', force: true }); e.cd = 0; let held = false, freed = false; for (let i = 0; i < 400; i++) { VP.I.poll(); VP.I.attack = i % 6 < 3; VP.Game.update(1 / 30); if (G.foeS.hold) held = true; else if (held) { freed = true; break; } } e.dead = true; return { held, freed, hp: a.hp > 0 }; });
    ok(vac.held && vac.freed && vac.hp, 'vacuum holds the cat and mashing frees it');
    // pigeon steals coins, Morticia takes them back
    const pg = await page.evaluate(() => { const G = __vp.G, E = VP.Enemies; G.stat.cash = 100; const a = G.cats[G.active]; a.inv = 0; const e = E.spawn(G, 'pombo', a.x + 60, a.y, { state: 'act', force: true }); e.cd = 0; let stole = 0; for (let i = 0; i < 300 && !e.carry; i++) { VP.I.poll(); VP.Game.update(1 / 30); } stole = e.carry ? e.carry.n : 0; const after = G.stat.cash; e.z = 0; e.x = G.cats[2].x + 20; e.y = G.cats[2].y; G.cats[2].atk = 1; VP.Game.update(1 / 30); return { stole, after, back: G.stat.cash, rec: G.foeS.stat.recovered, gone: e.gone || e.dead }; });
    ok(pg.stole > 0 && pg.after === 100 - pg.stole && pg.back >= 100 && pg.rec === 1 && pg.gone, 'pigeon steals ' + pg.stole + ' coins and Morticia takes them back');
    // clinic: heal, check-up buff, vaccine minigame, treat() hook
    const cl = await page.evaluate(() => { const G = __vp.G, C = VP.Clinic; G.cats[0].hp = 10; C.heal(G); const healed = G.cats[0].hp === G.cats[0].max; C.state().checkAt = 0; const chk = C.checkup(G) && !!C.buff(); const k = G.W.clinic, a = G.cats[G.active]; a.x = k.table.x; a.y = k.table.y; C.startVaccine(G); for (let i = 0; i < 120; i++) { VP.I.poll(); VP.I.mx = VP.I.my = 0; VP.I.attack = false; VP.Game.update(1 / 30); } const vax = C.vaccinatedToday(a.name); const t = C.treat('shelter-cat-7', { vaccine: true }); return { healed, chk, vax, t: t.ok && t.vaccinated && C.isTreated('shelter-cat-7') && !!t.tip, sp: C.sponsor().on }; });
    ok(cl.healed && cl.chk && cl.vax && cl.t, 'clinic heals, buffs, vaccinates (3-2-1) and treat(catId) works'); ok(cl.sp === false, 'sponsor slot is off until the owner fills it');
    // season: points -> tiers -> claim cosmetics; the pass cannot be unlocked from the client and has no price
    const se = await page.evaluate(() => { const S = VP.Season, def = S.cur; S.state().pts = 0; S.add(70); const tier = S.tierNow(); const got = S.claim().map(c => c.k + c.tier); const wd = VP.Wardrobe.data.items.some(i => i.id === 'natal26_gorro' && i.free); return { tier, got, wd, pass: S.has(), price: def.pass.price, wait: def.pass.awaitingOwnerApproval, prem: S.claimable(def, { pts: 9999, f: {}, p: {} }, S.has()).filter(c => c.k === 'p').length, buy: S.pass.buy().ok }; });
    ok(se.tier === 2 && se.got.join() === 'f1,f2' && se.wd, 'free track: 70 points = tier 2, hat lands in the wardrobe'); ok(!se.pass.pass && se.price === 4.9 && se.wait === false && se.prem === 0 && se.buy === false, 'paid pass: approved price, nothing premium without a server grant');
    await page.evaluate(() => VP.Season.open()); ok(await page.evaluate(() => document.getElementById('ui').innerHTML.includes('Natal Neon') && /R\$ 4,90/.test(document.getElementById('s-season').innerHTML) && /R\$ 9,90/.test(document.getElementById('s-season').innerHTML)), 'season screen opens with the two buy buttons (R$ 4,90 and R$ 9,90)');
    await page.evaluate(() => VP.UI.act.seasonBack());
    await page.evaluate(() => VP.Clinic.open()); ok(await page.evaluate(() => document.getElementById('ui').innerHTML.includes('data-act="clinic"')), 'clinic screen opens'); await page.evaluate(() => VP.UI.act.resume());
    // boss: three phases, ends by driving away
    const bs = await page.evaluate(() => { __vp.start(419); const G = __vp.G, b = G.fboss, seen = [b.phase]; let guard = 0; for (let i = 0; i < 4000 && !b.done; i++) { VP.I.poll(); VP.Game.update(1 / 30); for (const k of G.cats) { k.hp = k.max; k.down = false; k.root = 0; } for (const e of G.foes) if (e.tag === 'bossMinion' && i % 20 === 0) VP.Enemies.hit(G, e, 999, 'bite', e.x, e.y); if (i % 3 === 0) VP.Enemies.hit(G, b, 60, 'bite', b.x, b.y - 10); if (b.shield) guard++; if (seen[seen.length - 1] !== b.phase) seen.push(b.phase); } return { seen, done: b.done, guard: guard > 0, bossBar: G.boss === b, over: G.over || G.bossDead, hp: b.hp, max: b.max, armor: b.armor, stun: b.stun }; });
    ok(bs.seen.join() === '0,1,2' && bs.done && bs.guard && bs.bossBar, 'Dr. Carrocinha: phases ' + bs.seen + ', shield phase, ends beaten ' + JSON.stringify(bs));
  }

  if (what === 'bot' || what === 'all') {
    await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') });
    const list = await page.evaluate(() => VP.Missions.list.filter(m => m.n >= 400 && m.n < 550).map(m => m.n));
    let won = 0;
    for (const n of list) {
      const r = await page.evaluate(n => { try { return __bot.run(n, 420); } catch (e) { return { n, err: e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ') }; } }, n);
      if (r.win) won++;
      console.log(r.err ? JSON.stringify(r) : `${r.n} ${r.type.padEnd(12)} ${r.win ? 'WIN ' : 'FAIL'} t=${String(r.time).padStart(3)} par=${String(r.par).padStart(3)} downs=${r.downs} ${r.win ? '' : r.why + ' | ' + r.steps}`);
    }
    ok(won === list.length, 'bot wins ' + won + '/' + list.length + ' of the new missions');
  }

  if (what === 'shots' || what === 'all') {
    const shot = async name => { await page.waitForTimeout(700); await L.shot(page, 'es_' + name); console.log('shot', (process.env.VP_SHOTS || '/tmp') + '/es_' + name + '.png'); };
    const quiet = () => page.evaluate(() => { const G = __vp.G; for (const e of G.dogs) e.dead = true; G.heat = 0; G.noHeat = true; G.noPolice = true; for (const c of G.cats) { c.hp = c.max; c.inv = 99; } });
    await page.evaluate(() => { VP.UI.hide(); VP.S.unlocked = 51; const W = VP.Missions.world(), k = W.clinic; __vp.free({ x: k.door.x - 30, y: k.door.y + 150 }); });
    await quiet(); await step(page, 0.5); await page.evaluate(() => VP.R3.snapCamera(-Math.PI / 2)); await shot('clinic');
    await page.evaluate(() => VP.Clinic.open()); await shot('clinic_menu'); await page.evaluate(() => VP.UI.act.resume());
    await page.evaluate(() => { const G = __vp.G, E = VP.Enemies, a = G.cats[G.active]; for (const e of G.foes) e.dead = true; const put = (t, dx, dy, n) => E.group(G, t, { x: a.x + dx, y: a.y + dy }, { n, force: true, spread: 26 }).forEach(e => { e.aggro = 0; e.state = 'patrol'; e.wt = 99; e.a = Math.PI / 2; }); put('pulga', -150, -60, 4); put('pepino', -80, -110, 1); put('rato', -10, -120, 2); put('robo', 70, -110, 1); put('aspirador', 150, -70, 1); put('pombo', 0, -40, 1); });
    await step(page, 0.3); await shot('enemies');
    await page.evaluate(() => { const G = __vp.G; for (const e of G.foes) e.dead = true; const W = G.W, lot = W.roles[0].plaza1, p = W.front(lot, 'e'); __vp.free({ x: p.x - 20, y: p.y + 120 }); });
    await quiet(); await step(page, 0.5); await page.evaluate(() => VP.R3.snapCamera(-Math.PI / 2)); await shot('natal_city');
    await page.evaluate(() => VP.Season.open()); await shot('natal_track'); await page.evaluate(() => VP.UI.act.seasonBack());
    await page.evaluate(() => { __vp.start(419); }); await step(page, 3); await shot('boss');
    await page.evaluate(() => { VP.UI.show('title'); }); await shot('title');
    const m = await L.open(true, { query: '?season=natal' }); await ready(m.page);
    await m.page.evaluate(() => { VP.S.unlocked = 51; __vp.free(); }); await m.page.waitForTimeout(1200);
    await m.page.evaluate(() => { const G = __vp.G, E = VP.Enemies, a = G.cats[G.active]; for (const e of G.dogs) e.dead = true; E.group(G, 'pulga', { x: a.x, y: a.y - 120 }, { n: 4, force: true }); E.group(G, 'aspirador', { x: a.x + 60, y: a.y - 160 }, { n: 1, force: true }); });
    await m.page.waitForTimeout(900); await L.shot(m.page, 'es_mobile'); console.log('shot', (process.env.VP_SHOTS || '/tmp') + '/es_mobile.png');
    ok(m.errors.length === 0, 'no console errors on mobile: ' + m.errors.slice(0, 3)); await m.browser.close();
  }
  ok(errors.length === 0, 'no console errors: ' + errors.slice(0, 4).join(' || '));
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL OK');
  await browser.close(); L.stop(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
