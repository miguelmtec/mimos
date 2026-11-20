// Screenshots of the enlarged home city: node tests/e2e/hoodshots.cjs [filter] [m|d]  -> $VP_SHOTS
const L = require('./lib.cjs');
const filter = process.argv[2] || '', only = process.argv[3] || '';
// [name, block column, block row, offset x, offset y (px from the crossing)]
const SPOTS = [
  ['hood-beach', 2, 10, 60, 60], ['hood-boardwalk', 5, 9, 60, 60], ['hood-boardwalk2', 12, 10, 60, 60], ['hood-park', 5, 5, 60, 60], ['hood-lake', 2, 6, 0, 0], ['hood-lakepier', 2, 7, 330, -150],
  ['hood-industrial', 13, 6, 60, 60], ['hood-hillside', 9, 2, 60, 60], ['hood-mirante', 8, 1, 330, 60], ['hood-downtown', 3, 2, 60, 60], ['hood-heights', 15, 2, 60, 60],
  ['edge-south', 2, 12, 330, 200], ['edge-south-harbor', 9, 12, 330, 150], ['edge-north', 9, 0, 330, -150], ['edge-east', 18, 6, 110, 330], ['edge-west', 0, 6, -150, 330],
];
(async () => {
  await L.serve(); const bad = [];
  for (const mobile of [true, false]) {
    if (only && only !== (mobile ? 'm' : 'd')) continue;
    const { browser, page, errors } = await L.open(mobile);
    for (const [name, i, j, ox, oy] of SPOTS) {
      if (filter && !filter.split(',').some(f => name.includes(f))) continue;
      await page.evaluate(([i, j, ox, oy]) => { VP.Audio.sfx = () => {}; const W = VP.Missions.world(); __vp.free({ x: W.RX[i] + ox, y: W.RY[j] + oy }); const G = __vp.G; for (let k = 0; k < 20; k++) VP.Game.update(1 / 30); G.real = 2; }, [i, j, ox, oy]);
      await page.waitForTimeout(1500);
      await L.shot(page, name + (mobile ? '-m' : '-d'));
    }
    if (errors.length) bad.push(...errors.slice(0, 4));
    await browser.close();
  }
  console.log('errors', bad.length ? bad : 'none'); L.stop();
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
