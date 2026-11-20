// Cidade Online — API tests (ticket + polling transport) with the in-memory neon() stand-in.
//   node --test tests/
// Set VP_TEST_PG_URL to run the same suite against a real (throwaway!) Postgres.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { __setSqlForTests } from '../api/_lib/db.js';
import onlineHandler, { __resetOnlineForTests } from '../api/online/[action].js';
import authHandler from '../api/auth/[action].js';
import catsHandler from '../api/cats/index.js';
import {
  NICK_RE, ID_RE, ROOM_RE, PHRASES, ROOM_CAP, MAX_PER_IP, MAX_SHARDS, MAX_ROOMS, MAX_REPORTS_HOUR, PAW_SLOT_MS, MAX_PLAYERS,
  nickname, signTicket, verifyTicket, chooseShard, pickShard, validateTick,
} from '../api/_lib/online.js';
import { createFakeBackend } from './helpers/fake-sql.mjs';
import { call } from './helpers/http.mjs';

let db, mails = [];
const realFetch = globalThis.fetch, realError = console.error;
const envKeys = ['DATABASE_URL', 'POSTGRES_URL', 'RESEND_API_KEY', 'AUTH_SECRET', 'ONLINE_TICKET_SECRET', 'ONLINE_ENABLED', 'ALLOWED_ORIGINS'];
const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

before(async () => {
  if (process.env.VP_TEST_PG_URL) {
    const { createPgBackend } = await import('./helpers/pg-wire.mjs');
    db = await createPgBackend(process.env.VP_TEST_PG_URL);
  } else db = createFakeBackend();
  console.error = () => {};
  globalThis.fetch = async (url, init) => { mails.push(JSON.parse(init.body)); return new Response('{"id":"m"}', { status: 200 }); };
});
beforeEach(async () => {
  for (const k of envKeys) delete process.env[k];
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ONLINE_TICKET_SECRET = 'test-secret';
  mails = [];
  await db.reset();
  __setSqlForTests(db.sql);
  __resetOnlineForTests();
});
after(async () => {
  globalThis.fetch = realFetch; console.error = realError;
  for (const k of envKeys) (savedEnv[k] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[k]));
  __setSqlForTests(null);
  await db.close();
});

// ---------- helpers ----------
const ticketReq = (query = '', opts = {}) => call(onlineHandler, { method: 'GET', url: `/api/online/ticket${query}`, ...opts });
const post = (action, body, opts = {}) => call(onlineHandler, { method: 'POST', url: `/api/online/${action}`, body, ...opts });
async function guest(query = '', opts = {}) {
  const r = await ticketReq(query, opts);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const STATE = { room: 'city', x: 1200, z: 800, ry: 1.5, anim: 'walk' };
let ipN = 0;
/** One tick as `who` (a ticket response). Each helper call comes from its own address unless told otherwise. */
const tick = (who, over = {}, opts = {}) => post('tick', { ticket: who.ticket, ...STATE, ...over }, { ip: `198.51.100.${++ipN % 250}`, ...opts });
/** Lets the next tick of everybody through (the 0.8 s limit is real time). */
async function settle(ms = 1000) { __resetOnlineForTests(); await db.agePresence(ms); }

async function login(email = 'dona@example.com') {
  const s = await call(authHandler, { method: 'POST', url: '/api/auth/start', body: { email, lang: 'pt' } });
  assert.equal(s.status, 200);
  const code = /: (\d{6})\n/.exec(mails.at(-1).text)[1];
  const v = await call(authHandler, { method: 'POST', url: '/api/auth/verify', body: { email, code } });
  return { cookie: String(v.headers['set-cookie']).split(';')[0], user: v.body.user };
}
const CAT = { name: 'Frajola', breed: 'srd', spec: { furBase: '#222222', pattern: 'tuxedo', patchColors: ['#ffffff'], accessories: ['bowtie'] } };

// ---------- ticket ----------
test('ticket: a guest gets a generated nickname, a public id and one of the three stars', async () => {
  const t = await guest('?cat=mimosa');
  assert.match(t.you.name, NICK_RE);
  assert.match(t.you.id, /^g[0-9a-f]{20}$/);
  assert.equal(t.you.guest, true);
  assert.deepEqual(t.cat, { star: 'mimosa' });
  const v = verifyTicket(t.ticket);
  assert.deepEqual({ id: v.id, name: v.name, userId: v.userId, cat: v.cat }, { id: t.you.id, name: t.you.name, userId: null, cat: { star: 'mimosa' } });
  assert.ok(t.exp * 1000 > Date.now() && t.exp * 1000 < Date.now() + 11 * 60e3, 'short lived');
});

test('ticket: nicknames come only from the safe lists', () => {
  for (let i = 0; i < 300; i++) assert.match(nickname(), NICK_RE);
  assert.equal(nickname('00aa11bb22cc33dd44ee'), nickname('00aa11bb22cc33dd44ee'), 'stable for an account');
  assert.match('Gato Veloz 123', NICK_RE);
  for (const bad of ['Gato Veloz', 'gato veloz 12', 'Gato Veloz 1234', 'Gato <b> 1', 'Fulano 12', 'Gato Veloz 12 x']) assert.doesNotMatch(bad, NICK_RE);
});

test('ticket: renewing keeps the guest id and nickname; a forged previous ticket does not', async () => {
  const a = await guest();
  const b = await guest('', { headers: { 'x-vp-ticket': a.ticket } });
  assert.deepEqual(b.you, a.you);
  const c = await guest('', { headers: { 'x-vp-ticket': a.ticket.slice(0, -3) + 'abc' } });
  assert.notEqual(c.you.id, a.you.id);
});

test('ticket: an expired ticket is refused by verify, but still renews the same guest for a day', async () => {
  const old = Date.now() - 30 * 60e3;
  const { ticket } = signTicket({ id: 'g' + '1'.repeat(20), name: 'Gato Veloz 7', cat: { star: 'mimo' } }, old);
  assert.equal(verifyTicket(ticket), null);
  const r = await guest('', { headers: { 'x-vp-ticket': ticket } });
  assert.equal(r.you.id, 'g' + '1'.repeat(20));
  const ancient = signTicket({ id: 'g' + '2'.repeat(20), name: 'Gato Veloz 7', cat: { star: 'mimo' } }, Date.now() - 3 * 86400e3).ticket;
  assert.notEqual((await guest('', { headers: { 'x-vp-ticket': ancient } })).you.id, 'g' + '2'.repeat(20));
  // a name that is not a generated nickname is never carried over to a guest
  const odd = signTicket({ id: 'g' + '3'.repeat(20), name: 'Texto Livre', cat: { star: 'mimo' } }).ticket;
  assert.match((await guest('', { headers: { 'x-vp-ticket': odd } })).you.name, NICK_RE);
});

test('ticket: the look is whitelisted (star or gallery Spec); anything else is 400', async () => {
  assert.equal((await ticketReq('?cat=dog')).status, 400);
  const spec = encodeURIComponent(JSON.stringify({ furBase: '#ABC', pattern: 'tabby', accessories: ['hat'], name: 'x', evil: '<script>' }));
  const ok = await guest(`?spec=${spec}`);
  assert.deepEqual(ok.cat.spec, { size: 1, faceShape: 'round', furBase: '#aabbcc', pattern: 'tabby', patchColors: [], eyeColor: '#7bc86c', accessories: ['hat'] });
  assert.match(ok.you.name, NICK_RE, 'a cat made on the device never brings its typed name');
  assert.equal((await ticketReq(`?spec=${encodeURIComponent('{"pattern":"<img>"}')}`)).status, 400);
  assert.equal((await ticketReq('?spec=%7Bnope')).status, 400);
});

test('ticket: a logged-in player shows the name and look of a registered cat; the e-mail and the account id never appear', async () => {
  const { cookie, user } = await login();
  const made = await call(catsHandler, { method: 'POST', url: '/api/cats', cookie, body: CAT });
  assert.equal(made.status, 201);
  const t = await guest(`?catId=${made.body.cat.id}`, { cookie });
  assert.equal(t.you.name, 'Frajola');
  assert.equal(t.you.guest, false);
  assert.match(t.you.id, /^u[0-9a-f]{20}$/);
  assert.equal(t.cat.spec.pattern, 'tuxedo');
  const text = JSON.stringify({ you: t.you, cat: t.cat });
  assert.ok(!text.includes(user.id) && !text.includes('dona@example.com'));
  assert.equal(verifyTicket(t.ticket).userId, user.id, 'the account id travels only inside the signed ticket, for reports');
  // no cat chosen: a nickname, stable for the account
  const n1 = await guest('?cat=mimo', { cookie }), n2 = await guest('?cat=mimo', { cookie });
  assert.match(n1.you.name, NICK_RE);
  assert.deepEqual(n1.you, n2.you);
  // somebody else's cat, a guest asking for a cat, a malformed id
  const other = await login('outra@example.com');
  assert.equal((await ticketReq(`?catId=${made.body.cat.id}`, { cookie: other.cookie })).status, 404);
  assert.equal((await ticketReq(`?catId=${made.body.cat.id}`)).status, 401);
  assert.equal((await ticketReq('?catId=123', { cookie })).status, 400);
});

test('ticket: guests work without a database when the VM secret is set; nothing configured is 503; kill switch is 503', async () => {
  __setSqlForTests(null);
  assert.equal((await ticketReq()).status, 200);
  delete process.env.ONLINE_TICKET_SECRET;
  assert.deepEqual((await ticketReq()).body, { error: 'offline' });
  process.env.ONLINE_TICKET_SECRET = 'x'; process.env.ONLINE_ENABLED = 'false';
  assert.equal((await ticketReq()).status, 503);
  __setSqlForTests(db.sql);
  assert.equal((await post('tick', { ...STATE, ticket: 'x' })).status, 503);
});

test('ticket: signed with the shared key, so another key (or a tampered payload) fails', async () => {
  const t = await guest();
  assert.ok(verifyTicket(t.ticket));
  const [payload, mac] = t.ticket.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), n: 'Nome Livre' })).toString('base64url');
  assert.equal(verifyTicket(`${forged}.${mac}`), null);
  process.env.ONLINE_TICKET_SECRET = 'another';
  assert.equal(verifyTicket(t.ticket), null);
  for (const junk of [undefined, null, '', 'a.b', 42, 'x'.repeat(2000)]) assert.equal(verifyTicket(junk), null);
});

// ---------- tick ----------
test('tick: needs a valid ticket and the game origin; without a database it is 503', async () => {
  assert.deepEqual((await post('tick', STATE)).body, { error: 'ticket' });
  assert.equal((await post('tick', { ...STATE, ticket: 'abc.def' })).status, 401);
  const a = await guest();
  assert.equal((await post('tick', { ...STATE, ticket: a.ticket }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await call(onlineHandler, { method: 'PUT', url: '/api/online/tick', body: {} })).status, 405);
  assert.equal((await post('nope', { ticket: a.ticket })).status, 404);
  __setSqlForTests(null);
  assert.deepEqual((await tick(a)).body, { error: 'offline' });
});

test('tick: two players in the same map land in the same instance and see each other', async () => {
  const a = await guest('?cat=mimo'), b = await guest('?cat=morticia');
  const ra = await tick(a);
  assert.equal(ra.status, 200, JSON.stringify(ra.body));
  assert.equal(ra.body.room, 'city#1');
  assert.deepEqual(ra.body.others, []);
  assert.equal(ra.body.n, 1);
  assert.deepEqual(ra.body.you, { id: a.you.id });
  assert.ok(Math.abs(ra.body.ts - Date.now()) < 5000);
  assert.deepEqual(ra.body.paw, { slot: Math.floor(ra.body.ts / PAW_SLOT_MS), ms: PAW_SLOT_MS, n: 6 });

  const rb = await tick(b, { x: 1300.4, z: 900.6, ry: 7.5, anim: 'idle' });
  assert.equal(rb.body.room, 'city#1');
  assert.equal(rb.body.others.length, 1);
  const o = rb.body.others[0];
  assert.deepEqual({ id: o.id, x: o.x, z: o.z, anim: o.anim }, { id: a.you.id, x: 1200, z: 800, anim: 'walk' });
  assert.ok(Math.abs(o.ry - 1.5) < 0.001);
  assert.ok(o.age >= 0 && o.age < 3000);
  assert.equal(typeof o.cv, 'string');
  assert.equal(o.name, undefined, 'name and look only come when asked for');
  assert.equal(o.cat, undefined);

  await settle();
  const again = await tick(b, { room: rb.body.room, need: [a.you.id], x: 1300.4, z: 900.6, ry: 7.5 });
  assert.equal(again.body.others[0].name, a.you.name);
  assert.deepEqual(again.body.others[0].cat, { star: 'mimo' });
  // only whitelisted fields ever leave the server
  for (const k of Object.keys(again.body.others[0])) assert.ok(['id', 'name', 'x', 'z', 'ry', 'anim', 'car', 'cv', 'emote', 'es', 'phrase', 'ps', 'paws', 'age', 'cat', 'trade'].includes(k), k);
  const row = (await db.rows('vp_presence')).find((r) => r.id === b.you.id);
  assert.equal(row.x, 1300);
  assert.equal(row.z, 901);
  assert.ok(Math.abs(row.ry - (7.5 - 2 * Math.PI)) < 0.01, 'heading wrapped to -pi..pi');
});

test('tick: other maps and other instances are other rooms', async () => {
  const a = await guest(), b = await guest(), c = await guest();
  await tick(a, { room: 'city' });
  const rb = await tick(b, { room: 'rio' });
  assert.equal(rb.body.room, 'rio#1');
  assert.deepEqual(rb.body.others, []);
  const rc = await tick(c, { room: 'city#2' });
  assert.equal(rc.body.room, 'city#2');
  assert.deepEqual(rc.body.others, []);
  // moving to another map moves the single presence row
  await settle();
  const moved = await tick(a, { room: 'rio' });
  assert.equal(moved.body.room, 'rio#1');
  assert.equal(moved.body.others.length, 1);
  assert.equal((await db.rows('vp_presence')).filter((r) => r.id === a.you.id).length, 1);
});

test('tick: emote, quick phrase (index only), car and paws travel; free text does not exist', async () => {
  const a = await guest(), b = await guest();
  const slot = Math.floor(Date.now() / PAW_SLOT_MS);
  const ra = await tick(a, { anim: 'car', car: 'taxi', emote: 'dance', es: 3, phrase: 2, ps: 9, paws: { s: slot, i: [4, 1, 4] }, name: 'Nome <b>livre</b>', text: 'oi sou eu', cat: 'morticia' });
  assert.equal(ra.status, 200, JSON.stringify(ra.body));
  const o = (await tick(b, { need: [a.you.id] })).body.others[0];
  assert.deepEqual({ car: o.car, emote: o.emote, es: o.es, phrase: o.phrase, ps: o.ps, paws: o.paws }, { car: 'taxi', emote: 'dance', es: 3, phrase: 2, ps: 9, paws: { s: slot, i: [1, 4] } });
  assert.equal(o.name, a.you.name, 'the name is the one in the ticket');
  assert.deepEqual(o.cat, { star: 'mimo' }, 'and so is the look');
  assert.ok(!JSON.stringify(await db.rows('vp_presence')).includes('livre'));
  // paws of a stale slot are dropped
  assert.equal(validateTick({ ...STATE, paws: { s: slot - 5, i: [1] } }).paws, null);
});

test('tick: validation', async () => {
  const a = await guest();
  const bad = async (over, field, status = 400) => {
    __resetOnlineForTests();
    const r = await tick(a, over);
    assert.equal(r.status, status, JSON.stringify(over) + ' -> ' + JSON.stringify(r.body));
    if (field) assert.equal(r.body.field, field);
  };
  await bad({ room: 'Rio' }, 'room');
  await bad({ room: 'rio#0' }, 'room');
  await bad({ room: `rio#${MAX_SHARDS + 1}` }, 'room');
  await bad({ room: "city'; drop table vp_users;--" }, 'room');
  await bad({ room: 42 }, 'room');
  await bad({ x: '10' }, 'x');
  await bad({ x: 1e9 }, 'x');
  await bad({ z: null }, 'z');
  await bad({ z: NaN }, 'z');
  await bad({ ry: Infinity }, 'ry');
  await bad({ anim: 'fly' }, 'anim');
  await bad({ anim: 'car' }, 'car');
  await bad({ anim: 'car', car: 'tank' }, 'car');
  await bad({ emote: 'rude' }, 'emote');
  await bad({ phrase: PHRASES }, 'phrase');
  await bad({ phrase: 'Oi!' }, 'phrase');
  await bad({ phrase: 1.5 }, 'phrase');
  await bad({ paws: { s: 1, i: [99] } }, 'paws');
  await bad({ paws: 'all' }, 'paws');
  await bad({ need: ['x'] }, 'need');
  await bad({ need: 'g' + '0'.repeat(20) }, 'need');
  await bad({ junk: 'x'.repeat(3000) }, undefined, 413);
  assert.equal((await db.rows('vp_presence')).length, 0, 'nothing invalid was stored');
});

test('tick: at most one per 0.8 s per player, in memory and in the database', async () => {
  const a = await guest(), b = await guest();
  assert.equal((await tick(a)).status, 200);
  const fast = await tick(a, { x: 5000 });
  assert.equal(fast.status, 429);
  assert.equal(fast.body.error, 'rate-limit');
  assert.ok(fast.body.retryAfterMs > 0 && fast.body.retryAfterMs <= 800);
  assert.equal((await tick(b)).status, 200, 'the limit is per player');
  // another function instance (no memory of the last tick): the upsert itself refuses
  __resetOnlineForTests();
  const fast2 = await tick(a, { x: 5000 });
  assert.equal(fast2.status, 429);
  assert.equal((await db.rows('vp_presence')).find((r) => r.id === a.you.id).x, 1200, 'the row was not touched');
  await settle(900);
  assert.equal((await tick(a, { x: 5000 })).status, 200);
});

test('tick: others are the states of the last 10 s; rows older than 30 s are deleted', async () => {
  const a = await guest(), b = await guest();
  const room = (await tick(a)).body.room;
  await settle(5000);
  assert.equal((await tick(b, { room })).body.others.length, 1);
  await settle(6000);                                   // a is now 11 s old, b 6 s
  assert.deepEqual((await tick(b, { room })).body.others, []);
  assert.equal((await db.rows('vp_presence')).length, 2, 'still in the table until the cleanup');
  await settle(25000);                                  // a: 36 s
  const r = await tick(b, { room });                    // this tick runs the cleanup first
  assert.equal(r.status, 200);
  assert.deepEqual((await db.rows('vp_presence')).map((p) => p.id), [b.you.id]);
});

test('tick: an instance takes 30 players, the 31st opens the next one', async () => {
  const players = [];
  for (let i = 0; i < ROOM_CAP + 1; i++) players.push(await guest());
  let last;
  for (let i = 0; i < ROOM_CAP; i++) { last = await tick(players[i], { room: 'rio', x: i }); assert.equal(last.body.room, 'rio#1'); }
  assert.equal(last.body.n, ROOM_CAP);
  const extra = await tick(players[ROOM_CAP], { room: 'rio' });
  assert.equal(extra.body.room, 'rio#2');
  assert.deepEqual(extra.body.others, []);
});

test('tick: caps on rooms, players and presences per address', async () => {
  const full = new Map();
  for (let k = 1; k <= MAX_SHARDS; k++) full.set(`rio#${k}`, ROOM_CAP);
  assert.equal(chooseShard('rio', full), null);
  assert.equal(chooseShard('paris', full), 'paris#1');
  const many = new Map();
  for (let i = 0; i < MAX_ROOMS; i++) many.set(`c${i}#1`, 1);
  assert.equal(chooseShard('paris', many), null, 'no more rooms than the cap');
  assert.equal(chooseShard('c5', many), 'c5#1', 'but existing rooms still take players');
  assert.throws(() => pickShard('rio', [{ room: 'a#1', n: MAX_PLAYERS }]), (e) => e.status === 503 && e.body.error === 'busy');

  const same = { ip: '203.0.113.99' };
  for (let i = 0; i < MAX_PER_IP; i++) assert.equal((await tick(await guest(), {}, same)).status, 200);
  const r = await tick(await guest(), {}, same);
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'too-many');
  assert.equal((await tick(await guest())).status, 200, 'another address is fine');
  assert.ok(!JSON.stringify(await db.rows('vp_presence')).includes('203.0.113.99'), 'addresses are only stored hashed');
});

test('tick: an idle player reads the room without writing; the row is only re-stamped every 5 s', async () => {
  const a = await guest(), b = await guest();
  const room = (await tick(a)).body.room;
  await tick(b, { room });
  const stampOf = async (id) => new Date((await db.rows('vp_presence')).find((r) => r.id === id).updated_at).getTime();
  await settle(2000);
  const s0 = await stampOf(a.you.id);
  const r1 = await tick(a, { room, idle: true, x: 99999 });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.others.length, 1, 'still sees the others');
  assert.equal(r1.body.room, room);
  assert.equal(await stampOf(a.you.id), s0, 'no write');
  assert.equal((await db.rows('vp_presence')).find((r) => r.id === a.you.id).x, 1200, 'an idle tick never moves the cat');
  await settle(4000);                                   // the row is now 6 s old
  assert.equal((await tick(a, { room, idle: true })).status, 200);
  assert.ok(await stampOf(a.you.id) > s0, 're-stamped, so the cat stays visible');
  await settle(1000);
  assert.equal((await tick(b, { room, x: 1 })).body.others.length, 1, 'b still sees the idle a');
  // the in-memory limit also covers idle ticks
  assert.equal((await tick(a, { room, idle: true })).status, 200);
  assert.equal((await tick(a, { room, idle: true })).status, 429);
  // no row any more (expired and swept): the idle tick becomes a normal one
  await settle(40000);
  await tick(b, { room });
  const back = await tick(a, { room, idle: true, x: 4321 });
  assert.equal(back.status, 200);
  assert.equal((await db.rows('vp_presence')).find((r) => r.id === a.you.id).x, 4321);
});

test('ticket: outfit and level badge travel inside the look; both are bounded and never text', async () => {
  const t = await guest('?cat=mimosa&wear=cap_teal,sailor,cap_teal&lv=12');
  assert.deepEqual(t.cat, { star: 'mimosa', wear: ['cap_teal', 'sailor'], lv: 12 });
  assert.deepEqual(verifyTicket(t.ticket).cat, t.cat);
  for (const q of ['?wear=a,b,c,d,e,f,g', '?wear=Oi%20tudo%20bem', '?wear=%3Cb%3E', '?lv=0', '?lv=101', '?lv=1.5', '?lv=abc']) assert.equal((await ticketReq(q)).status, 400, q);
});

test('trade: an offer is an item id addressed to one cat, and only that cat sees it', async () => {
  const a = await guest(), b = await guest(), c = await guest();
  const room = (await tick(a)).body.room;
  await tick(b, { room }); await tick(c, { room });
  await settle();
  assert.equal((await tick(a, { room, trade: { to: b.you.id, give: 'cap_teal', st: 0 } })).status, 200);
  const seenByB = (await tick(b, { room })).body.others.find((o) => o.id === a.you.id);
  assert.deepEqual(seenByB.trade, { to: b.you.id, st: 0, give: 'cap_teal' });
  const seenByC = (await tick(c, { room })).body.others.find((o) => o.id === a.you.id);
  assert.equal(seenByC.trade, undefined);
  await settle();
  assert.equal((await tick(a, { room, trade: { to: b.you.id, give: null, st: 1 } })).status, 200, 'a gift (nothing asked back) is fine');
  assert.deepEqual((await tick(b, { room, idle: true })).body.others.find((o) => o.id === a.you.id).trade, { to: b.you.id, st: 1, give: null });
  for (const bad of [{ to: b.you.id, give: 'me passa seu zap', st: 0 }, { to: 'x', give: 'cap_teal', st: 0 }, { to: b.you.id, give: 'cap_teal', st: 7 }, 'trade', { to: b.you.id, give: { id: 1 }, st: 0 }]) {
    await settle();
    const r = await tick(a, { room, trade: bad });
    assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(r.body.field, 'trade');
  }
});

// ---------- report / leave ----------
test('report: stored for review with what the reported cat looked like; fixed reasons only', async () => {
  const { cookie, user } = await login();
  const made = await call(catsHandler, { method: 'POST', url: '/api/cats', cookie, body: CAT });
  const a = await guest(`?catId=${made.body.cat.id}`, { cookie }), b = await guest();
  const room = (await tick(a)).body.room;
  await tick(b, { room });
  const r = await post('report', { ticket: b.ticket, targetId: a.you.id, reason: 'name', room });
  assert.deepEqual(r.body, { ok: true, stored: true });
  const rows = await db.rows('vp_online_reports');
  assert.equal(rows.length, 1);
  assert.deepEqual({ reporter: rows[0].reporter_id, target: rows[0].target_id, name: rows[0].target_name, user: rows[0].target_user_id, room: rows[0].room, reason: rows[0].reason, source: rows[0].source },
    { reporter: b.you.id, target: a.you.id, name: 'Frajola', user: user.id, room: 'city#1', reason: 'name', source: 'poll' });
  assert.equal(rows[0].target_cat.spec.pattern, 'tuxedo');
  // same target again within the hour: accepted, not stored twice
  assert.deepEqual((await post('report', { ticket: b.ticket, targetId: a.you.id, reason: 'behavior' })).body, { ok: true, stored: false });
  // a target that already left is still recorded
  assert.equal((await post('report', { ticket: b.ticket, targetId: 'g' + 'a'.repeat(20), reason: 'other' })).body.stored, true);

  assert.equal((await post('report', { ticket: b.ticket, targetId: a.you.id, reason: 'ele é chato' })).body.field, 'reason');
  assert.equal((await post('report', { ticket: b.ticket, targetId: 'x', reason: 'name' })).body.field, 'targetId');
  assert.equal((await post('report', { ticket: b.ticket, targetId: b.you.id, reason: 'name' })).status, 400, 'not yourself');
  assert.equal((await post('report', { targetId: a.you.id, reason: 'name' })).status, 401);
  assert.equal((await post('report', { ticket: b.ticket, targetId: a.you.id, reason: 'name' }, { origin: 'https://evil.example' })).status, 403);
});

test('report: at most 10 per hour per reporter', async () => {
  const b = await guest();
  const id = (i) => 'g' + String(i).padStart(20, '0');
  for (let i = 0; i < MAX_REPORTS_HOUR; i++) assert.equal((await post('report', { ticket: b.ticket, targetId: id(i), reason: 'cheat' })).body.stored, true);
  assert.equal((await post('report', { ticket: b.ticket, targetId: id(99), reason: 'cheat' })).body.stored, false);
  assert.equal((await db.rows('vp_online_reports')).length, MAX_REPORTS_HOUR);
});

test('leave: removes the presence at once', async () => {
  const a = await guest(), b = await guest();
  await tick(a); await tick(b);
  assert.deepEqual((await post('leave', { ticket: a.ticket })).body, { ok: true });
  assert.deepEqual((await db.rows('vp_presence')).map((p) => p.id), [b.you.id]);
  assert.equal((await post('leave', {})).status, 401);
});

// ---------- content ----------
test('content: phrases, rooms and the feature flags', async () => {
  const i18n = await readFile(new URL('../public/js/i18n.js', import.meta.url), 'utf8');
  for (let i = 0; i < PHRASES; i++) assert.match(i18n, new RegExp(`\\bon_p${i}: \\['[^']+', '[^']+'\\]`), `on_p${i} in pt and en`);
  assert.ok(!new RegExp(`\\bon_p${PHRASES}:`).test(i18n), 'no phrase beyond the server list');
  const idx = JSON.parse(await readFile(new URL('../public/data/cities/index.json', import.meta.url), 'utf8'));
  for (const c of [...idx.cities, ...(idx.soon || [])]) if (c.id) assert.match(c.id, ROOM_RE, c.id);
  assert.match('city', ROOM_RE);
  const cfg = JSON.parse(await readFile(new URL('../public/data/online.json', import.meta.url), 'utf8'));
  assert.equal(typeof cfg.enabled, 'boolean');
  assert.deepEqual(cfg, { enabled: cfg.enabled, maxPerRoom: ROOM_CAP, maxRooms: MAX_ROOMS, tickMs: 1500, pollingEnabled: true, wsUrl: '' },
    'the numbers shown by the client are the ones the server enforces; no real-time server is configured in the repository');
  assert.match('g' + '0'.repeat(20), ID_RE);
});
