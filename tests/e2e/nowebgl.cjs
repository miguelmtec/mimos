// The game must show a friendly screen (with the Instagram link) when WebGL is unavailable.
const { chromium } = require('playwright'); const L = require('./lib.cjs');
(async () => {
  await L.serve();
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
  await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto(L.URL); await page.waitForFunction(() => window.VP && VP.UI && VP.UI.ready && VP.UI.noGfx, null, { timeout: 20000 });
  const txt = await page.locator('#s-nowebgl').textContent();
  console.log(/3D/.test(txt) && await page.locator('#s-nowebgl a[href*="instagram.com/mimo.mimosa.morticia"]').count() >= 1 ? 'PASS no-webgl screen' : 'FAIL no-webgl screen', 'pageerrors:', errors.length);
  await page.screenshot({ path: (process.env.VP_SHOTS || '/tmp') + '/nowebgl.png' });
  await browser.close(); L.stop();
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
