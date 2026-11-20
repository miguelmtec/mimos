-- Vice Paws — accounts, cat profiles and cloud saves (Neon Postgres).
--
-- You do NOT need to run this by hand: api/_lib/db.js creates everything lazily
-- (idempotent `create table if not exists`, once per cold start), the same way
-- api/scores.js creates vp_ranking. This file documents the schema and can be
-- pasted into the Neon SQL editor if you prefer to create it up front.
--
-- Personal data kept: the e-mail address, and nothing else. No names of people,
-- no passwords, no photos. IPs are only stored as a keyed hash, for rate limiting,
-- and those rows are purged after one day.

-- One row per player. The e-mail is the only personal datum.
create table if not exists vp_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    lang text not null default 'pt',
    created_at timestamptz not null default now(),
    last_login_at timestamptz not null default now());

-- One-time login codes. Only an HMAC of the 6-digit code is stored; 10 minute
-- expiry, single use, max 5 attempts. Also the source for the rate limits.
create table if not exists vp_login_codes (
    id bigserial primary key,
    email text not null,
    code_hash text not null,
    ip_hash text not null,
    lang text not null default 'pt',
    attempts smallint not null default 0,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now());

-- Sessions behind the vp_session cookie. Only the SHA-256 of the random 32-byte
-- token is stored; 60 day expiry.
create table if not exists vp_sessions (
    token_hash text primary key,
    user_id uuid not null references vp_users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now());

-- The players' cats (max 5 per player, enforced by the API). `spec` is the
-- whitelisted JSON that drives the 3D model.
create table if not exists vp_cats (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references vp_users(id) on delete cascade,
    name text not null,
    breed text not null,
    spec jsonb not null,
    bio text not null default '',
    instagram text,
    is_public boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now());

-- Cloud save: one JSON blob (max 64KB) per player, last write wins.
create table if not exists vp_saves (
    user_id uuid primary key references vp_users(id) on delete cascade,
    data jsonb not null,
    updated_at timestamptz not null default now());

create index if not exists vp_login_codes_email_idx on vp_login_codes (email, created_at desc);
create index if not exists vp_login_codes_ip_idx on vp_login_codes (ip_hash, created_at desc);
create index if not exists vp_sessions_user_idx on vp_sessions (user_id);
create index if not exists vp_sessions_expires_idx on vp_sessions (expires_at);
create index if not exists vp_cats_user_idx on vp_cats (user_id, created_at);
create index if not exists vp_cats_public_idx on vp_cats (created_at desc) where is_public;

-- Deleting an account (DELETE /api/me) removes the vp_users row; sessions, cats
-- and saves follow through `on delete cascade`, and the API also deletes the
-- player's rows in vp_login_codes.


-- ---------------------------------------------------------------------------
-- Cidade Online (api/online, polling fallback). Created lazily by
-- ensureOnlineSchema() in api/_lib/db.js, apart from the account tables.
-- ---------------------------------------------------------------------------

-- Who is in the shared city right now: one row per player, rewritten by every
-- tick and deleted 30 s after the last one. UNLOGGED: throwaway data, no WAL.
-- No personal data: `id` is a public id (never the account id), `name` is a
-- registered cat name or a generated nickname, `cat` the whitelisted look,
-- `ip_hash` a keyed hash used only to cap presences per address. `user_id`
-- (accounts only) never leaves the server: it is copied into a report.
create unlogged table if not exists vp_presence (
    id text primary key,
    room text not null,
    x integer not null,
    z integer not null,
    ry real not null default 0,
    anim text not null default 'idle',
    car text,
    name text not null,
    cat jsonb not null,
    cv text not null,
    emote text,
    es smallint not null default 0,
    phrase smallint,
    ps smallint not null default 0,
    paws text,
    ip_hash text not null default '',
    user_id uuid,
    updated_at timestamptz not null default now());

-- Reports ("Denunciar") for review. Written by the polling API (source 'poll')
-- and by the real-time server (source 'ws', when it has DATABASE_URL).
--   select created_at, reason, target_name, target_id, target_user_id, room
--     from vp_online_reports order by created_at desc limit 50;
create table if not exists vp_online_reports (
    id bigserial primary key,
    reporter_id text not null,
    target_id text not null,
    target_name text not null default '',
    target_cat jsonb,
    target_user_id uuid,
    room text not null default '',
    reason text not null,              -- name | behavior | cheat | other
    source text not null default 'poll',
    created_at timestamptz not null default now());

create index if not exists vp_presence_room_idx on vp_presence (room, updated_at);
create index if not exists vp_online_reports_reporter_idx on vp_online_reports (reporter_id, created_at desc);
