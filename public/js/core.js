'use strict';
// VICE PAWS — core: namespace, utils, save, assets, input
(function () {
const VP = window.VP = { TILE: 48 };
const U = VP.U = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  pick: a => a[(Math.random() * a.length) | 0],
  d2: (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  angDiff: (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; },
  rng(seed) {
    let s = (seed >>> 0) || 1;
    const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
    f.pick = a => a[Math.floor(f() * a.length)];
    f.range = (a, b) => a + f() * (b - a);
    f.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    return f;
  },
  fmtTime: s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
};

// ---------- storage (always try/catch: Instagram in-app browser can block it) ----------
const ls = VP.ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};
const SKEY = 'vp_save_v4';
const fresh = () => ({ unlocked: 1, stars: {}, best: {}, lives: 3, cash: 0, bonus: {}, name: '', pos: null, avatar: null });
let S = null;
try { S = JSON.parse(ls.get(SKEY)); } catch (e) { S = null; }
if (!S || typeof S !== 'object' || !S.stars) S = fresh();
VP.S = S;
VP.persist = keepTs => { if (!keepTs) VP.S.ts = Date.now(); ls.set(SKEY, JSON.stringify(VP.S)); };
VP.resetSave = () => { VP.S = S = fresh(); VP.persist(); };
VP.totalStars = () => Object.values(VP.S.stars).reduce((a, b) => a + b, 0);
VP.totalScore = () => Object.values(VP.S.best).reduce((a, b) => a + b, 0);
VP.maxLevel = () => Object.keys(VP.S.stars).reduce((a, b) => Math.max(a, +b), 0);

// ---------- optional art slots (public/assets/manifest.json) ----------
// Every key has a built-in fallback, so missing files never break the game.
const A = VP.Assets = {
  defaults: { title_bg: null, share: null, portrait_mimo: null, portrait_mimosa: null, portrait_morticia: null, boss_1: null, boss_5: null, shop_vip: null, shop_season: null, shop_apoio: null },
  url: {}, img: {},
  get(k) { return A.url[k] || null; },
  image(k) { const i = A.img[k]; return i && i.complete && i.naturalWidth ? i : null; },
  _set(k, u) {
    if (!u) return;
    const i = new Image();
    i.onload = () => { A.url[k] = u; A.img[k] = i; if (A.onchange) A.onchange(k); };
    i.src = u;
  },
  load() {
    for (const k in A.defaults) A._set(k, A.defaults[k]);
    try {
      fetch('assets/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(m => {
        if (!m) return;
        for (const k in m) if (typeof m[k] === 'string' && k[0] !== '_' && /^[\w./-]+$/.test(m[k]) && !m[k].includes('..')) A._set(k, 'assets/' + m[k]);
      }).catch(() => {});
    } catch (e) { /* offline */ }
  },
};

// ---------- input ----------
const I = VP.I = {
  keys: {}, touch: false, useMouse: false,
  mx: 0, my: 0, attack: false, aim: null, yaw: -Math.PI / 2, mw: null, look: 0, bot: null,
  pressed: { special: false, dash: false, ctx: false, pause: false, sw: -1, cycle: false, emote: false },
  ctxHeld: false,
  mouse: { x: 0, y: 0, down: false },
  stick: { id: -1, ox: 0, oy: 0, x: 0, y: 0 },
  atk: { id: -1, ox: 0, oy: 0, x: 0, y: 0 },
  held: {}, // button id -> pointer id
  enabled: false,
};
try { I.touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window; } catch (e) { I.touch = false; }
const KEYMAP = { ' ': 'special', shift: 'dash', e: 'ctx', r: 'ctx', f: 'ctx' };
const EMOTE_KEYS = { z: 'miau', x: 'dance', c: 'sit', v: 'wave' };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.target && e.target.tagName === 'INPUT') return;
  if (I.enabled && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  I.keys[k] = true;
  if (KEYMAP[k]) I.pressed[KEYMAP[k]] = true;
  if (k === '1' || k === '2' || k === '3') I.pressed.sw = +k - 1;
  if (k === 'q' || k === 'tab') I.pressed.cycle = true;
  if (EMOTE_KEYS[k]) I.pressed.emote = EMOTE_KEYS[k];
  if (k === 'p' || k === 'escape') I.pressed.pause = true;
  if (k === 'm' && VP.Audio) VP.Audio.toggleMute();
});
addEventListener('keyup', e => { I.keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { I.keys = {}; I.mouse.down = false; });

I.bind = function (cv) {
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!I.enabled) return;
    e.preventDefault();
    if (VP.Audio) VP.Audio.unlock();
    const p = pos(e), isTouch = e.pointerType !== 'mouse';
    I.touch = isTouch; I.useMouse = !isTouch;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    const hit = VP.HUD ? VP.HUD.hit(p.x, p.y) : null;
    if (hit) {
      if (hit === 'atk') { I.atk.id = e.pointerId; I.atk.ox = I.atk.x = p.x; I.atk.oy = I.atk.y = p.y; }
      else if (hit === 'pause') I.pressed.pause = true;
      else if (hit === 'emo') { VP.HUD.emoOpen = VP.HUD.emoOpen > 0 ? 0 : 4.5; }
      else if (hit.slice(0, 3) === 'em_') { I.pressed.emote = hit.slice(3); VP.HUD.emoOpen = 0; }
      else if (hit.slice(0, 3) === 'on_') { if (VP.Online) VP.Online.hudTap(hit); }
      else if (hit.length === 2 && hit[0] === 'c') I.pressed.sw = +hit[1];
      else { I.pressed[hit] = true; I.held[hit] = e.pointerId; }
      return;
    }
    if (!isTouch) {
      if (e.button === 2) { I.rmb = true; I.lastX = p.x; } else I.mouse.down = true;
      I.mouse.x = p.x; I.mouse.y = p.y; return;
    }
    if (p.x < cv.clientWidth * 0.55 && I.stick.id < 0) { I.stick.id = e.pointerId; I.stick.ox = I.stick.x = p.x; I.stick.oy = I.stick.y = p.y; }
    else if (I.atk.id < 0) { I.atk.id = e.pointerId; I.atk.ox = I.atk.x = p.x; I.atk.oy = I.atk.y = p.y; }
  });
  cv.addEventListener('pointermove', e => {
    const p = pos(e);
    if (e.pointerType === 'mouse') { I.mouse.x = p.x; I.mouse.y = p.y; I.useMouse = true; if (I.rmb) { I.look += (p.x - I.lastX) * 0.008; I.lastX = p.x; } }
    if (e.pointerId === I.stick.id) { I.stick.x = p.x; I.stick.y = p.y; }
    if (e.pointerId === I.atk.id) { I.atk.x = p.x; I.atk.y = p.y; }
  });
  const up = e => {
    if (e.pointerId === I.stick.id) I.stick.id = -1;
    if (e.pointerId === I.atk.id) I.atk.id = -1;
    for (const k in I.held) if (I.held[k] === e.pointerId) delete I.held[k];
    if (e.pointerType === 'mouse') { I.mouse.down = false; I.rmb = false; }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
};
I.reset = function () {
  I.stick.id = I.atk.id = -1; I.held = {}; I.mouse.down = false; I.keys = {};
  const p = I.pressed; p.special = p.dash = p.ctx = p.pause = p.cycle = p.emote = false; p.sw = -1;
};
// Called once per frame: resolves all devices into one state.
I.poll = function () {
  if (I.bot) return I.bot();
  const k = I.keys;
  let mx = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
  let my = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
  if (I.stick.id >= 0) {
    const dx = I.stick.x - I.stick.ox, dy = I.stick.y - I.stick.oy, d = Math.hypot(dx, dy), R = 52;
    if (d > 8) { const m = Math.min(1, d / R); mx = dx / d * m; my = dy / d * m; }
    if (d > R) { I.stick.ox = I.stick.x - dx / d * R; I.stick.oy = I.stick.y - dy / d * R; }
  }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  I.rawx = mx; I.rawy = my;
  // camera-relative -> world (yaw = angle the camera looks along, in world x/y)
  const yaw = I.yaw, fx = Math.cos(yaw), fy = Math.sin(yaw);
  I.mx = fx * -my - fy * mx; I.my = fy * -my + fx * mx;
  I.attack = I.atk.id >= 0 || I.mouse.down || !!k.j || !!k.k;
  I.aim = null;
  if (I.atk.id >= 0) {
    const dx = I.atk.x - I.atk.ox, dy = I.atk.y - I.atk.oy;
    if (Math.hypot(dx, dy) > 16) I.aim = Math.atan2(fy * -dy + fx * dx, fx * -dy - fy * dx);
  }
  I.ctxHeld = !!(k.e || k.r || k.f || I.held.ctx !== undefined);
};
// Haptic feedback on hits (Android browsers; iOS has no navigator.vibrate and simply ignores this). Off in Settings.
VP.haptic = function (ms, gap) {
  try {
    if (!I.touch || I.bot || !navigator.vibrate || VP.ls.get('vp_haptic') === '0') return false;
    const now = performance.now(); if (now - (VP._hapT || 0) < (gap || 70)) return false; // rapid fire must not turn into a constant buzz
    VP._hapT = now; navigator.vibrate(ms); VP.haptics = (VP.haptics || 0) + 1; return true;
  } catch (e) { return false; }
};
I.take = function (name) { const v = I.pressed[name]; I.pressed[name] = name === 'sw' ? -1 : false; return v; };
})();
