// "Cidade Online": the Vercel side of the shared city.
//   GET  /api/online/ticket?cat=mimo | catId=<uuid> | spec=<json>   -> {you: {id, name, guest}, ticket, exp}
//   POST /api/online/tick   {ticket, room, x, z, ry, anim, car?, emote?, es?, phrase?, ps?, paws?, need?}
//                                                                    -> {you: {id}, room, others: [...], n, ts, paw}
//   POST /api/online/report {ticket, targetId, reason, room?}        -> {ok, stored}
//   POST /api/online/leave  {ticket}                                 -> {ok}
// One dynamic file on purpose (the Vercel Hobby plan caps a deployment at 12 functions; this is the 10th).
//
// `ticket` is the only place where the session cookie is read: it becomes a short-lived signed
// ticket (id, display name, cat look) that the real-time server on the VM verifies with the shared
// ONLINE_TICKET_SECRET. tick/report/leave are the polling fallback (public/data/online.json:
// "pollingEnabled"), for when there is no real-time server. Budget of a steady-state tick: ONE
// statement (upsert + select of the room); the instance of a room is only chosen on the first tick
// and the cleanup runs at most once every 20 s per warm function instance.
import { createHash } from 'node:crypto';
import { endpoint, fail, HttpError, actionOf, clientIp, readQuery } from '../_lib/http.js';
import { getSql, ensureSchema, ensureOnlineSchema } from '../_lib/db.js';
import { getUser, readToken, ipHash } from '../_lib/auth.js';
import { isUuid, validateSpec } from '../_lib/validate.js';
import {
  TICK_MIN_MS, MAX_BODY, MAX_OTHERS, MAX_REPORTS_HOUR, REPORT_REASONS, PAW_SLOT_MS, PAWS_PER_ROOM, ROOM_CAP,
  SWEEP_EVERY_MS, TICKET_MINUTES, TICKET_RENEW_HOURS, ID_RE, NICK_RE,
  nickname, userPublicId, guestPublicId, signTicket, verifyTicket, ticketSecretConfigured,
  requireTicket, parseRoom, pickShard, validateTick, validateCatLook, otherJson,
} from '../_lib/online.js';

// Best-effort memory of this warm instance: it saves a database round trip for most too-fast ticks.
// The real limit is in the upsert itself (see `tick`), so it also holds across instances.
const lastTick = new Map();
let lastSweep = 0;
export function __resetOnlineForTests() { lastTick.clear(); lastSweep = 0; }

// Kill switch: ONLINE_DISABLED=1 answers 503 everywhere and the game goes back to solo free roam.
const disabled = () => ['1', 'true', 'on'].includes(String(process.env.ONLINE_DISABLED || '').toLowerCase());

// ---------- GET /api/online/ticket ----------
async function ticket(req) {
  if (disabled() || !ticketSecretConfigured()) throw fail(503, 'offline');
  const q = readQuery(req), now = Date.now();
  const one = (v) => (Array.isArray(v) ? v[0] : v);

  // Guests work without a database (the VM is enough); the cookie is only looked up when there is one.
  let user = null, sql = null;
  if (readToken(req) || q.catId != null) {
    sql = await getSql();
    if (sql) { await ensureSchema(sql); user = await getUser(sql, req); }
  }

  let look, catName = null;
  if (q.catId != null) {
    // one of the player's own registered cats: name (moderated when it was saved) and look come from the database
    const catId = String(one(q.catId));
    if (!isUuid(catId)) throw fail(400, 'invalid', { field: 'catId' });
    if (!user) throw fail(401, 'unauthorized');
    const rows = await sql`select name, spec from vp_cats where id = ${catId} and user_id = ${user.id}`;
    if (!rows.length) throw fail(404, 'not-found');
    catName = rows[0].name;
    look = { spec: validateSpec(rows[0].spec) };
  } else if (q.spec != null) {
    // a cat made on this device (no account): only the whitelisted look travels, never its typed name
    let spec;
    try { spec = JSON.parse(String(one(q.spec)).slice(0, 1200)); } catch { throw fail(400, 'invalid', { field: 'spec' }); }
    if (!spec || typeof spec !== 'object') throw fail(400, 'invalid', { field: 'spec' });
    look = validateCatLook(spec);
  } else {
    look = validateCatLook(q.cat == null ? 'mimo' : String(one(q.cat)));
  }

  let you;
  if (user) {
    const id = userPublicId(user.id);
    you = { id, name: catName || nickname(id.slice(1)), guest: false };
  } else {
    // renewing: a guest keeps the same id and nickname for a day (the old ticket proves it)
    const header = req.headers?.['x-vp-ticket'];
    const prev = verifyTicket(Array.isArray(header) ? header[0] : header, now, TICKET_RENEW_HOURS * 3600e3);
    you = prev && prev.id[0] === 'g' && NICK_RE.test(prev.name)
      ? { id: prev.id, name: prev.name, guest: true }
      : { id: guestPublicId(), name: nickname(), guest: true };
  }
  const signed = signTicket({ id: you.id, name: you.name, userId: user ? user.id : null, cat: look }, now);
  return { you, cat: look, ticket: signed.ticket, exp: signed.exp, ttl: TICKET_MINUTES * 60 };
}

// ---------- POST /api/online/tick (polling transport) ----------
async function tick({ req, sql, body }) {
  if (JSON.stringify(body).length > MAX_BODY) throw fail(413, 'too-large', { maxBytes: MAX_BODY });
  const now = Date.now();
  const me = requireTicket(body.ticket, now);
  const where = parseRoom(body.room);
  const t = validateTick(body, now);
  const cat = JSON.stringify(me.cat), cv = createHash('sha1').update(cat).digest('hex').slice(0, 8);

  const seen = lastTick.get(me.id);
  if (seen && now - seen < TICK_MIN_MS) throw fail(429, 'rate-limit', { retryAfterMs: TICK_MIN_MS - (now - seen) });
  if (lastTick.size > 5000) lastTick.clear();
  lastTick.set(me.id, now);

  if (now - lastSweep > SWEEP_EVERY_MS) {
    lastSweep = now;
    await sql`delete from vp_presence where updated_at < now() - interval '30 seconds'`;
  }

  const ip = ipHash(clientIp(req));
  let room = `${where.base}#${where.shard}`;
  if (!where.shard) {
    // first tick in a map: choose the instance (and apply the global caps)
    const live = await sql`select room, count(*)::int as n,
        (count(*) filter (where ip_hash = ${ip}::text and id <> ${me.id}::text))::int as mine
      from vp_presence where updated_at > now() - interval '10 seconds' group by room`;
    room = pickShard(where.base, live);
  }

  // Upsert + read in one statement. The upsert refuses to touch a row younger than 0.8 s, so the
  // rate limit holds even when two function instances serve the same player.
  const rows = await sql`with me as (
      insert into vp_presence as p (id, room, x, z, ry, anim, car, name, cat, cv, emote, es, phrase, ps, paws, ip_hash, user_id)
      values (${me.id}::text, ${room}::text, ${t.x}::int, ${t.z}::int, ${t.ry}::real, ${t.anim}::text, ${t.car}::text,
              ${me.name}::text, ${cat}::jsonb, ${cv}::text, ${t.emote}::text, ${t.es}::smallint, ${t.phrase}::smallint,
              ${t.ps}::smallint, ${t.paws}::text, ${ip}::text, ${me.userId}::uuid)
      on conflict (id) do update set room = excluded.room, x = excluded.x, z = excluded.z, ry = excluded.ry,
        anim = excluded.anim, car = excluded.car, name = excluded.name, cat = excluded.cat, cv = excluded.cv,
        emote = excluded.emote, es = excluded.es, phrase = excluded.phrase, ps = excluded.ps, paws = excluded.paws,
        ip_hash = excluded.ip_hash, user_id = excluded.user_id, updated_at = now()
        where p.updated_at <= now() - interval '800 milliseconds'
      returning p.id, p.room
    )
    select me.id as self, o.id, o.name, o.x, o.z, o.ry, o.anim, o.car, o.cv, o.emote, o.es, o.phrase, o.ps, o.paws,
           (extract(epoch from (now() - o.updated_at)) * 1000)::int as age,
           case when o.id = any(string_to_array(${t.need}::text, ',')) then o.cat end as cat
    from me left join vp_presence o
      on o.room = me.room and o.id <> me.id and o.updated_at > now() - interval '10 seconds'
    order by o.updated_at desc nulls last limit ${MAX_OTHERS}::int`;
  if (!rows.length) throw fail(429, 'rate-limit', { retryAfterMs: TICK_MIN_MS });

  const others = rows.filter((r) => r.id).map((r) => ({ ...otherJson(r), cv: r.cv }));
  return {
    you: { id: me.id }, room, others, n: others.length + 1, cap: ROOM_CAP, ts: now,
    paw: { slot: Math.floor(now / PAW_SLOT_MS), ms: PAW_SLOT_MS, n: PAWS_PER_ROOM },
  };
}

// ---------- POST /api/online/report ----------
async function report({ sql, body }) {
  const me = requireTicket(body.ticket);
  if (typeof body.targetId !== 'string' || !ID_RE.test(body.targetId) || body.targetId === me.id) throw fail(400, 'invalid', { field: 'targetId' });
  if (!REPORT_REASONS.includes(body.reason)) throw fail(400, 'invalid', { field: 'reason' });
  const room = body.room == null ? '' : (() => { const r = parseRoom(body.room); return `${r.base}#${r.shard}`; })();
  // Name, look and account of the reported cat are copied from the presence row at this moment (it is
  // gone 30 s after the player leaves). At most 10 reports per hour per reporter, one per target.
  const rows = await sql`insert into vp_online_reports (reporter_id, target_id, target_name, target_cat, target_user_id, room, reason, source)
    select ${me.id}::text, ${body.targetId}::text, coalesce(t.name, ''), t.cat, t.user_id, ${room}::text, ${body.reason}::text, 'poll'
    from (select 1) one left join vp_presence t on t.id = ${body.targetId}::text
    where (select count(*) from vp_online_reports
            where reporter_id = ${me.id}::text and created_at > now() - interval '1 hour') < ${MAX_REPORTS_HOUR}::int
      and not exists (select 1 from vp_online_reports
            where reporter_id = ${me.id}::text and target_id = ${body.targetId}::text and created_at > now() - interval '1 hour')
    returning id`;
  return { ok: true, stored: rows.length > 0 };
}

async function leave({ sql, body }) {
  const me = requireTicket(body.ticket);
  lastTick.delete(me.id);
  await sql`delete from vp_presence where id = ${me.id}`;
  return { ok: true };
}

const ACTIONS = { tick, report, leave };
const post = endpoint({
  POST: async (ctx) => {
    const fn = ACTIONS[actionOf(ctx.req)];
    if (!fn) throw fail(404, 'not-found');
    if (disabled()) throw fail(503, 'offline');
    await ensureOnlineSchema(ctx.sql);
    return fn(ctx);
  },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return post(req, res);
  res.setHeader('cache-control', 'no-store');
  try {
    if (actionOf(req) !== 'ticket') throw fail(404, 'not-found');
    return res.status(200).json(await ticket(req));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json(e.body);
    console.error('vp-api error', 'GET', '/api/online/ticket', e?.code || e?.name || 'Error');
    return res.status(500).json({ error: 'server' });
  }
}
