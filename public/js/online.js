'use strict';
// VICE PAWS — "Cidade Online": other players' cats in the open world.
//
// Gameplay code talks to an OnlineTransport and never to the network:
//
//   interface OnlineTransport {
//     name: string                       'ws' | 'poll'
//     delay: number                      seconds the remote cats are drawn in the past (interpolation buffer)
//     connect({room, ticket, renew, state}) -> Promise<{you: {id, name}, room, paw: {slot, ms, n, taken}}>
//     state({x, z, ry, a, car})          the local cat, called every frame; the transport decides how often it sends
//     emote(k)  phrase(i)  paw(i, slot)  report(id, reason)
//     close()
//     on: { join(p), leave(id), state(id, x, z, ry, a, car, tMs), emote(id, k), phrase(id, i),
//           paws(slot, taken), pawOk(i), down(why) }     // set by VP.Online
//   }
//
// WebSocketTransport talks to the real-time server (server/index.mjs) at data/online.json "wsUrl".
// PollingTransport is the fallback on Vercel + Neon (POST /api/online/tick every ~1.2 s), only used
// when "pollingEnabled" is true. Everything is cosmetic and kid-safe: no free text exists in either
// protocol (phrases are indexes of a fixed list, names are cat names or generated nicknames).
(function () {
const VP = window.VP, U = VP.U, UI = VP.UI, Game = VP.Game, M = VP.Missions, t = (...a) => VP.t(...a);
const O = VP.Online = { cfg: null, G: null, tr: null, state: 'off', you: null, room: '', remotes: new Map(), muted: {}, sel: { room: 'city', cat: null }, paw: null, got: 0 };
const PHRASES = O.PHRASES = 12, REASONS = O.REASONS = ['name', 'behavior', 'cheat', 'other'];
const ANIMS = ['idle', 'walk', 'dash', 'car'], CARS = ['pink', 'gold', 'sedan', 'taxi', 'sport', 'pickup', 'cop', 'van', 'truck', 'limo'];
const EMOTE_S = { miau: 1.3, dance: 3.2, sit: 5, wave: 1.9 }, BUBBLE_S = 4, AFK_S = 300;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowS = () => performance.now() / 1000;
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const json = (url, opt) => fetch(url, opt).then(async r => Object.assign({ status: r.status }, await r.json().catch(() => ({})))).catch(() => ({ status: 0, error: 'network' }));
try { O.muted = JSON.parse(sessionStorage.getItem('vp_online_muted') || '{}') || {}; } catch (e) { O.muted = {}; }

// ---------- config (feature flags) ----------
O.loadCfg = function (force) {
  if (O.cfg && !force) return Promise.resolve(O.cfg);
  return fetch('data/online.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(j => {
    const ws = typeof j.wsUrl === 'string' && /^wss?:\/\/[a-z0-9.:\-[\]]+(\/[\w\-./]*)?$/i.test(j.wsUrl.trim()) ? j.wsUrl.trim().replace(/\/+$/, '') : '';
    const num = (v, lo, hi, d) => (typeof v === 'number' && v >= lo && v <= hi ? v : d);
    // enabled: the owner's switch for the whole mode. tickMs: how often the polling transport asks (never under 1 s).
    return (O.cfg = { enabled: j.enabled === true, wsUrl: ws, pollingEnabled: j.pollingEnabled !== false, tickMs: num(j.tickMs, 1000, 10000, 1500), maxPerRoom: num(j.maxPerRoom, 2, 30, 30), maxRooms: num(j.maxRooms, 1, 20, 20) });
  });
};
O.tester = () => { const u = VP.Acct && VP.Acct.status === 'in' && VP.Acct.user; return !!(u && (u.admin || u.tester || u.onlineOpen)); };
O.available = () => !!(O.cfg && (O.cfg.enabled || O.tester()) && (O.cfg.wsUrl || O.cfg.pollingEnabled));

// ---------- transports ----------
function WebSocketTransport(url) {
  const T = { name: 'ws', delay: 0.16, on: {} };
  let ws = null, open = false, ks = new Map(), last = null, lastAt = 0, off = null, closed = false;
  const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  // server clock -> local clock: the smallest (local - server) seen is the one with the least network delay
  const local = ts => { const d = performance.now() - ts; if (off === null || d < off) off = d; else off += 0.002 * (d - off); return ts + off; };
  T.connect = ({ room, ticket, state }) => new Promise((res, rej) => {
    let done = false;
    const fail = why => { if (!done) { done = true; clearTimeout(timer); try { ws.close(); } catch (e) { /* ignore */ } rej({ code: why }); } };
    const timer = setTimeout(() => fail('timeout'), 7000);
    try { ws = new WebSocket(url.replace(/\/ws$/, '') + '/ws'); } catch (e) { return fail('url'); }
    ws.onopen = () => send({ t: 'hello', ticket, room });
    ws.onerror = () => fail('socket');
    ws.onclose = () => { if (!done) fail('closed'); else if (open && !closed) { open = false; if (T.on.down) T.on.down(T.why || 'closed'); } };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'welcome') {
        done = true; open = true; clearTimeout(timer); local(m.ts);
        res({ you: m.you, room: m.room, paw: m.paw });
        for (const p of m.players || []) { ks.set(p.k, p.id); if (T.on.join) T.on.join({ id: p.id, name: p.name, cat: p.cat, x: p.x, z: p.z, ry: p.ry, a: p.a, car: p.car }); }
        if (state) { last = null; T.state(state); }
      } else if (m.t === 'error') { T.why = m.error; if (!done) fail(m.error); }
      else if (m.t === 'snap') { const at = local(m.ts); for (const p of m.p) { const id = ks.get(p[0]); if (id && T.on.state) T.on.state(id, p[1], p[2], p[3] / 100, ANIMS[p[4]] || 'idle', p[5] ? CARS[p[5] - 1] : null, at); } }
      else if (m.t === 'join') { const p = m.p; ks.set(p.k, p.id); if (T.on.join) T.on.join({ id: p.id, name: p.name, cat: p.cat, x: p.x, z: p.z, ry: p.ry, a: p.a, car: p.car }); }
      else if (m.t === 'leave') { const id = ks.get(m.k); ks.delete(m.k); if (id && T.on.leave) T.on.leave(id); }
      else if (m.t === 'e') { const id = ks.get(m.k); if (id && T.on.emote) T.on.emote(id, m.e); }
      else if (m.t === 'p') { const id = ks.get(m.k); if (id && T.on.phrase) T.on.phrase(id, m.i); }
      else if (m.t === 'tr') { const id = ks.get(m.k); if (id && T.on.trade) T.on.trade(id, m.off ? null : { to: m.to, give: m.give || null, st: m.st }); }
      else if (m.t === 'paw') { if (T.on.paws) T.on.paws(m.slot, m.taken || []); }
      else if (m.t === 'pawok') { if (T.on.pawOk) T.on.pawOk(m.i); }
    };
  });
  // 10 times a second while something changes, once a second otherwise (keeps the connection alive)
  T.state = s => {
    const n = performance.now(), same = last && last.x === s.x && last.z === s.z && last.a === s.a && last.car === s.car && Math.abs(last.ry - s.ry) < 0.05;
    if (!open || n - lastAt < (same ? 1000 : 100)) return;
    lastAt = n; last = { x: s.x, z: s.z, ry: s.ry, a: s.a, car: s.car };
    send({ t: 's', x: s.x, z: s.z, ry: +s.ry.toFixed(2), a: s.a, car: s.car || undefined });
  };
  T.emote = k => send({ t: 'e', k });
  T.phrase = i => send({ t: 'p', i });
  T.paw = (i, slot) => send({ t: 'paw', i, s: slot });
  T.trade = tr => send(tr ? { t: 'tr', to: tr.to, give: tr.give, st: tr.st } : { t: 'tr', off: 1 });
  T.report = (id, reason) => { send({ t: 'report', id, reason }); return Promise.resolve(true); };
  T.close = () => { closed = true; open = false; try { ws.close(); } catch (e) { /* ignore */ } };
  return T;
}

// Cost rules (Neon bills compute while it is awake): every query happens inside a request the player's
// own tab makes; a hidden tab makes none; standing still sends "idle" ticks, which the server answers
// with a read and no write; alone in a room the pace halves.
function PollingTransport(tickMs) {
  const FAST = Math.max(1000, tickMs || 1500), ALONE = FAST * 2;
  const T = { name: 'poll', delay: FAST / 1000 + 0.45, on: {} };
  let room = '', ticket = '', renew = null, cur = null, sent = null, timer = null, closed = false, fails = 0, known = new Map(), ready = false, pawSent = 0;
  let trade = null, tradeSent = 'null', tickAt = 0, em = null, es = 0, ph = null, ps = 0, pawSlot = -1, pawMine = [], busyUntil = 0, others = 0;
  const post = (path, body, keep) => json('/api/online/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: !!keep });
  async function tick(first) {
    const s = cur, n = performance.now();
    const body = { ticket, room, x: s.x, z: s.z, ry: +s.ry.toFixed(2), anim: s.a };
    if (s.a === 'car') body.car = s.car;
    if (em && n < em.until) { body.emote = em.k; body.es = es; } else if (em) { em = null; sent = null; }   // one more write clears it
    if (ph && n < ph.until) { body.phrase = ph.i; body.ps = ps; } else if (ph) { ph = null; sent = null; }
    if (trade) body.trade = trade;
    if (pawMine.length) body.paws = { s: pawSlot, i: pawMine };
    // nothing changed since the last tick that was written: ask the server to only read
    const idle = !first && sent && sent.x === s.x && sent.z === s.z && sent.a === s.a && Math.abs(sent.ry - s.ry) < 0.05 && !body.emote && body.phrase == null && pawSent === pawMine.length && tradeSent === JSON.stringify(trade);
    if (idle) body.idle = true;
    const need = []; for (const [id, k] of known) if (!k.joined) need.push(id); if (need.length) body.need = need.slice(0, 40);
    let r = await post('tick', body);
    if (r.status === 401 && renew) { const nt = await renew(); if (nt) { ticket = nt; body.ticket = nt; r = await post('tick', body); } }
    if (closed) return null;
    if (r.status === 429) return r;                              // too fast (clock skew, a retry): just wait for the next one
    if (r.status !== 200) { fails++; if (first || fails >= 3) throw { code: r.error || 'http-' + r.status }; return r; }
    fails = 0; room = r.room; others = r.others.length;
    if (!idle) { sent = body.emote || body.phrase != null ? null : { x: s.x, z: s.z, ry: s.ry, a: s.a }; pawSent = pawMine.length; tradeSent = JSON.stringify(body.trade || null); }
    const at = performance.now(), seen = new Set();
    for (const o of r.others) {
      seen.add(o.id);
      let k = known.get(o.id);
      if (!k || k.cv !== o.cv) { if (k && k.joined && T.on.leave) T.on.leave(o.id); k = { cv: o.cv, joined: false, es: -1, ps: -1, stamp: 0, miss: 0 }; known.set(o.id, k); }
      k.miss = 0;
      if (!k.joined) { if (!o.cat) continue; k.joined = true; if (T.on.join) T.on.join({ id: o.id, name: o.name, cat: o.cat, x: o.x, z: o.z, ry: o.ry, a: o.anim, car: o.car || null }); }
      const stamp = r.ts - o.age;                                // when the server last heard from that cat
      if (stamp > k.stamp + 40) { k.stamp = stamp; if (T.on.state) T.on.state(o.id, o.x, o.z, o.ry, o.anim, o.car || null, at - o.age); }
      if (o.emote && o.es !== k.es) { k.es = o.es; if (T.on.emote) T.on.emote(o.id, o.emote); }
      if (o.phrase != null && o.ps !== k.ps) { k.ps = o.ps; if (T.on.phrase) T.on.phrase(o.id, o.phrase); }
      const tj = JSON.stringify(o.trade || null); if (tj !== (k.tj || 'null')) { k.tj = tj; if (T.on.trade) T.on.trade(o.id, o.trade || null); }
    }
    for (const [id, k] of known) if (!seen.has(id) && ++k.miss >= 2) { known.delete(id); if (k.joined && T.on.leave) T.on.leave(id); }
    // shared paws: everybody reports what they picked in the current slot; the union is what is gone
    if (r.paw) {
      if (r.paw.slot !== pawSlot) { pawSlot = r.paw.slot; pawMine = []; }
      const gone = new Set(pawMine);
      for (const o of r.others) if (o.paws && o.paws.s === pawSlot) for (const i of o.paws.i) gone.add(i);
      if (T.on.paws) T.on.paws(pawSlot, [...gone]);
    }
    return r;
  }
  // one timer at a time: `gen` retires any older chain when the pace is cut short (an emote or a phrase should leave now)
  let gen = 0, flying = false;
  function loop(after) {
    if (closed) return;
    const g = ++gen;
    // the pace counts from the start of the last tick, so a slow answer does not stretch it
    const every = document.hidden ? 5000 : !others && performance.now() > busyUntil ? ALONE : FAST;
    const wait = after !== undefined ? after : Math.max(250, every - (performance.now() - tickAt));
    timer = setTimeout(async () => {
      if (closed || g !== gen) return;
      tickAt = performance.now();
      if (document.hidden) return loop();                      // a hidden tab costs nothing (it drops out of the room after 10 s)
      flying = true;
      try { await tick(false); } catch (e) { flying = false; if (!closed) { closed = true; if (T.on.down) T.on.down(e.code || 'error'); } return; }
      flying = false;
      if (g === gen) loop();
    }, wait);
  }
  T.connect = async o => {
    room = o.room; ticket = o.ticket; renew = o.renew; cur = o.state;
    tickAt = performance.now();
    const r = await tick(true);
    if (!r || r.status !== 200) throw { code: (r && r.error) || 'error' };
    ready = true; loop();
    return { you: r.you, room: r.room, paw: Object.assign({ taken: [] }, r.paw) };
  };
  T.state = s => { cur = s; };
  const soon = () => { busyUntil = performance.now() + 6000; if (ready && !flying) { clearTimeout(timer); loop(Math.max(0, 900 - (performance.now() - tickAt))); } };
  T.emote = k => { em = { k, until: performance.now() + 5000 }; es = (es + 1) % 256; soon(); };
  T.phrase = i => { ph = { i, until: performance.now() + 5000 }; ps = (ps + 1) % 256; soon(); };
  T.paw = (i, slot) => { if (slot !== pawSlot) { pawSlot = slot; pawMine = []; } if (!pawMine.includes(i)) pawMine.push(i); if (T.on.pawOk) T.on.pawOk(i); };
  T.trade = tr => { trade = tr ? { to: tr.to, give: tr.give, st: tr.st } : null; soon(); };
  T.report = (id, reason) => post('report', { ticket, targetId: id, reason, room }).then(r => r.status === 200);
  T.close = () => { if (closed) return; closed = true; clearTimeout(timer); if (ready) post('leave', { ticket }, true); };
  return T;
}
O.transports = { WebSocketTransport, PollingTransport };
O._interp = (r, at, dt, ahead) => place(r, at, dt, ahead); O._push = (r, x, z, ry, a, car, atMs) => push(r, x, z, ry, a, car, atMs);

// ---------- ticket: who you are in the shared city (GET /api/online/ticket) ----------
O.looks = function () {
  const A = VP.Acct, S = VP.S, list = [];
  if (S.avatar && A && A.status === 'in' && A.cats.some(c => c.id === S.avatarId)) list.push({ k: 'mine', q: 'catId=' + encodeURIComponent(S.avatarId), label: S.avatar.label || t('gc_mine'), named: true });
  else if (S.avatar && S.avatarId === 'local' && S.avatarLocal && S.avatarLocal.spec) list.push({ k: 'mine', q: 'spec=' + encodeURIComponent(JSON.stringify(S.avatarLocal.spec)), label: S.avatar.label || t('gc_mine') });
  const Wd = VP.Wardrobe;
  for (const n of ['mimo', 'mimosa', 'morticia']) { const wear = Wd && Wd.data ? Object.values(Wd.wearing(n)).filter(Boolean).slice(0, 6) : []; list.push({ k: n, q: 'cat=' + n + (wear.length ? '&wear=' + wear.join(',') : ''), label: t(n) }); }
  for (const l of list) l.q += '&lv=' + O.level();
  return list;
};
// the level badge: the best cat level when the progression system is there, otherwise one level per 5 stars
O.level = function () { const P = VP.Prog; let lv = 0; try { if (P && P.level) lv = Math.max(...['mimo', 'mimosa', 'morticia'].map(n => P.level(n).lv)); } catch (e) { lv = 0; } return U.clamp(Math.round(lv || 1 + Math.floor(VP.totalStars() / 5)), 1, 100); };
O.ticket = async function () {
  const looks = O.looks(), look = looks.find(l => l.k === O.sel.cat) || looks[0];
  O.sel.cat = look.k;
  const prev = VP.ls.get('vp_online_ticket');
  const r = await json('/api/online/ticket?' + look.q, { headers: prev ? { 'x-vp-ticket': prev } : {}, cache: 'no-store' });
  if (r.status !== 200 || !r.ticket) { O.lastError = r.error; return null; }
  VP.ls.set('vp_online_ticket', r.ticket);
  O.you = r.you; O.myLook = r.cat;
  return r.ticket;
};

// ---------- the world of the online mode: free roam without missions, dogs or police ----------
O.rooms = () => [{ id: 'city', name: t('on_home'), flag: '🌴' }].concat((M.cities || []).filter(c => !VP.Tour || VP.Tour.unlocked(c)).map(c => ({ id: c.id, name: c.name.split(' — ').pop(), flag: c.flag || '🌍' })));
function build(base) {
  const G = base === 'city' ? M.startFree(null, { online: true }) : M.startTour(base);
  G.online = { base, room: '', n: 1 };
  G.dogs.length = 0; G.markers = []; G.noPolice = true; G.noHeat = true; G.hungerMul = 0.02;
  G.items = G.items.filter(it => it.k !== 'gpaw');                       // single-player collectibles stay in single player
  G.friends = G.friends.filter(f => f.name === 'avatar');                // the strolling gallery cats would look like players
  const idx = ['mimo', 'mimosa', 'morticia'].indexOf(O.sel.cat); if (idx > 0) { const a = G.cats[0], b = G.cats[idx], x = a.x, y = a.y; a.x = b.x; a.y = b.y; b.x = x; b.y = y; G.active = idx; }
  const c = G.cats[G.active]; G.online.spawn = { x: c.x, y: c.y };
  // everybody arrives at the same square, a few steps apart (so two cats never start inside each other)
  const q = Game.nearFree(c.x, c.y, 60 + Math.random() * 150, 0);
  if (q) { const dx = q.x - c.x, dy = q.y - c.y; for (const k of G.cats) { k.x += dx; k.y += dy; } for (const f of G.friends) { f.x += dx; f.y += dy; } }
  return G;
}

// ---------- entering and leaving ----------
O.enter = async function (base) {
  if (O.busy) return; O.busy = true;
  try {
    base = base || O.sel.room || 'city'; O.sel.room = base;
    await O.loadCfg();
    if (!O.available()) return O.unavailable(base, true);
    if (base !== 'city') { let W = null; try { W = await VP.Tour.load(base); } catch (e) { W = null; } if (!W) { UI.toast(t('wt_fail'), 3000); return; } }
    if (!VP.R3 || !VP.R3.ok) { UI.show('nowebgl'); return; }
    const ticket = await O.ticket();
    if (!ticket) return O.unavailable(base, false, O.lastError);     // 503 and friends: solo free roam in the same map
    let G = null;
    UI.begin(() => (G = build(base)));                        // ends whatever was running (and any previous online session), then builds
    if (base !== 'city') { if (VP.R3.arrive) VP.R3.arrive(); VP.Audio.music(UI.citySong(base)); UI.songD = -2; } else UI.songD = -1;
    O.G = G; O.state = 'connecting'; O.remotes = new Map(); O.got = 0; O.paw = null; O.bubble = null; O.heading = 0; O.lastEmote = null; O.activeAt = nowS(); O.lx = undefined;
    await connect(G, base, ticket);
  } finally { O.busy = false; }
};
async function connect(G, base, ticket) {
  const c = G.cats[G.active], state = { x: Math.round(c.x), z: Math.round(c.y), ry: 0, a: 'idle', car: null };
  // polling on Vercel + Neon is the transport in use; a real-time server is tried first only when one is configured
  const tries = []; if (O.cfg.wsUrl) tries.push(() => WebSocketTransport(O.cfg.wsUrl)); if (O.cfg.pollingEnabled) tries.push(() => PollingTransport(O.cfg.tickMs));
  for (const make of tries) {
    const tr = make(); wire(tr, G);
    try {
      const w = await tr.connect({ room: G.online.room || base, ticket, renew: O.ticket, state });
      if (O.G !== G) { tr.close(); return; }                 // the player left while we were connecting
      O.tr = tr; O.state = 'on'; O.activeAt = nowS(); setTimeout(() => UI.toast(t('on_chatHint'), 4200), 2500); O.room = w.room; G.online.room = w.room; if (w.you && w.you.name) O.you = Object.assign({}, O.you, w.you);
      setPaws(G, w.paw);
      Game.fx.say('🌐 ' + t('on_hello', O.roomLabel(), O.you.name), '#2de2e6', 4);
      return;
    } catch (e) { tr.close(); if (O.G !== G) return; O.lastError = e && e.code; }
  }
  O.unavailable(base, false, O.lastError);
}
// "Cidade Online indisponível agora": back to the same place, alone
O.unavailable = function (base, fromMenu, why) {
  const G = O.G; O.stop();
  O.why = why === 'busy' || why === 'too-many' ? 'full' : why === 'afk' ? 'afk' : 'off';
  UI.toast('🌐 ' + t(O.why === 'full' ? 'on_full' : O.why === 'afk' ? 'on_afk' : 'on_unavail'), 3800);
  if (fromMenu && !G) { if (UI.screen === 'online') UI.show('online'); return; }
  if (base && base !== 'city' && VP.CityCache[base]) UI.tour(base); else UI.free();
};
O.stop = function () {
  if (O.tr) { try { O.tr.close(); } catch (e) { /* ignore */ } }
  O.tr = null; O.G = null; O.state = 'off'; O.remotes = new Map(); O.paw = null; O.trade = null; closeSheet();
};
// called by ui.js whenever a game ends (mission start, menu, another map...)
O.left = function () { if (O.G) O.stop(); };
O.leave = function () { const G = O.G, base = G && G.online.base; O.stop(); if (base && base !== 'city' && VP.CityCache[base]) UI.tour(base); else UI.free(); };
async function reconnect(G) {
  if (O.G !== G || O.state === 'connecting') return;
  O.state = 'connecting'; if (O.tr) { try { O.tr.close(); } catch (e) { /* ignore */ } O.tr = null; }
  for (const r of O.remotes.values()) gone(G, r); O.remotes = new Map();
  await new Promise(r => setTimeout(r, 1200));
  if (O.G !== G) return;
  const ticket = await O.ticket();
  if (O.G !== G) return;
  if (!ticket) return O.unavailable(G.online.base);
  await connect(G, G.online.base, ticket);
}

// ---------- remote cats ----------
function wire(tr, G) {
  tr.on.join = p => {
    if (O.G !== G || (O.you && p.id === O.you.id)) return;
    const old = O.remotes.get(p.id); if (old) gone(G, old);
    const r = { id: p.id, name: String(p.name || '').slice(0, 24), look: p.cat || { star: 'mimo' }, s: [], f: null, say: null, offer: null };
    r.lv = U.clamp(Math.round(+r.look.lv) || 1, 1, 100);
    O.remotes.set(p.id, r);
    push(r, p.x, p.z, p.ry, p.a, p.car, performance.now());
    if (!O.muted[p.id]) spawn(G, r);
  };
  tr.on.leave = id => { const r = O.remotes.get(id); if (r) { gone(G, r); O.remotes.delete(id); if (O.trade && O.trade.with === id && !O.trade.done) O.tradeCancel('on_tr_left'); } };
  tr.on.trade = (id, tr) => { if (O.G === G) O.tradeIn(id, tr); };
  tr.on.state = (id, x, z, ry, a, car, at) => { const r = O.remotes.get(id); if (r) push(r, x, z, ry, a, car, at); };
  tr.on.emote = (id, k) => { const r = O.remotes.get(id); if (r && r.f && EMOTE_S[k]) r.f.em = { k, t: EMOTE_S[k] }; };
  tr.on.phrase = (id, i) => { const r = O.remotes.get(id); if (r && !O.muted[id] && i >= 0 && i < PHRASES) r.say = { i, t: BUBBLE_S }; };
  tr.on.paws = (slot, taken) => { if (O.G === G) pawsTaken(G, slot, taken); };
  tr.on.pawOk = () => { if (O.G !== G) return; O.got++; VP.S.cash += 10; VP.persist(); VP.Audio.sfx('paw'); Game.fx.say('🐾 ' + t('on_paw', 10), '#ffd23f', 2.2); };
  tr.on.down = () => { if (O.G === G && O.tr === tr) reconnect(G); };
}
function push(r, x, z, ry, a, car, atMs) {
  const s = r.s, at = atMs / 1000, lastS = s[s.length - 1];
  if (lastS && at <= lastS.t) return;
  s.push({ t: at, x, y: z, ry, a, car: car || null });
  if (s.length > 40) s.splice(0, s.length - 40);
}
function spawn(G, r) {
  const s = r.s[r.s.length - 1];
  const f = { kind: 'friend', remote: true, stay: true, rid: r.id, name: r.look.star || 'remote', x: s.x, y: s.y, r: 9, t: Math.random() * 4, walk: 0, face: 1, spd: 0, ry: s.ry, car: s.car, em: null, label: '' };
  if (r.look.spec && VP.Acct) f.spec = VP.Acct.toSpec(r.look.spec);
  else if (r.look.star && Array.isArray(r.look.wear) && VP.Wardrobe && VP.Wardrobe.data) f.spec = VP.Wardrobe.specOf(r.look.star, r.look.wear);   // the outfit that player is wearing
  r.f = f; G.friends.push(f);
}
function gone(G, r) { if (r.f) { r.f.dead = true; const i = G.friends.indexOf(r.f); if (i >= 0) G.friends.splice(i, 1); r.f = null; } }
// interpolation between the two samples around (now - delay); a short extrapolation when the next one is late
function place(r, at, dt, maxAhead) {
  const s = r.s, f = r.f; if (!f || !s.length) return;
  let i = s.length - 1; while (i > 0 && s[i].t > at) i--;
  const a = s[i], b = s[i + 1];
  let x, y, ry, mv = 0;
  if (b) {
    const span = b.t - a.t, k = span > 0 ? U.clamp((at - a.t) / span, 0, 1) : 1, far = Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 900;
    x = far ? b.x : a.x + (b.x - a.x) * k; y = far ? b.y : a.y + (b.y - a.y) * k; ry = a.ry + U.angDiff(a.ry, b.ry) * k;
    mv = span > 0 && !far ? Math.hypot(b.x - a.x, b.y - a.y) / span : 0;
  } else {
    x = a.x; y = a.y; ry = a.ry;
    const p = s[i - 1], ahead = Math.min(maxAhead, at - a.t);
    if (p && ahead > 0 && a.a !== 'idle' && a.t - p.t > 0 && a.t - p.t < 2.5) {       // keep going for a moment
      const vx = (a.x - p.x) / (a.t - p.t), vy = (a.y - p.y) / (a.t - p.t), sp = Math.hypot(vx, vy);
      if (sp > 20 && sp < 700) { const e = ahead * (1 - ahead / (2 * maxAhead)); x += vx * e; y += vy * e; mv = at - a.t < maxAhead ? sp : 0; }
    }
  }
  const cur = b && at - a.t > (b.t - a.t) / 2 ? b : a;
  // a little smoothing on top, so corrections never pop
  const kk = Math.min(1, dt * 18), jump = Math.abs(x - f.x) + Math.abs(y - f.y) > 600;
  f.x = jump ? x : f.x + (x - f.x) * kk; f.y = jump ? y : f.y + (y - f.y) * kk;
  f.ry = ry; f.car = cur.a === 'car' ? (cur.car || 'sedan') : null;
  f.walk = !f.car && mv > 18 ? 1 : 0; f.run = cur.a === 'dash';
  if (f.em) { f.em.t -= dt; if (f.em.t <= 0 || (f.walk && f.em.k !== 'miau' && f.em.k !== 'wave') || f.car) f.em = null; }
}

// ---------- shared golden paws ----------
function setPaws(G, paw) {
  if (!paw) return;
  for (const it of G.items) if (it.online !== undefined) it.dead = true;
  G.items = G.items.filter(it => it.online === undefined);
  O.paw = { slot: paw.slot, ms: paw.ms || 120000, n: paw.n || 6, taken: new Set(paw.taken || []) };
  // same seed (room + slot) on every client = same places for everybody, without the server knowing the maps
  const r = U.rng(hash(G.online.room + ':' + paw.slot) % 2147483647), sp = G.online.spawn, W = G.W;
  for (let i = 0; i < O.paw.n; i++) {
    let q = null; for (let k = 0; k < 40; k++) { const c = W.randWalk(r), d = Math.hypot(c.x - sp.x, c.y - sp.y); if (d > 140 && d < 1500) { q = c; break; } }
    q = q || W.randWalk(r);
    if (O.paw.taken.has(i)) continue;
    const it = Game.addItem('gpaw', q.x, q.y); it.online = i;
  }
}
function pawsTaken(G, slot, taken) {
  if (!O.paw || slot !== O.paw.slot) return setPaws(G, { slot, ms: O.paw && O.paw.ms, n: O.paw && O.paw.n, taken });
  for (const i of taken) O.paw.taken.add(i);
  for (const it of G.items) if (it.online !== undefined && O.paw.taken.has(it.online)) it.dead = true;
}
// game.js calls this when the local cat touches a shared paw
O.pawPicked = function (it) {
  if (!O.tr || !O.paw) return;
  O.paw.taken.add(it.online);
  O.tr.paw(it.online, O.paw.slot);
};

// ---------- per frame ----------
O.update = function () {
  const G = O.G; if (!G) return;
  // network things run on the wall clock: the game's own dt is capped (slow phones would stretch a 4 s bubble)
  const tn = nowS(), dt = Math.min(0.5, Math.max(0, tn - (O.clock || tn))); O.clock = tn;
  if (Game.G !== G) { O.stop(); return; }
  const c = G.cats[G.active], car = G.car;
  // the local cat
  const px = car ? car.x : c.x, py = car ? car.y : c.y;
  if (O.lx !== undefined && Math.hypot(px - O.lx, py - O.ly) > 0.4) { O.heading = Math.atan2(py - O.ly, px - O.lx); O.activeAt = nowS(); }
  // five minutes without moving, talking or gesturing: the cat goes home (an open tab must not keep the database awake)
  if (O.state === 'on' && nowS() - O.activeAt > AFK_S) return O.unavailable(G.online.base, false, 'afk');
  if (car) O.heading = car.a;
  O.lx = px; O.ly = py;
  if (O.tr && O.state === 'on') {
    O.tr.state({ x: Math.round(px), z: Math.round(py), ry: O.heading, a: car ? 'car' : c.dashT > 0 ? 'dash' : c.walk ? 'walk' : 'idle', car: car ? (CARS.includes(car.type) ? car.type : 'sedan') : null });
    if (c.emote && c.emote !== O.lastEmote) { O.tr.emote(c.emote.k); O.activeAt = nowS(); }
    O.lastEmote = c.emote || null;
  }
  // everybody else
  const at = nowS() - (O.tr ? O.tr.delay : 0.2), ahead = O.tr && O.tr.name === 'poll' ? 0.7 : 0.25;
  let n = 1;
  for (const r of O.remotes.values()) {
    n++;
    if (O.muted[r.id]) { if (r.f) gone(G, r); continue; }
    if (!r.f) spawn(G, r);
    place(r, at, dt, ahead);
    if (r.say) { r.say.t -= dt; if (r.say.t <= 0) r.say = null; }
  }
  if (O.bubble) { O.bubble.t -= dt; if (O.bubble.t <= 0) O.bubble = null; }
  G.online.n = n;
};
O.count = () => (O.G ? O.G.online.n : 0);
O.roomLabel = function () { const m = /^([a-z0-9_]+)#(\d+)$/.exec(O.room || ''); if (!m) return ''; const r = O.rooms().find(x => x.id === m[1]); return (r ? r.name : m[1]) + ' #' + m[2]; };
O.objective = function (G) {
  if (O.state !== 'on') return { txt: '🌐 ' + t('on_connecting'), at: null, cat: null, free: true };
  const a = G.car || G.cats[G.active]; let b = null, bd = 1e18;
  for (const r of O.remotes.values()) if (r.f) { const d = U.d2(a.x, a.y, r.f.x, r.f.y); if (d < bd) { bd = d; b = r.f; } }
  const n = G.online.n;
  return { txt: '🌐 ' + O.roomLabel() + ' · 👥 ' + (n > 1 ? t('on_count', n) : t('on_alone')), at: b && bd > 420 * 420 ? b : null, cat: null, free: true };
};

// ---------- quick phrases, mute, report ----------
O.say = function (i) {
  if (!O.tr || O.state !== 'on' || !(i >= 0 && i < PHRASES)) return;
  const n = performance.now(); if (n - (O.saidAt || 0) < 1300) return;
  O.saidAt = n; O.activeAt = nowS(); O.tr.phrase(i); O.bubble = { i, t: BUBBLE_S }; VP.Audio.sfx('paw', 0.1);
};
O.mute = function (id, on) { if (on && O.trade && O.trade.with === id && !O.trade.done) O.tradeCancel(); if (on) { const r0 = O.remotes.get(id); if (r0) r0.offer = null; if (O.sheet === 'inv') closeSheet(); } if (on) O.muted[id] = 1; else delete O.muted[id]; try { sessionStorage.setItem('vp_online_muted', JSON.stringify(O.muted)); } catch (e) { /* ignore */ } const r = O.remotes.get(id); if (r && on) { r.say = null; if (O.G) gone(O.G, r); } };
O.report = function (id, reason) {
  if (!O.tr || !REASONS.includes(reason)) return;
  O.tr.report(id, reason); O.mute(id, true);
  UI.toast('🚩 ' + t('on_reported'), 3200);
};

// ---------- HUD (drawn by hud.js inside its world-label pass) ----------
O.drawHud = function (c, G, R3, k, tools) {
  if (O.G !== G) return;
  // name tag: gold level badge + name (+ 🎁 when that cat is offering a trade)
  const tag = (s, x, y, col, lv, gift) => {
    const F = 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; if (gift) s += ' 🎁';
    c.font = '800 ' + 11 * k + F; const nw = c.measureText(s).width; const b = t('on_lv') + ' ' + lv; c.font = '900 ' + 10 * k + F; const bw = c.measureText(b).width + 10 * k;
    const w = nw + bw + 16 * k, x0 = x - w / 2;
    tools.pill(x0, y - 9 * k, w, 18 * k, 'rgba(18,4,31,.78)', col);
    tools.pill(x0 + 2 * k, y - 7 * k, bw, 14 * k, '#ffd23f'); tools.txt(b, x0 + 2 * k + bw / 2, y + 0.5, 10 * k, '#3a2a00', 'center', false, '900');
    tools.txt(s, x0 + bw + 7 * k + nw / 2, y + 0.5, 11 * k, '#fff', 'center', false, '800'); return w;
  };
  const bubble = (s, x, y) => {
    c.font = '800 ' + 13 * k + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; const w = c.measureText(s).width + 20 * k, h = 26 * k;
    x = U.clamp(x, w / 2 + 6, VP.HUD.w - w / 2 - 6);
    c.beginPath(); c.moveTo(x - 6 * k, y + h / 2 - 1); c.lineTo(x, y + h / 2 + 7 * k); c.lineTo(x + 6 * k, y + h / 2 - 1); c.closePath(); c.fillStyle = '#fff'; c.fill();
    tools.pill(x - w / 2, y - h / 2, w, h, '#fff', '#2de2e6'); tools.txt(s, x, y + 0.5, 13 * k, '#12041f', 'center', false, '800');
  };
  const a = G.car || G.cats[G.active];
  O.tags = [];
  for (const r of O.remotes.values()) {
    const f = r.f; if (!f || Math.abs(f.x - a.x) > 1100 || Math.abs(f.y - a.y) > 1100) continue;
    const p = R3.project(f.x, f.y, f.car ? 2.5 : 1.75); if (!p.on) continue;
    const Wd = VP.Wardrobe, vip = !!(Wd && Wd.item && Array.isArray(r.look.wear) && r.look.wear.some(id => { const it = Wd.item(id); return it && it.grant === 'vip'; })); // a VIP look: golden crown tag (same declared-look trust as the ranking crown)
    const w = tag(vip ? '👑 ' + r.name : r.name, p.x, p.y, vip ? '#ffd23f' : '#2de2e6', r.lv, r.offer && !O.trade);
    O.tags.push({ id: r.id, x: p.x, y: p.y + 18 * k, w: Math.max(w, 60 * k) / 2 + 8, h: 44 * k });
    if (r.say) { c.globalAlpha = Math.min(1, r.say.t * 3); bubble(t('on_p' + r.say.i), p.x, p.y - 30 * k); c.globalAlpha = 1; }
  }
  if (O.bubble) { const p = R3.project(a.x, a.y, G.car ? 2.5 : 1.9); if (p.on) { c.globalAlpha = Math.min(1, O.bubble.t * 3); bubble(t('on_p' + O.bubble.i), p.x, p.y - 22 * k); c.globalAlpha = 1; } }
};
O.radar = function (dot) { for (const r of O.remotes.values()) if (r.f) dot(r.f.x, r.f.y, '#2de2e6', 2.8); };
// taps on the HUD canvas: the 💬 button, the room pill, a cat's name tag
O.hudHit = function (x, y) {
  const H = VP.HUD, G = O.G; if (!G || Game.G !== G || O.state !== 'on') return null;
  const b = H.btn.say; if (b && U.d2(x, y, b.x, b.y) < (b.r + 7) * (b.r + 7)) return 'on_say';
  const r = H.obRect; if (r && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return 'on_list';
  for (const g of O.tags || []) if (Math.abs(x - g.x) < g.w && Math.abs(y - g.y) < g.h) { O.tapId = g.id; return 'on_cat'; }
  return null;
};
O.hudTap = function (hit) { if (hit === 'on_say') sheet(O.sheet === 'say' ? null : 'say'); else if (hit === 'on_list') sheet('list'); else if (hit === 'on_cat') sheet('cat', O.tapId); };
addEventListener('keydown', e => { if (!O.G || O.state !== 'on' || UI.screen || (e.target && e.target.tagName === 'INPUT')) return; const k = e.key.toLowerCase(); if (k === 't' || k === 'enter') sheet(O.sheet === 'say' ? null : 'say'); else if (k === 'escape' && O.sheet) { closeSheet(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);   // capture: Esc closes the chat before it can pause the game

// ---------- sheets over the game (phrases, who is here, one cat) ----------
function closeSheet() { const el = document.getElementById('onl'); if (el) el.remove(); O.sheet = null; clearTimeout(O.sheetT); }
function sheet(kind, arg) {
  closeSheet(); if (!kind || !O.G) return;
  const el = document.createElement('div'); el.id = 'onl'; el.className = 'onl ' + kind; O.sheet = kind;
  const row = r => `<div class="orow" data-id="${esc(r.id)}"><b>${O.muted[r.id] ? '🔇 ' : '🐱 '}<i class="olv">${t('on_lv')} ${r.lv}</i> ${esc(r.name)}</b><button class="chip" data-o="mute" data-id="${esc(r.id)}">${O.muted[r.id] ? '🔊 ' + t('on_unmute') : '🔇 ' + t('on_mute')}</button><button class="chip warn" data-o="rep" data-id="${esc(r.id)}">🚩 ${t('on_report')}</button></div>`;
  if (kind === 'say') el.innerHTML = `<div class="obox"><div class="ohead"><b>💬 ${t('on_say')}</b><button class="chip" data-o="close">✕</button></div><div class="ogrid">${Array.from({ length: PHRASES }, (_, i) => `<button class="ophrase" data-o="say" data-i="${i}">${esc(t('on_p' + i))}</button>`).join('')}</div><p class="small">${t('on_sayNote')}</p></div>`;
  else if (kind === 'list') { const rs = [...O.remotes.values()]; el.innerHTML = `<div class="obox"><div class="ohead"><b>🌐 ${esc(O.roomLabel())} · 👥 ${rs.length + 1}</b><button class="chip" data-o="close">✕</button></div><div class="orow me"><b>💛 ${esc(O.you ? O.you.name : '')}</b><span class="small">${t('on_you')}</span></div>${rs.length ? rs.map(row).join('') : `<p class="small">${t('on_aloneLong')}</p>`}<p class="small">🛡 ${t('on_safe')}</p><button class="btn ghost sm" data-o="leave">🚪 ${t('on_leave')}</button></div>`; }
  else if (kind === 'cat') { const r = O.remotes.get(arg); if (!r) { O.sheet = null; return; } el.innerHTML = `<div class="obox"><div class="ohead"><b>🐱 ${esc(r.name)}</b><button class="chip" data-o="close">✕</button></div>${row(r)}${O.muted[r.id] ? '' : `<button class="btn teal sm" data-o="trade" data-id="${esc(r.id)}">🎁 ${t(r.offer ? 'on_tr_see' : 'on_tr_open')}</button>`}</div>`; }
  else if (kind === 'inv') { const r = O.remotes.get(arg); if (!r || !r.offer) { O.sheet = null; return; } el.innerHTML = `<div class="obox"><div class="ohead"><b>🎁 ${t('on_tr_inv', esc(r.name))}</b><button class="chip" data-o="tradeNo" data-id="${esc(r.id)}">✕</button></div><div class="row"><button class="btn ghost sm" data-o="tradeNo" data-id="${esc(r.id)}">${t('on_tr_no')}</button><button class="btn teal sm" data-o="trade" data-id="${esc(r.id)}">${t('on_tr_see')}</button></div></div>`; }
  else if (kind === 'trade') { const h = tradeHtml(arg); if (!h) { O.sheet = null; return; } el.innerHTML = h; }
  else if (kind === 'rep') { const r = O.remotes.get(arg); if (!r) { O.sheet = null; return; } el.innerHTML = `<div class="obox"><div class="ohead"><b>🚩 ${t('on_report')}: ${esc(r.name)}</b><button class="chip" data-o="close">✕</button></div><p class="small">${t('on_repWhy')}</p><div class="ogrid one">${REASONS.map(x => `<button class="ophrase" data-o="repSend" data-id="${esc(r.id)}" data-r="${x}">${t('on_r_' + x)}</button>`).join('')}</div><p class="small">${t('on_repNote')}</p></div>`; }
  const born = performance.now();
  el.addEventListener('click', e => {
    if (performance.now() - born < 350) return;               // the tap that opened the sheet must not press what appears under the finger
    const b = e.target.closest('[data-o]'); if (!b) { if (e.target === el) closeSheet(); return; }
    const o = b.dataset.o, id = b.dataset.id;
    VP.Audio.sfx('click');
    if (o === 'close') closeSheet();
    else if (o === 'say') { O.say(+b.dataset.i); closeSheet(); }
    else if (o === 'mute') { O.mute(id, !O.muted[id]); sheet(kind, arg); }
    else if (o === 'rep') sheet('rep', id);
    else if (o === 'trade') O.tradeOpen(id);
    else if (o === 'tradeNo') { O.declined[id] = performance.now(); closeSheet(); }
    else if (o === 'trGive') O.tradeGive(b.dataset.i || null);
    else if (o === 'trOk') O.tradeConfirm();
    else if (o === 'trCancel') O.tradeCancel();
    else if (o === 'repSend') { O.report(id, b.dataset.r); closeSheet(); }
    else if (o === 'leave') { closeSheet(); O.leave(); }
  });
  document.body.appendChild(el);
  if (kind === 'inv') el.classList.add('say');
  if (kind === 'say') O.sheetT = setTimeout(() => { if (O.sheet === 'say') closeSheet(); }, 9000);
}
O.openSheet = sheet; O.closeSheet = closeSheet;

// ---------- trade, the safe way ----------
// Only wardrobe items bought with coins change hands (never coins, never VIP / Pix items), one for one or as a gift.
// Nothing is typed. Both sides see both offers, both must confirm, any change un-confirms, and the confirm button
// stays locked for 3 s after a change so nobody is rushed into a swapped offer. At most 5 trades a day.
const TR_LOCK = 3000, TR_DAY = 5;
O.declined = {};
const itemName = id => { const it = VP.Wardrobe && VP.Wardrobe.item(id); return it ? it.name[VP.lang() === 'pt' ? 'pt' : 'en'] : null; };
const dayN = () => { const S = VP.S, k = M.dayKey(); if (!S.trades || S.trades.k !== k) S.trades = { k, n: 0 }; return S.trades; };
const tradeSend = () => { const T = O.trade; if (O.tr && O.tr.trade) O.tr.trade(T && !T.closed ? { to: T.with, give: T.give, st: T.st } : null); O.activeAt = nowS(); };
const tradeDraw = () => { if (O.sheet === 'trade') sheet('trade', O.trade && O.trade.with); };
const relock = () => { const T = O.trade; if (!T) return; T.lock = performance.now() + TR_LOCK; clearTimeout(O.lockT); O.lockT = setTimeout(tradeDraw, TR_LOCK + 60); };
// why the offer of the other cat cannot be accepted (null = fine)
function theirProblem(give) { const Wd = VP.Wardrobe; if (!give) return null; const it = Wd.item(give); if (!Wd.tradable(it)) return 'on_tr_bad'; if (Wd.owns(it)) return 'on_tr_have'; return null; }
O.tradeOpen = function (id) {
  const r = O.remotes.get(id); if (!r || O.muted[id] || !VP.Wardrobe || !VP.Wardrobe.data) return;
  if (O.trade && O.trade.with !== id && !O.trade.done) O.tradeCancel();
  if (!O.trade || O.trade.with !== id) { O.trade = { with: id, give: null, st: 0, seen: undefined }; relock(); tradeSend(); }
  sheet('trade', id);
};
O.tradeGive = function (itemId) { const T = O.trade; if (!T || T.done) return; if (itemId && !VP.Wardrobe.ownedTradable().some(it => it.id === itemId)) return; T.give = itemId; T.st = 0; relock(); tradeSend(); tradeDraw(); };
O.tradeConfirm = function () {
  const T = O.trade, r = T && O.remotes.get(T.with); if (!T || T.done || !r || !r.offer) return;
  if (performance.now() < T.lock || theirProblem(r.offer.give) || (!T.give && !r.offer.give) || dayN().n >= TR_DAY) return;
  T.st = 1; T.seen = r.offer.give; tradeSend(); tradeCheck(); tradeDraw();
};
O.tradeCancel = function (why) { const T = O.trade; if (!T) return; clearTimeout(O.lockT); O.trade = null; tradeSend(); if (O.sheet === 'trade') closeSheet(); if (why) UI.toast('🎁 ' + t(why), 2600); };
// the other cat's offer changed (or went away)
O.tradeIn = function (id, tr) {
  const r = O.remotes.get(id); if (!r) return;
  const me = O.you && O.you.id, had = r.offer;
  r.offer = tr && tr.to === me && !O.muted[id] ? tr : null;
  const T = O.trade;
  if (T && T.with === id && !T.done) {
    if (!r.offer) return O.tradeCancel(had ? 'on_tr_cancelled' : null);
    if (!had || had.give !== r.offer.give) { relock(); if (T.st === 1) { T.st = 0; tradeSend(); } }     // their offer changed: confirm again, after the lock
    tradeCheck(); tradeDraw();
  } else if (r.offer && !had && !T && !O.sheet && !UI.screen && !(performance.now() - (O.declined[id] || -1e9) < 60000)) sheet('inv', id);
  else if (!r.offer && O.sheet === 'inv') closeSheet();
};
// both confirmed the same pair of offers: the items change hands, once
function tradeCheck() {
  const T = O.trade, r = T && O.remotes.get(T.with), Wd = VP.Wardrobe; if (!T || T.done || T.st !== 1 || !r || !r.offer || r.offer.st < 1 || r.offer.give !== T.seen) return;
  if (theirProblem(T.seen) || (T.give && !Wd.ownedTradable().some(it => it.id === T.give))) return O.tradeCancel('on_tr_cancelled');
  if (T.give) Wd.give(T.give); if (T.seen) Wd.take(T.seen);
  dayN().n++; VP.persist(); if (VP.onProgress) VP.onProgress();
  T.done = true; T.st = 2; tradeSend();
  VP.Audio.sfx('win'); UI.confetti(); UI.toast('🎁 ' + (T.seen ? t('on_tr_got', itemName(T.seen)) : t('on_tr_gave', itemName(T.give))), 3600);
  if (O.sheet === 'trade') closeSheet();
  setTimeout(() => { if (O.trade === T) { T.closed = true; tradeSend(); O.trade = null; } }, 6000);
}
function tradeHtml(id) {
  const T = O.trade, r = O.remotes.get(id), Wd = VP.Wardrobe; if (!T || T.with !== id || !r) return null;
  const mine = Wd.ownedTradable(), theirs = r.offer, prob = theirs ? theirProblem(theirs.give) : null, left = TR_DAY - dayN().n;
  const locked = performance.now() < T.lock, nothing = theirs && !T.give && !theirs.give;
  const state = !theirs ? t('on_tr_wait', esc(r.name)) : left <= 0 ? t('on_tr_limit') : prob ? t(prob) : nothing ? t('on_tr_pick') : T.st === 1 ? t('on_tr_waitOk', esc(r.name)) : theirs.st >= 1 ? t('on_tr_theyOk', esc(r.name)) : t('on_tr_check');
  return `<div class="obox"><div class="ohead"><b>🎁 ${t('on_tr_title', esc(r.name))}</b><button class="chip" data-o="trCancel">✕</button></div>
    <p class="small"><b>${t('on_tr_youGive')}</b></p>
    <div class="ogrid">${mine.length ? `<button class="ophrase ${!T.give ? 'on' : ''}" data-o="trGive" data-i="">${t('on_tr_nothing')}</button>` + mine.map(it => `<button class="ophrase ${T.give === it.id ? 'on' : ''}" data-o="trGive" data-i="${it.id}">${esc(it.name[VP.lang() === 'pt' ? 'pt' : 'en'])}</button>`).join('') : `<p class="small">${t('on_tr_none')}</p>`}</div>
    <p class="small"><b>${t('on_tr_youGet')}</b></p>
    <div class="otheirs ${theirs && theirs.st >= 1 ? 'ok' : ''}">${!theirs ? '…' : theirs.give ? esc(itemName(theirs.give) || '?') : t('on_tr_nothing')}${theirs && theirs.st >= 1 ? ' ✔' : ''}</div>
    <p class="small ostate">${state}</p>
    <div class="row"><button class="btn ghost sm" data-o="trCancel">${t('on_tr_cancel')}</button><button class="btn sm" data-o="trOk" ${!theirs || locked || prob || nothing || left <= 0 || T.st === 1 ? 'disabled' : ''}>${T.st === 1 ? '✔ ' + t('on_tr_confirmed') : locked && theirs ? '⏳ ' + t('on_tr_confirm') : '✔ ' + t('on_tr_confirm')}</button></div>
    <p class="small">🛡 ${t('on_tr_safe', left > 0 ? left : 0)}</p></div>`;
}

// ---------- lobby ----------
UI.SCREENS.online = {
  hideHud: true,
  html: () => {
    const rooms = O.rooms(), looks = O.looks(), G = Game.G;
    if (!rooms.some(r => r.id === O.sel.room)) O.sel.room = 'city';
    if (!looks.some(l => l.k === O.sel.cat)) O.sel.cat = looks[0].k;
    const look = looks.find(l => l.k === O.sel.cat), ok = O.cfg ? O.available() : null, guest = !(VP.Acct && VP.Acct.status === 'in');
    return `<div class="corner l"><button class="chip" data-act="back">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="teal">🌐 ${t('on_title')}</h2>
      <p class="small">${t('on_sub')}</p>
      <div class="panel"><p class="small">${t('on_what')}</p></div>
      ${ok === false ? `<div class="panel t"><p><b>🔒 ${t('on_closed')}</b></p><p class="small">${t('on_closedSub')}</p></div><button class="btn" data-act="playStory">🎬 ${t('md_story')}</button>` : `${O.tester() && !(O.cfg && O.cfg.enabled) ? `<p class="small">🧪 ${t('on_testerNote')}</p>` : ''}
      <div class="panel"><div class="sw col"><span>🗺 ${t('on_where')}</span><select class="txt osel" id="onroom">${rooms.map(r => `<option value="${esc(r.id)}" ${r.id === O.sel.room ? 'selected' : ''}>${r.flag} ${esc(r.name)}</option>`).join('')}</select></div>
        <div class="sw col" style="border:0"><span>🐱 ${t('on_who')}</span><span class="row">${looks.map(l => `<button class="tab ${l.k === O.sel.cat ? 'on' : ''}" data-act="onCat" data-k="${l.k}">${l.k === 'mine' ? '💛 ' : ''}${esc(l.label)}</button>`).join('')}</span></div>
        <p class="small">${look.named ? t('on_nameCat', esc(look.label)) : t('on_nameNick')}${guest ? '' : ''}</p></div>
      <div class="panel t"><p class="small"><b>🛡 ${t('on_rules')}</b></p><p class="small">${t('on_rulesTxt')}</p></div>
      <button class="btn big" data-act="onEnter" ${ok === null ? 'disabled' : ''}>▶ ${ok === null ? t('loading') : t('on_enter')}</button>
      <p class="small" id="onstat">${O.health != null ? '👥 ' + t('on_now', O.health) : ''}</p>`}
      <div class="row"><button class="btn ghost sm" data-act="back">${t('back')}</button><a class="btn ghost sm" href="privacy.html#online" target="_blank" rel="noopener">🔒 ${t('ac_privacy')}</a></div>${G ? '' : ''}</div>`;
  },
  after: () => {
    const sel = document.getElementById('onroom'); if (sel) sel.addEventListener('change', () => { O.sel.room = sel.value; });
    if (!O.cfg) O.loadCfg().then(() => { if (UI.screen === 'online') UI.show('online'); });
    else if (O.cfg.wsUrl && !O.healthAt) {   // how many cats are out there right now (numbers only)
      O.healthAt = 1;
      json(O.cfg.wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '') + '/health').then(h => { if (h.status === 200 && typeof h.players === 'number') { O.health = h.players; const el = document.getElementById('onstat'); if (el && UI.screen === 'online') el.textContent = '👥 ' + t('on_now', h.players); } setTimeout(() => { O.healthAt = 0; }, 15000); });
    }
  },
};
UI.act.online = () => { if (VP.Acct && VP.Acct.minorBlock && VP.Acct.minorBlock()) { UI.toast(t('ac_guardBlock'), 3500); return; } const G = Game.G; if (G && G.tour && !O.G) O.sel.room = G.tour; else if (O.G) O.sel.room = O.G.online.base; UI.show('online'); };
UI.act.onCat = el => { O.sel.cat = el.dataset.k; const s = document.getElementById('onroom'); if (s) O.sel.room = s.value; UI.show('online'); };
UI.act.onEnter = el => { const s = document.getElementById('onroom'); if (s) O.sel.room = s.value; el.disabled = true; el.textContent = '… ' + t('on_connecting'); O.enter(O.sel.room).then(() => { if (UI.screen === 'online' && !O.G) UI.show('online'); }); };
UI.act.onSolo = () => UI.free();
UI.act.playStory = () => UI.show('title');
UI.act.onLeave = () => O.leave();
})();
