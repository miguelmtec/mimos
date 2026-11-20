// Passwordless sessions: hashed one-time codes + hashed opaque session tokens.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { dbUrl } from './db.js';
import { fail } from './http.js';

export const COOKIE = 'vp_session';
export const SESSION_DAYS = 60;
export const CODE_MINUTES = 10;
export const MAX_CODES_PER_EMAIL_HOUR = 5;
// Higher than the per-email limit: in Brazil many households/mobile users share one IP (CGNAT).
export const MAX_CODES_PER_IP_HOUR = 20;
export const MAX_CODE_ATTEMPTS = 5;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
// Server-side pepper so leaked rows alone are not enough to brute-force 6-digit codes or IPs.
const pepper = () => sha256(`vp-pepper:${process.env.AUTH_SECRET || dbUrl() || 'dev'}`);
const hmac = (s) => createHmac('sha256', pepper()).update(s).digest('hex');

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const codeHash = (email, code) => hmac(`code:${email}:${code}`);
export const ipHash = (ip) => hmac(`ip:${ip}`).slice(0, 32);
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token) => sha256(`session:${token}`);

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function normalizeEmail(v) {
  const email = String(v ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

export const normalizeLang = (v) => (String(v || '').toLowerCase().startsWith('en') ? 'en' : 'pt');

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function readToken(req) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) {
      const v = part.slice(i + 1).trim();
      return /^[A-Za-z0-9_-]{43}$/.test(v) ? v : null;
    }
  }
  return null;
}

export const publicUser = (u) => ({
  id: u.id, email: u.email, lang: u.lang, createdAt: new Date(u.created_at).toISOString(),
});

/** Returns the logged-in user ({id, email, lang, createdAt}) or null. */
export async function getUser(sql, req) {
  const token = readToken(req);
  if (!token) return null;
  const rows = await sql`select u.id, u.email, u.lang, u.created_at
    from vp_sessions s join vp_users u on u.id = s.user_id
    where s.token_hash = ${tokenHash(token)} and s.expires_at > now()`;
  return rows[0] ? publicUser(rows[0]) : null;
}

export async function requireUser(sql, req) {
  const user = await getUser(sql, req);
  if (!user) throw fail(401, 'unauthorized');
  return user;
}
