// Screenshot tour for visual review: node tests/e2e/shots.cjs [filter]   -> $VP_SHOTS (default /tmp), mobile 390x844 (touch) and desktop 1280x800
const L = require('./lib.cjs'); const fs = require('fs');
const filter = process.argv[2] || '';
const play = (n, secs) => async page => { await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') }); await page.evaluate(([n, secs]) => { __vp.unlockAll(); VP.Audio.sfx = () => {}; __vp.start(n); VP.I.bot = __bot.poll; __bot.fields = {}; for (let i = 0; i < secs * 30; i++) { if (!__vp.G || __vp.G.over) break; VP.I.poll(); VP.Game.update(1 / 30); } VP.I.bot = null; }, [n, secs]); };
const tour = (id, n, secs) => async page => { await page.evaluate(async id => { __vp.unlockAll(); VP.Audio.sfx = () => {}; await VP.Tour.load(id); VP.UI.tour(id); }, id); if (n !== undefined) { await page.waitForTimeout(600); await play(n, secs || 3)(page); } };
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
  ['world', async page => { await page.evaluate(() => { __vp.unlockAll(); VP.Tour.open(); }); }],
  ['wardrobe', async page => { await page.evaluate(() => { VP.Wardrobe.cat = 'mimosa'; VP.Wardrobe.slot = 'head'; VP.Wardrobe.open(); }); }],
  ['shop', async page => { await page.evaluate(() => { VP.Shop.open(); }); }],
  ['share', async page => { await page.evaluate(() => { if (VP.Share) VP.Share.open({ score: 8450, stars: 3, mission: VP.Missions.get(12) }); }); }],
].filter(s => !filter || filter.split(',').some(f => s[0].includes(f)));
(async () => {
  await L.serve(); const bad = [];
  for (const mobile of [true, false]) {
    for (const [name, fn] of SHOTS) {
      const { browser, page, errors } = await L.open(mobile);
      try { await page.waitForFunction(() => VP.Assets.get('portrait_morticia') && VP.Assets.get('title_bg'), null, { timeout: 8000 }).catch(() => {}); await fn(page); await page.waitForTimeout(1300); await L.shot(page, name + (mobile ? '-m' : '-d')); } catch (e) { errors.push('SHOT ' + e.message.split('\n')[0]); }
      if (errors.length) bad.push(name + (mobile ? '-m' : '-d') + ': ' + errors.slice(0, 2).join(' | '));
      await browser.close();
    }
  }
  console.log('shots', SHOTS.length * 2, 'errors', bad.length ? bad : 'none'); L.stop();
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
