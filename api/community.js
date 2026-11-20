// Community goals — STUB. The client (public/js/story.js) reads `total`: missions finished by all players together.
// Areas listed in public/data/community.json open for everyone when the total passes their `need`.
// The real counter (one row, incremented by /api/scores or a dedicated POST) is not built yet: this endpoint
// answers a fixed zero so the client code path, the data format and the tests are already in place.
//   GET /api/community -> { total, stub: true }
export default function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('allow', 'GET'); return res.end(JSON.stringify({ error: 'method' })); }
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'public, max-age=300');
  res.end(JSON.stringify({ total: 0, stub: true }));
}
