const L = require('./lib.cjs'); const fs = require('fs');
let list = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',').map(Number) : null;
(async () => {
  await L.serve();
  const { browser, page, errors } = await L.open(false);
  await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') });
  await page.evaluate(() => { __vp.unlockAll(); VP.Audio.sfx = () => {}; VP.Shop.P.grants.vip = true; VP.Shop.P.grants.season = true; });
  if (process.argv[3]) { await page.evaluate(async ids => { for (const id of ids) { await VP.Tour.load(id); VP.Missions.tourMissions(id); } }, process.argv[3].split(',')); }
  if (!list) list = await page.evaluate(() => VP.Missions.list.map(m => m.n));
  let ok = 0; const all = [];
  for (const n of list) {
    const r = await page.evaluate(n => { try { return __bot.run(n, 500); } catch (e) { return { n, err: e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ') }; } }, n);
    if (r.win) ok++; all.push(r);
    console.log(r.err ? JSON.stringify(r) : `${String(r.n).padStart(2)} ${r.type.padEnd(7)} ${r.win ? 'WIN ' : 'FAIL'} t=${String(r.time).padStart(3)} par=${String(r.par).padStart(3)} downs=${r.downs} lives=${r.livesLeft} cash=${r.cash} hp=${r.hp} ${r.win ? '' : r.why + ' | ' + r.steps + ' stuck ' + r.stuckFor + ' nopath ' + r.noPath}`);
  }
  fs.writeFileSync(__dirname + '/results.json', JSON.stringify(all));
  console.log('WON', ok, '/', list.length, 'ERRORS', errors.slice(0, 6));
  await browser.close(); L.stop();
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
