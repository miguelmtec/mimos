// Optional: run the same tests against a real Postgres, to prove the SQL itself.
//   VP_TEST_PG_URL=postgres://user@127.0.0.1:5432/dbname node --test tests/
// Zero dependencies: a minimal client for the Postgres wire protocol (trust auth,
// extended query, text format) exposed as a neon-style tagged template.
// WARNING: reset() drops the vp_* account tables of that database. Never point
// it at production.
import net from 'node:net';

const TABLES = ['vp_saves', 'vp_cats', 'vp_sessions', 'vp_login_codes', 'vp_users'];

function cstr(s) { return Buffer.concat([Buffer.from(String(s), 'utf8'), Buffer.from([0])]); }
function msg(type, ...parts) {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(type ? 5 : 4);
  if (type) head.write(type, 0, 'latin1');
  head.writeInt32BE(body.length + 4, type ? 1 : 0);
  return Buffer.concat([head, body]);
}
const int16 = (n) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const int32 = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };

function parseValue(oid, text) {
  switch (oid) {
    case 16: return text === 't';
    case 21: case 23: case 26: return Number(text);
    case 700: case 701: return Number(text);
    case 114: case 3802: return JSON.parse(text);
    case 1114: case 1184: return new Date(text.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
    default: return text;                       // int8 stays a string, like neon/pg
  }
}

async function connect(url) {
  const u = new URL(url);
  const sock = net.connect({ host: u.hostname, port: Number(u.port || 5432) });
  let buf = Buffer.alloc(0), waiter = null, failed = null;
  const wake = () => { const w = waiter; waiter = null; w?.(); };
  sock.on('data', (d) => { buf = Buffer.concat([buf, d]); wake(); });
  sock.on('error', (e) => { failed = e; wake(); });
  sock.on('close', () => { failed ??= new Error('pg-wire: connection closed'); wake(); });

  async function read() {
    for (;;) {
      if (buf.length >= 5) {
        const len = buf.readInt32BE(1);
        if (buf.length >= len + 1) {
          const m = { type: String.fromCharCode(buf[0]), body: buf.subarray(5, len + 1) };
          buf = buf.subarray(len + 1);
          return m;
        }
      }
      if (failed) throw failed;
      await new Promise((r) => { waiter = r; });
    }
  }
  const errorOf = (body) => {
    const fields = {};
    for (const part of body.toString('utf8').split('\0')) if (part) fields[part[0]] = part.slice(1);
    return Object.assign(new Error(`pg: ${fields.M}`), { code: fields.C });
  };
  async function untilReady() {
    const rows = []; let cols = [], err = null;
    for (;;) {
      const m = await read();
      if (m.type === 'E') err = errorOf(m.body);
      else if (m.type === 'R' && m.body.readInt32BE(0) !== 0) err = new Error('pg-wire: only trust auth is supported');
      else if (m.type === 'T') {
        cols = [];
        let p = 2;
        for (let i = 0, n = m.body.readInt16BE(0); i < n; i++) {
          const end = m.body.indexOf(0, p);
          cols.push({ name: m.body.toString('utf8', p, end), oid: m.body.readInt32BE(end + 7) });
          p = end + 19;
        }
      } else if (m.type === 'D') {
        const row = {};
        let p = 2;
        for (const c of cols) {
          const len = m.body.readInt32BE(p); p += 4;
          row[c.name] = len < 0 ? null : parseValue(c.oid, m.body.toString('utf8', p, p + len));
          if (len > 0) p += len;
        }
        rows.push(row);
      } else if (m.type === 'Z') {
        if (err) throw err;
        return rows;
      }
    }
  }

  sock.write(msg('', int32(196608), cstr('user'), cstr(decodeURIComponent(u.username || 'postgres')),
    cstr('database'), cstr(u.pathname.slice(1) || 'postgres'), Buffer.from([0])));
  await untilReady();

  let chain = Promise.resolve();
  const query = (text, params = []) => {
    const run = async () => {
      const values = params.map((v) => {
        if (v == null) return int32(-1);
        const b = Buffer.from(typeof v === 'object' ? JSON.stringify(v) : String(v), 'utf8');
        return Buffer.concat([int32(b.length), b]);
      });
      sock.write(Buffer.concat([
        msg('P', cstr(''), cstr(text), int16(0)),
        msg('B', cstr(''), cstr(''), int16(0), int16(params.length), ...values, int16(0)),
        msg('D', Buffer.from('P'), cstr('')),
        msg('E', cstr(''), int32(0)),
        msg('S'),
      ]));
      return untilReady();
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  };
  return { query, end: () => sock.end() };
}

export async function createPgBackend(url) {
  const db = await connect(url);
  const sql = (strings, ...params) => db.query(strings.reduce((a, s, i) => `${a}$${i}${s}`), params);
  return {
    name: 'postgres',
    sql,
    reset: async () => { for (const t of TABLES) await db.query(`drop table if exists ${t} cascade`); },
    rows: async (table) => {
      if (!TABLES.includes(table)) throw new Error('unknown table');
      return db.query(`select * from ${table}`);
    },
    expireCodes: () => db.query("update vp_login_codes set expires_at = now() - interval '1 second'"),
    expireSessions: () => db.query("update vp_sessions set expires_at = now() - interval '1 second'"),
    close: async () => db.end(),
  };
}
