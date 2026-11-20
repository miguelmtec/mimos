//   GET  /api/cats/public?limit=24     -> {cats} recent public cats ("Cidade dos Gatos")
//   POST /api/cats/suggest-colors {image} -> {spec, palette} from a small PNG data URL
import { endpoint, fail, actionOf } from '../_lib/http.js';
import { requireUser } from '../_lib/auth.js';
import { publicCatJson } from '../_lib/cats.js';
import { suggestFromDataUrl } from '../_lib/colors.js';

const notFound = () => { throw fail(404, 'not-found'); };

export default endpoint({
  GET: async ({ req, res, sql, query }) => {
    if (actionOf(req) !== 'public') notFound();
    const n = Math.floor(Number(query.limit));
    const limit = Number.isFinite(n) ? Math.min(60, Math.max(1, n)) : 24;
    const rows = await sql`select id, name, breed, spec, bio, instagram, created_at
      from vp_cats where is_public order by created_at desc, id desc limit ${limit}`;
    res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=120');
    return { cats: rows.map(publicCatJson) };
  },

  POST: async ({ req, sql, body }) => {
    if (actionOf(req) !== 'suggest-colors') notFound();
    await requireUser(sql, req);                 // logged-in players only: this one costs CPU
    return suggestFromDataUrl(body.image);       // the photo is processed in memory and dropped
  },
});
