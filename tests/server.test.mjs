// Cidade Online — the real-time server (server/index.mjs), run in-process on a random port.
// Needs the server's dependency:  npm --prefix server install   (skipped when `ws` is not installed)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as pjoin } from 'node:path';
import { signTicket, ROOM_CAP, MAX_PER_IP, MAX_SPEED, PAW_SLOT_MS } from '../server/lib/protocol.mjs';

let WebSocket, createOnlineServer, createReportSink, skip = false;
try {
  ({ WebSocket } = await import('../server/node_modules/ws/wrapper.mjs'));
  ({ createOnlineServer, createReportSink } = await import('../server/index.mjs'));
} catch { skip = 'ws is not installed (npm --prefix server install)'; }

let app, port, reports = [], clock = 0, n = 0;
const ORIGIN = 'https://vice-paws.vercel.app';
const savedSecret = process.env.ONLINE_TICKET_SECRET;

before(async () => {
  if (skip) return;
  process.env.ONLINE_TICKET_SECRET = 'test-secret';
  app = createOnlineServer({ reportSink: async (r) => { reports.push(r); }, trustProxy: true, log: { error() {} }, now: () => Date.now() + clock });
  port = await app.listen(0, '127.0.0.1');
});
after(async () => {
  if (app) await app.close();
  if (savedSecret === undefined) delete process.env.ONLINE_TICKET_SECRET; else process.env.ONLINE_TICKET_SECRET = savedSecret;
});

const ticketFor = (name, over = {}) => signTicket({ id: 'g' + String(++n).padStart(20, '0'), name, cat: { star: 'mimo' }, ...over }).ticket;
/** A test client: collects every message and lets the test wait for one. */
function open({ origin = ORIGIN, ip } = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { origin, 'x-forwarded-for': ip || `198.51.100.${++n % 250}` } });
  const c = { ws, msgs: [], waiters: [], closed: null };
  ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.msgs.push(m); c.waiters = c.waiters.filter((w) => !w(m)); });
  ws.on('close', (code) => { c.closed = code; });
  ws.on('error', (e) => { c.error = e; });
  c.opened = new Promise((res) => { ws.on('open', () => res(true)); ws.on('error', () => res(false)); ws.on('unexpected-response', (_q, r) => { c.http = r.statusCode; res(false); }); });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.wait = (pred, ms = 2000) => new Promise((res, rej) => {
    const hit = c.msgs.find(pred); if (hit) return res(hit);
    const timer = setTimeout(() => rej(new Error('timeout waiting for a message; got ' + JSON.stringify(c.msgs.slice(-4)))), ms);
    c.waiters.push((m) => { if (pred(m)) { clearTimeout(timer); res(m); return true; } return false; });
  });
  c.end = () => new Promise((res) => { if (c.closed !== null) return res(); ws.on('close', res); ws.close(); });
  return c;
}
async function join(name, room = 'city', at = { x: 1000, z: 1000 }, opts = {}) {
  const c = open(opts);
  assert.equal(await c.opened, true);
  c.send({ t: 'hello', ticket: opts.ticket || ticketFor(name), room });
  c.welcome = await c.wait((m) => m.t === 'welcome' || m.t === 'error');
  assert.equal(c.welcome.t, 'welcome', JSON.stringify(c.welcome));
  if (at) c.send({ t: 's', x: at.x, z: at.z, ry: 0, a: 'idle' });
  return c;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('health answers with numbers only', { skip }, async () => {
  const r = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(Object.keys(j).sort(), ['hz', 'ok', 'players', 'rooms', 'uptime']);
  assert.equal(j.ok, true);
  assert.equal((await fetch(`http://127.0.0.1:${port}/nope`)).status, 404);
});

test('only the game may connect, and only with a valid ticket', { skip }, async () => {
  const evil = open({ origin: 'https://evil.example' });
  assert.equal(await evil.opened, false);
  assert.equal(evil.http, 403);
  for (const ticket of ['nope', undefined, signTicket({ id: 'g' + '9'.repeat(20), name: 'Gato Veloz 1', cat: { star: 'mimo' } }, Date.now() - 3600e3).ticket]) {
    const c = open(); await c.opened;
    c.send({ t: 'hello', ticket, room: 'city' });
    assert.deepEqual(await c.wait((m) => m.t === 'error'), { t: 'error', error: 'ticket' });
    await c.end();
  }
  const c = open(); await c.opened;
  c.send({ t: 'hello', ticket: ticketFor('Gato Veloz 2'), room: 'Not A Room' });
  assert.equal((await c.wait((m) => m.t === 'error')).error, 'room');
  await c.end();
  // a ticket signed with another key
  process.env.ONLINE_TICKET_SECRET = 'other'; const forged = ticketFor('Gato Veloz 3'); process.env.ONLINE_TICKET_SECRET = 'test-secret';
  const d = open(); await d.opened;
  d.send({ t: 'hello', ticket: forged, room: 'city' });
  assert.equal((await d.wait((m) => m.t === 'error')).error, 'ticket');
  await d.end();
});

test('two cats in the same map share a room: roster, join, 10 Hz snapshots, leave', { skip }, async () => {
  const a = await join('Gato Veloz 10', 'rio', { x: 500, z: 600 });
  assert.equal(a.welcome.room, 'rio#1');
  assert.equal(a.welcome.hz, 10);
  assert.deepEqual(a.welcome.players, []);
  assert.equal(a.welcome.you.name, 'Gato Veloz 10');
  await sleep(50);
  const b = await join('Gata Neon 11', 'rio', { x: 700, z: 600 });
  assert.equal(b.welcome.room, 'rio#1');
  assert.deepEqual(b.welcome.players.map((p) => [p.name, p.x, p.z, p.cat]), [['Gato Veloz 10', 500, 600, { star: 'mimo' }]]);
  const j = await a.wait((m) => m.t === 'join');
  assert.deepEqual([j.p.name, j.p.x, j.p.z], ['Gata Neon 11', 700, 600]);
  assert.deepEqual(Object.keys(j.p).sort(), ['a', 'car', 'cat', 'id', 'k', 'name', 'ry', 'x', 'z'], 'nothing else about a player is ever sent');

  b.send({ t: 's', x: 720, z: 610, ry: 1.57, a: 'walk' });
  const snap = await a.wait((m) => m.t === 'snap' && m.p.some((p) => p[0] === b.welcome.you.k && p[1] === 720));
  assert.deepEqual(snap.p.find((p) => p[0] === b.welcome.you.k), [b.welcome.you.k, 720, 610, 157, 1, 0]);
  assert.ok(Math.abs(snap.ts - Date.now()) < 3000);
  // driving
  b.send({ t: 's', x: 730, z: 610, ry: 0, a: 'car', car: 'taxi' });
  const drive = await a.wait((m) => m.t === 'snap' && m.p.some((p) => p[0] === b.welcome.you.k && p[4] === 3));
  assert.equal(drive.p.find((p) => p[0] === b.welcome.you.k)[5], 4);   // CARS.indexOf('taxi') + 1

  // snapshots keep coming about ten times a second while somebody moves
  const before = a.msgs.filter((m) => m.t === 'snap').length;
  for (let i = 0; i < 10; i++) { b.send({ t: 's', x: 730 + i * 5, z: 610, ry: 0, a: 'walk' }); await sleep(100); }
  const got = a.msgs.filter((m) => m.t === 'snap').length - before;
  assert.ok(got >= 7 && got <= 12, 'snapshots in 1 s: ' + got);

  await b.end();
  assert.equal((await a.wait((m) => m.t === 'leave')).k, b.welcome.you.k);
  await a.end();
  await sleep(50);
  assert.equal(app.stats().players, 0);
  assert.equal(app.stats().rooms, 0);
});

test('movement is bounded: a teleporting client is shown moving at most at MAX_SPEED', { skip }, async () => {
  const a = await join('Gato Veloz 20', 'paris', { x: 0, z: 0 }), b = await join('Gato Veloz 21', 'paris', { x: 100, z: 0 });
  await a.wait((m) => m.t === 'join');
  await sleep(200);
  b.send({ t: 's', x: 50000, z: 0, ry: 0, a: 'walk' });
  const snap = await a.wait((m) => m.t === 'snap' && m.p.some((p) => p[0] === b.welcome.you.k && p[1] !== 100));
  const x = snap.p.find((p) => p[0] === b.welcome.you.k)[1];
  assert.ok(x > 100 && x < 100 + MAX_SPEED * 0.6 + 30, 'x = ' + x);
  // absurd coordinates and junk are ignored or clamped, never broadcast as they came
  b.send({ t: 's', x: 1e12, z: 'here', ry: 0 }); b.send({ t: 's', x: NaN, z: 1 }); b.send('not json'); b.send([1, 2]); b.send({ t: 'nope' });
  await sleep(250);
  assert.ok(a.msgs.filter((m) => m.t === 'snap').every((m) => m.p.every((p) => p.every((v) => Number.isFinite(v) && Math.abs(v) < 60000))));
  await a.end(); await b.end();
});

test('emotes and quick phrases are fixed lists; text never travels', { skip }, async () => {
  const a = await join('Gato Veloz 30', 'city'), b = await join('Gato Veloz 31', 'city');
  await a.wait((m) => m.t === 'join');
  b.send({ t: 'e', k: 'dance' });
  assert.deepEqual(await a.wait((m) => m.t === 'e'), { t: 'e', k: b.welcome.you.k, e: 'dance' });
  b.send({ t: 'p', i: 3 });
  assert.deepEqual(await a.wait((m) => m.t === 'p'), { t: 'p', k: b.welcome.you.k, i: 3 });
  const count = a.msgs.length;
  for (const bad of [{ t: 'p', i: 'Oi, qual seu nome?' }, { t: 'p', i: 99 }, { t: 'p', i: 1, text: 'me chama no zap' }, { t: 'e', k: 'rude' }, { t: 'chat', text: 'oi' }, { t: 'p', i: 2.5 }]) b.send(bad);
  await sleep(250);
  // the only thing that got through is nothing: {t:'p', i:1, text} is inside the phrase cooldown, and its text would be dropped anyway
  assert.deepEqual(a.msgs.slice(count).filter((m) => m.t === 'p' || m.t === 'e' || m.t === 'chat'), []);
  await sleep(1300);
  b.send({ t: 'p', i: 1, text: 'me chama no zap' });
  assert.deepEqual(await a.wait((m) => m.t === 'p' && m.i === 1), { t: 'p', k: b.welcome.you.k, i: 1 });
  assert.ok(!JSON.stringify(a.msgs).includes('zap'));
  await a.end(); await b.end();
});

test('trade offers reach only the addressed cat, as item ids', { skip }, async () => {
  const a = await join('Gato Veloz 70', 'recife'), b = await join('Gato Veloz 71', 'recife'), c = await join('Gato Veloz 72', 'recife');
  await sleep(100);
  a.send({ t: 'tr', to: b.welcome.you.id, give: 'cap_teal', st: 0 });
  assert.deepEqual(await b.wait((m) => m.t === 'tr'), { t: 'tr', k: a.welcome.you.k, to: b.welcome.you.id, give: 'cap_teal', st: 0 });
  a.send({ t: 'tr', to: b.welcome.you.id, give: 'me chama no zap', st: 0 }); a.send({ t: 'tr', to: 'nobody', give: 'cap_teal', st: 0 });
  await sleep(200);
  assert.equal(b.msgs.filter((m) => m.t === 'tr').length, 1);
  assert.equal(c.msgs.filter((m) => m.t === 'tr').length, 0);
  await a.end(); await b.end(); await c.end();
});

test('golden paws are shared: the first cat gets it, the room sees it gone, a new slot brings them back', { skip }, async () => {
  const a = await join('Gato Veloz 40', 'miami'), b = await join('Gato Veloz 41', 'miami');
  assert.deepEqual(a.welcome.paw, { slot: Math.floor((Date.now() + clock) / PAW_SLOT_MS), ms: PAW_SLOT_MS, n: 6, taken: [] });
  a.send({ t: 'paw', i: 2 });
  assert.equal((await a.wait((m) => m.t === 'pawok')).i, 2);
  assert.deepEqual((await b.wait((m) => m.t === 'paw')).taken, [2]);
  b.send({ t: 'paw', i: 2 }); b.send({ t: 'paw', i: 99 }); b.send({ t: 'paw', i: 4 });
  assert.equal((await b.wait((m) => m.t === 'pawok')).i, 4, 'the taken one was refused, the free one granted');
  const late = await join('Gato Veloz 42', 'miami');
  assert.deepEqual(late.welcome.paw.taken.sort(), [2, 4]);
  clock += PAW_SLOT_MS;
  const fresh = await late.wait((m) => m.t === 'paw' && m.taken.length === 0, 3000);
  assert.equal(fresh.slot, a.welcome.paw.slot + 1);
  await a.end(); await b.end(); await late.end();
});

test('report: stored with the reported cat, fixed reasons, once per target', { skip }, async () => {
  reports = [];
  const uid = '7b0c1f0e-1111-4222-8333-444455556666';
  const a = await join('Frajola', 'city', { x: 1, z: 1 }, { ticket: signTicket({ id: 'u' + 'a'.repeat(20), name: 'Frajola', userId: uid, cat: { spec: { pattern: 'tuxedo' } } }).ticket });
  const b = await join('Gato Veloz 51', 'city');
  b.send({ t: 'report', id: a.welcome.you.id, reason: 'name' });
  assert.deepEqual(await b.wait((m) => m.t === 'reported'), { t: 'reported', ok: true });
  await sleep(50);
  assert.equal(reports.length, 1);
  assert.deepEqual({ ...reports[0], created_at: null }, { reporter_id: b.welcome.you.id, target_id: a.welcome.you.id, target_name: 'Frajola', target_cat: { spec: { pattern: 'tuxedo' } },
    target_user_id: uid, room: 'city#1', reason: 'name', source: 'ws', created_at: null });
  for (const bad of [{ id: a.welcome.you.id, reason: 'name' }, { id: a.welcome.you.id, reason: 'texto livre' }, { id: b.welcome.you.id, reason: 'name' }, { id: 'x', reason: 'name' }]) b.send({ t: 'report', ...bad });
  await sleep(150);
  assert.equal(reports.length, 1, 'duplicates, free-text reasons, self-reports and bad ids are not stored');
  await a.end(); await b.end();
});

test('report sink: without DATABASE_URL reports go to a JSON-lines file', { skip }, async () => {
  const dir = await mkdtemp(pjoin(tmpdir(), 'vp-reports-'));
  const sink = createReportSink({ databaseUrl: '', file: pjoin(dir, 'log/reports.jsonl') });
  assert.equal(await sink({ reporter_id: 'g1', target_id: 'g2', reason: 'other' }), 'file');
  assert.equal(await sink({ reporter_id: 'g1', target_id: 'g3', reason: 'name' }), 'file');
  const lines = (await readFile(pjoin(dir, 'log/reports.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.target_id), ['g2', 'g3']);
  // a database that cannot be reached falls back to the file instead of losing the report
  const broken = createReportSink({ databaseUrl: 'postgres://u:p@127.0.0.1:1/x', file: pjoin(dir, 'log/fallback.jsonl'), log: { error() {} } });
  assert.equal(await broken({ reporter_id: 'g1', target_id: 'g4', reason: 'cheat' }), 'file');
});

test('rooms hold 30 cats; the 31st opens the next instance; the same cat twice keeps only the newest', { skip }, async () => {
  const all = [];
  for (let i = 0; i < ROOM_CAP; i++) all.push(await join(`Gato Veloz ${100 + i}`, 'toquio', { x: i, z: 0 }));
  assert.ok(all.every((c) => c.welcome.room === 'toquio#1'));
  const extra = await join('Gato Veloz 131', 'toquio');
  assert.equal(extra.welcome.room, 'toquio#2');
  assert.equal(app.stats().players, ROOM_CAP + 1);
  // asking for a full instance by name also lands in the next one
  const asked = await join('Gato Veloz 132', 'toquio#1');
  assert.equal(asked.welcome.room, 'toquio#2');
  const twin = ticketFor('Gato Veloz 133');
  const first = await join('x', 'toquio', null, { ticket: twin }), second = await join('x', 'toquio', null, { ticket: twin });
  assert.equal((await first.wait((m) => m.t === 'error')).error, 'replaced');
  assert.equal(second.welcome.room, 'toquio#2');
  for (const c of [...all, extra, asked, first, second]) await c.end();
  await sleep(80);
  assert.equal(app.stats().players, 0);
});

test('limits: connections per address, flooding, silence before the ticket', { skip }, async () => {
  const same = [];
  for (let i = 0; i < MAX_PER_IP; i++) { const c = open({ ip: '203.0.113.9' }); assert.equal(await c.opened, true); same.push(c); }
  const over = open({ ip: '203.0.113.9' });
  assert.equal(await over.opened, false);
  assert.equal(over.http, 429);
  for (const c of same) await c.end();

  const a = await join('Gato Veloz 60', 'lisboa'), b = await join('Gato Veloz 61', 'lisboa');
  await a.wait((m) => m.t === 'join');
  const count = a.msgs.filter((m) => m.t === 'e').length;
  for (let i = 0; i < 400; i++) b.send({ t: 'e', k: 'miau' });
  await sleep(300);
  assert.ok(a.msgs.filter((m) => m.t === 'e').length - count <= 2, 'a flood of emotes reaches the room as one or two');
  assert.equal((await b.wait((m) => m.t === 'error', 3000)).error, 'rate');
  await a.end(); await b.end();
});
