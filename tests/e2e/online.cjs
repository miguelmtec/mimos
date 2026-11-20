// Cidade Online end to end: two browsers in the same room, against the REAL api/online handler on an in-memory
// database (tests/helpers/online-dev-server.mjs) and, for the "ws" section, the real real-time server.
//   node tests/e2e/online.cjs [poll|desktop|social|extras|fallback|ws|shots]      screenshots -> $VP_SHOTS (default /tmp)
const L = require('./lib.cjs');
const only = process.argv[2] || '';
const out = [], ok = (n, c, extra) => { out.push((c ? 'PASS ' : 'FAIL ') + n + (c || extra === undefined ? '' : '  -> ' + JSON.stringify(extra))); };
const NICK = /^(Gato|Gata) .+ \d{1,3}$/;
const routes = async () => {};                       // the dev server answers /api itself
const sleep = ms => new Promise(r => setTimeout(r, ms));
const info = page => page.evaluate(() => { const O = VP.Online, G = __vp.G; return { state: O.state, room: O.room, you: O.you, tr: O.tr && O.tr.name, n: O.count(), online: !!(G && G.online), remotes: [...O.remotes.values()].map(r => ({ id: r.id, name: r.name, x: r.f ? r.f.x : null, y: r.f ? r.f.y : null, em: r.f && r.f.em ? r.f.em.k : null, say: r.say ? r.say.i : null, shown: !!r.f, car: r.f ? r.f.car : null })), toast: document.getElementById('toast').style.display !== 'none' ? document.getElementById('toast').textContent : '', screen: VP.UI.screen }; });
const until = async (page, fn, arg, ms = 12000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };
const tap = async (page, sel) => { await page.locator(sel).first().click({ force: true }); await page.waitForTimeout(250); };
// tap on the HUD canvas (touch or mouse, whatever the context is)
const hudTap = async (P, x, y) => { if (process.env.VP_DEBUG) console.log('hudTap', x, y, JSON.stringify(await P.page.evaluate(([x, y]) => [VP.HUD.hit(x, y), VP.UI.screen, VP.UI.paused, VP.I.enabled, VP.Online.sheet, document.elementFromPoint(x, y).id, VP.Online.state], [x, y]))); if (P.mobile) await P.page.touchscreen.tap(x, y); else await P.page.mouse.click(x, y); await P.page.waitForTimeout(300); };
// two software-rendered browsers share the CPU here: the lightest graphics keep the frame rate usable
async function client(mobile) { const P = await L.open(mobile, { routes }); P.mobile = mobile; await P.page.evaluate(() => { VP.Audio.sfx = () => {}; VP.R3.setQuality(0); }); return P; }
// through the menus, like a player: title -> Cidade Online -> pick who the others see -> enter
async function enterByMenu(P, cat) {
  await tap(P.page, '[data-act=online]');
  await until(P.page, () => VP.UI.screen === 'online' && !!document.querySelector('[data-act=onEnter]:not([disabled])'));
  if (cat) await tap(P.page, `[data-act=onCat][data-k=${cat}]`);
  await tap(P.page, '[data-act=onEnter]');
  return until(P.page, () => VP.Online.state === 'on');
}
// walks the local cat in a straight line for `ms` (the same thing the stick does, minus the collisions)
const walk = (page, dx, dy, ms) => page.evaluate(([dx, dy, ms]) => new Promise(res => { const t0 = performance.now(); let last = t0; const step = now => { const G = __vp.G; if (!G) return res(); const dt = (now - last) / 1000; last = now; for (const c of G.cats) { c.x += dx * dt; c.y += dy * dt; } G.cats[G.active].walk = 1; if (now - t0 < ms) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }), [dx, dy, ms]);
// a walkable spot near the local cat that is on screen and clear of the HUD (so a visitor standing there can be tapped)
const spotInView = () => { const G = __vp.G, c = G.cats[G.active], H = VP.HUD; let best = null, bs = -1; for (let i = 0; i < 16; i++) for (const d of [110, 160, 210]) { const x = c.x + Math.cos(i * Math.PI / 8) * d, y = c.y + Math.sin(i * Math.PI / 8) * d; if (G.W.blocked(x, y, 14, 0)) continue; const p = VP.R3.project(x, y, 1.75); if (!p.on || p.z > 1) continue; const sc = Math.min(p.x - 60, H.w - 60 - p.x, p.y - (H.top + 230), H.h * 0.62 - p.y); if (sc > bs) { bs = sc; best = { x, y }; } } return best || { x: c.x + 120, y: c.y }; };
// samples where the first remote cat is drawn, every 80 ms
const track = (page, ms) => page.evaluate(ms => new Promise(res => { const xs = []; const iv = setInterval(() => { const r = [...VP.Online.remotes.values()][0]; if (r && r.f) xs.push(Math.round(r.f.x * 10) / 10); }, 80); setTimeout(() => { clearInterval(iv); res(xs); }, ms); }), ms);

// a second player without a browser: it talks to the same API (ticket + ticks), which is all a client is to the server
async function robot(S, cat, room) {
  const H = { origin: S.url.replace(/\/$/, ''), 'content-type': 'application/json' };
  const tk = await (await fetch(S.url + 'api/online/ticket?cat=' + cat, { headers: H })).json();
  const st = { room: room || 'city', x: 1200, z: 4100, ry: 0, anim: 'idle' };
  const bot = { you: tk.you, last: null };
  bot.tick = async over => { Object.assign(st, { emote: undefined, phrase: undefined, car: undefined, anim: 'idle' }, over); const r = await fetch(S.url + 'api/online/tick', { method: 'POST', headers: H, body: JSON.stringify({ ticket: tk.ticket, ...st }) }); bot.last = await r.json(); if (bot.last.room) st.room = bot.last.room; return bot.last; };
  await bot.tick({});
  return bot;
}
async function pair(S, label, wantTransport) {
  const A = await client(true), B = await client(true);     // two phones (the desktop has its own section, with a scripted second player)
  const P = label + ' ';
  ok(P + 'A enters through the menu', await enterByMenu(A, 'mimosa'));
  ok(P + 'B enters through the menu', await enterByMenu(B, 'mimo'));
  ok(P + 'they see each other', await until(A.page, () => [...VP.Online.remotes.values()].some(r => r.f)) && await until(B.page, () => [...VP.Online.remotes.values()].some(r => r.f)));
  let a = await info(A.page), b = await info(B.page);
  ok(P + 'transport is ' + wantTransport, a.tr === wantTransport && b.tr === wantTransport, [a.tr, b.tr]);
  ok(P + 'same room instance', a.room === 'city#1' && b.room === 'city#1', [a.room, b.room]);
  ok(P + 'guests get generated nicknames', NICK.test(a.you.name) && NICK.test(b.you.name) && a.you.guest && b.you.guest, [a.you, b.you]);
  ok(P + 'each one sees the other by that nickname', a.remotes[0].name === b.you.name && b.remotes[0].name === a.you.name);
  ok(P + 'player count is 2', a.n === 2 && b.n === 2, [a.n, b.n]);
  ok(P + 'the cats do not start inside each other', Math.hypot(a.remotes[0].x - b.remotes[0].x, a.remotes[0].y - b.remotes[0].y) > 12);
  ok(P + 'objective line shows the room and the count', /#1 · 👥 2/.test(await A.page.evaluate(() => VP.Missions.objective(__vp.G).txt)));
  ok(P + 'online mode has no missions, dogs or police', await A.page.evaluate(() => { const G = __vp.G; return G.markers.length === 0 && G.dogs.length === 0 && G.noPolice && G.noHeat && G.free; }));

  // --- movement: B watches A walk; the remote cat must glide, not jump from tick to tick
  const x0 = b.remotes[0].x;
  const [, xs] = await Promise.all([walk(A.page, 150, 0, 4200), track(B.page, 6500)]);
  const moved = xs[xs.length - 1] - x0, distinct = new Set(xs).size, maxStep = Math.max(...xs.slice(1).map((v, i) => Math.abs(v - xs[i])));
  if (process.env.VP_DEBUG) console.log(label, 'track', xs.join(' '));
  ok(P + 'B sees A move', moved > 450 && moved < 760, { moved });
  // (how smooth it looks depends on this machine's frame rate: software WebGL gives a few frames per second;
  //  the interpolation itself is checked frame-independently in the "interp" checks below)
  ok(P + 'the remote cat passes through positions in between', distinct >= 4, { distinct, maxStep, samples: xs.length });
  const ax = await A.page.evaluate(() => __vp.G.cats[__vp.G.active].x);
  await sleep(1800);
  b = await info(B.page);
  ok(P + 'and ends where A stopped', Math.abs(b.remotes[0].x - ax) < 30, { remote: b.remotes[0].x, ax });

  // --- emote
  await A.page.evaluate(() => VP.Game.emote('dance'));
  ok(P + 'emote reaches the other player', await until(B.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && r.f && r.f.em && r.f.em.k === 'dance'; }, null, 6000));

  // --- quick phrase, picked from the sheet opened with the 💬 button
  const say = await A.page.evaluate(() => VP.HUD.btn.say);
  await hudTap(A, say.x, say.y);
  ok(P + '💬 opens the fixed list (12 phrases, no text field)', await A.page.evaluate(() => document.querySelectorAll('#onl .ophrase').length === 12 && !document.querySelector('#onl input, #onl textarea')));
  if (label === 'poll' || only === 'shots') await L.shot(A.page, 'online-m-phrases');
  await tap(A.page, '#onl .ophrase[data-i="3"]');
  ok(P + 'phrase bubble shows on the other screen', await until(B.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && r.say && r.say.i === 3; }, null, 6000));
  ok(P + 'own bubble shows too', await A.page.evaluate(() => VP.Online.bubble && VP.Online.bubble.i === 3));
  await B.page.evaluate(() => VP.Online.say(0));
  await until(A.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && r.say && r.say.i === 0; }, null, 6000);
  await sleep(350);
  await L.shot(A.page, `online-m-${label}-bubble`);
  const gone = await until(B.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && !r.say; }, null, 7000);
  ok(P + 'bubble lasts about 4 s', gone);

  // --- shared golden paws: same places for both, first cat gets it, it disappears for the other
  const paws = pg => pg.evaluate(() => __vp.G.items.filter(i => i.online !== undefined && !i.dead).map(i => [i.online, Math.round(i.x), Math.round(i.y)]).sort((p, q) => p[0] - q[0]));
  const pa = await paws(A.page), pb = await paws(B.page);
  // (a paw slides towards a cat that is about to pick it up, so a nearby one may be a few steps off)
  ok(P + 'both see the same 6 paws in the same places', pa.length === 6 && pb.length === 6 && pa.every((q, i) => q[0] === pb[i][0] && Math.hypot(q[1] - pb[i][1], q[2] - pb[i][2]) < 90), [pa, pb]);
  const cash0 = await A.page.evaluate(() => VP.S.cash);
  await A.page.evaluate(([i, x, y]) => { const G = __vp.G; for (const c of G.cats) { c.x = x + 4; c.y = y + 4; } void i; }, pa[0]);
  ok(P + 'A collects one (+10 coins)', await until(A.page, c0 => VP.Online.got === 1 && VP.S.cash === c0 + 10, cash0, 5000), await A.page.evaluate(() => [VP.Online.got, VP.S.cash]));
  ok(P + 'it disappears for B', await until(B.page, i => !__vp.G.items.some(it => it.online === i && !it.dead), pa[0][0], 8000));
  ok(P + 'the single-player paw count is untouched', await A.page.evaluate(() => !Object.keys(VP.S.paws || {}).some(k => /online|city#/.test(k))));

  // --- mute: tap the cat's name tag
  const spot = await B.page.evaluate(spotInView);
  await A.page.evaluate(q => { for (const c of __vp.G.cats) { c.x = q.x; c.y = q.y; } }, spot);
  await until(B.page, q => { const r = [...VP.Online.remotes.values()][0]; return r && r.f && Math.hypot(r.f.x - q.x, r.f.y - q.y) < 40 && VP.Online.tags && VP.Online.tags.length; }, spot, 9000);
  await sleep(700);
  const tag = await B.page.evaluate(() => VP.Online.tags && VP.Online.tags[0]);
  ok(P + 'the other cat has a name tag on screen', !!tag, tag);
  if (tag) await hudTap(B, tag.x, tag.y - 16);
  ok(P + 'tapping a cat opens its card (mute / report)', await B.page.evaluate(() => VP.Online.sheet === 'cat' && !!document.querySelector('#onl [data-o=mute]') && !!document.querySelector('#onl [data-o=rep]')));
  await L.shot(B.page, `online-m-${label}-card`);
  await tap(B.page, '#onl [data-o=mute]');
  ok(P + 'muted cat disappears locally', await B.page.evaluate(() => { const r = [...VP.Online.remotes.values()][0]; return !r.f && !__vp.G.friends.some(f => f.remote); }));
  await B.page.evaluate(() => VP.Online.closeSheet());
  await sleep(1400); await A.page.evaluate(() => VP.Online.say(5)); await sleep(2600);
  ok(P + 'and its phrases are not shown', await B.page.evaluate(() => { const r = [...VP.Online.remotes.values()][0]; return !r.say; }));
  ok(P + 'A still sees B (mute is local)', (await info(A.page)).remotes[0].shown);
  // the list of who is here: unmute from there
  const pillRect = await B.page.evaluate(() => VP.HUD.obRect);
  await hudTap(B, pillRect.x + pillRect.w / 2, pillRect.y + pillRect.h / 2);
  ok(P + 'room pill opens the list', await B.page.evaluate(() => VP.Online.sheet === 'list' && document.querySelectorAll('#onl .orow').length === 2));
  await tap(B.page, '#onl [data-o=mute]');
  await B.page.evaluate(() => VP.Online.closeSheet()); await sleep(300);
  ok(P + 'unmuted cat is back', (await info(B.page)).remotes[0].shown);

  // --- report (fixed reasons), from the phone
  const pr = await A.page.evaluate(() => VP.HUD.obRect);
  await hudTap(A, pr.x + pr.w / 2, pr.y + pr.h / 2);
  await L.shot(A.page, `online-m-${label}-list`);
  await tap(A.page, '#onl [data-o=rep]');
  ok(P + 'report asks for one of 4 fixed reasons (no text field)', await A.page.evaluate(() => document.querySelectorAll('#onl [data-o=repSend]').length === 4 && !document.querySelector('#onl input, #onl textarea')));
  await L.shot(A.page, `online-m-${label}-report`);
  await tap(A.page, '#onl [data-o=repSend][data-r=behavior]');
  await sleep(900);
  const stored = label === 'ws' ? S.state.wsReports : await S.db.rows('vp_online_reports');
  ok(P + 'report is stored for review', stored.length === 1 && stored[0].target_id === b.you.id && stored[0].reporter_id === a.you.id && stored[0].reason === 'behavior' && stored[0].target_name === b.you.name, stored);
  ok(P + 'reporter is thanked and the cat is muted', /Denúncia enviada/.test((await info(A.page)).toast) && !(await info(A.page)).remotes[0].shown);
  await A.page.evaluate(() => { const O = VP.Online; O.mute([...O.remotes.keys()][0], false); });

  // --- driving
  await B.page.evaluate(() => { const G = __vp.G, c = G.cats[G.active]; const car = VP.Game.addCar('taxi', c.x + 60, c.y, 0); VP.Game.enterCar(car); });
  ok(P + 'a driving player is shown in a car', await until(A.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && r.f && r.f.car === 'taxi'; }, null, 7000));
  await sleep(300); await L.shot(A.page, `online-m-${label}-car`);
  await B.page.evaluate(() => VP.Game.exitCar());

  return { A, B, a, b };
}

(async () => {
  const { startDevServer } = await import('../helpers/online-dev-server.mjs');

  // ================= polling transport (Vercel + Neon): the one in use =================
  if (!only || only === 'poll' || only === 'shots') {
    const S = await startDevServer(); L.URL = S.url;
    const { A, B, b } = await pair(S, 'poll', 'poll');
    // --- the interpolation itself, without the frame rate of this machine getting in the way
    const curve = await A.page.evaluate(() => {
      const O = VP.Online, r = { s: [], f: { x: 0, y: 0, ry: 0 } }, out = [];
      for (let i = 0; i <= 4; i++) O._push(r, i * 150, 0, 0, 'walk', null, i * 1500);       // a cat walking 100 px/s, heard every 1.5 s
      for (let t = 0; t <= 7.6; t += 0.1) { O._interp(r, t, 1, 0.7); out.push(+r.f.x.toFixed(1)); }
      return out;
    });
    const steps = curve.slice(1).map((v, i) => v - curve[i]);
    ok('interp moves evenly between updates', steps.slice(0, 60).every(d => d > 9 && d < 11), steps.slice(0, 8));
    ok('interp keeps going for a moment when an update is late, then stops', curve[64] > 600 && curve[75] === curve[70] && curve[75] < 600 + 100 * 0.7, [curve[60], curve[64], curve[70], curve[75]]);
    ok('interp never runs backwards', steps.every(d => d >= 0));
    // what went over the wire: whitelisted keys only, never a name or a text
    const keys = new Set(); for (const body of S.state.bodies) for (const k of Object.keys(body || {})) keys.add(k);
    const allowed = ['ticket', 'room', 'x', 'z', 'ry', 'anim', 'car', 'emote', 'es', 'phrase', 'ps', 'paws', 'need', 'idle', 'trade'];
    ok('poll ticks carry only whitelisted fields', [...keys].every(k => allowed.includes(k)), [...keys]);
    ok('poll phrases travel as an index', S.state.bodies.some(x => x.phrase === 3) && S.state.bodies.every(x => x.phrase == null || Number.isInteger(x.phrase)));
    const rows = await S.db.rows('vp_presence');
    ok('poll presence rows hold no e-mail, no account and only a hashed address', rows.length === 2 && rows.every(r => !r.user_id && /^[0-9a-f]{32}$/.test(r.ip_hash) && NICK.test(r.name)), rows.map(r => [r.name, r.ip_hash]));
    // standing still: the client asks for reads only, and the pace is the configured 1.5 s
    const t0 = S.state.ticks, i0 = S.state.idleTicks; await sleep(6200);
    const ticks = S.state.ticks - t0, idle = S.state.idleTicks - i0;
    ok('poll about one tick per 1.5 s per player', ticks >= 6 && ticks <= 10, { ticks });
    ok('poll idle players send read-only ticks', idle >= ticks - 2, { ticks, idle });
    // a hidden tab stops asking
    await A.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
    await sleep(1700); const h0 = S.state.bodies.filter(x => x.ticket === S.state.bodies.find(y => y.x !== undefined).ticket).length; void h0;
    const before = S.state.ticks; await sleep(4600);
    ok('poll a hidden tab makes no requests', S.state.ticks - before <= 4, { both: S.state.ticks - before });
    await A.page.evaluate(() => { delete document.hidden; });
    await sleep(2500);
    // leaving: A goes back to solo, B stops seeing it within a few seconds
    await A.page.evaluate(() => VP.UI.pause()); await sleep(300);
    await L.shot(A.page, 'online-m-pause');
    ok('poll pause menu offers "Sair da Cidade Online"', await A.page.evaluate(() => !!document.querySelector('[data-act=onLeave]')));
    await tap(A.page, '[data-act=onLeave]');
    const ia = await info(A.page);
    ok('poll leaving returns to solo free roam', ia.state === 'off' && !ia.online && await A.page.evaluate(() => !!__vp.G && __vp.G.free && __vp.G.markers.length > 0));
    ok('poll the other player sees the cat go', await until(B.page, () => VP.Online.remotes.size === 0 && !__vp.G.friends.some(f => f.remote), null, 9000));
    ok('poll presence row is deleted at once', (await S.db.rows('vp_presence')).every(r => r.id === b.you.id));
    // starting a mission from online leaves the room (missions stay offline)
    await B.page.evaluate(() => { __vp.unlockAll(); __vp.start(1); });
    await sleep(600);
    ok('poll starting a mission leaves the room', (await info(B.page)).state === 'off' && (await S.db.rows('vp_presence')).length === 0);
    ok('poll zero console errors', A.errors.length === 0 && B.errors.length === 0, [A.errors, B.errors]);
    await A.browser.close(); await B.browser.close(); await S.close();
  }

  // ================= desktop (mouse + keyboard), with a scripted second player talking to the same API =================
  if (!only || only === 'desktop' || only === 'shots') {
    const S = await startDevServer(); L.URL = S.url;
    const D = await L.open(false, { routes }); D.mobile = false;
    await D.page.evaluate(() => { VP.Audio.sfx = () => {}; });
    await sleep(1500); await L.shot(D.page, 'online-d-title');
    ok('desktop enters through the menu', await enterByMenu(D, 'mimo'));
    const bot = await robot(S, 'morticia');
    const spot = await D.page.evaluate(spotInView);
    await bot.tick({ x: spot.x, z: spot.y, ry: 1.2 });
    ok('desktop sees the scripted player', await until(D.page, () => [...VP.Online.remotes.values()].some(r => r.f) && VP.Online.tags && VP.Online.tags.length > 0, null, 12000));
    await sleep(1600); await bot.tick({ phrase: 3, ps: 1, emote: 'wave', es: 1 });
    ok('desktop shows the phrase bubble', await until(D.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && r.say && r.say.i === 3; }, null, 7000));
    await D.page.evaluate(() => VP.Online.say(0)); await sleep(500);
    await L.shot(D.page, 'online-d-bubble');
    await D.page.keyboard.press('t'); await sleep(450);
    ok('desktop T opens the quick phrases', await D.page.evaluate(() => VP.Online.sheet === 'say' && document.querySelectorAll('#onl .ophrase').length === 12));
    await L.shot(D.page, 'online-d-phrases');
    await D.page.keyboard.press('Escape'); await sleep(200);
    ok('desktop Esc closes them without pausing', await D.page.evaluate(() => !VP.Online.sheet));
    await D.page.evaluate(() => { if (VP.UI.screen === 'pause') VP.UI.act.resume(); });
    await sleep(1600); await bot.tick({});
    const tag = await D.page.evaluate(() => VP.Online.tags[0]);
    await hudTap(D, tag.x, tag.y - 16);
    ok('desktop clicking a cat opens its card', await D.page.evaluate(() => VP.Online.sheet === 'cat'));
    await L.shot(D.page, 'online-d-card');
    await tap(D.page, '#onl [data-o=rep]'); await L.shot(D.page, 'online-d-report');
    await tap(D.page, '#onl [data-o=repSend][data-r=name]'); await sleep(700);
    const rep = await S.db.rows('vp_online_reports');
    ok('desktop report is stored', rep.length === 1 && rep[0].target_id === bot.you.id && rep[0].reason === 'name', rep);
    await D.page.evaluate(() => { const O = VP.Online; O.mute([...O.remotes.keys()][0], false); });
    const pr = await D.page.evaluate(() => VP.HUD.obRect);
    await hudTap(D, pr.x + pr.w / 2, pr.y + pr.h / 2);
    ok('desktop room pill opens the list', await D.page.evaluate(() => VP.Online.sheet === 'list'));
    await L.shot(D.page, 'online-d-list');
    await D.page.evaluate(() => VP.Online.closeSheet());
    await sleep(1600); await bot.tick({ anim: 'car', car: 'pink', x: spot.x + 30 });
    await until(D.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && r.f && r.f.car === 'pink'; }, null, 7000);
    await sleep(500); await L.shot(D.page, 'online-d-car');
    await D.page.evaluate(() => VP.UI.pause()); await sleep(300); await L.shot(D.page, 'online-d-pause');
    ok('desktop zero console errors', D.errors.length === 0, D.errors);
    await D.browser.close(); await S.close();
  }

  // ================= entries (menu, world map) and a real city =================
  if (!only || only === 'extras' || only === 'shots') {
    const S = await startDevServer(); L.URL = S.url;
    for (const mobile of [true, false]) {
      const P = await client(mobile), tag = mobile ? 'm' : 'd';
      await sleep(1200);
      if (mobile) await L.shot(P.page, 'online-m-title');
      ok(`extras ${tag} the menu has the Cidade Online button`, await P.page.evaluate(() => { const b = document.querySelector('#s-title [data-act=online]'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 40 && r.bottom <= innerHeight; }));
      await P.page.evaluate(() => { VP.S.stars = { 1: 3 }; VP.S.unlocked = 2; VP.Tour.open(); });
      await sleep(400); await L.shot(P.page, `online-${tag}-world`);
      ok(`extras ${tag} the world map has the Cidade Online button`, await P.page.evaluate(() => !!document.querySelector('#s-world [data-act=online]')));
      await tap(P.page, '#s-world [data-act=online]');
      ok(`extras ${tag} it opens the lobby with the open cities`, await P.page.evaluate(() => VP.UI.screen === 'online' && [...document.querySelectorAll('#onroom option')].map(o => o.value).join() === 'city,miami,rio'));
      // a real city is another room: Copacabana, with a scripted second cat already there
      const bot = await robot(S, 'mimosa', 'rio');
      await P.page.selectOption('#onroom', 'rio');
      await tap(P.page, '[data-act=onEnter]');
      ok(`extras ${tag} enters a real city online`, await until(P.page, () => VP.Online.state === 'on' && VP.Online.room === 'rio#1' && __vp.G.tour === 'rio', null, 30000), await info(P.page));
      await sleep(4800);                                        // the arrival camera
      const spot = await P.page.evaluate(spotInView);
      await bot.tick({ x: spot.x, z: spot.y, phrase: 4, ps: 1 });
      ok(`extras ${tag} and meets the cat that is there`, await until(P.page, () => [...VP.Online.remotes.values()].some(r => r.f && r.say), null, 12000));
      ok(`extras ${tag} real-city online keeps the rules (no missions, no dogs)`, await P.page.evaluate(() => { const G = __vp.G; return G.markers.length === 0 && G.dogs.length === 0 && G.noPolice; }));
      await sleep(400); await L.shot(P.page, `online-${tag}-rio`);
      // going to another map from the pause menu leaves the room
      await P.page.evaluate(() => VP.UI.free());
      await sleep(500);
      ok(`extras ${tag} going back to the solo city leaves the room`, (await info(P.page)).state === 'off' && !(await S.db.rows('vp_presence')).some(r => r.id !== bot.you.id));
      ok(`extras ${tag} zero console errors`, P.errors.length === 0, P.errors);
      await P.browser.close(); await S.db.reset();
    }
    await S.close();
  }

  // ================= alive city: level badge, outfits, and the safe trade =================
  if (!only || only === 'social' || only === 'shots') {
    const S = await startDevServer(); L.URL = S.url;
    const A = await client(true), B = await client(true);
    await A.page.evaluate(() => { const s = VP.S; s.stars = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 }; s.owned = ['cap_teal', 'gold_chain']; s.wear = { mimosa: { head: 'cap_teal', neck: 'gold_chain' } }; });
    await B.page.evaluate(() => { const s = VP.S; s.owned = ['sailor']; s.wear = { mimo: { body: 'sailor' } }; });
    ok('social both enter', await enterByMenu(A, 'mimosa') && await enterByMenu(B, 'mimo'));
    await until(A.page, () => [...VP.Online.remotes.values()].some(r => r.f)); await until(B.page, () => [...VP.Online.remotes.values()].some(r => r.f));
    const seen = pg => pg.evaluate(() => { const r = [...VP.Online.remotes.values()][0]; return { lv: r.lv, wear: r.look.wear, acc: r.f.spec ? r.f.spec.acc : null, star: r.look.star }; });
    const sa = await seen(B.page), sb = await seen(A.page);
    ok('social B sees A\'s level badge (35 stars -> Nv 8)', sa.lv === 8 && sb.lv === 1, [sa.lv, sb.lv]);
    ok('social B sees A\'s outfit (neon cap + gold chain on Mimosa)', sa.star === 'mimosa' && sa.wear.includes('cap_teal') && sa.acc && sa.acc.hat === '#2de2e6' && sa.acc.collar === '#ffd23f', sa);
    ok('social A sees B\'s outfit (sailor shirt on Mimo)', sb.wear.includes('sailor') && sb.acc && sb.acc.shirt === '#ffffff', sb);
    const spot = await B.page.evaluate(spotInView);
    await A.page.evaluate(q => { for (const c of __vp.G.cats) { c.x = q.x; c.y = q.y; } }, spot);
    await until(B.page, q => { const r = [...VP.Online.remotes.values()][0]; return r && r.f && Math.hypot(r.f.x - q.x, r.f.y - q.y) < 40 && VP.Online.tags && VP.Online.tags.length; }, spot, 9000);
    await sleep(600); await L.shot(B.page, 'online-m-badge-outfit');

    // --- trade: A offers the cap, B the sailor shirt
    const idOf = pg => pg.evaluate(() => [...VP.Online.remotes.keys()][0]);
    const ida = await idOf(B.page), idb = await idOf(A.page);
    await A.page.evaluate(id => VP.Online.openSheet('cat', id), idb); await sleep(450);
    await L.shot(A.page, 'online-m-card-trade');
    await tap(A.page, '#onl [data-o=trade]'); await sleep(450);
    ok('social trade sheet lists only coin-bought outfits, no text field', await A.page.evaluate(() => { const b = [...document.querySelectorAll('#onl [data-o=trGive]')].map(x => x.dataset.i); return b.join() === ',cap_teal,gold_chain' && !document.querySelector('#onl input, #onl textarea'); }));
    await tap(A.page, '#onl [data-o=trGive][data-i=cap_teal]');
    ok('social B gets an invitation it can decline', await until(B.page, () => VP.Online.sheet === 'inv' && !!document.querySelector('#onl [data-o=tradeNo]'), null, 8000));
    await L.shot(B.page, 'online-m-trade-invite');
    await sleep(400); await tap(B.page, '#onl [data-o=trade]'); await sleep(450);
    ok('social B sees what A offers', /Boné neon/.test(await B.page.evaluate(() => document.querySelector('#onl .otheirs').textContent)));
    await tap(B.page, '#onl [data-o=trGive][data-i=sailor]');
    ok('social confirm is locked right after a change', await B.page.evaluate(() => document.querySelector('#onl [data-o=trOk]').disabled));
    ok('social A sees B\'s offer arrive', await until(A.page, () => /Marinheiro/.test((document.querySelector('#onl .otheirs') || {}).textContent || ''), null, 8000));
    await until(A.page, () => { const b = document.querySelector('#onl [data-o=trOk]'); return b && !b.disabled; }, null, 8000);
    await sleep(400); await L.shot(A.page, 'online-m-trade');
    await tap(A.page, '#onl [data-o=trOk]');
    ok('social nothing changes hands until both confirm', await A.page.evaluate(() => VP.S.owned.includes('cap_teal') && !VP.S.owned.includes('sailor') && VP.Online.trade.st === 1));
    // B changes its mind: A's confirmation is reset
    await tap(B.page, '#onl [data-o=trGive][data-i=""]');
    ok('social a changed offer resets the other side\'s confirmation', await until(A.page, () => VP.Online.trade && VP.Online.trade.st === 0, null, 8000));
    await tap(B.page, '#onl [data-o=trGive][data-i=sailor]');
    await until(A.page, () => { const b = document.querySelector('#onl [data-o=trOk]'); return b && !b.disabled && /Marinheiro/.test(document.querySelector('#onl .otheirs').textContent); }, null, 10000);
    await sleep(400); await tap(A.page, '#onl [data-o=trOk]');
    await until(B.page, () => { const b = document.querySelector('#onl [data-o=trOk]'); return b && !b.disabled && /✔/.test(document.querySelector('#onl .otheirs').textContent); }, null, 10000);
    await sleep(400); await L.shot(B.page, 'online-m-trade-confirm');
    await tap(B.page, '#onl [data-o=trOk]');
    ok('social trade completes on both sides', await until(A.page, () => VP.S.owned.includes('sailor') && !VP.S.owned.includes('cap_teal'), null, 10000) && await until(B.page, () => VP.S.owned.includes('cap_teal') && !VP.S.owned.includes('sailor'), null, 10000), [await A.page.evaluate(() => VP.S.owned), await B.page.evaluate(() => VP.S.owned)]);
    ok('social the traded item is taken off the cat that wore it', await A.page.evaluate(() => !VP.S.wear.mimosa.head && VP.S.wear.mimosa.neck === 'gold_chain') && await B.page.evaluate(() => !VP.S.wear.mimo.body));
    ok('social each side is told what it got and the day count goes up', /Troca feita/.test((await info(A.page)).toast) && await A.page.evaluate(() => VP.S.trades.n === 1) && await B.page.evaluate(() => VP.S.trades.n === 1));
    await sleep(300); await L.shot(A.page, 'online-m-trade-done');
    const bodies = S.state.bodies.filter(x => x.trade);
    ok('social trade travelled as item ids only', bodies.length > 0 && bodies.every(x => Object.keys(x.trade).sort().join() === 'give,st,to' && (x.trade.give === null || /^[a-z0-9_]+$/.test(x.trade.give))));
    await sleep(7000);
    ok('social the offer is cleared afterwards', await A.page.evaluate(() => !VP.Online.trade) && (await S.db.rows('vp_presence')).every(r => !r.trade), (await S.db.rows('vp_presence')).map(r => r.trade));
    // a muted cat cannot invite
    await B.page.evaluate(id => VP.Online.mute(id, true), ida);
    await A.page.evaluate(id => { VP.Online.tradeOpen(id); VP.Online.tradeGive('gold_chain'); }, idb);
    await sleep(4000);
    ok('social a muted cat cannot send invitations', await B.page.evaluate(() => VP.Online.sheet !== 'inv' && ![...VP.Online.remotes.values()][0].offer));
    ok('social zero console errors', A.errors.length === 0 && B.errors.length === 0, [A.errors, B.errors]);
    await A.browser.close(); await B.browser.close(); await S.close();
  }

  // ================= failures: 503, mid-session outage, kill switch, full city =================
  if (!only || only === 'fallback' || only === 'shots') {
    const S = await startDevServer(); L.URL = S.url;
    for (const mobile of [true, false]) {
      const P = await client(mobile), tag = mobile ? 'm' : 'd';
      await tap(P.page, '[data-act=online]');
      await until(P.page, () => !!document.querySelector('[data-act=onEnter]:not([disabled])'));
      await L.shot(P.page, `online-${tag}-lobby`);
      ok(`fallback ${tag} lobby explains the safety rules`, /Não existe chat/.test(await P.page.locator('#s-online').textContent()));
      // --- API answers 503
      S.state.down = true;
      await tap(P.page, '[data-act=onEnter]');
      await until(P.page, () => !!__vp.G, null, 8000);
      let i = await info(P.page);
      ok(`fallback ${tag} 503 shows "Cidade Online indisponível agora"`, /Cidade Online indisponível agora/.test(i.toast), i.toast);
      ok(`fallback ${tag} 503 falls back to solo free roam`, i.state === 'off' && !i.online && await P.page.evaluate(() => __vp.G.free && __vp.G.markers.length > 0 && VP.UI.state === 'play'));
      await sleep(300); await L.shot(P.page, `online-${tag}-unavailable`);
      // --- the API dies in the middle of a session
      S.state.down = false;
      await P.page.evaluate(() => VP.Online.enter('city'));
      ok(`fallback ${tag} connects when the API is back`, await until(P.page, () => VP.Online.state === 'on'));
      S.state.down = true;
      ok(`fallback ${tag} outage mid-session returns to solo`, await until(P.page, () => VP.Online.state === 'off' && __vp.G && !__vp.G.online && __vp.G.free, null, 25000));
      ok(`fallback ${tag} with the same message`, /Cidade Online indisponível agora/.test((await info(P.page)).toast));
      S.state.down = false;
      // --- the city is full (hard cap on everybody online)
      if (mobile) {
        const f = await S.fill(300);
        ok('fallback the 301st player is refused by the server', f.stopped === 300, f);
        await P.page.evaluate(() => VP.Online.enter('city'));
        await until(P.page, () => /Cidade cheia/.test(document.getElementById('toast').textContent), null, 8000);
        i = await info(P.page);
        ok('fallback full city shows "Cidade cheia, tente já já"', /Cidade cheia, tente já já/.test(i.toast) && i.state === 'off' && !i.online, i.toast);
        await L.shot(P.page, 'online-m-full');
        await S.db.reset();
      }
      // --- owner switch in data/online.json
      S.state.config.enabled = false;
      await P.page.evaluate(async () => { await VP.Online.loadCfg(true); VP.UI.act.title(); VP.UI.act.online(); });
      await sleep(400);
      ok(`fallback ${tag} disabled in online.json: lobby says unavailable and offers solo`, await P.page.evaluate(() => /indisponível/.test(document.getElementById('s-online').textContent) && !!document.querySelector('[data-act=onSolo]') && !document.querySelector('[data-act=onEnter]')));
      await L.shot(P.page, `online-${tag}-disabled`);
      const tk = S.state.ticks; await tap(P.page, '[data-act=onSolo]'); await sleep(500);
      ok(`fallback ${tag} solo button starts free roam without any request`, await P.page.evaluate(() => __vp.G && __vp.G.free && !__vp.G.online) && S.state.ticks === tk);
      S.state.config.enabled = true;
      ok(`fallback ${tag} zero console errors`, P.errors.length === 0, P.errors);
      await P.browser.close();
    }
    await S.close();
  }

  // ================= real-time server (optional path): server/index.mjs over WebSocket =================
  if (!only || only === 'ws') {
    let S = null; try { S = await startDevServer({ ws: true }); } catch (e) { out.push('SKIP ws (npm --prefix server install): ' + e.message); }
    if (S) {
      L.URL = S.url;
      const { A, B } = await pair(S, 'ws', 'ws');
      ok('ws nothing was written to the polling tables', (await S.db.rows('vp_presence')).length === 0 && S.state.ticks === 0);
      const h = await (await fetch(S.state.config.wsUrl.replace('ws', 'http') + '/health')).json();
      ok('ws /health counts the two players', h.ok && h.players === 2 && h.rooms === 1, h);
      // the real-time server goes away: both clients fall back to polling and find each other again
      await S.state.rt.close();
      ok('ws server down: clients fall back to polling', await until(A.page, () => VP.Online.state === 'on' && VP.Online.tr && VP.Online.tr.name === 'poll', null, 20000) && await until(B.page, () => VP.Online.state === 'on' && VP.Online.tr && VP.Online.tr.name === 'poll', null, 20000));
      ok('ws and they see each other again', await until(A.page, () => [...VP.Online.remotes.values()].some(r => r.f), null, 12000) && await until(B.page, () => [...VP.Online.remotes.values()].some(r => r.f), null, 12000));
      const noise = e => !/WebSocket connection to/.test(e);
      ok('ws zero console errors (besides the refused socket)', A.errors.filter(noise).length === 0 && B.errors.filter(noise).length === 0, [A.errors, B.errors]);
      await A.browser.close(); await B.browser.close();
      S.state.rt = null; await new Promise(r => setTimeout(r, 100));
      process.exitCode = process.exitCode || 0;
      try { await S.close(); } catch (e) { /* the real-time server is already closed */ }
    }
  }

  console.log(out.join('\n'));
  const failed = out.filter(l => l.startsWith('FAIL')).length;
  console.log(`\n${out.length - failed}/${out.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
