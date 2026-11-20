const L = require('./lib.cjs');
const mob = process.argv[2] !== 'd', P = mob ? 'm-' : 'd-', ids = (process.argv[3] || 'miami,rio').split(',');
(async () => {
  await L.serve();
  const { browser, page, errors } = await L.open(mob);
  await page.evaluate(() => { __vp.unlockAll(); });
  await page.locator('[data-act=world]').first().click({ force: true }); await page.waitForTimeout(400); await L.shot(page, P + 'world');
  for (const id of ids) {
    await page.evaluate(async id => { await VP.Tour.load(id); VP.UI.tour(id); }, id);
    await page.waitForTimeout(3000); await L.shot(page, P + 'city-' + id);
    await page.evaluate(() => { VP.R3.snapCamera(0.8); }); await page.waitForTimeout(1500); await L.shot(page, P + 'city-' + id + '-2');
    console.log(id, await page.evaluate(() => JSON.stringify({ dc: VP.R3.draws, tris: VP.R3.tris, fps: VP.R3.fps, cars: __vp.G.cars.length, lm: __vp.G.W.landmarks.length, markers: __vp.G.markers.length })));
  }
  console.log('ERRORS', errors.slice(0, 6));
  await browser.close(); L.stop();
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
