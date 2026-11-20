// The player's own cats (max 5).
//   GET    /api/cats            -> {cats}
//   POST   /api/cats            -> {ok, cat}            (201)
//   PUT    /api/cats?id=<uuid>  -> {ok, cat}            (full replace)
//   DELETE /api/cats?id=<uuid>  -> {ok}
import { endpoint, fail } from '../_lib/http.js';
import { requireUser } from '../_lib/auth.js';
import { validateCat, isUuid, MAX_CATS } from '../_lib/validate.js';
import { catJson, listCats } from '../_lib/cats.js';

function catId(query, body) {
  const id = String(query.id || body.id || '').toLowerCase();
  if (!isUuid(id)) throw fail(400, 'invalid', { field: 'id' });
  return id;
}

export default endpoint({
  GET: async ({ req, sql }) => {
    const user = await requireUser(sql, req);
    return { cats: await listCats(sql, user.id) };
  },

  POST: async ({ req, sql, body }) => {
    const user = await requireUser(sql, req);
    const c = validateCat(body);
    const rows = await sql`insert into vp_cats (user_id, name, breed, spec, bio, instagram, is_public)
      select ${user.id}::uuid, ${c.name}::text, ${c.breed}::text, ${JSON.stringify(c.spec)}::jsonb,
             ${c.bio}::text, ${c.instagram}::text, ${c.isPublic}::boolean
      where (select count(*) from vp_cats where user_id = ${user.id}::uuid) < ${MAX_CATS}::int
      returning id, name, breed, spec, bio, instagram, is_public, created_at, updated_at`;
    if (!rows.length) throw fail(409, 'cat-limit', { max: MAX_CATS });
    return [201, { ok: true, cat: catJson(rows[0]) }];
  },

  PUT: async ({ req, sql, body, query }) => {
    const user = await requireUser(sql, req);
    const id = catId(query, body);
    const c = validateCat(body);
    const rows = await sql`update vp_cats set name = ${c.name}, breed = ${c.breed},
        spec = ${JSON.stringify(c.spec)}::jsonb, bio = ${c.bio}, instagram = ${c.instagram},
        is_public = ${c.isPublic}, updated_at = now()
      where id = ${id} and user_id = ${user.id}
      returning id, name, breed, spec, bio, instagram, is_public, created_at, updated_at`;
    if (!rows.length) throw fail(404, 'not-found');
    return { ok: true, cat: catJson(rows[0]) };
  },

  DELETE: async ({ req, sql, body, query }) => {
    const user = await requireUser(sql, req);
    const id = catId(query, body);
    const rows = await sql`delete from vp_cats where id = ${id} and user_id = ${user.id} returning id`;
    if (!rows.length) throw fail(404, 'not-found');
    return { ok: true };
  },
});
