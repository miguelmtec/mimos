# Vice Paws — accounts, cat profiles and cloud save

Backend for player accounts. Players register **their cats**, not themselves: the only personal datum is the e-mail, and it is never returned by any public endpoint.

- Vercel Node functions in `api/`, Neon Postgres, Resend for the login e-mail.
- No password: a 6-digit code by e-mail, then an HttpOnly session cookie.
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
| `AUTH_SECRET` | recommended | Any long random string. Keys the hashes of login codes and IPs. Falls back to a value derived from `DATABASE_URL`. |
| `ALLOWED_ORIGINS` | no | Extra allowed origins, comma separated, e.g. `https://vicepaws.app`. Only needed if the game is served from a different origin than the API. |

Notes:
- **Function count**: the Vercel Hobby plan allows 12 functions per deployment. This API adds 5 (`auth/[action]`, `me`, `cats/index`, `cats/[action]`, `save`) to the existing 4 (`scores`, `pix/*`), so 9 in total. Files under `api/_lib/` are not functions.
- **Origin check**: mutating requests are accepted from `https://vice-paws.vercel.app`, preview deployments `https://vice-paws-*.vercel.app`, `http://localhost:*`, the request's own host (custom domains work with no configuration) and `ALLOWED_ORIGINS`.
- **Tests**: `npm test` (no install needed, Node 20+). They use an in-memory stand-in for `neon()` and a mocked Resend. To also prove the SQL on a real, throwaway Postgres: `VP_TEST_PG_URL=postgres://user@127.0.0.1:5432/scratch npm test` (it drops the `vp_*` account tables of that database).

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
200 { "ok": true, "user": { "id": "7b0c…", "email": "dona@example.com", "lang": "pt", "createdAt": "2026-11-20T01:10:00.000Z" } }
```
Also sets `Set-Cookie: vp_session=…; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=5184000` (60 days). The account is created on the first successful verify. A wrong code is `400 invalid-code`; after 5 wrong tries the code is locked (`429 too-many-attempts`) and the player must ask for a new one.

### `POST /api/auth/logout`

No body. `200 {"ok": true}` and the cookie is cleared (only this device's session).

### `GET /api/me`

```json
200 { "user": { "id": "…", "email": "…", "lang": "pt", "createdAt": "…" }, "cats": [ /* Cat, oldest first */ ] }
401 { "error": "unauthorized" }
```
Call it on boot to know whether the player is logged in.

### `DELETE /api/me`

Deletes the account and everything attached to it (cats, save, sessions, pending codes). `200 {"ok": true, "deleted": true}`. Ask for confirmation in the UI: it cannot be undone.

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
| `GET /api/online/ticket` | `?cat=mimo\|mimosa\|morticia`, or `?catId=<uuid>` (own registered cat, needs login), or `?spec=<json Spec>`; optional header `x-vp-ticket: <previous ticket>` keeps a guest's id and nickname | `{you: {id, name, guest}, cat, ticket, exp, ttl}` |
| `POST /api/online/tick` | `{ticket, room, x, z, ry, anim, car?, emote?, es?, phrase?, ps?, paws?, need?, idle?}` | `{you: {id}, room, others: [...], n, cap, ts, paw}` |
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
await api('/api/auth/start', 'POST', { email, lang }); // player types the code from the e-mail
const { ok, user } = await api('/api/auth/verify', 'POST', { email, code });
const { cat } = await api('/api/cats', 'POST', { name, breed, spec });
await api('/api/save', 'PUT', { data: progress });
```

## Files

| Path | What |
|---|---|
| `api/auth/[action].js` | `start`, `verify`, `logout` |
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
