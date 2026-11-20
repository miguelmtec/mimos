// "Sign in with Google": verifies a Google Identity Services ID token (JWT, RS256) with node:crypto only.
// Checks: signature against Google's JWKS (cached per Cache-Control), aud == GOOGLE_CLIENT_ID, iss, exp/iat
// (5 minutes of clock skew), email_verified === true. Nothing here logs tokens or e-mails.
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

export const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const SKEW_S = 300;
const MAX_TOKEN = 4096;

let cache = null;          // { keys: Map(kid -> KeyObject), expires: ms }
let lastRefetch = 0;       // limits forced refetches (unknown kid) to one per minute

export const googleClientId = () => String(process.env.GOOGLE_CLIENT_ID || '').trim();
export function __resetGoogleCacheForTests() { cache = null; lastRefetch = 0; }

async function loadKeys() {
  let r;
  try { r = await fetch(JWKS_URL, { signal: AbortSignal.timeout(6000) }); } catch { throw new Error('jwks'); }
  if (!r.ok) throw new Error('jwks');
  const body = await r.json();
  const keys = new Map();
  for (const jwk of body.keys || []) {
    if (jwk.kty !== 'RSA' || !jwk.kid || (jwk.alg && jwk.alg !== 'RS256')) continue;
    try { keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' })); } catch { /* skip a malformed key */ }
  }
  const m = /max-age=(\d+)/i.exec(r.headers.get('cache-control') || '');
  const ttl = Math.min(Math.max(m ? Number(m[1]) : 300, 60), 86400);
  cache = { keys, expires: Date.now() + ttl * 1000 };
  lastRefetch = Date.now();
}

async function keyFor(kid) {
  if (!cache || cache.expires < Date.now()) await loadKeys();
  let k = cache.keys.get(kid);
  if (!k && Date.now() - lastRefetch > 60000) { await loadKeys(); k = cache.keys.get(kid); }   // key rotation
  return k || null;
}

const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/**
 * -> { sub, email } for a valid token, otherwise throws Error with a short reason code
 * (the caller answers a generic 401). `now` is injectable for tests.
 */
export async function verifyGoogleIdToken(credential, now = Date.now()) {
  const clientId = googleClientId();
  if (!clientId) throw new Error('not-configured');
  const token = String(credential ?? '');
  if (token.length > MAX_TOKEN) throw new Error('malformed');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('malformed');
  let header, payload;
  try { header = b64json(parts[0]); payload = b64json(parts[1]); } catch { throw new Error('malformed'); }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('alg');          // never trust "none"/HS256
  const key = await keyFor(String(header.kid));
  if (!key) throw new Error('kid');
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('signature');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(clientId)) throw new Error('aud');
  if (!ISSUERS.has(payload.iss)) throw new Error('iss');
  const t = Math.floor(now / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp + SKEW_S < t) throw new Error('exp');
  if (!Number.isFinite(payload.iat) || payload.iat - SKEW_S > t) throw new Error('iat');
  if (payload.email_verified !== true) throw new Error('email-unverified');
  if (typeof payload.sub !== 'string' || !/^\d{1,40}$/.test(payload.sub)) throw new Error('sub');
  if (typeof payload.email !== 'string') throw new Error('email');
  return { sub: payload.sub, email: payload.email };
}
