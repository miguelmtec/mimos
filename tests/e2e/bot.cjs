// test bot: plays missions by reading objective steps. Injected into the page.
(function () {
  const VP = window.VP, U = VP.U, I = VP.I, T = 48;
  const B = window.__bot = { tick: 0, fields: {}, stuck: 0, rev: 0, log: [] };
  function field(G, tx, ty, mode, ttl) {
    const key = Math.floor(tx / T) + ',' + Math.floor(ty / T) + ',' + mode, f = B.fields[key];
    if (f && B.tick - f.t < (ttl || 45)) return f.d;
    const keys = Object.keys(B.fields); if (keys.length > 6) delete B.fields[keys[0]];
    const fm = G.W.fieldMax; G.W.fieldMax = 0; const d = G.W.field(tx, ty, mode, f ? f.d : null); G.W.fieldMax = fm; B.fields[key] = { d, t: B.tick }; return d;
  }
  const tmp = { x: 0, y: 0 };
  function go(G, e, tx, ty, mode) {
    const W = G.W;
    if (B.nudge > 0) { I.mx = Math.cos(B.nudgeA); I.my = Math.sin(B.nudgeA); return Math.hypot(tx - e.x, ty - e.y); } // unstick: slide sideways for a moment
    { const dd = Math.hypot(tx - e.x, ty - e.y); if (!B.pg || B.pg.e !== e || Math.abs(B.pg.tx - tx) + Math.abs(B.pg.ty - ty) > 60 || dd < B.pg.d - 6) B.pg = { e, tx, ty, d: dd, t: B.tick }; else if (B.tick - B.pg.t > 40 && dd > 60) { B.force = 50; B.pg.t = B.tick; } }
    if (B.force > 0) B.force--;
    if (!(B.force > 0) && W.los(e.x, e.y, tx, ty, mode) && Math.hypot(tx - e.x, ty - e.y) < 400) { const d = Math.hypot(tx - e.x, ty - e.y) || 1; I.mx = (tx - e.x) / d; I.my = (ty - e.y) / d; return d; }
    const f = field(G, tx, ty, mode);
    const r = W.fieldDir(f, e.x, e.y, tmp);
    if (r > 0) { I.mx = tmp.x; I.my = tmp.y; } else if (r === 0) { const d = Math.hypot(tx - e.x, ty - e.y) || 1; I.mx = (tx - e.x) / d; I.my = (ty - e.y) / d; } else { I.mx = I.my = 0; return -1; }
    return Math.hypot(tx - e.x, ty - e.y);
  }
  function nearestDog(G, c, max) { let b = null, bd = max * max; for (const e of G.dogs) { if (e.dead || e.state === 'flee') continue; const d = U.d2(e.x, e.y, c.x, c.y); if (d < bd) { bd = d; b = e; } } return b; }
  function sw(G, name) { const i = ['mimo', 'mimosa', 'morticia'].indexOf(name); if (i >= 0 && i !== G.active && !G.cats[i].down && !G.car) { I.pressed.sw = i; return true; } return false; }
  B.poll = function () {
    const G = VP.Game.G; if (!G || G.over) return;
    B.tick++;
    { const k = G.cats[G.active]; if (B.nudge > 0) B.nudge--; if (!G.car && B.lastP && Math.hypot(k.x - B.lastP.x, k.y - B.lastP.y) < 0.4 && Math.hypot(I.mx, I.my) > 0.5 && !I.ctxHeld) { B.still = (B.still || 0) + 1; if (B.still > 12) { B.still = 0; B.nudge = 14; B.nudgeA = Math.atan2(I.my, I.mx) + (B.tick % 2 ? 1.57 : -1.57); } } else B.still = 0; B.lastP = { x: k.x, y: k.y }; }
    I.mx = I.my = 0; I.attack = false; I.aim = null; I.ctxHeld = false; I.useMouse = false;
    const c = G.cats[G.active], ob = VP.Missions.objective(G), st = ob.step || {}, at = ob.at;
    // --- driving ---
    if (G.car) {
      const car = G.car;
      if (!st.car && !G.free) { if (Math.abs(car.spd) < 200) I.pressed.ctx = true; return; }
      if (!at) return;
      if (B.rev > 0) { B.rev--; I.mx = -Math.cos(car.a + 0.6); I.my = -Math.sin(car.a + 0.6); return; }
      const f = field(G, at.x, at.y, 3, st.ram ? 20 : 60), r = G.W.fieldDir(f, car.x, car.y, tmp);
      if (r > 1) { I.mx = tmp.x; I.my = tmp.y; } else { const d = Math.hypot(at.x - car.x, at.y - car.y) || 1; I.mx = (at.x - car.x) / d; I.my = (at.y - car.y) / d; }
      if (Math.abs(car.spd) < 25) { B.stuck++; if (B.stuck > 45) { B.rev = 28; B.stuck = 0; } } else B.stuck = 0;
      I.attack = !!st.ram;
      return;
    }
    const mode = c.name === 'morticia' ? 1 : 0;
    if (st.car && !G.car && !G.cats.some(k => k.down)) { let b = null, bd = 1e12; for (const k of G.cars) if (!k.dead && k.ai !== 'cop' && k.ai !== 'target' && !k.locked) { const d = U.d2(k.x, k.y, c.x, c.y); if (d < bd) { bd = d; b = k; } } if (b) { go(G, c, b.x, b.y, mode); if (G.ctx && G.ctx.k === 'car') I.pressed.ctx = true; return; } }
    // --- revive ---
    const down = G.cats.find(k => k.down);
    if (down && VP.S.lives > 0) {
      const dog = nearestDog(G, c, 140);
      const d = go(G, c, down.x, down.y, mode);
      if (d >= 0 && d < 46) { I.mx = I.my = 0; I.ctxHeld = true; if (dog) { /* keep reviving */ } }
      else if (dog) I.attack = true;
      return;
    }
    if (down && VP.S.lives <= 0) { const paw = G.items.find(i => i.k === 'paw'); if (paw) { go(G, c, paw.x, paw.y, mode); return; } }
    if (st.txt === 'o_tutSwitch' || st.hint === 'switch') { if (B.tick % 20 === 0) I.pressed.cycle = true; return; }
    // --- stealth: walk around the snore rings, vanish when someone wakes up ---
    if (st.sneak && at) {
      const d0 = go(G, c, at.x, at.y, 1); void d0; let danger = false, inside = false, chased = false;
      const nx = c.x + I.mx * 46, ny = c.y + I.my * 46;
      for (const e of G.dogs) { if (e.dead) continue; if (e.sleep) { if (Math.hypot(nx - e.x, ny - e.y) < e.wake + 10) danger = true; if (Math.hypot(c.x - e.x, c.y - e.y) < e.wake + 12) inside = true; } else if (Math.hypot(c.x - e.x, c.y - e.y) < 170) chased = true; }
      if ((danger || chased) && c.invis < 0.5) { if (c.cd2 <= 0) I.pressed.dash = true; else if (!inside && !chased) { I.mx = I.my = 0; B.still = 0; } }
      return;
    }
    // --- tap mini-games (fishing): stand on the spot, press only when the bite is on ---
    if (st.tap && at) { const d = go(G, c, at.x, at.y, mode); if (d >= 0 && d < 36) { I.mx = I.my = 0; I.attack = !!st.ready() && B.tick % 4 < 2; } return; }
    if (st.mini && at) { const d = Math.hypot(at.x - c.x, at.y - c.y); if (d > 14) go(G, c, at.x, at.y, mode); return; }
    // --- dodge telegraphed attacks ---
    for (const tl of G.teles) {
      if (tl.safe) continue;
      if (tl.k === 'circle') { const d = Math.hypot(c.x - tl.x, c.y - tl.y); if (d < tl.r + 40) { const an = d > 1 ? Math.atan2(c.y - tl.y, c.x - tl.x) : 0; I.mx = Math.cos(an); I.my = Math.sin(an); I.attack = true; if (c.cd2 <= 0 && c.name !== 'mimo') I.pressed.dash = true; return; } }
      else { const dx = c.x - tl.x, dy = c.y - tl.y, along = dx * Math.cos(tl.a) + dy * Math.sin(tl.a), perp = -dx * Math.sin(tl.a) + dy * Math.cos(tl.a); if (along > -40 && along < tl.len + 40 && Math.abs(perp) < tl.w / 2 + 50) { const sg = perp >= 0 ? 1 : -1; I.mx = -Math.sin(tl.a) * sg; I.my = Math.cos(tl.a) * sg; I.attack = true; return; } }
    }
    // --- pick the right cat ---
    let want = st.cat || null;
    if (!want && (st.smash || (at && at.k === 'crate'))) want = 'mimosa';
    if (!want && st.fight) { const m = G.cats[0]; want = st.boss ? (G.boss && G.boss.exposed && G.boss.carry ? 'morticia' : 'mimosa') : (m.down || m.exhausted ? 'mimosa' : 'mimo'); }
    if (want && c.name !== want && !G.cats.find(k => k.name === want).down) { if (sw(G, want)) return; }
    // --- specials ---
    const dog = nearestDog(G, c, 330);
    if (dog) {
      if (c.name === 'mimo' && c.cdS <= 0 && (c.exhausted || c.hp < c.max * 0.5)) I.pressed.special = true;
      if (c.name === 'mimosa' && c.cdS <= 0 && U.d2(dog.x, dog.y, c.x, c.y) < 170 * 170) I.pressed.special = true;
      if (c.name === 'morticia' && c.feastReady) I.pressed.special = true;
    }
    // --- objective-specific ---
    if (at && at.shoot) {
      const from = at.from || (st.lot ? { x: st.lot.frontX, y: st.lot.frontY + 30 } : at);
      const dS = Math.hypot(at.x - c.x, at.y - c.y);
      if (dS < 430 && G.W.los(c.x, c.y - 4, at.x, at.y - 8, 2)) { I.attack = true; I.aim = Math.atan2(at.y - 8 - (c.y - 12), at.x - c.x); if (dS > 330) go(G, c, from.x, from.y, mode); return; }
      go(G, c, from.x, from.y, mode); if (dog && U.d2(dog.x, dog.y, c.x, c.y) < 150 * 150) I.attack = true; return;
    }
    const threat = dog && U.d2(dog.x, dog.y, c.x, c.y) < 210 * 210 && dog.state !== 'guard' && (G.W.los(c.x, c.y, dog.x, dog.y, 0) || G.W.distAt(G.field, dog.x, dog.y) >= 0);
    if ((st.fight || threat) && dog && !(st.act === 'ctx' && at && U.d2(at.x, at.y, c.x, c.y) < 90 * 90)) {
      // fight: mimo kites, others close in
      const d = Math.hypot(dog.x - c.x, dog.y - c.y);
      I.attack = true;
      if (c.name === 'mimo') { if (d < 170) { const a = Math.atan2(c.y - dog.y, c.x - dog.x) + Math.sin(B.tick * 0.05) * 0.9; I.mx = Math.cos(a); I.my = Math.sin(a); } else if (d > 330 || !G.W.los(c.x, c.y, dog.x, dog.y, 2)) go(G, c, dog.x, dog.y, mode); }
      else { let unreach = false; if (d > 34 + dog.r) unreach = go(G, c, dog.x, dog.y, mode) < 0; if (unreach) { I.attack = false; B.skipFight = true; } I.aim = Math.atan2(dog.y - c.y, dog.x - c.x); if (c.name === 'mimosa' && d > 90 && d < 230 && c.cd2 <= 0) I.pressed.dash = true; }
      if (B.skipFight) { B.skipFight = false; } else if (st.smash && at && at.k === 'crate' && d > 200) { /* fallthrough to target below */ } else return;
    }
    if (!at) { if (st.roam && dog) { I.attack = true; } return; }
    const d = go(G, c, at.x, at.y, st.mode !== undefined ? Math.min(st.mode, mode) : mode);
    if (st.act === 'attack' || at.k === 'crate' || at.stand || at.kind === 'dog') { if (d >= 0 && d < (at.stand ? 64 : at.kind === 'dog' ? 52 : 70)) { I.attack = true; I.aim = Math.atan2(at.y - c.y, at.x - c.x); if (d < 30) I.mx = I.my = 0; } }
    if (st.act === 'ctx' && G.ctx && G.ctx.k === 'car' && (at.kind !== 'car' || G.ctx.car === at)) I.pressed.ctx = true;
    if (d < 0) { B.noPath = (B.noPath || 0) + 1; } else B.noPath = 0;
  };
  // run one mission headless; returns result
  B.run = function (n, maxSec) {
    const UI = VP.UI; let res = null;
    const orig = UI.result; UI.result = (win, why) => { res = { win, why }; };
    const st0 = setTimeout; window.setTimeout = (f) => { f(); return 0; };
    VP.S.lives = 5;
    try {
      UI.startMission(n);
      const G = VP.Game.G; I.bot = B.poll; B.fields = {}; B.tick = 0; B.stuck = 0; B.rev = 0; B.nudge = 0; B.still = 0; B.lastP = null; B.force = 0; B.pg = null;
      const dt = 1 / 30; let t = 0, lastStep = -1, stepT = 0; const steps = [];
      while (!res && t < maxSec) {
        I.poll(); VP.Game.update(dt); t += dt;
        if (G.step !== lastStep) { steps.push(G.step + ':' + (G.steps[G.step] ? G.steps[G.step].txt : 'end') + '@' + Math.round(t)); lastStep = G.step; stepT = t; }
      }
      const out = { n, type: G.m.type, win: res ? res.win : null, why: res ? res.why : 'TIMEOUT step ' + G.step + ' ' + (G.steps[G.step] ? G.steps[G.step].txt : 'end(revive?)'), time: Math.round(G.time), par: VP.Missions.par(G.m), downs: G.stat.downs, livesLeft: VP.S.lives, cash: Math.round(G.stat.cash), hp: G.cats.map(c => Math.round(c.hp)), steps: steps.join(' '), stuckFor: Math.round(t - stepT), noPath: B.noPath };
      return out;
    } finally { window.setTimeout = st0; UI.result = orig; I.bot = null; }
  };
})();
