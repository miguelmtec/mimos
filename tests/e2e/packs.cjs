// City packs end to end: node tests/e2e/packs.cjs [id,id…]
// Every hand-written pack (data/citypacks.json) is loaded on its real map when the extract exists, otherwise on a stand-in
// built from the planned coordinates (tests/helpers/planned.cjs). Checks: the map loads with zero errors, the pack gives 10
// missions, its named places land on the street network, sparse maps get procedural buildings, and the bot wins every mission.
const L = require('./lib.cjs'), P = require('../helpers/planned.cjs'), fs = require('fs'), path = require('path');
const packs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/data/citypacks.json'), 'utf8')).packs;
let ids = (process.argv[2] ? process.argv[2].split(',') : Object.keys(packs).filter(id => packs[id].missions.length));
(async () => {
  await L.serve(); let fails = 0; const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); if (!cond) fails++; };
  const { PLANNED } = await P.table(); ids = ids.filter(id => P.present(id) || PLANNED.some(r => r[0] === id));
  for (const id of ids) {
    const real = P.present(id), { browser, page, errors } = await L.open(false, { routes: P.routes([id]) });
    await page.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.cjs', 'utf8') });
    const a = await page.evaluate(async id => {
      __vp.unlockAll(); VP.Audio.sfx = () => {}; const W = await VP.Tour.load(id); if (!W) return { err: 'no map' }; VP.UI.tour(id);
      const ms = VP.Missions.tourList.filter(m => m.tourCity === id), pk = VP.Missions.packs.packs[id], names = new Set((W.places || []).concat(W.landmarks).map(l => l.name));
      const wanted = [...new Set(ms.flatMap(m => m.p.at || []))], missing = wanted.filter(n => !names.has(n));
      const res = ms.map(m => { try { const r = __bot.run(m.n, 500); return { n: m.n, kind: m.p.kind, win: r.win, why: r.why, t: r.time, par: r.par }; } catch (e) { return { n: m.n, kind: m.p.kind, win: false, why: e.message }; } });
      return { n: ms.length, packN: pk.missions.length, places: (W.places || []).length, placeN: pk.places.length, wanted: wanted.length, missing, lots: W.infill.length, style: W.style, ratio: +W.builtRatio.toFixed(3), res };
    }, id);
    const tag = id + (real ? '' : ' (stand-in)');
    if (a.err) { ok(tag + ': map loads', false, a); await browser.close(); continue; }
    ok(tag + ': pack gives ' + a.n + ' missions', a.n >= 9 && a.n <= 10, a.n);
    ok(tag + ': ' + a.places + '/' + a.placeN + ' named places on the street network', a.placeN === 0 || a.places >= Math.ceil(a.placeN * (real ? 0.6 : 0.4)), a);
    ok(tag + ': mission waypoints resolve (' + (a.wanted - a.missing.length) + '/' + a.wanted + ')', a.missing.length <= Math.floor(a.wanted * (real ? 0.34 : 0.6)), a.missing); // stand-ins have another street grid: fewer places fit
    if (a.ratio < 0.1) ok(tag + ': sparse map got procedural buildings (' + a.lots + ' lots, style ' + a.style + ')', a.lots > 100, a);
    const lost = a.res.filter(r => !r.win);
    ok(tag + ': bot completes all ' + a.res.length + ' missions', lost.length === 0, lost);
    ok(tag + ': zero console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  }
  console.log(fails + ' failures'); L.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); L.stop(); process.exit(1); });
