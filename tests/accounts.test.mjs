// Vice Paws accounts API — handler tests with a mocked neon() and a mocked Resend.
//   node --test tests/
// Default backend: in-memory fake (tests/helpers/fake-sql.mjs).
// Set VP_TEST_PG_URL to run the same suite against a real (throwaway!) Postgres.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { __setSqlForTests } from '../api/_lib/db.js';
import { isProfane } from '../api/_lib/profanity.js';
import { decodePng, guessPattern } from '../api/_lib/colors.js';
import authHandler from '../api/auth/[action].js';
import meHandler from '../api/me.js';
import catsHandler from '../api/cats/index.js';
import catsActionHandler from '../api/cats/[action].js';
import saveHandler from '../api/save.js';
import { createFakeBackend } from './helpers/fake-sql.mjs';
import { call, png, dataUrl } from './helpers/http.mjs';

let db;                 // backend: { sql, reset, rows, expireCodes, expireSessions, close }
let mails = [];         // payloads "sent" to Resend
let resendStatus = 200;
const realFetch = globalThis.fetch;
const realError = console.error;
const envKeys = ['DATABASE_URL', 'POSTGRES_URL', 'RESEND_API_KEY', 'MAIL_FROM', 'ALLOWED_ORIGINS', 'AUTH_SECRET'];
const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

before(async () => {
  if (process.env.VP_TEST_PG_URL) {
    const { createPgBackend } = await import('./helpers/pg-wire.mjs');
    db = await createPgBackend(process.env.VP_TEST_PG_URL);
  } else {
    db = createFakeBackend();
  }
  console.error = () => {};
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.authorization, 'Bearer re_test_key');
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify(resendStatus === 200 ? { id: 'mail_1' } : { message: 'nope' }), { status: resendStatus });
  };
});

beforeEach(async () => {
  for (const k of envKeys) delete process.env[k];
  process.env.RESEND_API_KEY = 're_test_key';
  mails = [];
  resendStatus = 200;
  await db.reset();
  __setSqlForTests(db.sql);       // also forces the schema setup to run again
});

after(async () => {
  globalThis.fetch = realFetch;
  console.error = realError;
  for (const k of envKeys) (savedEnv[k] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[k]));
  __setSqlForTests(null);
  await db.close();
});

// ---------- helpers ----------
const auth = (action, body, opts = {}) => call(authHandler, { method: 'POST', url: `/api/auth/${action}`, body, ...opts });
const lastCode = () => /: (\d{6})\n/.exec(mails.at(-1).text)[1];
const cookieOf = (r) => String(r.headers['set-cookie']).split(';')[0];

async function login(email = 'dona@example.com', lang = 'pt') {
  const s = await auth('start', { email, lang });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const v = await auth('verify', { email, code: lastCode() });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const cookie = cookieOf(v);
  if (v.body.user.needsAge) {            // first login: the age step (adult), as the client does
    const a = await auth('age', { birth: '1990-05' }, { headers: { cookie } });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    v.body.user.needsAge = false;
  }
  return { cookie, user: v.body.user };
}

const CAT = {
  name: 'Mimosa', breed: 'vira-lata', bio: 'A brava da casa. Ruge para os buldogues.', instagram: '@Mimo.Mimosa.Morticia',
  spec: { size: 1.1, faceShape: 'round', furBase: '#F4A259', pattern: 'calico', patchColors: ['#fff', '#222222'],
    eyeColor: '#7BC86C', accessories: ['bow', 'bell'] },
};
const createCat = (cookie, over = {}) => call(catsHandler, { method: 'POST', url: '/api/cats', cookie, body: { ...CAT, ...over } });

// ---------- infrastructure ----------
test('returns 503 offline when no database is configured', async () => {
  __setSqlForTests(null);
  for (const [h, opts] of [[meHandler, {}], [saveHandler, {}], [authHandler, { method: 'POST', url: '/api/auth/start', body: { email: 'a@b.co' } }]]) {
    const r = await call(h, opts);
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { error: 'offline' });
  }
});

test('rejects unsupported methods with 405', async () => {
  const r = await call(authHandler, { method: 'GET', url: '/api/auth/start' });
  assert.equal(r.status, 405);
  assert.equal(r.headers.allow, 'POST');
  assert.equal((await call(saveHandler, { method: 'POST', url: '/api/save', body: {} })).status, 405);
});

test('mutating requests need an allowed Origin', async () => {
  const body = { email: 'dona@example.com' };
  for (const origin of [null, 'https://evil.example', 'https://vice-paws.vercel.app.evil.example', 'http://vice-paws.vercel.app', 'https://other-game.vercel.app']) {
    const r = await auth('start', body, { origin });
    assert.equal(r.status, 403, String(origin));
    assert.deepEqual(r.body, { error: 'origin' });
  }
  assert.equal(mails.length, 0);
  for (const origin of ['https://vice-paws.vercel.app', 'https://vice-paws-git-feat-accounts-api-miguel.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:5173']) {
    const r = await auth('start', body, { origin, ip: origin });
    assert.equal(r.status, 200, origin);
  }
  // same origin on a custom domain, and an explicit allow-list
  assert.equal((await auth('start', { email: 'x@example.com' }, { origin: 'https://jogo.example.com', headers: { host: 'jogo.example.com' } })).status, 200);
  process.env.ALLOWED_ORIGINS = 'https://vicepaws.app, https://www.vicepaws.app';
  assert.equal((await auth('start', { email: 'y@example.com' }, { origin: 'https://www.vicepaws.app' })).status, 200);
  // Referer is accepted when a browser omits Origin
  assert.equal((await auth('start', { email: 'z@example.com' }, { origin: null, headers: { referer: 'https://vice-paws.vercel.app/' } })).status, 200);
});

test('malformed JSON bodies are a 400', async () => {
  const r = await auth('start', '{not json');
  assert.equal(r.status, 400);
  assert.deepEqual(r.body, { error: 'invalid-json' });
  assert.equal((await auth('start', '[1,2]')).status, 400);
});

test('unknown auth action is a 404', async () => {
  assert.equal((await auth('nope', {})).status, 404);
});

// ---------- login ----------
test('start validates the email', async () => {
  for (const email of [undefined, '', 'nope', 'a@b', 'a b@c.com', 'a@b.c', `${'x'.repeat(250)}@example.com`, { $ne: 1 }]) {
    const r = await auth('start', { email });
    assert.equal(r.status, 400, String(email));
    assert.deepEqual(r.body, { error: 'invalid', field: 'email' });
  }
  assert.equal(mails.length, 0);
});

test('start emails a 6-digit code (PT by default, EN on request) and stores only its hash', async () => {
  const r = await auth('start', { email: '  Dona@Example.com ' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, expiresInMinutes: 10 });
  assert.equal(r.headers['cache-control'], 'no-store');
  const m = mails[0];
  assert.deepEqual(m.to, ['dona@example.com']);
  assert.equal(m.from, 'Vice Paws <jogo@resend.dev>');
  assert.match(m.subject, /^\d{6} é o seu código do Vice Paws/);
  assert.match(m.html, /VICE PAWS/);
  assert.ok(m.html.includes(lastCode()));
  assert.match(m.html, /10 minutos/);

  process.env.MAIL_FROM = 'Vice Paws <oi@vicepaws.app>';
  await auth('start', { email: 'dona@example.com', lang: 'en-US' });
  assert.equal(mails[1].from, 'Vice Paws <oi@vicepaws.app>');
  assert.match(mails[1].subject, /is your Vice Paws code/);
  assert.match(mails[1].html, /10 minutes/);

  const rows = await db.rows('vp_login_codes');
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.match(row.code_hash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(row).includes(lastCode()));
    assert.ok(!JSON.stringify(row).includes('203.0.113.7'), 'the IP is stored hashed');
  }
});

test('start without RESEND_API_KEY answers 503 mail-offline', async () => {
  delete process.env.RESEND_API_KEY;
  const r = await auth('start', { email: 'dona@example.com' });
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { error: 'mail-offline' });
});

test('start answers 502 when Resend fails', async () => {
  resendStatus = 500;
  const r = await auth('start', { email: 'dona@example.com' });
  assert.equal(r.status, 502);
  assert.deepEqual(r.body, { error: 'mail' });
});

test('start is rate limited to 5 codes per hour per email', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await auth('start', { email: 'dona@example.com' }, { ip: `198.51.100.${i}` })).status, 200);
  const r = await auth('start', { email: 'dona@example.com' }, { ip: '198.51.100.99' });
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'rate-limit');
  assert.equal(mails.length, 5);
  assert.equal((await auth('start', { email: 'outra@example.com' }, { ip: '198.51.100.99' })).status, 200);
});

test('start is rate limited per IP', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await auth('start', { email: `gato${i}@example.com` })).status, 200);
  const r = await auth('start', { email: 'gato99@example.com' });
  assert.equal(r.status, 429);
  assert.equal(mails.length, 20);
  assert.equal((await auth('start', { email: 'gato99@example.com' }, { ip: '198.51.100.1' })).status, 200);
});

test('verify creates the session cookie and the account; /api/me works with it', async () => {
  await auth('start', { email: 'dona@example.com', lang: 'en' });
  const v = await auth('verify', { email: 'DONA@example.com', code: ` ${lastCode()} ` });
  assert.equal(v.status, 200);
  assert.equal(v.body.ok, true);
  assert.equal(v.body.user.email, 'dona@example.com');
  assert.equal(v.body.user.lang, 'en');
  assert.match(v.body.user.id, /^[0-9a-f-]{36}$/);
  assert.ok(!Number.isNaN(Date.parse(v.body.user.createdAt)));
  assert.deepEqual(Object.keys(v.body.user).sort(), ['createdAt', 'email', 'id', 'lang', 'needsAge', 'status']);
  assert.equal(v.body.user.needsAge, true);

  const cookie = v.headers['set-cookie'];
  assert.match(cookie, /^vp_session=[A-Za-z0-9_-]{43}; /);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', `Max-Age=${60 * 86400}`]) assert.ok(cookie.includes(attr), attr);

  const sessions = await db.rows('vp_sessions');
  assert.equal(sessions.length, 1);
  assert.match(sessions[0].token_hash, /^[0-9a-f]{64}$/);
  assert.ok(!cookie.includes(sessions[0].token_hash), 'only a hash of the token is stored');
  const days = (new Date(sessions[0].expires_at) - Date.now()) / 86400e3;
  assert.ok(days > 59.9 && days < 60.1);

  const me = await call(meHandler, { url: '/api/me', cookie: cookieOf(v) });
  assert.equal(me.status, 200);
  assert.deepEqual(me.body, { user: v.body.user, cats: [] });
});

test('logging in again reuses the same account', async () => {
  const a = await login('dona@example.com');
  const b = await login('dona@example.com');
  assert.equal(a.user.id, b.user.id);
  assert.equal((await db.rows('vp_users')).length, 1);
  assert.equal((await db.rows('vp_sessions')).length, 2);
});

test('verify rejects wrong, malformed, reused and expired codes', async () => {
  await auth('start', { email: 'dona@example.com' });
  const code = lastCode();
  const wrong = code === '000000' ? '000001' : '000000';
  for (const bad of [wrong, '12345', 'abcdef', '', undefined, 1234567]) {
    const r = await auth('verify', { email: 'dona@example.com', code: bad });
    assert.equal(r.status, 400, String(bad));
    assert.deepEqual(r.body, { error: 'invalid-code' });
    assert.equal(r.headers['set-cookie'], undefined);
  }
  assert.equal((await auth('verify', { email: 'nope', code })).status, 400);
  assert.equal((await auth('verify', { email: 'outra@example.com', code })).status, 400, 'code is bound to the email');
  assert.equal((await auth('verify', { email: 'dona@example.com', code })).status, 200);
  assert.equal((await auth('verify', { email: 'dona@example.com', code })).status, 400, 'single use');

  await auth('start', { email: 'dona@example.com' });
  await db.expireCodes();
  assert.equal((await auth('verify', { email: 'dona@example.com', code: lastCode() })).status, 400, 'expired');
  assert.equal((await db.rows('vp_sessions')).length, 1);
});

test('verify locks a code after 5 wrong attempts', async () => {
  await auth('start', { email: 'dona@example.com' });
  const code = lastCode();
  const wrong = code === '111111' ? '222222' : '111111';
  for (let i = 0; i < 5; i++) assert.equal((await auth('verify', { email: 'dona@example.com', code: wrong })).status, 400);
  const r = await auth('verify', { email: 'dona@example.com', code });
  assert.equal(r.status, 429);
  assert.deepEqual(r.body, { error: 'too-many-attempts' });
  // a fresh code works again
  await auth('start', { email: 'dona@example.com' });
  assert.equal((await auth('verify', { email: 'dona@example.com', code: lastCode() })).status, 200);
});

test('only the newest code is valid', async () => {
  await auth('start', { email: 'dona@example.com' });
  const first = lastCode();
  await auth('start', { email: 'dona@example.com' });
  const second = lastCode();
  if (first !== second) assert.equal((await auth('verify', { email: 'dona@example.com', code: first })).status, 400);
  assert.equal((await auth('verify', { email: 'dona@example.com', code: second })).status, 200);
});

test('/api/me is 401 without, with a bogus, or with an expired session', async () => {
  assert.deepEqual((await call(meHandler, { url: '/api/me' })).body, { error: 'unauthorized' });
  assert.equal((await call(meHandler, { url: '/api/me', cookie: 'vp_session=nope' })).status, 401);
  assert.equal((await call(meHandler, { url: '/api/me', cookie: `vp_session=${'A'.repeat(43)}` })).status, 401);
  const { cookie } = await login();
  assert.equal((await call(meHandler, { url: '/api/me', cookie: `other=1; ${cookie}; x=y` })).status, 200);
  await db.expireSessions();
  assert.equal((await call(meHandler, { url: '/api/me', cookie })).status, 401);
});

test('logout drops the session and clears the cookie', async () => {
  const { cookie } = await login();
  const other = await login();
  const r = await auth('logout', undefined, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.headers['set-cookie'], /^vp_session=; .*Max-Age=0/);
  assert.equal((await call(meHandler, { url: '/api/me', cookie })).status, 401);
  assert.equal((await call(meHandler, { url: '/api/me', cookie: other.cookie })).status, 200, 'other devices stay logged in');
  assert.equal((await auth('logout', undefined)).status, 200, 'logout without a session is fine');
});

// ---------- cats ----------
test('cats endpoints need a session', async () => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const r = await call(catsHandler, { method, url: '/api/cats', body: method === 'GET' ? undefined : CAT });
    assert.equal(r.status, 401, method);
  }
});

test('creates a cat, normalising and whitelisting the fields', async () => {
  const { cookie } = await login();
  const r = await createCat(cookie, { spec: { ...CAT.spec, evil: '<script>', size: 1.104 }, owner: 'x', email: 'leak@example.com' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const cat = r.body.cat;
  assert.match(cat.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ ...cat, id: 0, createdAt: 0, updatedAt: 0 }, {
    id: 0, name: 'Mimosa', breed: 'vira-lata', bio: 'A brava da casa. Ruge para os buldogues.',
    instagram: 'mimo.mimosa.morticia', isPublic: true, createdAt: 0, updatedAt: 0,
    spec: { size: 1.1, faceShape: 'round', furBase: '#f4a259', pattern: 'calico', patchColors: ['#ffffff', '#222222'],
      eyeColor: '#7bc86c', accessories: ['bow', 'bell'] },
  });
  const me = await call(meHandler, { url: '/api/me', cookie });
  assert.deepEqual(me.body.cats, [cat]);
  assert.deepEqual((await call(catsHandler, { url: '/api/cats', cookie })).body, { cats: [cat] });
});

test('a minimal cat gets a default spec; names are sanitised', async () => {
  const { cookie } = await login();
  const r = await call(catsHandler, { method: 'POST', url: '/api/cats', cookie, body: { name: '  <b>Mortícia</b>\u0000  d\'Ávila ', breed: 'srd', isPublic: false } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.cat.name, "b Mortícia b d'Ávila");
  assert.equal(r.body.cat.bio, '');
  assert.equal(r.body.cat.instagram, null);
  assert.equal(r.body.cat.isPublic, false);
  assert.deepEqual(r.body.cat.spec, { size: 1, faceShape: 'round', furBase: '#d9a066', pattern: 'solid', patchColors: [], eyeColor: '#7bc86c', accessories: [] });
});

test('rejects invalid cat fields with 400 and the field name', async () => {
  const { cookie } = await login();
  const spec = (s) => ({ spec: { ...CAT.spec, ...s } });
  const cases = [
    [{ name: undefined }, 'name'], [{ name: '' }, 'name'], [{ name: '<<>>' }, 'name'], [{ name: 'x'.repeat(21) }, 'name'], [{ name: 42 }, 'name'],
    [{ breed: 'dragao' }, 'breed'], [{ breed: undefined }, 'breed'], [{ breed: ['persa'] }, 'breed'],
    [{ bio: 'x'.repeat(121) }, 'bio'], [{ bio: { a: 1 } }, 'bio'],
    [{ instagram: 'has space' }, 'instagram'], [{ instagram: 'https://instagram.com/x' }, 'instagram'],
    [{ instagram: 'a..b' }, 'instagram'], [{ instagram: 'x'.repeat(31) }, 'instagram'], [{ instagram: 'trailing.' }, 'instagram'],
    [{ isPublic: 'yes' }, 'isPublic'],
    [{ spec: 'solid' }, 'spec'], [{ spec: [1] }, 'spec'],
    [spec({ size: 0.79 }), 'spec.size'], [spec({ size: 1.21 }), 'spec.size'], [spec({ size: '1' }), 'spec.size'], [spec({ size: NaN }), 'spec.size'],
    [spec({ faceShape: 'triangle' }), 'spec.faceShape'],
    [spec({ pattern: 'leopard' }), 'spec.pattern'],
    [spec({ furBase: 'red' }), 'spec.furBase'], [spec({ furBase: '#12345' }), 'spec.furBase'], [spec({ furBase: 'url(javascript:1)' }), 'spec.furBase'],
    [spec({ eyeColor: '#gggggg' }), 'spec.eyeColor'],
    [spec({ patchColors: '#fff' }), 'spec.patchColors'], [spec({ patchColors: ['#fff', 'nope'] }), 'spec.patchColors'],
    [spec({ patchColors: ['#111', '#222', '#333', '#444', '#555'] }), 'spec.patchColors'],
    [spec({ accessories: ['bow', 'gun'] }), 'spec.accessories'], [spec({ accessories: 'bow' }), 'spec.accessories'],
  ];
  for (const [over, field] of cases) {
    const r = await createCat(cookie, over);
    assert.equal(r.status, 400, `${field}: ${JSON.stringify(over)}`);
    assert.deepEqual(r.body, { error: 'invalid', field });
  }
  assert.equal((await db.rows('vp_cats')).length, 0);
  // boundaries are fine
  assert.equal((await createCat(cookie, { name: 'x'.repeat(20), bio: 'y'.repeat(120), ...spec({ size: 0.8 }) })).status, 201);
  assert.equal((await createCat(cookie, spec({ size: 1.2 }))).status, 201);
});

test('accepts every breed of the enum', async () => {
  const breeds = ['persa', 'siames', 'vira-lata', 'srd', 'maine-coon', 'sphynx', 'angora', 'bengal', 'ragdoll', 'british', 'sem-raca', 'outro'];
  for (let i = 0; i < breeds.length; i += 5) {
    const { cookie } = await login(`breeds${i}@example.com`);
    for (const breed of breeds.slice(i, i + 5)) assert.equal((await createCat(cookie, { breed })).status, 201, breed);
  }
});

test('moderation: profanity in name, bio or handle is a 422', async () => {
  const { cookie } = await login();
  for (const [over, field] of [
    [{ name: 'Fuck' }, 'name'], [{ name: 'P.u.t.a' }, 'name'], [{ name: 'Sh1t' }, 'name'],
    [{ bio: 'gato filho da puta' }, 'bio'], [{ bio: 'what a fuuuucking cat' }, 'bio'], [{ bio: 'vai tomar no CU' }, 'bio'],
    [{ instagram: 'caralho_do_gato' }, 'instagram'],
  ]) {
    const r = await createCat(cookie, over);
    assert.equal(r.status, 422, JSON.stringify(over));
    assert.deepEqual(r.body, { error: 'moderation', field });
  }
  assert.equal((await db.rows('vp_cats')).length, 0);
  const cat = (await createCat(cookie)).body.cat;
  const put = await call(catsHandler, { method: 'PUT', url: `/api/cats?id=${cat.id}`, cookie, body: { ...CAT, name: 'Merda' } });
  assert.equal(put.status, 422);
});

test('profanity filter: blocks variants, lets innocent words through', () => {
  for (const s of ['puta', 'PUTA', 'pûtá', 'p u t a', 'puuuta', 'fuck', 'f.u.c.k', 'fuuuck', 'fvck you asshole', 'motherfucker', 'sh1t', 'b1tch',
    'merda', 'c4ralho', 'filhodaputa', 'vai se foder', 'n1gger', 'buceta', 'arrombado']) assert.equal(isProfane(s), true, s);
  for (const s of ['Mimo', 'Mimosa', 'Mortícia', 'disputa', 'computador', 'reputação', 'Scunthorpe', 'pussycat', 'cocker spaniel', 'shiitake',
    'analista', 'Niger', 'gata 5 anos', 'adora sachê e caixa de papelão', 'the tired one', 'class', 'assistente', 'curioso', 'cuidado', 'acucar']) {
    assert.equal(isProfane(s), false, s);
  }
});

test('a player can have at most 5 cats', async () => {
  const { cookie } = await login();
  for (let i = 0; i < 5; i++) assert.equal((await createCat(cookie, { name: `Gato ${i}` })).status, 201);
  const r = await createCat(cookie, { name: 'Gato 6' });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'cat-limit', max: 5 });
  const other = await login('outra@example.com');
  assert.equal((await createCat(other.cookie)).status, 201, 'the limit is per player');
  const cats = (await call(catsHandler, { url: '/api/cats', cookie })).body.cats;
  assert.deepEqual(cats.map((c) => c.name), ['Gato 0', 'Gato 1', 'Gato 2', 'Gato 3', 'Gato 4']);
});

test('updates and deletes only the player\'s own cats', async () => {
  const a = await login('a@example.com');
  const b = await login('b@example.com');
  const cat = (await createCat(a.cookie)).body.cat;

  const put = await call(catsHandler, { method: 'PUT', url: `/api/cats?id=${cat.id}`, cookie: a.cookie,
    body: { name: 'Mimo', breed: 'persa', bio: 'O cansado.', isPublic: false, spec: { pattern: 'tuxedo', furBase: '#111111' } } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.cat.id, cat.id);
  assert.equal(put.body.cat.name, 'Mimo');
  assert.equal(put.body.cat.breed, 'persa');
  assert.equal(put.body.cat.instagram, null);
  assert.equal(put.body.cat.isPublic, false);
  assert.equal(put.body.cat.spec.pattern, 'tuxedo');
  assert.equal(put.body.cat.createdAt, cat.createdAt);
  assert.ok(put.body.cat.updatedAt >= cat.updatedAt);

  // id may also come in the body
  assert.equal((await call(catsHandler, { method: 'PUT', url: '/api/cats', cookie: a.cookie, body: { ...CAT, id: cat.id } })).status, 200);

  for (const method of ['PUT', 'DELETE']) {
    const r = await call(catsHandler, { method, url: `/api/cats?id=${cat.id}`, cookie: b.cookie, body: CAT });
    assert.equal(r.status, 404, `${method} by another player`);
    const bad = await call(catsHandler, { method, url: '/api/cats?id=1%20or%201=1', cookie: a.cookie, body: CAT });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body, { error: 'invalid', field: 'id' });
    assert.equal((await call(catsHandler, { method, url: '/api/cats', cookie: a.cookie, body: CAT })).status, 400, 'missing id');
  }
  assert.equal((await call(catsHandler, { method: 'PUT', url: `/api/cats?id=${cat.id}`, cookie: a.cookie, body: { ...CAT, breed: 'x' } })).status, 400);

  const del = await call(catsHandler, { method: 'DELETE', url: `/api/cats?id=${cat.id}`, cookie: a.cookie });
  assert.deepEqual([del.status, del.body], [200, { ok: true }]);
  assert.equal((await call(catsHandler, { method: 'DELETE', url: `/api/cats?id=${cat.id}`, cookie: a.cookie })).status, 404);
  assert.equal((await db.rows('vp_cats')).length, 0);
});

test('public gallery: recent public cats, no emails, no owner ids', async () => {
  const a = await login('secret-a@example.com');
  const b = await login('secret-b@example.com');
  await createCat(a.cookie, { name: 'Um' });
  await createCat(a.cookie, { name: 'Escondido', isPublic: false });
  await createCat(b.cookie, { name: 'Dois' });
  await createCat(b.cookie, { name: 'Tres' });

  const r = await call(catsActionHandler, { url: '/api/cats/public' });      // no session needed
  assert.equal(r.status, 200);
  assert.match(r.headers['cache-control'], /^public, s-maxage=30/);
  assert.deepEqual(r.body.cats.map((c) => c.name), ['Tres', 'Dois', 'Um']);
  assert.deepEqual(Object.keys(r.body.cats[0]).sort(), ['bio', 'breed', 'createdAt', 'id', 'instagram', 'name', 'spec']);
  const raw = JSON.stringify(r.body);
  for (const leak of ['example.com', a.user.id, b.user.id, 'user_id', 'email']) assert.ok(!raw.includes(leak), leak);

  assert.deepEqual((await call(catsActionHandler, { url: '/api/cats/public?limit=2' })).body.cats.map((c) => c.name), ['Tres', 'Dois']);
  for (const limit of ['0', '-5', 'abc', '1;drop table vp_cats', '9999']) {
    const x = await call(catsActionHandler, { url: `/api/cats/public?limit=${encodeURIComponent(limit)}` });
    assert.equal(x.status, 200, limit);
    assert.ok(x.body.cats.length >= 1 && x.body.cats.length <= 3);
  }
  assert.equal((await call(catsActionHandler, { url: '/api/cats/nope' })).status, 404);
});

// ---------- cloud save ----------
test('cloud save: round trip, last write wins', async () => {
  const { cookie } = await login();
  assert.deepEqual((await call(saveHandler, { url: '/api/save', cookie })).body, { data: null, updatedAt: null });

  const data = { v: 2, level: 7, stars: [3, 2, 3], lives: 4, cats: { active: 'mimosa' }, note: 'ação "ç" 🐾' };
  const put = await call(saveHandler, { method: 'PUT', url: '/api/save', cookie, body: { data } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.ok, true);
  assert.ok(!Number.isNaN(Date.parse(put.body.updatedAt)));
  assert.deepEqual((await call(saveHandler, { url: '/api/save', cookie })).body, { data, updatedAt: put.body.updatedAt });

  const put2 = await call(saveHandler, { method: 'PUT', url: '/api/save', cookie, body: { data: { v: 2, level: 8 } } });
  assert.ok(put2.body.updatedAt >= put.body.updatedAt);
  assert.deepEqual((await call(saveHandler, { url: '/api/save', cookie })).body, { data: { v: 2, level: 8 }, updatedAt: put2.body.updatedAt });
  assert.equal((await db.rows('vp_saves')).length, 1);

  const other = await login('outra@example.com');
  assert.deepEqual((await call(saveHandler, { url: '/api/save', cookie: other.cookie })).body, { data: null, updatedAt: null });
});

test('cloud save: validation, 64KB limit, auth', async () => {
  const { cookie } = await login();
  const put = (body, c = cookie) => call(saveHandler, { method: 'PUT', url: '/api/save', cookie: c, body });
  assert.equal((await put({ data: { a: 1 } }, null)).status, 401);
  assert.equal((await call(saveHandler, { url: '/api/save' })).status, 401);
  for (const body of [{}, { data: null }, { data: 'x' }, { data: [1, 2] }, { data: 5 }, { data: { s: 'nul\u0000byte' } }]) {
    const r = await put(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.deepEqual(r.body, { error: 'invalid', field: 'data' });
  }
  const big = await put({ data: { blob: 'x'.repeat(64 * 1024) } });
  assert.equal(big.status, 413);
  assert.deepEqual(big.body, { error: 'too-large', maxBytes: 65536 });
  assert.equal((await put({ data: { blob: 'x'.repeat(64 * 1024 - 11) } })).status, 200, 'exactly 64KB is accepted');
  assert.equal((await put({ data: { blob: 'é'.repeat(40 * 1024) } })).status, 413, 'the limit is in bytes, not characters');
});

// ---------- photo -> colours ----------
const suggest = (cookie, image) => call(catsActionHandler, { method: 'POST', url: '/api/cats/suggest-colors', cookie, body: { image } });
const near = (hexColor, [r, g, b], tol = 12) => {
  const n = parseInt(hexColor.slice(1), 16);
  return Math.abs((n >> 16) - r) <= tol && Math.abs(((n >> 8) & 255) - g) <= tol && Math.abs((n & 255) - b) <= tol;
};

test('suggest-colors: solid orange cat', async () => {
  const { cookie } = await login();
  const r = await suggest(cookie, dataUrl(png(40, 30, () => [226, 135, 67, 255], { filter: 4 })));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.spec.pattern, 'solid');
  assert.ok(near(r.body.spec.furBase, [226, 135, 67]), r.body.spec.furBase);
  assert.deepEqual(r.body.spec.patchColors, []);
  assert.equal(r.body.palette[0].share, 1);
  assert.deepEqual(Object.keys(r.body.spec).sort(), ['furBase', 'patchColors', 'pattern']);
});

test('suggest-colors: tuxedo, calico and transparent backgrounds', async () => {
  const { cookie } = await login();
  // black cat with a white chest; noisy pixels and every PNG filter type
  for (const filter of [0, 1, 2, 3, 4]) {
    const tux = png(64, 64, (x, y) => {
      const n = (x * 7 + y * 13) % 9;
      return x > 22 && x < 42 && y > 30 ? [240 + n, 240 + n, 236 + n, 255] : [20 + n, 18 + n, 22 + n, 255];
    }, { filter });
    const r = await suggest(cookie, dataUrl(tux));
    assert.equal(r.body.spec.pattern, 'tuxedo', `filter ${filter}`);
    assert.ok(near(r.body.spec.furBase, [24, 22, 26]), r.body.spec.furBase);
    assert.ok(r.body.spec.patchColors.some((c) => near(c, [244, 244, 240])), JSON.stringify(r.body));
  }
  // three vertical bands: white, orange, black (RGB, no alpha channel)
  const calico = png(60, 40, (x) => (x < 20 ? [250, 250, 250] : x < 40 ? [222, 130, 50] : [25, 22, 20]), { colorType: 2, filter: 1 });
  const c = await suggest(cookie, dataUrl(calico));
  assert.equal(c.body.spec.pattern, 'calico', JSON.stringify(c.body));
  assert.equal(c.body.palette.length, 3);
  // transparent pixels are ignored: grey cat on a transparent magenta background
  const cut = png(32, 32, (x, y) => ((x - 16) ** 2 + (y - 16) ** 2 < 100 ? [128, 128, 132, 255] : [255, 0, 255, 0]));
  const t = await suggest(cookie, dataUrl(cut));
  assert.equal(t.body.spec.pattern, 'solid');
  assert.ok(near(t.body.spec.furBase, [128, 128, 132]), t.body.spec.furBase);
  // the suggestion is accepted as-is by POST /api/cats
  assert.equal((await createCat(cookie, { spec: c.body.spec })).status, 201);
});

test('suggest-colors: stores nothing and rejects bad input', async () => {
  const { cookie } = await login();
  const ok = dataUrl(png(8, 8, () => [200, 180, 150, 255]));
  assert.equal((await suggest(null, ok)).status, 401);
  assert.equal((await suggest(cookie, ok)).status, 200);
  for (const t of ['vp_cats', 'vp_saves']) assert.equal((await db.rows(t)).length, 0);

  const jpeg = await suggest(cookie, dataUrl(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'jpeg'));
  assert.deepEqual([jpeg.status, jpeg.body], [415, { error: 'unsupported-image', hint: 'png' }]);
  const interlaced = await suggest(cookie, dataUrl(png(8, 8, () => [1, 2, 3, 255], { interlace: 1 })));
  assert.equal(interlaced.status, 415);
  for (const bad of [undefined, 42, 'hello', 'https://example.com/cat.png', 'data:image/png;base64,@@@', dataUrl(Buffer.from('not a png at all, really not, not even close')),
    dataUrl(png(8, 8, () => [1, 2, 3, 255]).subarray(0, 48)), dataUrl(png(4, 4, () => [0, 0, 0, 0]))]) {
    const r = await suggest(cookie, bad);
    assert.equal(r.status, 400, String(bad).slice(0, 40));
    assert.deepEqual(r.body, { error: 'invalid-image' });
  }
  const huge = await suggest(cookie, `data:image/png;base64,${'A'.repeat(300 * 1024)}`);
  assert.deepEqual([huge.status, huge.body], [413, { error: 'image-too-large' }]);
  // a tiny file that claims gigantic dimensions must not be inflated
  const bomb = png(8, 8, () => [1, 2, 3, 255]);
  bomb.writeUInt32BE(60000, 16); bomb.writeUInt32BE(60000, 20);
  assert.equal((await suggest(cookie, dataUrl(bomb))).status, 413);
});

test('PNG reader: palette and greyscale images', () => {
  const pal = decodePng(png(4, 2, (x) => [x % 2], { colorType: 3, palette: [[255, 0, 0], [0, 0, 255]] }));
  assert.deepEqual([pal.width, pal.height], [4, 2]);
  assert.deepEqual(pal.at(0, 0), [255, 0, 0, 255]);
  assert.deepEqual(pal.at(1, 1), [0, 0, 255, 255]);
  const grey = decodePng(png(3, 3, (x, y) => [x * 100 + y], { colorType: 0, filter: 3 }));
  assert.deepEqual(grey.at(2, 1), [201, 201, 201, 255]);
});

test('pattern guess heuristics', () => {
  const p = (...list) => list.map(([rgb, share]) => ({ rgb, share }));
  assert.equal(guessPattern(p([[200, 120, 60], 0.9], [[250, 250, 250], 0.1])), 'solid');
  assert.equal(guessPattern(p([[250, 250, 250], 0.5], [[120, 120, 125], 0.5])), 'bicolor');
  assert.equal(guessPattern(p([[225, 205, 175], 0.7], [[70, 50, 40], 0.3])), 'pointed');
  assert.equal(guessPattern(p([[150, 120, 90], 0.6], [[90, 70, 50], 0.4])), 'tabby');
  assert.equal(guessPattern([]), 'solid');
});

// ---------- LGPD ----------
test('DELETE /api/me erases the account and everything attached to it', async () => {
  const a = await login('apagar@example.com');
  const b = await login('fica@example.com');
  await login('apagar@example.com');                               // second device
  await createCat(a.cookie);
  await createCat(b.cookie, { name: 'Fica' });
  await call(saveHandler, { method: 'PUT', url: '/api/save', cookie: a.cookie, body: { data: { level: 3 } } });
  await call(saveHandler, { method: 'PUT', url: '/api/save', cookie: b.cookie, body: { data: { level: 9 } } });
  await auth('start', { email: 'apagar@example.com' });            // a pending login code

  assert.equal((await call(meHandler, { method: 'DELETE', url: '/api/me' })).status, 401);
  assert.equal((await call(meHandler, { method: 'DELETE', url: '/api/me', cookie: a.cookie, origin: 'https://evil.example' })).status, 403);
  const r = await call(meHandler, { method: 'DELETE', url: '/api/me', cookie: a.cookie });
  assert.deepEqual([r.status, r.body], [200, { ok: true, deleted: true }]);
  assert.match(r.headers['set-cookie'], /Max-Age=0/);

  assert.equal((await call(meHandler, { url: '/api/me', cookie: a.cookie })).status, 401);
  const left = {};
  for (const t of ['vp_users', 'vp_login_codes', 'vp_sessions', 'vp_cats', 'vp_saves']) left[t] = await db.rows(t);
  assert.ok(!JSON.stringify(left).includes('apagar@example.com'));
  assert.ok(!JSON.stringify(left).includes(a.user.id));
  assert.deepEqual([left.vp_users.length, left.vp_sessions.length, left.vp_cats.length, left.vp_saves.length], [1, 1, 1, 1]);
  assert.equal((await call(catsActionHandler, { url: '/api/cats/public' })).body.cats.length, 1);

  const me = await call(meHandler, { url: '/api/me', cookie: b.cookie });
  assert.equal(me.body.cats[0].name, 'Fica');
  // the same email can sign up again and starts from scratch
  const again = await login('apagar@example.com');
  assert.notEqual(again.user.id, a.user.id);
  assert.deepEqual((await call(meHandler, { url: '/api/me', cookie: again.cookie })).body.cats, []);
});

// ---------- docs stay in sync ----------
test('db/schema.sql documents every table and index the code creates', async () => {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const code = await readFile(new URL('../api/_lib/db.js', import.meta.url), 'utf8');
  const names = [...code.matchAll(/create (?:table|index) if not exists (\w+)/g)].map((m) => m[1]);
  assert.equal(names.length, 19);   // 15 for accounts (+ vp_tokens, vp_guardians and 2 indexes) + vp_presence, vp_online_reports and their 2 indexes (Cidade Online)
  for (const n of names) assert.ok(schema.includes(`if not exists ${n} `), n);
  const columns = (src, table) => new RegExp(`create table if not exists ${table} \\(([\\s\\S]*?)\\)\\s*[;\`]`).exec(src)[1].replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
  for (const t of ['vp_login_codes', 'vp_sessions', 'vp_cats', 'vp_saves', 'vp_online_reports', 'vp_tokens', 'vp_guardians']) assert.equal(columns(schema, t), columns(code, t), t);
  // presence: unlogged first, a normal table as the fallback, the same columns in all three places
  const unlogged = (src) => columns(src.replace('create unlogged table', 'create table'), 'vp_presence');
  assert.equal(unlogged(schema), unlogged(code));
  assert.equal(columns(code, 'vp_presence'), unlogged(code));
});
