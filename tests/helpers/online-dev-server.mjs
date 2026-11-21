// Local stand-in for the deployment, for the Cidade Online e2e tests (and for trying the mode by hand):
// serves public/ and mounts the REAL api/online handler on an in-memory database (tests/helpers/fake-sql.mjs).
// Optionally starts the real-time server (server/index.mjs) and points data/online.json at it.
//   node tests/helpers/online-dev-server.mjs [port] [--ws]      -> http://localhost:8790
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { __setSqlForTests } from '../../api/_lib/db.js';
import onlineHandler, { __resetOnlineForTests } from '../../api/online/[action].js';
import { createFakeBackend } from './fake-sql.mjs';
import { signTicket } from '../../server/lib/protocol.mjs';
import { call } from './http.mjs';

const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

export async function startDevServer({ port = 0, ws = false, config = {} } = {}) {
  process.env.ONLINE_TICKET_SECRET ||= 'dev-secret';
  process.env.ONLINE_PUBLIC ||= 'true';   // the e2e city is open; the closed test is covered in tests/online.test.mjs
  const db = createFakeBackend();
  __setSqlForTests(db.sql); __resetOnlineForTests();
  const state = { down: false, ticks: 0, idleTicks: 0, bodies: [], config: { enabled: true, maxPerRoom: 30, maxRooms: 20, tickMs: 1500, pollingEnabled: true, wsUrl: '', ...config } };
  let rt = null;
  if (ws) {
    const { createOnlineServer } = await import('../../server/index.mjs');
    rt = createOnlineServer({ reportSink: async (r) => { state.wsReports.push(r); }, log: { error() {} } });
    state.wsReports = [];
    const wsPort = await rt.listen(0, '127.0.0.1');
    state.config.wsUrl = `ws://localhost:${wsPort}`;
    state.rt = rt;
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/data/online.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(state.config)); }
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString('utf8');
        const out = { setHeader: (k, v) => { res.setHeader(k, v); return out; }, status: (c) => { res.statusCode = c; return out; }, json: (b) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); return out; }, end: () => { res.end(); return out; } };
        if (state.down) return out.status(503).json({ error: 'offline' });
        if (!url.pathname.startsWith('/api/online/')) return out.status(url.pathname === '/api/me' ? 401 : 503).json({ error: url.pathname === '/api/me' ? 'unauthorized' : 'offline' });
        let body; try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
        if (url.pathname === '/api/online/tick') { state.ticks++; if (body && body.idle) state.idleTicks++; state.bodies.push(body); if (state.bodies.length > 400) state.bodies.shift(); }
        return await onlineHandler({ method: req.method, url: req.url, headers: req.headers, body, query: Object.fromEntries(url.searchParams) }, out);
      }
      let p = normalize(decodeURIComponent(url.pathname)); if (p.endsWith('/')) p += 'index.html';
      const file = join(PUBLIC, p);
      if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
    } catch (e) { if (!res.headersSent) res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end(); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  // puts `n` extra cats in a map through the real handler (to test full rooms and the global cap)
  const fill = async (n, base = 'map') => {
    for (let i = 0; i < n; i++) {
      const { ticket } = signTicket({ id: 'g' + String(1e6 + Math.floor(Math.random() * 9e6) + i).padStart(20, 'f'), name: `Gato Zen ${1 + (i % 999)}`, cat: { star: 'mimo' } });
      const r = await call(onlineHandler, { method: 'POST', url: '/api/online/tick', ip: `10.${(i >> 8) & 255}.${i & 255}.9`, body: { ticket, room: `${base}${Math.floor(i / 30)}`, x: 1000 + i * 3, z: 4000, ry: 0, anim: 'idle' } });
      if (r.status !== 200) return { stopped: i, status: r.status, body: r.body };
    }
    return { stopped: n };
  };
  return {
    fill,
    port: server.address().port, url: `http://localhost:${server.address().port}/`, db, state,
    close: async () => { if (rt) await rt.close(); await new Promise((r) => server.close(r)); server.closeAllConnections?.(); __setSqlForTests(null); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await startDevServer({ port: Number(process.argv[2]) || 8790, ws: process.argv.includes('--ws') });
  console.log(`Vice Paws + Cidade Online (in-memory) at ${s.url}` + (s.state.config.wsUrl ? `  real-time: ${s.state.config.wsUrl}` : '  transport: polling'));
}
