// Cidade Online end to end: two browsers in the same room, against the REAL api/online handler on an in-memory
// database (tests/helpers/online-dev-server.mjs) and, for the "ws" section, the real real-time server.
//   node tests/e2e/online.cjs [poll|fallback|ws|shots]      screenshots -> $VP_SHOTS (default /tmp)
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
const hudTap = async (P, x, y) => { if (P.mobile) await P.page.touchscreen.tap(x, y); else await P.page.mouse.click(x, y); await P.page.waitForTimeout(300); };
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
// samples where the first remote cat is drawn, every 80 ms
const track = (page, ms) => page.evaluate(ms => new Promise(res => { const xs = []; const iv = setInterval(() => { const r = [...VP.Online.remotes.values()][0]; if (r && r.f) xs.push(Math.round(r.f.x * 10) / 10); }, 80); setTimeout(() => { clearInterval(iv); res(xs); }, ms); }), ms);

async function pair(S, label, wantTransport) {
  const A = await client(true), B = await client(false);
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
  ok(P + 'movement is interpolated (many small steps)', distinct > 25 && maxStep < 75, { distinct, maxStep, samples: xs.length });
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
  await L.shot(A.page, `online-m-${label}-bubble`); await L.shot(B.page, `online-d-${label}-bubble`);
  const gone = await until(B.page, () => { const r = [...VP.Online.remotes.values()][0]; return r && !r.say; }, null, 7000);
  ok(P + 'bubble lasts about 4 s', gone);

  // --- shared golden paws: same places for both, first cat gets it, it disappears for the other
  const paws = pg => pg.evaluate(() => __vp.G.items.filter(i => i.online !== undefined && !i.dead).map(i => [i.online, Math.round(i.x), Math.round(i.y)]).sort((p, q) => p[0] - q[0]));
  const pa = await paws(A.page), pb = await paws(B.page);
  ok(P + 'both see the same 6 paws', pa.length === 6 && JSON.stringify(pa) === JSON.stringify(pb), [pa, pb]);
  const cash0 = await A.page.evaluate(() => VP.S.cash);
  await A.page.evaluate(([i, x, y]) => { const G = __vp.G; for (const c of G.cats) { c.x = x + 4; c.y = y + 4; } void i; }, pa[0]);
  ok(P + 'A collects one (+10 coins)', await until(A.page, c0 => VP.Online.got === 1 && VP.S.cash === c0 + 10, cash0, 5000), await A.page.evaluate(() => [VP.Online.got, VP.S.cash]));
  ok(P + 'it disappears for B', await until(B.page, i => !__vp.G.items.some(it => it.online === i && !it.dead), pa[0][0], 8000));
  ok(P + 'the single-player paw count is untouched', await A.page.evaluate(() => !Object.keys(VP.S.paws || {}).some(k => /online|city#/.test(k))));

  // --- mute: tap the cat's name tag
  await A.page.evaluate(() => { const G = __vp.G, r = [...VP.Online.remotes.values()][0]; for (const c of G.cats) { c.x = r.f.x + 60; c.y = r.f.y + 90; } });
  await sleep(2600);
  const tag = await B.page.evaluate(() => VP.Online.tags && VP.Online.tags[0]);
  ok(P + 'the other cat has a name tag on screen', !!tag, tag);
  if (tag) await hudTap(B, tag.x, tag.y - 16);
  ok(P + 'tapping a cat opens its card (mute / report)', await B.page.evaluate(() => VP.Online.sheet === 'cat' && !!document.querySelector('#onl [data-o=mute]') && !!document.querySelector('#onl [data-o=rep]')));
  await L.shot(B.page, `online-d-${label}-card`);
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
  await L.shot(B.page, `online-d-${label}-list`);
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
    // what went over the wire: whitelisted keys only, never a name or a text
    const keys = new Set(); for (const body of S.state.bodies) for (const k of Object.keys(body || {})) keys.add(k);
    const allowed = ['ticket', 'room', 'x', 'z', 'ry', 'anim', 'car', 'emote', 'es', 'phrase', 'ps', 'paws', 'need', 'idle'];
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
        const f = await S.fill(300, 'rio');
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
