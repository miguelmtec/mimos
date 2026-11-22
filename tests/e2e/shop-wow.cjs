// Shop "wow" checks: honest 3D previews in the paid cards, full item lists, purchase celebration ("Equipar agora"),
// cosmetic attack skins (visual only: same damage), and paid looks building without errors. Screenshots go to VP_SHOTS (prefix wow-).
const L = require('./lib.cjs');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const out = [], ok = (n, c, x) => { out.push((c ? 'PASS ' : 'FAIL ') + n + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); };
(async () => {
  await L.serve();
  let paidProduct = null, paidGrants = null, seq = 0, lastId = null;
  const routes = async page => {
    await page.route('**/api/**', async r => {
      const u = new URL(r.request().url()), j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { /* none */ }
      if (u.pathname === '/api/pix/create') { paidProduct = body.product; lastId = String(4242000 + (++seq) + (Date.now() % 1000) * 10); return j(200, { id: lastId, status: 'pending', qr: '0002-' + body.product, qrBase64: PNG }); }
      if (u.pathname === '/api/pix/status') return j(200, { id: u.searchParams.get('id'), paid: true, product: paidProduct, grants: paidGrants, status: 'approved' });
      return j(503, { error: 'offline' });
    });
  };
  for (const mob of [true, false]) {
    const P = mob ? 'wow-m-' : 'wow-d-';
    const { browser, page, errors } = await L.open(mob, { routes });
    await page.evaluate(() => { VP.S.name = 'Tester'; });
    // ---- previews + lists in the cards ----
    await page.evaluate(() => VP.UI.show('shop'));
    await page.waitForFunction(() => Object.keys(VP.Shop.previews).length === 6, null, { timeout: 30000 }).catch(() => {});
    const pv = await page.evaluate(() => {
      const Wd = VP.Wardrobe, res = {};
      for (const [k, fr] of Object.entries(VP.Shop.previews)) {
        const grant = k, want = Wd.setItems(grant).length;
        const cv = document.querySelector('canvas.pvc[data-pv="' + k + '"]'), card = cv && cv.closest('.card'), li = card ? card.querySelectorAll('.pklist li').length : 0;
        let diff = 0; if (fr && fr.length > 2) { const a = fr[0].getContext('2d').getImageData(0, 0, fr[0].width, fr[0].height).data, b = fr[fr.length >> 1].getContext('2d').getImageData(0, 0, fr[0].width, fr[0].height).data; for (let i = 0; i < a.length; i += 40) if (a[i] !== b[i]) diff++; }
        res[k] = { frames: fr ? fr.length : 0, want, li, diff, ellipsis: card ? /…/.test(card.querySelector('.pklist').textContent) : null };
      }
      return res;
    });
    ok(P + 'every paid card has a real 3D preview that moves', Object.keys(pv).length === 6 && Object.values(pv).every(v => v.frames >= 6 && v.diff > 50), pv);
    ok(P + 'item lists are complete (no truncation)', Object.values(pv).every(v => v.li >= v.want && v.want > 0 && v.ellipsis === false), pv);
    ok(P + 'every pack lists its attack effect', await page.evaluate(() => [...document.querySelectorAll('.card.pack')].every(c => /Só visual/.test(c.textContent))));
    for (const [i, s] of ['.card.vip', '.shopgrid .card:nth-child(2)', '.card.pack:nth-child(1)', '.card.pack:nth-child(3)'].entries()) {
      await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), s); await page.waitForTimeout(400); await L.shot(page, P + 'shopcard-' + i);
    }
    // ---- purchase -> celebration -> equip now ----
    for (const [prod, g] of [['skin_praia', 'pack_praia'], ['vip', 'vip']]) {
      paidGrants = [g]; await page.evaluate(() => { VP.S.wear = {}; VP.UI.show('shop'); });
      await page.locator('[data-act=buy][data-p=' + prod + ']').first().click({ force: true }); await page.waitForTimeout(400);
      await page.evaluate(() => VP.Shop._check()); await page.waitForTimeout(1500);
      const c = await page.evaluate(() => ({ mode: VP.R3.mode, modal: !!document.querySelector('.modal.celebrate'), eq: !!document.querySelector('[data-act=equipNow]'), code: /\d{7}/.test(document.querySelector('.modal').textContent), confetti: !!document.querySelector('.confetti') }));
      ok(P + prod + ': celebration shows the cats on stage, confetti, receipt and Equipar agora', c.mode === 'stage' && c.modal && c.eq && c.code && c.confetti, c);
      await L.shot(page, P + 'celebration-' + g);
      if (g === 'pack_praia') { // not equipped yet except the attack effect that arrives with the pack; the button equips the whole set
        await page.locator('[data-act=equipNow]').click({ force: true }); await page.waitForTimeout(500);
        const w = await page.evaluate(() => ['mimo', 'mimosa', 'morticia'].map(n => VP.Wardrobe.wearing(n)));
        ok(P + 'Equipar agora equips the set on all three cats', w.every(x => x.body === 'hawaiian' && x.atk === 'atk_praia' && x.back === 'surfboard'), w);
      } else { ok(P + 'vip equipped', await page.evaluate(() => VP.Wardrobe.wearing('mimo').body === 'gold_suit' && VP.Wardrobe.wearing('mimo').atk === 'atk_gold')); }
      await page.evaluate(() => document.querySelector('[data-act=paidClose]').click()); await page.waitForTimeout(400);
    }
    // ---- wardrobe: front-facing, close, attack-effect slot toggle ----
    await page.evaluate(() => { VP.Wardrobe.slot = 'atk'; VP.Wardrobe.cat = 'mimosa'; VP.Wardrobe.open(); }); await page.waitForTimeout(1400); await L.shot(page, P + 'wardrobe-atk');
    ok(P + 'wardrobe has the attack effect slot with the owned effects', await page.evaluate(() => document.querySelectorAll('#s-wardrobe .wdi').length >= 6 && /Efeito de ataque/.test(document.querySelector('#s-wardrobe').textContent)));
    await page.evaluate(() => VP.Wardrobe.owns); await page.locator('#s-wardrobe .wdi[data-i=""]').click({ force: true }); await page.waitForTimeout(300);
    ok(P + 'effect can be switched off per cat', await page.evaluate(() => !VP.Wardrobe.atkOf('mimosa') && !!VP.Wardrobe.atkOf('mimo')));
    await page.evaluate(() => { VP.Wardrobe.equipSet('vip'); VP.Wardrobe.slot = 'body'; VP.Wardrobe.open(); }); await page.waitForTimeout(1200); await L.shot(page, P + 'wardrobe-vip-front');
    // ---- attack skins: cosmetic only (identical damage), burst in action ----
    await page.evaluate(() => { VP.UI.act.wdBack && VP.UI.hide(); __vp.free(); }); await page.waitForTimeout(1800);
    const sh = await page.evaluate(async () => {
      const G = __vp.G; for (const e of G.dogs) e.dead = true; const c = G.cats[0], res = {};
      const fire = () => { G.bullets.length = 0; c.cd = 0; c.energy = 100; c.exhausted = false; VP.Game.doAttack(c, 0, false); };
      VP.Wardrobe.equipSet('vip'); VP.Wardrobe.autoAtk('vip'); VP.R3.refreshCats();
      for (const [k, wear] of [['skin', 'atk_gold'], ['plain', null]]) { VP.S.wear.mimo = Object.assign({}, VP.S.wear.mimo, { atk: wear }); c.pe = 100; c.cd = 0; fire(); await new Promise(r => setTimeout(r, 40)); const b = G.bullets[0]; res[k] = b ? { dmg: b.dmg, vx: b.vx, vy: b.vy, life: b.life, r: b.r, fxs: b.fxs || null } : null; }
      return res;
    });
    ok(P + 'VIP attack skin: golden bubble, same damage, speed, range and life as the plain one', !!sh.skin && !!sh.plain && sh.skin.fxs === 'gold' && !sh.plain.fxs && Math.abs(sh.skin.dmg - sh.plain.dmg) < 1e-6 && Math.abs(Math.hypot(sh.skin.vx, sh.skin.vy) - Math.hypot(sh.plain.vx, sh.plain.vy)) < 60 && sh.skin.r === sh.plain.r && Math.abs(sh.skin.life - sh.plain.life) < 0.1, sh);
    ok(P + 'no console errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
  }
  L.stop();
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('FAIL')).length; console.log(bad + ' failures'); process.exit(bad ? 1 : 0);
})();
