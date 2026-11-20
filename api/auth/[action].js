// Accounts: "Sign in with Google" + passwordless e-mail code, age step and guardian approval.
//   GET  /api/auth/config           -> {googleClientId|null} (public: the OAuth client id is not a secret)
//   POST /api/auth/google  {credential, lang}  -> verifies the Google ID token, sets the session cookie
//   POST /api/auth/start   {email, lang}       -> emails a 6-digit code (valid 10 min)
//   POST /api/auth/verify  {email, code}       -> sets the vp_session cookie, returns {ok, user}
//   POST /api/auth/age     {birth, guardianEmail?} -> birth month/year, once; guardian rules for minors
//   POST /api/auth/guardian-approve {token}    -> the guardian's single-use link (token travels in the URL #fragment)
//   POST /api/auth/guardian-resend  {email}    -> generic answer; re-sends the guardian e-mail
//   POST /api/auth/logout                      -> drops the session
// One dynamic file on purpose: the Vercel Hobby plan caps a deployment at 12 functions.
import { endpoint, fail, actionOf, clientIp } from '../_lib/http.js';
import { sendLoginCode, sendNotice, mailConfigured, baseUrl } from '../_lib/mail.js';
import {
  CODE_MINUTES, SESSION_DAYS, MAX_CODES_PER_EMAIL_HOUR, MAX_CODES_PER_IP_HOUR, MAX_CODE_ATTEMPTS,
  newCode, codeHash, ipHash, newToken, tokenHash, safeEqual, normalizeEmail, normalizeLang,
  sessionCookie, clearCookie, readToken, ownerView, requireUser,
} from '../_lib/auth.js';
import { verifyGoogleIdToken, googleClientId } from '../_lib/google.js';
import { encrypt, decrypt, keyedHash, parseBirth, ageOn, ageBand, birthYm } from '../_lib/secure.js';

const GUARDIAN_DAYS = 7;
const MAX_GUARDIAN_MAILS_PER_DAY = 8;       // per guardian address (a family can have several kids)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Generic-answer endpoints take at least this long, so a mail being sent (or not) is not a timing oracle. */
async function padTo(started) {
  const min = Number(process.env.VP_MIN_RESPONSE_MS ?? 700);
  const left = min - (Date.now() - started);
  if (left > 0) await sleep(left);
}

/** Creates the session (rotating the one in the cookie) or, for "awaiting guardian", no session at all. */
async function finishLogin({ req, res, sql }, row) {
  const old = readToken(req);
  if (old) await sql`delete from vp_sessions where token_hash = ${tokenHash(old)}`;
  if (row.status === 'awaiting_guardian') {
    res.setHeader('set-cookie', clearCookie());
    return { ok: true, awaitingGuardian: true };
  }
  const token = newToken();
  await sql`insert into vp_sessions (token_hash, user_id, expires_at)
    values (${tokenHash(token)}, ${row.id}, now() + make_interval(days => ${SESSION_DAYS}::int))`;
  res.setHeader('set-cookie', sessionCookie(token));
  return { ok: true, user: ownerView(row) };
}

async function config() {
  return { googleClientId: googleClientId() || null };
}

async function start({ req, sql, body }) {
  const email = normalizeEmail(body.email);
  if (!email) throw fail(400, 'invalid', { field: 'email' });
  if (!mailConfigured()) throw fail(503, 'mail-offline');
  const lang = normalizeLang(body.lang);
  const ip = ipHash(clientIp(req));
  const code = newCode();

  // Housekeeping: old codes, tokens and expired sessions do not need to stay around (data minimisation).
  await Promise.all([
    sql`delete from vp_login_codes where created_at < now() - interval '1 day'`,
    sql`delete from vp_sessions where expires_at < now()`,
    sql`delete from vp_tokens where expires_at < now() - interval '1 day'`,
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

async function verify(ctx) {
  const { sql, body } = ctx;
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

  // The e-mail code can still create accounts (people without Google).
  const users = await sql`insert into vp_users (email, lang) values (${email}, ${row.lang})
    on conflict (email) do update set last_login_at = now(), lang = excluded.lang
    returning id, email, lang, created_at, status, birth_enc, google_sub`;
  return finishLogin(ctx, users[0]);
}

async function google(ctx) {
  const { sql, body } = ctx;
  let id;
  try {
    id = await verifyGoogleIdToken(body.credential);
  } catch (e) {
    if (e.message === 'not-configured') throw fail(503, 'google-offline');
    if (e.message === 'jwks') throw fail(502, 'google-unavailable');
    throw fail(401, 'invalid-credential');                  // one answer for every verification failure
  }
  const email = normalizeEmail(id.email);
  if (!email) throw fail(401, 'invalid-credential');
  const lang = normalizeLang(body.lang);

  let row = (await sql`select id, email, lang, created_at, status, birth_enc, google_sub from vp_users where google_sub = ${id.sub}`)[0];
  if (row) {
    await sql`update vp_users set last_login_at = now() where id = ${row.id}`;
  } else {
    // link by e-mail (Google says it is verified) or create; never overwrite another Google identity
    row = (await sql`insert into vp_users (email, lang, google_sub) values (${email}, ${lang}, ${id.sub})
      on conflict (email) do update set last_login_at = now(), google_sub = coalesce(vp_users.google_sub, excluded.google_sub)
      returning id, email, lang, created_at, status, birth_enc, google_sub`)[0];
    if (row.google_sub !== id.sub) throw fail(409, 'account-conflict');
  }
  return finishLogin(ctx, row);
}

const newGuardianToken = async (sql, userId) => {
  const token = newToken();
  await sql`update vp_tokens set used_at = now() where user_id = ${userId} and purpose = 'guardian' and used_at is null`;
  await sql`insert into vp_tokens (token_hash, user_id, purpose, expires_at)
    values (${tokenHash(token)}, ${userId}, 'guardian', now() + make_interval(days => ${GUARDIAN_DAYS}::int))`;
  return token;
};

/** Never throws: a failed mail must not undo an account decision (the guardian-resend action exists). */
const trySend = async (fn) => { try { await fn(); return true; } catch { return false; } };

async function age(ctx) {
  const { req, res, sql, body } = ctx;
  const user = await requireUser(sql, req, { allowIncomplete: true });
  if (!user.needsAge) throw fail(409, 'already-set');
  const birth = parseBirth(body.birth);
  if (!birth) throw fail(400, 'invalid', { field: 'birth' });
  const band = ageBand(ageOn(birth));

  let gEmail = null;
  if (band !== 'adult') {
    gEmail = normalizeEmail(body.guardianEmail);
    if (!gEmail || gEmail === user.email) throw fail(400, 'invalid', { field: 'guardianEmail' });
    const n = (await sql`select count(*)::int as n from vp_guardians where ghash = ${keyedHash('guardian', gEmail)} and created_at > now() - interval '1 day'`)[0].n;
    if (n >= MAX_GUARDIAN_MAILS_PER_DAY) throw fail(429, 'rate-limit');
  }

  // The age is written once (birth_enc is null): nobody can "grow up" later by calling this again.
  const status = band === 'child' ? 'awaiting_guardian' : 'active';
  const done = await sql`update vp_users set birth_enc = ${encrypt(birthYm(birth), 'birth')}, age_band = ${band}, status = ${status}
    where id = ${user.id} and birth_enc is null returning id`;
  if (!done.length) throw fail(409, 'already-set');
  if (!gEmail) return { ok: true, band, user: { ...user, needsAge: false } };

  await sql`insert into vp_guardians (user_id, enc, ghash) values (${user.id}, ${encrypt(gEmail, 'guardian')}, ${keyedHash('guardian', gEmail)})
    on conflict (user_id) do update set enc = excluded.enc, ghash = excluded.ghash, approved_at = null`;

  if (band === 'teen') {
    const mailSent = await trySend(() => sendNotice(gEmail, 'guardianNotice', user.lang));
    return { ok: true, band, mailSent, user: { ...user, needsAge: false } };
  }
  // under 16: no session until the guardian approves
  await sql`delete from vp_sessions where user_id = ${user.id}`;
  res.setHeader('set-cookie', clearCookie());
  const token = await newGuardianToken(sql, user.id);
  const mailSent = await trySend(() => sendNotice(gEmail, 'guardian', user.lang, { url: `${baseUrl()}/guardian.html#t=${token}` }));
  return { ok: true, band, awaitingGuardian: true, mailSent };
}

async function guardianApprove({ sql, body }) {
  const token = String(body.token ?? '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail(400, 'invalid-token');
  // atomic single use: the first request burns it
  const used = await sql`update vp_tokens set used_at = now()
    where token_hash = ${tokenHash(token)} and purpose = 'guardian' and used_at is null and expires_at > now()
    returning user_id`;
  if (!used.length) throw fail(400, 'invalid-token');
  const act = await sql`update vp_users set status = 'active' where id = ${used[0].user_id} and status = 'awaiting_guardian' returning id, email, lang`;
  if (!act.length) throw fail(400, 'invalid-token');
  await sql`update vp_guardians set approved_at = now() where user_id = ${act[0].id}`;
  await trySend(() => sendNotice(act[0].email, 'approved', act[0].lang));
  return { ok: true };
}

async function guardianResend({ req, sql, body }) {
  const started = Date.now();
  const email = normalizeEmail(body.email);
  if (!email) throw fail(400, 'invalid', { field: 'email' });
  const u = (await sql`select id, email, lang, created_at, status, birth_enc, google_sub from vp_users where email = ${email}`)[0];
  if (u && u.status === 'awaiting_guardian') {
    const g = (await sql`select enc from vp_guardians where user_id = ${u.id}`)[0];
    const n = (await sql`select count(*)::int as n from vp_tokens where user_id = ${u.id} and purpose = 'guardian' and created_at > now() - interval '1 hour'`)[0].n;
    if (g && n < 3) {
      const token = await newGuardianToken(sql, u.id);
      let gEmail = null;
      try { gEmail = decrypt(g.enc, 'guardian'); } catch { /* unreadable: nothing to send */ }
      if (gEmail) await trySend(() => sendNotice(gEmail, 'guardian', u.lang, { url: `${baseUrl()}/guardian.html#t=${token}` }));
    }
  }
  await padTo(started);
  return { ok: true };                                       // the same answer for everyone
}

async function logout({ req, res, sql }) {
  const token = readToken(req);
  if (token) await sql`delete from vp_sessions where token_hash = ${tokenHash(token)}`;
  res.setHeader('set-cookie', clearCookie());
  return { ok: true };
}

const post = { google, start, verify, age, 'guardian-approve': guardianApprove, 'guardian-resend': guardianResend, logout };

export default endpoint({
  GET: (ctx) => {
    if (actionOf(ctx.req) !== 'config') { ctx.res.setHeader('allow', 'POST'); throw fail(405, 'method'); }
    return config();
  },
  POST: (ctx) => {
    const fn = post[actionOf(ctx.req)];
    if (!fn) throw fail(404, 'not-found');
    return fn(ctx);
  },
});
