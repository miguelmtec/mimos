'use strict';
// VICE PAWS — photo mode: hide the HUD, pick a pose, turn the camera, snap. The picture gets a little polaroid frame and is
// saved to the device (a download; where downloads are blocked, e.g. in-app browsers, it is shown to long-press and save).
// With a celebrity next to you it becomes a selfie and offers "Quero esse look".
(function () {
const VP = window.VP, I = VP.I, Life = VP.Life, Game = VP.Game;
const tr = (...a) => VP.t(...a);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = Life.photo = { on: false, celeb: null, last: null };
const POSES = [['sit', '🪑'], ['wave', '👋'], ['dance', '💃'], ['miau', '😺']];

P.open = function (opts) {
  const G = Game.G, L = G && G.life; if (!L || !L.free || G.car || P.on) return; opts = opts || {};
  P.on = true; P.celeb = opts.celeb || null; L.selfie = P.celeb; VP.HUD.hidden = true;
  const c = G.cats[G.active];
  if (P.celeb && VP.R3 && VP.R3.snapCamera) VP.R3.snapCamera(Math.atan2(P.celeb.y - c.y, P.celeb.x - c.x)); // the star in the background, looking at the lens
  Life.openPanel(`<div class="lf-ph-top"><span>${esc(P.celeb ? tr('lf_selfie', P.celeb.name) : tr('lf_photoMode'))}</span><button class="lf-x" data-life="phClose">✕</button></div>
  <div class="lf-ph-frame"><i></i><i></i><i></i><i></i></div><div id="lf-ph-out"></div>
  <div class="lf-ph-bar"><div class="lf-row">${POSES.map(p => `<button class="lf-chip" data-life="phPose" data-p="${p[0]}">${p[1]} ${esc(tr('em_' + p[0]))}</button>`).join('')}</div>
  <div class="lf-row"><button class="lf-chip" data-life="phTurn" data-d="-1">⟲</button><button class="lf-shutter" data-life="phSnap" aria-label="${esc(tr('lf_snap'))}">📸</button><button class="lf-chip" data-life="phTurn" data-d="1">⟳</button></div>
  ${P.celeb ? `<button class="lf-chip gold" data-life="wantLook" data-n="${P.celeb.star}">👗 ${esc(tr('lf_wantLook'))}</button>` : `<p class="lf-note">${esc(tr('lf_snapHint'))}</p>`}</div>`, 'photo', true);
  Game.emote(P.celeb ? 'wave' : 'sit');
};
P.close = function () { if (!P.on) return; P.on = false; const L = Game.G && Game.G.life; if (L) L.selfie = null; P.celeb = null; VP.HUD.hidden = false; if (Life.panel === 'photo') Life.closePanel(); };
// keep things tidy however the panel gets closed (backdrop tap, Esc, tab hidden)
const close0 = Life.closePanel; Life.closePanel = function () { const was = Life.panel; close0(); if (was === 'photo' && P.on) { P.on = false; const L = Game.G && Game.G.life; if (L) L.selfie = null; P.celeb = null; VP.HUD.hidden = false; } };

P.snap = function () {
  const R3 = VP.R3, G = Game.G; if (!R3 || !R3.three || !G) return null;
  const { renderer, scene, camera } = R3.three, src = renderer.domElement;
  renderer.render(scene, camera); // same task as toDataURL: the buffer is still there
  const W = 1080, pad = 44, foot = 150, iw = W - pad * 2, ih = Math.round(iw * Math.min(1.25, src.height / src.width)), cv = document.createElement('canvas'); cv.width = W; cv.height = ih + pad + foot;
  const c = cv.getContext('2d'); c.fillStyle = '#fffaf2'; c.fillRect(0, 0, cv.width, cv.height);
  const sr = src.width / src.height, dr = iw / ih; let sx = 0, sy = 0, sw = src.width, sh = src.height; if (sr > dr) { sw = src.height * dr; sx = (src.width - sw) / 2; } else { sh = src.width / dr; sy = (src.height - sh) * 0.45; }
  try { c.drawImage(src, sx, sy, sw, sh, pad, pad, iw, ih); } catch (e) { return null; }
  c.fillStyle = '#12041f'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = '900 54px system-ui,-apple-system,sans-serif'; c.fillText('VICE PAWS 🐾', pad, pad + ih + 58);
  c.font = '600 30px system-ui,-apple-system,sans-serif'; c.fillStyle = '#6a5a7a'; const where = G.W.real ? G.W.real.name.split(' — ')[0] : tr('d' + VP.World.distAt(G.W, G.cats[G.active].x, G.cats[G.active].y));
  c.fillText((P.celeb ? tr('lf_selfie', P.celeb.name) + ' · ' : '') + where + ' · @mimo.mimosa.morticia', pad, pad + ih + 112, iw);
  let url = null; try { url = cv.toDataURL('image/jpeg', 0.9); } catch (e) { return null; }
  P.last = url; const S = Life.S(); S.snaps = (S.snaps || 0) + 1; VP.persist();
  return url;
};
function save(url) {
  try { const a = document.createElement('a'); a.href = url; a.download = 'vice-paws-' + Date.now() + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); return true; } catch (e) { return false; }
}
const A = Life.act;
A.phClose = () => P.close();
A.phPose = el => { Game.emote(el.dataset.p); };
A.phTurn = el => { I.look += +el.dataset.d * 0.5; };
A.phSnap = () => {
  const G = Game.G, url = P.snap(), out = document.getElementById('lf-ph-out');
  if (!url) { if (VP.UI.toast) VP.UI.toast(tr('lf_snapFail')); return; }
  if (G) G.flashT = 0.3; if (VP.Audio) VP.Audio.sfx('star');
  const ok = save(url);
  if (out) { out.innerHTML = `<img src="${url}" alt=""><span>${esc(tr(ok ? 'lf_snapSaved' : 'lf_snapFail'))}</span>`; out.className = 'on'; clearTimeout(P._t); P._t = setTimeout(() => { out.className = ''; }, 4200); }
  if (Life._.points && G && G.life) Life._.points(G.life, 5);
};
})();
