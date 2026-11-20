'use strict';
// VICE PAWS — "Volta ao Mundo": travel to real cities (OpenStreetMap extracts) and play them as open maps.
// The screen is a stylised flat map (Brazil first, then the world) with one pin per city, a card list grouped by country
// with the progress of each city (stars, golden paws, postcards) and a short flight animation while the map downloads.
// Every destination is free: cities open with the stars earned by playing. Nothing here is sold.
(function () {
const VP = window.VP, UI = VP.UI, M = VP.Missions, t = (...a) => VP.t(...a);
const Tour = VP.Tour = { view: 'br', sel: null };
VP.CityCache = {};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Tour.unlocked = c => !c.stars || VP.totalStars() >= c.stars;
// progress of one city: stars of its 10 missions, its 5 golden paws, postcards seen
Tour.progress = function (c) {
  const S = VP.S, base = M.tourBase(c); let stars = 0, done = 0, paws = 0;
  for (let k = 0; k < 10; k++) { const s = S.stars[base + k] || 0; stars += s; if (s) done++; }
  for (let i = 0; i < 5; i++) if (S.paws && S.paws[c.id + '_' + i]) paws++;
  const seen = S.tour && S.tour[c.id] ? Object.keys(S.tour[c.id].seen).length : 0;
  return { stars, done, paws, seen, total: c.landmarks || 0 };
};

// ---------- the map (equirectangular, low-poly outlines drawn by hand; lon, lat pairs) ----------
const LAND = [
  [-168, 66, -156, 71, -128, 70, -110, 68, -95, 72, -82, 68, -78, 62, -65, 60, -56, 52, -64, 45, -70, 43, -76, 35, -81, 31, -80, 25, -83, 29, -90, 30, -97, 26, -97, 20, -90, 21, -87, 16, -83, 10, -78, 8, -80, 8, -85, 11, -92, 15, -97, 16, -105, 20, -110, 23, -112, 29, -117, 33, -124, 40, -124, 48, -135, 58, -150, 60, -165, 60],
  [-81, -5, -78, 2, -77, 8, -72, 12, -62, 11, -52, 5, -50, 0, -44, -2, -35, -6, -35, -9, -39, -14, -39, -18, -41, -22, -48, -26, -48, -28, -53, -34, -58, -38, -62, -39, -65, -41, -66, -46, -68, -50, -69, -53, -74, -52, -75, -46, -73, -37, -71, -30, -70, -18, -76, -14, -80, -6],
  [-9, 37, -9, 43, -1, 44, -4, 48, 2, 51, 8, 54, 8, 57, 11, 59, 5, 60, 8, 63, 15, 69, 28, 71, 40, 67, 44, 66, 60, 68, 60, 55, 50, 46, 40, 47, 36, 45, 30, 45, 28, 41, 24, 38, 20, 40, 16, 38, 15, 41, 12, 44, 9, 44, 3, 43, 0, 39, -5, 36],
  [-5, 50, 1, 51, 0, 53, -2, 56, -3, 58, -6, 57, -5, 54, -3, 53, -5, 52],
  [-17, 15, -16, 21, -10, 29, -6, 35, 10, 37, 11, 33, 20, 31, 32, 31, 35, 24, 43, 12, 51, 11, 40, -3, 40, -15, 35, -24, 30, -31, 20, -35, 17, -29, 12, -17, 13, -8, 9, 0, 9, 4, -5, 5, -13, 8],
  [60, 68, 75, 72, 105, 77, 140, 73, 170, 69, 180, 66, 170, 60, 162, 57, 156, 51, 142, 54, 135, 44, 128, 38, 126, 34, 122, 31, 120, 25, 110, 21, 108, 16, 109, 11, 104, 9, 100, 13, 103, 2, 98, 8, 95, 16, 90, 22, 80, 15, 77, 8, 72, 20, 66, 25, 57, 25, 56, 27, 50, 30, 48, 29, 52, 24, 56, 24, 59, 22, 52, 16, 43, 12, 35, 24, 32, 31, 36, 36, 28, 41, 30, 45, 36, 45, 40, 47, 50, 46, 60, 55],
  [130, 31, 135, 34, 140, 35, 141, 40, 142, 45, 140, 42, 137, 37, 132, 34],
  [114, -22, 114, -34, 118, -35, 129, -32, 138, -35, 146, -39, 150, -37, 153, -28, 146, -19, 142, -11, 136, -12, 130, -12, 122, -17],
];
const BRAZIL = [-51.6, 4.3, -50, 1, -48, -1, -44, -2.5, -41, -3, -38.5, -3.7, -35.2, -5.5, -34.8, -8, -37, -11, -39, -13.5, -39, -17.5, -40.5, -21, -42, -23, -44.5, -23.3, -48.5, -26, -48.7, -28.5, -50.5, -30.5, -53.4, -33.7, -57.6, -30.2, -55, -27, -54.3, -24, -57.8, -22, -58, -19.8, -57.5, -18, -60, -16.3, -60.2, -13.5, -65.4, -11, -65.3, -9.8, -70.5, -9.5, -73.8, -7.3, -73, -5, -70, -4.2, -69.5, 1, -67, 1.7, -64, 4, -60, 5.2, -58, 1.5, -54, 2.3];
// view boxes in degrees: [west, north, east, south]
const VIEWS = { br: [-76, 8, -31, -36], world: [-172, 78, 182, -58] };
const HOME = { lat: 25.77, lon: -80.19 }; // the fictional home city sits on the Florida coast
const isBR = c => /bra[sz]il/i.test(c.country || '');
function mapSvg(view, opts) {
  opts = opts || {};
  const V = Array.isArray(view) ? view : VIEWS[view], wide = Array.isArray(view) || view === 'world', w = V[2] - V[0], h = V[1] - V[3], X = lon => +(lon - V[0]).toFixed(2), Y = lat => +(V[1] - lat).toFixed(2), u = w / 100;
  const poly = (P, cls) => `<polygon class="${cls}" points="${P.map((v, i) => (i % 2 ? Y(v) : X(v))).reduce((a, v, i) => a + (i % 2 ? ',' : ' ') + v, '').trim()}"/>`;
  const all = M.cities.filter(c => c.lat !== undefined && (wide || isBR(c))), soon = (M.soon || []).filter(s => !M.cities.some(c => c.id === s.id) && (wide || isBR(s)));
  // cities that share a spot (the Rio neighbourhoods) fan out around it
  const pts = all.map(c => ({ c, x: X(c.lon), y: Y(c.lat) }));
  for (const p of pts) { const g = pts.filter(q => Math.hypot(q.x - X(p.c.lon), q.y - Y(p.c.lat)) < u * 2.2); if (g.length > 1) { const i = g.indexOf(p), a = i / g.length * 6.283 - 1.2, r = u * (2.2 + g.length * 0.45); p.x = +(X(p.c.lon) + Math.cos(a) * r).toFixed(2); p.y = +(Y(p.c.lat) + Math.sin(a) * r).toFixed(2); } }
  const pin = p => { const c = p.c, un = Tour.unlocked(c), pr = Tour.progress(c), sel = Tour.sel === c.id; return `<g class="pin ${un ? 'on' : 'off'} ${c.hometown ? 'home' : ''} ${sel ? 'sel' : ''} ${pr.done >= 10 ? 'full' : ''}" data-act="pin" data-id="${c.id}"><circle class="hit" cx="${p.x}" cy="${p.y}" r="${u * 4.2}"/><circle class="dot" cx="${p.x}" cy="${p.y}" r="${u * (sel ? 2.5 : 1.9)}"/>${un ? '' : `<text x="${p.x}" y="${p.y + u * 0.9}" font-size="${u * 2.4}" text-anchor="middle">🔒</text>`}${sel ? `<text class="lbl" x="${Math.max(u * 16, Math.min(w - u * 16, p.x))}" y="${p.y > u * 9 ? p.y - u * 4 : p.y + u * 6.5}" font-size="${u * 3.6}" text-anchor="middle">${esc(c.name.split(' — ').pop())}</text>` : ''}</g>`; };
  return `<svg class="wmap ${Array.isArray(view) ? 'zoom' : view}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="--u:${u}px"><rect class="sea" x="0" y="0" width="${w}" height="${h}" rx="${u * 3}"/>
    ${[0.2, 0.4, 0.6, 0.8].map(f => `<line class="grat" x1="0" x2="${w}" y1="${h * f}" y2="${h * f}"/><line class="grat" y1="0" y2="${h}" x1="${w * f}" x2="${w * f}"/>`).join('')}
    ${LAND.map(P => poly(P, 'land')).join('')}${poly(BRAZIL, 'land brz')}
    ${soon.map(s => `<circle class="soon" cx="${X(s.lon)}" cy="${Y(s.lat)}" r="${u * 1.1}"/>`).join('')}
    ${pts.filter(p => p.c.id !== Tour.sel).map(pin).join('')}${pts.filter(p => p.c.id === Tour.sel).map(pin).join('')}
    ${opts.extra || ''}</svg>`;
}
Tour.mapSvg = mapSvg;

// ---------- screen ----------
function card(c) {
  const un = Tour.unlocked(c), pr = Tour.progress(c), comu = (c.tags || []).includes('comunidade'), here = VP.Game.G && VP.Game.G.tour === c.id;
  const sub = c.hometown ? '💛 ' + t('wt_home') : comu ? t('wt_comu') : (c.tags || []).includes('beach') ? '🏖 ' + t('wt_beach') : (c.tags || []).includes('morro') ? '⛰ ' + t('wt_hill') : '';
  return `<button class="city2 ${un ? '' : 'lock'} ${c.hometown ? 'home' : ''} ${Tour.sel === c.id ? 'sel' : ''}" data-act="${un ? 'fly' : 'pin'}" data-id="${c.id}" id="city-${c.id}">
    <span class="fl">${c.flag || '🌍'}</span>
    <span class="tx"><b>${esc(c.name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}
      ${un ? `<span class="pg"><i>⭐ ${pr.stars}/30</i><i>🐾 ${pr.paws}/5</i><i>📸 ${pr.seen}/${pr.total}</i></span><span class="bar"><u style="width:${Math.round(pr.stars / 30 * 100)}%"></u></span>` : `<span class="pg need">🔒 ${t('wt_need', c.stars)} · ${t('wt_left', Math.max(0, c.stars - VP.totalStars()))}</span><span class="bar"><u style="width:${Math.min(100, Math.round(VP.totalStars() / c.stars * 100))}%"></u></span>`}</span>
    <span class="go">${un ? (here ? '📍' : '✈') : ''}</span></button>`;
}
function groups() {
  const by = new Map();
  for (const c of M.cities) { const k = c.country || '🌍'; if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
  const list = [...by.entries()].map(([country, cs]) => ({ country, cs, br: cs.some(isBR), flag: (cs.find(c => c.flag && c.flag !== '🏡') || cs[0]).flag || '🌍', min: Math.min(...cs.map(c => c.stars || 0)) }));
  list.sort((a, b) => (b.br ? 1 : 0) - (a.br ? 1 : 0) || a.min - b.min);
  return list;
}
UI.SCREENS.world = {
  hideHud: true,
  html: () => {
    const gs = groups(), tot = VP.totalStars(), open = M.cities.filter(Tour.unlocked).length, soon = (M.soon || []).filter(s => !M.cities.some(c => c.id === s.id));
    const next = M.cities.filter(c => !Tour.unlocked(c)).sort((a, b) => a.stars - b.stars)[0];
    if (!M.cities.some(c => isBR(c)) && Tour.view === 'br') Tour.view = 'world';
    return `<div class="corner l"><button class="chip" data-act="back">‹ ${t('back')}</button></div><div class="wrap wtour" style="margin-top:46px"><h2 class="teal">✈ ${t('world')}</h2>
    <p class="small">⭐ ${tot} · ${t('wt_open', open, M.cities.length)}${next ? ' · ' + t('wt_next', esc(next.name.split(' — ')[0]), Math.max(0, next.stars - tot)) : ''}</p>
    <div class="seg"><button class="${Tour.view === 'br' ? 'on' : ''}" data-act="wview" data-v="br">🇧🇷 ${t('wt_br')}</button><button class="${Tour.view === 'world' ? 'on' : ''}" data-act="wview" data-v="world">🌎 ${t('wt_world')}</button></div>
    <div class="mapbox">${mapSvg(Tour.view)}<span class="legend"><i class="l1"></i>${t('wt_l_open')} <i class="l2"></i>${t('wt_l_lock')}${soon.length ? ` <i class="l3"></i>${t('wt_l_soon')}` : ''}</span></div>
    ${gs.filter(g => Tour.view === 'world' || g.br).map(g => { const st = g.cs.reduce((a, c) => a + Tour.progress(c).stars, 0); return `<h3 class="ctry">${g.flag} ${esc(g.country)} <small>${g.cs.filter(Tour.unlocked).length}/${g.cs.length} · ⭐ ${st}/${g.cs.length * 30}</small></h3><div class="citylist">${g.cs.map(card).join('')}</div>`; }).join('')}
    ${Tour.view === 'br' && gs.some(g => !g.br) ? `<button class="btn ghost sm" data-act="wview" data-v="world">🌎 ${t('wt_more', gs.filter(g => !g.br).reduce((a, g) => a + g.cs.length, 0))}</button>` : ''}
    ${soon.length ? `<p class="small soonline">🔜 ${t('wt_soon')}: ${soon.filter(s => Tour.view === 'world' || isBR(s)).slice(0, 14).map(s => esc(s.name.split(' — ')[0])).filter((v, i, a) => a.indexOf(v) === i).join(', ')}…</p>` : ''}
    <p class="small">${t('wt_free')}</p>
    ${VP.Game.G && VP.Game.G.tour ? `<button class="btn" data-act="tourHome">🏠 ${t('wt_back')}</button>` : ''}
    <p class="legal">🗺 ${esc(M.osm)} · openstreetmap.org/copyright</p></div>`;
  },
};
Tour.open = () => { const G = VP.Game.G; Tour.sel = G && G.tour ? G.tour : null; if (Tour.sel) Tour.view = isBR(M.cities.find(c => c.id === Tour.sel) || {}) ? 'br' : 'world'; UI.show('world'); };
UI.act.wview = el => { Tour.view = el.dataset.v; UI.show('world'); };
// tapping a pin selects the city and brings its card into view (the card is the button that flies)
UI.act.pin = el => { Tour.sel = el.dataset.id; const sc = document.querySelector('#s-world'); const top = sc ? sc.scrollTop : 0; UI.show('world'); const s2 = document.querySelector('#s-world'); if (s2) s2.scrollTop = top; const cd = document.getElementById('city-' + Tour.sel); if (cd && cd.scrollIntoView) cd.scrollIntoView({ block: 'center', behavior: 'smooth' }); const c = M.cities.find(x => x.id === Tour.sel); if (c && !Tour.unlocked(c)) UI.toast('🔒 ' + t('wt_need', c.stars), 1800); };
// Neighbour tiles: a city entry of index.json may list `tiles: [{id: 'rio_n', dir: 'n', file: 'rio_n.json', name?}]` (also e, s, w).
// They load when the player walks up to that edge; a missing or broken file simply leaves the soft edge in place.
const tileCache = {};
Tour.tileMeta = function (id) { for (const c of M.cities) for (const tl of c.tiles || []) if (tl.id === id) return { city: c, tile: tl }; return null; };
Tour.neighbor = function (id, side) {
  const back = { n: 's', s: 'n', e: 'w', w: 'e' }[side], own = Tour.tileMeta(id);
  let tl = null;
  if (own) { if (own.tile.dir === back) tl = { id: own.city.id, name: own.city.name, main: 1 }; }
  else { const c = M.cities.find(x => x.id === id), f = c && (c.tiles || []).find(x => x.dir === side); if (f) tl = { id: f.id, name: f.name || c.name }; }
  if (!tl) return null;
  const key = id + '>' + tl.id; if (!tileCache[key]) tileCache[key] = Object.assign(tl, { state: VP.CityCache[tl.id] ? 'ready' : null });
  if (tileCache[key].state === 'ready' && !VP.CityCache[tl.id]) tileCache[key].state = null;
  return tileCache[key];
};
Tour.loadTile = async function (id) {
  if (VP.CityCache[id]) return VP.CityCache[id];
  const own = Tour.tileMeta(id); if (!own) return Tour.load(id).catch(() => null);
  try {
    const r = await fetch('data/cities/' + (own.tile.file || id + '.json')); if (!r.ok) return null;
    const C = await r.json(); if (!C || !C.roads || !C.buildings) return null;
    C.id = id; if (!C.name) C.name = own.tile.name || own.city.name;
    const keys = Object.keys(VP.CityCache), cur = VP.Game.G && VP.Game.G.tour; for (const k of keys) if (keys.length >= 2 && k !== cur) { delete VP.CityCache[k]; break; }
    return (VP.CityCache[id] = VP.World.fromCity(C, Object.assign({}, own.city, { id, tileOf: own.city.id, hometown: 0 })));
  } catch (e) { return null; }
};
Tour.load = async function (id) {
  if (VP.CityCache[id]) return VP.CityCache[id];
  const meta = M.cities.find(c => c.id === id); if (!meta) return null;
  const r = await fetch('data/cities/' + meta.file); if (!r.ok) return null;
  const C = await r.json();
  // keep at most two real cities in memory (phones)
  const keys = Object.keys(VP.CityCache); if (keys.length >= 2) delete VP.CityCache[keys[0]];
  return (VP.CityCache[id] = VP.World.fromCity(C, meta));
};
// flight: the plane crosses the map from where the cats are to the destination while the city downloads
Tour.flight = function (meta, ms) {
  const G = VP.Game.G, cur = G && G.tour ? M.cities.find(c => c.id === G.tour) : null, from = cur && cur.lat !== undefined ? cur : HOME;
  // zoom on the trip: a box around both ends, never smaller than a short hop, a little taller on phones
  const portrait = window.innerHeight > window.innerWidth, cx = (from.lon + meta.lon) / 2, cy = (from.lat + meta.lat) / 2, span = Math.max(Math.abs(from.lon - meta.lon) * 1.5, Math.abs(from.lat - meta.lat) * (portrait ? 1.5 : 2.4), 22);
  const hw = Math.min(170, span / 2 + 6), hh = Math.min(66, hw * (portrait ? 0.95 : 0.6)), V = [cx - hw, Math.min(80, cy + hh + hh * 0.25), cx + hw, Math.max(-60, cy - hh + hh * 0.25)], view = V, w = V[2] - V[0], u = w / 100;
  const ax = from.lon - V[0], ay = V[1] - from.lat, bx = meta.lon - V[0], by = V[1] - meta.lat, d = Math.hypot(bx - ax, by - ay) || 1, mx = (ax + bx) / 2, my = (ay + by) / 2 - Math.max(u * 6, d * 0.28);
  const el = document.createElement('div'); el.className = 'flight'; el.id = 'flight';
  const keep = Tour.sel; Tour.sel = meta.id;
  el.innerHTML = `<div class="fl-in"><b>✈ ${esc(t('wt_loading', meta.name))}</b>${mapSvg(view, { extra: `<path class="route" d="M${ax} ${ay} Q${mx} ${my} ${bx} ${by}"/><text class="plane" id="plane" font-size="${u * 7}" text-anchor="middle" dominant-baseline="central">✈️</text>` })}<small>${meta.flag || ''} ${esc(meta.country || '')}</small></div>`;
  Tour.sel = keep;
  document.body.appendChild(el);
  const plane = el.querySelector('#plane'), t0 = performance.now();
  return new Promise(res => {
    const step = () => {
      const f = Math.min(1, (performance.now() - t0) / ms), e = f * f * (3 - 2 * f), x = (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * mx + e * e * bx, y = (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * my + e * e * by;
      const tx = 2 * (1 - e) * (mx - ax) + 2 * e * (bx - mx), ty = 2 * (1 - e) * (my - ay) + 2 * e * (by - my);
      if (plane) plane.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(Math.atan2(ty, tx) * 180 / Math.PI + 45).toFixed(1)})`);
      if (f < 1) requestAnimationFrame(step); else res();
    };
    step();
  });
};
UI.act.fly = async el => {
  const id = el.dataset.id, meta = M.cities.find(c => c.id === id); if (!meta || Tour.busy) return;
  Tour.busy = true; Tour.sel = id;
  const anim = meta.lat !== undefined && !Tour.noAnim ? Tour.flight(meta, 1700) : (UI.toast('✈ ' + t('wt_loading', meta.name), 4000), Promise.resolve());
  let W = null; try { W = await Tour.load(id); } catch (e) { W = null; }
  await anim;
  const fl = document.getElementById('flight'); if (fl) fl.remove();
  Tour.busy = false;
  if (!W) { UI.toast(t('wt_fail'), 3000); return; }
  UI.tour(id);
};
UI.act.tourHome = () => UI.free(VP.S.pos || null, false, { home: true });
})();
