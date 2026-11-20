// Vice Paws leaderboard — Vercel Node function backed by Neon Postgres.
// Needs DATABASE_URL (set automatically by the Neon integration on Vercel).
// Without it the game still works offline (progress stays on the device).
import { neon } from '@neondatabase/serverless';

let ready = null;

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return res.status(503).json({ error: 'leaderboard-offline' });
  const sql = neon(url);
  const top = () => sql`select name, score, level, stars from vp_ranking order by score desc, updated_at asc limit 20`;
  try {
    ready ??= sql`create table if not exists vp_ranking (
      name text primary key, score integer not null, level smallint not null,
      stars smallint not null default 0, updated_at timestamptz not null default now())`;
    await ready;

    if (req.method === 'GET') return res.status(200).json({ top: await top() });

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = String(b.name || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 12);
      const score = Math.floor(Number(b.score));
      const level = Math.floor(Number(b.level));
      const stars = Math.floor(Number(b.stars));
      // sanity: 50 missions, max 3 stars each, a single mission can't realistically pass ~25k points
      const ok = name && Number.isFinite(score) && score >= 1 && level >= 1 && level <= 50 &&
        stars >= 1 && stars <= Math.min(150, level * 3) && score <= level * 25000;
      if (!ok) return res.status(400).json({ error: 'invalid' });
      // one row per name, keeps the best total
      await sql`insert into vp_ranking (name, score, level, stars) values (${name}, ${score}, ${level}, ${stars})
        on conflict (name) do update set score = greatest(vp_ranking.score, excluded.score),
        level = greatest(vp_ranking.level, excluded.level), stars = greatest(vp_ranking.stars, excluded.stars), updated_at = now()`;
      return res.status(200).json({ ok: true, top: await top() });
    }
    res.setHeader('allow', 'GET, POST');
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    ready = null;
    return res.status(500).json({ error: 'db' });
  }
}
