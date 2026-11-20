// E2E for the account UI with Google mocked (window.google.accounts.id stub) and the API mocked.
// Covers mobile and desktop: Google button + One Tap, e-mail code as secondary, the age step with mask,
// the guardian-pending state (reload, resend, guest-only blocks), teen notice, adult, and account deletion.
const L = require('./lib.cjs');
const out = [], ok = (n, c) => { out.push((c ? 'PASS ' : 'FAIL ') + n); };
const GSTUB = () => {
  window.__prompted = 0; window.__gcred = 'tok-adult';
  window.google = { accounts: { id: {
    initialize(o) { window.__gcb = o.callback; window.__gcid = o.client_id; },
    renderButton(el) { const b = document.createElement('button'); b.id = 'gstub'; b.textContent = 'Sign in with Google'; b.onclick = () => window.__gcb({ credential: window.__gcred }); el.appendChild(b); },
    prompt() { window.__prompted++; }, cancel() {},
  } } };
};
(async () => {
  await L.serve();
  let st;
  const fresh = () => { st = { logged: false, needsAge: true, awaiting: false, cats: [], reqs: [], deleted: false, email: 'g@example.com' }; };
  const routes = async page => {
    await page.addInitScript(GSTUB);
    await page.route('https://accounts.google.com/**', r => r.abort());
    await page.route('**/api/**', async r => {
      const u = new URL(r.request().url()), m = r.request().method(), j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      if (u.pathname.startsWith('/api/auth/') || u.pathname === '/api/me') st.reqs.push(m + ' ' + u.pathname + ' ' + JSON.stringify(body));
      if (u.pathname === '/api/auth/config') return j(200, { googleClientId: 'test-client.apps.googleusercontent.com' });
      if (u.pathname === '/api/me') {
        if (m === 'DELETE') { if (!st.logged) return j(401, { error: 'unauthorized' }); st.logged = false; st.deleted = true; return j(200, { ok: true, deleted: true }); }
        return st.logged ? j(200, { user: { id: 'u1', email: st.email, lang: 'pt', status: 'active', needsAge: st.needsAge }, cats: st.needsAge ? [] : st.cats }) : j(401, { error: 'unauthorized' });
      }
      if (u.pathname === '/api/auth/google') {
        if (!/^tok-/.test(body.credential)) return j(401, { error: 'invalid-credential' });
        if (st.awaiting) return j(200, { ok: true, awaitingGuardian: true });
        st.logged = true; return j(200, { ok: true, user: { id: 'u1', email: st.email, lang: 'pt', status: 'active', needsAge: st.needsAge } });
      }
      if (u.pathname === '/api/auth/age') {
        if (!st.logged) return j(401, { error: 'unauthorized' });
        const [y, mo] = body.birth.split('-').map(Number), now = new Date(), age = now.getFullYear() - y - (now.getMonth() + 1 <= mo ? 1 : 0);
        if (age < 18 && !body.guardianEmail) return j(400, { error: 'invalid', field: 'guardianEmail' });
        st.needsAge = false;
        if (age < 16) { st.logged = false; st.awaiting = true; return j(200, { ok: true, band: 'child', awaitingGuardian: true, mailSent: true }); }
        return j(200, { ok: true, band: age < 18 ? 'teen' : 'adult', user: { id: 'u1', email: st.email, lang: 'pt', status: 'active', needsAge: false } });
      }
      if (u.pathname === '/api/auth/guardian-resend') return j(200, { ok: true });
      if (u.pathname === '/api/auth/start') return j(200, { ok: true, expiresInMinutes: 10 });
      if (u.pathname === '/api/auth/verify') { if (body.code === '123456') { st.logged = true; st.needsAge = false; return j(200, { ok: true, user: { id: 'u1', email: body.email, lang: 'pt', status: 'active', needsAge: false } }); } return j(400, { error: 'invalid-code' }); }
      if (u.pathname === '/api/auth/logout') { st.logged = false; return j(200, { ok: true }); }
      if (u.pathname === '/api/cats/public') return j(200, { cats: [] });
      if (u.pathname === '/api/save') return j(200, { data: null, updatedAt: null });
      if (u.pathname === '/api/scores') return j(200, { top: [] });
      return j(404, { error: 'not-found' });
    });
  };
  const yearsAgo = n => new Date().getFullYear() - n;
  for (const mob of [true, false]) {
    fresh();
    const P = mob ? 'm-' : 'd-';
    const { browser, page, errors } = await L.open(mob, { routes });
    const tap = async s => { await page.locator(s).first().click({ force: true }); await page.waitForTimeout(350); };
    const text = async s => (await page.locator(s).first().textContent()) || '';
    const status = () => page.evaluate(() => VP.Acct.status);
    await page.waitForTimeout(500);

    // ---- Google button + One Tap + the e-mail code as the secondary choice
    await tap('[data-act=account]'); await page.waitForTimeout(500);
    ok(P + 'Google button rendered', await page.locator('#gbtn #gstub').count() === 1);
    ok(P + 'client id comes from /api/auth/config', await page.evaluate(() => window.__gcid) === 'test-client.apps.googleusercontent.com');
    ok(P + 'One Tap prompted on the account screen', await page.evaluate(() => window.__prompted) >= 1);
    ok(P + 'e-mail code is the secondary button', /código por e-mail/.test(await text('[data-act=acMail]')));
    ok(P + 'LGPD note visible', /Sem senha, sem documentos/.test(await text('#s-account')));
    await L.shot(page, P + 'acc-google');

    // ---- first Google login: age step (child) -> guardian pending
    await tap('#gstub'); await page.waitForTimeout(500);
    ok(P + 'age step shown after first login', await status() === 'age' && await page.locator('#abirth').count() === 1);
    await page.fill('#abirth', ''); await page.type('#abirth', '05' + yearsAgo(12), { delay: 20 });
    ok(P + 'date mask MM/AAAA', await page.inputValue('#abirth') === '05/' + yearsAgo(12));
    ok(P + 'guardian field appears for a minor', await page.locator('#agbox').isVisible());
    await L.shot(page, P + 'acc-age-child');
    await tap('[data-act=acAge]');
    ok(P + 'guardian e-mail required', await status() === 'age' && !st.reqs.some(x => x.startsWith('POST /api/auth/age')));
    await page.fill('#aguard', 'responsavel@example.com'); await tap('[data-act=acAge]'); await page.waitForTimeout(600);
    ok(P + 'guardian pending screen', await status() === 'awaiting' && await page.locator('#gpend').count() === 1 && /Aguardando o responsável/.test(await text('#gpend')));
    ok(P + 'pending flag stored', await page.evaluate(() => localStorage.getItem('vp_guardian_pending')) === '1');
    await L.shot(page, P + 'acc-guardian');
    // guest-only: online, ranking and purchases are blocked
    await page.evaluate(() => VP.UI.act.online()); await page.waitForTimeout(300);
    ok(P + 'online blocked for a minor awaiting approval', /depois que o responsável aprovar/.test(await text('#toast')));
    await page.evaluate(() => { VP.UI.toast(''); VP.Shop && VP.UI.act.buy({ dataset: { p: 'vip' } }); }); await page.waitForTimeout(300);
    ok(P + 'purchase blocked', /depois que o responsável aprovar/.test(await text('#toast')) && !st.reqs.some(x => /pix/.test(x)));
    await page.fill('#gemail', 'g@example.com'); await tap('[data-act=acGResend]'); await page.waitForTimeout(400);
    ok(P + 'resend asks the generic endpoint', st.reqs.some(x => x.startsWith('POST /api/auth/guardian-resend') && /g@example.com/.test(x)));
    // reload: still waiting (flag), still guest-only
    await page.reload(); await page.waitForFunction(() => window.__vp && VP.UI.ready && VP.R3 && VP.R3.ok); await page.waitForTimeout(600);
    ok(P + 'still awaiting after reload', await status() === 'awaiting');

    // ---- guardian approved: sign in again as an adult-age account (server now has birth month/year)
    st.awaiting = false; st.logged = false;
    await tap('[data-act=account]'); await tap('[data-act=acGTry]'); await page.waitForTimeout(500);
    ok(P + 'back to sign-in', await status() === 'guest' && await page.locator('#gstub').count() === 1);
    await tap('#gstub'); await page.waitForTimeout(600);
    ok(P + 'approved account goes straight in', await status() === 'in');
    ok(P + 'pending flag cleared', await page.evaluate(() => localStorage.getItem('vp_guardian_pending')) === null);
    await page.evaluate(() => VP.Acct.minorBlock() && 0); await L.shot(page, P + 'acc-in');
    await tap('[data-act=acLogout]'); await page.waitForTimeout(400);

    // ---- teen (16-17): active with a notice
    fresh();
    await page.evaluate(() => { window.__gcred = 'tok-teen'; });
    await tap('#gstub'); await page.waitForTimeout(500);
    await page.type('#abirth', '03' + yearsAgo(17), { delay: 20 });
    ok(P + 'teen also needs a guardian e-mail', await page.locator('#agbox').isVisible());
    await page.fill('#aguard', 'mae@example.com'); await tap('[data-act=acAge]'); await page.waitForTimeout(800);
    ok(P + 'teen is active', await status() === 'in');
    ok(P + 'teen note toast', /avisamos o seu responsável/i.test(await text('#toast')));
    page.once('dialog', d => d.accept());
    await tap('[data-act=acDelete]'); await page.waitForTimeout(500);
    ok(P + 'account deleted (works from a complete account)', st.deleted && await status() === 'guest');

    // ---- adult via the e-mail code (secondary path): no guardian field
    fresh();
    await tap('[data-act=acMail]'); await page.fill('#aemail', 'g@example.com'); await tap('[data-act=acStart]');
    await page.fill('#acode', '000000'); await tap('[data-act=acVerify]'); await page.waitForTimeout(400);
    ok(P + 'wrong code rejected', await status() !== 'in');
    await page.fill('#acode', '123456'); await tap('[data-act=acVerify]'); await page.waitForTimeout(700);
    ok(P + 'e-mail code login works', await status() === 'in');
    await tap('[data-act=acLogout]');

    // ---- adult via Google: age step with no guardian field
    fresh(); await page.evaluate(() => { window.__gcred = 'tok-adult'; });
    await tap('#gstub'); await page.waitForTimeout(500);
    await page.type('#abirth', '01' + yearsAgo(30), { delay: 20 });
    ok(P + 'no guardian field for an adult', !(await page.locator('#agbox').isVisible()));
    await tap('[data-act=acAge]'); await page.waitForTimeout(700);
    ok(P + 'adult is in', await status() === 'in' && await page.locator('[data-act=acDelete]').count() === 1);
    ok(P + 'a bad Google credential is a toast', await page.evaluate(async () => { await VP.Acct.google('garbage'); return true; }) && /Google/.test(await text('#toast')));
    ok(P + 'zero errors', errors.length === 0); if (errors.length) console.log(errors.slice(0, 5));
    await browser.close();
  }
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length, 'failures');
  L.stop();
})().catch(e => { console.log(out.join('\n')); console.error(e); L.stop(); process.exit(1); });
