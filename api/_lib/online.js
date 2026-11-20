// "Cidade Online": what only the Vercel side needs (safe nicknames, the look of a cat, the
// whitelist of a polling tick). Lists, limits and the ticket are shared with the real-time
// server and live in server/lib/protocol.mjs.
//
// Safety rules that live on the server, not in the client:
//   - there is NO free text anywhere: a name is either a registered cat name (which already went
//     through the profanity filter) or a nickname generated from the lists below; phrases and
//     emotes travel as indexes / keys of fixed lists;
//   - the cat look is the same whitelisted Spec the gallery uses (or one of the 3 stars);
//   - public ids never expose the account id or the e-mail.
import { randomBytes, randomInt } from 'node:crypto';
import { fail } from './http.js';
import { validateSpec } from './validate.js';
import {
  ANIMS, CARS, EMOTES, PHRASES, PAWS_PER_ROOM, PAW_SLOT_MS, MAX_COORD, MAX_PLAYERS, MAX_PER_IP, STARS, ID_RE,
  splitRoom, chooseShard, verifyTicket,
} from '../../server/lib/protocol.mjs';

export * from '../../server/lib/protocol.mjs';

export const TICK_MIN_MS = 800;        // at most one tick per player in this window (server-enforced)
export const VISIBLE_SECONDS = 10;     // others = states updated in the last 10 s
export const EXPIRE_SECONDS = 30;      // presence rows are deleted after 30 s without a tick
export const SWEEP_EVERY_MS = 20_000;  // how often one warm function instance runs the cleanup
export const MAX_BODY = 2048;          // bytes of JSON in a tick
export const MAX_OTHERS = 40;          // rows returned by a tick, whatever happens
export const MAX_REPORTS_HOUR = 10;

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
export const guestPublicId = () => 'g' + randomBytes(10).toString('hex');

const invalid = (field) => fail(400, 'invalid', { field });
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** "mimo" | "mimosa" | "morticia" | Spec  ->  {star} | {spec} (the gallery whitelist; throws 400). */
export function validateCatLook(v) {
  if (typeof v === 'string') {
    if (!STARS.includes(v)) throw invalid('cat');
    return { star: v };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid('cat');
  return { spec: validateSpec(v) };
}

/** Reads the ticket of a request or throws 401 {error: "ticket"}: the client then asks for a new one. */
export function requireTicket(ticket, now = Date.now()) {
  const t = verifyTicket(ticket, now);
  if (!t) throw fail(401, 'ticket');
  return t;
}

export function parseRoom(v) {
  const r = splitRoom(v);
  if (!r) throw invalid('room');
  return r;
}

/** Instance for a newcomer from `rows` = [{room, n, mine}] (live rooms, head count, presences sharing the caller's address). */
export function pickShard(base, rows) {
  let total = 0, mine = 0;
  const count = new Map();
  for (const r of rows) { total += Number(r.n); mine += Number(r.mine || 0); count.set(r.room, Number(r.n)); }
  if (total >= MAX_PLAYERS) throw fail(503, 'busy');
  if (mine >= MAX_PER_IP) throw fail(429, 'too-many');
  const room = chooseShard(base, count);
  if (!room) throw fail(503, 'busy');
  return room;
}

/** Whitelists a tick body. Everything else in the body is ignored (including any "name" or "cat"). */
export function validateTick(b, now = Date.now()) {
  const num = (k, max) => {
    const v = b[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > max) throw invalid(k);
    return v;
  };
  const out = { x: Math.round(num('x', MAX_COORD)), z: Math.round(num('z', MAX_COORD)) };
  const ry = num('ry', 1000);
  out.ry = Math.round(Math.atan2(Math.sin(ry), Math.cos(ry)) * 100) / 100;

  out.anim = b.anim == null ? 'idle' : b.anim;
  if (!ANIMS.includes(out.anim)) throw invalid('anim');
  out.car = null;
  if (out.anim === 'car') {
    if (!CARS.includes(b.car)) throw invalid('car');
    out.car = b.car;
  }

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

  // ids whose name and look the client does not have yet (sent only on request: they never change)
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
  const o = { id: r.id, x: r.x, z: r.z, ry: Number(r.ry), anim: r.anim, age: Math.max(0, Number(r.age) || 0) };
  if (r.car) o.car = r.car;
  if (r.emote) { o.emote = r.emote; o.es = r.es; }
  if (r.phrase != null) { o.phrase = r.phrase; o.ps = r.ps; }
  const paws = parsePaws(r.paws);
  if (paws) o.paws = paws;
  if (r.cat) { o.name = r.name; o.cat = typeof r.cat === 'string' ? JSON.parse(r.cat) : r.cat; }
  return o;
}
