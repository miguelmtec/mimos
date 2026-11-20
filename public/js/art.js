'use strict';
// VICE PAWS — procedural vector art: cats, dogs, cars, props, icons
(function () {
const VP = window.VP, TAU = Math.PI * 2;
const Art = VP.Art = {};
const INK = '#1a0d24';

function ell(c, x, y, rx, ry, fill, stroke, lw, rot) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
}
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function box(c, x, y, w, h, r, fill, stroke, lw) {
  rr(c, x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
}
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.lineJoin = 'round'; c.stroke(); }
}
// fluffy blob: an ellipse with soft fur tufts
function fluffPath(c, x, y, rx, ry, n, amp, ph) {
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a0 = (i / n) * TAU + (ph || 0), a1 = ((i + 0.5) / n) * TAU + (ph || 0);
    const px = x + Math.cos(a0) * rx, py = y + Math.sin(a0) * ry;
    if (i === 0) c.moveTo(px, py);
    else {
      const am = ((i - 0.5) / n) * TAU + (ph || 0);
      c.quadraticCurveTo(x + Math.cos(am) * rx * (1 + amp), y + Math.sin(am) * ry * (1 + amp), px, py);
    }
    void a1;
  }
  c.closePath();
}
function fluff(c, x, y, rx, ry, n, amp, fill, stroke, lw, ph) {
  fluffPath(c, x, y, rx, ry, n, amp, ph);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.lineJoin = 'round'; c.stroke(); }
}
Art.ell = ell; Art.rr = rr; Art.box = box; Art.poly = poly;

// ================= CATS =================
const CATS = Art.CATS = {
  mimo: { fur: '#f7ead0', fur2: '#e6cfa6', ear: '#f4a9b8', coat: '#fff6e6', coat2: '#1d2440', eye: '#3fa9f5', ink: INK, s: 1.06, tail: '#f0dcb8' },
  mimosa: { fur: '#fffaf2', fur2: '#f28a2e', fur3: '#2b1f24', ear: '#f4a9b8', coat: '#ff4fb8', coat2: '#c2267f', eye: '#f2b01e', ink: INK, s: 1.0, tail: '#f28a2e', bow: '#ff3fa4' },
  morticia: { fur: '#33283d', fur2: '#4a3b57', ear: '#8a5a78', coat: '#17121d', coat2: '#3c3148', eye: '#ffc928', ink: '#0d0812', s: 0.84, tail: '#33283d', rim: '#9a86b8' },
  // rescued friends
  f0: { fur: '#b9b3ad', fur2: '#8d8780', ear: '#f4a9b8', coat: '#b9b3ad', coat2: '#8d8780', eye: '#7bd88f', ink: INK, s: 0.7, tail: '#8d8780', kit: 1 },
  f1: { fur: '#f6a94a', fur2: '#d9822b', ear: '#f4a9b8', coat: '#f6a94a', coat2: '#d9822b', eye: '#7bd88f', ink: INK, s: 0.7, tail: '#d9822b', kit: 1 },
  f2: { fur: '#ffffff', fur2: '#e3e3ea', ear: '#f4a9b8', coat: '#ffffff', coat2: '#e3e3ea', eye: '#6fc3ff', ink: INK, s: 0.7, tail: '#e3e3ea', kit: 1 },
  f3: { fur: '#8a6a52', fur2: '#5e4635', ear: '#f4a9b8', coat: '#8a6a52', coat2: '#5e4635', eye: '#ffd23f', ink: INK, s: 0.7, tail: '#5e4635', kit: 1 },
};
const WHITE = { fur: '#fff', fur2: '#fff', fur3: '#fff', ear: '#fff', coat: '#fff', coat2: '#fff', eye: '#fff', ink: '#fff', tail: '#fff', bow: '#fff', rim: '#fff' };

// p: {name, t (anim time), walk (0..1 moving), face (1/-1), aim, flash, down, sleepy, atk (0..1 attack anim), bite, mouth, invis}
Art.cat = function (c, x, y, p) {
  const base = CATS[p.name], C = p.flash ? Object.assign({}, base, WHITE) : base;
  const s = base.s * (p.scale || 1), t = p.t || 0, w = p.walk || 0;
  const name = p.name;
  c.save(); c.translate(x, y);
  if (p.alpha !== undefined) c.globalAlpha = p.alpha;
  // shadow
  ell(c, 0, 1, 14 * s, 5.5 * s, 'rgba(0,0,0,.32)');
  if (p.down) {
    c.translate(0, -7 * s); c.rotate(p.face > 0 ? 1.45 : -1.45); c.translate(0, 14 * s);
  }
  c.scale(p.face * s, s);
  const bob = p.down ? 0 : Math.sin(t * (w ? 16 : 3)) * (w ? 1.4 : 0.7);
  const sw = w ? Math.sin(t * 16) * 3.2 : 0;
  const lunge = (p.atk || 0) * 5;
  c.translate(lunge, 0);
  const lw = 1.9, ink = C.ink;
  // tail
  const wag = Math.sin(t * 5) * 4;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(-8, -9); c.quadraticCurveTo(-21, -10 + wag * 0.3, -19, -24 + wag);
  c.strokeStyle = ink; c.lineWidth = 9.5; c.stroke();
  c.strokeStyle = C.tail; c.lineWidth = 6.5; c.stroke();
  if (name === 'mimosa') { c.beginPath(); c.moveTo(-19.6, -19 + wag * 0.8); c.lineTo(-19, -24 + wag); c.strokeStyle = C.fur3; c.lineWidth = 6.5; c.stroke(); }
  if (base.rim) { c.beginPath(); c.moveTo(-8, -9); c.quadraticCurveTo(-21, -10 + wag * 0.3, -19, -24 + wag); c.strokeStyle = C.fur2; c.lineWidth = 2.5; c.stroke(); }
  // feet
  ell(c, -5 + sw, -2.5, 4.8, 3.4, C.fur, ink, lw);
  ell(c, 5 - sw, -2.5, 4.8, 3.4, C.fur, ink, lw);
  // body
  ell(c, 0, -11 + bob * 0.4, 10.5, 9, C.coat, ink, lw);
  if (!base.kit) {
    // jacket lapel + chest fur
    c.save(); c.beginPath(); c.ellipse(0, -11 + bob * 0.4, 9.5, 8, 0, 0, TAU); c.clip();
    ell(c, 5, -13 + bob * 0.4, 5, 8, C.fur);
    c.fillStyle = C.coat2; c.fillRect(-12, -6 + bob * 0.4, 24, 5);
    c.restore();
  }
  // arm
  ell(c, 7.5, -11 + bob * 0.5, 3.6, 3.2, C.fur, ink, lw);
  // head group
  const hy = -25 + bob;
  c.save(); c.translate(1.5, hy);
  if (p.sleepy && !p.down) c.rotate(0.12 + Math.sin(t * 2) * 0.05);
  // ears
  poly(c, [-13, -6, -11.5, -17, -3.5, -10], C.fur, ink, lw);
  poly(c, [13, -6, 11.5, -17, 3.5, -10], name === 'mimosa' ? C.fur3 : C.fur, ink, lw);
  poly(c, [-10.5, -8, -10.5, -13.5, -6, -10], C.ear);
  poly(c, [10.5, -8, 10.5, -13.5, 6, -10], C.ear);
  // head fluff
  fluff(c, 0, 0, 14.5, 12, 11, 0.16, C.fur, ink, lw, 0.3);
  if (base.rim && !p.flash) { fluffPath(c, 0, 0, 14.5, 12, 11, 0.16, 0.3); c.strokeStyle = base.rim; c.lineWidth = 0.9; c.stroke(); }
  if (name === 'mimosa' && !p.flash) {
    c.save(); fluffPath(c, 0, 0, 13.6, 11.2, 11, 0.16, 0.3); c.clip();
    ell(c, -9, -6, 9.5, 8.5, C.fur2); ell(c, 10, -8, 8, 7.5, C.fur3); ell(c, 11, 7, 5, 4, C.fur2);
    c.restore();
  }
  if (name === 'mimo' && !p.flash) {
    c.save(); fluffPath(c, 0, 0, 13.6, 11.2, 11, 0.16, 0.3); c.clip();
    ell(c, 0, 9, 13, 5, C.fur2); c.restore();
  }
  // face (flat persian: eyes wide apart, tiny nose between them)
  const ex1 = -4.5, ex2 = 7, ey = 0.5;
  if (p.down) {
    c.strokeStyle = ink; c.lineWidth = 1.8;
    for (const ex of [ex1, ex2]) { c.beginPath(); c.moveTo(ex - 2.5, ey - 2.5); c.lineTo(ex + 2.5, ey + 2.5); c.moveTo(ex + 2.5, ey - 2.5); c.lineTo(ex - 2.5, ey + 2.5); c.stroke(); }
  } else if (p.sleepy || p.blink) {
    c.strokeStyle = name === 'morticia' ? C.eye : ink; c.lineWidth = 1.8;
    for (const ex of [ex1, ex2]) { c.beginPath(); c.arc(ex, ey - 0.5, 2.8, 0.15, Math.PI - 0.15); c.stroke(); }
  } else {
    for (const ex of [ex1, ex2]) {
      const big = name === 'morticia' ? 4 : 3.5;
      ell(c, ex, ey, big, big * (name === 'mimosa' ? 0.85 : 1), '#fff', ink, 1.3);
      ell(c, ex + 0.7, ey + 0.2, big * 0.72, big * 0.72, C.eye);
      ell(c, ex + 1, ey + 0.2, big * 0.3, big * 0.42, '#0b0610');
      ell(c, ex + 0.1, ey - 1.1, 0.9, 0.9, '#fff');
    }
    if (name === 'mimo') { // heavy sleepy eyelids
      c.fillStyle = C.fur2;
      for (const ex of [ex1, ex2]) { c.beginPath(); c.ellipse(ex, ey, 3.9, 3.9, 0, Math.PI, TAU); c.fill(); c.beginPath(); c.moveTo(ex - 4, ey); c.lineTo(ex + 4, ey); c.strokeStyle = ink; c.lineWidth = 1.5; c.stroke(); }
    }
    if (name === 'mimosa') { // angry brows
      c.strokeStyle = ink; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(ex1 - 4, ey - 5.5); c.lineTo(ex1 + 3, ey - 3); c.moveTo(ex2 + 4, ey - 5.5); c.lineTo(ex2 - 3, ey - 3); c.stroke();
    }
  }
  // nose + mouth
  poly(c, [0.2, 2.6, 2.6, 2.6, 1.4, 4.2], '#f07a9a', ink, 0.8);
  if (p.mouth) { // open mouth (bite / eat)
    ell(c, 1.4, 7.2, 4.2 * p.mouth, 3.6 * p.mouth, '#7a1436', ink, 1.3);
    if (name === 'mimosa') poly(c, [-1.2, 5, 0.2, 5, -0.5, 7.4], '#fff'), poly(c, [2.6, 5, 4, 5, 3.3, 7.4], '#fff');
    else ell(c, 1.4, 8.6, 2.2 * p.mouth, 1.4 * p.mouth, '#ff8fb0');
  } else {
    c.strokeStyle = ink; c.lineWidth = 1.2; c.beginPath();
    c.moveTo(-1.6, 6.2); c.quadraticCurveTo(0, 7.6, 1.4, 5.4); c.quadraticCurveTo(2.8, 7.6, 4.4, 6.2); c.stroke();
    if (name === 'morticia') ell(c, 1.5, 7.9, 1.7, 2.1, '#ff7fa8', ink, 0.8);
  }
  // mimosa's bow
  if (name === 'mimosa') {
    poly(c, [0, -12, -9, -18, -8, -8], C.bow, ink, lw); poly(c, [0, -12, 9, -18, 8, -8], C.bow, ink, lw);
    ell(c, 0, -12, 2.8, 2.8, '#ff8fd0', ink, 1.4);
  }
  c.restore();
  // weapon (mimo's blaster) — rotates with aim
  if (name === 'mimo' && !p.down) {
    c.save(); c.translate(8, -12 + bob * 0.5);
    let a = p.aim || 0; if (p.face < 0) a = Math.PI - a;
    c.rotate(a); c.translate(-(p.recoil || 0) * 5, 0);
    box(c, 0, -3.2, 15, 6.4, 2.5, p.flash ? '#fff' : '#2de2e6', ink, 1.6);
    box(c, 11, -2, 7, 4, 1.5, p.flash ? '#fff' : '#ff4fb8', ink, 1.4);
    box(c, 1, 1, 4.5, 6.5, 1.5, p.flash ? '#fff' : '#178a9c', ink, 1.4);
    ell(c, 5, -4.2, 3, 2.6, p.flash ? '#fff' : '#bff4ff', ink, 1.2);
    c.restore();
  }
  c.restore();
};

// ================= DOGS =================
const DOGS = Art.DOGS = {
  mutt: { fur: '#9a7b62', fur2: '#e8d6bf', coat: '#5b4a66', ear: 'flop', s: 1.0, acc: 'bandana', accCol: '#e63946', wpn: 'none' },
  chi: { fur: '#e2b178', fur2: '#fbe7c9', coat: '#e2b178', ear: 'big', s: 0.66, acc: 'collar', accCol: '#2de2e6', wpn: 'none' },
  cop: { fur: '#c98b4f', fur2: '#f6e3c5', coat: '#24356e', ear: 'flop', s: 1.08, acc: 'cop', accCol: '#24356e', wpn: 'baton', jowl: 1 },
  shooter: { fur: '#2c2530', fur2: '#b9783f', coat: '#70313f', ear: 'point', s: 1.05, acc: 'shades', accCol: '#111', wpn: 'launcher' },
  catcher: { fur: '#f3ead9', fur2: '#fff', coat: '#8a7a45', ear: 'long', earCol: '#7a4a24', s: 1.05, acc: 'cap', accCol: '#8a7a45', wpn: 'net' },
  heavy: { fur: '#6e4a33', fur2: '#c9a27e', coat: '#3a2a22', ear: 'flop', s: 1.42, acc: 'spikes', accCol: '#c0c7d1', wpn: 'none', jowl: 1 },
  // bosses
  chief: { fur: '#c98b4f', fur2: '#f6e3c5', coat: '#16224f', ear: 'flop', s: 2.0, acc: 'chief', accCol: '#16224f', wpn: 'baton', jowl: 1 },
  poodle: { fur: '#ff9fd6', fur2: '#ffd9ef', coat: '#b03a8c', ear: 'pom', s: 1.9, acc: 'pom', accCol: '#ff9fd6', wpn: 'perfume' },
  rott: { fur: '#2a2228', fur2: '#b9783f', coat: '#1c3d5a', ear: 'flop', s: 2.15, acc: 'sailor', accCol: '#fff', wpn: 'anchor', jowl: 1 },
  dogcatcher: { fur: '#a9a7b4', fur2: '#ecebf2', coat: '#ffffff', ear: 'long', earCol: '#77758a', s: 2.1, acc: 'shades', accCol: '#111', wpn: 'net' },
  pug: { fur: '#e3c08a', fur2: '#3a2a22', coat: '#b8860b', ear: 'pug', s: 1.5, acc: 'crown', accCol: '#ffd23f', wpn: 'none', vac: 1 },
};
const DWHITE = { fur: '#fff', fur2: '#fff', coat: '#fff', accCol: '#fff', earCol: '#fff' };

// p: {type, t, walk, face, flash, aim, wind (0..1 attack windup), stun, armor (0..1), disarmed}
Art.dog = function (c, x, y, p) {
  const base = DOGS[p.type], D = p.flash ? Object.assign({}, base, DWHITE) : base;
  const s = base.s * (p.scale || 1), t = p.t || 0, w = p.walk || 0, ink = p.flash ? '#fff' : INK, lw = 1.9;
  c.save(); c.translate(x, y);
  ell(c, 0, 1, 15 * s, 6 * s, 'rgba(0,0,0,.32)');
  c.scale(p.face * s, s);
  const bob = Math.sin(t * (w ? 14 : 3)) * (w ? 1.5 : 0.6);
  const sw = w ? Math.sin(t * 14) * 3.2 : 0;
  const wind = p.wind || 0;
  if (base.vac) { // Don Pug's vacuum robot
    c.save(); c.translate(0, -4);
    ell(c, 0, 0, 22, 11, p.flash ? '#fff' : '#3a3f55', ink, 2);
    ell(c, 0, -3, 22, 10, p.flash ? '#fff' : '#596080', ink, 2);
    ell(c, 0, -4, 14, 5.5, p.flash ? '#fff' : '#2d3147');
    for (let i = 0; i < 5; i++) ell(c, -16 + i * 8, 3.5, 2, 1.6, (Math.floor(t * 6) + i) % 2 ? '#ff4fb8' : '#2de2e6');
    // hose / nozzle
    c.strokeStyle = ink; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, -2); c.quadraticCurveTo(28, -8, 30, 4 + wind * 3); c.stroke();
    c.strokeStyle = p.flash ? '#fff' : '#8a90ad'; c.lineWidth = 5; c.stroke();
    box(c, 23, 3 + wind * 3, 14, 6, 2, p.flash ? '#fff' : '#ff4fb8', ink, 1.6);
    c.restore();
    c.translate(0, -12);
  }
  c.translate(wind * -3, 0);
  // tail
  c.lineCap = 'round'; c.beginPath(); c.moveTo(-10, -10); c.quadraticCurveTo(-17, -14, -15, -20 + Math.sin(t * 9) * 2);
  c.strokeStyle = ink; c.lineWidth = 6; c.stroke(); c.strokeStyle = D.fur; c.lineWidth = 3.4; c.stroke();
  // feet
  if (!base.vac) { ell(c, -6 + sw, -2.5, 5, 3.5, D.fur, ink, lw); ell(c, 6 - sw, -2.5, 5, 3.5, D.fur, ink, lw); }
  // body
  ell(c, 0, -11.5 + bob * 0.4, 11.5, 9.5, D.coat, ink, lw);
  if (base.acc === 'cop' || base.acc === 'chief') { ell(c, 5, -13 + bob * 0.4, 1.7, 1.7, '#ffd23f', ink, 0.8); c.fillStyle = p.flash ? '#fff' : '#111'; c.fillRect(-10, -7.5 + bob * 0.4, 20, 2.2); }
  if (base.acc === 'chief' && !p.flash) { box(c, -11, -18 + bob * 0.4, 6, 3, 1, '#ffd23f', ink, 1); }
  if (p.armor > 0 && !p.flash) { // armor plate
    c.save(); c.globalAlpha = 0.55 + 0.45 * p.armor;
    box(c, -10, -18 + bob * 0.4, 20, 9, 3, '#c0c7d1', ink, 1.6); c.fillStyle = '#eef2f7'; c.fillRect(-7, -16.5 + bob * 0.4, 6, 2); c.restore();
  }
  // head
  const hy = -25 + bob;
  c.save(); c.translate(2.5, hy);
  if (p.stun) c.rotate(Math.sin(t * 8) * 0.15);
  const earC = D.earCol || D.fur;
  if (base.ear === 'flop') { ell(c, -11, -3, 4.5, 7.5, earC, ink, lw, 0.35); }
  else if (base.ear === 'long') { ell(c, -10.5, 2, 4.5, 10, earC, ink, lw, 0.2); }
  else if (base.ear === 'point') { poly(c, [-11, -5, -9, -21, -3, -9], earC, ink, lw); poly(c, [9, -6, 8, -21, 2, -10], earC, ink, lw); }
  else if (base.ear === 'big') { poly(c, [-13, -2, -15, -22, -2, -9], earC, ink, lw); poly(c, [11, -4, 15, -22, 2, -10], earC, ink, lw); poly(c, [-11, -5, -12.5, -17, -5, -9], '#f4a9b8'); }
  else if (base.ear === 'pom') { fluff(c, -12, 2, 6.5, 8, 7, 0.3, earC, ink, lw); }
  else if (base.ear === 'pug') { poly(c, [-12, -4, -11, -13, -4, -9], D.fur2, ink, lw); poly(c, [10, -5, 10, -13, 3, -9], D.fur2, ink, lw); }
  ell(c, 0, 0, 13, 11.5, D.fur, ink, lw);
  if (base.ear === 'flop' || base.ear === 'long') ell(c, 9.5, -6, 4, 5.5, earC, ink, lw, -0.5);
  if (p.type === 'shooter' || p.type === 'rott') { ell(c, -3, -5.5, 2, 1.6, D.fur2); ell(c, 6, -5.5, 2, 1.6, D.fur2); }
  // muzzle
  ell(c, 6, 4.5, 8, 6.2, D.fur2, ink, 1.6);
  if (base.jowl) { ell(c, 2, 8, 4, 3.6, D.fur2, ink, 1.4); ell(c, 10, 8, 4, 3.6, D.fur2, ink, 1.4); poly(c, [3.5, 5.5, 5, 5.5, 4.2, 3], '#fff', ink, 0.7); poly(c, [8, 5.5, 9.5, 5.5, 8.8, 3], '#fff', ink, 0.7); }
  ell(c, 8.5, 1.2, 3, 2.3, p.flash ? '#fff' : '#17101c');
  if (base.stache && !p.flash) { ell(c, 3, 5, 5, 2.4, '#e9e9ee', ink, 1.2, 0.3); ell(c, 12, 5, 5, 2.4, '#e9e9ee', ink, 1.2, -0.3); }
  if (base.ear === 'pug' && !p.flash) { c.strokeStyle = '#b8935e'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-5, -8); c.quadraticCurveTo(1, -10, 7, -8); c.stroke(); }
  // eyes
  if (p.stun) {
    c.strokeStyle = ink; c.lineWidth = 1.6;
    for (const ex of [-3.5, 5.5]) { c.beginPath(); c.arc(ex, -3, 2.4, t * 10, t * 10 + 4.5); c.stroke(); }
  } else if (base.acc === 'shades' && !p.flash) {
    box(c, -7, -6, 8, 5, 2, '#111', ink, 1); box(c, 2.5, -6, 8, 5, 2, '#111', ink, 1); c.fillStyle = '#ff4fb8'; c.fillRect(-5.5, -5, 3, 1.2); c.fillRect(4, -5, 3, 1.2);
  } else {
    for (const ex of [-3.5, 5.5]) { ell(c, ex, -3, 2.9, 2.9, '#fff', ink, 1.2); ell(c, ex + 0.8, -2.8, 1.5, 1.7, wind > 0.3 ? '#e01e37' : '#17101c'); }
    c.strokeStyle = ink; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-7.5, -7.5); c.lineTo(-1, -5.2); c.moveTo(9.5, -7.5); c.lineTo(3.5, -5.2); c.stroke();
  }
  // hats
  const a = base.acc, ac = D.accCol;
  if (a === 'cop' || a === 'chief') {
    box(c, -10.5, -15.5, 21, 6.5, 2.5, ac, ink, lw); box(c, -2, -11, 15, 3, 1.5, p.flash ? '#fff' : '#111', ink, 1.2);
    poly(c, [0, -15, 1.3, -12.3, 4, -12.3, 1.8, -10.6, 2.6, -8, 0, -9.6, -2.6, -8, -1.8, -10.6, -4, -12.3, -1.3, -12.3], '#ffd23f');
    if (a === 'chief') box(c, -10.5, -17.5, 21, 3, 1.5, '#ffd23f', ink, 1.2);
  } else if (a === 'cap') { box(c, -10, -14.5, 19, 6, 3, ac, ink, lw); box(c, 0, -10.5, 15, 3, 1.5, ac, ink, 1.2); }
  else if (a === 'sailor') { box(c, -9, -17, 18, 7, 2, '#fff', ink, lw); box(c, -11, -11.5, 22, 3.2, 1.5, '#16224f', ink, 1.2); ell(c, 0, -14, 2, 2, '#ffd23f'); }
  else if (a === 'pom') { fluff(c, 0, -13, 9, 7.5, 8, 0.3, ac, ink, lw); }
  else if (a === 'crown') { poly(c, [-8, -9.5, -9, -18, -4, -13.5, 0, -19.5, 4, -13.5, 9, -18, 8, -9.5], ac, ink, 1.6); ell(c, 0, -12.5, 1.5, 1.5, '#ff4fb8'); }
  c.restore();
  if (a === 'bandana') poly(c, [-4, -17 + bob, 9, -17 + bob, 2, -10 + bob], ac, ink, 1.4);
  if (a === 'collar') { c.fillStyle = ac; c.fillRect(-5, -17 + bob, 12, 2.4); }
  if (a === 'spikes') { box(c, -7, -18 + bob, 17, 3.6, 1.5, p.flash ? '#fff' : '#17101c', ink, 1); for (let i = 0; i < 4; i++) poly(c, [-5 + i * 4.2, -14.6 + bob, -3.5 + i * 4.2, -11 + bob, -2 + i * 4.2, -14.6 + bob], ac, ink, 0.7); }
  if (a === 'pom') for (let i = 0; i < 4; i++) ell(c, -3 + i * 3.2, -16.5 + bob, 1.6, 1.6, '#fff', ink, 0.6);
  // weapon
  if (!p.disarmed && base.wpn !== 'none') {
    c.save(); c.translate(9, -11 + bob * 0.5);
    let ang = p.aim === undefined ? 0 : p.aim; if (p.face < 0) ang = Math.PI - ang;
    if (base.wpn === 'baton') { c.rotate(-1.1 + wind * 1.9); box(c, -1.6, -15, 3.4, 16, 1.6, p.flash ? '#fff' : '#17101c', ink, 1.2); }
    else if (base.wpn === 'launcher') { c.rotate(ang); box(c, -2, -3.5, 17, 7, 3, '#70d44b', ink, 1.5); ell(c, 15, 0, 3.6, 3.6, '#d7f25a', ink, 1.2); }
    else if (base.wpn === 'net') { c.rotate(-0.7 + wind * 1.4); c.strokeStyle = ink; c.lineWidth = 3.4; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -16); c.stroke(); c.strokeStyle = '#b98b55'; c.lineWidth = 1.8; c.stroke(); ell(c, 0, -21, 6, 6, 'rgba(255,255,255,.25)', ink, 1.5); c.strokeStyle = '#fff'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-5, -21); c.lineTo(5, -21); c.moveTo(0, -26); c.lineTo(0, -16); c.stroke(); }
    else if (base.wpn === 'perfume') { c.rotate(ang * 0.3); box(c, 0, -5, 7, 9, 2, '#bff4ff', ink, 1.3); box(c, 1.5, -8, 4, 3.4, 1, '#ffd23f', ink, 1); }
    else if (base.wpn === 'anchor') { c.rotate(-0.9 + wind * 2); c.strokeStyle = ink; c.lineWidth = 4.4; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -15); c.moveTo(-6, -8); c.quadraticCurveTo(0, -18, 6, -8); c.stroke(); c.strokeStyle = '#aab3c2'; c.lineWidth = 2.4; c.stroke(); }
    c.restore();
  }
  ell(c, 8.5, -11 + bob * 0.5, 3.6, 3.2, D.fur, ink, lw);
  c.restore();
};

// ================= CARS (top-down, facing +x) =================
const CARS = Art.CARS = {
  pink: { len: 86, wid: 42, body: '#ff4fb8', body2: '#c2267f', conv: 1 },
  sedan: { len: 82, wid: 40, body: '#2de2e6', body2: '#168d91' },
  taxi: { len: 82, wid: 40, body: '#ffd23f', body2: '#c79a12', taxi: 1 },
  sport: { len: 84, wid: 40, body: '#9b5de5', body2: '#5f2fa3' },
  cop: { len: 86, wid: 42, body: '#f4f4f8', body2: '#16224f', cop: 1 },
  van: { len: 96, wid: 46, body: '#8a7a45', body2: '#5c5230', van: 1 },
  truck: { len: 112, wid: 48, body: '#ffe9a8', body2: '#ff8a3d', truck: 1 },
  limo: { len: 124, wid: 42, body: '#ffd23f', body2: '#b8860b', limo: 1 },
};
const CAR_COLORS = [['#2de2e6', '#168d91'], ['#ffb347', '#c7741a'], ['#9b5de5', '#5f2fa3'], ['#00f5a0', '#0b9e6b'], ['#ff6b6b', '#b23535'], ['#4cc9f0', '#2a7fa3'], ['#f8f9fa', '#9aa0a6']];
Art.carColor = i => CAR_COLORS[i % CAR_COLORS.length];
// p: {type, a, t, col:[body,body2], hp (0..1), cats:[bool x3] (pink only), flash}
Art.car = function (c, x, y, p) {
  const K = CARS[p.type], L = K.len, Wd = K.wid, hl = L / 2, hw = Wd / 2;
  const body = p.flash ? '#fff' : (p.col ? p.col[0] : K.body), body2 = p.flash ? '#fff' : (p.col ? p.col[1] : K.body2);
  c.save(); c.translate(x, y);
  // shadow
  c.save(); c.translate(5, 7); c.rotate(p.a); box(c, -hl, -hw, L, Wd, 10, 'rgba(0,0,0,.3)'); c.restore();
  c.rotate(p.a);
  // wheels
  c.fillStyle = '#120a18';
  for (const wx of [-hl * 0.62, hl * 0.56]) { c.fillRect(wx - 8, -hw - 2.5, 16, 6); c.fillRect(wx - 8, hw - 3.5, 16, 6); }
  if (p.glow) { c.save(); c.shadowColor = p.glow; c.shadowBlur = 18; box(c, -hl, -hw, L, Wd, 10, p.glow); c.restore(); }
  box(c, -hl, -hw, L, Wd, K.truck || K.van ? 6 : 11, body, INK, 2.4);
  if (K.truck) {
    box(c, -hl + 3, -hw + 3, L * 0.66, Wd - 6, 4, '#fff7dc', INK, 1.6);
    // fish logo
    c.save(); c.translate(-hl + L * 0.36, 0); c.rotate(-Math.PI / 2); Art.icon(c, 'treat', 0, 0, 13); c.restore();
    box(c, hl - 34, -hw + 4, 14, Wd - 8, 3, '#9fe8ff', INK, 1.5); box(c, hl - 18, -hw + 3, 14, Wd - 6, 4, body2, INK, 1.4);
  } else if (K.van) {
    box(c, -hl + 3, -hw + 3, L * 0.62, Wd - 6, 4, body2, INK, 1.6);
    c.strokeStyle = '#1a0d24'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-hl + 8 + i * 9, -hw + 5); c.lineTo(-hl + 8 + i * 9, hw - 5); c.stroke(); }
    box(c, hl - 34, -hw + 4, 13, Wd - 8, 3, '#9fe8ff', INK, 1.5);
  } else {
    // hood stripes
    c.fillStyle = body2; c.fillRect(hl - 24, -3, 20, 6); c.fillRect(-hl + 4, -3, 14, 6);
    if (K.conv) {
      box(c, -hl + 20, -hw + 5, L * 0.44, Wd - 10, 6, '#3a0f2e', INK, 1.6);
      box(c, hl - 34, -hw + 5, 9, Wd - 10, 3, '#bff4ff', INK, 1.4);
      const cs = p.cats || [1, 1, 1];
      const heads = [['#f7ead0', 6, -8], ['#fffaf2', 6, 8], ['#33283d', -10, 0]];
      heads.forEach((h, i) => { if (!cs[i]) return; ell(c, h[1], h[2], 7.5, 7.5, h[0], INK, 1.5); if (i === 1) { ell(c, h[1] - 3, h[2] - 3, 3.5, 3.5, '#f28a2e'); ell(c, h[1] - 6, h[2], 3, 3, '#ff3fa4', INK, 1); } if (i === 2) { ell(c, h[1] + 4, h[2] - 3, 1.4, 1.4, '#ffc928'); ell(c, h[1] + 4, h[2] + 3, 1.4, 1.4, '#ffc928'); } });
    } else {
      const cl = K.limo ? L * 0.62 : L * 0.46;
      box(c, -cl / 2 - 4, -hw + 4.5, cl, Wd - 9, 7, '#231433', INK, 1.6);
      box(c, -cl / 2 - 1, -hw + 7, cl - 6, Wd - 14, 5, body2);
      c.fillStyle = '#9fe8ff'; c.fillRect(cl / 2 - 9, -hw + 7, 4, Wd - 14); c.fillRect(-cl / 2 - 3, -hw + 7, 3, Wd - 14);
    }
    if (K.cop) {
      c.fillStyle = body2; c.fillRect(-hl + 8, -hw + 1.5, 16, Wd - 3); c.fillRect(hl - 26, -hw + 1.5, 8, Wd - 3);
      const b = Math.floor((p.t || 0) * 8) % 2;
      box(c, -6, -hw + 6, 7, (Wd - 12) / 2, 2, b ? '#ff2040' : '#7a1020', INK, 1.2); box(c, -6, 0, 7, (Wd - 12) / 2, 2, b ? '#103a9a' : '#2a6bff', INK, 1.2);
    }
    if (K.taxi) { box(c, -5, -5, 10, 10, 2, '#17101c', INK, 1); c.fillStyle = '#ffd23f'; c.fillRect(-3, -3, 6, 6); }
  }
  // lights
  c.fillStyle = '#fff6b0'; c.fillRect(hl - 4, -hw + 4, 4, 8); c.fillRect(hl - 4, hw - 12, 4, 8);
  c.fillStyle = '#ff3355'; c.fillRect(-hl, -hw + 4, 3.5, 8); c.fillRect(-hl, hw - 12, 3.5, 8);
  c.restore();
};

// ================= ICONS (items, HUD) =================
Art.icon = function (c, k, x, y, s, t) {
  c.save(); c.translate(x, y); c.scale(s / 12, s / 12); c.lineJoin = 'round';
  switch (k) {
    case 'treat': // fish
      poly(c, [7, 0, 13, -6, 13, 6], '#ff9a3d', INK, 1.8); ell(c, -1, 0, 9.5, 6, '#ffb347', INK, 1.8);
      ell(c, -5.5, -1.2, 1.3, 1.3, INK); c.strokeStyle = '#e07a1a'; c.lineWidth = 1.2; c.beginPath(); c.arc(-1, 0, 5, -0.8, 0.8); c.stroke(); break;
    case 'bone':
      c.strokeStyle = INK; c.lineWidth = 7.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, 4); c.lineTo(6, -4); c.stroke();
      for (const [bx, by] of [[-8, 2], [-5, 7], [8, -2], [5, -7]]) ell(c, bx, by, 3.6, 3.6, '#fff8e8', INK, 1.6);
      c.strokeStyle = '#fff8e8'; c.lineWidth = 4.4; c.beginPath(); c.moveTo(-6, 4); c.lineTo(6, -4); c.stroke(); break;
    case 'donut':
      ell(c, 0, 0, 10, 10, '#e9b872', INK, 1.8); ell(c, 0, -0.5, 9, 8.5, '#ff7ac0'); ell(c, 0, 0, 3.2, 3.2, '#3a2140', INK, 1.4);
      c.fillStyle = '#fff'; c.fillRect(-6, -4, 3, 1.4); c.fillRect(3, -6, 3, 1.4); c.fillStyle = '#2de2e6'; c.fillRect(4, 3, 3, 1.4); c.fillRect(-5, 4, 3, 1.4); break;
    case 'steak':
      fluff(c, 0, 0, 10, 7.5, 5, 0.18, '#e2574c', INK, 1.8); ell(c, -2, 0, 4.5, 3.2, '#ff9d94'); ell(c, 5, 1, 2, 2, '#fff8e8', INK, 1.2); break;
    case 'sushi':
      box(c, -9, -5, 18, 12, 5, '#fff', INK, 1.8); box(c, -9, -8, 18, 8, 4, '#ff8a5c', INK, 1.8); c.fillStyle = '#1e2b22'; c.fillRect(-2.5, -8.5, 5, 16); break;
    case 'hotdog':
      box(c, -11, -4, 22, 9, 4.5, '#e9b872', INK, 1.8); box(c, -12, -6, 24, 6, 3, '#d1483b', INK, 1.6); c.strokeStyle = '#ffd23f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-8, -3); c.quadraticCurveTo(-4, -6, 0, -3); c.quadraticCurveTo(4, 0, 8, -3); c.stroke(); break;
    case 'coffee':
      box(c, -7, -6, 14, 14, 3, '#fff', INK, 1.8); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.arc(8, 1, 4, -1.3, 1.3); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke();
      c.fillStyle = '#6b3f22'; c.fillRect(-5, -4.5, 10, 3); c.fillStyle = '#ff4fb8'; c.fillRect(-7, 0, 14, 3);
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.4; const o = Math.sin((t || 0) * 4) * 1.5;
      c.beginPath(); c.moveTo(-3, -9); c.quadraticCurveTo(-5 + o, -12, -3, -15); c.moveTo(3, -9); c.quadraticCurveTo(5 - o, -12, 3, -15); c.stroke(); break;
    case 'paw': {
      const g = '#ffd23f'; ell(c, 0, 3.5, 6.5, 5.5, g, INK, 1.8);
      for (const [px, py] of [[-7.5, -3], [-2.8, -7.5], [2.8, -7.5], [7.5, -3]]) ell(c, px, py, 2.9, 3.5, g, INK, 1.6);
      ell(c, -1.5, 2, 2, 1.4, '#fff3a8'); break;
    }
    case 'cash':
      ell(c, 0, 0, 9, 9, '#7CFF6B', INK, 1.8); ell(c, 0, 0, 6, 6, '#3fcf55');
      c.fillStyle = '#0d3b16'; c.font = '900 11px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 0.8); break;
    case 'catnip':
      poly(c, [0, 10, -9, -2, -3, -1, -6, -10, 0, -4, 6, -10, 3, -1, 9, -2], '#7CFF6B', INK, 1.8);
      c.strokeStyle = '#2e9e3f'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 9); c.lineTo(0, -4); c.stroke(); break;
    case 'milk':
      box(c, -6, -5, 12, 15, 2, '#fff', INK, 1.8); poly(c, [-6, -5, 0, -11, 6, -5], '#bfe9ff', INK, 1.8); c.fillStyle = '#4cc9f0'; c.fillRect(-6, 1, 12, 4); break;
    case 'key':
      ell(c, -5, 0, 5, 5, '#ffd23f', INK, 1.8); ell(c, -5, 0, 1.8, 1.8, '#3a2140'); box(c, -1, -1.6, 13, 3.2, 1, '#ffd23f', INK, 1.5); c.fillStyle = '#ffd23f'; c.strokeStyle = INK; c.lineWidth = 1.3; c.fillRect(7, 1, 2.2, 4); c.strokeRect(7, 1, 2.2, 4); c.fillRect(10.5, 1, 2.2, 3); c.strokeRect(10.5, 1, 2.2, 3); break;
    case 'ammo':
      ell(c, 0, 0, 8, 8, '#d7f25a', INK, 1.8); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(-7, 0, 7, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(7, 0, 7, Math.PI - 0.9, Math.PI + 0.9); c.stroke(); break;
    case 'net':
      ell(c, 0, 0, 9, 9, 'rgba(255,255,255,.3)', INK, 1.8); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath();
      for (let i = -6; i <= 6; i += 4) { c.moveTo(i, -8); c.lineTo(i, 8); c.moveTo(-8, i); c.lineTo(8, i); } c.stroke(); break;
    case 'heart':
      c.beginPath(); c.moveTo(0, 9); c.bezierCurveTo(-14, -1, -8, -11, 0, -4); c.bezierCurveTo(8, -11, 14, -1, 0, 9); c.fillStyle = '#ff4f7a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke(); break;
    case 'star': case 'starOff': {
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.6 : 10.5; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
      poly(c, pts, k === 'star' ? '#ffd23f' : 'rgba(255,255,255,.14)', k === 'star' ? INK : 'rgba(255,255,255,.3)', 1.6); break;
    }
    case 'bolt':
      poly(c, [2, -11, -7, 2, -1, 2, -3, 11, 7, -3, 1, -3], '#2de2e6', INK, 1.8); break;
    case 'fang':
      poly(c, [-9, -7, 9, -7, 6, 1, 3, -3, 0, 8, -3, -3, -6, 1], '#fff', INK, 1.8); break;
    case 'zzz':
      c.fillStyle = '#bfe9ff'; c.strokeStyle = INK; c.lineWidth = 3; c.font = '900 italic 15px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText('Zz', 0, 0); c.fillText('Zz', 0, 0); break;
    case 'car':
      box(c, -10, -4, 20, 9, 3, '#ff4fb8', INK, 1.8); box(c, -5, -8, 10, 6, 2, '#bff4ff', INK, 1.5); ell(c, -5, 5, 2.6, 2.6, INK); ell(c, 5, 5, 2.6, 2.6, INK); break;
    case 'hand':
      ell(c, 0, 2, 6, 6, '#fff', INK, 1.8); for (const px of [-5, -1.6, 1.6, 5]) ell(c, px, -5, 2, 3, '#fff', INK, 1.4); break;
    case 'roar':
      c.strokeStyle = '#fff'; c.lineWidth = 2.4; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-8, 0, 6 + i * 5, -0.7, 0.7); c.stroke(); } break;
    case 'dash':
      poly(c, [-9, -6, 1, -6, 9, 0, 1, 6, -9, 6, -3, 0], '#fff', INK, 1.8); break;
    case 'smoke':
      ell(c, -4, 2, 5, 5, '#d9c8f0', INK, 1.6); ell(c, 4, 1, 6, 6, '#d9c8f0', INK, 1.6); ell(c, 0, -4, 5, 5, '#d9c8f0', INK, 1.6); break;
    case 'ball':
      ell(c, 0, 0, 8, 8, '#8a6a52', INK, 1.8); ell(c, -2, -2, 3, 2, '#b08a6e'); break;
  }
  c.restore();
};

// ================= PROPS =================
Art.palm = function (c, x, y, s, t, colT, colL) {
  // trunk (leaning) + shadow
  ell(c, x + 8 * s, y + 3, 20 * s, 7 * s, 'rgba(0,0,0,.22)');
  const sway = Math.sin(t * 1.3 + x * 0.01) * 3 * s, tx = x + 5 * s + sway, ty = y - 52 * s;
  c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 6 * s, y - 28 * s, tx, ty);
  c.strokeStyle = INK; c.lineWidth = 9 * s; c.stroke(); c.strokeStyle = colT; c.lineWidth = 6 * s; c.stroke();
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + 0.3 + sway * 0.02, lx = tx + Math.cos(a) * 30 * s, ly = ty + Math.sin(a) * 20 * s + 6 * s;
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * 20 * s, ty + Math.sin(a) * 14 * s - 10 * s, lx, ly);
    c.strokeStyle = INK; c.lineWidth = 9 * s; c.stroke(); c.strokeStyle = i % 2 ? colL[0] : colL[1]; c.lineWidth = 6 * s; c.stroke();
  }
  ell(c, tx, ty, 5 * s, 5 * s, '#8a5a2b', INK, 1.5);
};
Art.lamp = function (c, x, y, col) {
  c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 46); c.lineTo(x + 10, y - 50); c.stroke();
  c.strokeStyle = '#59536b'; c.lineWidth = 2.5; c.stroke();
  ell(c, x + 12, y - 49, 5, 3.5, col, INK, 1.4);
};
// food stand: kind 'hotdog'|'sushi'|'donut'
Art.stand = function (c, x, y, kind, left, t) {
  const cols = { hotdog: ['#ff4f5e', '#fff'], sushi: ['#2de2e6', '#fff'], donut: ['#ff7ac0', '#fff3a8'] }[kind];
  ell(c, x, y + 14, 30, 8, 'rgba(0,0,0,.3)');
  box(c, x - 24, y - 12, 48, 26, 5, '#f4e3c1', INK, 2.2); box(c, x - 24, y - 2, 48, 6, 2, '#d9b47c', INK, 1.4);
  ell(c, x - 15, y + 15, 5, 5, '#3a2140', INK, 1.6); ell(c, x + 15, y + 15, 5, 5, '#3a2140', INK, 1.6);
  // awning
  c.save(); rr(c, x - 28, y - 40, 56, 16, 5); c.clip();
  for (let i = 0; i < 7; i++) { c.fillStyle = cols[i % 2]; c.fillRect(x - 28 + i * 8, y - 40, 8, 16); } c.restore();
  rr(c, x - 28, y - 40, 56, 16, 5); c.strokeStyle = INK; c.lineWidth = 2.2; c.stroke();
  c.fillStyle = INK; c.fillRect(x - 25, y - 25, 2.5, 14); c.fillRect(x + 22.5, y - 25, 2.5, 14);
  for (let i = 0; i < left; i++) Art.icon(c, kind, x - 13 + i * 13, y - 15 + Math.sin(t * 3 + i) * 1, 9);
};
Art.crate = function (c, x, y, hpf, flash) {
  box(c, x - 20, y - 22, 40, 40, 4, flash ? '#fff' : '#c98f4b', INK, 2.2);
  if (!flash) { c.strokeStyle = '#8a5a2b'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 17, y - 19); c.lineTo(x + 17, y + 15); c.moveTo(x + 17, y - 19); c.lineTo(x - 17, y + 15); c.stroke(); box(c, x - 20, y - 22, 40, 40, 4, null, INK, 2.2); }
  if (hpf < 1 && !flash) { c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 4, y - 22); c.lineTo(x + 2, y - 8); c.lineTo(x - 5, y + 2); c.stroke(); }
};
Art.trash = function (c, x, y, open) {
  ell(c, x, y + 12, 16, 5, 'rgba(0,0,0,.3)');
  box(c, x - 12, y - 14, 24, 28, 4, '#6f7d8c', INK, 2); c.strokeStyle = '#4c5866'; c.lineWidth = 2; for (let i = -6; i <= 6; i += 6) { c.beginPath(); c.moveTo(x + i, y - 9); c.lineTo(x + i, y + 10); c.stroke(); }
  if (!open) box(c, x - 14, y - 19, 28, 7, 3, '#8b99a8', INK, 2); else Art.icon(c, 'treat', x, y - 17, 7);
};
// wooden gate (w px wide, horizontal or vertical)
Art.fgate = function (c, x, y, w, h, hpf, flash) {
  const hor = w > h, n = Math.round((hor ? w : h) / 12);
  for (let i = 0; i < n; i++) {
    const px = hor ? x - w / 2 + i * 12 + 1 : x - 6, py = hor ? y - 22 : y - h / 2 + i * 12 - 14;
    box(c, px, py, 10, hor ? 34 : 26, 2, flash ? '#fff' : (i % 2 ? '#c98f4b' : '#b57d3c'), INK, 1.6);
  }
  c.fillStyle = flash ? '#fff' : '#8a5a2b';
  if (hor) { c.fillRect(x - w / 2, y - 12, w, 4); c.fillRect(x - w / 2, y + 2, w, 4); } else c.fillRect(x - 2, y - h / 2 - 8, 4, h);
  if (hpf < 0.7 && !flash) { c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 6, y - 20); c.lineTo(x + 3, y - 4); c.lineTo(x - 4, y + 8); c.stroke(); }
};
Art.laser = function (c, x, y, w, h, t, col) {
  const hor = w > h;
  c.save();
  c.fillStyle = '#3a3f55'; c.strokeStyle = INK; c.lineWidth = 1.8;
  if (hor) { box(c, x - w / 2 - 3, y - 26, 7, 34, 2, '#596080', INK, 1.8); box(c, x + w / 2 - 4, y - 26, 7, 34, 2, '#596080', INK, 1.8); }
  else { box(c, x - 5, y - h / 2 - 10, 10, 10, 2, '#596080', INK, 1.8); box(c, x - 5, y + h / 2 - 4, 10, 10, 2, '#596080', INK, 1.8); }
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = col; c.globalAlpha = 0.55 + 0.4 * Math.sin(t * 20 + i * 2); c.lineWidth = 3; c.shadowColor = col; c.shadowBlur = 8;
    c.beginPath(); if (hor) { c.moveTo(x - w / 2, y - 20 + i * 10); c.lineTo(x + w / 2, y - 20 + i * 10); } else { c.moveTo(x - 4 + i * 4, y - h / 2); c.lineTo(x - 4 + i * 4, y + h / 2); } c.stroke();
  }
  c.restore();
};
Art.sdoor = function (c, x, y, w, h, key) {
  const hor = w > h;
  if (hor) box(c, x - w / 2, y - 28, w, 38, 3, '#7c8799', INK, 2.2); else box(c, x - 8, y - h / 2 - 10, 16, h + 6, 3, '#7c8799', INK, 2.2);
  c.fillStyle = '#5d6777'; if (hor) { c.fillRect(x - w / 2 + 4, y - 22, w - 8, 3); c.fillRect(x - w / 2 + 4, y - 2, w - 8, 3); }
  ell(c, x, y - 10, 7, 7, key ? '#ffd23f' : '#ff4f5e', INK, 1.8);
  if (key) Art.icon(c, 'key', x + 1, y - 10, 5);
};
Art.switch = function (c, x, y, on, t) {
  ell(c, x, y + 2, 9, 4, 'rgba(0,0,0,.3)');
  c.strokeStyle = INK; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 22); c.stroke(); c.strokeStyle = '#8a90ad'; c.lineWidth = 3; c.stroke();
  const col = on ? '#7CFF6B' : '#ff4f5e', pulse = on ? 0 : Math.sin(t * 6) * 1.5;
  c.save(); c.shadowColor = col; c.shadowBlur = 14; ell(c, x, y - 30, 12 + pulse, 12 + pulse, '#fff', INK, 2); c.restore();
  ell(c, x, y - 30, 8.5, 8.5, col, INK, 1.4); ell(c, x, y - 30, 3.6, 3.6, '#fff', INK, 1.2);
};
Art.lever = function (c, x, y, on) {
  box(c, x - 12, y - 6, 24, 12, 3, '#596080', INK, 2);
  c.strokeStyle = INK; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (on ? 9 : -9), y - 18); c.stroke(); c.strokeStyle = '#c0c7d1'; c.lineWidth = 3; c.stroke();
  ell(c, x + (on ? 9 : -9), y - 19, 5, 5, on ? '#7CFF6B' : '#ff4f5e', INK, 1.8);
};
Art.cage = function (c, x, y, open, friend, t, lock) {
  ell(c, x, y + 14, 24, 7, 'rgba(0,0,0,.3)');
  box(c, x - 21, y + 8, 42, 8, 3, '#596080', INK, 2);
  if (!open && friend) Art.cat(c, x, y + 10, { name: friend, t, face: 1, walk: 0 });
  if (!open) {
    c.strokeStyle = INK; c.lineWidth = 4.5; c.lineCap = 'round';
    for (let i = -18; i <= 18; i += 9) { c.beginPath(); c.moveTo(x + i, y + 9); c.lineTo(x + i, y - 26); c.stroke(); }
    c.strokeStyle = '#c0c7d1'; c.lineWidth = 2;
    for (let i = -18; i <= 18; i += 9) { c.beginPath(); c.moveTo(x + i, y + 9); c.lineTo(x + i, y - 26); c.stroke(); }
    box(c, x - 22, y - 31, 44, 7, 3, '#8a90ad', INK, 2);
    if (lock === 'key') { ell(c, x, y - 6, 7, 7, '#ffd23f', INK, 1.8); Art.icon(c, 'key', x + 1, y - 6, 5); }
    else if (lock === 'bite') { box(c, x - 6, y - 10, 12, 10, 2, '#c98f4b', INK, 1.8); Art.icon(c, 'fang', x, y - 5, 5); }
    else { ell(c, x, y - 6, 7, 7, '#ff4f5e', INK, 1.8); Art.icon(c, 'bolt', x, y - 6, 5); }
  } else box(c, x + 12, y - 31, 7, 40, 3, '#8a90ad', INK, 2);
};
Art.house = function (c, x, y, hpf, flash, t) {
  ell(c, x, y + 30, 62, 14, 'rgba(0,0,0,.3)');
  box(c, x - 46, y - 26, 92, 58, 5, flash ? '#fff' : '#fff1d6', INK, 2.6);
  poly(c, [x - 56, y - 22, x, y - 70, x + 56, y - 22], flash ? '#fff' : '#ff4fb8', INK, 2.6);
  poly(c, [x - 40, y - 26, x, y - 60, x + 40, y - 26], flash ? '#fff' : '#ff7fd0');
  box(c, x - 10, y, 20, 32, 4, '#2de2e6', INK, 2.2); ell(c, x + 5, y + 16, 2, 2, '#ffd23f', INK, 1);
  box(c, x - 37, y - 10, 18, 16, 3, '#bff4ff', INK, 2); box(c, x + 19, y - 10, 18, 16, 3, '#bff4ff', INK, 2);
  Art.icon(c, 'paw', x, y - 40, 9 + Math.sin(t * 3));
  if (hpf < 0.5) { c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 30, y - 26); c.lineTo(x - 22, y - 8); c.lineTo(x - 28, y + 6); c.stroke(); }
};
Art.generator = function (c, x, y, hpf, flash, t) {
  ell(c, x, y + 26, 46, 11, 'rgba(0,0,0,.3)');
  box(c, x - 36, y - 26, 72, 54, 6, flash ? '#fff' : '#596080', INK, 2.6);
  box(c, x - 28, y - 18, 30, 22, 3, '#17101c', INK, 1.8);
  for (let i = 0; i < 4; i++) { c.fillStyle = (Math.floor(t * 5) + i) % 4 < 2 ? '#7CFF6B' : '#1e6b2b'; c.fillRect(x - 24 + i * 7, y - 14, 4, 14 * (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i)))); }
  Art.icon(c, 'bolt', x + 20, y - 6, 12);
  box(c, x - 28, y + 10, 56, 10, 3, '#ffd23f', INK, 1.8);
};
Art.loot = function (c, x, y, t, taken) {
  ell(c, x, y + 12, 22, 6, 'rgba(0,0,0,.3)');
  if (taken) { box(c, x - 16, y - 2, 32, 14, 3, '#8a5a2b', INK, 2); return; }
  c.save(); c.shadowColor = '#ffd23f'; c.shadowBlur = 18 + Math.sin(t * 4) * 6;
  box(c, x - 18, y - 18, 36, 30, 6, '#c9964f', INK, 2.2); c.restore();
  box(c, x - 18, y - 22, 36, 9, 4, '#e0b060', INK, 2); Art.icon(c, 'treat', x, y - 1, 11);
};
Art.umbrella = function (c, x, y, col) {
  ell(c, x + 4, y + 6, 22, 9, 'rgba(0,0,0,.18)');
  for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(x, y - 8); c.arc(x, y - 8, 24, i * TAU / 8, (i + 1) * TAU / 8); c.closePath(); c.fillStyle = i % 2 ? col : '#fff'; c.fill(); }
  ell(c, x, y - 8, 24, 24, null, INK, 2); ell(c, x, y - 8, 2.5, 2.5, INK);
};
Art.net = function (c, x, y, r, t) {
  c.save(); c.translate(x, y); c.rotate(t * 3);
  ell(c, 0, 0, r, r, 'rgba(255,255,255,.18)', '#fff', 2);
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1; c.beginPath();
  for (let i = -r + 5; i < r; i += 6) { const h = Math.sqrt(r * r - i * i); c.moveTo(i, -h); c.lineTo(i, h); c.moveTo(-h, i); c.lineTo(h, i); }
  c.stroke(); c.restore();
};
// soft radial glow sprite cache
const glows = {};
Art.glow = function (col) {
  if (glows[col]) return glows[col];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glows[col] = cv; return cv;
};
})();
