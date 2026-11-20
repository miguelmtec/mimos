const L = require('./lib.cjs');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const out = [], ok = (n, c) => { out.push((c ? 'PASS ' : 'FAIL ') + n); };
(async () => {
  await L.serve();
  // ---- A: everything offline (503) ----
  { const { browser, page, errors } = await L.open(true);
    const tap = async s => { await page.locator(s).first().click({ force: true }); await page.waitForTimeout(350); };
    await tap('[data-act=shop]'); await tap('[data-act=buy][data-p=vip]'); await page.waitForTimeout(400);
    ok('503 toast shop opens soon', /Loja abre em breve/.test(await page.locator('#toast').textContent()));
    await tap('[data-act=shopBack]'); await page.evaluate(() => VP.UI.act.sheetMore()); await tap('[data-act=rank]'); await page.waitForTimeout(500);
    ok('rank offline msg', /offline/i.test(await page.locator('#rk').textContent()));
    await tap('[data-act=back]'); await tap('[data-act=account]');
    ok('accounts offline msg', /offline/i.test(await page.locator('#s-account').textContent()));
    ok('A zero errors', errors.length === 0); if (errors.length) console.log(errors);
    await browser.close(); }
  // ---- B: mocked shop + accounts ----
  let paid = false, cats = [], logged = false, saved = null, creates = 0;
  const routes = async page => {
    await page.route('**/api/**', async r => {
      const u = new URL(r.request().url()), m = r.request().method(), j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      if (u.pathname === '/api/pix/create') { creates++; return j(200, { id: '987654321', status: 'pending', price: 4.9, qr: '00020126PIXCOPIAECOLA-' + body.product, qrBase64: PNG }); }
      if (u.pathname === '/api/pix/status') { const id = u.searchParams.get('id'); if (id === '555') return j(200, { id, paid: true, product: 'season', grants: ['season'], status: 'approved' }); if (id === '987654321') return j(200, paid ? { id, paid: true, product: 'vip', grants: ['vip'], status: 'approved' } : { id, paid: false, product: null, grants: [], status: 'pending' }); return j(404, { error: 'not-found' }); }
      if (u.pathname === '/api/scores') return j(200, { top: [{ name: 'Mimo', score: 9000, level: 12, stars: 30 }, { name: 'Tester', score: 100, level: 1, stars: 3 }] });
      if (u.pathname === '/api/me') return m === 'DELETE' ? (logged = false, cats = [], j(200, { ok: true, deleted: true })) : logged ? j(200, { user: { id: 'u1', email: 'a@b.co', lang: 'pt' }, cats }) : j(401, { error: 'unauthorized' });
      if (u.pathname === '/api/auth/start') return j(200, { ok: true, expiresInMinutes: 10 });
      if (u.pathname === '/api/auth/verify') { if (body.code === '123456') { logged = true; return j(200, { ok: true, user: { id: 'u1', email: body.email, lang: 'pt' } }); } return j(400, { error: 'invalid-code' }); }
      if (u.pathname === '/api/auth/logout') { logged = false; return j(200, { ok: true }); }
      if (u.pathname === '/api/cats/public') return j(200, { cats: [{ id: 'p1', name: 'Frajola', breed: 'srd', spec: { pattern: 'tuxedo', furBase: '#222222', patchColors: ['#ffffff'], accessories: ['bowtie'] }, bio: '', instagram: 'frajola.cat' }, { id: 'p2', name: 'Tigrinho', breed: 'bengal', spec: { pattern: 'tabby', furBase: '#d9822b', patchColors: ['#8a4a12'], accessories: ['cap'] }, bio: '', instagram: null }] });
      if (u.pathname === '/api/cats/suggest-colors') return j(200, { spec: { furBase: '#18161a', patchColors: ['#f4f4f0'], pattern: 'tuxedo' }, palette: [] });
      if (u.pathname === '/api/cats') { if (m === 'POST') { const c = Object.assign({ id: 'c' + (cats.length + 1), createdAt: '', updatedAt: '' }, body); cats.push(c); return j(201, { ok: true, cat: c }); } if (m === 'PUT') { const c = cats.find(x => x.id === u.searchParams.get('id')); Object.assign(c, body); return j(200, { ok: true, cat: c }); } if (m === 'DELETE') { cats = cats.filter(x => x.id !== u.searchParams.get('id')); return j(200, { ok: true }); } return j(200, { cats }); }
      if (u.pathname === '/api/save') { if (m === 'PUT') { saved = body.data; return j(200, { ok: true, updatedAt: 'now' }); } return j(200, { data: saved, updatedAt: saved ? 'now' : null }); }
      return j(404, { error: 'not-found' });
    });
  };
  for (const mob of [true, false]) {
    paid = false; cats = []; logged = false; creates = 0;
    const P = mob ? 'm-' : 'd-';
    const { browser, page, errors } = await L.open(mob, { routes });
    const tap = async s => { await page.locator(s).first().click({ force: true }); await page.waitForTimeout(350); };
    await tap('[data-act=shop]'); await L.shot(page, P + 'shop');
    await tap('[data-act=tryOn]'); await page.waitForTimeout(900); await L.shot(page, P + 'tryon');
    await tap('[data-act=testLap]'); await page.waitForTimeout(2500); await L.shot(page, P + 'testlap');
    ok(P + 'trial running in gold car', await page.evaluate(() => !!(__vp.G && __vp.G.trial && __vp.G.car && __vp.G.car.type === 'gold')));
    await page.evaluate(() => { __vp.G.mtimer = 0.3; }); await page.waitForFunction(() => __vp.state().screen === 'shop', null, { timeout: 15000 }).catch(() => {});
    ok(P + 'trial returns to shop', (await page.evaluate(() => __vp.state().screen)) === 'shop');
    await tap('[data-act=buy][data-p=vip]'); await page.waitForTimeout(500);
    ok(P + 'checkout modal QR', await page.locator('.modal img.qr').count() === 1 && /Aguardando pagamento/.test(await page.locator('.modal').textContent()));
    await L.shot(page, P + 'checkout');
    await tap('[data-act=copyPix]');
    paid = true; await page.evaluate(() => VP.Shop._check()); await page.waitForTimeout(900);
    ok(P + 'paid -> code shown', /987654321/.test(await page.locator('.modal').textContent()));
    await L.shot(page, P + 'paid');
    ok(P + 'vip granted + persisted', await page.evaluate(() => VP.Shop.has('vip') && JSON.parse(localStorage.getItem('vp_purchases')).ids['987654321'].product === 'vip'));
    await tap('[data-act=paidClose]');
    const lives0 = await page.evaluate(() => VP.S.lives);
    ok(P + 'grant once per id', await page.evaluate(() => VP.Shop.apply('987654321', 'lives10', ['lives10']) === false) && lives0 === await page.evaluate(() => VP.S.lives));
    // restore season
    await tap('[data-act=restore]'); await page.fill('#rcode', '555'); await tap('[data-act=restoreGo]'); await page.waitForTimeout(600);
    ok(P + 'restore season', await page.evaluate(() => VP.Shop.has('season')));
    // VIP visible in game
    await page.evaluate(() => { VP.UI.act.title(); __vp.free(); }); await page.waitForTimeout(2200);
    ok(P + 'VIP outfit in game', await page.evaluate(() => VP.Wardrobe.spec('mimo').shiny === 1 && VP.Wardrobe.spec('morticia').acc.crown === '#ffd23f'));
    await page.evaluate(() => { const G = __vp.G; VP.R3.snapCamera(Math.PI / 2); }); await page.waitForTimeout(1200); await L.shot(page, P + 'vip-game');
    ok(P + 'gallery cats in city', await page.evaluate(() => __vp.G.friends.filter(f => f.wander).length === 2));
    // reload keeps purchases
    await page.reload(); await page.waitForFunction(() => window.__vp && VP.UI.ready && VP.R3 && VP.R3.ok);
    ok(P + 'purchase survives reload', await page.evaluate(() => VP.Shop.has('vip') && VP.Shop.has('season')));
    // ranking with crown
    await page.evaluate(() => VP.UI.act.sheetMore()); await tap('[data-act=rank]'); await page.waitForTimeout(500); await L.shot(page, P + 'rank');
    await tap('[data-act=back]');
    // accounts
    await tap('[data-act=account]'); await page.fill('#aemail', 'a@b.co'); await tap('[data-act=acStart]'); await page.waitForTimeout(400);
    await page.fill('#acode', '000000'); await tap('[data-act=acVerify]'); await page.waitForTimeout(400);
    ok(P + 'wrong code rejected', (await page.evaluate(() => VP.Acct.status)) !== 'in');
    await page.fill('#acode', '123456'); await tap('[data-act=acVerify]'); await page.waitForTimeout(900);
    ok(P + 'logged in', (await page.evaluate(() => VP.Acct.status)) === 'in');
    await tap('[data-act=creator][data-i=new]'); await page.waitForTimeout(600);
    await page.fill('#cname', 'Pipoca'); await tap('[data-act=crSet][data-v=calico]'); await tap('[data-act=crAcc][data-v=bow]'); await tap('[data-act=crAcc][data-v=sunglasses]');
    await page.waitForTimeout(700); await L.shot(page, P + 'creator');
    await tap('[data-act=crSave]'); await page.waitForTimeout(700);
    ok(P + 'cat saved to api', cats.length === 1 && cats[0].name === 'Pipoca' && cats[0].spec.pattern === 'calico' && cats[0].spec.accessories.join() === 'bow,sunglasses');
    await L.shot(page, P + 'account');
    ok(P + 'avatar set', await page.evaluate(() => !!VP.S.avatar && VP.S.avatar.pattern === 'calico'));
    await page.evaluate(() => { VP.UI.act.title(); __vp.free(); }); await page.waitForTimeout(1500);
    ok(P + 'avatar walks in city', await page.evaluate(() => __vp.G.friends.some(f => f.name === 'avatar')));
    await page.evaluate(() => { VP.UI.act.title(); VP.onProgress(); }); await page.waitForTimeout(3200);
    ok(P + 'cloud save pushed', !!saved && !!saved.s && !!saved.p);
    page.once('dialog', d => d.accept());
    await tap('[data-act=account]'); await tap('[data-act=acDelete]'); await page.waitForTimeout(600);
    ok(P + 'account deleted', (await page.evaluate(() => VP.Acct.status)) === 'guest' && !logged);
    ok(P + 'B zero errors', errors.length === 0); if (errors.length) console.log(errors.slice(0, 5));
    await browser.close();
  }
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length, 'failures');
  L.stop();
})().catch(e => { console.log(out.join('\n')); console.error(e); L.stop(); process.exit(1); });
