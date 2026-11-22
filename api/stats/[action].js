// Vice Paws — owner's dashboard data.
// POST /api/stats/hit   {vid, ev}  anonymous visit counter: vid is a random id the browser made (no IP, no e-mail),
//                                  ev = 'visit' | 'play' | 'online'. One row per visitor per day.
// GET  /api/stats/admin            owner only (ADMIN_EMAILS): visitors per day, accounts, cats, purchases, online now.
import { endpoint, fail, actionOf } from '../_lib/http.js';
import { requireUser, isAdminEmail } from '../_lib/auth.js';
import { MP } from '../pix/_products.js';

let ready = null;
const schema = (sql) => (ready ??= sql`create table if not exists vp_visits (
    day date not null default (now() at time zone 'America/Sao_Paulo')::date,
    vid text not null,
    played boolean not null default false,
    online boolean not null default false,
    first_at timestamptz not null default now(),
    primary key (day, vid))`.catch((e) => { ready = null; throw e; }));

const VID = /^[a-z0-9]{12,40}$/;

async function payments() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { error: 'sem-token' };
  try {
    const r = await fetch(`${MP}/v1/payments/search?sort=date_created&criteria=desc&limit=50`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) return { error: 'mp-' + r.status };
    const j = await r.json();
    // only the game's orders (external_reference "product|nick"); no payer data leaves Mercado Pago
    return { list: (j.results || []).filter((p) => String(p.external_reference || '').includes('|')).map((p) => {
      const [product, nick] = String(p.external_reference).split('|');
      return { product, nick, amount: p.transaction_amount, status: p.status, at: p.date_created };
    }) };
  } catch { return { error: 'mp-offline' }; }
}

export default endpoint({
  POST: async ({ req, sql, body }) => {
    if (actionOf(req) !== 'hit') throw fail(404, 'not-found');
    const vid = String(body.vid || ''), ev = String(body.ev || 'visit');
    if (!VID.test(vid) || !['visit', 'play', 'online'].includes(ev)) throw fail(400, 'invalid');
    await schema(sql);
    await sql`insert into vp_visits (vid, played, online) values (${vid}, ${ev === 'play'}, ${ev === 'online'})
      on conflict (day, vid) do update set played = vp_visits.played or excluded.played, online = vp_visits.online or excluded.online`;
    return { ok: true };
  },
  GET: async ({ req, sql }) => {
    if (actionOf(req) !== 'admin') throw fail(404, 'not-found');
    const user = await requireUser(sql, req, { allowIncomplete: true });
    if (!isAdminEmail(user.email)) throw fail(403, 'not-owner');
    await schema(sql);
    const [days, total, users, cats, pay] = await Promise.all([
      sql`select to_char(day, 'YYYY-MM-DD') as day, count(*)::int as visitors, count(*) filter (where played)::int as played, count(*) filter (where online)::int as online
          from vp_visits where day > (now() at time zone 'America/Sao_Paulo')::date - 30 group by day order by day desc`,
      sql`select count(distinct vid)::int as visitors, count(distinct vid) filter (where played)::int as played from vp_visits`,
      sql`select u.email, u.status, u.age_band, (u.google_sub is not null) as google, u.created_at, u.last_login_at,
            (select count(*)::int from vp_cats c where c.user_id = u.id) as cats,
            (select coalesce(string_agg(c.name, ', '), '') from vp_cats c where c.user_id = u.id) as cat_names
          from vp_users u order by u.created_at desc limit 500`,
      sql`select count(*)::int as n from vp_cats`,
      payments(),
    ]);
    let onlineNow = 0;
    try { onlineNow = (await sql`select count(*)::int as n from vp_presence where updated_at > now() - interval '30 seconds'`)[0].n; } catch { /* online tables are optional */ }
    let ranking = [];
    try { ranking = await sql`select name, score, level, missions from vp_ranking order by score desc limit 10`; } catch { /* optional */ }
    return { days, total: total[0], users, cats: cats[0].n, onlineNow, ranking, payments: pay, at: new Date().toISOString() };
  },
});
