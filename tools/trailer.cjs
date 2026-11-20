// Grava um trailer vertical (1080x1920, 30 fps) do próprio jogo, quadro a quadro e determinístico.
// Uso: node tools/trailer.cjs <saida_dir> [preview]   (preview = só alguns quadros-chave)
const L = require('../tests/e2e/lib.cjs');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUT = path.resolve(process.argv[2] || '/tmp/trailer'); fs.mkdirSync(OUT, { recursive: true });
const PREVIEW = process.argv[3] === 'preview';
const FPS = 30;

async function boot(query) {
  const o = await L.open(true, { query });
  await o.page.setViewportSize({ width: 540, height: 960 });
  await o.page.evaluate(() => {
    VP.Audio.sfx = () => {}; VP.S.cash = 300;
    window.tp = (x, y) => { const G = __vp.G; G.cats.forEach((k, i) => { k.x = x + i * 4; k.y = y + i * 4; k.plat = null; }); G.cam.x = x; G.cam.y = y; };
    // para o laço do jogo: daqui em diante cada quadro é desenhado à mão
    window.__step = (n, bot) => { const G = __vp.G; for (let i = 0; i < n; i++) { VP.I.poll(); if (bot) bot(G, i); VP.Game.update(1 / 30); } if (window.__night != null && G.life) G.life.clock = window.__night; VP.R3.render(G, 1 / 30); };
  });
  return o;
}
async function freeze(page) { await page.evaluate(() => { window.requestAnimationFrame = () => 0; document.getElementById('hud').style.display = 'none'; document.getElementById('ui').style.display = 'none'; }); await page.waitForTimeout(200); }

// grava uma cena: setup() roda uma vez; bot(G,i) dirige a cada quadro
async function scene(page, name, secs, setupFn, botSrc) {
  await page.evaluate(setupFn);
  const n = Math.round(secs * FPS), dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
  const keys = PREVIEW ? [0, Math.floor(n / 2), n - 1] : null;
  for (let f = 0; f < n; f++) {
    await page.evaluate(([src, f]) => { const bot = src ? eval(src) : null; window.__step(1, bot ? (G, i) => bot(G, f) : null); }, [botSrc, f]);
    if (!keys || keys.includes(f)) await page.screenshot({ path: path.join(dir, String(f).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  if (!PREVIEW) {
    const tmp = path.join(OUT, name + '.tmp.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.jpg'), '-vf', 'scale=1080:1920,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp]);
    fs.renameSync(tmp, path.join(OUT, name + '.mp4'));
  }
  console.log('scene', name, n, 'frames');
}

(async () => {
  await L.serve();
  try {
    // ---- abertura: a tela de título do jogo ----
    { const t = await boot('');
      await t.page.waitForTimeout(1500);
      await t.page.screenshot({ path: path.join(OUT, 'title.jpg'), type: 'jpeg', quality: 92 });
      await t.browser.close(); }
    // ---- cidade viva: os Mimos correm pela rua cheia ----
    let o = await boot('');
    await o.page.evaluate(() => __vp.free());
    await o.page.waitForFunction(() => !VP.Life || VP.Life.ready, null, { timeout: 15000 }).catch(() => {});
    await o.page.waitForTimeout(800); await freeze(o.page);
    await scene(o.page, '1_cidade', 4.5, () => { const G = __vp.G; window.__step(60); },
      `(G, f) => { VP.I.mx = Math.cos(f / 50) * 0.9; VP.I.my = -0.6; }`);
    // ---- inimigos: Mimosa espanta o Aspirador Monstro, Mimo atira bolhas nos ratos ----
    await scene(o.page, '2_inimigos', 4, () => { const G = __vp.G, E = VP.Enemies, a = G.cats[G.active]; if (E && E.spawn) { E.spawn(G, 'aspirador', a.x + 70, a.y - 20, { state: 'act', force: true }); E.spawn(G, 'rato', a.x - 60, a.y - 50, { force: true }); E.spawn(G, 'pombo', a.x + 20, a.y - 90, { force: true }); } window.__step(5); },
      `(G, f) => { VP.I.mx = 0.3 * Math.sin(f / 15); VP.I.my = 0; VP.I.attack = (f % 12) < 3; if (f === 40) VP.Game.switchTo && VP.Game.switchTo(1); if (f === 80) VP.Game.switchTo && VP.Game.switchTo(0); }`);
    await o.browser.close();
    // ---- Natal Neon ----
    o = await boot('?season=natal');
    await o.page.evaluate(() => __vp.free());
    await o.page.waitForTimeout(1200); await freeze(o.page);
    await scene(o.page, '3_natal', 4, () => { window.__night = 0.85; window.__step(30); },
      `(G, f) => { VP.I.mx = 0.5; VP.I.my = -0.5 * Math.cos(f / 40); }`);
    await o.browser.close();
  } finally { L.stop(); }
})().catch(e => { console.error(e); process.exit(1); });
