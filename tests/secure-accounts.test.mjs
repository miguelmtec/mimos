// Google sign-in, age step and guardian approval: handler tests with mocked neon(), mocked Resend and a
// mocked Google JWKS signed with a locally generated RSA key.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';

import { __setSqlForTests } from '../api/_lib/db.js';
import { __resetGoogleCacheForTests } from '../api/_lib/google.js';
import { encrypt, decrypt, keyedHash, parseBirth, ageOn, ageBand } from '../api/_lib/secure.js';
import authHandler from '../api/auth/[action].js';
import meHandler from '../api/me.js';
import catsHandler from '../api/cats/index.js';
import catsActionHandler from '../api/cats/[action].js';
import { createFakeBackend } from './helpers/fake-sql.mjs';
import { call } from './helpers/http.mjs';

const CLIENT_ID = '1234567890-testclient.apps.googleusercontent.com';
const realFetch = globalThis.fetch;
const realError = console.error;
const envKeys = ['DATABASE_URL', 'POSTGRES_URL', 'RESEND_API_KEY', 'MAIL_FROM', 'ALLOWED_ORIGINS', 'AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'ADMIN_EMAILS', 'VP_MIN_RESPONSE_MS', 'PUBLIC_URL'];
const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

const mkKey = () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privateKey, jwk: publicKey.export({ format: 'jwk' }) };
};
const good = { kid: 'kid-good', ...mkKey() };
const other = { kid: 'kid-good', ...mkKey() };          // same kid, different key: bad signature
let jwksCalls = 0, jwksStatus = 200, jwksKeys = null;
let mails = [], db;

before(() => {
  db = createFakeBackend();
  console.error = () => {};
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://www.googleapis.com/oauth2/v3/certs') {
      jwksCalls++;
      if (jwksStatus !== 200) return new Response('no', { status: jwksStatus });
      const keys = (jwksKeys || [good]).map((k) => ({ ...k.jwk, kid: k.kid, alg: 'RS256', use: 'sig' }));
      return new Response(JSON.stringify({ keys }), { status: 200, headers: { 'cache-control': 'public, max-age=3600' } });
    }
    assert.equal(String(url), 'https://api.resend.com/emails');
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'm' }), { status: 200 });
  };
});
beforeEach(async () => {
  for (const k of envKeys) delete process.env[k];
  Object.assign(process.env, { RESEND_API_KEY: 're_test_key', AUTH_SECRET: 'x'.repeat(40), GOOGLE_CLIENT_ID: CLIENT_ID, VP_MIN_RESPONSE_MS: '0' });
  mails = []; jwksCalls = 0; jwksStatus = 200; jwksKeys = null;
  __resetGoogleCacheForTests();
  await db.reset();
  __setSqlForTests(db.sql);
});
after(() => {
  globalThis.fetch = realFetch; console.error = realError;
  for (const k of envKeys) (savedEnv[k] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[k]));
  __setSqlForTests(null);
});

// ---------- helpers ----------
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function idToken(over = {}, { key = good, header = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '110000000000000000001', email: 'gato@example.com',
    email_verified: true, iat: now - 10, exp: now + 3000, ...over };
  const h = b64({ alg: 'RS256', kid: key.kid, typ: 'JWT', ...header });
  const data = `${h}.${b64(payload)}`;
  const sig = createSign('RSA-SHA256').update(data).sign(key.privateKey).toString('base64url');
  return `${data}.${sig}`;
}
const auth = (action, body, opts = {}) => call(authHandler, { method: 'POST', url: `/api/auth/${action}`, body, ...opts });
const google = (credential, opts) => auth('google', { credential, lang: 'pt' }, opts);
const cookieOf = (r) => String(r.headers['set-cookie']).split(';')[0];
const lastCode = () => /: (\d{6})\n/.exec(mails.at(-1).text)[1];
const guardianToken = () => /#t=([A-Za-z0-9_-]{43})/.exec(mails.at(-1).text)[1];
const age = (cookie, body) => auth('age', body, { cookie });
const approve = (token) => auth('guardian-approve', { token });

async function googleLogin(over, opts) {
  const r = await google(idToken(over), opts);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { cookie: cookieOf(r), user: r.body.user, r };
}
const thisMonth = () => { const d = new Date(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; };
const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const yearsAgo = (n, extraMonths = 0) => { const { y, m } = thisMonth(); let mm = m - extraMonths, yy = y - n; while (mm < 1) { mm += 12; yy--; } return ym(yy, mm); };

// ---------- helpers: crypto and age ----------
test('AES-256-GCM: round trip, purpose-bound, tamper-evident, random IV', () => {
  const blob = encrypt('2010-03', 'birth');
  assert.match(blob, /^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.ok(!blob.includes('2010'));
  assert.equal(decrypt(blob, 'birth'), '2010-03');
  assert.notEqual(encrypt('2010-03', 'birth'), blob);
  assert.throws(() => decrypt(blob, 'guardian'));
  const parts = blob.split('.'); parts[3] = Buffer.from('xx').toString('base64url');
  assert.throws(() => decrypt(parts.join('.'), 'birth'));
  assert.equal(keyedHash('guardian', 'a@b.co'), keyedHash('guardian', 'a@b.co'));
  assert.notEqual(keyedHash('guardian', 'a@b.co'), keyedHash('other', 'a@b.co'));
});

test('age rules: month/year only, rounded to the protective side', () => {
  const now = new Date(Date.UTC(2026, 10, 20));          // November 2026
  assert.deepEqual(parseBirth('2010-11', now), { y: 2010, m: 11 });
  assert.deepEqual(parseBirth('03/2010', now), { y: 2010, m: 3 });
  for (const bad of ['2026-12', '2027-01', '2010-13', '2010-00', '1899-05', 'abc', '', null, '2010-11-05', '20101']) assert.equal(parseBirth(bad, now), null, String(bad));
  assert.equal(ageOn({ y: 2010, m: 10 }, now), 16);      // birthday month already over
  assert.equal(ageOn({ y: 2010, m: 11 }, now), 15);      // same month: counts as younger until it ends
  assert.equal(ageOn({ y: 2008, m: 11 }, now), 17);
  assert.equal(ageOn({ y: 2008, m: 10 }, now), 18);
  assert.deepEqual([15, 16, 17, 18].map(ageBand), ['child', 'teen', 'teen', 'adult']);
});

// ---------- config ----------
test('GET /api/auth/config exposes only the public client id (null when unset)', async () => {
  let r = await call(authHandler, { url: '/api/auth/config' });
  assert.deepEqual([r.status, r.body], [200, { googleClientId: CLIENT_ID }]);
  delete process.env.GOOGLE_CLIENT_ID;
  r = await call(authHandler, { url: '/api/auth/config' });
  assert.deepEqual(r.body, { googleClientId: null });
  assert.equal((await call(authHandler, { url: '/api/auth/start' })).status, 405);
});

// ---------- Google ----------
test('google: a valid ID token creates the account and the session cookie; only e-mail and sub are stored', async () => {
  const { cookie, user, r } = await googleLogin();
  assert.equal(user.email, 'gato@example.com');
  assert.equal(user.needsAge, true);
  assert.equal(user.status, 'active');
  assert.match(r.headers['set-cookie'], /^vp_session=[A-Za-z0-9_-]{43}; .*HttpOnly; Secure; SameSite=Lax/);
  const [row] = await db.rows('vp_users');
  assert.equal(row.google_sub, '110000000000000000001');
  assert.equal(row.birth_enc, null);
  const me = await call(meHandler, { url: '/api/me', cookie });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'gato@example.com');
  assert.equal((await db.rows('vp_sessions')).length, 1);
  assert.equal(jwksCalls, 1);
  await google(idToken());
  assert.equal(jwksCalls, 1, 'the JWKS is cached per its cache-control');
});

test('google: the same Google account logs into the same user; the session is rotated', async () => {
  const a = await googleLogin();
  const b = await googleLogin({}, { cookie: a.cookie });
  assert.equal(a.user.id, b.user.id);
  assert.notEqual(a.cookie, b.cookie);
  assert.equal((await call(meHandler, { url: '/api/me', cookie: a.cookie })).status, 401, 'old cookie is dead');
  assert.equal((await call(meHandler, { url: '/api/me', cookie: b.cookie })).status, 200);
  assert.equal((await db.rows('vp_users')).length, 1);
  // a changed e-mail at Google still finds the user by sub
  const c = await googleLogin({ email: 'novo@example.com' });
  assert.equal(c.user.id, a.user.id);
  assert.equal(c.user.email, 'gato@example.com');
});

test('google: links to an existing e-mail-code account with the same verified e-mail', async () => {
  await auth('start', { email: 'gato@example.com', lang: 'pt' });
  const v = await auth('verify', { email: 'gato@example.com', code: lastCode() });
  const g = await googleLogin({ email: 'Gato@Example.com' });
  assert.equal(g.user.id, v.body.user.id);
  assert.equal((await db.rows('vp_users')).length, 1);
  assert.equal((await db.rows('vp_users'))[0].google_sub, '110000000000000000001');
});

test('google: an e-mail already linked to another Google account is refused', async () => {
  await googleLogin();
  const r = await google(idToken({ sub: '999' }));
  assert.equal(r.status, 409);
  assert.equal((await db.rows('vp_users')).length, 1);
});

test('google: every verification failure is the same generic 401', async () => {
  const now = Math.floor(Date.now() / 1000);
  const forged = idToken({}, { key: other });
  const cases = {
    'wrong audience': idToken({ aud: 'someone-else.apps.googleusercontent.com' }),
    'wrong issuer': idToken({ iss: 'https://evil.example' }),
    'expired': idToken({ exp: now - 400 }),
    'issued in the future': idToken({ iat: now + 400, exp: now + 4000 }),
    'bad signature': forged,
    'unverified e-mail': idToken({ email_verified: false }),
    'e-mail_verified as a string': idToken({ email_verified: 'true' }),
    'no e-mail_verified': idToken({ email_verified: undefined }),
    'alg none': `${b64({ alg: 'none', kid: good.kid })}.${b64({ iss: 'accounts.google.com', aud: CLIENT_ID, sub: '1', email: 'a@b.co', email_verified: true, iat: now, exp: now + 99 })}.`,
    'alg HS256': idToken({}, { header: { alg: 'HS256' } }),
    'unknown kid': idToken({}, { key: { ...good, kid: 'nope' } }),
    'tampered payload': (() => { const p = idToken().split('.'); p[1] = b64({ ...JSON.parse(Buffer.from(p[1], 'base64url')), email: 'admin@example.com' }); return p.join('.'); })(),
    'garbage': 'not-a-jwt',
    'empty': '',
    'huge': 'a.'.repeat(5000),
  };
  for (const [name, token] of Object.entries(cases)) {
    const r = await google(token);
    assert.equal(r.status, 401, name);
    assert.deepEqual(r.body, { error: 'invalid-credential' }, name);
  }
  assert.equal((await google(undefined)).status, 401);
  assert.equal((await db.rows('vp_users')).length, 0);
  assert.equal((await db.rows('vp_sessions')).length, 0);
  // the 5 minute skew is tolerated, both ways
  assert.equal((await google(idToken({ exp: now - 200 }))).status, 200);
  assert.equal((await google(idToken({ iat: now + 200, exp: now + 4000, sub: '2', email: 'b@example.com' }))).status, 200);
  assert.ok(!JSON.stringify(mails).includes('admin@example.com'));
});

test('google: an accepted audience list, key rotation, JWKS outage and missing config', async () => {
  assert.equal((await google(idToken({ aud: [CLIENT_ID, 'x'] }))).status, 200);
  // key rotation: an unknown kid triggers one refetch (rate limited), then verifies
  const fresh = { kid: 'kid-rotated', ...mkKey() };
  jwksKeys = [good, fresh];
  const calls = jwksCalls;
  const r = await google(idToken({ sub: '5', email: 'r@example.com' }, { key: fresh }));
  assert.equal(r.status, 401, 'refetch is limited to once a minute, right after the first load');
  assert.equal(jwksCalls, calls);
  __resetGoogleCacheForTests();
  assert.equal((await google(idToken({ sub: '5', email: 'r@example.com' }, { key: fresh }))).status, 200);
  __resetGoogleCacheForTests(); jwksStatus = 500;
  const down = await google(idToken({ sub: '6', email: 'd@example.com' }));
  assert.deepEqual([down.status, down.body], [502, { error: 'google-unavailable' }]);
  delete process.env.GOOGLE_CLIENT_ID;
  assert.deepEqual((await google(idToken())).body, { error: 'google-offline' });
});

test('google: needs an allowed Origin like every mutating call', async () => {
  const r = await google(idToken(), { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  assert.equal((await db.rows('vp_users')).length, 0);
});

// ---------- age ----------
test('age: game endpoints answer 403 age-required until the birth month/year is given (adult)', async () => {
  const { cookie } = await googleLogin();
  const cat = { name: 'Mimo', breed: 'srd', spec: {} };
  const blocked = await call(catsHandler, { method: 'POST', url: '/api/cats', cookie, body: cat });
  assert.deepEqual([blocked.status, blocked.body], [403, { error: 'age-required' }]);
  const me = await call(meHandler, { url: '/api/me', cookie });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.needsAge, true);

  for (const bad of [undefined, '', '2030-01', '1990-13', 'x', '1990-05-01']) {
    assert.equal((await age(cookie, { birth: bad })).status, 400, String(bad));
  }
  const ok = await age(cookie, { birth: yearsAgo(30) });
  assert.deepEqual([ok.status, ok.body.band, ok.body.user.needsAge], [200, 'adult', false]);
  assert.equal((await call(catsHandler, { method: 'POST', url: '/api/cats', cookie, body: cat })).status, 201);
  assert.equal((await call(meHandler, { url: '/api/me', cookie })).body.user.needsAge, false);

  const row = (await db.rows('vp_users'))[0];
  assert.equal(row.age_band, 'adult');
  assert.ok(!JSON.stringify(row).includes(yearsAgo(30)), 'the birth month is not stored in the clear');
  assert.equal(decrypt(row.birth_enc, 'birth'), yearsAgo(30));
  // written once: nobody can change the age afterwards
  assert.equal((await age(cookie, { birth: yearsAgo(40) })).status, 409);
  assert.equal(decrypt((await db.rows('vp_users'))[0].birth_enc, 'birth'), yearsAgo(30));
  assert.equal((await db.rows('vp_guardians')).length, 0);
});

test('age: requires a session', async () => {
  assert.equal((await age(undefined, { birth: '1990-05' })).status, 401);
});

test('age 16-17: stays active and the guardian is only notified', async () => {
  const { cookie } = await googleLogin();
  assert.equal((await age(cookie, { birth: yearsAgo(17, 1) })).status, 400, 'guardian e-mail is required');
  assert.equal((await age(cookie, { birth: yearsAgo(17, 1), guardianEmail: 'gato@example.com' })).status, 400, 'not the own e-mail');
  assert.equal((await db.rows('vp_users'))[0].birth_enc, null, 'a rejected request changes nothing');
  mails = [];
  const r = await age(cookie, { birth: yearsAgo(17, 1), guardianEmail: ' Mae@Example.com ' });
  assert.deepEqual([r.status, r.body.band, r.body.mailSent, r.body.awaitingGuardian], [200, 'teen', true, undefined]);
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, ['mae@example.com']);
  assert.ok(!/#t=/.test(mails[0].text), 'a notice has no approval link');
  assert.equal((await call(meHandler, { url: '/api/me', cookie })).status, 200);
  const [g] = await db.rows('vp_guardians');
  assert.ok(!JSON.stringify(g).includes('mae@example.com'));
  assert.equal(decrypt(g.enc, 'guardian'), 'mae@example.com');
  assert.equal((await db.rows('vp_users'))[0].age_band, 'teen');
  assert.equal((await db.rows('vp_tokens')).length, 0);
});

test('age under 16: awaiting guardian, no session, single-use 7-day link, then active', async () => {
  const g = await googleLogin();
  mails = [];
  const r = await age(g.cookie, { birth: yearsAgo(12), guardianEmail: 'responsavel@example.com' });
  assert.deepEqual([r.status, r.body.band, r.body.awaitingGuardian, r.body.mailSent], [200, 'child', true, true]);
  assert.match(r.headers['set-cookie'], /Max-Age=0/);
  assert.equal((await call(meHandler, { url: '/api/me', cookie: g.cookie })).status, 401, 'no session while waiting');
  assert.equal((await db.rows('vp_sessions')).length, 0);
  assert.equal((await db.rows('vp_users'))[0].status, 'awaiting_guardian');

  // the guardian gets the approval link; the token is in the #fragment and only its hash is stored
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, ['responsavel@example.com']);
  const token = guardianToken();
  assert.match(mails[0].text, new RegExp(`https://vice-paws\\.vercel\\.app/guardian\\.html#t=${token}`));
  assert.ok(!/[?&]t=/.test(mails[0].text));
  const [t] = await db.rows('vp_tokens');
  assert.match(t.token_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(t).includes(token));
  const days = (new Date(t.expires_at) - Date.now()) / 86400e3;
  assert.ok(days > 6.99 && days < 7.01);

  // logging in meanwhile (Google or code) gives no session
  const again = await google(idToken());
  assert.deepEqual([again.status, again.body], [200, { ok: true, awaitingGuardian: true }]);
  assert.ok(!/vp_session=[A-Za-z0-9]/.test(String(again.headers['set-cookie'])));
  await auth('start', { email: 'gato@example.com' });
  const v = await auth('verify', { email: 'gato@example.com', code: lastCode() });
  assert.deepEqual(v.body, { ok: true, awaitingGuardian: true });
  assert.equal((await db.rows('vp_sessions')).length, 0);

  // a made-up or malformed token does nothing
  for (const bad of ['', 'x', 'A'.repeat(43), undefined]) assert.equal((await approve(bad)).status, 400);
  mails = [];
  const ok = await approve(token);
  assert.deepEqual([ok.status, ok.body], [200, { ok: true }]);
  assert.equal((await db.rows('vp_users'))[0].status, 'active');
  assert.ok((await db.rows('vp_guardians'))[0].approved_at);
  assert.deepEqual(mails.map((m) => m.to), [['gato@example.com']], 'the player is told it was approved');
  // single use
  assert.equal((await approve(token)).status, 400);
  // now the player gets in
  const login = await google(idToken());
  assert.equal(login.status, 200);
  assert.equal(login.body.user.needsAge, false);
  assert.equal((await call(meHandler, { url: '/api/me', cookie: cookieOf(login) })).status, 200);
});

test('guardian link: expires after 7 days; concurrent use burns it once', async () => {
  const g = await googleLogin();
  await age(g.cookie, { birth: yearsAgo(10), guardianEmail: 'responsavel@example.com' });
  const token = guardianToken();
  await db.expireTokens();
  assert.equal((await approve(token)).status, 400);
  assert.equal((await db.rows('vp_users'))[0].status, 'awaiting_guardian');

  const resend = await auth('guardian-resend', { email: 'gato@example.com' });
  assert.deepEqual([resend.status, resend.body], [200, { ok: true }]);
  const fresh = guardianToken();
  assert.notEqual(fresh, token);
  const [a, b] = await Promise.all([approve(fresh), approve(fresh)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
});

test('guardian-resend: the same answer for unknown, active and waiting accounts; limited to 3 an hour', async () => {
  const g = await googleLogin();
  await age(g.cookie, { birth: yearsAgo(10), guardianEmail: 'responsavel@example.com' });
  mails = [];
  const answers = [];
  for (const email of ['ninguem@example.com', 'gato@example.com']) answers.push(await auth('guardian-resend', { email }));
  assert.deepEqual(answers.map((r) => [r.status, r.body]), [[200, { ok: true }], [200, { ok: true }]]);
  assert.equal(mails.length, 1, 'only the real waiting account triggers a mail');
  for (let i = 0; i < 4; i++) await auth('guardian-resend', { email: 'gato@example.com' });
  assert.equal(mails.length, 2, 'the 1-hour limit stops further mails (1 at creation + 2 resends = 3 tokens)');
  assert.equal((await auth('guardian-resend', { email: 'not-an-email' })).status, 400);
});

test('guardian mails are capped per guardian address per day', async () => {
  for (let i = 0; i < 8; i++) {
    const g = await googleLogin({ sub: String(100 + i), email: `kid${i}@example.com` });
    assert.equal((await age(g.cookie, { birth: yearsAgo(9), guardianEmail: 'familia@example.com' })).status, 200);
  }
  const g = await googleLogin({ sub: '200', email: 'kid9@example.com' });
  assert.equal((await age(g.cookie, { birth: yearsAgo(9), guardianEmail: 'familia@example.com' })).status, 429);
});

// ---------- privacy ----------
test('no endpoint leaks e-mails, Google ids, birth or guardian data to anyone else', async () => {
  const a = await googleLogin({ sub: '1', email: 'dona@example.com' });
  await age(a.cookie, { birth: yearsAgo(30) });
  await call(catsHandler, { method: 'POST', url: '/api/cats', cookie: a.cookie, body: { name: 'Mimo', breed: 'srd', spec: {} } });
  const k = await googleLogin({ sub: '2', email: 'crianca@example.com' });
  await age(k.cookie, { birth: yearsAgo(11), guardianEmail: 'responsavel@example.com' });

  const bodies = [];
  bodies.push((await call(catsActionHandler, { url: '/api/cats/public' })).body);
  bodies.push((await call(authHandler, { url: '/api/auth/config' })).body);
  bodies.push((await approve('A'.repeat(43))).body);
  bodies.push((await auth('guardian-resend', { email: 'crianca@example.com' })).body);
  bodies.push((await google('garbage')).body);
  bodies.push((await call(meHandler, { url: '/api/me' })).body);
  bodies.push((await auth('verify', { email: 'dona@example.com', code: '000000' })).body);
  const text = JSON.stringify(bodies);
  for (const secret of ['dona@example.com', 'crianca@example.com', 'responsavel@example.com', '110000', 'google_sub', 'birth']) assert.ok(!text.includes(secret), secret);
  // the owner's own view has the e-mail but never the birth date, the sub or the guardian
  const mine = JSON.stringify((await call(meHandler, { url: '/api/me', cookie: a.cookie })).body);
  assert.ok(mine.includes('dona@example.com'));
  for (const secret of ['responsavel', 'google_sub', 'birth_enc', 'age_band', '"1"']) assert.ok(!mine.includes(secret), secret);
});

test('nothing sensitive reaches the logs', async () => {
  const lines = [];
  console.error = (...a) => lines.push(a.join(' '));
  const spy = [];
  const realLog = console.log; console.log = (...a) => spy.push(a.join(' '));
  try {
    const tok = idToken({ aud: 'wrong' });
    await google(tok);
    await approve('B'.repeat(43));
    const g = await googleLogin();
    await age(g.cookie, { birth: yearsAgo(10), guardianEmail: 'responsavel@example.com' });
  } finally { console.log = realLog; console.error = () => {}; }
  const all = lines.concat(spy).join('\n');
  for (const s of ['gato@example.com', 'responsavel@example.com', 'wrong', 'eyJ']) assert.ok(!all.includes(s), s);
});

// ---------- DELETE /api/me ----------
test('DELETE /api/me removes e-mail, google_sub, birth, guardian and tokens, and anonymises the ranking row', async () => {
  const kid = await googleLogin({ sub: '7', email: 'kid@example.com' });
  await age(kid.cookie, { birth: yearsAgo(14), guardianEmail: 'responsavel@example.com' });
  await approve(guardianToken());
  const a = await googleLogin({ sub: '7', email: 'kid@example.com' });
  await call(catsHandler, { method: 'POST', url: '/api/cats', cookie: a.cookie, body: { name: 'Tigresa', breed: 'srd', spec: {} } });
  const other = await googleLogin({ sub: '8', email: 'fica@example.com' });
  await age(other.cookie, { birth: yearsAgo(30) });
  await db.seedRanking([{ name: 'Tigresa', score: 900 }, { name: 'OutroJogador', score: 50 }]);

  assert.equal((await call(meHandler, { method: 'DELETE', url: '/api/me' })).status, 401);
  assert.equal((await call(meHandler, { method: 'DELETE', url: '/api/me', cookie: a.cookie, origin: 'https://evil.example' })).status, 403);
  mails = [];
  const r = await call(meHandler, { method: 'DELETE', url: '/api/me', cookie: a.cookie });
  assert.deepEqual([r.status, r.body], [200, { ok: true, deleted: true }]);
  assert.match(r.headers['set-cookie'], /Max-Age=0/);
  assert.deepEqual(mails.map((m) => m.to), [['kid@example.com']]);

  const left = {};
  for (const t of ['vp_users', 'vp_sessions', 'vp_cats', 'vp_tokens', 'vp_guardians', 'vp_login_codes']) left[t] = await db.rows(t);
  const dump = JSON.stringify(left);
  for (const s of ['kid@example.com', 'responsavel', '"7"']) assert.ok(!dump.includes(s), s);
  assert.deepEqual([left.vp_users.length, left.vp_guardians.length, left.vp_tokens.length, left.vp_cats.length], [1, 0, 0, 0]);
  const rank = await db.rows('vp_ranking');
  assert.ok(!rank.some((x) => x.name === 'Tigresa'));
  assert.ok(rank.some((x) => /^anon-[0-9a-f]{8}$/.test(x.name) && x.score === 900));
  assert.ok(rank.some((x) => x.name === 'OutroJogador'));
  assert.equal((await call(meHandler, { url: '/api/me', cookie: a.cookie })).status, 401);
  assert.equal((await call(meHandler, { url: '/api/me', cookie: other.cookie })).status, 200);
});

test('DELETE /api/me works before the age step too', async () => {
  const a = await googleLogin();
  assert.equal((await call(meHandler, { method: 'DELETE', url: '/api/me', cookie: a.cookie })).status, 200);
  assert.equal((await db.rows('vp_users')).length, 0);
});

// ---------- admin ----------
test('ADMIN_EMAILS marks the owner account', async () => {
  process.env.ADMIN_EMAILS = 'dono@example.com, outro@example.com';
  const a = await googleLogin({ email: 'dono@example.com', sub: '31' });
  const b = await googleLogin({ email: 'gato@example.com', sub: '32' });
  assert.equal((await call(meHandler, { url: '/api/me', cookie: a.cookie })).body.user.admin, true);
  assert.equal((await call(meHandler, { url: '/api/me', cookie: b.cookie })).body.user.admin, undefined);
});

void randomUUID;
