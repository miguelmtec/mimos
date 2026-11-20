'use strict';
// VICE PAWS — share card (1080x1350 PNG drawn on a canvas, with the cats in their current outfits) and "Desafie um amigo" links
(function () {
const VP = window.VP, UI = VP.UI, M = VP.Missions, t = (...a) => VP.t(...a);
const Share = VP.Share = { W: 1080, H: 1350 };
const SITE = 'https://vice-paws.vercel.app/', HANDLE = '@mimo.mimosa.morticia', FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
const NAMES = ['mimo', 'mimosa', 'morticia'];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let cur = null;

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fit(c, s, max, size, weight) { do { c.font = (weight || '900') + ' ' + size + 'px ' + FONT; size -= 2; } while (c.measureText(s).width > max && size > 18); return size + 2; }
// ctx: { score, stars (0-3 of the mission, or total), mission (object or null), city (string) }
Share.draw = function (ctx) {
  const W = Share.W, H = Share.H, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  // synthwave backdrop
  let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12041f'); g.addColorStop(0.45, '#3a1560'); g.addColorStop(0.8, '#b0189a'); g.addColorStop(1, '#ff8a5c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createLinearGradient(0, 150, 0, 620); g.addColorStop(0, '#ffd23f'); g.addColorStop(1, '#ff4fb8'); c.fillStyle = g; c.beginPath(); c.arc(W / 2, 400, 300, 0, 6.283); c.fill();
  c.fillStyle = '#3a1560'; for (let i = 0; i < 7; i++) c.fillRect(W / 2 - 320, 420 + i * 44, 640, 8 + i * 4);
  c.strokeStyle = 'rgba(45,226,230,.35)'; c.lineWidth = 3; for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(W / 2 + i * 40, 1010); c.lineTo(W / 2 + i * 190, H); c.stroke(); } for (let j = 0; j < 7; j++) { const y = 1010 + j * j * 8 + j * 14; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  // logo
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  c.font = 'italic 900 150px ' + FONT; c.lineWidth = 18; c.strokeStyle = '#12041f'; c.strokeText('VICE PAWS', W / 2, 170);
  g = c.createLinearGradient(0, 60, 0, 180); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ff9fe0'); g.addColorStop(1, '#2de2e6'); c.fillStyle = g; c.fillText('VICE PAWS', W / 2, 170);
  // the cats (3D stage render when WebGL is available, portraits otherwise)
  const px = 90, py = 230, pw = W - 180, ph = 640;
  c.save(); rr(c, px, py, pw, ph, 48); c.clip();
  let shot = null; try { shot = Share.cats(pw, ph); } catch (e) { shot = null; }
  if (shot) c.drawImage(shot, px, py, pw, ph);
  else { c.fillStyle = '#14052a'; c.fillRect(px, py, pw, ph); NAMES.forEach((n, i) => { const im = VP.Assets.image('portrait_' + n); if (im) { const s = 270, x = px + 40 + i * (s + 15), y = py + (ph - s) / 2; c.save(); c.beginPath(); c.arc(x + s / 2, y + s / 2, s / 2, 0, 6.283); c.clip(); c.drawImage(im, x, y, s, s); c.restore(); } }); }
  c.restore(); c.lineWidth = 10; c.strokeStyle = '#ff4fb8'; rr(c, px, py, pw, ph, 48); c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ffffff'; rr(c, px + 9, py + 9, pw - 18, ph - 18, 40); c.stroke();
  // text block
  const m = ctx.mission, title = m ? VP.mname(m) : t('sh_free'), place = ctx.city || (m && m.tourCity && VP.CityCache[m.tourCity] ? VP.CityCache[m.tourCity].real.name : m ? t('d' + m.d) : 'Vice Paws');
  c.fillStyle = 'rgba(18,4,31,.82)'; rr(c, 60, 900, W - 120, 300, 40); c.fill(); c.lineWidth = 4; c.strokeStyle = '#2de2e6'; c.stroke();
  c.fillStyle = '#2de2e6'; fit(c, '📍 ' + place.toUpperCase(), W - 200, 36, '900'); c.fillText('📍 ' + place.toUpperCase(), W / 2, 958);
  c.fillStyle = '#ffffff'; fit(c, title, W - 200, 66, 'italic 900'); c.fillText(title, W / 2, 1030);
  c.fillStyle = '#ffd23f'; c.font = 'italic 900 112px ' + FONT; const sc = String(ctx.score | 0), sw = c.measureText(sc).width; c.fillText(sc, W / 2 - 60, 1150);
  c.font = '900 34px ' + FONT; c.textAlign = 'left'; c.fillText(t('sh_score'), W / 2 - 60 + sw / 2 + 16, 1112);
  c.font = '900 44px ' + FONT; c.fillText(ctx.mission ? '★'.repeat(ctx.stars || 0) + '☆'.repeat(Math.max(0, 3 - (ctx.stars || 0))) : '★ ' + (ctx.stars || 0), W / 2 - 60 + sw / 2 + 16, 1156);
  c.textAlign = 'center';
  // handle + URL
  c.fillStyle = '#ffffff'; c.font = '900 46px ' + FONT; c.lineWidth = 8; c.strokeStyle = '#12041f'; c.strokeText('📸 ' + HANDLE, W / 2, 1264); c.fillText('📸 ' + HANDLE, W / 2, 1264);
  c.font = '800 34px ' + FONT; c.fillStyle = '#ffd23f'; c.strokeText('▶ ' + t('sh_play') + ' · vice-paws.vercel.app', W / 2, 1316); c.fillText('▶ ' + t('sh_play') + ' · vice-paws.vercel.app', W / 2, 1316);
  return cv;
};
// renders the three cats (plus the player's own cat, if any) on the showcase stage and returns a 2D canvas copy
Share.cats = function (w, h) {
  const R3 = VP.R3; if (!R3 || !R3.ok || !R3.snapshot) return null;
  const items = NAMES.map((n, i) => ({ spec: R3.spec(n, false), x: (i - 1) * 1.55, z: i === 1 ? 0.5 : 0, s: 1.15 }));
  if (VP.S.avatar) items.push({ spec: VP.S.avatar, x: 0, z: 1.9, s: 0.95 });
  return R3.snapshot(items, w, h);
};
const toBlob = cv => new Promise(res => { try { cv.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } });
Share.link = ctx => (ctx.mission && !ctx.mission.tourCity && ctx.mission.n > 0 ? SITE + '?c=' + ctx.mission.n + '-' + (ctx.score | 0) + (VP.S.name ? '-' + encodeURIComponent(VP.S.name) : '') : SITE);
// reads ?c=<mission>-<score>-<name> (the "Desafie um amigo" link)
Share.parse = function (search) {
  let m = null; try { m = /^(\d{1,4})-(\d{1,6})(?:-(.{1,40}))?$/.exec(new URLSearchParams(search).get('c') || ''); } catch (e) { m = null; }
  if (!m) return null; const ms = M.get(+m[1]); if (!ms || ms.tourCity || ms.side) return null;
  let name = ''; try { name = decodeURIComponent(m[3] || ''); } catch (e) { name = ''; }
  return { n: +m[1], score: Math.min(24000, +m[2]), name: name.replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 12) };
};
UI.SCREENS.share = {
  cls: 'glass', hideHud: true,
  html: () => `<div class="corner l"><button class="chip" data-act="shareBack">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="gold">📤 ${t('sh_title')}</h2>
    <img class="shareimg" id="shimg" alt="Vice Paws" src="${cur && cur.url ? cur.url : ''}"><p class="small">${t('sh_hold')}</p>
    <button class="btn big" data-act="shareImg">📷 ${cur && cur.canFiles ? t('sh_img') : t('sh_save')}</button>
    ${cur && cur.ctx.mission && !cur.ctx.mission.tourCity && cur.ctx.mission.n > 0 ? `<button class="btn teal" data-act="shareDare">⚔️ ${t('sh_dare')}</button><p class="small">${esc(t('sh_dareTxt', cur.ctx.score | 0, VP.mname(cur.ctx.mission)))}</p>` : ''}
    <button class="btn ghost" data-act="shareBack">${t('back')}</button></div>`,
};
Share.open = async function (ctx) {
  const prev = { screen: UI.screen, arg: UI.arg };
  ctx = ctx || {}; const cv = Share.draw(ctx), blob = await toBlob(cv);
  if (cur && cur.url) try { URL.revokeObjectURL(cur.url); } catch (e) { /* ignore */ }
  const file = blob ? new File([blob], 'vice-paws.png', { type: 'image/png' }) : null;
  let canFiles = false; try { canFiles = !!(file && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { canFiles = false; }
  cur = { ctx, cv, blob, file, canFiles, url: blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png'), prev };
  UI.show('share');
  return cur;
};
Share.current = () => cur;
const copy = (text, msg) => { const done = () => UI.toast(msg || t('copied')); try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); return; } } catch (e) { /* fall through */ } const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); done(); };
UI.act.shareBack = () => { const p = cur && cur.prev; if (p && p.screen && p.screen !== 'share') UI.show(p.screen, p.arg); else UI.show('title'); };
UI.act.shareImg = () => {
  if (!cur) return; const text = t('shareTxt', UI.mainStars() || cur.ctx.stars || 0) + ' ' + SITE;
  if (cur.canFiles) { navigator.share({ files: [cur.file], title: 'Vice Paws', text }).catch(() => {}); return; }
  // no file sharing here (desktop, some in-app browsers): download; the image on screen can also be long-pressed
  try { const a = document.createElement('a'); a.href = cur.url; a.download = 'vice-paws.png'; document.body.appendChild(a); a.click(); a.remove(); UI.toast('⬇ vice-paws.png'); } catch (e) { UI.toast(t('sh_hold')); }
};
UI.act.shareDare = () => {
  if (!cur) return; const url = Share.link(cur.ctx), text = t('sh_dareTxt', cur.ctx.score | 0, VP.mname(cur.ctx.mission));
  try { if (navigator.share) { navigator.share({ title: 'Vice Paws', text, url }).catch(() => {}); return; } } catch (e) { /* fall through */ }
  copy(text + ' ' + url, t('sh_linkOk'));
};
UI.act.share = () => { const r = UI.last(); Share.open(r && r.win ? { score: r.score, stars: r.stars, mission: r.m } : { score: UI.mainScore(), stars: VP.totalStars(), mission: null }); };
UI.act.chalPlay = () => { if (UI.challenge) UI.show('brief', UI.challenge.n); };
// a challenge link opens straight on the title screen with the dare on top
Share.boot = function () { const ch = Share.parse(location.search); if (ch) { UI.challenge = ch; if (UI.screen === 'title') UI.relabel(); } };
})();
