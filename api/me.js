// GET    /api/me -> {user, cats} (401 when not logged in)
// DELETE /api/me -> deletes the account and everything attached to it (LGPD)
import { endpoint } from './_lib/http.js';
import { requireUser, clearCookie } from './_lib/auth.js';
import { listCats } from './_lib/cats.js';

export default endpoint({
  GET: async ({ req, sql }) => {
    const user = await requireUser(sql, req);
    return { user, cats: await listCats(sql, user.id) };
  },
  DELETE: async ({ req, res, sql }) => {
    const user = await requireUser(sql, req);
    // sessions, cats and saves go with the user (on delete cascade)
    await sql`delete from vp_users where id = ${user.id}`;
    await sql`delete from vp_login_codes where email = ${user.email}`;
    res.setHeader('set-cookie', clearCookie());
    return { ok: true, deleted: true };
  },
});
