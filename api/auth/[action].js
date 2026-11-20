// Passwordless login by email code.
//   POST /api/auth/start  {email, lang}  -> emails a 6-digit code (valid 10 min)
//   POST /api/auth/verify {email, code}  -> sets the vp_session cookie, returns {ok, user}
//   POST /api/auth/logout                -> drops the session
// One dynamic file on purpose: the Vercel Hobby plan caps a deployment at 12 functions.
import { endpoint, fail, actionOf, clientIp } from '../_lib/http.js';
import { sendLoginCode, mailConfigured } from '../_lib/mail.js';
import {
  CODE_MINUTES, SESSION_DAYS, MAX_CODES_PER_EMAIL_HOUR, MAX_CODES_PER_IP_HOUR, MAX_CODE_ATTEMPTS,
  newCode, codeHash, ipHash, newToken, tokenHash, safeEqual, normalizeEmail, normalizeLang,
  sessionCookie, clearCookie, readToken, publicUser,
} from '../_lib/auth.js';

async function start({ req, sql, body }) {
  const email = normalizeEmail(body.email);
  if (!email) throw fail(400, 'invalid', { field: 'email' });
  if (!mailConfigured()) throw fail(503, 'mail-offline');
  const lang = normalizeLang(body.lang);
  const ip = ipHash(clientIp(req));
  const code = newCode();

  // Housekeeping: old codes and expired sessions do not need to stay around (data minimisation).
  await Promise.all([
    sql`delete from vp_login_codes where created_at < now() - interval '1 day'`,
    sql`delete from vp_sessions where expires_at < now()`,
  ]);

  // Rate limit and insert in a single statement.
  const rows = await sql`insert into vp_login_codes (email, code_hash, ip_hash, lang, expires_at)
    select ${email}::text, ${codeHash(email, code)}::text, ${ip}::text, ${lang}::text,
           now() + make_interval(mins => ${CODE_MINUTES}::int)
    where (select count(*) from vp_login_codes
            where email = ${email}::text and created_at > now() - interval '1 hour') < ${MAX_CODES_PER_EMAIL_HOUR}::int
      and (select count(*) from vp_login_codes
            where ip_hash = ${ip}::text and created_at > now() - interval '1 hour') < ${MAX_CODES_PER_IP_HOUR}::int
    returning id`;
  if (!rows.length) throw fail(429, 'rate-limit', { retryAfterMinutes: 60 });

  await sendLoginCode({ email, code, lang });
  return { ok: true, expiresInMinutes: CODE_MINUTES };
}

async function verify({ res, sql, body }) {
  const email = normalizeEmail(body.email);
  const code = String(body.code ?? '').replace(/\s/g, '');
  if (!email) throw fail(400, 'invalid', { field: 'email' });
  if (!/^\d{6}$/.test(code)) throw fail(400, 'invalid-code');

  // Only the newest pending code counts; every try is counted before comparing.
  const tried = await sql`update vp_login_codes set attempts = attempts + 1
    where id = (select id from vp_login_codes
                 where email = ${email} and used_at is null and expires_at > now()
                 order by created_at desc, id desc limit 1)
    returning id, code_hash, attempts, lang`;
  const row = tried[0];
  if (!row) throw fail(400, 'invalid-code');
  if (row.attempts > MAX_CODE_ATTEMPTS) throw fail(429, 'too-many-attempts');
  if (!safeEqual(row.code_hash, codeHash(email, code))) throw fail(400, 'invalid-code');

  const used = await sql`update vp_login_codes set used_at = now()
    where id = ${row.id} and used_at is null returning id`;
  if (!used.length) throw fail(400, 'invalid-code');

  const users = await sql`insert into vp_users (email, lang) values (${email}, ${row.lang})
    on conflict (email) do update set last_login_at = now(), lang = excluded.lang
    returning id, email, lang, created_at`;
  const token = newToken();
  await sql`insert into vp_sessions (token_hash, user_id, expires_at)
    values (${tokenHash(token)}, ${users[0].id}, now() + make_interval(days => ${SESSION_DAYS}::int))`;

  res.setHeader('set-cookie', sessionCookie(token));
  return { ok: true, user: publicUser(users[0]) };
}

async function logout({ req, res, sql }) {
  const token = readToken(req);
  if (token) await sql`delete from vp_sessions where token_hash = ${tokenHash(token)}`;
  res.setHeader('set-cookie', clearCookie());
  return { ok: true };
}

const actions = { start, verify, logout };

export default endpoint({
  POST: (ctx) => {
    const fn = actions[actionOf(ctx.req)];
    if (!fn) throw fail(404, 'not-found');
    return fn(ctx);
  },
});
