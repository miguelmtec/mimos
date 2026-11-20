const L = require('./lib.cjs');
const out = [], ok = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
const until = async (page, fn, arg, ms) => { try { await page.waitForFunction(fn, arg, { timeout: ms || 15000 }); return true; } catch (e) { return false; } };
(async () => {
  await L.serve();
  // ---------- desktop: keyboard + mouse ----------
  { const { browser, page, errors } = await L.open(false, { locale: 'en-US' });
    ok('EN default for en-US', (await page.locator('[data-act=play]').textContent()).includes('PLAY'));
    await page.locator('[data-act=lang]').first().click({ force: true }); await page.waitForTimeout(200);
    ok('lang toggle to PT', (await page.locator('[data-act=play]').textContent()).includes('JOGAR'));
    ok('footer + follow link', await page.evaluate(() => !!document.querySelector('.foot a[href="https://www.instagram.com/mimo.mimosa.morticia/"]') && /sem vínculo/.test(document.querySelector('.foot').textContent)));
    await page.evaluate(() => __vp.start(1)); await page.waitForTimeout(1200);
    const p0 = await page.evaluate(() => ({ x: __vp.G.cats[0].x, y: __vp.G.cats[0].y }));
    await page.keyboard.down('w'); ok('WASD moves cat', await until(page, p0 => Math.hypot(__vp.G.cats[0].x - p0.x, __vp.G.cats[0].y - p0.y) > 40, p0)); await page.keyboard.up('w');
    await page.mouse.move(700, 300); await page.mouse.down(); ok('mouse click shoots (Mimo)', await until(page, () => __vp.G.bullets.length > 0)); await page.mouse.up();
    await page.keyboard.press('2'); ok('key 2 -> Mimosa', await until(page, () => __vp.G.active === 1)); await page.evaluate(() => { __vp.G.cats[1].cdS = 0; });
    await page.mouse.down(); ok('Mimosa bites', await until(page, () => __vp.G.cats[1].combo > 0 || __vp.G.cats[1].atk > 0)); await page.mouse.up();
    await page.keyboard.press(' '); ok('Space -> roar on cooldown', await until(page, () => __vp.G.cats[1].cdS > 5));
    await page.keyboard.press('3'); ok('key 3 -> Morticia', await until(page, () => __vp.G.active === 2));
    // Morticia steals from a dog
    await page.evaluate(() => { const G = __vp.G, c = G.cats[2]; const e = VP.Game.addDog('mutt', c.x + 40, c.y, { carry: 'bone', guard: true }); e.stun = 5; VP.I.mw = { x: e.x, y: e.y }; });
    await page.mouse.down(); ok('Morticia steals + eats', await until(page, () => __vp.G.stat.stolen >= 1 && __vp.G.stat.eaten >= 1)); await page.mouse.up();
    await page.evaluate(() => { __vp.G.cats[2].belly = 100; }); await page.keyboard.press(' ');
    ok('FEAST triggers when full', await until(page, () => __vp.G.feast > 0));
    await page.keyboard.press('1'); await page.evaluate(() => { const m = __vp.G.cats[0]; m.cdS = 0; m.energy = 0; m.idle = 0; });
    ok('Mimo exhausted when energy 0', await until(page, () => __vp.G.active === 0 && __vp.G.cats[0].exhausted === true));
    await page.keyboard.press(' '); ok('NAP slow-motion', await until(page, () => __vp.G.nap > 0 && __vp.G.cats[0].exhausted === false));
    // revive
    await page.evaluate(() => { const G = __vp.G; for (const e of G.dogs) e.dead = true; const c = G.cats[1], a = G.cats[0]; c.x = a.x + 30; c.y = a.y; c.inv = 0; c.hp = 1; VP.S.lives = 3; VP.Game.revive; c.hp = 0; c.down = true; });
    ok('revive prompt appears', await until(page, () => __vp.G.ctx && __vp.G.ctx.k === 'revive'));
    await page.keyboard.down('e'); ok('hold E revives, costs a life', await until(page, () => !__vp.G.cats[1].down && VP.S.lives === 2)); await page.keyboard.up('e');
    // win blocked while a cat is down
    await page.evaluate(() => { const G = __vp.G; G.steps.length = 0; G.cats[2].down = true; G.cats[2].hp = 0; });
    ok('no win while a cat is down', await until(page, () => !__vp.G.over && __vp.G.needRevive === true));
    await page.evaluate(() => { const G = __vp.G, c = G.cats[2], a = G.cats[G.active]; c.x = a.x + 30; c.y = a.y; });
    await page.keyboard.down('e'); await until(page, () => !__vp.G.cats[2].down); await page.keyboard.up('e');
    await page.waitForFunction(() => __vp.state().screen === 'result', null, { timeout: 20000 }).catch(() => {});
    ok('mission complete screen', (await page.evaluate(() => __vp.state().screen)) === 'result' && await page.locator('.stars .on').count() >= 1);
    ok('map unlock: mission 2', await page.evaluate(() => VP.S.unlocked === 2 && VP.S.stars[1] >= 1));
    await L.shot(page, 'd-result');
    // car
    await page.evaluate(() => { __vp.free(); }); await page.waitForTimeout(800);
    await page.evaluate(() => { const G = __vp.G, a = G.cats[0]; VP.Game.addCar('pink', a.x + 50, a.y + 10, 0); }); await page.waitForTimeout(200);
    await until(page, () => __vp.G.ctx && __vp.G.ctx.k === 'car'); await page.keyboard.press('e');
    ok('E enters car', await until(page, () => !!__vp.G.car));
    const c0 = await page.evaluate(() => ({ x: __vp.G.car.x, y: __vp.G.car.y }));
    await page.keyboard.down('w'); ok('car drives', await until(page, c0 => Math.hypot(__vp.G.car.x - c0.x, __vp.G.car.y - c0.y) > 80, c0)); await page.keyboard.up('w');
    await L.shot(page, 'd-car');
    await until(page, () => Math.abs(__vp.G.car.spd) < 150); await page.keyboard.press('e');
    ok('E exits car', await until(page, () => !__vp.G.car));
    await page.keyboard.press('p'); ok('P pauses', await until(page, () => __vp.state().screen === 'pause'));
    await L.shot(page, 'd-pause');
    // fail flow
    await page.evaluate(() => { VP.UI.act.resume(); __vp.start(2); }); await page.waitForTimeout(500); await page.evaluate(() => __vp.fail('time'));
    await page.waitForFunction(() => __vp.state().screen === 'result', null, { timeout: 20000 }).catch(() => {});
    ok('mission fail screen with retry', await page.locator('[data-act=start][data-n="2"]').count() === 1 && /FALHOU/.test(await page.locator('h2').first().textContent()));
    // save / reload
    await page.reload(); await page.waitForFunction(() => window.__vp && VP.UI.ready && VP.R3 && VP.R3.ok);
    ok('save survives reload', await page.evaluate(() => VP.S.unlocked === 2 && VP.S.stars[1] >= 1 && VP.lang() === 'pt'));
    ok('desktop zero console errors', errors.length === 0); if (errors.length) console.log(errors.slice(0, 5));
    await browser.close(); }
  // ---------- mobile: touch twin-stick ----------
  { const { browser, page, errors } = await L.open(true);
    ok('PT default for pt-BR', (await page.locator('[data-act=play]').textContent()).includes('JOGAR'));
    await page.evaluate(() => __vp.start(1)); await page.waitForTimeout(1200);
    const ev = (type, id, x, y) => page.evaluate(([type, id, x, y]) => { const cv = document.getElementById('hud'); cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1 })); }, [type, id, x, y]);
    const p0 = await page.evaluate(() => ({ x: __vp.G.cats[0].x, y: __vp.G.cats[0].y }));
    await ev('pointerdown', 1, 90, 730); await ev('pointermove', 1, 90, 660);
    ok('left stick moves cat', await until(page, p0 => Math.hypot(__vp.G.cats[0].x - p0.x, __vp.G.cats[0].y - p0.y) > 40, p0));
    await ev('pointerdown', 2, 300, 730); await ev('pointermove', 2, 340, 700);
    ok('right stick aims + shoots', await until(page, () => __vp.G.bullets.length > 0 && VP.I.aim !== null));
    await L.shot(page, 'm-sticks');
    await ev('pointerup', 1, 90, 660); await ev('pointerup', 2, 340, 700);
    const b = await page.evaluate(() => VP.HUD.btn);
    await ev('pointerdown', 3, b.c1.x, b.c1.y); await ev('pointerup', 3, b.c1.x, b.c1.y);
    ok('tap portrait switches cat', await until(page, () => __vp.G.active === 1)); await page.evaluate(() => { __vp.G.cats[1].cdS = 0; });
    await ev('pointerdown', 4, b.special.x, b.special.y); await ev('pointerup', 4, b.special.x, b.special.y);
    ok('special button (roar)', await until(page, () => __vp.G.cats[1].cdS > 5));
    await ev('pointerdown', 5, b.dash.x, b.dash.y); await ev('pointerup', 5, b.dash.x, b.dash.y);
    ok('dash button', await until(page, () => __vp.G.cats[1].cd2 > 1));
    await page.evaluate(() => { const G = __vp.G; for (const e of G.dogs) e.dead = true; const c = G.cats[0], a = G.cats[1]; c.x = a.x + 30; c.y = a.y; c.hp = 0; c.down = true; VP.S.lives = 3; }); await until(page, () => __vp.G.ctx && __vp.G.ctx.k === 'revive');
    await ev('pointerdown', 6, b.ctx.x, b.ctx.y); ok('hold revive button', await until(page, () => !__vp.G.cats[0].down)); await ev('pointerup', 6, b.ctx.x, b.ctx.y);
    await ev('pointerdown', 7, b.pause.x, b.pause.y); await ev('pointerup', 7, b.pause.x, b.pause.y);
    ok('pause button', await until(page, () => __vp.state().screen === 'pause')); await L.shot(page, 'm-pause');
    ok('audio unlocked after tap', await page.evaluate(() => !!VP.Audio.ctx));
    ok('mobile zero console errors', errors.length === 0); if (errors.length) console.log(errors.slice(0, 5));
    await browser.close(); }
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length, 'failures');
  L.stop();
})().catch(e => { console.log(out.join('\n')); console.error(e); L.stop(); process.exit(1); });
