// Vice Paws accounts — Neon Postgres access + lazy, idempotent schema setup.
// Same idea as api/scores.js: `create table if not exists`, once per cold start.
// Tables are prefixed with vp_ (like vp_ranking) so they never collide with
// anything else living in the same database. Keep db/schema.sql in sync.
let testSql = null;   // injected by tests (see tests/accounts.test.mjs)
let cached = null;    // { url, sql }
let ready = null;     // schema promise, reset on failure

export function dbUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

/** Returns a neon-style tagged-template `sql`, or null when no database is configured. */
export async function getSql() {
  if (testSql) return testSql;
  const url = dbUrl();
  if (!url) return null;
  if (!cached || cached.url !== url) {
    const { neon } = await import('@neondatabase/serverless');
    cached = { url, sql: neon(url) };
  }
  return cached.sql;
}

/** Tests only: replace neon() with a fake/alternative tagged-template function. */
export function __setSqlForTests(sql) {
  testSql = sql;
  ready = null;
}

const tables = (sql) => [
  () => sql`create table if not exists vp_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    lang text not null default 'pt',
    created_at timestamptz not null default now(),
    last_login_at timestamptz not null default now())`,
  () => sql`create table if not exists vp_login_codes (
    id bigserial primary key,
    email text not null,
    code_hash text not null,
    ip_hash text not null,
    lang text not null default 'pt',
    attempts smallint not null default 0,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now())`,
  () => sql`create table if not exists vp_sessions (
    token_hash text primary key,
    user_id uuid not null references vp_users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now())`,
  () => sql`create table if not exists vp_cats (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references vp_users(id) on delete cascade,
    name text not null,
    breed text not null,
    spec jsonb not null,
    bio text not null default '',
    instagram text,
    is_public boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now())`,
  () => sql`create table if not exists vp_saves (
    user_id uuid primary key references vp_users(id) on delete cascade,
    data jsonb not null,
    updated_at timestamptz not null default now())`,
];

const indexes = (sql) => [
  () => sql`create index if not exists vp_login_codes_email_idx on vp_login_codes (email, created_at desc)`,
  () => sql`create index if not exists vp_login_codes_ip_idx on vp_login_codes (ip_hash, created_at desc)`,
  () => sql`create index if not exists vp_sessions_user_idx on vp_sessions (user_id)`,
  () => sql`create index if not exists vp_sessions_expires_idx on vp_sessions (expires_at)`,
  () => sql`create index if not exists vp_cats_user_idx on vp_cats (user_id, created_at)`,
  () => sql`create index if not exists vp_cats_public_idx on vp_cats (created_at desc) where is_public`,
];

export function ensureSchema(sql) {
  ready ??= (async () => {
    for (const t of tables(sql)) await t();           // ordered: foreign keys
    await Promise.all(indexes(sql).map((i) => i()));
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
