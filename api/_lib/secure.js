// Security primitives for accounts: password rules + scrypt, CPF / foreign documents,
// AES-256-GCM field encryption, keyed document hashes, age rules and TOTP (RFC 6238).
// Nothing in here logs anything: passwords, codes, tokens and documents never reach a log.
import {
  createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, scrypt, timingSafeEqual,
} from 'node:crypto';
import { dbUrl } from './db.js';
import { fail } from './http.js';

// ---------- keys ----------
/** AUTH_SECRET is mandatory in production for the personal-data features (no silent fallback there). */
export function secretMaterial() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL_ENV === 'production') throw fail(503, 'misconfigured');
  return `dev-only:${dbUrl() || 'dev'}`;
}
const subkey = (info) => Buffer.from(hkdfSync('sha256', secretMaterial(), 'vice-paws-accounts-v1', info, 32));

/** Keyed hash for lookups/uniqueness (documents, rate-limit keys). Domain separated via HKDF. */
export const keyedHash = (domain, value) =>
  createHmac('sha256', subkey('vp-hmac:v1')).update(`${domain}\u0000${value}`).digest('hex');

/** AES-256-GCM. Output "v1.iv.tag.ciphertext" (base64url). `aad` binds a ciphertext to its purpose. */
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

// ---------- password hashing ----------
export const SCRYPT = { N: 1 << 15, r: 8, p: 1, saltLen: 16, keyLen: 64 };
const MAXMEM = 128 * SCRYPT.N * SCRYPT.r * 2;   // Node's default limit (32 MiB) equals the cost: give headroom
export const MAX_PASSWORD = 128;                // bounds the work an attacker can make us do

const scryptAsync = (pw, salt, N, r, p, keyLen) => new Promise((resolve, reject) =>
  scrypt(String(pw).normalize('NFKC'), salt, keyLen, { N, r, p, maxmem: MAXMEM }, (e, k) => (e ? reject(e) : resolve(k))));

/** -> "scrypt$N$r$p$salt$hash" (salt/hash base64url). */
export async function hashPassword(password) {
  const salt = randomBytes(SCRYPT.saltLen);
  const key = await scryptAsync(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keyLen);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > (1 << 16) || r < 1 || r > 16 || p < 1 || p > 4) return false;
  try {
    const salt = Buffer.from(parts[4], 'base64url'), want = Buffer.from(parts[5], 'base64url');
    if (!want.length || want.length > 128) return false;
    const got = await scryptAsync(String(password).slice(0, MAX_PASSWORD), salt, N, r, p, want.length);
    return got.length === want.length && timingSafeEqual(got, want);
  } catch { return false; }
}

let dummy = null;
/** Burns the same CPU as a real check when the account does not exist (no timing oracle on e-mails). */
export async function fakeVerify(password) {
  dummy ??= await hashPassword('vice-paws-dummy-password');
  await verifyPassword(password, dummy);
  return false;
}

// ---------- password rules ----------
const COMMON = `123456 12345678 123456789 1234567890 12345 1234567 111111 000000 123123 654321 666666 121212 112233 987654321 123321 159753
password password1 password12 password123 passw0rd p@ssw0rd p@ssword pass1234 senha senha123 senha1234 senha12345 minhasenha minhasenha123 mudar123 mudar@123 trocar123
qwerty qwerty12 qwerty123 qwertyuiop qwerty1234 qazwsx qazwsx123 asdfgh asdfghjk asdfghjkl asdf1234 zxcvbnm zxcvbn1 1q2w3e4r 1q2w3e4r5t 1qaz2wsx q1w2e3r4 q1w2e3r4t5 abc123 abc12345 abcd1234 abcdefg1 abcdefgh
iloveyou iloveyou1 teamo teamo123 teamo1234 amor1234 amor12345 meuamor123 princesa princesa123 gatinho gatinho123 gatinha123 gatos123 mimo1234 mimosa123 morticia
brasil brasil123 brasil1234 brasileiro flamengo flamengo1 corinthians palmeiras palmeiras1 saopaulo santos123 vasco1898 gremio123 cruzeiro1 botafogo1 fluminense
admin admin123 admin1234 administrator root1234 toor1234 letmein letmein1 welcome welcome1 welcome123 login123 master master123 hello123 hello1234 monkey monkey123 dragon dragon123
football football1 baseball1 soccer123 shadow shadow123 superman batman123 trustno1 sunshine sunshine1 princess princess1 charlie charlie1 michael michael1 jordan23 ashley123 jessica1
daniel123 gabriel123 lucas1234 pedro1234 felipe123 rafael123 mateus123 joao1234 maria123 ana12345 julia123 camila123 bruna123 amanda123 fernanda1 mariana123 gustavo123 bruno1234
internet internet1 computador computador1 google123 facebook1 instagram instagram1 whatsapp whatsapp1 tiktok123 youtube123 minecraft minecraft1 roblox123 fortnite1 freefire123 pokemon1
changeme changeme1 default123 test1234 teste123 teste1234 testing123 user1234 guest123 qwe123qwe qweasdzxc qweasd123 1234qwer 1234abcd a1b2c3d4 a1234567 a12345678 aa123456 aaaa1111
11111111 22222222 12341234 12345678a 1234567a 123456a 123456789a 123456abc 987654321a 0123456789 01234567 00000000 99999999 88888888 77777777 55555555 66666666 69696969 12121212 13131313
vicepaws vicepaws1 vice-paws vicepaws123 mtec1234 mtec12345`.split(/\s+/).filter(Boolean);
export const COMMON_PASSWORDS = new Set(COMMON);

/**
 * Returns null when the password is acceptable, otherwise a stable code:
 * weak-short, weak-long, weak-no-letter, weak-no-number, weak-common, weak-email.
 */
export function passwordProblem(password, email) {
  const p = String(password ?? '');
  if (p.length < 8) return 'weak-short';
  if (p.length > MAX_PASSWORD) return 'weak-long';
  if (!/\p{L}/u.test(p)) return 'weak-no-letter';
  if (!/\p{N}/u.test(p)) return 'weak-no-number';
  const low = p.toLowerCase();
  const stripped = low.replace(/[\d\W_]+$/u, '');           // "password99!" -> "password"
  if (COMMON_PASSWORDS.has(low) || (stripped.length >= 4 && COMMON_PASSWORDS.has(stripped)) || /^(.)\1+$/.test(low)) return 'weak-common';
  const mail = String(email || '').toLowerCase();
  const local = mail.split('@')[0];
  if ((local.length >= 3 && low.includes(local)) || (mail && low.includes(mail))) return 'weak-email';
  return null;
}

// ---------- CPF and foreign documents ----------
export const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');

/** CPF with check digits; repeated-digit CPFs (111.111.111-11 ...) are rejected. Accepts masked input. */
export function validCpf(input) {
  const s = String(input ?? '');
  if (!/^[\d.\-\s]+$/.test(s)) return false;
  const d = digitsOnly(s);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}
export const maskCpf = (input) => { const d = digitsOnly(input); return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`; };

export const DOC_TYPES = ['passport', 'national-id'];
export const normalizeCountry = (v) => {
  const c = String(v ?? '').trim().toUpperCase() || 'BR';
  return /^[A-Z]{2}$/.test(c) ? c : null;
};
/** Foreign document number: 4-20 alphanumerics (spaces, dashes, dots and slashes are ignored). */
export function normalizeDocNumber(v) {
  const n = String(v ?? '').replace(/[\s\-./]/g, '').toUpperCase();
  return /^[A-Z0-9]{4,20}$/.test(n) ? n : null;
}
export function maskDoc(number) {
  const n = String(number);
  return n.length >= 8 ? '*'.repeat(n.length - 2) + n.slice(-2) : '*'.repeat(n.length);
}

/**
 * Validates the identity part of a profile.
 * -> { country, docType, docNumber, hash, mask } or throws fail(400, 'invalid', {field}).
 * BR: CPF (docType 'cpf'); other countries: passport / national-id.
 */
export function parseIdentity(body) {
  const country = normalizeCountry(body.country);
  if (!country) throw fail(400, 'invalid', { field: 'country' });
  if (country === 'BR') {
    if (!validCpf(body.cpf)) throw fail(400, 'invalid', { field: 'cpf' });
    const d = digitsOnly(body.cpf);
    return { country, docType: 'cpf', docNumber: d, hash: keyedHash('cpf', d), mask: maskCpf(d) };
  }
  if (!DOC_TYPES.includes(body.docType)) throw fail(400, 'invalid', { field: 'docType' });
  const number = normalizeDocNumber(body.docNumber);
  if (!number) throw fail(400, 'invalid', { field: 'docNumber' });
  return { country, docType: body.docType, docNumber: number, hash: keyedHash('doc', `${country}:${body.docType}:${number}`), mask: maskDoc(number) };
}

// ---------- age ----------
/** Accepts YYYY-MM-DD or DD/MM/YYYY. -> {y, m, d} for a real date that is not in the future, else null. */
export function parseBirth(v, now = new Date()) {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s), y, mo, d;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt.getTime() > now.getTime()) return null;
  return { y, m: mo, d };
}
export function ageOn(b, now = new Date()) {
  const age = now.getUTCFullYear() - b.y;
  const before = now.getUTCMonth() + 1 < b.m || (now.getUTCMonth() + 1 === b.m && now.getUTCDate() < b.d);
  return before ? age - 1 : age;
}
/** 'child' (<16: guardian approval), 'teen' (16-17: own CPF, guardian notified), 'adult'. */
export const ageBand = (age) => (age < 16 ? 'child' : age < 18 ? 'teen' : 'adult');
export const birthIso = (b) => `${b.y}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;

// ---------- TOTP (RFC 6238: HMAC-SHA1, 30 s step, 6 digits) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = ((val << 8) | b) & 0xffff; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function unbase32(s) {
  let bits = 0, val = 0; const out = [];
  for (const ch of String(s).replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch); if (i < 0) throw new Error('b32');
    val = ((val << 5) | i) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
export const newTotpSecret = () => base32(randomBytes(20));
export function hotp(secretB32, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', unbase32(secretB32)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}
/** -> the matching time step (number) or null. Window of +-1 step for clock drift. */
export function totpCheck(secretB32, code, now = Date.now()) {
  const c = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const step = Math.floor(now / 30000);
  let found = null;
  for (const s of [step - 1, step, step + 1]) {
    if (timingSafeEqual(Buffer.from(hotp(secretB32, s)), Buffer.from(c)) && found === null) found = s;
  }
  return found;
}
export const otpauthUrl = (secretB32, account) =>
  `otpauth://totp/${encodeURIComponent(`Vice Paws:${account}`)}?secret=${secretB32}&issuer=${encodeURIComponent('Vice Paws')}&algorithm=SHA1&digits=6&period=30`;

export const sha256hex = (s) => createHash('sha256').update(s).digest('hex');
