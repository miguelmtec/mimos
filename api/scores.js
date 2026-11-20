// Vice Paws leaderboard — Vercel Node function backed by Neon Postgres.
// Needs DATABASE_URL (set automatically by the Neon integration on Vercel).
// Without it the game still works offline (progress stays on the device).
import { neon } from '@neondatabase/serverless';
import { cleanScore } from './_lib/score.js';

let ready = null;

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return res.status(503).json({ error: 'leaderboard-offline' });
  const sql = neon(url);
  // vip is a cosmetic flag (crown next to the name); it grants nothing, so the client's word is enough
  const top = () => sql`select name, score, level, stars, vip, missions from vp_ranking order by score desc, updated_at asc limit 20`;
  try {
    ready ??= sql`create table if not exists vp_ranking (
      name text primary key, score integer not null, level smallint not null,
      stars smallint not null default 0, updated_at timestamptz not null default now())`
      .then(() => sql`alter table vp_ranking add column if not exists vip boolean not null default false`)
      .then(() => sql`alter table vp_ranking add column if not exists missions integer not null default 0`);
    await ready;

    if (req.method === 'GET') return res.status(200).json({ top: await top() });

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      // the ranking counts every mission (story, chapters, bonus, World Tour); see _lib/score.js for the sanity rules
      const e = cleanScore(b);
      if (!e) return res.status(400).json({ error: 'invalid' });
      const { name, score, level, stars, vip, missions } = e;
      // one row per name, keeps the best total
      await sql`insert into vp_ranking (name, score, level, stars, vip, missions) values (${name}, ${score}, ${level}, ${stars}, ${vip}, ${missions})
        on conflict (name) do update set score = greatest(vp_ranking.score, excluded.score),
        level = greatest(vp_ranking.level, excluded.level), stars = greatest(vp_ranking.stars, excluded.stars),
        vip = vp_ranking.vip or excluded.vip, missions = greatest(vp_ranking.missions, excluded.missions), updated_at = now()`;
      return res.status(200).json({ ok: true, top: await top() });
    }
    res.setHeader('allow', 'GET, POST');
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    ready = null;
    return res.status(500).json({ error: 'db' });
  }
}
