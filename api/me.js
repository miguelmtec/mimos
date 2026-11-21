// GET    /api/me -> {user, cats} (401 when not logged in). user.needsAge: the age step is still due.
// DELETE /api/me -> deletes the account and every piece of personal data attached to it (LGPD)
import { endpoint } from './_lib/http.js';
import { requireUser, clearCookie, isAdminEmail, isTesterEmail, onlinePublic } from './_lib/auth.js';
import { listCats } from './_lib/cats.js';
import { sendNotice } from './_lib/mail.js';
import { randomBytes } from 'node:crypto';

export default endpoint({
  GET: async ({ req, sql }) => {
    const user = await requireUser(sql, req, { allowIncomplete: true });
    // the owner's account (ADMIN_EMAILS, comma separated) carries the "Edição dos Mimos": the full wardrobe on the three official cats
    const admin = isAdminEmail(user.email);
    // tester: may enter the Cidade Online while it is a closed test (onlineOpen tells the client it is public)
    const extra = { ...(admin ? { admin: true } : {}), ...(isTesterEmail(user.email) ? { tester: true } : {}), ...(onlinePublic() ? { onlineOpen: true } : {}) };
    return { user: { ...user, ...extra }, cats: user.needsAge ? [] : await listCats(sql, user.id) };
  },
  DELETE: async ({ req, res, sql }) => {
    const user = await requireUser(sql, req, { allowIncomplete: true });
    // The ranking is keyed by a nickname chosen in the game, not by account: rows that carry the name of one
    // of this player's cats are renamed to a random anonymous label (the score stays, the name goes).
    const names = (await sql`select name from vp_cats where user_id = ${user.id}`).map((r) => r.name);
    for (const name of names) {
      try { await sql`update vp_ranking set name = ${'anon-' + randomBytes(4).toString('hex')} where name = ${name}`; } catch { /* ranking table may not exist */ }
    }
    try { await sql`delete from vp_presence where user_id = ${user.id}`; } catch { /* online tables are optional */ }
    // sessions, cats, saves, guardian record and tokens go with the user (on delete cascade); e-mail, google_sub and birth are in the row
    await sql`delete from vp_users where id = ${user.id}`;
    await sql`delete from vp_login_codes where email = ${user.email}`;
    res.setHeader('set-cookie', clearCookie());
    try { await sendNotice(user.email, 'deleted', user.lang); } catch { /* best effort */ }
    return { ok: true, deleted: true };
  },
});
