# Vice Paws — accounts, cat profiles and cloud save

Backend for player accounts. Players register **their cats**, not themselves. Personal data kept, in total:

| Data | Why | How it is kept |
|---|---|---|
| e-mail | identify the account, send codes | plain text in `vp_users`; returned only to its owner, never by a public endpoint |
| Google account id (`sub`) | "Sign in with Google" | opaque number in `vp_users.google_sub` (no name, no photo) |
| birth month/year + age band | ECA Digital (Lei 15.211/2025) and LGPD art. 14 | month/year AES-256-GCM encrypted (`birth_enc`), band in clear (`child`/`teen`/`adult`) |
| guardian e-mail (under 18 only) | approval (under 16) or notice (16-17) | AES-256-GCM encrypted in `vp_guardians` |

**There is no password and no document (CPF/RG) anywhere.** Retention: as long as the account exists; `DELETE /api/me` removes everything at once. Rights (access, correction, deletion) are served through `DELETE /api/me` or by e-mail to **jogo@mtec.tec.br**. The player-facing text is `public/privacy.html`.

- Vercel Node functions in `api/`, Neon Postgres, Resend for e-mails.
- Two ways in: **Sign in with Google** (ID token verified on the server) or a 6-digit code by e-mail; both end in the same HttpOnly session cookie.
- Age step on the first login of every account (new or legacy). Under 16: the account is "awaiting guardian" (guest/offline play only: no session, no ranking, no online, no purchases) until the guardian approves by a single-use link. 16-17: active, the guardian is notified.
- Everything is same-origin JSON. The client only needs `fetch` (the cookie travels by itself).

## Setup (owner)

1. **Database** — add the Neon integration to the Vercel project (or create a Neon database and copy its connection string). It sets `DATABASE_URL`. Tables are created automatically on the first request; `db/schema.sql` documents them.
2. **E-mail** — create a [Resend](https://resend.com) account, **verify a sending domain** (Domains → Add domain, then add the DNS records), and create an API key.
3. **Environment variables** in Vercel → Project → Settings → Environment Variables (Production and Preview), then redeploy:

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string (`POSTGRES_URL` is also accepted). Without it every endpoint answers `503 {"error":"offline"}`. |
| `RESEND_API_KEY` | yes | Resend API key. Without it `POST /api/auth/start` answers `503 {"error":"mail-offline"}`. |
| `MAIL_FROM` | yes, in practice | Sender on your verified domain, e.g. `Vice Paws <jogo@seudominio.com.br>`. The default is `Vice Paws <jogo@resend.dev>`: Resend's shared `resend.dev` domain is for testing and only delivers to the address that owns the Resend account, so real players will not get codes until this is set. |
| `GOOGLE_CLIENT_ID` | for Google sign-in | OAuth Client ID (see "Google sign-in setup" below). Public. When empty, `GET /api/auth/config` answers `{"googleClientId":null}` and the game hides the Google button (the e-mail code keeps working). |
| `AUTH_SECRET` | **required in production** | A long random string (16+ chars, e.g. `openssl rand -base64 48`). Keys the hashes of login codes and IPs and, through HKDF, the AES-256-GCM key for the birth month/year and guardian e-mail. In production (`VERCEL_ENV=production`) without it the age step answers `503 misconfigured`. **Do not change it later**: encrypted fields would become unreadable. |
| `PUBLIC_URL` | no | Base URL used in the guardian e-mail link. Default `https://vice-paws.vercel.app`. |
| `ADMIN_EMAILS` | no | Comma separated e-mails of the owner(s); `GET /api/me` adds `admin: true` ("Edição dos Mimos"). Nothing else. |
| `ALLOWED_ORIGINS` | no | Extra allowed origins, comma separated, e.g. `https://vicepaws.app`. Only needed if the game is served from a different origin than the API. |

Notes:
- **Function count**: the Hobby plan allows 12 functions per deployment. The secure-accounts work added **no** function file (Google, age and guardian actions live in `auth/[action].js`). Note: today `api/` holds 13 function files (`auth/[action]`, `cats/[action]`, `cats/index`, `community`, `me`, `online/[action]`, `pix/create`, `pix/status`, `pix/webhook`, `rewards/[action]`, `save`, `scores`, `style`), which is already over 12; merge some (for example `pix/*` into one dynamic file) before deploying on Hobby. Files under `api/_lib/` are not functions.
- **Origin check**: mutating requests are accepted from `https://vice-paws.vercel.app`, preview deployments `https://vice-paws-*.vercel.app`, `http://localhost:*`, the request's own host (custom domains work with no configuration) and `ALLOWED_ORIGINS`.
- **Tests**: `npm test` (no install needed, Node 20+). They use an in-memory stand-in for `neon()` and a mocked Resend. To also prove the SQL on a real, throwaway Postgres: `VP_TEST_PG_URL=postgres://user@127.0.0.1:5432/scratch npm test` (it drops the `vp_*` account tables of that database).

## Google sign-in setup (owner)

1. Open [Google Cloud Console](https://console.cloud.google.com/), select or create a project, then **APIs & Services → OAuth consent screen**: user type *External*, app name "Vice Paws", support e-mail jogo@mtec.tec.br, scopes: only the defaults `openid`, `email`, `profile`. Add the privacy policy link `https://vice-paws.vercel.app/privacy.html`, then publish the app (*In production*), otherwise only test users can sign in.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**, application type **Web application**, name "Vice Paws web".
3. **Authorized JavaScript origins**: `https://vice-paws.vercel.app` (add your custom domain and `http://localhost:3000` for local tests if you want). Leave *Authorized redirect URIs* empty: the button uses the ID-token flow, not redirects.
4. Copy the **Client ID** (`123…apps.googleusercontent.com`; there is no secret to store).
5. Vercel → Project → Settings → Environment Variables: `GOOGLE_CLIENT_ID` = that value (Production and Preview), then redeploy. Preview deployments have other origins: add them to the authorized origins or test Google only in production.
6. Check: `curl https://vice-paws.vercel.app/api/auth/config` returns the client id, and the account screen shows the Google button.

The server never trusts the browser: `POST /api/auth/google` verifies the RS256 signature against Google's JWKS (`https://www.googleapis.com/oauth2/v3/certs`, cached per its `cache-control`), `aud` = `GOOGLE_CLIENT_ID`, `iss` in `accounts.google.com` / `https://accounts.google.com`, `exp`/`iat` with 5 minutes of skew and `email_verified === true`. Only the e-mail and the `sub` are used.

## Conventions (client)

- Send JSON with `content-type: application/json`. Use relative URLs so the cookie is first-party; nothing else is needed (`credentials: 'same-origin'` is fetch's default).
- Errors are always `{"error": "<code>", ...}` with a matching HTTP status:

| Status | `error` | Meaning |
|---|---|---|
| 400 | `invalid` + `field` | Validation failed; `field` names the culprit (`name`, `spec.size`, `email`, ...). |
| 400 | `invalid-json`, `invalid-code`, `invalid-image` | Unreadable body / wrong, expired or used code / unreadable image. |
| 401 | `unauthorized` | No valid session: show the login screen. |
| 403 | `origin` | Request did not come from the game. |
| 404 | `not-found` | Unknown route, or a cat that is not yours. |
| 405 | `method` | |
| 409 | `cat-limit` + `max` | Already 5 cats. |
| 413 | `too-large` / `image-too-large` | Save over 64KB / image over 300KB. |
| 415 | `unsupported-image` + `hint` | Image is not a (non-interlaced) PNG. |
| 422 | `moderation` + `field` | Blocked word in `name`, `bio` or `instagram`. |
| 429 | `rate-limit` / `too-many-attempts` | Too many codes requested / too many wrong codes. |
| 502 | `mail` | Resend refused or timed out; let the player retry. |
| 503 | `offline` / `mail-offline` | Database / e-mail not configured: keep playing offline (local save). |
| 500 | `server` | Unexpected. |

- All text you get back (`name`, `bio`, `instagram`) is sanitised but is still **plain text**: render it with `textContent`, never `innerHTML`.

## Login

### `GET /api/auth/config`

`200 { "googleClientId": "…apps.googleusercontent.com" | null }`. Public (a client id is not a secret).

### `POST /api/auth/google`

```json
{ "credential": "<Google ID token>", "lang": "pt" }
```
`200 { "ok": true, "user": { "id", "email", "lang", "createdAt", "status": "active", "needsAge": true|false } }` and the session cookie (the session of the cookie sent with the request, if any, is dropped: the session is rotated). Looks the user up by Google `sub`, then by e-mail (an existing e-mail-code account gets linked), otherwise creates it. If the account is **awaiting guardian**: `200 { "ok": true, "awaitingGuardian": true }` and no cookie. Every verification failure is the same `401 { "error": "invalid-credential" }`; `409 account-conflict` if that e-mail is linked to a different Google account; `503 google-offline` (no `GOOGLE_CLIENT_ID`), `502 google-unavailable` (Google's keys unreachable).

### `POST /api/auth/start`

```json
{ "email": "dona@example.com", "lang": "pt" }
```
`lang` is `pt` (default) or `en` and picks the e-mail language.

```json
200 { "ok": true, "expiresInMinutes": 10 }
```
Limits: 5 codes per hour per e-mail, 20 per hour per IP (`429 {"error":"rate-limit","retryAfterMinutes":60}`). Requesting a new code invalidates the previous one.

### `POST /api/auth/verify`

```json
{ "email": "dona@example.com", "code": "042917" }
```
```json
200 { "ok": true, "user": { "id": "7b0c…", "email": "dona@example.com", "lang": "pt", "createdAt": "2026-11-20T01:10:00.000Z", "status": "active", "needsAge": true } }
```
Also sets `Set-Cookie: vp_session=…; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=5184000` (60 days), rotating any previous session of that browser. The account is created on the first successful verify (people without Google). A wrong code is `400 invalid-code`; after 5 wrong tries the code is locked (`429 too-many-attempts`). An account awaiting its guardian gets `200 { "ok": true, "awaitingGuardian": true }` and no cookie.

### `POST /api/auth/age` (needs the session; once per account)

```json
{ "birth": "2012-05", "guardianEmail": "responsavel@example.com" }
```
`birth` is month/year (`YYYY-MM` or `MM/YYYY`). Age is rounded to the protective side (without the day, a person counts as younger until their birthday month is over). Until it is given, `/api/cats`, `/api/save`, `/api/rewards/*` answer `403 { "error": "age-required" }` and `/api/online` treats the player as a guest; `GET /api/me` shows `needsAge: true`.
- 18 or older: `200 { "ok": true, "band": "adult", "user": … }`.
- 16-17 (`guardianEmail` required, not the player's own): `200 { "band": "teen", "mailSent": true }`; the account is active and the guardian receives a notice.
- under 16 (`guardianEmail` required): `200 { "band": "child", "awaitingGuardian": true, "mailSent": true }`; all sessions are dropped, the cookie is cleared and the guardian receives an approval e-mail with `…/guardian.html#t=<token>`. The token is 32 random bytes (only its SHA-256 is stored), valid 7 days, single use, kept in the URL **fragment** so it never reaches a server log or a Referer.
- Birth month/year can be written only once (`409 already-set` afterwards): nobody can "grow up" by calling it again. Corrections go through jogo@mtec.tec.br. At most 8 guardian mails per guardian address per day (`429`).

### `POST /api/auth/guardian-approve`

`{ "token": "<43 chars>" }` → `200 { "ok": true }` and the account becomes active (the player is told by e-mail); any invalid, used or expired token is `400 invalid-token`. `public/guardian.html` is the page of the e-mail link: opening it does nothing, only its button sends the POST (mail scanners that open links cannot burn the token).

### `POST /api/auth/guardian-resend`

`{ "email": "<the player's e-mail>" }` → always `200 { "ok": true }` (no way to tell whether the account exists; the response takes at least 700 ms). If that account is awaiting a guardian, a fresh link is sent (older links stop working); at most 3 per hour.

### `POST /api/auth/logout`

No body. `200 {"ok": true}` and the cookie is cleared (only this device's session).

### `GET /api/me`

```json
200 { "user": { "id": "…", "email": "…", "lang": "pt", "createdAt": "…", "status": "active", "needsAge": false }, "cats": [ /* Cat, oldest first */ ] }
401 { "error": "unauthorized" }
```
Call it on boot to know whether the player is logged in.

### `DELETE /api/me`

Deletes the account and all personal data: the e-mail, `google_sub`, the encrypted birth month/year, the guardian record and tokens, cats, save, sessions, pending codes and online presence rows; a notice is e-mailed to the old address. `vp_ranking` is keyed by a nickname chosen in the game (not by account), so rows whose name equals one of the player's cat names are renamed to `anon-xxxxxxxx` (score kept, name gone). Works before the age step too. `200 {"ok": true, "deleted": true}`. The UI asks for confirmation: it cannot be undone.

## Cats

```ts
type Cat = {
  id: string;            // uuid
  name: string;          // 1–20 chars: letters, digits, space and ' . _ -
  breed: 'persa' | 'siames' | 'vira-lata' | 'srd' | 'maine-coon' | 'sphynx' | 'angora'
       | 'bengal' | 'ragdoll' | 'british' | 'sem-raca' | 'outro';
  spec: Spec;
  bio: string;           // 0–120 chars
  instagram: string | null;   // handle without "@", lowercase; never fetched by the server
  isPublic: boolean;     // false keeps the cat out of the gallery (default true)
  createdAt: string; updatedAt: string;   // ISO 8601
};

type Spec = {            // every key is optional on input; defaults in parentheses
  size: number;          // 0.8–1.2 (1), rounded to 2 decimals
  faceShape: 'round' | 'flat' | 'wedge' | 'square' | 'long';      // ('round')
  furBase: string;       // '#rrggbb' ('#d9a066'); '#rgb' and uppercase are accepted and normalised
  pattern: 'solid' | 'calico' | 'tuxedo' | 'tabby' | 'bicolor' | 'pointed';   // ('solid')
  patchColors: string[]; // up to 4 hex colours ([])
  eyeColor: string;      // hex ('#7bc86c')
  accessories: Array<'collar' | 'bell' | 'bow' | 'bowtie' | 'bandana' | 'scarf' | 'sunglasses'
                   | 'glasses' | 'hat' | 'cap' | 'crown' | 'flower' | 'chain'>;   // up to 4 ([])
};
```
Unknown keys (in the body or in `spec`) are ignored; invalid values are rejected with `400 {"error":"invalid","field":"spec.size"}`. The lists live in `api/_lib/validate.js` (`FACE_SHAPES`, `ACCESSORIES`, ...): if the 3D model needs other shapes or accessories, change them there and here.

### `GET /api/cats` → `200 { "cats": Cat[] }`

### `POST /api/cats`

```json
{
  "name": "Mimosa", "breed": "vira-lata", "bio": "A brava da casa.", "instagram": "@mimo.mimosa.morticia",
  "isPublic": true,
  "spec": { "size": 1.1, "faceShape": "round", "furBase": "#f4a259", "pattern": "calico",
            "patchColors": ["#ffffff", "#222222"], "eyeColor": "#7bc86c", "accessories": ["bow"] }
}
```
```json
201 { "ok": true, "cat": { "id": "…", "name": "Mimosa", … } }
409 { "error": "cat-limit", "max": 5 }
422 { "error": "moderation", "field": "bio" }
```
Only `name` and `breed` are required.

### `PUT /api/cats?id=<uuid>`

Same body as POST. It **replaces** the whole profile (omitted optional fields go back to their defaults), so send the full cat. `200 {"ok": true, "cat": Cat}`, `404` if the cat is not yours. The id may also be sent as `"id"` in the body.

### `DELETE /api/cats?id=<uuid>` → `200 { "ok": true }`

### `GET /api/cats/public?limit=24` — "Cidade dos Gatos"

No login needed. Newest public cats first; `limit` 1–60 (default 24). Cached at the edge for 30s.

```json
200 { "cats": [ { "id": "…", "name": "Mimosa", "breed": "vira-lata", "spec": { … }, "bio": "…", "instagram": "mimo.mimosa.morticia", "createdAt": "…" } ] }
```
No e-mail and no owner id are ever included.

### `POST /api/cats/suggest-colors` (optional, needs login)

```json
{ "image": "data:image/png;base64,iVBORw0KGgo…" }
```
```json
200 {
  "spec": { "furBase": "#18161a", "patchColors": ["#f4f4f0"], "pattern": "tuxedo" },
  "palette": [ { "color": "#18161a", "share": 0.71 }, { "color": "#f4f4f0", "share": 0.29 } ]
}
```
- The image must be a **PNG data URL of at most 300KB**. JPEG/WebP are answered with `415 {"error":"unsupported-image","hint":"png"}`: there is no JPEG decoder on the server (no image dependency was added), so shrink the photo in the browser first, which also keeps the upload tiny:

```js
async function photoToDataUrl(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 96 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/png');   // ~10–25KB
}
```
- The server runs a k-means on a centre-weighted 48×48 sample, so results are best when the cat fills the middle of the picture (let the player crop). Transparent pixels are ignored.
- `spec` is only a suggestion (a partial `Spec`, valid as-is in POST/PUT): `furBase` is the dominant colour, `patchColors` the next ones, `pattern` a heuristic guess. Show it in the editor and let the player adjust.
- The photo is processed in memory and never stored or logged.

## Cloud save

### `GET /api/save`

```json
200 { "data": { "level": 7, "stars": [3, 2, 3] }, "updatedAt": "2026-11-20T01:12:00.000Z" }
200 { "data": null, "updatedAt": null }
```

### `PUT /api/save`

```json
{ "data": { "level": 8, "stars": [3, 2, 3, 1] } }
```
```json
200 { "ok": true, "updatedAt": "2026-11-20T01:15:00.000Z" }
413 { "error": "too-large", "maxBytes": 65536 }
```
`data` must be a JSON object of at most 64KB (UTF-8 bytes of its JSON). **Last write wins**: the server overwrites and stamps `updatedAt`. Suggested client flow: keep `updatedAt` next to the local save; on login `GET /api/save` and, if the cloud copy is newer than what this device last synced, load it (or ask the player); afterwards `PUT` on mission end, debounced.

## Cidade Online (`api/online/[action].js`)

Shared presence for the online free-roam mode. Design, limits and cost notes: `DESIGN.md` §10.

| Route | Body / query | Answer |
|---|---|---|
| `GET /api/online/ticket` | `?cat=mimo\|mimosa\|morticia`, or `?catId=<uuid>` (own registered cat, needs login), or `?spec=<json Spec>`; optional `&wear=a,b` (outfit item ids, max 6) and `&lv=1..100` (level badge); optional header `x-vp-ticket: <previous ticket>` keeps a guest's id and nickname | `{you: {id, name, guest}, cat, ticket, exp, ttl}` |
| `POST /api/online/tick` | `{ticket, room, x, z, ry, anim, car?, emote?, es?, phrase?, ps?, paws?, trade?: {to, give, st}, need?, idle?}` | `{you: {id}, room, others: [...], n, cap, ts, paw}` |
| `POST /api/online/report` | `{ticket, targetId, reason, room?}` | `{ok, stored}` |
| `POST /api/online/leave` | `{ticket}` | `{ok}` |

Errors: `401 ticket` (ask for a new ticket), `429 rate-limit` (more than one tick per 0.8 s) or `429 too-many` (presences per address), `503 busy` (city full), `503 offline` (no database, or `ONLINE_ENABLED=false`), `413 too-large`, `400 invalid` + `field`.

- `ONLINE_ENABLED=false` turns the whole mode off at once. `ONLINE_TICKET_SECRET` is only needed with the optional real-time server (it must be the same on the VM); without it the ticket key is derived from `AUTH_SECRET` / `DATABASE_URL`.
- Function count: this is the 10th function of the deployment (the Hobby plan allows 12).
- Review reports with `select created_at, reason, target_name, target_id, target_user_id, room, source from vp_online_reports order by created_at desc limit 50;`

## Typical client flow

```js
const api = (path, method = 'GET', body) =>
  fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body && JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));

const me = await api('/api/me');                       // 401 -> guest, 503 -> offline mode
await api('/api/auth/google', 'POST', { credential, lang });   // or: start + verify with the e-mail code
await api('/api/auth/start', 'POST', { email, lang }); // player types the code from the e-mail
const { ok, user } = await api('/api/auth/verify', 'POST', { email, code });
if (user.needsAge) await api('/api/auth/age', 'POST', { birth: '2012-05', guardianEmail });
const { cat } = await api('/api/cats', 'POST', { name, breed, spec });
await api('/api/save', 'PUT', { data: progress });
```

## Files

| Path | What |
|---|---|
| `api/auth/[action].js` | `config`, `google`, `start`, `verify`, `age`, `guardian-approve`, `guardian-resend`, `logout` |
| `api/_lib/google.js` | Google ID-token verification (node:crypto, JWKS cache) |
| `api/_lib/secure.js` | AES-256-GCM (HKDF key from `AUTH_SECRET`), keyed hash, age rules |
| `public/guardian.html` | page of the guardian's approval link |
| `api/me.js` | profile + account deletion |
| `api/cats/index.js` | CRUD of the player's cats |
| `api/cats/[action].js` | `public` gallery, `suggest-colors` |
| `api/save.js` | cloud save |
| `api/_lib/db.js` | Neon client + lazy schema |
| `api/_lib/http.js` | handler wrapper, errors, Origin check |
| `api/_lib/auth.js` | codes, sessions, cookie |
| `api/_lib/mail.js` | Resend + PT/EN e-mail |
| `api/_lib/validate.js`, `profanity.js` | whitelists and moderation |
| `api/_lib/colors.js` | PNG reader + k-means |
| `api/online/[action].js`, `api/_lib/online.js` | Cidade Online: ticket, polling tick, report, leave |
| `api/_lib/protocol.mjs` | lists, limits and the ticket shared with the optional real-time server |
| `db/schema.sql` | schema reference |
| `public-docs-privacy.md` | privacy note (PT) to show in the game |
| `tests/accounts.test.mjs` | handler tests |
| `tests/secure-accounts.test.mjs` | Google (mock JWKS), age, guardian flow, deletion, privacy |
