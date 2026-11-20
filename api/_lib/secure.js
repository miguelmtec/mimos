// Small security helpers for accounts: AES-256-GCM for the few personal fields we keep (birth month/year,
// guardian e-mail), keyed hashes for rate-limit keys, and the age rules (ECA Digital / LGPD art. 14).
// There is no password and no document in this system. Nothing here logs anything.
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { dbUrl } from './db.js';
import { fail } from './http.js';

/** AUTH_SECRET is mandatory in production for the personal-data features (no silent fallback there). */
export function secretMaterial() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL_ENV === 'production') throw fail(503, 'misconfigured');
  return `dev-only:${dbUrl() || 'dev'}`;
}
const subkey = (info) => Buffer.from(hkdfSync('sha256', secretMaterial(), 'vice-paws-accounts-v1', info, 32));

/** Keyed hash (HKDF subkey of AUTH_SECRET) for lookup/rate-limit keys that must not be reversible from a dump. */
export const keyedHash = (domain, value) =>
  createHmac('sha256', subkey('vp-hmac:v1')).update(`${domain}\u0000${value}`).digest('hex');

/** AES-256-GCM, key derived from AUTH_SECRET with HKDF. Output "v1.iv.tag.ct" (base64url). `aad` binds purpose. */
export function encrypt(plain, aad = 'field') {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', subkey('vp-aes-256-gcm:v1'), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}
export function decrypt(blob, aad = 'field') {
  const [v, iv, tag, ct] = String(blob || '').split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('bad-blob');
  const d = createDecipheriv('aes-256-gcm', subkey('vp-aes-256-gcm:v1'), Buffer.from(iv, 'base64url'));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

export const sha256hex = (s) => createHash('sha256').update(s).digest('hex');

// ---------- age (birth month + year only) ----------
/** Accepts "YYYY-MM" or "MM/YYYY". -> {y, m} for a real month that is not in the future, else null. */
export function parseBirth(v, now = new Date()) {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})$/.exec(s), y, mo;
  if (m) [y, mo] = [+m[1], +m[2]];
  else if ((m = /^(\d{1,2})\/(\d{4})$/.exec(s))) [mo, y] = [+m[1], +m[2]];
  else return null;
  if (mo < 1 || mo > 12 || y < 1900) return null;
  if (y > now.getUTCFullYear() || (y === now.getUTCFullYear() && mo > now.getUTCMonth() + 1)) return null;
  return { y, m: mo };
}
/**
 * Age in whole years, rounded DOWN as far as the month allows: without the day we cannot know whether the
 * birthday already happened this month, so the person counts as younger until the month is over
 * (the protective side for minors).
 */
export function ageOn(b, now = new Date()) {
  return now.getUTCFullYear() - b.y - (now.getUTCMonth() + 1 <= b.m ? 1 : 0);
}
/** 'child' (<16: guardian approval), 'teen' (16-17: active, guardian notified), 'adult'. */
export const ageBand = (age) => (age < 16 ? 'child' : age < 18 ? 'teen' : 'adult');
export const birthYm = (b) => `${b.y}-${String(b.m).padStart(2, '0')}`;
