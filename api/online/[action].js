// "Cidade Online" (lite): shared presence by polling, on Vercel functions + Neon. No dedicated server.
//   POST /api/online/hello  {catId?}                              -> {you: {id, name, guest}, token, exp}
//   POST /api/online/tick   {token, room, x, z, ry, anim, cat, car?, emote?, es?, phrase?, ps?, paws?, need?}
//                                                                 -> {you: {id}, room, others: [...], n, ts, paw}
//   POST /api/online/report {token, targetId, reason, room?}      -> {ok, stored}
//   POST /api/online/leave  {token}                               -> {ok}
// One dynamic file on purpose (the Vercel Hobby plan caps a deployment at 12 functions; this is the 10th).
//
// Budget: a steady-state tick is ONE statement (upsert + select of the room). The session cookie is only
// read by `hello`, which turns it into a signed token; the instance of a room is only chosen on the
// first tick; the cleanup runs at most once every 20 s per warm function instance.
import { endpoint, fail, actionOf, clientIp } from '../_lib/http.js';
import { ensureOnlineSchema } from '../_lib/db.js';
import { getUser, ipHash } from '../_lib/auth.js';
import { isUuid } from '../_lib/validate.js';
import {
  TICK_MIN_MS, MAX_BODY, MAX_OTHERS, MAX_REPORTS_HOUR, REPORT_REASONS, PAW_SLOT_MS, PAWS_PER_ROOM, ROOM_CAP,
  ID_RE, nickname, userPublicId, guestPublicId, makeToken, readOnlineToken, parseRoom, pickShard,
  validateTick, otherJson, SWEEP_EVERY_MS,
} from '../_lib/online.js';

// Best-effort memory of this warm instance: it saves a database round trip for most too-fast ticks.
// The real limit is in the upsert itself (see `tick`), so it also holds across instances.
const lastTick = new Map();
let lastSweep = 0;
export function __resetOnlineForTests() { lastTick.clear(); lastSweep = 0; }

const disabled = () => ['1', 'true', 'on'].includes(String(process.env.ONLINE_DISABLED || '').toLowerCase());

async function hello({ req, sql, body }) {
  const user = await getUser(sql, req);
  if (!user) {
    // guests: a random id and a generated nickname, nothing typed
    const you = { id: guestPublicId(), name: nickname(), guest: true };
    return { you, ...makeToken(you) };
  }
  const id = userPublicId(user.id);
  let name = nickname(id.slice(1));                  // stable nickname for an account without a chosen cat
  if (body.catId != null) {
    if (!isUuid(body.catId)) throw fail(400, 'invalid', { field: 'catId' });
    // the registered name of one of the player's own cats (already moderated when it was saved)
    const rows = await sql`select name from vp_cats where id = ${body.catId} and user_id = ${user.id}`;
    if (!rows.length) throw fail(404, 'not-found');
    name = rows[0].name;
  }
  return { you: { id, name, guest: false }, ...makeToken({ id, name, userId: user.id }) };
}

async function tick({ req, sql, body }) {
  if (JSON.stringify(body).length > MAX_BODY) throw fail(413, 'too-large', { maxBytes: MAX_BODY });
  const now = Date.now();
  const me = readOnlineToken(body.token, now);
  const where = parseRoom(body.room);
  const t = validateTick(body, now);

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
              ${me.name}::text, ${t.cat}::jsonb, ${t.cv}::text, ${t.emote}::text, ${t.es}::smallint, ${t.phrase}::smallint,
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

  const others = rows.filter((r) => r.id).map(otherJson);
  return {
    you: { id: me.id }, room, others, n: others.length + 1, cap: ROOM_CAP, ts: now,
    paw: { slot: Math.floor(now / PAW_SLOT_MS), ms: PAW_SLOT_MS, n: PAWS_PER_ROOM },
  };
}

async function report({ sql, body }) {
  const me = readOnlineToken(body.token);
  if (typeof body.targetId !== 'string' || !ID_RE.test(body.targetId) || body.targetId === me.id) throw fail(400, 'invalid', { field: 'targetId' });
  if (!REPORT_REASONS.includes(body.reason)) throw fail(400, 'invalid', { field: 'reason' });
  const room = body.room == null ? '' : (() => { const r = parseRoom(body.room); return `${r.base}#${r.shard}`; })();
  // The name, look and account of the reported cat are copied from the presence row at this moment
  // (it is gone 30 s after the player leaves). At most 10 reports per hour, one per target.
  const rows = await sql`insert into vp_online_reports (reporter_id, target_id, target_name, target_cat, target_user_id, room, reason)
    select ${me.id}::text, ${body.targetId}::text, coalesce(t.name, ''), t.cat, t.user_id, ${room}::text, ${body.reason}::text
    from (select 1) one left join vp_presence t on t.id = ${body.targetId}::text
    where (select count(*) from vp_online_reports
            where reporter_id = ${me.id}::text and created_at > now() - interval '1 hour') < ${MAX_REPORTS_HOUR}::int
      and not exists (select 1 from vp_online_reports
            where reporter_id = ${me.id}::text and target_id = ${body.targetId}::text and created_at > now() - interval '1 hour')
    returning id`;
  return { ok: true, stored: rows.length > 0 };
}

async function leave({ sql, body }) {
  const me = readOnlineToken(body.token);
  lastTick.delete(me.id);
  await sql`delete from vp_presence where id = ${me.id}`;
  return { ok: true };
}

const ACTIONS = { hello, tick, report, leave };

export default endpoint({
  POST: async (ctx) => {
    const fn = ACTIONS[actionOf(ctx.req)];
    if (!fn) throw fail(404, 'not-found');
    if (disabled()) throw fail(503, 'offline');       // kill switch: ONLINE_DISABLED=1 sends everybody back to solo
    await ensureOnlineSchema(ctx.sql);
    return fn(ctx);
  },
});
