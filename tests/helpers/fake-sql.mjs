// In-memory stand-in for neon(): a tagged-template `sql` that understands exactly
// the statements the account endpoints run. An unknown statement throws, so the
// tests fail loudly if a handler's SQL changes without this file following.
// (tests/helpers/pg-wire.mjs runs the very same tests against a real Postgres.)
import { randomUUID } from 'node:crypto';

const HOUR = 3600e3, DAY = 24 * HOUR;

export function createFakeBackend() {
  let t, seq, last;
  const reset = () => { t = { users: [], codes: [], sessions: [], cats: [], saves: [], presence: [], reports: [] }; seq = 0; last = 0; };
  reset();
  // strictly increasing clock, so "order by created_at" is deterministic
  const now = () => new Date((last = Math.max(last + 1, Date.now())));
  const catRow = (c) => ({ ...c, spec: structuredClone(c.spec) });

  const handlers = [
    [/^create (unlogged )?(table|index) if not exists /, () => []],

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
    // ---------- Cidade Online (api/online) ----------
    [/^select name, spec from vp_cats where id = \? and user_id = \?$/, ([id, uid]) =>
      t.cats.filter((c) => c.id === id && c.user_id === uid).map((c) => ({ name: c.name, spec: structuredClone(c.spec) }))],
    [/^delete from vp_presence where updated_at < now\(\) - interval '30 seconds'$/, () => {
      t.presence = t.presence.filter((p) => p.updated_at >= Date.now() - 30e3);
      return [];
    }],
    [/^select room, count\(\*\)::int as n, \(count\(\*\) filter \(where ip_hash = \?::text and id <> \?::text\)\)::int as mine from vp_presence where updated_at > now\(\) - interval '10 seconds' group by room$/, ([ip, id]) => {
      const by = new Map();
      for (const p of t.presence) {
        if (p.updated_at <= Date.now() - 10e3) continue;
        const r = by.get(p.room) || { room: p.room, n: 0, mine: 0 };
        r.n++; if (p.ip_hash === ip && p.id !== id) r.mine++;
        by.set(p.room, r);
      }
      return [...by.values()];
    }],
    [/^with me as \( insert into vp_presence as p \(id, room, x, z, ry, anim, car, name, cat, cv, emote, es, phrase, ps, paws, ip_hash, user_id\) values .* on conflict \(id\) do update set .* where p\.updated_at <= now\(\) - interval '800 milliseconds' returning p\.id, p\.room \) select me\.id as self, o\.id, .* from me left join vp_presence o on o\.room = me\.room and o\.id <> me\.id and o\.updated_at > now\(\) - interval '10 seconds' order by o\.updated_at desc nulls last limit \?::int$/, (p) => {
      const [id, room, x, z, ry, anim, car, name, cat, cv, emote, es, phrase, ps, paws, ip_hash, user_id, need, limit] = p;
      const at = Date.now();
      let row = t.presence.find((r) => r.id === id);
      if (row && row.updated_at > at - 800) return [];                 // the rate limit of the upsert
      if (!row) { row = { id }; t.presence.push(row); }
      Object.assign(row, { room, x, z, ry, anim, car, name, cat: JSON.parse(cat), cv, emote, es, phrase, ps, paws, ip_hash, user_id, updated_at: at });
      const wanted = String(need || '').split(',');
      const others = t.presence.filter((o) => o.room === room && o.id !== id && o.updated_at > at - 10e3)
        .sort((a, b) => b.updated_at - a.updated_at).slice(0, limit)
        .map((o) => ({ self: id, id: o.id, name: o.name, x: o.x, z: o.z, ry: o.ry, anim: o.anim, car: o.car, cv: o.cv, emote: o.emote, es: o.es,
          phrase: o.phrase, ps: o.ps, paws: o.paws, age: Math.round(at - o.updated_at), cat: wanted.includes(o.id) ? structuredClone(o.cat) : null }));
      return others.length ? others : [{ self: id, id: null }];
    }],
    [/^with touch as \( update vp_presence set updated_at = now\(\) where id = \?::text and room = \?::text and updated_at <= now\(\) - interval '5 seconds' returning id \) select s\.id as self, o\.id, .* from vp_presence s left join vp_presence o on o\.room = s\.room and o\.id <> s\.id and o\.updated_at > now\(\) - interval '10 seconds' where s\.id = \?::text and s\.room = \?::text and s\.updated_at > now\(\) - interval '30 seconds' order by o\.updated_at desc nulls last limit \?::int$/, (p) => {
      const [id, room, need, , , limit] = p;
      const at = Date.now();
      const self = t.presence.find((r) => r.id === id && r.room === room && r.updated_at > at - 30e3);
      if (!self) return [];
      // like Postgres, the main query still sees the row as it was before the CTE touched it
      const touched = self.updated_at <= at - 5e3 ? 1 : 0;
      const wanted = String(need || '').split(',');
      const others = t.presence.filter((o) => o.room === room && o.id !== id && o.updated_at > at - 10e3)
        .sort((a, b) => b.updated_at - a.updated_at).slice(0, limit)
        .map((o) => ({ self: id, id: o.id, name: o.name, x: o.x, z: o.z, ry: o.ry, anim: o.anim, car: o.car, cv: o.cv, emote: o.emote, es: o.es,
          phrase: o.phrase, ps: o.ps, paws: o.paws, age: Math.round(at - o.updated_at), cat: wanted.includes(o.id) ? structuredClone(o.cat) : null, touched }));
      if (touched) self.updated_at = at;
      return others.length ? others : [{ self: id, id: null, touched }];
    }],
    [/^insert into vp_online_reports \(reporter_id, target_id, target_name, target_cat, target_user_id, room, reason, source\) select /, (p) => {
      const [reporter_id, target_id, room, reason, tid2, rid2, max] = p;
      const recent = t.reports.filter((r) => r.reporter_id === rid2 && r.created_at > Date.now() - HOUR);
      if (recent.length >= max || recent.some((r) => r.target_id === target_id)) return [];
      const target = t.presence.find((r) => r.id === tid2);
      const row = { id: String(++seq), reporter_id, target_id, target_name: target ? target.name : '', target_cat: target ? structuredClone(target.cat) : null,
        target_user_id: target ? target.user_id : null, room, reason, source: 'poll', created_at: now() };
      t.reports.push(row);
      return [{ id: row.id }];
    }],
    [/^delete from vp_presence where id = \?$/, ([id]) => { t.presence = t.presence.filter((r) => r.id !== id); return []; }],
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

  const TABLES = { vp_users: 'users', vp_login_codes: 'codes', vp_sessions: 'sessions', vp_cats: 'cats', vp_saves: 'saves', vp_presence: 'presence', vp_online_reports: 'reports' };
  return {
    name: 'fake',
    sql,
    reset: async () => reset(),
    rows: async (table) => structuredClone(t[TABLES[table]]),
    expireCodes: async () => { for (const c of t.codes) c.expires_at = new Date(Date.now() - 1000); },
    expireSessions: async () => { for (const s of t.sessions) s.expires_at = new Date(Date.now() - 1000); },
    agePresence: async (ms) => { for (const p of t.presence) p.updated_at -= ms; },
    close: async () => {},
  };
}
