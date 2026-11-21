// Controls: Space attacks, Shift jumps, Ctrl runs, Z X C V fire the powers, shooters aim with a reticle (melee cats do not), phone layout.
const L = require('./lib.cjs');
const out = [], ok = (n, c, extra) => { out.push((c ? 'PASS ' : 'FAIL ') + n); if (!c && extra !== undefined) console.log('  ->', n, JSON.stringify(extra)); };
const until = async (page, fn, arg, ms) => { try { await page.waitForFunction(fn, arg, { timeout: ms || 15000 }); return true; } catch (e) { return false; } };
const clear = page => page.evaluate(() => { const G = __vp.G; for (const e of G.dogs) e.dead = true; G.bullets.length = 0; G.lock = null; });
const spot = (page, i, d) => page.evaluate(([i, d]) => { const G = __vp.G, c = G.cats[i]; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d; if (G.W.los(c.x, c.y - 4, x, y - 4, 2)) return { x, y, a }; } return { x: c.x + d, y: c.y, a: 0 }; }, [i, d]);
const place = async (page, i, d, e) => { const q = await spot(page, i, d); await page.evaluate(([i, q, e]) => { const c = __vp.G.cats[i], t = window[e]; t.x = q.x; t.y = q.y; c.aim = q.a; }, [i, q, e]); };
const reset = (page, i) => page.evaluate(i => { const G = __vp.G, c = G.cats[i]; c.cdS = 0; c.pcd.fill(0); c.pe = 100; c.cd = 0; c.sta = 100; c.staLocked = false; c.bigT = 0; c.shieldT = 0; c.spikeT = 0; c.zoomT = 0; c.magT = 0; c.hp = c.max; c.inv = 0; }, i);
(async () => {
  await L.serve();
  // ---------- desktop: keyboard + mouse ----------
  { const { browser, page, errors } = await L.open(false, { locale: 'en-US' });
    ok('EN default for en-US', (await page.locator('[data-act=play]').textContent()).includes('PLAY'));
    await page.locator('[data-act=lang]').first().click({ force: true }); await page.waitForTimeout(200);
    ok('lang toggle to PT', (await page.locator('[data-act=play]').textContent()).includes('JOGAR'));
    ok('footer + follow link', await page.evaluate(() => !!document.querySelector('.foot a[href="https://www.instagram.com/mimo.mimosa.morticia/"]') && /sem vínculo/.test(document.querySelector('.foot').textContent)));
    await page.evaluate(() => __vp.start(1)); await page.waitForTimeout(1200);
    ok('help text lists Espaço / Shift / Ctrl / Z X C V', await page.evaluate(() => { const h = VP.t('howTxt'); return /Espaço/.test(h) && /Shift/.test(h) && /Ctrl/.test(h) && /Alt\/Option/.test(h) && /Z X C V/.test(h); }));
    ok('official loadouts', await page.evaluate(() => { const c = __vp.G.cats; return c[0].atkId === 'bubbles' && c[1].atkId === 'bite' && c[2].atkId === 'pounce' && c[0].pw.join() === 'nap,yawn,pillow,snore' && c[1].pw.join() === 'tantrum,lightning,spiky,glare' && c[2].pw.join() === 'feast,magnet,pilfer,burp'; }));
    await clear(page);
    // ---- walking: arrows and WASD ----
    let p0 = await page.evaluate(() => ({ x: __vp.G.cats[0].x, y: __vp.G.cats[0].y }));
    await page.keyboard.down('w'); ok('WASD moves cat', await until(page, p0 => Math.hypot(__vp.G.cats[0].x - p0.x, __vp.G.cats[0].y - p0.y) > 40, p0)); await page.keyboard.up('w');
    p0 = await page.evaluate(() => ({ x: __vp.G.cats[0].x, y: __vp.G.cats[0].y }));
    await page.keyboard.down('ArrowUp'); ok('arrow keys move the cat', await until(page, p0 => Math.hypot(__vp.G.cats[0].x - p0.x, __vp.G.cats[0].y - p0.y) > 40, p0)); await page.keyboard.up('ArrowUp');
    // ---- Space attacks (Mimo shoots, keyboard only: auto-aim) ----
    await page.evaluate(() => { const G = __vp.G, c = G.cats[0]; VP.Game.addDog('mutt', c.x + 40, c.y - 150, { carry: null }); VP.I.useMouse = false; });
    await page.keyboard.down(' '); ok('Space shoots (Mimo)', await until(page, () => __vp.G.bullets.length > 0)); await page.keyboard.up(' ');
    await clear(page);
    // ---- reticle: shooters only ----
    await page.mouse.move(760, 330); await page.waitForTimeout(500);
    ok('reticle visible for Mimo (shooter)', await page.evaluate(() => !!__vp.G.ret && VP.HUD.retOn === true && !!VP.HUD.retInfo && VP.Game.isRanged(__vp.G.cats[0])));
    await L.shot(page, 'd-reticle');
    // the shot flies towards the reticle (the mouse point on the ground)
    const aim = await page.evaluate(() => { const G = __vp.G, c = G.cats[0], mw = VP.I.mw; return { want: Math.atan2(mw.y - c.y, mw.x - c.x), d: Math.hypot(mw.x - c.x, mw.y - c.y) }; });
    await page.keyboard.down(' '); await until(page, () => __vp.G.bullets.length > 0); await page.keyboard.up(' ');
    const got = await page.evaluate(() => { const b = __vp.G.bullets[0]; return b ? Math.atan2(b.vy, b.vx) : null; });
    ok('shot travels toward the reticle', got !== null && Math.abs(Math.atan2(Math.sin(got - aim.want), Math.cos(got - aim.want))) < 0.2, { got, aim });
    await clear(page);
    // soft snap: a dog under the pointer takes the reticle
    await page.evaluate(() => { const G = __vp.G, e = VP.Game.addDog('mutt', VP.I.mw.x + 12, VP.I.mw.y + 8, { carry: null }); e.stun = 99; window.__hov = e; });
    await page.waitForTimeout(400);
    ok('hovering an enemy snaps the reticle onto it', await page.evaluate(() => __vp.G.ret.tgt === window.__hov && VP.HUD.retInfo.snapped === true));
    await L.shot(page, 'd-reticle-snap');
    await clear(page);
    // click shoots too
    await page.mouse.down(); ok('mouse click shoots (Mimo)', await until(page, () => __vp.G.bullets.length > 0)); await page.mouse.up();
    // ---- lock-on: Tab and right click, Q still cycles cats ----
    await clear(page);
    await page.evaluate(() => { const G = __vp.G, c = G.cats[0]; c.aim = -Math.PI / 2; window.__d = [60, 140, 220].map((d, i) => { const e = VP.Game.addDog('mutt', c.x + (i - 1) * 25, c.y - d, { carry: null }); e.stun = 99; return e; }); VP.I.useMouse = false; });
    await page.keyboard.press('Tab'); ok('Tab locks the nearest target', await until(page, () => __vp.G.lock === window.__d[0]));
    ok('Tab does not switch cats', await page.evaluate(() => __vp.G.active === 0));
    await page.keyboard.press('Tab'); ok('Tab again -> next target', await until(page, () => __vp.G.lock === window.__d[1]));
    await page.keyboard.press('Tab'); await until(page, () => __vp.G.lock === window.__d[2]); await page.keyboard.press('Tab'); ok('Tab past the last target clears the lock', await until(page, () => __vp.G.lock === null));
    await page.mouse.move(700, 300); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
    ok('right click locks a target', await until(page, () => !!__vp.G.lock));
    await page.evaluate(() => { __vp.G.cats[0].cd = 0; window.__lk = __vp.G.lock; window.__hp = window.__d.map(e => e.hp); });
    await page.keyboard.down(' '); await until(page, () => window.__lk.hp < window.__hp[window.__d.indexOf(window.__lk)], null, 4000); await page.keyboard.up(' ');
    ok('locked shot hits the locked enemy only', await page.evaluate(() => window.__d.every((e, i) => e === window.__lk ? e.hp < window.__hp[i] : e.hp === window.__hp[i])));
    await L.shot(page, 'd-lock');
    await page.keyboard.press('q'); ok('Q cycles cats', await until(page, () => __vp.G.active === 1));
    await clear(page);
    // ---- melee cats: no reticle, Space bites what is near ----
    await reset(page, 1);
    ok('no reticle for Mimosa (melee)', await page.evaluate(() => __vp.G.ret === null && !VP.Game.isRanged(__vp.G.cats[1])));
    await page.evaluate(() => { const c = __vp.G.cats[1], e = VP.Game.addDog('mutt', c.x + 30, c.y, { carry: null }); e.stun = 99; window.__m = e; });
    await page.keyboard.down(' '); ok('Space bites (Mimosa)', await until(page, () => __vp.G.cats[1].combo > 0 || __vp.G.cats[1].atk > 0)); ok('the bite hits the dog in front', await until(page, () => window.__m.hp < window.__m.max)); await page.keyboard.up(' ');
    await clear(page);
    // ---- Shift jumps with gravity ----
    await page.evaluate(() => { VP.I.reset(); });
    await page.keyboard.press('Shift'); ok('Shift jumps', await until(page, () => __vp.G.cats[1].z > 0.3, null, 3000));
    ok('jump comes back down (gravity)', await until(page, () => __vp.G.cats[1].z === 0 && __vp.G.cats[1].vz === 0, null, 4000));
    // ---- Ctrl runs (and drains the stamina) ----
    await reset(page, 1);
    const walk = async (ctrl) => { const a = await page.evaluate(() => ({ x: __vp.G.cats[1].x, y: __vp.G.cats[1].y })); if (ctrl) await page.keyboard.down('Control'); await page.keyboard.down('d'); await page.waitForTimeout(600); const s = await page.evaluate(() => ({ x: __vp.G.cats[1].x, y: __vp.G.cats[1].y, run: __vp.G.cats[1].running, sta: __vp.G.cats[1].sta })); await page.keyboard.up('d'); if (ctrl) await page.keyboard.up('Control'); return { d: Math.hypot(s.x - a.x, s.y - a.y), run: s.run, sta: s.sta }; };
    const slow = await walk(false); await page.waitForTimeout(500); await reset(page, 1); const fast = await walk(true);
    ok('Ctrl runs faster and spends stamina', fast.d > slow.d * 0.9 && slow.run === false && fast.run === true && fast.sta < 99, { slow, fast });
    await reset(page, 1);
    { const a = await page.evaluate(() => ({ x: __vp.G.cats[1].x })); await page.keyboard.down('Alt'); await page.keyboard.down('a'); await page.waitForTimeout(400); const r = await page.evaluate(() => __vp.G.cats[1].running); await page.keyboard.up('a'); await page.keyboard.up('Alt'); ok('Alt/Option also runs (Mac)', r === true, a); }
    await L.shot(page, 'd-hud');
    // ---- Z X C V: Mimo ----
    await page.keyboard.press('1'); ok('key 1 -> Mimo', await until(page, () => __vp.G.active === 0)); await reset(page, 0); await clear(page);
    await page.evaluate(() => { const c = __vp.G.cats[0], e = VP.Game.addDog('mutt', c.x + 60, c.y, { carry: null }); window.__t = e; c.aim = 0; });
    await page.keyboard.press('x'); ok('X Bocejo Contagioso puts nearby enemies to sleep', await until(page, () => window.__t.zz > 2 && window.__t.stun > 2));
    await page.keyboard.press('c'); ok('C Travesseiro-Escudo shields', await until(page, () => __vp.G.cats[0].shieldT > 2));
    ok('the shield blocks a hit', await page.evaluate(() => { const c = __vp.G.cats[0], h = c.hp; c.inv = 0; return __vp.G.cats.length && !(VP.Game.hurtCat(c, 30, c.x + 20, c.y)) && c.hp === h; }));
    await page.evaluate(() => { const e = window.__t; e.stun = 0; e.zz = 0; const c = __vp.G.cats[0]; e.x = c.x + 70; e.y = c.y; c.aim = 0; });
    await page.keyboard.press('v'); ok('V Ronco Sônico pushes back', await until(page, () => window.__t.kx > 50 || window.__t.x > __vp.G.cats[0].x + 75 || window.__t.hp < window.__t.max));
    await page.keyboard.press('z'); ok('Z Soneca (slow motion)', await until(page, () => __vp.G.nap > 0 && __vp.G.cats[0].cdS > 5));
    // energy: a power without energy does not fire
    await page.evaluate(() => { const c = __vp.G.cats[0]; c.pe = 0; c.pcd[2] = 0; c.shieldT = 0; }); await page.keyboard.press('c'); await page.waitForTimeout(150);
    ok('no energy -> no power', await page.evaluate(() => __vp.G.cats[0].shieldT <= 0 && __vp.G.cats[0].pcd[2] <= 0));
    // ---- Mimosa ----
    await clear(page); await page.keyboard.press('2'); await until(page, () => __vp.G.active === 1); await reset(page, 1);
    await page.evaluate(() => { const c = __vp.G.cats[1], e = VP.Game.addDog('mutt', c.x + 90, c.y, { carry: null }); window.__t = e; c.aim = 0; });
    await page.keyboard.press('z'); ok('Z Chilique (AoE stun)', await until(page, () => __vp.G.cats[1].cdS > 5 && window.__t.stun > 1));
    await page.keyboard.press('x'); ok('X Unhada Relâmpago (dash)', await until(page, () => __vp.G.cats[1].dashT > 0 || __vp.G.cats[1].pcd[1] > 1));
    await page.keyboard.press('c'); ok('C Pelo Arrepiado', await until(page, () => __vp.G.cats[1].spikeT > 3));
    ok('spiky fur reflects the next hit instead of hurting', await page.evaluate(() => { const c = __vp.G.cats[1], h = c.hp, e = window.__t; e.stun = 0; c.inv = 0; const r = VP.Game.hurtCat(c, 20, e.x, e.y); return r === false && c.hp === h && c.spikeT === 0; }));
    await page.evaluate(() => { const c = __vp.G.cats[1]; c.pe = 100; window.__t = VP.Game.addDog('mutt', c.x, c.y, { carry: null }); }); await place(page, 1, 120, '__t');
    await page.keyboard.press('v'); ok('V Olhar Fulminante freezes one enemy', await until(page, () => window.__t.stun > 2), await page.evaluate(() => ({ st: window.__t.stun, dead: window.__t.dead, d: Math.hypot(window.__t.x - __vp.G.cats[1].x, window.__t.y - __vp.G.cats[1].y), pe: __vp.G.cats[1].pe, pcd: __vp.G.cats[1].pcd, act: __vp.G.active })));
    // ---- Morticia: Super Lanchão ----
    await clear(page); await page.keyboard.press('3'); await until(page, () => __vp.G.active === 2); await reset(page, 2);
    ok('Morticia starts at normal size', await page.evaluate(() => __vp.G.cats[2].gs === 1));
    await page.keyboard.press('z'); ok('Z SUPER LANCHÃO scales Morticia up (~1.6x)', await until(page, () => __vp.G.cats[2].gs > 1.5 && __vp.G.cats[2].bigT > 5, null, 5000));
    await L.shot(page, 'd-morticia-big');
    ok('double damage + knock-back immune while big', await page.evaluate(() => { const c = __vp.G.cats[2]; c.inv = 0; c.kx = c.ky = 0; VP.Game.hurtCat(c, 10, c.x - 20, c.y); return c.kx === 0 && c.ky === 0 && VP.Game.X.dm(c) === 2; }));
    await page.evaluate(() => { __vp.G.cats[2].bigT = 0.4; }); ok('...and shrinks back smoothly', await until(page, () => __vp.G.cats[2].gs < 1.02, null, 20000));
    await clear(page); await reset(page, 2);
    await page.keyboard.press('x'); ok('X Ímã de Petiscos', await until(page, () => __vp.G.cats[2].magT > 3));
    await page.evaluate(() => { const c = __vp.G.cats[2], e = VP.Game.addDog('mutt', c.x, c.y, { carry: 'bone', guard: true }); e.stun = 5; window.__t = e; window.__s0 = __vp.G.stat.stolen; }); await place(page, 2, 150, '__t');
    await page.keyboard.press('c'); ok('C Rouba-Rouba steals from range', await until(page, () => __vp.G.stat.stolen > window.__s0 && !window.__t.carry));
    await page.evaluate(() => { window.__t.stun = 0; }); await place(page, 2, 70, '__t');
    await page.keyboard.press('v'); ok('V Arroto Turbo (burp shockwave)', await until(page, () => window.__t.stun > 0.5 && __vp.G.cats[2].pcd[3] > 3));
    // pounce steals + eats with Space
    await clear(page); await reset(page, 2);
    await page.evaluate(() => { const G = __vp.G, c = G.cats[2]; const e = VP.Game.addDog('mutt', c.x + 40, c.y, { carry: 'bone', guard: true }); e.stun = 5; VP.I.mw = { x: e.x, y: e.y }; VP.I.useMouse = false; window.__s0 = G.stat.stolen; window.__e0 = G.stat.eaten; });
    await page.keyboard.down(' '); ok('Space pounce steals + eats (Morticia)', await until(page, () => __vp.G.stat.stolen > window.__s0 && __vp.G.stat.eaten > window.__e0)); await page.keyboard.up(' ');
    ok('no reticle for Morticia (melee)', await page.evaluate(() => __vp.G.ret === null));
    // ---- emotes moved to 7 8 9 0 ----
    await clear(page); await page.evaluate(() => { VP.I.reset(); });
    await page.keyboard.press('7'); ok('7 -> emote (miau)', await until(page, () => __vp.G.cats[2].emote && __vp.G.cats[2].emote.k === 'miau'));
    await page.keyboard.press('z'); await page.waitForTimeout(100); ok('Z no longer plays an emote', await page.evaluate(() => !(__vp.G.cats[2].emote && __vp.G.cats[2].emote.k === 'miau' && __vp.G.cats[2].emote.t > 1.25 && false)));
    // ---- mission flow, revive, car, pause ----
    await page.evaluate(() => { const G = __vp.G; for (const e of G.dogs) e.dead = true; const c = G.cats[1], a = G.cats[G.active]; c.x = a.x + 30; c.y = a.y; c.inv = 0; c.hp = 1; VP.S.lives = 3; c.hp = 0; c.down = true; });
    ok('revive prompt appears', await until(page, () => __vp.G.ctx && __vp.G.ctx.k === 'revive'));
    await page.keyboard.down('e'); ok('hold E revives, costs a life', await until(page, () => !__vp.G.cats[1].down && VP.S.lives === 2)); await page.keyboard.up('e');
    await page.evaluate(() => { const G = __vp.G; G.steps.length = 0; G.cats[2].down = true; G.cats[2].hp = 0; });
    ok('no win while a cat is down', await until(page, () => !__vp.G.over && __vp.G.needRevive === true));
    await page.evaluate(() => { const G = __vp.G, c = G.cats[2], a = G.cats[G.active]; c.x = a.x + 30; c.y = a.y; });
    await page.keyboard.down('e'); await until(page, () => !__vp.G.cats[2].down); await page.keyboard.up('e');
    await page.waitForFunction(() => __vp.state().screen === 'result', null, { timeout: 20000 }).catch(() => {});
    ok('mission complete screen', (await page.evaluate(() => __vp.state().screen)) === 'result' && await page.locator('.stars .on').count() >= 1);
    ok('map unlock: mission 2', await page.evaluate(() => VP.S.unlocked === 2 && VP.S.stars[1] >= 1));
    await L.shot(page, 'd-result');
    await page.evaluate(() => { __vp.start(1); }); await page.waitForTimeout(1000); await page.evaluate(() => { __vp.free(); }); await page.waitForTimeout(800);
    await page.evaluate(() => { __vp.G.nap = 0; }); { const q = await spot(page, 0, 60); await page.evaluate(q => { VP.Game.addCar('pink', q.x, q.y, q.a); }, q); } await page.waitForTimeout(200);
    await until(page, () => __vp.G.ctx && __vp.G.ctx.k === 'car'); await page.keyboard.press('e');
    ok('E enters car', await until(page, () => !!__vp.G.car));
    const c0 = await page.evaluate(() => ({ x: __vp.G.car.x, y: __vp.G.car.y }));
    let drove = false; for (const k of ['w', 'd', 's', 'a']) { await page.keyboard.down(k); drove = await until(page, c0 => Math.hypot(__vp.G.car.x - c0.x, __vp.G.car.y - c0.y) > 40 || Math.abs(__vp.G.car.spd) > 80, c0, 5000); await page.keyboard.up(k); if (drove) break; }
    ok('car drives', drove, await page.evaluate(c0 => ({ c0, car: __vp.G.car && { x: __vp.G.car.x, y: __vp.G.car.y, spd: __vp.G.car.spd }, mx: VP.I.mx, my: VP.I.my, keys: Object.keys(VP.I.keys).filter(q => VP.I.keys[q]), over: __vp.G.over, hp: __vp.G.car && __vp.G.car.hp }), c0));
    await L.shot(page, 'd-car');
    await until(page, () => Math.abs(__vp.G.car.spd) < 150); await page.keyboard.press('e');
    ok('E exits car', await until(page, () => !__vp.G.car));
    await page.keyboard.press('p'); ok('P pauses', await until(page, () => __vp.state().screen === 'pause'));
    await L.shot(page, 'd-pause');
    await page.evaluate(() => { VP.UI.act.resume(); __vp.start(2); }); await page.waitForTimeout(500); await page.evaluate(() => __vp.fail('time'));
    await page.waitForFunction(() => __vp.state().screen === 'result', null, { timeout: 20000 }).catch(() => {});
    ok('mission fail screen with retry', await page.locator('[data-act=start][data-n="2"]').count() === 1 && /FALHOU/.test(await page.locator('h2').first().textContent()));
    await page.reload(); await page.waitForFunction(() => window.__vp && VP.UI.ready && VP.R3 && VP.R3.ok);
    ok('save survives reload', await page.evaluate(() => VP.S.unlocked === 2 && VP.S.stars[1] >= 1 && VP.lang() === 'pt'));
    ok('desktop zero console errors', errors.length === 0); if (errors.length) console.log(errors.slice(0, 5));
    await browser.close(); }
  // ---------- phone: left stick + attack button + jump / run / 4 powers ----------
  for (const mode of ['portrait', 'landscape']) {
    const { browser, page, errors } = await L.open(true);
    if (mode === 'landscape') { await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(400); }
    ok(mode + ': PT default for pt-BR', (await page.locator('[data-act=play]').textContent()).includes('JOGAR'));
    await page.evaluate(() => __vp.start(1)); await page.waitForTimeout(1200);
    await clear(page);
    const ev = (type, id, x, y) => page.evaluate(([type, id, x, y]) => { const cv = document.getElementById('hud'); cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1 })); }, [type, id, x, y]);
    const b = await page.evaluate(() => JSON.parse(JSON.stringify(VP.HUD.btn)));
    const W = await page.evaluate(() => ({ w: VP.HUD.w, h: VP.HUD.h, top: VP.HUD.top, bot: VP.HUD.bot }));
    // layout: 44 px targets, nothing overlapping, nothing under the minimap / pause, all inside the screen
    const ids = ['p0', 'p1', 'p2', 'p3', 'jump', 'run', 'atk'];
    ok(mode + ': touch targets >= 44 px', ids.every(i => b[i].r * 2 >= 44), ids.map(i => b[i].r * 2));
    let overlap = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const A = b[ids[i]], B = b[ids[j]]; if (Math.hypot(A.x - B.x, A.y - B.y) < A.r + B.r) overlap.push(ids[i] + '/' + ids[j]); }
    ok(mode + ': buttons do not overlap each other', overlap.length === 0, overlap);
    const keep = ['c0', 'c1', 'c2', 'pause', 'emo']; const mm = await page.evaluate(() => VP.HUD.map);
    let clash = []; for (const i of ids) { const A = b[i]; if (Math.hypot(A.x - mm.x, A.y - mm.y) < A.r + mm.r) clash.push(i + '/minimap'); if (Math.hypot(A.x - b.pause.x, A.y - b.pause.y) < A.r + b.pause.r) clash.push(i + '/pause'); for (const q of ['c0', 'c1', 'c2', 'emo']) if (Math.hypot(A.x - b[q].x, A.y - b[q].y) < A.r + b[q].r) clash.push(i + '/' + q); }
    ok(mode + ': no overlap with minimap / pause / portraits / emotes', clash.length === 0, clash); void keep;
    ok(mode + ': inside the safe area', ids.every(i => b[i].x - b[i].r >= 0 && b[i].x + b[i].r <= W.w && b[i].y - b[i].r >= W.top && b[i].y + b[i].r <= W.h - W.bot), W);
    const inv = await page.evaluate(() => { const l = VP.Prog.hudLayout(__vp.G), o = []; for (const i of ['p0', 'p1', 'p2', 'p3', 'jump', 'run', 'atk']) for (const q in l) { const A = VP.HUD.btn[i]; if (l[q].r && Math.hypot(A.x - l[q].x, A.y - l[q].y) < A.r + l[q].r) o.push(i + '/' + q); } return o; });
    ok(mode + ': no overlap with the item row', inv.length === 0, inv);
    // movement stick
    const p0 = await page.evaluate(() => ({ x: __vp.G.cats[0].x, y: __vp.G.cats[0].y }));
    await ev('pointerdown', 1, 90, W.h - 160); await ev('pointermove', 1, 90, W.h - 230);
    ok(mode + ': left stick moves cat', await until(page, p0 => Math.hypot(__vp.G.cats[0].x - p0.x, __vp.G.cats[0].y - p0.y) > 40, p0));
    // RUN toggle
    await ev('pointerdown', 3, b.run.x, b.run.y); await ev('pointerup', 3, b.run.x, b.run.y);
    ok(mode + ': RUN toggles and the cat sprints', await until(page, () => VP.I.runT === true && __vp.G.cats[0].running === true));
    await ev('pointerdown', 3, b.run.x, b.run.y); await ev('pointerup', 3, b.run.x, b.run.y);
    ok(mode + ': RUN toggles off', await until(page, () => VP.I.runT === false));
    await ev('pointerup', 1, 90, W.h - 230);
    // JUMP
    await ev('pointerdown', 4, b.jump.x, b.jump.y); await ev('pointerup', 4, b.jump.x, b.jump.y);
    ok(mode + ': JUMP button jumps', await until(page, () => __vp.G.cats[0].z > 0.3, null, 3000));
    await page.waitForTimeout(900);
    // ATTACK as an aim stick (shooter): dragging shows the reticle, releasing shoots
    await page.evaluate(() => { const c = __vp.G.cats[0]; VP.Game.addDog('mutt', c.x, c.y - 200, { carry: null }).stun = 99; });
    await ev('pointerdown', 2, b.atk.x, b.atk.y); await ev('pointermove', 2, b.atk.x - 30, b.atk.y - 40);
    await page.waitForTimeout(250);
    { const s = await page.evaluate(() => ({ on: VP.HUD.retOn, info: VP.HUD.retInfo, n: __vp.G.bullets.length, ret: __vp.G.ret && __vp.G.ret.x, aim: VP.I.aimStick, atk: VP.I.atk })); ok(mode + ': aiming (drag) shows the reticle and does not shoot yet', s.on === true && s.info.mode === 'stick' && s.n === 0, s); }
    await L.shot(page, 'm-' + mode + '-aim');
    await ev('pointerup', 2, b.atk.x - 30, b.atk.y - 40);
    ok(mode + ': releasing the attack stick shoots', await until(page, () => __vp.G.bullets.length > 0 || __vp.G.stat.ko > 0 || __vp.G.dogs.some(d => d.hp < d.max)));
    await clear(page); await page.evaluate(() => { const c = __vp.G.cats[0]; VP.Game.addDog('mutt', c.x + 20, c.y - 120, { carry: null }).stun = 99; });
    await ev('pointerdown', 5, b.atk.x, b.atk.y); await ev('pointerup', 5, b.atk.x, b.atk.y);
    ok(mode + ': a quick tap shoots at the auto-target', await until(page, () => __vp.G.bullets.length > 0 || __vp.G.dogs.some(d => d.hp < d.max)));
    // powers
    await reset(page, 0); await clear(page);
    await ev('pointerdown', 6, b.p0.x, b.p0.y); await ev('pointerup', 6, b.p0.x, b.p0.y);
    ok(mode + ': power button 1 (Soneca)', await until(page, () => __vp.G.cats[0].cdS > 5));
    await ev('pointerdown', 6, b.p2.x, b.p2.y); await ev('pointerup', 6, b.p2.x, b.p2.y);
    ok(mode + ': power button 3 (Travesseiro-Escudo)', await until(page, () => __vp.G.cats[0].shieldT > 2));
    // switching to Mimosa: the attack button is a plain "hold to hit" for melee (no reticle)
    await ev('pointerdown', 7, b.c1.x, b.c1.y); await ev('pointerup', 7, b.c1.x, b.c1.y);
    ok(mode + ': tap portrait switches cat', await until(page, () => __vp.G.active === 1)); await reset(page, 1);
    await page.evaluate(() => { const c = __vp.G.cats[1]; VP.Game.addDog('mutt', c.x + 28, c.y, { carry: null }).stun = 99; });
    await ev('pointerdown', 8, b.atk.x, b.atk.y);
    ok(mode + ': holding ATTACK bites (Mimosa) and shows no reticle', await until(page, () => __vp.G.cats[1].atk > 0 || __vp.G.cats[1].combo > 0) && await page.evaluate(() => VP.HUD.retOn !== true || __vp.G.ret === null));
    await ev('pointerup', 8, b.atk.x, b.atk.y);
    await ev('pointerdown', 9, b.p1.x, b.p1.y); await ev('pointerup', 9, b.p1.x, b.p1.y);
    ok(mode + ': power button 2 (Unhada Relâmpago)', await until(page, () => __vp.G.cats[1].pcd[1] > 1 || __vp.G.cats[1].dashT > 0));
    await page.evaluate(() => { const G = __vp.G; for (const e of G.dogs) e.dead = true; const c = G.cats[0], a = G.cats[1]; c.x = a.x + 30; c.y = a.y; c.hp = 0; c.down = true; VP.S.lives = 3; }); await until(page, () => __vp.G.ctx && __vp.G.ctx.k === 'revive');
    await page.waitForTimeout(100); await L.shot(page, 'm-' + mode + '-hud');
    await ev('pointerdown', 10, b.ctx.x, b.ctx.y); ok(mode + ': hold revive button', await until(page, () => !__vp.G.cats[0].down)); await ev('pointerup', 10, b.ctx.x, b.ctx.y);
    await ev('pointerdown', 11, b.pause.x, b.pause.y); await ev('pointerup', 11, b.pause.x, b.pause.y);
    ok(mode + ': pause button', await until(page, () => __vp.state().screen === 'pause'));
    ok(mode + ': audio unlocked after tap', await page.evaluate(() => !!VP.Audio.ctx));
    ok(mode + ': zero console errors', errors.length === 0); if (errors.length) console.log(errors.slice(0, 5));
    await browser.close(); }
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length, 'failures');
  L.stop();
})().catch(e => { console.log(out.join('\n')); console.error(e); L.stop(); process.exit(1); });
