// VICE PAWS — anonymous visit counter for the owner's dashboard (admin.html).
// A random id lives in this browser only; no e-mail, no IP, no game data is sent. Off on localhost/tests.
(function () {
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname) || /[?&]nostats/.test(location.search)) return;
  let vid = '';
  try { vid = localStorage.getItem('vp_vid') || ''; if (!/^[a-z0-9]{12,40}$/.test(vid)) { vid = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 20).replace(/[^a-z0-9]/g, '0'); localStorage.setItem('vp_vid', vid); } } catch (e) { return; }
  const sent = {};
  const hit = ev => { if (sent[ev]) return; sent[ev] = 1; try { fetch('/api/stats/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vid, ev }), keepalive: true }).catch(() => {}); } catch (e) { /* never break the game */ } };
  hit('visit');
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-act]'); if (!a) return; const k = a.dataset.act; if (k === 'play' || k === 'free' || k === 'go') hit('play'); if (k === 'onEnter') hit('online'); }, true);
})();
