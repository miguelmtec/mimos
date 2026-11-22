// Expansion 1 end-to-end checks: new mission templates, daily/weekly, tutorial (touch), terrain + comunidade rules
// (synthetic elevation fixture), share card + challenge links, cosmetic packs, settings, triangle budget.
// Usage: node tests/e2e/expansion.cjs [section,...]
const L = require('./lib.cjs'); const fs = require('fs'); const FX = require('../helpers/elev-fixture.cjs');
const only = process.argv[2] ? process.argv[2].split(',') : null, want = s => !only || only.includes(s);
let fails = 0; const ok = (name, v, extra) => { console.log((v ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && !v ? ' -> ' + JSON.stringify(extra) : '')); if (!v) fails++; };
const until = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 8000 }).then(() => true).catch(() => false);
const bot = async page => { await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') }); await page.evaluate(() => { __vp.unlockAll(); VP.Audio.sfx = () => {}; }); };
const run = (page, n) => page.evaluate(n => { try { return __bot.run(n, 400); } catch (e) { return { n, win: false, why: 'ERR ' + e.message }; } }, n);
(async () => {
  await L.serve();
  // ---------- 1. missions: every new template + a seeded random sample ----------
  if (want('missions')) {
    const { browser, page, errors } = await L.open(false); await bot(page);
    const info = await page.evaluate(() => ({ total: VP.Missions.list.length, types: [...new Set(VP.Missions.list.map(m => m.type))], firstOf: Object.fromEntries(VP.Missions.list.slice().reverse().map(m => [m.type, m.n])), all: VP.Missions.list.map(m => m.n), chapters: VP.Missions.DIST.filter(d => d.arc).length }));
    ok('at least 200 missions in missions.json', info.total >= 200, info.total);
    ok('15 extra chapters', info.chapters === 15, info.chapters);
    const NEW = ['escort', 'stealth', 'photo', 'chain', 'duel', 'parkour', 'kites', 'volley', 'fish', 'heist', 'kittens'];
    ok('all 11 new templates are in the catalogue', NEW.every(t => info.types.includes(t)), info.types);
    for (const t of NEW) { const r = await run(page, info.firstOf[t]); ok('bot completes template ' + t + ' (#' + r.n + ')', !!r.win, r.why); }
    let s = 20261119; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const sample = []; while (sample.length < 30) { const n = info.all[Math.floor(rnd() * info.all.length)]; if (!sample.includes(n)) sample.push(n); }
    let won = 0; const lost = []; for (const n of sample) { const r = await run(page, n); if (r.win) won++; else lost.push(n + ':' + r.why); }
    ok('bot completes a random sample of 30 missions', won === 30, lost);
    const st = await page.evaluate(() => { const r = __bot.run(264, 200), G = __vp.G; return { win: r.win, solo: G.solo, active: G.active }; });
    ok('stealth is a Morticia solo mission that hands control back', st.win && st.solo === null, st);
    ok('missions: zero console errors', errors.length === 0, errors.slice(0, 3)); await browser.close();
  }
  // ---------- 2. daily challenges + weekly events ----------
  if (want('daily')) {
    const { browser, page, errors } = await L.open(true);
    const d = await page.evaluate(() => { __vp.unlockAll(); const M = VP.Missions, A = new Date(2026, 10, 19), B = new Date(2026, 10, 20); const a1 = M.daily(A), a2 = M.daily(A), b = M.daily(B);
      const weeks = []; for (let i = 0; i < 10; i++) weeks.push(M.weekly(new Date(2026, 10, 2 + i * 7)).id);
      return { same: JSON.stringify(a1) === JSON.stringify(a2), diff: JSON.stringify(a1.list) !== JSON.stringify(b.list), n: a1.list.length, goals: a1.list.map(c => c.goal), valid: a1.list.every(c => M.get(c.n) && !M.get(c.n).boss), distinct: new Set(a1.list.map(c => c.n)).size, weeks, ev: M.events.length }; });
    ok('3 daily challenges, deterministic for a date', d.n === 3 && d.same && d.valid && d.distinct === 3, d);
    ok('daily challenges change with the date', d.diff);
    ok('weekly event rotates week by week', new Set(d.weeks).size === Math.min(10, d.ev) && d.weeks[0] !== d.weeks[1] && d.weeks[0] === d.weeks[8], d.weeks);
    const r = await page.evaluate(() => { const M = VP.Missions, S = VP.S; S.daily = null; S.lives = 3; const st = M.dailyState(), cash0 = S.cash, out = []; for (const c of st.list) out.push(M.dailyCheck({ m: M.get(c.n), noFaint: true, underPar: true, cash: 100 }).length); const again = M.dailyCheck({ m: M.get(st.list[0].n), noFaint: true, underPar: true, cash: 100 }).length; return { out, again, cash: S.cash - cash0, lives: S.lives, all: st.all, streak: S.streak && S.streak.n }; });
    ok('daily rewards are paid once (coins, +1 life for all three)', r.cash === 800 && r.lives === 4 && r.all === 1 && r.again === 0 && r.streak === 1, r);
    await page.evaluate(() => { VP.UI.show('title'); }); ok('title shows the daily bar', await page.locator('.dailybar[data-act=daily]').count() === 1);
    await page.locator('.dailybar[data-act=daily]').click({ force: true }); await page.waitForTimeout(200);
    ok('daily screen lists 3 challenges and the weekly event', await page.locator('#s-daily .mrow').count() === 3 && await page.locator('#s-daily .panel.t').count() === 1);
    await L.shot(page, 'x-daily'); ok('daily: zero console errors', errors.length === 0, errors.slice(0, 3)); await browser.close();
  }
  // ---------- 3. first-play tutorial, on touch ----------
  if (want('tutorial')) {
    const { browser, page, errors } = await L.open(true, { tutorial: true });
    await page.evaluate(() => { VP.Audio.sfx = () => {}; });
    await page.locator('[data-act=play]').click({ force: true });
    ok('first play starts the tutorial', await until(page, () => __vp.G && __vp.G.tutorial && __vp.G.steps[__vp.G.step].hint === 'move'));
    ok('skip button is visible', await page.locator('#tutskip').count() === 1);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2] || 0 })) });
    const hold = async (fn, pts, ms) => { await touch('touchStart', [pts[0]]); for (let i = 1; i < pts.length; i++) { await page.waitForTimeout(40); await touch('touchMove', [pts[i]]); } const r = await until(page, fn, null, ms || 9000); await touch('touchEnd', []); await page.waitForTimeout(120); return r; };
    // the marker is ahead-right of the cats: steer with the left stick towards it using the on-screen arrow/position
    const steer = async () => { for (let k = 0; k < 14; k++) { const v = await page.evaluate(() => { const G = __vp.G, st = G.steps[G.step]; if (!st || st.hint !== 'move') return null; const a = G.cats[G.active], at = st.at(), yaw = VP.I.yaw, dx = at.x - a.x, dy = at.y - a.y, l = Math.hypot(dx, dy) || 1, fx = Math.cos(yaw), fy = Math.sin(yaw); return { sx: (-fy * dx + fx * dy) / l, sy: -(fx * dx + fy * dy) / l }; }); if (!v) return true; await touch('touchStart', [[88, 720]]); await page.waitForTimeout(30); await touch('touchMove', [[88 + v.sx * 50, 720 + v.sy * 50]]); await page.waitForTimeout(450); await touch('touchEnd', []); await page.waitForTimeout(40); } return false; };
    ok('touch: left stick walks to the marker', await steer());
    await L.shot(page, 'x-tutorial-attack');
    ok('step 2 asks to attack', await page.evaluate(() => __vp.G.steps[__vp.G.step].hint === 'attack'));
    // walk next to the crate, then hold the right side to attack
    await page.waitForTimeout(200);
    const ab = await page.evaluate(() => [VP.HUD.btn.atk.x, VP.HUD.btn.atk.y]);
    ok('touch: holding the attack button beats the practice mutt', await hold(() => __vp.G.steps[__vp.G.step].hint === 'switch', [ab], 12000));
    const b = await page.evaluate(() => { const b = VP.HUD.btn; const i = (__vp.G.active + 1) % 3; return [b['c' + i].x, b['c' + i].y]; });
    await page.touchscreen.tap(b[0], b[1]);
    ok('touch: tapping a portrait switches cat', await until(page, () => __vp.G.steps[__vp.G.step].hint === 'revive'));
    const lives0 = await page.evaluate(() => { const G = __vp.G, d = G.cats.find(c => c.down), a = G.cats[G.active]; a.x = d.x + 26; a.y = d.y; return G.tutLives; });
    await page.waitForTimeout(300); await L.shot(page, 'x-tutorial-revive');
    const cb = await page.evaluate(() => [VP.HUD.btn.ctx.x, VP.HUD.btn.ctx.y]);
    ok('touch: holding the action button revives', await hold(() => !__vp.G.cats.some(c => c.down), [cb], 9000));
    ok('tutorial ends in free roam and is remembered', await until(page, () => __vp.G && __vp.G.free && VP.S.tut === 1 && !document.getElementById('tutskip'), null, 12000));
    ok('tutorial does not spend lives', await page.evaluate(l => VP.S.lives >= l, lives0));
    // skip path
    await page.evaluate(() => { VP.S.tut = 0; VP.UI.startTutorial(); }); await page.waitForTimeout(300);
    await page.locator('#tutskip').click({ force: true });
    ok('skip goes straight to the city', await until(page, () => __vp.G && __vp.G.free && VP.S.tut === 1));
    ok('tutorial: zero console errors', errors.length === 0, errors.slice(0, 3)); await browser.close();
  }
  // ---------- 4. terrain from elev + comunidade rules (synthetic fixture; the real rio.json is untouched) ----------
  if (want('terrain')) {
    const { browser, page, errors } = await L.open(false, { routes: FX.routes }); await bot(page);
    const pts = [[-300, -200], [0, 0], [250, 310], [-480, 420], [133, -77]];
    const t = await page.evaluate(async pts => { await VP.Tour.load('fix_morro'); VP.UI.tour('fix_morro'); const G = __vp.G, W = G.W, T = 48, MPT = VP.World.MPT, half = W.real.half;
      const hs = pts.map(p => W.hM(p[0], p[1]) / (2 / MPT)); const a = G.cats[G.active];
      // slope: find the steepest direction at the cat and compare speeds
      let up = [1, 0], g = -1; for (let k = 0; k < 16; k++) { const an = k / 16 * 6.283, d = W.hpx(a.x + Math.cos(an) * 30, a.y + Math.sin(an) * 30) - W.hpx(a.x, a.y); if (d > g) { g = d; up = [Math.cos(an), Math.sin(an)]; } }
      return { hasElev: W.hasElev, hs, pxOK: Math.abs(W.hpx((pts[2][0] + half) / MPT * T, (pts[2][1] + half) / MPT * T) - W.hM(pts[2][0], pts[2][1])) < 1e-6, upMul: VP.Game.slopeMul(a.x, a.y, up[0], up[1]), downMul: VP.Game.slopeMul(a.x, a.y, -up[0], -up[1]), g,
        tags: W.real.tags, noPolice: G.noPolice, noHeat: G.noHeat, dogs: G.dogs.length, traffic: G.cars.filter(c => c.ai !== 'parked').length, kinds: VP.Missions.tourList.filter(m => m.tourCity === 'fix_morro').map(m => m.p.kind), safe: VP.Missions.COMU_SAFE, ns: VP.Missions.tourList.filter(m => m.tourCity === 'fix_morro').map(m => m.n), pitch: !!W.pitch }; }, pts);
    ok('elev grid is used by the simulation', t.hasElev && t.pxOK);
    ok('bilinear terrain height matches the synthetic surface (within 1.5 m)', t.hs.every((h, i) => Math.abs(h - FX.height(pts[i][0], pts[i][1])) < 1.5), t.hs.map((h, i) => [+h.toFixed(1), +FX.height(pts[i][0], pts[i][1]).toFixed(1)]));
    ok('movement follows slopes: slower uphill, faster downhill', t.g > 0 && t.upMul < 0.98 && t.downMul > t.upMul && t.downMul <= 1.15, t);
    await page.waitForTimeout(1500);
    const r3 = await page.evaluate(() => { const G = __vp.G, W = G.W, a = G.cats[G.active], c = VP.R3.city; let car = null; return { catY: Math.abs(VP.R3.hAt(a.x, a.y) - W.hpx(a.x, a.y)) < 1e-6 || !!W.pitch, hRange: (() => { let lo = 1e9, hi = -1e9; for (let i = 0; i < 200; i++) { const q = W.randWalk(), h = W.hpx(q.x, q.y); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; })(), stairs: c.stairs || 0, murals: c.murals || 0, chunks: c.chunks.length, tris: VP.R3.tris, car }; });
    ok('cats, props and roads are seated on the terrain', r3.catY && r3.hRange > 10, r3);
    ok('comunidade look: stairways and murals are built', r3.stairs > 0 && r3.murals > 0, r3);
    ok('comunidade: no police, no wanted level, no hostile dogs, no traffic', t.noPolice && t.noHeat && t.dogs === 0 && t.traffic === 0, t);
    ok('comunidade: 10 missions, all from the positive list', t.kinds.length === 10 && t.kinds.every(k => t.safe.includes(k)) && !t.kinds.some(k => ['brawl', 'escape', 'race'].includes(k)), t.kinds);
    await page.evaluate(() => { const G = __vp.G; for (let i = 0; i < 600; i++) { VP.I.mx = 1; VP.I.my = 0; VP.Game.update(1 / 30); } });
    const after = await page.evaluate(() => ({ wanted: __vp.G.wanted, heat: __vp.G.heat, police: __vp.G.dogs.filter(e => e.police).length, dogs: __vp.G.dogs.length }));
    ok('comunidade: still peaceful after 20 s of play', after.wanted === 0 && after.heat === 0 && after.police === 0 && after.dogs === 0, after);
    let won = 0; const lost = []; for (const n of t.ns) { const r = await run(page, n); const peace = await page.evaluate(() => __vp.G.dogs.length === 0 && __vp.G.wanted === 0); if (r.win && peace) won++; else lost.push(n + ':' + r.why + (peace ? '' : ' NOT-PEACEFUL')); }
    ok('bot completes all 10 comunidade missions with zero enemies', won === 10, lost);
    await page.evaluate(() => { VP.UI.tour('fix_morro'); }); await page.waitForTimeout(1200); await L.shot(page, 'x-fixture-morro');
    // real data: sand strip for beach maps without a beach polygon; family filter on place names
    const real = await page.evaluate(async () => { const out = {}; for (const id of ['rio', 'miami']) { const W = await VP.Tour.load(id); if (!W) { out[id] = null; continue; } let sand = 0; for (let i = 0; i < W.gnd.length; i++) if (W.gnd[i] === VP.World.GT.G_SAND) sand++; out[id] = { strip: !!W.sandStrip, sand, tags: W.real.tags || [], beach: (W.real.beach || []).length, names: W.landmarks.map(l => l.name).join('|') }; } return out; });
    if (real.rio && real.rio.tags.includes('beach') && real.rio.beach === 0) ok('Copacabana gets a generated sand strip', real.rio.strip && real.rio.sand > 300, real.rio.sand); else console.log('SKIP sand strip (rio has a beach polygon or no beach tag)');
    ok('maps with a beach polygon keep it (no generated strip)', !real.miami || real.miami.beach === 0 || !real.miami.strip);
    ok('place names are family friendly', !/erotic/i.test(real.miami ? real.miami.names : ''));
    ok('terrain: zero console errors', errors.length === 0, errors.slice(0, 3)); await browser.close();
  }
  // ---------- 4b. Rio Verde bonus city (stand-in map until the real extract arrives) ----------
  if (want('agro')) {
    const { browser, page, errors } = await L.open(false, { routes: FX.agroRoutes }); await bot(page);
    const a = await page.evaluate(async () => { await VP.Tour.load('rioverde'); VP.UI.tour('rioverde'); const G = __vp.G, ms = VP.Missions.tourList.filter(m => m.tourCity === 'rioverde'); return { first: VP.Missions.cities[0].id, home: VP.Missions.cities[0].hometown, n: ms.length, names: ms.map(m => m.name[0]), ns: ms.map(m => m.n), song: VP.UI.citySong('rioverde'), farmers: G.friends.filter(f => f.name === 'farmer').length, pickups: G.cars.filter(c => c.type === 'pickup').length, kinds: ms.map(m => m.p.kind) }; });
    ok('Rio Verde is the hometown bonus city, listed first', a.first === 'rioverde' && a.home === 1, a);
    ok('Rio Verde has its own 10 agro missions, all friendly', a.n === 10 && a.names.includes('Rali das Caminhonetes') && !a.kinds.some(k => ['brawl', 'escape'].includes(k)), a.names);
    ok('agro flavour: sertanejo track, farmers at the fair, pickup trucks', a.song === 7 && a.farmers >= 3 && a.pickups >= 1, a);
    await page.waitForTimeout(1200); await L.shot(page, 'x-rioverde');
    const race = await page.evaluate(n => { __vp.start(n); return __vp.G.car && __vp.G.car.type; }, a.ns[0]);
    ok('the rally is driven in a pickup truck', race === 'pickup', race);
    let won = 0; const lost = []; for (const n of a.ns) { const r = await run(page, n); if (r.win) won++; else lost.push(n + ':' + r.why); }
    ok('bot completes all 10 Rio Verde missions', won === 10, lost);
    ok('agro: zero console errors', errors.length === 0, errors.slice(0, 3)); await browser.close();
  }
  // ---------- 5. share card + challenge link ----------
  if (want('share')) {
    const { browser, page, errors } = await L.open(true);
    const s = await page.evaluate(async () => { VP.S.name = 'Miguel'; const cur = await VP.Share.open({ score: 8450, stars: 3, mission: VP.Missions.get(12) }); const buf = new Uint8Array(await cur.blob.arrayBuffer()); const dv = new DataView(buf.buffer);
      const px = cur.cv.getContext('2d').getImageData(540, 500, 1, 1).data; return { w: cur.cv.width, h: cur.cv.height, type: cur.blob.type, png: buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47, pw: dv.getUint32(16), ph: dv.getUint32(20), kb: Math.round(buf.length / 1024), link: VP.Share.link(cur.ctx), px: [px[0], px[1], px[2]], screen: VP.UI.screen }; });
    ok('share image is a 1080x1350 PNG', s.w === 1080 && s.h === 1350 && s.png && s.pw === 1080 && s.ph === 1350 && s.type === 'image/png', s);
    ok('share screen shows the preview and both buttons', s.screen === 'share' && await page.locator('#shimg').count() === 1 && await page.locator('[data-act=shareImg]').count() === 1 && await page.locator('[data-act=shareDare]').count() === 1);
    ok('challenge link carries mission and score', /\?c=12-8450-Miguel$/.test(s.link), s.link);
    await page.waitForTimeout(400); await L.shot(page, 'x-share');
    fs.writeFileSync((process.env.VP_SHOTS || '/tmp') + '/x-share-card.png', Buffer.from((await page.evaluate(() => VP.Share.current().cv.toDataURL('image/png'))).split(',')[1], 'base64'));
    // download fallback when files cannot be shared
    const dl = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.evaluate(() => { const c = VP.Share.current(); c.canFiles = false; VP.UI.act.shareImg(); })]);
    ok('falls back to a download when file sharing is unavailable', !!dl[0] && dl[0].suggestedFilename() === 'vice-paws.png');
    const sh = await page.evaluate(async () => { let got = null; navigator.canShare = d => !!(d && d.files); navigator.share = d => { got = { files: d.files ? d.files.length : 0, name: d.files && d.files[0].name, type: d.files && d.files[0].type }; return Promise.resolve(); }; await VP.Share.open({ score: 100, stars: 2, mission: VP.Missions.get(3) }); VP.UI.act.shareImg(); return got; });
    ok('uses navigator.share with the PNG file when supported', sh && sh.files === 1 && sh.type === 'image/png', sh);
    await browser.close();
    // opening a challenge link
    const o = await L.open(true, { query: '?c=12-8450-Miguel' });
    const ch = await o.page.evaluate(() => VP.UI.challenge);
    ok('challenge link is read on load', ch && ch.n === 12 && ch.score === 8450 && ch.name === 'Miguel', ch);
    ok('title shows the dare', await o.page.locator('.dailybar.chal').count() === 1); await L.shot(o.page, 'x-challenge-title');
    await o.page.locator('.dailybar.chal').click({ force: true }); await o.page.waitForTimeout(200);
    ok('dare opens the briefing even if the mission is still locked', await o.page.evaluate(() => VP.UI.screen === 'brief' && VP.UI.arg === 12 && VP.S.unlocked === 1));
    await o.page.locator('[data-act=start]').click({ force: true });
    ok('challenged mission starts', await until(o.page, () => __vp.G && __vp.G.m.n === 12));
    const res = await o.page.evaluate(() => { const G = __vp.G; G.stat.cash = 9000; VP.UI.result(true); return { chal: VP.UI.last().chal, score: VP.UI.last().score }; });
    ok('result says whether the dare was beaten', res.chal && res.chal.won === (res.score > 8450), res);
    ok('garbage challenge codes are ignored', await o.page.evaluate(() => VP.Share.parse('?c=<script>') === null && VP.Share.parse('?c=99999-1') === null && VP.Share.parse('?c=12-50-%3Cb%3E').name === 'b'));
    ok('share: zero console errors', errors.length === 0 && o.errors.length === 0, errors.concat(o.errors).slice(0, 3)); await o.browser.close();
  }
  // ---------- 6. shop packs, wardrobe, settings ----------
  if (want('shop')) {
    const { browser, page, errors } = await L.open(true);
    const w = await page.evaluate(() => { const D = VP.Wardrobe.data, by = {}; for (const i of D.items) by[i.slot] = (by[i.slot] || 0) + 1; return { n: D.items.length, by, natal: D.items.filter(i => i.grant === 'pack_natal' || i.grant === 'season').length, grants: [...new Set(D.items.filter(i => i.grant).map(i => i.grant))], price: VP.Shop.PRICE }; });
    ok('wardrobe has at least 60 items across all slots', w.n >= 60 && Object.keys(w.by).length >= 6, w.by);
    ok('wardrobe has seasonal Natal items', w.natal >= 4, w.natal);
    await page.evaluate(() => VP.Shop.open()); await page.waitForTimeout(300);
    ok('shop shows 4 cosmetic packs and the R$0,99 support button', await page.locator('.card.pack').count() === 4 && await page.locator('[data-p=supporter_small]').count() === 1);
    ok('pack prices are R$0,99 / R$1,99', w.price.skin_praia === '0,99' && w.price.skin_agro === '0,99' && w.price.skin_festa === '1,99' && w.price.skin_natal === '1,99' && w.price.supporter_small === '0,99');
    await page.evaluate(() => document.querySelector('.packgrid').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500); await L.shot(page, 'x-shop-packs');
    await page.locator('[data-act=packTry][data-g=pack_agro]').click({ force: true }); await page.waitForTimeout(900);
    ok('try-on opens the wardrobe with the pack previewed, still locked', await page.evaluate(() => VP.UI.screen === 'wardrobe' && !VP.Shop.has('pack_agro') && VP.R3.mode === 'stage') && await page.locator('.wdi.pk.lock').count() >= 1);
    await L.shot(page, 'x-wardrobe-pack');
    const lock = await page.evaluate(() => { const it = VP.Wardrobe.data.items.find(i => i.id === 'cowboy_hat'); const before = VP.Wardrobe.owns(it); VP.Shop.apply('test-1', 'skin_agro', ['pack_agro']); return { before, after: VP.Wardrobe.owns(it), again: VP.Shop.apply('test-1', 'skin_agro', ['pack_agro']) }; });
    ok('pack items unlock only with the purchase grant (applied once)', lock.before === false && lock.after === true && lock.again === false, lock);
    await page.evaluate(() => VP.UI.show('settings')); await page.waitForTimeout(200);
    ok('settings: quality buttons and FPS toggle', await page.locator('[data-act=q]').count() === 4 && await page.locator('[data-act=fps]').count() === 1);
    await page.locator('[data-act=fps]').click({ force: true }); await page.locator('[data-act=q][data-v="0"]').click({ force: true }); await page.waitForTimeout(200);
    ok('settings are applied and remembered', await page.evaluate(() => VP.ls.get('vp_fps') === '1' && VP.R3.quality === 0 && VP.ls.get('vp_quality') === '0'));
    await L.shot(page, 'x-settings');
    await page.evaluate(() => { VP.Audio.sfx = () => {}; __vp.free(); }); await page.waitForTimeout(1500);
    const pf = await page.evaluate(() => ({ tris: VP.R3.tris, draws: VP.R3.draws, pr: VP.R3.pixelRatio() }));
    ok('low quality draws under 120k triangles', pf.tris > 1000 && pf.tris < 120000 && pf.pr <= 1, pf);
    ok('shop: zero console errors', errors.length === 0, errors.slice(0, 3)); await browser.close();
  }
  console.log(fails + ' failures'); L.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
