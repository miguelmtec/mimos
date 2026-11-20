'use strict';
// VICE PAWS — WebAudio synthwave music + SFX (no audio files)
(function () {
const VP = window.VP;
const Au = VP.Audio = { ctx: null, muted: VP.ls.get('vp_mute') === '1', song: -1 };
let ac = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, delay = null;
let timer = null, step = 0, nextT = 0, engine = null, siren = null;

Au.unlock = function () {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      Au.ctx = ac;
      master = ac.createGain(); master.gain.value = Au.muted ? 0 : 0.9;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
      master.connect(comp).connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = 0.34; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
      delay = ac.createDelay(1); delay.delayTime.value = 0.28;
      const fb = ac.createGain(); fb.gain.value = 0.32; delay.connect(fb).connect(delay);
      const dg = ac.createGain(); dg.gain.value = 0.35; delay.connect(dg).connect(musicBus);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; return; }
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  if (Au.song >= 0 && !timer) startTimer();
};
Au.toggleMute = function () {
  Au.muted = !Au.muted; VP.ls.set('vp_mute', Au.muted ? '1' : '0');
  if (master) master.gain.value = Au.muted ? 0 : 0.9;
  if (Au.onmute) Au.onmute(Au.muted);
};

// ---------- primitives ----------
function tone(f, t, d, type, v, bus, slide, attack) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.02);
  return g;
}
function noise(t, d, v, bus, freq, q, type, slide) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
  if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + d);
  const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g).connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
}
const hz = n => 55 * Math.pow(2, n / 12); // n semitones above A1

// ---------- music ----------
// Each song: bpm, chord roots (semitones from A1) + quality, lead riff (scale degrees per 16th, -1 rest)
const SONGS = [
  { bpm: 104, ch: [[0, 0], [8, 1], [3, 1], [10, 1]], lead: [7, -1, 12, -1, 15, -1, 12, 14, -1, 12, -1, 10, 7, -1, 10, -1], sw: 0.0 },           // Sunset Beach
  { bpm: 112, ch: [[0, 0], [0, 0], [5, 0], [3, 1]], lead: [12, 12, -1, 15, -1, 12, 19, -1, 17, -1, 15, -1, 12, -1, 10, 12], sw: 0 },           // Neon Downtown
  { bpm: 108, ch: [[3, 1], [10, 1], [0, 0], [8, 1]], lead: [15, -1, 19, 22, -1, 19, -1, 15, 17, -1, 15, -1, 12, -1, 15, -1], sw: 0 },          // Palm Harbor
  { bpm: 98, ch: [[0, 0], [10, 1], [8, 1], [7, 1]], lead: [12, -1, -1, 15, -1, -1, 14, -1, 12, -1, -1, 10, -1, 8, 7, -1], sw: 0 },             // Storm Docks
  { bpm: 120, ch: [[0, 0], [8, 1], [5, 0], [7, 1]], lead: [12, 15, 19, 24, 19, 15, 12, 15, 20, 15, 12, 15, 19, 14, 11, 14], sw: 0 },           // Vice Heights
  { bpm: 132, ch: [[0, 0], [1, 1], [0, 0], [10, 1]], lead: [12, 12, 13, 12, -1, 12, 15, -1, 12, 12, 13, 12, -1, 19, 18, 15], sw: 0 },          // Boss
  { bpm: 92, ch: [[0, 0], [8, 1], [3, 1], [10, 1]], lead: [-1, -1, 12, -1, -1, -1, 15, -1, -1, -1, 14, -1, 12, -1, -1, -1], sw: 0 },           // Menu
  { bpm: 96, ch: [[3, 1], [10, 1], [0, 0], [8, 1]], lead: [15, -1, 15, 19, -1, 19, 22, -1, 20, -1, 19, -1, 17, 15, -1, -1], sw: 0.18 },        // Sertanejo (Rio Verde)
];
function schedStep(song, s, t) {
  const S = SONGS[song], spb = 60 / S.bpm / 4;
  const bar = Math.floor(s / 16) % 4, i = s % 16, [root, maj] = S.ch[bar];
  const third = maj ? 4 : 3, chord = [0, third, 7, 12, 12 + third, 19];
  // drums
  if (i % 4 === 0) { tone(150, t, 0.16, 'sine', 0.9, musicBus, 42); }
  if (i === 4 || i === 12) { noise(t, 0.16, 0.5, musicBus, 1800, 0.7); tone(190, t, 0.09, 'triangle', 0.3, musicBus, 110); }
  if (i % 2 === 0) noise(t, 0.035, i % 4 === 2 ? 0.2 : 0.1, musicBus, 8000, 1, 'highpass');
  if (song === 5 && i % 2 === 1) noise(t, 0.02, 0.08, musicBus, 9000, 1, 'highpass');
  // bass (octave pump)
  if (song !== 6 || i % 4 === 0) {
    const bn = root + (i % 4 === 2 ? 12 : 0);
    const g = tone(hz(bn), t, spb * 0.95, 'sawtooth', 0.34, ac.createBiquadFilter(), 0);
    // route through a lowpass
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; g.disconnect(); g.connect(lp).connect(musicBus);
  }
  // arp
  if (song !== 6) {
    const an = root + 24 + chord[[0, 2, 3, 2, 4, 2, 3, 1][i % 8]];
    const g = tone(hz(an), t, spb * 0.9, 'square', 0.06, delay); g.connect(musicBus);
  }
  // pad on bar start
  if (i === 0) for (const c of [0, third, 7]) tone(hz(root + 24 + c), t, spb * 15.5, 'sawtooth', 0.028, musicBus, 0, 0.25);
  // lead: plays on bars 2-3 of every 4, transposed to the bar's root where it fits
  const phrase = Math.floor(s / 64) % 2;
  if ((bar >= 2 || phrase === 1 || song === 5) && S.lead[i] >= 0) {
    const n = S.lead[i] + 24 + (bar === 1 || bar === 3 ? 0 : 0);
    const g = tone(hz(n), t, spb * 1.7, 'sawtooth', song === 6 ? 0.05 : 0.07, delay, 0, 0.012); g.connect(musicBus);
    tone(hz(n) * 1.005, t, spb * 1.7, 'square', 0.03, musicBus, 0, 0.012);
  }
}
function startTimer() {
  if (!ac || timer) return;
  nextT = ac.currentTime + 0.08;
  timer = setInterval(() => {
    if (!ac || Au.song < 0 || ac.state !== 'running') return;
    const spb = 60 / SONGS[Au.song].bpm / 4;
    if (nextT < ac.currentTime - 0.3) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.18) { try { schedStep(Au.song, step, nextT); } catch (e) { /* ignore */ } step++; nextT += spb; }
  }, 50);
}
Au.music = function (song) {
  if (song === Au.song) return;
  Au.song = song; step = 0;
  if (song < 0) { if (timer) { clearInterval(timer); timer = null; } return; }
  if (ac) startTimer();
};
Au.pause = function (p) { if (musicBus) musicBus.gain.value = p ? 0.12 : 0.34; if (p) Au.engine(0, false); };

// ---------- SFX ----------
const last = {};
const FX = {
  shoot(t) { tone(1100, t, 0.09, 'square', 0.16, sfxBus, 320); noise(t, 0.05, 0.14, sfxBus, 3000, 1); },
  hairball(t) { tone(300, t, 0.2, 'sine', 0.3, sfxBus, 140); },
  bite(t) { noise(t, 0.07, 0.5, sfxBus, 1400, 2); tone(260, t, 0.08, 'square', 0.22, sfxBus, 120); },
  bite3(t) { noise(t, 0.12, 0.6, sfxBus, 900, 1.5); tone(200, t, 0.16, 'sawtooth', 0.28, sfxBus, 70); },
  dash(t) { noise(t, 0.2, 0.3, sfxBus, 600, 0.8, 'bandpass', 3000); },
  roar(t) { tone(160, t, 0.6, 'sawtooth', 0.4, sfxBus, 60); noise(t, 0.55, 0.4, sfxBus, 500, 0.6, 'bandpass', 200); tone(240, t, 0.5, 'square', 0.14, sfxBus, 90); },
  nap(t) { tone(520, t, 0.7, 'sine', 0.3, sfxBus, 130); tone(780, t + 0.05, 0.6, 'sine', 0.12, sfxBus, 200); },
  eat(t) { tone(420, t, 0.06, 'square', 0.2, sfxBus, 700); tone(520, t + 0.07, 0.07, 'square', 0.2, sfxBus, 900); },
  steal(t) { tone(700, t, 0.05, 'triangle', 0.3, sfxBus, 1500); tone(1000, t + 0.05, 0.1, 'triangle', 0.3, sfxBus, 2000); },
  feast(t) { for (let i = 0; i < 6; i++) tone(400 + i * 120, t + i * 0.05, 0.08, 'square', 0.18, sfxBus, 600 + i * 150); },
  hit(t) { noise(t, 0.06, 0.4, sfxBus, 800, 1); tone(180, t, 0.07, 'square', 0.2, sfxBus, 90); },
  tink(t) { tone(2200, t, 0.05, 'triangle', 0.2, sfxBus, 1800); },
  hurt(t) { tone(320, t, 0.2, 'sawtooth', 0.3, sfxBus, 110); noise(t, 0.1, 0.3, sfxBus, 500, 1); },
  ko(t) { noise(t, 0.22, 0.4, sfxBus, 400, 0.7, 'bandpass', 1500); tone(500, t, 0.2, 'triangle', 0.22, sfxBus, 1300); },
  down(t) { tone(440, t, 0.5, 'sawtooth', 0.3, sfxBus, 70); },
  pickup(t) { tone(1320, t, 0.06, 'square', 0.14, sfxBus); tone(1760, t + 0.05, 0.08, 'square', 0.14, sfxBus); },
  cash(t) { tone(1568, t, 0.05, 'triangle', 0.22, sfxBus); tone(2093, t + 0.06, 0.12, 'triangle', 0.22, sfxBus); },
  coffee(t) { tone(500, t, 0.25, 'triangle', 0.3, sfxBus, 1100); },
  paw(t) { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.14, 'triangle', 0.26, sfxBus)); },
  revive(t) { [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.08, 0.16, 'triangle', 0.28, sfxBus)); },
  sw(t) { tone(660, t, 0.05, 'triangle', 0.2, sfxBus, 990); },
  click(t) { tone(880, t, 0.04, 'square', 0.1, sfxBus); },
  step(t) { [660, 880].forEach((f, i) => tone(f, t + i * 0.09, 0.12, 'triangle', 0.25, sfxBus)); },
  switch(t) { tone(900, t, 0.1, 'square', 0.2, sfxBus, 1800); tone(1800, t + 0.1, 0.2, 'sine', 0.2, sfxBus); },
  break(t) { noise(t, 0.25, 0.5, sfxBus, 700, 0.6); tone(140, t, 0.15, 'square', 0.2, sfxBus, 60); },
  crash(t) { noise(t, 0.3, 0.6, sfxBus, 300, 0.5); tone(90, t, 0.2, 'sawtooth', 0.3, sfxBus, 40); },
  honk(t) { tone(400, t, 0.18, 'square', 0.14, sfxBus); tone(500, t, 0.18, 'square', 0.14, sfxBus); },
  door(t) { tone(180, t, 0.08, 'square', 0.2, sfxBus, 120); noise(t + 0.02, 0.05, 0.2, sfxBus, 2000, 1); },
  net(t) { noise(t, 0.2, 0.25, sfxBus, 2500, 2, 'bandpass', 800); },
  alarm(t) { for (let i = 0; i < 3; i++) tone(900, t + i * 0.22, 0.2, 'square', 0.14, sfxBus, 600); },
  wanted(t) { tone(700, t, 0.3, 'sawtooth', 0.14, sfxBus, 1200); tone(1200, t + 0.3, 0.3, 'sawtooth', 0.14, sfxBus, 700); },
  boss(t) { tone(110, t, 0.9, 'sawtooth', 0.4, sfxBus, 55); noise(t, 0.6, 0.3, sfxBus, 200, 0.5); },
  slam(t) { noise(t, 0.35, 0.7, sfxBus, 180, 0.5); tone(80, t, 0.3, 'sine', 0.6, sfxBus, 35); },
  win(t) { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, t + i * 0.1, 0.22, 'triangle', 0.3, sfxBus)); },
  fail(t) { [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.16, 0.25, 'sawtooth', 0.2, sfxBus)); },
  star(t) { tone(1568, t, 0.08, 'triangle', 0.3, sfxBus); tone(2349, t + 0.07, 0.2, 'triangle', 0.3, sfxBus); },
  tick(t) { tone(1000, t, 0.03, 'square', 0.12, sfxBus); },
  thunder(t) { noise(t, 1.2, 0.5, sfxBus, 120, 0.4, 'lowpass'); },
};
Au.sfx = function (name, minGap) {
  if (!ac || Au.muted || ac.state !== 'running' || !FX[name]) return;
  const now = ac.currentTime, g = minGap === undefined ? 0.04 : minGap;
  if (last[name] && now - last[name] < g) return;
  last[name] = now;
  try { FX[name](now); } catch (e) { /* ignore */ }
};
// continuous engine hum while driving
Au.engine = function (speed, on) {
  if (!ac) return;
  if (!on) { if (engine) { try { engine.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); engine.o.stop(ac.currentTime + 0.3); } catch (e) { /* ignore */ } engine = null; } return; }
  if (!engine) {
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0;
    o.connect(lp).connect(g).connect(sfxBus); o.start(); engine = { o, g };
  }
  engine.o.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.33, ac.currentTime, 0.05);
  engine.g.gain.setTargetAtTime(0.1, ac.currentTime, 0.1);
};
})();
