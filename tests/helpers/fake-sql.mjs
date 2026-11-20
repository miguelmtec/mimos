// In-memory stand-in for neon(): a tagged-template `sql` that understands exactly
// the statements the account endpoints run. An unknown statement throws, so the
// tests fail loudly if a handler's SQL changes without this file following.
// (tests/helpers/pg-wire.mjs runs the very same tests against a real Postgres.)
import { randomUUID } from 'node:crypto';

const HOUR = 3600e3, DAY = 24 * HOUR;

export function createFakeBackend() {
  let t, seq, last;
  const reset = () => { t = { users: [], codes: [], sessions: [], cats: [], saves: [] }; seq = 0; last = 0; };
  reset();
  // strictly increasing clock, so "order by created_at" is deterministic
  const now = () => new Date((last = Math.max(last + 1, Date.now())));
  const catRow = (c) => ({ ...c, spec: structuredClone(c.spec) });

  const handlers = [
    [/^create (table|index) if not exists /, () => []],

    [/^delete from vp_login_codes where created_at < now\(\) - interval '1 day'$/, () => {
      t.codes = t.codes.filter((c) => c.created_at > Date.now() - DAY);
      return [];
    }],
    [/^delete from vp_sessions where expires_at < now\(\)$/, () => {
      t.sessions = t.sessions.filter((s) => s.expires_at >= Date.now());
      return [];
    }],
    [/^insert into vp_login_codes \(email, code_hash, ip_hash, lang, expires_at\) select /, (p) => {
      const [email, code_hash, ip_hash, lang, mins, email2, maxEmail, ip2, maxIp] = p;
      const recent = t.codes.filter((c) => c.created_at > Date.now() - HOUR);
      if (recent.filter((c) => c.email === email2).length >= maxEmail) return [];
      if (recent.filter((c) => c.ip_hash === ip2).length >= maxIp) return [];
      const at = now();
      const row = { id: String(++seq), email, code_hash, ip_hash, lang, attempts: 0,
        expires_at: new Date(at.getTime() + mins * 60e3), used_at: null, created_at: at };
      t.codes.push(row);
      return [{ id: row.id }];
    }],
    [/^update vp_login_codes set attempts = attempts \+ 1 where id = \(select id from vp_login_codes where email = \? and used_at is null and expires_at > now\(\) order by created_at desc, id desc limit 1\) returning id, code_hash, attempts, lang$/, ([email]) => {
      const row = t.codes.filter((c) => c.email === email && !c.used_at && c.expires_at > Date.now())
        .sort((a, b) => b.created_at - a.created_at || b.id - a.id)[0];
      if (!row) return [];
      row.attempts += 1;
      return [{ id: row.id, code_hash: row.code_hash, attempts: row.attempts, lang: row.lang }];
    }],
    [/^update vp_login_codes set used_at = now\(\) where id = \? and used_at is null returning id$/, ([id]) => {
      const row = t.codes.find((c) => c.id === String(id) && !c.used_at);
      if (!row) return [];
      row.used_at = now();
      return [{ id: row.id }];
    }],
    [/^insert into vp_users \(email, lang\) values \(\?, \?\) on conflict \(email\) do update set /, ([email, lang]) => {
      let u = t.users.find((x) => x.email === email);
      if (u) { u.lang = lang; u.last_login_at = now(); }
      else { u = { id: randomUUID(), email, lang, created_at: now(), last_login_at: now() }; t.users.push(u); }
      return [{ id: u.id, email: u.email, lang: u.lang, created_at: u.created_at }];
    }],
    [/^insert into vp_sessions \(token_hash, user_id, expires_at\) values /, ([token_hash, user_id, days]) => {
      t.sessions.push({ token_hash, user_id, expires_at: new Date(Date.now() + days * DAY), created_at: now() });
      return [];
    }],
    [/^delete from vp_sessions where token_hash = \?$/, ([h]) => {
      t.sessions = t.sessions.filter((s) => s.token_hash !== h);
      return [];
    }],
    [/^select u\.id, u\.email, u\.lang, u\.created_at from vp_sessions s join vp_users u on u\.id = s\.user_id where s\.token_hash = \? and s\.expires_at > now\(\)$/, ([h]) => {
      const s = t.sessions.find((x) => x.token_hash === h && x.expires_at > Date.now());
      const u = s && t.users.find((x) => x.id === s.user_id);
      return u ? [{ id: u.id, email: u.email, lang: u.lang, created_at: u.created_at }] : [];
    }],
    [/^delete from vp_users where id = \?$/, ([id]) => {
      t.users = t.users.filter((u) => u.id !== id);
      for (const k of ['sessions', 'cats', 'saves']) t[k] = t[k].filter((r) => r.user_id !== id);   // cascade
      return [];
    }],
    [/^delete from vp_login_codes where email = \?$/, ([email]) => {
      t.codes = t.codes.filter((c) => c.email !== email);
      return [];
    }],

    [/^select id, name, breed, spec, bio, instagram, is_public, created_at, updated_at from vp_cats where user_id = \? order by created_at asc, id asc$/, ([uid]) =>
      t.cats.filter((c) => c.user_id === uid).sort((a, b) => a.created_at - b.created_at).map(catRow)],
    [/^insert into vp_cats \(user_id, name, breed, spec, bio, instagram, is_public\) select /, (p) => {
      const [user_id, name, breed, spec, bio, instagram, is_public, uid2, max] = p;
      if (t.cats.filter((c) => c.user_id === uid2).length >= max) return [];
      const at = now();
      const row = { id: randomUUID(), user_id, name, breed, spec: JSON.parse(spec), bio, instagram, is_public,
        created_at: at, updated_at: at };
      t.cats.push(row);
      return [catRow(row)];
    }],
    [/^update vp_cats set name = \?, breed = \?, spec = \?::jsonb, bio = \?, instagram = \?, is_public = \?, updated_at = now\(\) where id = \? and user_id = \? returning /, (p) => {
      const [name, breed, spec, bio, instagram, is_public, id, uid] = p;
      const row = t.cats.find((c) => c.id === id && c.user_id === uid);
      if (!row) return [];
      Object.assign(row, { name, breed, spec: JSON.parse(spec), bio, instagram, is_public, updated_at: now() });
      return [catRow(row)];
    }],
    [/^delete from vp_cats where id = \? and user_id = \? returning id$/, ([id, uid]) => {
      const row = t.cats.find((c) => c.id === id && c.user_id === uid);
      t.cats = t.cats.filter((c) => c !== row);
      return row ? [{ id }] : [];
    }],
    [/^select id, name, breed, spec, bio, instagram, created_at from vp_cats where is_public order by created_at desc, id desc limit \?$/, ([limit]) =>
      t.cats.filter((c) => c.is_public).sort((a, b) => b.created_at - a.created_at).slice(0, limit)
        .map(({ id, name, breed, spec, bio, instagram, created_at }) => ({ id, name, breed, spec: structuredClone(spec), bio, instagram, created_at }))],

    [/^select data, updated_at from vp_saves where user_id = \?$/, ([uid]) =>
      t.saves.filter((s) => s.user_id === uid).map((s) => ({ data: structuredClone(s.data), updated_at: s.updated_at }))],
    [/^insert into vp_saves \(user_id, data\) values \(\?, \?::jsonb\) on conflict \(user_id\) do update set /, ([uid, json]) => {
      let row = t.saves.find((s) => s.user_id === uid);
      if (!row) { row = { user_id: uid }; t.saves.push(row); }
      row.data = JSON.parse(json);
      row.updated_at = now();
      return [{ updated_at: row.updated_at }];
    }],
  ];

  const sql = async (strings, ...params) => {
    for (const p of params) {
      if (p !== null && !['string', 'number', 'boolean'].includes(typeof p)) throw new Error('fake-sql: unsupported parameter type');
    }
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    const hit = handlers.find(([re]) => re.test(text));
    if (!hit) throw new Error(`fake-sql: unhandled query: ${text.slice(0, 90)}`);
    return hit[1](params);
  };

  const TABLES = { vp_users: 'users', vp_login_codes: 'codes', vp_sessions: 'sessions', vp_cats: 'cats', vp_saves: 'saves' };
  return {
    name: 'fake',
    sql,
    reset: async () => reset(),
    rows: async (table) => structuredClone(t[TABLES[table]]),
    expireCodes: async () => { for (const c of t.codes) c.expires_at = new Date(Date.now() - 1000); },
    expireSessions: async () => { for (const s of t.sessions) s.expires_at = new Date(Date.now() - 1000); },
    close: async () => {},
  };
}
