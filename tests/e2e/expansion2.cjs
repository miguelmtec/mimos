// Expansion 2 end-to-end checks: node tests/e2e/expansion2.cjs [section]
// infill (sparse cities), skyline, World Tour map, ranking over all missions, Cidade dos Gatos gallery, emotes, haptics,
// rooftop parkour, phone HUD layout and the first-load budget. City packs have their own run: tests/e2e/packs.cjs.
const L = require('./lib.cjs'), F = require('../helpers/elev-fixture.cjs'), P = require('../helpers/planned.cjs'), fs = require('fs');
const only = process.argv[2] || '';
let fails = 0; const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); if (!cond) fails++; };
const bot = page => page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') });
const CATS = [['Frajola', 'srd', 'tuxedo', '#222222', ['#ffffff'], ['bowtie'], 'frajola.cat'], ['Tigrinho', 'bengal', 'tabby', '#d9a066', ['#8a5a2b'], ['collar'], ''], ['Nina', 'siames', 'pointed', '#f2e6d0', ['#5a4030'], ['bow'], 'nina.gata']].map((c, i) => ({ id: 'p' + i, name: c[0], breed: c[1], spec: { pattern: c[2], furBase: c[3], patchColors: c[4], accessories: c[5], faceShape: 'round', size: 1 }, bio: 'Gosta de sachê.', instagram: c[6] || null }));
const SECTIONS = {
  // ---------- 1. procedural infill for sparse cities ----------
  async infill() {
    const { browser, page, errors } = await L.open(false, { routes: async page => { await F.agroRoutes(page); } });
    const a = await page.evaluate(async () => {
      __vp.unlockAll(); VP.Audio.sfx = () => {};
      const W = await VP.Tour.load('rioverde'), GT = VP.World.GT, sig = w => w.infill.map(l => [l.k, l.x, l.z, l.w, l.s].join(':')).join('|');
      const kinds = {}; for (const l of W.infill) kinds[l.k] = (kinds[l.k] || 0) + 1;
      // a second, independent rasterisation of the same extract must give the very same town
      const W2 = VP.World.fromCity(JSON.parse(JSON.stringify(W.real)), W.meta), same = sig(W) === sig(W2) && W.infill.length === W2.infill.length;
      // another id on the same streets gives a different town (seeded by city id)
      const C3 = JSON.parse(JSON.stringify(W.real)); C3.id = 'outra'; const W3 = VP.World.fromCity(C3, W.meta);
      // lots never sit on streets or footpaths: every road centre point stays walkable
      let roadPts = 0, blockedPts = 0; for (const rd of W.roads) for (const q of rd.pts) { roadPts++; if (W.tile(q.x, q.y) !== 0) blockedPts++; }
      let roofs = 0; for (let i = 0; i < W.gnd.length; i++) if (W.gnd[i] === GT.G_ROOF) roofs++;
      const before = W.walkList.length; VP.UI.tour('rioverde'); const G = __vp.G;
      const C4 = JSON.parse(JSON.stringify(W.real)); C4.infill = false; const W4 = VP.World.fromCity(C4, W.meta);
      return { lots: W.infill.length, kinds, trees: W.infillTrees.length, ipes: W.infillTrees.filter(t => t[2] === 'ipe').length, style: W.style, ratio: W.builtRatio, same, other: sig(W) !== sig(W3), roadPts, blockedPts, built: roofs / W.gnd.length, walkKept: W.walkList.length / before, city: { infill: VP.R3.city.infill, ipes: VP.R3.city.ipes }, off: W4.infill.length, tris: VP.R3.tris };
    });
    ok('sparse city (22 buildings) is detected', a.ratio < 0.05, a.ratio);
    ok('street frontage is filled with hundreds of lots (' + a.lots + ')', a.lots >= 400, a);
    ok('mix of houses, shops and small blocks', a.kinds.house > 100 && a.kinds.shop > 50 && a.kinds.block > 10, a.kinds);
    ok('Brazilian interior style with ipês in bloom', a.style === 'br_interior' && a.ipes > 30 && a.city.ipes === a.ipes, a);
    ok('deterministic: same extract, same town', a.same);
    ok('seeded by city id: another id, another town', a.other);
    ok('no lot covers a street (' + a.roadPts + ' road points stay walkable)', a.roadPts > 200 && a.blockedPts === 0, a);
    ok('the town is actually built up (' + Math.round(a.built * 100) + '% of the map is roofs and yards)', a.built > 0.08, a.built);
    ok('street network stays connected', a.walkKept > 0.9, a.walkKept);
    ok('renderer draws the same lots as the simulation', a.city.infill === a.lots, a.city);
    ok('infill can be switched off per city', a.off === 0, a.off);
    await page.waitForTimeout(1200); await L.shot(page, 'x2-infill');
    const b = await page.evaluate(async () => { const o = {}; for (const id of ['rio', 'miami', 'rio_santamarta', 'rio_vidigal']) { const W = await VP.Tour.load(id); o[id] = W.infill.length; } return o; });
    ok('well-mapped cities are left untouched', Object.values(b).every(v => v === 0), b);
    ok('infill: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
    // styles by country, on stand-in maps
    const r2 = await L.open(false, { routes: P.routes(['paris', 'toquio', 'newyork', 'cairo', 'salvador']) });
    const c = await r2.page.evaluate(async () => { const o = {}; for (const id of ['paris', 'toquio', 'newyork', 'cairo', 'salvador']) { const W = await VP.Tour.load(id); if (W) o[id] = [W.style, W.infill.length, W.infill.filter(l => l.k === 'block').length / W.infill.length]; } return o; });
    const present = id => P.present(id);
    ok('style follows the country (eu, asia, us, desert, br_coast)', ['paris:eu', 'toquio:asia', 'newyork:us', 'cairo:desert', 'salvador:br_coast'].every(s => { const [id, st] = s.split(':'); return present(id) || (c[id] && c[id][0] === st); }), c);
    ok('European streets get more multi-storey blocks than Brazilian ones', present('paris') || c.paris[2] > 0.35, c.paris);
    ok('styles: zero console errors', r2.errors.length === 0, r2.errors.slice(0, 3));
    await r2.browser.close();
  },
  // ---------- 2. Rio skyline backdrop + arrival camera ----------
  async skyline() {
    const { browser, page, errors } = await L.open(false, { routes: P.routes(['rio_urca']) });
    const a = await page.evaluate(async () => { __vp.unlockAll(); VP.Audio.sfx = () => {}; const o = {}; for (const id of ['rio', 'rio_urca', 'miami']) { await VP.Tour.load(id); VP.UI.tour(id); const d = VP.R3._dbg(); o[id] = { n: VP.R3.city.skyline, yaw: VP.R3.city.skyYaw, intro: d.cam.intro > 3, camYaw: d.cam.yaw }; } return o; });
    ok('Cristo Redentor and Pão de Açúcar stand on the horizon of Rio maps', a.rio.n === 2 && a.rio_urca.n === 2, a);
    ok('other cities have no Rio skyline', a.miami.n === 0, a.miami);
    ok('arriving in Rio opens with the camera on the landmark', a.rio.intro && Math.abs(a.rio.camYaw - a.rio.yaw) < 0.01, a.rio);
    await page.evaluate(async () => { await VP.Tour.load('rio_urca'); VP.UI.tour('rio_urca'); }); await page.waitForTimeout(900); await L.shot(page, 'x2-skyline');
    ok('skyline: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  },
  // ---------- 3. World Tour map ----------
  async world() {
    for (const mobile of [true, false]) {
      const tag = mobile ? 'touch' : 'desktop', { browser, page, errors } = await L.open(mobile, { routes: P.routes(['rioverde', 'saopaulo', 'paris', 'toquio']) });
      await page.evaluate(() => { VP.S.stars = { 1: 3, 2: 3, 1010: 3, 1011: 2 }; VP.S.best = { 1: 900, 2: 800, 1010: 700, 1011: 600 }; VP.S.unlocked = 3; VP.S.paws = { rio_0: 1, rio_1: 1 }; VP.Tour.open(); });
      const a = await page.evaluate(() => ({ view: VP.Tour.view, pins: document.querySelectorAll('.wmap .pin').length, br: VP.Missions.cities.filter(c => /brasil/i.test(c.country)).length, cards: document.querySelectorAll('.city2').length, first: document.querySelector('.city2 b').textContent, firstCtry: document.querySelector('h3.ctry').textContent, rio: document.querySelector('#city-rio .pg').textContent, lockedParis: document.querySelector('#city-paris') === null, soon: document.querySelectorAll('.wmap .soon').length, miamiFree: VP.Tour.unlocked(VP.Missions.cities.find(c => c.id === 'miami')), rioFree: VP.Tour.unlocked(VP.Missions.cities.find(c => c.id === 'rio')), cardH: document.querySelector('.city2').getBoundingClientRect().height, segH: document.querySelector('.seg button').getBoundingClientRect().height, scrollX: document.documentElement.scrollWidth <= innerWidth + 1 }));
      ok(tag + ': opens on Brazil, hometown first', a.view === 'br' && /Rio Verde/.test(a.first) && /Brasil/.test(a.firstCtry), a);
      ok(tag + ': one pin and one card per Brazilian city', a.pins === a.br && a.cards === a.br && a.br >= 5, a);
      ok(tag + ': Miami and Rio are free from the start', a.miamiFree && a.rioFree);
      ok(tag + ': city card shows stars, paws and postcards', /⭐ 5\/30/.test(a.rio) && /🐾 2\/5/.test(a.rio) && /📸 0\//.test(a.rio), a.rio);
      ok(tag + ': upcoming destinations are announced as "em breve" dots', a.soon >= 5, a.soon);
      ok(tag + ': comfortable touch targets, no sideways scroll', a.cardH >= 60 && a.segH >= 40 && a.scrollX, a);
      if (mobile) await L.shot(page, 'x2-world-br');
      await page.locator('.seg button[data-v=world]').click(); await page.waitForTimeout(200);
      const b = await page.evaluate(() => ({ pins: document.querySelectorAll('.wmap .pin').length, n: VP.Missions.cities.length, groups: [...document.querySelectorAll('h3.ctry')].map(h => h.textContent.trim().split(' ')[1]), paris: document.querySelector('#city-paris').className, need: document.querySelector('#city-paris .pg').textContent }));
      ok(tag + ': world view shows every city, grouped by country with Brazil first', b.pins === b.n && b.groups[0] === 'Brasil' && b.groups.length >= 3, b);
      ok(tag + ': far cities open with stars (never with money)', /lock/.test(b.paris) && /33/.test(b.need), b);
      await page.locator('#city-paris').click(); await page.waitForTimeout(300);
      const c = await page.evaluate(() => ({ sel: VP.Tour.sel, flight: !!document.getElementById('flight'), tour: __vp.G && __vp.G.tour, lbl: (document.querySelector('.wmap .lbl') || {}).textContent }));
      ok(tag + ': a locked city only gets selected (no flight)', c.sel === 'paris' && !c.flight && !c.tour && /Eiffel/.test(c.lbl), c);
      if (mobile) await L.shot(page, 'x2-world');
      await page.locator('#city-rio').click(); await page.waitForTimeout(500);
      const d = await page.evaluate(() => ({ flight: !!document.getElementById('flight'), plane: !!document.querySelector('#flight #plane[transform]'), route: !!document.querySelector('#flight .route') }));
      ok(tag + ': travelling shows the flight (plane on a route)', d.flight && d.plane && d.route, d);
      if (mobile) await L.shot(page, 'x2-flight');
      await page.waitForFunction(() => __vp.G && __vp.G.tour === 'rio' && !document.getElementById('flight'), null, { timeout: 8000 }).catch(() => {});
      const e = await page.evaluate(() => ({ tour: __vp.G && __vp.G.tour, flight: !!document.getElementById('flight') }));
      ok(tag + ': the flight lands in the city', e.tour === 'rio' && !e.flight, e);
      ok(tag + ': world tour, zero console errors', errors.length === 0, errors.slice(0, 3));
      await browser.close();
    }
  },
  // ---------- 4. ranking over all missions, gallery, emotes, haptics ----------
  async social() {
    let posted = null;
    const routes = async page => page.route('**/api/**', r => { const u = new URL(r.request().url()), j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
      if (u.pathname === '/api/cats/public') return j(200, { cats: CATS });
      if (u.pathname === '/api/scores') { if (r.request().method() === 'POST') posted = JSON.parse(r.request().postData()); return j(200, { top: [{ name: 'Mimosa', score: 52000, level: 50, stars: 300, missions: 120 }, { name: 'Antigo', score: 900, level: 4, stars: 9, missions: 0 }] }); }
      return j(401, { error: 'unauthorized' }); });
    for (const mobile of [true, false]) {
      const tag = mobile ? 'touch' : 'desktop', { browser, page, errors } = await L.open(mobile, { routes });
      // --- ranking ---
      posted = null;
      await page.evaluate(() => { VP.S.stars = { 1: 3, 2: 2, 205: 3, 1010: 3, 1011: 1 }; VP.S.best = { 1: 1000, 2: 900, 205: 1500, 1010: 700, 1011: 400 }; VP.S.unlocked = 3; VP.S.name = 'Tester'; VP.UI.show('rank'); });
      await page.waitForTimeout(300);
      const rk = await page.evaluate(() => ({ score: VP.UI.mainScore(), stars: VP.UI.mainStars(), done: VP.UI.doneCount(), rows: [...document.querySelectorAll('#rk li')].map(li => li.textContent) }));
      ok(tag + ': ranking total counts story, chapter and World Tour missions', rk.score === 4500 && rk.stars === 12 && rk.done === 5, rk);
      ok(tag + ': ranking rows show missions cleared (old rows keep M-level)', /🎯120/.test(rk.rows[0]) && /M4/.test(rk.rows[1]), rk.rows);
      await page.locator('[data-act=sendScore]').click(); await page.waitForTimeout(300);
      ok(tag + ': posted entry carries the all-missions totals', posted && posted.score === 4500 && posted.missions === 5 && posted.stars === 12 && posted.level === 2, posted);
      // --- Cidade dos Gatos ---
      await page.evaluate(() => VP.UI.show('title')); await page.evaluate(() => VP.UI.act.sheetMore()); await page.locator('[data-act=catcity]').click(); await page.waitForTimeout(1500);
      const g = await page.evaluate(() => ({ cards: document.querySelectorAll('.catcard').length, names: [...document.querySelectorAll('.catcard b')].map(b => b.textContent), imgs: [...document.querySelectorAll('.catcard img')].filter(i => i.src && i.naturalWidth > 100).length, ig: [...document.querySelectorAll('.catcard .ig')].map(s => s.textContent), mail: /@[\w.]+\.(com|co|br)\b/.test(document.querySelector('#s-catcity').textContent) }));
      ok(tag + ': gallery lists the registered cats plus the three stars', g.cards === 6 && g.names.includes('Frajola') && g.names.some(n => /Mimosa/.test(n)), g.names);
      ok(tag + ': every card has a 3D portrait', g.imgs === g.cards, g);
      ok(tag + ': only the Instagram handle is shown, never an e-mail', g.ig.includes('@frajola.cat') && !g.mail, g);
      if (mobile) await L.shot(page, 'x2-gallery');
      await page.locator('.catcard').first().click(); await page.waitForTimeout(500);
      const v = await page.evaluate(() => ({ screen: VP.UI.screen, mode: VP.R3.mode, txt: document.querySelector('#s-catview .panel').textContent }));
      ok(tag + ': tapping a card opens the cat in 3D with its note', v.screen === 'catview' && v.mode === 'stage' && /Frajola/.test(v.txt) && /sachê/.test(v.txt), v);
      await page.locator('#s-catview [data-act=gcWalk]').click(); await page.waitForTimeout(500);
      const w = await page.evaluate(() => { const G = __vp.G; return { free: !!G.free, walkers: G.friends.filter(f => f.label && f.wander).map(f => f.label), moved: (() => { const f = G.friends.find(f => f.wander); const x0 = f.x, y0 = f.y; for (let i = 0; i < 400; i++) VP.Game.update(1 / 30); return Math.hypot(f.x - x0, f.y - y0) > 5 || G.friends.filter(q => q.wander).some(q => Math.hypot(q.x - q.home.x, q.y - q.home.y) > 5); })() }; });
      ok(tag + ': the same cats stroll around the city with their names', w.free && w.walkers.length === 3 && w.walkers.includes('Frajola @frajola.cat') && w.moved, w);
      // --- emotes ---
      const b = await page.evaluate(() => { VP.Audio.sfx = () => {}; __vp.free(); return { emo: VP.HUD.btn.emo, sit: VP.HUD.btn.em_sit, dash: VP.HUD.btn.dash, special: VP.HUD.btn.special, wave: VP.HUD.btn.em_wave }; });
      await page.waitForTimeout(500);
      if (mobile) { await page.touchscreen.tap(b.emo.x, b.emo.y); await page.waitForTimeout(250); await L.shot(page, 'x2-emotes'); await page.touchscreen.tap(b.sit.x, b.sit.y); } else await page.keyboard.press('c');
      await page.waitForTimeout(300);
      const e1 = await page.evaluate(() => ({ e: (__vp.G.cats[__vp.G.active].emote || {}).k, snap: VP.Game.snapshot().cats[__vp.G.active].e, open: VP.HUD.emoOpen > 0 }));
      ok(tag + ': ' + (mobile ? 'two taps' : 'one key') + ' make the cat sit', e1.e === 'sit' && e1.snap === 'sit' && !e1.open, e1);
      const e2 = await page.evaluate(() => { const G = __vp.G, out = {}; for (const k of ['miau', 'dance', 'wave']) { out[k] = VP.Game.emote(k) && G.cats[G.active].emote.k === k; } const a = G.cats[G.active]; VP.I.bot = () => { VP.I.mx = 1; VP.I.my = 0; VP.I.attack = false; }; for (let i = 0; i < 12; i++) { VP.I.poll(); VP.Game.update(1 / 30); } VP.I.bot = null; out.cancel = !a.emote; out.keys = Object.keys(VP.Game.EMOTES).join(); return out; });
      ok(tag + ': miau, dance, sit and wave all work; walking ends the gesture', e2.miau && e2.dance && e2.wave && e2.cancel && e2.keys === 'miau,dance,sit,wave', e2);
      const big = Math.min(b.sit.r, b.wave.r) * 2 >= 44, clear = Math.hypot(b.wave.x - b.dash.x, b.wave.y - b.dash.y) > b.wave.r + b.dash.r && Math.hypot(b.wave.x - b.special.x, b.wave.y - b.special.y) > b.wave.r + b.special.r;
      ok(tag + ': emote buttons are finger-sized and clear of the action buttons', big && clear, b);
      const e3 = await page.evaluate(() => { __vp.start(1); return { on: VP.HUD.emoOn(__vp.G), hit: VP.HUD.hit(VP.HUD.btn.emo.x, VP.HUD.btn.emo.y) }; });
      ok(tag + ': emote buttons stay out of the way during missions', !e3.on && e3.hit !== 'emo', e3);
      // --- haptics ---
      const h = await page.evaluate(() => { const calls = []; try { Object.defineProperty(navigator, 'vibrate', { value: ms => { calls.push(ms); return true; }, configurable: true }); } catch (er) { navigator.vibrate = ms => { calls.push(ms); return true; }; }
        VP._hapT = 0; const a = VP.haptic(20); VP.ls.set('vp_haptic', '0'); VP._hapT = 0; const off = VP.haptic(20); VP.ls.set('vp_haptic', '1'); VP._hapT = 0; const G = __vp.G, c = G.cats[G.active]; const d = VP.Game.addDog('mutt', c.x + 30, c.y, {}); const n0 = calls.length; VP.Game.hurtCat ? 0 : 0; for (let i = 0; i < 90; i++) { VP.I.poll(); VP.Game.update(1 / 30); } return { first: a, off, calls: calls.length, n0, touch: VP.I.touch, dogHp: d.hp }; });
      if (mobile) ok('touch: hits vibrate the phone, and the setting turns it off', h.first === true && h.off === false && h.calls > h.n0, h);
      else ok('desktop: no vibration without a touch screen', h.first === false && h.calls === 0, h);
      ok(tag + ': social, zero console errors', errors.length === 0, errors.slice(0, 3));
      await browser.close();
    }
  },
  // ---------- 5. rooftop parkour ----------
  async parkour() {
    const { browser, page, errors } = await L.open(true, { routes: P.routes(['saopaulo']) });
    await bot(page);
    const a = await page.evaluate(() => {
      __vp.unlockAll(); VP.Audio.sfx = () => {}; __vp.start(206); const G = __vp.G, pk = G.pk, a = G.cats[G.active];
      const info = { plats: pk ? pk.plats.length : 0, pads: pk ? pk.pads.length : 0, styles: pk ? pk.plats.map(p => p.style) : [], hs: pk ? pk.plats.map(p => p.h) : [], steps: G.steps.map(s => s.txt), timer: G.mtimer };
      // 1) fairness: crates are climbed just by walking into them (even the tall one, so the street is never blocked);
      //    awnings and roofs stand on posts: from the street you walk underneath, the way up is the course
      const hi = pk.plats[2], lo = pk.plats[0], aw = pk.plats[3], ax = hi.x === aw.x ? 0 : 1; a.plat = null;
      if (ax) { a.x = hi.x; a.y = hi.y + hi.hh + 20; } else { a.x = hi.x + hi.hw + 20; a.y = hi.y; }
      VP.I.bot = () => { VP.I.mx = ax ? 0 : -1; VP.I.my = ax ? -1 : 0; VP.I.attack = false; }; info.scramble = false; for (let i = 0; i < 30 && !info.scramble; i++) { VP.I.poll(); VP.Game.update(1 / 30); info.scramble = a.plat === hi; }
      a.plat = null; if (ax) { a.x = aw.x; a.y = aw.y + aw.hh + 20; } else { a.x = aw.x + aw.hw + 20; a.y = aw.y; } info.under = true; for (let i = 0; i < 16; i++) { VP.I.poll(); VP.Game.update(1 / 30); if (a.plat) info.under = false; } info.under = info.under && Math.abs(a.x - aw.x) < aw.hw + 30 && Math.abs(a.y - aw.y) < aw.hh + 30;
      VP.I.bot = () => { VP.I.mx = 0; VP.I.my = -1; VP.I.attack = false; };
      a.x = lo.x; a.y = lo.y + lo.hh + 20; a.plat = null; info.climb = false; for (let i = 0; i < 30 && !info.climb; i++) { VP.I.poll(); VP.Game.update(1 / 30); info.climb = a.plat === lo; }
      // 2) walking off the side is a harmless drop
      a.x = lo.x; a.y = lo.y; a.plat = lo; const hp0 = a.hp, dn0 = G.stat.downs; VP.I.bot = () => { VP.I.mx = 0; VP.I.my = 1; VP.I.attack = false; }; for (let i = 0; i < 40; i++) { VP.I.poll(); VP.Game.update(1 / 30); } info.drop = !a.plat && a.hp === hp0 && G.stat.downs === dn0 && !G.over;
      VP.I.bot = null; return info;
    });
    ok('parkour mission builds a rooftop course (crates, awning, roofs, jump pad)', a.plats === 6 && a.pads === 1 && a.styles.filter(s => s === 'crate').length === 3 && a.styles.includes('awning') && a.styles.includes('roof'), a);
    ok('crates rise in climbable steps, roofs sit higher', a.hs[0] < 0.86 && a.hs[1] - a.hs[0] < 0.86 && a.hs[2] - a.hs[1] < 0.86 && a.hs[5] > a.hs[4] + 1, a.hs);
    ok('objectives walk the player through it', ['o_pkStart', 'o_pkUp', 'o_pkGap', 'o_pkPad', 'o_pkDown'].every(t => a.steps.includes(t)), a.steps);
    ok('crates are climbed by walking into them; awnings are walked under (the street is never blocked)', a.scramble && a.climb && a.under, a);
    ok('falling off is a harmless drop (no damage, no fail)', a.drop, a);
    // the whole mission, played by the bot, tracking what the leading cat did
    const r = await page.evaluate(() => { let maxH = 0, hops = 0, pads = 0, prev = null; const orig = VP.Game.update; VP.Game.update = function (dt) { orig(dt); const G = VP.Game.G; if (!G) return; const c = G.cats[G.active]; if (c.plat) maxH = Math.max(maxH, c.plat.h); if (c.jump && c.jump !== prev) { if (c.jump.arc > 2) pads++; else hops++; } prev = c.jump; }; const res = __bot.run(206, 500); VP.Game.update = orig; return { win: res.win, why: res.why, time: res.time, par: res.par, maxH, hops, pads }; });
    ok('bot clears the course: climbs, hops the gap, rides the jump pad to the high roof', r.win && r.maxH > 3 && r.hops >= 1 && r.pads >= 1, r);
    ok('the clock is fair (bot uses ' + r.time + 's of a ' + a.timer + 's clock)', r.time < a.timer * 0.75, r);
    await page.evaluate(() => { __vp.start(206); VP.I.bot = __bot.poll; __bot.fields = {}; for (let i = 0; i < 3000; i++) { const G = __vp.G; if (G.over || (G.cats[G.active].plat && G.cats[G.active].plat.style === 'roof')) break; VP.I.poll(); VP.Game.update(1 / 30); } VP.I.bot = null; });
    await page.waitForTimeout(700); await L.shot(page, 'x2-parkour');
    const y = await page.evaluate(() => { const G = __vp.G, c = G.cats[G.active]; return { plat: c.plat && c.plat.h, y: VP.R3.catY(c) }; });
    ok('the cat is drawn on top of the roof', y.plat > 2 && y.y >= y.plat - 0.01, y);
    const all = await page.evaluate(() => [206, 214, 233, 249, 256, 305].map(n => { const r = __bot.run(n, 500); return { n, win: r.win, t: r.time, par: r.par, course: !!(VP.Game.G && VP.Game.G.pk) }; }));
    ok('all six parkour missions are winnable with the course', all.every(x => x.win), all);
    const t = await page.evaluate(async () => { await VP.Tour.load('saopaulo'); VP.UI.tour('saopaulo'); const m = VP.Missions.tourList.find(m => m.tourCity === 'saopaulo' && m.p.kind === 'parkour'); const r = __bot.run(m.n, 500); return { win: r.win, why: r.why, course: !!VP.Game.G.pk }; });
    ok('World Tour parkour missions get a rooftop course too', t.win && t.course, t);
    ok('parkour: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  },
  // ---------- 6. phone HUD + first-load budget ----------
  async polish() {
    const { browser, page, errors } = await L.open(true, { routes: async page => { await F.agroRoutes(page); } });
    const a = await page.evaluate(() => { VP.Audio.sfx = () => {}; __vp.free(); const H = VP.HUD, b = H.btn, k = H.k; return { pause: b.pause.r * 2 + 14, portrait: b.c0.r * 2, dash: b.dash.r * 2, special: b.special.r * 2, emo: b.emo.r * 2 + 16, k }; });
    ok('touch targets are at least 44 px (pause, portraits, abilities, emotes)', a.pause >= 44 && a.portrait >= 44 && a.dash >= 44 && a.special >= 44 && a.emo >= 44, a);
    await page.waitForTimeout(1600);
    // the objective pill sits below the minimap and its label: sample the HUD canvas in the old overlap zone
    const px = await page.evaluate(() => { const H = VP.HUD, cv = document.getElementById('hud'), c = cv.getContext('2d'), dpr = cv.width / cv.clientWidth, y = (H.top + 113 * H.k) * dpr, d = c.getImageData(Math.round(H.w * 0.42 * dpr), Math.round(y), 1, 1).data, e = c.getImageData(Math.round(H.w * 0.42 * dpr), Math.round((H.top + 134 * H.k) * dpr), 1, 1).data; return { a: d[3], pill: e[3] }; });
    ok('phone HUD: the goal box sits below the minimap label, not under it', px.pill > 150 && px.a < px.pill - 50, px); // (the HUD canvas carries a soft full-screen tint, so compare with the box itself)
    const lab = await page.evaluate(async () => { await VP.Tour.load('rioverde'); VP.UI.tour('rioverde'); return 1; });
    await page.waitForTimeout(5200); await L.shot(page, 'x2-hud');
    void lab;
    ok('polish: zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
    // first load: everything the title screen needs, and no city file before travelling
    const { chromium } = require('playwright');
    const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] }), pg = await br.newPage();
    let bytes = 0; const files = [];
    pg.on('response', async r => { try { if (r.url().startsWith(L.URL) && r.status() === 200) { const b = await r.body(); bytes += b.length; files.push(r.url().replace(L.URL, '')); } } catch (e) { /* ignore */ } });
    await pg.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await pg.goto(L.URL); await pg.waitForFunction(() => window.__vp && window.VP.UI.ready, null, { timeout: 30000 }); await pg.waitForTimeout(1200);
    ok('first load stays under 2.6 MB (' + (bytes / 1048576).toFixed(2) + ' MB, ' + files.length + ' files)', bytes < 2.6 * 1048576, { bytes });
    ok('city maps are downloaded only when travelling', !files.some(f => /data\/cities\/(?!index)/.test(f)), files.filter(f => /cities/.test(f)));
    await br.close();
  },
};
(async () => {
  await L.serve();
  for (const k of Object.keys(SECTIONS)) if (!only || only.split(',').includes(k)) { console.log('--- ' + k + ' ---'); try { await SECTIONS[k](); } catch (e) { ok(k + ' ran without crashing', false, String(e.stack || e).split('\n').slice(0, 4).join(' | ')); } }
  console.log(fails + ' failures'); L.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
