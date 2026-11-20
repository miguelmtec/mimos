// "Mais Bonitos" likes — STUB. The client (public/js/social.js) posts {cat} once per day and keeps its own tally.
// To build: table vp_likes(user_id, day, cat_id) with a unique (user_id, day), weekly top by count. Likes are never sold.
//   GET /api/style -> { top: [], stub: true }     POST /api/style {cat} -> 202 { ok: true, stub: true }
export default function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET') { res.statusCode = 200; return res.end(JSON.stringify({ top: [], stub: true })); }
  if (req.method === 'POST') { res.statusCode = 202; return res.end(JSON.stringify({ ok: true, stub: true })); }
  res.statusCode = 405; res.setHeader('allow', 'GET, POST'); res.end(JSON.stringify({ error: 'method' }));
}
