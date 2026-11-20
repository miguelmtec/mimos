// Cidade Online — what the Vercel API (api/online) and the optional real-time server (server/index.mjs) share:
// the fixed lists, the limits and the signed ticket. No dependencies (the VM imports this very file).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ROOM_CAP = 30;            // players per room instance ("rio#1")
export const MAX_SHARDS = 8;           // instances per map
export const MAX_ROOMS = 20;           // room instances alive at the same time, all maps together
export const MAX_PLAYERS = 300;        // hard cap on everybody online, all rooms ("Cidade cheia, tente já já")
export const MAX_PER_IP = 8;           // connections / presences behind one address (households and CGNAT share IPs)

export const STARS = ['mimo', 'mimosa', 'morticia'];
export const ANIMS = ['idle', 'walk', 'dash', 'car'];
export const EMOTES = ['miau', 'dance', 'sit', 'wave'];
export const CARS = ['pink', 'gold', 'sedan', 'taxi', 'sport', 'pickup', 'cop', 'van', 'truck', 'limo'];
export const PHRASES = 12;             // quick phrases: only the index travels; the texts are on_p0..on_p11 in public/js/i18n.js
export const REPORT_REASONS = ['name', 'behavior', 'cheat', 'other'];
export const PAWS_PER_ROOM = 6;        // shared golden paws per room and per slot
export const PAW_SLOT_MS = 120_000;    // they all come back (somewhere else) every two minutes

export const MAX_COORD = 200000;       // simulation pixels (24 px = 1 m); every map fits many times over
export const MAX_SPEED = 620;          // px/s the server lets a cat or car travel (fastest car: 360, dash bursts ~520)
export const TICKET_MINUTES = 10;      // a ticket opens a connection (or polls) for this long; the client renews it
export const TICKET_RENEW_HOURS = 24;  // an expired ticket still proves "same guest" for this long (keeps id + nickname)

export const ID_RE = /^[ug][0-9a-f]{20}$/;
// One room per map: "city" (the neon home city) or the id of a real city (data/cities/index.json).
// New maps arrive all the time, so the id is checked by shape and the number of live rooms is capped.
export const ROOM_RE = /^([a-z][a-z0-9_]{1,23})(?:#([1-9]\d?))?$/;
export function splitRoom(v) {
  const m = typeof v === 'string' ? ROOM_RE.exec(v) : null;
  if (!m || (m[2] && Number(m[2]) > MAX_SHARDS)) return null;
  return { base: m[1], shard: m[2] ? Number(m[2]) : 0 };
}

/**
 * Picks the instance for a newcomer. `count` maps a live room ("rio#1") to its head count.
 * Fills #1 first, then #2... Returns null when the map (or the whole service) is full.
 */
export function chooseShard(base, count) {
  for (let k = 1; k <= MAX_SHARDS; k++) {
    const room = `${base}#${k}`, n = count.get(room) || 0;
    if (n >= ROOM_CAP) continue;
    if (!n && count.size >= MAX_ROOMS) return null;   // opening one more room would pass the cap
    return room;
  }
  return null;
}

// ---------- ticket ----------
// Vercel signs, the VM verifies: {i: public id, n: display name, u: account id or null, c: cat look, e: expiry}.
// The VM never sees the session cookie, the e-mail or the database of accounts.
const fallbackSecret = () => process.env.AUTH_SECRET || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const ticketSecretConfigured = () => !!(process.env.ONLINE_TICKET_SECRET || fallbackSecret());
// Without ONLINE_TICKET_SECRET the key is derived from the API's own secrets: enough for the polling
// transport (same deployment signs and verifies), useless for a VM, which must share the real key.
const key = () => createHash('sha256').update(`vp-online:${process.env.ONLINE_TICKET_SECRET || fallbackSecret() || 'dev'}`).digest();
const mac = (s) => createHmac('sha256', key()).update(s).digest('base64url');

/** Public id of an account: stable, but it does not lead back to the account without the key. */
export const userPublicId = (userId) => 'u' + createHmac('sha256', key()).update(`id:${userId}`).digest('hex').slice(0, 20);

export function signTicket({ id, name, userId = null, cat }, now = Date.now()) {
  const exp = Math.floor(now / 1000) + TICKET_MINUTES * 60;
  const payload = Buffer.from(JSON.stringify({ i: id, n: name, u: userId, c: cat, e: exp })).toString('base64url');
  return { ticket: `${payload}.${mac(payload)}`, exp };
}

/**
 * Returns {id, name, userId, cat, exp, expired} or null (missing, forged, malformed, or expired for
 * longer than `graceMs`). Callers that open a connection pass no grace; renewing a guest passes 24 h.
 */
export function verifyTicket(ticket, now = Date.now(), graceMs = 0) {
  if (typeof ticket !== 'string' || ticket.length > 1400) return null;
  const dot = ticket.indexOf('.');
  if (dot < 1) return null;
  const payload = ticket.slice(0, dot), got = Buffer.from(ticket.slice(dot + 1)), want = Buffer.from(mac(payload));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!p || !ID_RE.test(p.i) || typeof p.n !== 'string' || !p.c || typeof p.e !== 'number') return null;
  const left = p.e * 1000 - now;
  if (left + graceMs <= 0) return null;
  return { id: p.i, name: p.n, userId: p.u || null, cat: p.c, exp: p.e, expired: left <= 0 };
}
