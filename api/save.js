// Cloud save: one JSON blob per player, last write wins.
//   GET /api/save        -> {data, updatedAt}   (data: null when nothing was saved yet)
//   PUT /api/save {data} -> {ok, updatedAt}
import { endpoint, fail } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';

const MAX_SAVE_BYTES = 64 * 1024;

export default endpoint({
  GET: async ({ req, sql }) => {
    const user = await requireUser(sql, req);
    const rows = await sql`select data, updated_at from vp_saves where user_id = ${user.id}`;
    if (!rows.length) return { data: null, updatedAt: null };
    return { data: rows[0].data, updatedAt: new Date(rows[0].updated_at).toISOString() };
  },

  PUT: async ({ req, sql, body }) => {
    const user = await requireUser(sql, req);
    const data = body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail(400, 'invalid', { field: 'data' });
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > MAX_SAVE_BYTES) throw fail(413, 'too-large', { maxBytes: MAX_SAVE_BYTES });
    if (json.includes('\\u0000')) throw fail(400, 'invalid', { field: 'data' });   // jsonb cannot hold NUL
    const rows = await sql`insert into vp_saves (user_id, data) values (${user.id}, ${json}::jsonb)
      on conflict (user_id) do update set data = excluded.data, updated_at = now()
      returning updated_at`;
    return { ok: true, updatedAt: new Date(rows[0].updated_at).toISOString() };
  },
});
