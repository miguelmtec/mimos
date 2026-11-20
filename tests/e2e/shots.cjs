// Screenshot tour for visual review: node tests/e2e/shots.cjs [filter]   -> $VP_SHOTS (default /tmp), mobile 390x844 (touch) and desktop 1280x800
const L = require('./lib.cjs'); const fs = require('fs');
const filter = process.argv[2] || '';
const play = (n, secs) => async page => { await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') }); await page.evaluate(([n, secs]) => { __vp.unlockAll(); VP.Audio.sfx = () => {}; __vp.start(n); VP.I.bot = __bot.poll; __bot.fields = {}; for (let i = 0; i < secs * 30; i++) { if (!__vp.G || __vp.G.over) break; VP.I.poll(); VP.Game.update(1 / 30); } VP.I.bot = null; }, [n, secs]); };
const tour = (id, n, secs) => async page => { await page.evaluate(async id => { __vp.unlockAll(); VP.Audio.sfx = () => {}; await VP.Tour.load(id); VP.UI.tour(id); }, id); if (n !== undefined) { await page.waitForTimeout(600); await play(n, secs || 3)(page); } };
const PL = require('../helpers/planned.cjs'), FX = require('../helpers/elev-fixture.cjs');
// expansion 2: stand-in maps for cities whose extract has not arrived (see tests/helpers/planned.cjs)
const STAND = ['rioverde', 'rio_urca', 'rio_lapa', 'rio_maracana', 'saopaulo', 'brasilia', 'salvador', 'paris', 'toquio', 'newyork'];
const walkTo = (id, secs) => async page => { await tour(id)(page); await page.waitForTimeout(4600); await page.evaluate(() => { const G = __vp.G, W = G.W; let b = null, bs = -1; for (const rd of W.roads) if (rd.w < 9 && rd.len > 1500) { const q = rd.pts[Math.floor(rd.pts.length / 2)], d = Math.hypot(q.x - W.tourStart.x, q.y - W.tourStart.y); if (d < 900 && rd.len > bs) { bs = rd.len; b = q; } } if (b) for (const c of G.cats) { c.x = b.x; c.y = b.y; } }); };
const SHOTS = [
  ['title', async page => {}],
  ['map-chapters', async page => { await page.evaluate(() => { VP.S.stars = { 1: 3, 2: 2, 3: 3, 4: 3, 5: 2 }; VP.S.unlocked = 6; VP.UI.tab = 7; VP.UI.show('map'); }); }],
  ['brief', async page => { await page.evaluate(() => { __vp.unlockAll(); VP.UI.show('brief', 211); }); }],
  ['daily', async page => { await page.evaluate(() => { __vp.unlockAll(); VP.UI.show('daily'); }); }],
  ['settings', async page => { await page.evaluate(() => { VP.UI.show('settings'); }); }],
  ['free', async page => { await page.evaluate(() => { VP.Audio.sfx = () => {}; __vp.free(); }); }],
  ['tutorial', async page => { await page.evaluate(() => { VP.Audio.sfx = () => {}; VP.S.tut = 0; VP.UI.startTutorial(); }); }],
  ['volley', play(201, 5)], ['kites', play(202, 4)], ['fish', play(203, 6)], ['stealth', play(264, 2.4)], ['escort', play(207, 6)], ['duel', play(210, 4)], ['heist', play(218, 6)], ['kittens', play(209, 5)],
  ['miami', tour('miami')], ['rio', tour('rio')], ['rio-volley', tour('rio', 1011, 12)], ['vidigal', tour('rio_vidigal')], ['santamarta', tour('rio_santamarta')], ['santamarta-stairs', tour('rio_santamarta', 1037, 14)], ['vidigal-football', tour('rio_vidigal', 1024, 14)],
  ['world', async page => { await page.evaluate(() => { VP.S.stars = { 1: 3, 2: 2, 3: 3, 4: 3, 5: 2, 1010: 3, 1011: 2, 1012: 3, 1000: 3 }; VP.S.unlocked = 6; VP.S.paws = { rio_0: 1, rio_1: 1 }; VP.Tour.open(); }); }],
  ['world-map', async page => { await page.evaluate(() => { VP.S.stars = { 1: 3, 2: 2, 3: 3, 4: 3, 5: 2, 1010: 3 }; VP.S.unlocked = 6; VP.Tour.view = 'world'; VP.Tour.sel = 'paris'; VP.UI.show('world'); }); }],
  ['world-flight', async page => { await page.evaluate(() => { __vp.unlockAll(); VP.Tour.open(); VP.UI.act.fly({ dataset: { id: 'rio' } }); }); }],
  ['city-rioverde', walkTo('rioverde')], ['city-rioverde-arrive', tour('rioverde')], ['city-urca-arrive', tour('rio_urca')], ['city-lapa', walkTo('rio_lapa')], ['city-saopaulo', walkTo('saopaulo')], ['city-brasilia', walkTo('brasilia')], ['city-salvador', walkTo('salvador')], ['city-paris', walkTo('paris')], ['city-toquio', walkTo('toquio')], ['city-newyork', walkTo('newyork')],
  ['rioverde-rally', tour('rioverde', 1070, 6)], ['urca-photo', tour('rio_urca', 1040, 8)],
  ['parkour', async page => { await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') }); await page.evaluate(() => { __vp.unlockAll(); VP.Audio.sfx = () => {}; __vp.start(206); VP.I.bot = __bot.poll; __bot.fields = {}; for (let i = 0; i < 3000; i++) { const G = __vp.G, c = G.cats[G.active]; if (G.over || (c.plat && c.plat.style === 'awning' && Math.abs(c.x - c.plat.x) < 20)) break; VP.I.poll(); VP.Game.update(1 / 30); } VP.I.bot = null; }); }],
  ['parkour-pad', async page => { await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') }); await page.evaluate(() => { __vp.unlockAll(); VP.Audio.sfx = () => {}; __vp.start(206); VP.I.bot = __bot.poll; __bot.fields = {}; for (let i = 0; i < 3000; i++) { const G = __vp.G, c = G.cats[G.active]; if (G.over || (c.jump && c.jump.arc > 2 && c.jump.t > 0.3)) break; VP.I.poll(); VP.Game.update(1 / 30); } VP.I.bot = null; }); }],
  ['gallery', async page => { await page.evaluate(() => { VP.UI.show('catcity'); }); await page.waitForTimeout(900); }],
  ['emotes', async page => { await page.evaluate(() => { VP.Audio.sfx = () => {}; __vp.free(); VP.HUD.emoOpen = 60; VP.Game.emote('dance'); }); }],
  ['rank', async page => { await page.evaluate(() => { VP.S.stars = { 1: 3, 2: 2, 205: 3, 1010: 3 }; VP.S.best = { 1: 1000, 2: 900, 205: 1500, 1010: 700 }; VP.UI.show('rank'); }); }],
  ['wardrobe', async page => { await page.evaluate(() => { VP.Wardrobe.cat = 'mimosa'; VP.Wardrobe.slot = 'head'; VP.Wardrobe.open(); }); }],
  ['shop', async page => { await page.evaluate(() => { VP.Shop.open(); }); }],
  ['share', async page => { await page.evaluate(() => { if (VP.Share) VP.Share.open({ score: 8450, stars: 3, mission: VP.Missions.get(12) }); }); }],
].filter(s => !filter || filter.split(',').some(f => s[0].includes(f)));
(async () => {
  await L.serve(); const bad = [];
  for (const mobile of [true, false]) {
    for (const [name, fn] of SHOTS) {
      const stand = PL.routes(STAND), CATS = [['Frajola', 'srd', 'tuxedo', '#222222', ['#ffffff'], ['bowtie'], 'frajola.cat'], ['Tigrinho', 'bengal', 'tabby', '#d9a066', ['#8a5a2b'], ['collar'], ''], ['Nina', 'siames', 'pointed', '#f2e6d0', ['#5a4030'], ['bow'], 'nina.gata'], ['Pipoca', 'vira-lata', 'calico', '#ffffff', ['#f28a2e', '#2b1f24'], ['bell', 'hat'], ''], ['Bolinha', 'persa', 'solid', '#9aa0a8', [], ['crown'], 'bolinha']].map((c, i) => ({ id: 'p' + i, name: c[0], breed: c[1], spec: { pattern: c[2], furBase: c[3], patchColors: c[4], accessories: c[5], faceShape: i % 2 ? 'flat' : 'round', size: 1 }, bio: 'Gosta de sachê e de janela.', instagram: c[6] || null }));
      const routes = /city-|rioverde|urca|world/.test(name) ? stand : /gallery|emotes|rank|free/.test(name) ? async page => page.route('**/api/**', r => { const u = new URL(r.request().url()), j = (st, b) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(b) }); if (u.pathname === '/api/cats/public') return j(200, { cats: CATS }); if (u.pathname === '/api/scores') return j(200, { top: [{ name: 'Mimosa', score: 52000, level: 50, stars: 300, missions: 120 }, { name: 'Mortícia', score: 31000, level: 38, stars: 190, missions: 77 }, { name: 'Mimo', score: 9000, level: 12, stars: 30, missions: 0 }] }); return j(401, { error: 'unauthorized' }); }) : undefined;
      const { browser, page, errors } = await L.open(mobile, routes ? { routes } : {});
      try { await page.waitForFunction(() => VP.Assets.get('portrait_morticia') && VP.Assets.get('title_bg'), null, { timeout: 8000 }).catch(() => {}); await fn(page); await page.waitForTimeout(1300); await L.shot(page, name + (mobile ? '-m' : '-d')); } catch (e) { errors.push('SHOT ' + e.message.split('\n')[0]); }
      if (errors.length) bad.push(name + (mobile ? '-m' : '-d') + ': ' + errors.slice(0, 2).join(' | '));
      await browser.close();
    }
  }
  console.log('shots', SHOTS.length * 2, 'errors', bad.length ? bad : 'none'); L.stop();
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
