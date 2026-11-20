'use strict';
// VICE PAWS — "Volta ao Mundo": travel to real cities (OpenStreetMap extracts) and play them as open maps
(function () {
const VP = window.VP, UI = VP.UI, M = VP.Missions, t = (...a) => VP.t(...a);
const Tour = VP.Tour = {};
VP.CityCache = {};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Tour.unlocked = c => !c.stars || VP.totalStars() >= c.stars;
UI.SCREENS.world = {
  hideHud: true,
  html: () => `<div class="corner l"><button class="chip" data-act="back">‹ ${t('back')}</button></div><div class="wrap" style="margin-top:46px"><h2 class="teal">✈ ${t('world')}</h2><p class="small">${t('wt_sub')} · ⭐ ${VP.totalStars()}</p>
    <div class="citygrid">${M.cities.map(c => { const un = Tour.unlocked(c), seen = VP.S.tour && VP.S.tour[c.id] ? Object.keys(VP.S.tour[c.id].seen).length : 0, comu = (c.tags || []).includes('comunidade'); return `<button class="city ${un ? '' : 'lock'} ${c.hometown ? 'home' : ''}" data-act="${un ? 'fly' : 'nop'}" data-id="${c.id}"><span class="fl">${c.flag || '🌍'}</span><b>${esc(c.name)}</b><span>${c.hometown ? '💛 ' + t('wt_home') : esc(c.country)}${comu ? ' · ' + t('wt_comu') : ''}</span><span>${un ? '📸 ' + seen + '/' + c.landmarks + ' ' + t('wt_post') : '🔒 ' + t('wt_need', c.stars)}</span></button>`; }).join('')}</div>
    ${VP.Game.G && VP.Game.G.tour ? `<button class="btn" data-act="tourHome">🏠 ${t('wt_back')}</button>` : ''}
    <p class="legal">🗺 ${esc(M.osm)} · openstreetmap.org/copyright</p></div>`,
};
Tour.open = () => UI.show('world');
Tour.load = async function (id) {
  if (VP.CityCache[id]) return VP.CityCache[id];
  const meta = M.cities.find(c => c.id === id); if (!meta) return null;
  const r = await fetch('data/cities/' + meta.file); if (!r.ok) return null;
  const C = await r.json();
  // keep at most two real cities in memory (phones)
  const keys = Object.keys(VP.CityCache); if (keys.length >= 2) delete VP.CityCache[keys[0]];
  return (VP.CityCache[id] = VP.World.fromCity(C, meta));
};
UI.act.fly = async el => {
  const id = el.dataset.id, meta = M.cities.find(c => c.id === id);
  UI.toast('✈ ' + t('wt_loading', meta.name), 4000);
  let W = null; try { W = await Tour.load(id); } catch (e) { W = null; }
  if (!W) { UI.toast(t('wt_fail'), 3000); return; }
  UI.tour(id);
};
UI.act.tourHome = () => UI.free(VP.S.pos || null, false, { home: true });
})();
