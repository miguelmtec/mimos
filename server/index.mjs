// Vice Paws — Cidade Online real-time server.
//
// One small Node process: WebSocket rooms (one per map, instances of 30), snapshots at 10 Hz,
// emotes, quick phrases (an index into a fixed list: there is no free text in the protocol),
// shared golden paws per room, reports. It keeps no accounts and no personal data: players arrive
// with a ticket signed by the game's API (GET /api/online/ticket) and this server only checks the
// signature with the shared ONLINE_TICKET_SECRET.
//
//   ONLINE_TICKET_SECRET=... node index.mjs          (see deploy/README.md for the VM set-up)
//
// Protocol (JSON text frames):
//   client -> {t:"hello", ticket, room:"rio"}                   first message, within 5 s
//   server -> {t:"welcome", you:{id,k,name}, room:"rio#1", hz, ts, cap, players:[{k,id,name,cat,x,z,ry,a,car}], paw:{slot,ms,n,taken}}
//   client -> {t:"s", x, z, ry, a, car?}                        own state, up to ~12/s (a = idle|walk|dash|car)
//   server -> {t:"snap", ts, p:[[k,x,z,ry*100,a,car], ...]}     10 Hz, only cats that changed; everybody every 2 s
//   server -> {t:"join", p:{k,id,name,cat,x,z,ry,a,car}} / {t:"leave", k}
//   client -> {t:"e", k:"dance"}     server -> {t:"e", k:<player>, e:"dance"}
//   client -> {t:"p", i:3}           server -> {t:"p", k:<player>, i:3}
//   client -> {t:"paw", i:2}         server -> {t:"pawok", i, slot} to the winner, {t:"paw", slot, taken:[...]} to the room
//   client -> {t:"report", id, reason}   server -> {t:"reported", ok:true}
//   server -> {t:"error", error:"ticket"|"room"|"busy"|"too-many"|"replaced"|"rate"|"idle"} and the socket closes
import http from 'node:http';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  ANIMS, CARS, EMOTES, PHRASES, REPORT_REASONS, PAWS_PER_ROOM, PAW_SLOT_MS, ROOM_CAP, MAX_PLAYERS, MAX_PER_IP,
  MAX_COORD, MAX_SPEED, ID_RE, splitRoom, chooseShard, verifyTicket,
} from './lib/protocol.mjs';

export const SNAPSHOT_HZ = 10;
const HELLO_MS = 5000;            // time to present a ticket
const IDLE_MS = 30_000;           // no message for this long: gone (the client sends its state at least once a second)
const KEYFRAME_MS = 2000;         // everybody's state is resent this often, moved or not
const MSG_PER_SEC = 20;           // token bucket per connection, burst 30
const EMOTE_MS = 500, PHRASE_MS = 1200;
const MAX_REPORTS_HOUR = 10;
const PROD_ORIGIN = 'https://vice-paws.vercel.app';
const PREVIEW_RE = /^https:\/\/vice-paws-[a-z0-9-]+\.vercel\.app$/;
const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

/** Where reports go: the Neon table the API also writes to when DATABASE_URL is set, otherwise a JSON-lines file. */
export function createReportSink({ databaseUrl = process.env.DATABASE_URL || '', file = process.env.REPORTS_FILE || resolve(dirname(fileURLToPath(import.meta.url)), 'data/reports.jsonl'), log = console } = {}) {
  let sql = null, ready = null;
  const toFile = async (r) => { await mkdir(dirname(file), { recursive: true }); await appendFile(file, JSON.stringify(r) + '\n'); return 'file'; };
  const toDb = async (r) => {
    if (!sql) { const { neon } = await import('@neondatabase/serverless'); sql = neon(databaseUrl); }
    ready ??= sql`create table if not exists vp_online_reports (
      id bigserial primary key, reporter_id text not null, target_id text not null, target_name text not null default '',
      target_cat jsonb, target_user_id uuid, room text not null default '', reason text not null,
      source text not null default 'poll', created_at timestamptz not null default now())`.catch((e) => { ready = null; throw e; });
    await ready;
    await sql`insert into vp_online_reports (reporter_id, target_id, target_name, target_cat, target_user_id, room, reason, source)
      values (${r.reporter_id}, ${r.target_id}, ${r.target_name}, ${r.target_cat ? JSON.stringify(r.target_cat) : null}::jsonb,
              ${r.target_user_id}::uuid, ${r.room}, ${r.reason}, 'ws')`;
    return 'db';
  };
  return async (r) => {
    if (databaseUrl) {
      try { return await toDb(r); } catch (e) { log.error('report: database failed, writing to the local log', e?.code || e?.name || 'Error'); }
    }
    return toFile(r);
  };
}

export function createOnlineServer(opts = {}) {
  const log = opts.log || console;
  const now = opts.now || Date.now;
  const report = opts.reportSink || createReportSink({ log });
  const extraOrigins = String(opts.allowedOrigins ?? process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const trustProxy = opts.trustProxy ?? (process.env.TRUST_PROXY !== '0');
  const started = now();

  const rooms = new Map();        // "rio#1" -> {name, players: Map(id -> P), nextK, paws: {slot, taken:Set}, keyAt}
  const byId = new Map();         // public id -> P (one connection per player)
  const perIp = new Map();        // address -> open connections
  const reportLog = new Map();    // reporter id -> [{at, target}]
  let total = 0;

  const originOk = (origin) => {
    if (!origin) return false;
    const o = origin.toLowerCase();
    return o === PROD_ORIGIN || PREVIEW_RE.test(o) || LOCAL_RE.test(o) || extraOrigins.includes(o);
  };
  const addressOf = (req) => {
    const fwd = trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    return (fwd || req.socket.remoteAddress || 'unknown').slice(0, 64);
  };
  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); };
  const bye = (ws, error, code = 4000) => { send(ws, { t: 'error', error }); try { ws.close(code, error); } catch { /* already closed */ } };
  const cast = (room, msg, except) => { const s = JSON.stringify(msg); for (const p of room.players.values()) if (p !== except) send(p.ws, s); };
  const pub = (p) => ({ k: p.k, id: p.id, name: p.name, cat: p.cat, x: p.x, z: p.z, ry: p.ry, a: p.a, car: p.car });
  const slotNow = () => Math.floor(now() / PAW_SLOT_MS);

  const server = http.createServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    if (path === '/health') {
      // numbers only: nothing here says who is online
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
      return res.end(JSON.stringify({ ok: true, players: total, rooms: rooms.size, uptime: Math.round((now() - started) / 1000), hz: SNAPSHOT_HZ }));
    }
    res.writeHead(path === '/' ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(path === '/' ? 'Vice Paws — Cidade Online\n' : 'not found\n');
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });

  server.on('upgrade', (req, socket, head) => {
    const refuse = (code, text) => { socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    if ((req.url || '').split('?')[0] !== '/ws') return refuse(404, 'Not Found');
    if (!originOk(req.headers.origin)) return refuse(403, 'Forbidden');
    const ip = addressOf(req);
    if ((perIp.get(ip) || 0) >= MAX_PER_IP) return refuse(429, 'Too Many Requests');
    wss.handleUpgrade(req, socket, head, (ws) => {
      perIp.set(ip, (perIp.get(ip) || 0) + 1);
      onConnection(ws, ip);
    });
  });

  function onConnection(ws, ip) {
    const c = { ws, ip, p: null, tokens: 30, tokAt: now(), dropped: 0, lastAt: now(), alive: true };
    ws.c = c;
    c.helloTimer = setTimeout(() => { if (!c.p) bye(ws, 'ticket', 4001); }, HELLO_MS);
    ws.on('pong', () => { c.alive = true; });
    ws.on('error', () => {});
    ws.on('close', () => {
      clearTimeout(c.helloTimer);
      const n = (perIp.get(ip) || 1) - 1;
      if (n > 0) perIp.set(ip, n); else perIp.delete(ip);
      if (c.p) drop(c.p);
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return bye(ws, 'rate', 4008);
      const t = now();
      c.tokens = Math.min(30, c.tokens + (t - c.tokAt) / 1000 * MSG_PER_SEC); c.tokAt = t;
      if (c.tokens < 1) { if (++c.dropped > 200) bye(ws, 'rate', 4008); return; }    // flooding: ignored, then disconnected
      c.tokens -= 1; c.lastAt = t;
      let m;
      try { m = JSON.parse(data.toString('utf8')); } catch { return; }
      if (!m || typeof m !== 'object' || Array.isArray(m)) return;
      if (!c.p) { if (m.t === 'hello') hello(c, m); return; }
      const fn = HANDLERS[m.t];
      if (fn) fn(c.p, m, t);
    });
  }

  function hello(c, m) {
    const tk = verifyTicket(m.ticket, now());
    if (!tk) return bye(c.ws, 'ticket', 4001);
    const where = splitRoom(m.room);
    if (!where) return bye(c.ws, 'room', 4002);
    const old = byId.get(tk.id);
    if (old) { bye(old.ws, 'replaced', 4003); drop(old); }      // the same cat in another tab: the new one wins
    if (total >= MAX_PLAYERS) return bye(c.ws, 'busy', 4004);
    const count = new Map([...rooms].map(([name, r]) => [name, r.players.size]));
    let name = where.shard ? `${where.base}#${where.shard}` : null;
    if (!name || (count.get(name) || 0) >= ROOM_CAP) name = chooseShard(where.base, count);
    if (!name) return bye(c.ws, 'busy', 4004);
    let room = rooms.get(name);
    if (!room) { room = { name, players: new Map(), nextK: 1, paws: { slot: slotNow(), taken: new Set() }, keyAt: 0 }; rooms.set(name, room); }
    clearTimeout(c.helloTimer);
    const p = c.p = {
      ws: c.ws, c, room, k: room.nextK++, id: tk.id, name: tk.name, cat: tk.cat, userId: tk.userId,
      x: 0, z: 0, ry: 0, a: 'idle', car: null, placed: false, moveAt: now(), dirty: false, emoteAt: 0, phraseAt: 0,
    };
    send(c.ws, { t: 'welcome', you: { id: p.id, k: p.k, name: p.name }, room: name, hz: SNAPSHOT_HZ, ts: now(), cap: ROOM_CAP,
      players: [...room.players.values()].filter((o) => o.placed).map(pub),
      paw: { slot: room.paws.slot, ms: PAW_SLOT_MS, n: PAWS_PER_ROOM, taken: [...room.paws.taken] } });
    room.players.set(p.id, p); byId.set(p.id, p); total++;
  }

  function drop(p) {
    if (byId.get(p.id) !== p) return;
    byId.delete(p.id); total--;
    const room = p.room;
    room.players.delete(p.id);
    p.c.p = null;
    if (!room.players.size) rooms.delete(room.name);
    else if (p.placed) cast(room, { t: 'leave', k: p.k });
  }

  const HANDLERS = {
    // own state. The server is the authority on what the others see: positions are bounded and a cat
    // cannot travel faster than MAX_SPEED (a teleporting client is simply shown catching up).
    s(p, m, t) {
      if (typeof m.x !== 'number' || typeof m.z !== 'number' || !Number.isFinite(m.x) || !Number.isFinite(m.z)) return;
      let x = Math.max(-MAX_COORD, Math.min(MAX_COORD, Math.round(m.x))), z = Math.max(-MAX_COORD, Math.min(MAX_COORD, Math.round(m.z)));
      const a = ANIMS.includes(m.a) ? m.a : 'idle';
      const car = a === 'car' && CARS.includes(m.car) ? m.car : null;
      const ry = typeof m.ry === 'number' && Number.isFinite(m.ry) ? Math.round(Math.atan2(Math.sin(m.ry), Math.cos(m.ry)) * 100) / 100 : p.ry;
      if (!p.placed) {
        p.placed = true; p.x = x; p.z = z; p.ry = ry; p.a = car ? 'car' : a === 'car' ? 'idle' : a; p.car = car; p.moveAt = t;
        cast(p.room, { t: 'join', p: pub(p) }, p);
        return;
      }
      const dt = Math.min(2, Math.max(0, (t - p.moveAt) / 1000)), max = MAX_SPEED * dt + 24;
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d > max) { x = Math.round(p.x + dx / d * max); z = Math.round(p.z + dz / d * max); }
      p.moveAt = t;
      const na = car ? 'car' : a === 'car' ? 'idle' : a;
      if (x !== p.x || z !== p.z || ry !== p.ry || na !== p.a || car !== p.car) { p.x = x; p.z = z; p.ry = ry; p.a = na; p.car = car; p.dirty = true; }
    },
    e(p, m, t) {
      if (!EMOTES.includes(m.k) || t - p.emoteAt < EMOTE_MS || !p.placed) return;
      p.emoteAt = t;
      cast(p.room, { t: 'e', k: p.k, e: m.k }, p);
    },
    // quick phrase: only the index of the fixed list travels. Anything else is not a phrase.
    p(p, m, t) {
      if (!Number.isInteger(m.i) || m.i < 0 || m.i >= PHRASES || t - p.phraseAt < PHRASE_MS || !p.placed) return;
      p.phraseAt = t;
      cast(p.room, { t: 'p', k: p.k, i: m.i }, p);
    },
    paw(p, m) {
      const paws = p.room.paws;
      if (!Number.isInteger(m.i) || m.i < 0 || m.i >= PAWS_PER_ROOM || paws.taken.has(m.i)) return;
      paws.taken.add(m.i);
      send(p.ws, { t: 'pawok', i: m.i, slot: paws.slot });
      cast(p.room, { t: 'paw', slot: paws.slot, taken: [...paws.taken] });
    },
    report(p, m, t) {
      if (typeof m.id !== 'string' || !ID_RE.test(m.id) || m.id === p.id || !REPORT_REASONS.includes(m.reason)) return;
      const mine = (reportLog.get(p.id) || []).filter((r) => t - r.at < 3600e3);
      if (mine.length < MAX_REPORTS_HOUR && !mine.some((r) => r.target === m.id)) {
        mine.push({ at: t, target: m.id });
        const target = byId.get(m.id);
        Promise.resolve(report({
          reporter_id: p.id, target_id: m.id, target_name: target ? target.name : '', target_cat: target ? target.cat : null,
          target_user_id: target ? target.userId : null, room: p.room.name, reason: m.reason, source: 'ws', created_at: new Date(t).toISOString(),
        })).catch((e) => log.error('report: could not be stored', e?.code || e?.name || 'Error'));
      }
      reportLog.set(p.id, mine);
      send(p.ws, { t: 'reported', ok: true });       // same answer either way: the reporter learns nothing about limits
    },
  };

  function snapshot() {
    const t = now(), slot = slotNow();
    for (const room of rooms.values()) {
      if (room.paws.slot !== slot) { room.paws = { slot, taken: new Set() }; cast(room, { t: 'paw', slot, taken: [] }); }
      if (room.players.size < 2) { for (const p of room.players.values()) p.dirty = false; continue; }
      const key = t - room.keyAt >= KEYFRAME_MS;
      if (key) room.keyAt = t;
      const list = [];
      for (const p of room.players.values()) {
        if (!p.placed || !(p.dirty || key)) continue;
        p.dirty = false;
        list.push([p.k, p.x, p.z, Math.round(p.ry * 100), ANIMS.indexOf(p.a), p.car ? CARS.indexOf(p.car) + 1 : 0]);
      }
      if (list.length) cast(room, { t: 'snap', ts: t, p: list });
    }
  }
  function heartbeat() {
    const t = now();
    for (const ws of wss.clients) {
      const c = ws.c;
      if (!c) continue;
      if (!c.alive || t - c.lastAt > IDLE_MS) { if (c.p) send(ws, { t: 'error', error: 'idle' }); ws.terminate(); continue; }
      c.alive = false;
      try { ws.ping(); } catch { /* closing */ }
    }
    for (const [id, list] of reportLog) if (!list.some((r) => t - r.at < 3600e3)) reportLog.delete(id);
  }

  let snapTimer = null, beatTimer = null;
  return {
    server, rooms,
    stats: () => ({ players: total, rooms: rooms.size }),
    listen: (port = Number(process.env.PORT) || 8080, host = process.env.HOST || '127.0.0.1') => new Promise((res, rej) => {
      server.once('error', rej);
      server.listen(port, host, () => {
        snapTimer = setInterval(snapshot, 1000 / SNAPSHOT_HZ);
        beatTimer = setInterval(heartbeat, 10_000);
        res(server.address().port);
      });
    }),
    close: () => new Promise((res) => {
      clearInterval(snapTimer); clearInterval(beatTimer);
      for (const ws of wss.clients) ws.terminate();
      wss.close(() => server.close(() => res()));
    }),
  };
}

// ---------- main ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.ONLINE_TICKET_SECRET) {
    console.error('ONLINE_TICKET_SECRET is not set. Use the same value as in the Vercel project (see deploy/README.md).');
    process.exit(1);
  }
  const app = createOnlineServer();
  const port = await app.listen();
  console.log(`vice-paws-online listening on ${process.env.HOST || '127.0.0.1'}:${port} (reports -> ${process.env.DATABASE_URL ? 'database' : 'local file'})`);
  const stop = () => { app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
