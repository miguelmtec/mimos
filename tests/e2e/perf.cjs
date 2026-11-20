// Performance profile: triangles / draw calls per quality level and CPU-throttled frame times (CDP Emulation.setCPUThrottlingRate).
// Usage: node tests/e2e/perf.cjs [throttle=4] [city]      (software WebGL: compare runs against each other, not against a phone)
const L = require('./lib.cjs');
const rate = +(process.argv[2] || 4), cityId = process.argv[3] || '';
(async () => {
  await L.serve();
  const { browser, page, errors } = await L.open(true);
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => { VP.S.tut = 1; VP.Audio.sfx = () => {}; });
  if (cityId) await page.evaluate(async id => { await VP.Tour.load(id); VP.UI.tour(id); }, cityId); else await page.evaluate(() => __vp.free());
  await page.waitForTimeout(1200);
  const out = [];
  for (const q of [0, 1, 2]) {
    await page.evaluate(q => { VP.R3.setQuality(q); }, q);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => new Promise(res => {
      const ts = []; let n = 0, tris = 0, draws = 0, last = performance.now();
      const f = () => { const now = performance.now(); ts.push(now - last); last = now; tris = Math.max(tris, VP.R3.tris || 0); draws = Math.max(draws, VP.R3.draws || 0); if (++n < 90) requestAnimationFrame(f); else { ts.shift(); ts.sort((a, b) => a - b); res({ tris, draws, avg: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1), p50: +ts[ts.length >> 1].toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), pr: VP.R3.pixelRatio() }); } };
      requestAnimationFrame(f);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    out.push(Object.assign({ quality: ['low', 'medium', 'high'][q] }, r));
    console.log(JSON.stringify(out[out.length - 1]));
  }
  console.log('PERF', cityId || 'vice-city', 'cpu x' + rate, 'ERRORS', errors.slice(0, 4));
  await browser.close(); L.stop();
  if (out[0].tris > 120000) { console.error('FAIL: low quality draws', out[0].tris, 'triangles (> 120k)'); process.exit(1); }
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
