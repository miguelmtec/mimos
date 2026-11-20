const { chromium } = require('playwright');
const { spawn } = require('child_process');
const PORT = +process.env.VP_PORT || 8765; // VP_PORT: run two checkouts side by side without sharing a server
let srv;
exports.serve = () => new Promise(r => { srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', process.env.VP_PUBLIC || require('path').resolve(__dirname, '../../public')], { stdio: 'ignore' }); setTimeout(r, 700); });
exports.stop = () => srv && srv.kill();
exports.URL = 'http://localhost:' + PORT + '/';
exports.open = async (mobile, opts = {}) => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: opts.locale || 'pt-BR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram' } : { viewport: { width: 1280, height: 800 }, locale: opts.locale || 'pt-BR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource/.test(t) || opts.strict404) errors.push(t); } });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  if (opts.routes) await opts.routes(page);
  else await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await page.goto(exports.URL + (opts.query || ''));
  await page.waitForFunction(() => window.__vp && window.VP.UI.ready && window.VP.R3 && (window.VP.R3.ok || window.VP.UI.noGfx), null, { timeout: 30000 });
  if (!opts.tutorial) await page.evaluate(() => { window.VP.S.tut = 1; }); // tests skip the first-play tutorial unless they ask for it
  return { browser, page, errors };
};
exports.shot = (page, name) => page.screenshot({ path: (process.env.VP_SHOTS || '/tmp') + '/' + name + '.png' });
