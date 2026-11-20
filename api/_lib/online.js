// "Cidade Online" (lite): shared presence by polling. Limits, safe nicknames, the
// signed online token and the whitelist validation of a tick.
//
// Safety rules that live here, not in the client:
//   - there is NO free text anywhere: a name is either a registered cat name (which
//     already went through the profanity filter) or a nickname generated from the
//     lists below; phrases and emotes travel as indexes / keys of fixed lists;
//   - the cat look is the same whitelisted Spec the gallery uses (or one of the 3 stars);
//   - public ids never expose the account id or the e-mail.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { dbUrl } from './db.js';
import { fail } from './http.js';
import { validateSpec } from './validate.js';

export const TICK_MIN_MS = 800;        // at most one tick per player in this window (server-enforced)
export const VISIBLE_SECONDS = 10;     // others = states updated in the last 10 s
export const EXPIRE_SECONDS = 30;      // presence rows are deleted after 30 s without a tick
export const SWEEP_EVERY_MS = 20_000;  // how often one warm function instance runs the cleanup
export const ROOM_CAP = 30;            // players per room instance ("rio#1")
export const MAX_SHARDS = 8;           // instances per map
export const MAX_ROOMS = 80;           // room instances alive at the same time, all maps together
export const MAX_PLAYERS = 600;        // everybody online, all rooms
export const MAX_PER_IP = 8;           // presences behind one (hashed) address: households and CGNAT share IPs
export const MAX_BODY = 2048;          // bytes of JSON in a tick
export const MAX_OTHERS = 40;          // rows returned by a tick, whatever happens
export const TOKEN_HOURS = 12;
export const MAX_REPORTS_HOUR = 10;

export const STARS = ['mimo', 'mimosa', 'morticia'];
export const ANIMS = ['idle', 'walk', 'dash', 'car'];
export const EMOTES = ['miau', 'dance', 'sit', 'wave'];
export const CARS = ['pink', 'gold', 'sedan', 'taxi', 'sport', 'pickup', 'cop', 'van', 'truck', 'limo'];
export const PHRASES = 12;             // quick phrases: the texts are the on_p0..on_p11 keys of public/js/i18n.js
export const REPORT_REASONS = ['name', 'behavior', 'cheat', 'other'];
export const PAWS_PER_ROOM = 6;        // shared golden paws per room and per slot
export const PAW_SLOT_MS = 120_000;    // they all come back (somewhere else) every two minutes

// Generated nicknames: "Gato Veloz 123". 2 x 24 x 999 combinations, nothing typed by the player.
const NICK_A = ['Gato', 'Gata'];
const NICK_B = ['Veloz', 'Neon', 'Sapeca', 'Valente', 'Radical', 'Estelar', 'Elegante', 'Ninja', 'Surfista', 'Pirata',
  'Turbo', 'Feliz', 'Gentil', 'Brilhante', 'Sorridente', 'Astronauta', 'Skatista', 'Viajante', 'Dançante', 'Zen',
  'Arco-Íris', 'de Botas', 'da Praia', 'do Samba'];
export const NICK_RE = new RegExp(`^(${NICK_A.join('|')}) (${NICK_B.join('|')}) [1-9]\\d{0,2}$`, 'u');
export function nickname(seed) {
  // seed (a hex string) makes the nickname of an account stable; guests get a fresh draw
  const pick = (n, k) => (seed ? parseInt(seed.slice(k * 6, k * 6 + 6), 16) % n : randomInt(0, n));
  return `${NICK_A[pick(NICK_A.length, 0)]} ${NICK_B[pick(NICK_B.length, 1)]} ${1 + pick(999, 2)}`;
}

// ---------- signed token: who you are in the shared city ----------
const secret = () => createHash('sha256').update(`vp-online:${process.env.AUTH_SECRET || dbUrl() || 'dev'}`).digest();
const sign = (s) => createHmac('sha256', secret()).update(s).digest('base64url');
export const ID_RE = /^[ug][0-9a-f]{20}$/;
/** Public id of an account: stable, but neither the account id nor anything that leads back to it. */
export const userPublicId = (userId) => 'u' + createHmac('sha256', secret()).update(`id:${userId}`).digest('hex').slice(0, 20);
export const guestPublicId = () => 'g' + randomBytes(10).toString('hex');

export function makeToken({ id, name, userId = null }, now = Date.now()) {
  const exp = Math.floor(now / 1000) + TOKEN_HOURS * 3600;
  const payload = Buffer.from(JSON.stringify({ i: id, n: name, u: userId, e: exp })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, exp };
}
/** Returns {id, name, userId} or throws 401 {error: "token"} (missing, forged or expired). */
export function readOnlineToken(token, now = Date.now()) {
  const bad = () => fail(401, 'token');
  if (typeof token !== 'string' || token.length > 600) throw bad();
  const dot = token.indexOf('.');
  if (dot < 1) throw bad();
  const payload = token.slice(0, dot), mac = Buffer.from(token.slice(dot + 1)), want = Buffer.from(sign(payload));
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) throw bad();
  let p;
  try { p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw bad(); }
  if (!p || !ID_RE.test(p.i) || typeof p.n !== 'string' || !(p.e * 1000 > now)) throw bad();
  return { id: p.i, name: p.n, userId: p.u || null };
}

// ---------- rooms ----------
// One room per map: "city" (the neon home city) or the id of a real city (data/cities/index.json).
// New maps arrive all the time, so the id is checked by shape and the number of live rooms is capped.
export const ROOM_RE = /^([a-z][a-z0-9_]{1,23})(?:#([1-9]\d?))?$/;
export function parseRoom(v) {
  const m = typeof v === 'string' ? ROOM_RE.exec(v) : null;
  if (!m || (m[2] && Number(m[2]) > MAX_SHARDS)) throw fail(400, 'invalid', { field: 'room' });
  return { base: m[1], shard: m[2] ? Number(m[2]) : 0 };
}
/**
 * Picks the instance for a newcomer from `rows` = [{room, n, mine}] (live rooms, their head count and
 * how many presences share the caller's address). Fills #1 first, then #2...
 */
export function pickShard(base, rows) {
  let total = 0, mine = 0;
  const count = new Map();
  for (const r of rows) { total += Number(r.n); mine += Number(r.mine || 0); count.set(r.room, Number(r.n)); }
  if (total >= MAX_PLAYERS) throw fail(503, 'busy');
  if (mine >= MAX_PER_IP) throw fail(429, 'too-many');
  for (let k = 1; k <= MAX_SHARDS; k++) {
    const room = `${base}#${k}`, n = count.get(room) || 0;
    if (n >= ROOM_CAP) continue;
    if (!n && count.size >= MAX_ROOMS) break;       // opening one more room would pass the cap
    return room;
  }
  throw fail(503, 'busy');
}

// ---------- tick validation ----------
const invalid = (field) => fail(400, 'invalid', { field });
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

export function validateCatLook(v) {
  if (typeof v === 'string') {
    if (!STARS.includes(v)) throw invalid('cat');
    return { star: v };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid('cat');
  return { spec: validateSpec(v) };              // same whitelist as the gallery; throws 400 {field: "spec.*"}
}

/** Whitelists a tick body. Everything else in the body is ignored (including any "name"). */
export function validateTick(b, now = Date.now()) {
  const num = (k, max) => {
    const v = b[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > max) throw invalid(k);
    return v;
  };
  const out = { x: Math.round(num('x', 200000)), z: Math.round(num('z', 200000)) };
  const ry = num('ry', 1000);
  out.ry = Math.round(Math.atan2(Math.sin(ry), Math.cos(ry)) * 100) / 100;

  out.anim = b.anim == null ? 'idle' : b.anim;
  if (!ANIMS.includes(out.anim)) throw invalid('anim');
  out.car = null;
  if (out.anim === 'car') {
    if (!CARS.includes(b.car)) throw invalid('car');
    out.car = b.car;
  }

  const look = validateCatLook(b.cat);
  out.cat = JSON.stringify(look);
  out.cv = createHash('sha1').update(out.cat).digest('hex').slice(0, 8);

  out.emote = null; out.es = 0;
  if (b.emote != null) {
    if (!EMOTES.includes(b.emote)) throw invalid('emote');
    out.emote = b.emote; out.es = int(b.es, 0, 255) ?? 0;
  }
  out.phrase = null; out.ps = 0;
  if (b.phrase != null) {
    if (int(b.phrase, 0, PHRASES - 1) === null) throw invalid('phrase');
    out.phrase = b.phrase; out.ps = int(b.ps, 0, 255) ?? 0;
  }

  // golden paws picked up in the current slot: "slot:i,i" (a stale slot is simply dropped)
  out.paws = null;
  if (b.paws != null) {
    const p = b.paws, slot = Math.floor(now / PAW_SLOT_MS);
    if (typeof p !== 'object' || !Array.isArray(p.i) || p.i.length > PAWS_PER_ROOM || int(p.s, 0, 1e9) === null) throw invalid('paws');
    if (p.i.some((i) => int(i, 0, PAWS_PER_ROOM - 1) === null)) throw invalid('paws');
    if (Math.abs(p.s - slot) <= 1 && p.i.length) out.paws = `${p.s}:${[...new Set(p.i)].sort().join(',')}`;
  }

  // ids whose look the client does not have yet (looks are only sent on request: they rarely change)
  out.need = '';
  if (b.need != null) {
    if (!Array.isArray(b.need) || b.need.length > MAX_OTHERS || b.need.some((id) => !ID_RE.test(id))) throw invalid('need');
    out.need = b.need.join(',');
  }
  return out;
}

export function parsePaws(text) {
  const m = /^(\d+):([\d,]+)$/.exec(text || '');
  return m ? { s: Number(m[1]), i: m[2].split(',').map(Number) } : null;
}

/** A presence row -> what another player may know about a cat. Nothing else leaves the server. */
export function otherJson(r) {
  const o = { id: r.id, name: r.name, x: r.x, z: r.z, ry: Number(r.ry), anim: r.anim, cv: r.cv, age: Math.max(0, Number(r.age) || 0) };
  if (r.car) o.car = r.car;
  if (r.emote) { o.emote = r.emote; o.es = r.es; }
  if (r.phrase != null) { o.phrase = r.phrase; o.ps = r.ps; }
  const paws = parsePaws(r.paws);
  if (paws) o.paws = paws;
  if (r.cat) o.cat = typeof r.cat === 'string' ? JSON.parse(r.cat) : r.cat;
  return o;
}
