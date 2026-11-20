// Shared plumbing for the account endpoints: JSON bodies, errors, Origin check.
import { getSql, ensureSchema } from './db.js';

export class HttpError extends Error {
  constructor(status, body) {
    super(body?.error || String(status));
    this.status = status;
    this.body = body;
  }
}
export const fail = (status, error, extra) => new HttpError(status, { error, ...extra });

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PROD_ORIGIN = 'https://vice-paws.vercel.app';
const PREVIEW_RE = /^https:\/\/vice-paws-[a-z0-9-]+\.vercel\.app$/;       // preview deployments
const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

function header(req, name) {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : (v || '');
}

/** Mutating requests must come from the game itself (CSRF defence, on top of SameSite=Lax). */
export function originAllowed(req) {
  let origin = header(req, 'origin');
  if (!origin) {
    try { origin = new URL(header(req, 'referer')).origin; } catch { return false; }
  }
  origin = origin.toLowerCase();
  if (origin === PROD_ORIGIN || PREVIEW_RE.test(origin) || LOCAL_RE.test(origin)) return true;
  const host = (header(req, 'x-forwarded-host') || header(req, 'host')).toLowerCase();
  if (host && origin === `https://${host}`) return true;                    // same origin (custom domains too)
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return extra.includes(origin);
}

export function clientIp(req) {
  const ip = header(req, 'x-real-ip') || header(req, 'x-forwarded-for').split(',')[0];
  return ip.trim().slice(0, 64) || 'unknown';
}

export function readBody(req) {
  let b;
  try { b = req.body; } catch { throw fail(400, 'invalid-json'); }
  if (b == null || b === '') return {};
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { throw fail(400, 'invalid-json'); }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'invalid-json');
  return b;
}

export function readQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try { return Object.fromEntries(new URL(req.url, 'http://x').searchParams); } catch { return {}; }
}

/** Last path segment, for the dynamic api/<dir>/[action].js routes. */
export function actionOf(req) {
  const q = req.query?.action;
  if (q) return String(Array.isArray(q) ? q[0] : q);
  try { return new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop() || ''; } catch { return ''; }
}

/**
 * Wraps `{ GET: fn, POST: fn, ... }` into a Vercel handler.
 * Each fn receives { req, res, sql, body, query } and returns the JSON body
 * (status 200) or [status, body]. Throw `fail(status, code)` for errors.
 */
export function endpoint(methods) {
  const allow = Object.keys(methods).join(', ');
  return async function handler(req, res) {
    res.setHeader('cache-control', 'no-store');
    const fn = methods[req.method];
    if (!fn) {
      res.setHeader('allow', allow);
      return res.status(405).json({ error: 'method' });
    }
    try {
      if (MUTATING.has(req.method) && !originAllowed(req)) throw fail(403, 'origin');
      const sql = await getSql();
      if (!sql) throw fail(503, 'offline');
      await ensureSchema(sql);
      const body = MUTATING.has(req.method) ? readBody(req) : {};
      const out = await fn({ req, res, sql, body, query: readQuery(req) });
      const [status, payload] = Array.isArray(out) ? out : [200, out];
      return res.status(status).json(payload);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json(e.body);
      // Never log messages/queries here: they may carry personal data or secrets.
      console.error('vp-api error', req.method, String(req.url || '').split('?')[0], e?.code || e?.name || 'Error');
      return res.status(500).json({ error: 'server' });
    }
  };
}
