'use strict';
// VICE PAWS — "Loja dos Mimos": honest Pix shop (cosmetics/bonus only), try-before-you-buy, restore, supporters' wall
(function () {
const VP = window.VP, UI = VP.UI, t = (...a) => VP.t(...a);
const Shop = VP.Shop = {};
const PKEY = 'vp_purchases';
// display prices only: the server (api/pix/_products.js) always decides what is charged
const PRICE = { vip: '4,90', lives10: '1,99', season: '2,90', apoio5: '5,00', apoio10: '10,00', apoio20: '20,00', supporter_small: '0,99', skin_praia: '0,99', skin_agro: '0,99', skin_festa: '1,99', skin_natal: '1,99', season_natal: '4,90', season_natal_plus: '9,90' };
const PACKS = [['skin_praia', 'pack_praia', '🏄', 'linear-gradient(135deg,#2de2e6,#ff8a5c)'], ['skin_agro', 'pack_agro', '🤠', 'linear-gradient(135deg,#c98f4b,#5c3a18)'], ['skin_festa', 'pack_festa', '🎉', 'linear-gradient(135deg,#b967ff,#ff4fb8)'], ['skin_natal', 'pack_natal', '🎄', 'linear-gradient(135deg,#1f8f5a,#e01e37)']];
Shop.PRICE = PRICE; Shop.PACKS = PACKS;
let P = null;
try { P = JSON.parse(VP.ls.get(PKEY)); } catch (e) { P = null; }
if (!P || typeof P !== 'object' || !P.ids) P = { ids: {}, grants: {}, mural: [] };
if (!P.grants) P.grants = {}; if (!P.mural) P.mural = [];
Shop.P = P;
const save = () => VP.ls.set(PKEY, JSON.stringify(P));
Shop.has = g => !!P.grants[g];
Shop.skin = kind => Shop.has('vip') && (kind !== 'car' || P.goldCar !== false);
// grants are applied exactly once per payment id
Shop.apply = function (id, product, grants) {
  id = String(id);
  if (P.ids[id]) return false;
  P.ids[id] = { product, ts: Date.now() };
  for (const g of grants || []) {
    if (g === 'lives10') { VP.S.lives += 10; VP.persist(); }
    else P.grants[g] = true;
    if (g === 'supporter') { const n = (VP.S.name || 'Gateiro').slice(0, 14); if (!P.mural.includes(n)) P.mural.push(n); }
    if (g === 'season') { VP.S.xmas = true; VP.persist(); }
  }
  save();
  if (VP.Wardrobe && VP.Wardrobe.data) for (const g of grants || []) { if (g === 'vip') VP.Wardrobe.equipSet(g); else if (VP.Wardrobe.autoAtk) VP.Wardrobe.autoAtk(g); }
  if (VP.R3 && VP.R3.refreshCats) VP.R3.refreshCats();
  return true;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const art = k => VP.Assets.get(k) || '';
const price = p => `<span class="price"><small>R$</small>${PRICE[p]}</span>`;

Object.assign(VP.L, {
  pk_title: ['O que vem no pacote', "What's in the pack"], pk_prev: ['Prévia 3D: é assim que fica no jogo', '3D preview: this is how it looks in the game'], pk_art: ['Arte de divulgação. O visual real no jogo é o da prévia 3D.', 'Promo art. The real in-game look is the 3D preview.'],
  pk_loading: ['Montando a prévia…', 'Building the preview…'], pk_fxNote: ['Só visual: não muda dano, alcance nem velocidade.', 'Visual only: no change to damage, range or speed.'],
  pk_vip1: ['Conversível dourado com neon e buzina', 'Golden convertible with underglow and horn'], pk_vip2: ['Dancinha da vitória', 'Victory dance'], pk_vip3: ['Coroa dourada no ranking', 'Golden ranking crown'], pk_vip4: ['Bairro bônus Marina Dourada (5 missões)', 'Golden Marina bonus district (5 missions)'],
  pk_sea1: ['4 missões especiais de Natal Neon', '4 special Neon Christmas missions'], pk_sea2: ['Neve e decoração de Natal na cidade', 'Snow and Christmas decorations in the city'],
  pk_all: ['para os três gatos', 'for all three cats'], pk_ready: ['Chegou!', 'It is here!'], pk_equip: ['Equipar agora', 'Equip now'], pk_equipped: ['Equipado!', 'Equipped!'], pk_later: ['Fechar', 'Close'],
  pk_wear: ['Os três gatos já estão com o visual novo. Mude quando quiser no Guarda-roupa.', 'All three cats are ready in the new look. Change it any time in the Wardrobe.'],
  slot_atk: ['Efeito de ataque', 'Attack effect'], wd_atkNote: ['Efeito de ataque: só visual, não muda dano, alcance nem velocidade.', 'Attack effect: visual only, no change to damage, range or speed.'],
});
VP.L.p_vip_d = ['Roupas animadas para os três (ouro, neon e brilho), rastro de brilho, efeito de ataque dourado (só visual), conversível dourado com neon e buzina, dancinha da vitória, coroa no ranking e o bairro bônus Marina Dourada (5 missões).', 'Animated outfits for all three (gold, neon and sparkle), sparkle trail, golden attack effect (visual only), golden convertible with underglow and horn, victory dance, ranking crown and the Golden Marina bonus district (5 missions).'];
const ICON_KEYS = [['crown', '👑'], ['glasses', '🕶'], ['halo', '😇'], ['santa', '🎅'], ['party', '🥳'], ['phones', '🎧'], ['cowboy', '🤠'], ['flowers', '🌸'], ['antlers', '🦌'], ['beanie', '🧶'], ['star', '⭐'], ['bells', '🔔'], ['bell', '🔔'], ['lei', '🌺'], ['scarf', '🧣'], ['collar', '📿'], ['bowtie', '🎀'], ['bow', '🎀'], ['hat', '🎩'], ['board', '🏄'], ['guitar', '🎸'], ['balloon', '🎈'], ['gift', '🎁'], ['cape', '🦸'], ['wings', '🪽'], ['pack', '🎒'], ['jacket', '🧥'], ['hoodie', '🧥'], ['shirt', '👕']];
const iconOf = it => { if (it.slot === 'atk') return '💥'; if (it.slot === 'trail') return it.trail && it.trail.shape === 'heart' ? '💗' : '✨'; const a = it.acc || {}; for (const [k, ic] of ICON_KEYS) if (a[k]) return ic; return '👕'; };
Shop.iconOf = iconOf;
const S = UI.SCREENS;
const L2 = o => o[VP.lang() === 'pt' ? 'pt' : 'en'];
// ---------- honest cards: a real 3D preview of the look + the full item list ----------
const PV = { vip: ['vip', '#2a1048'], season: ['season', '#12303a'], pack_praia: ['pack_praia', '#0e5a78'], pack_agro: ['pack_agro', '#4a2e12'], pack_festa: ['pack_festa', '#3a1068'], pack_natal: ['pack_natal', '#0f3d2a'] };
function pkgList(grant, extra) {
  const Wd = VP.Wardrobe, items = Wd && Wd.data ? Wd.setItems(grant) : [];
  const rows = items.map(i => `<li><i>${iconOf(i)}</i><span>${esc(L2(i.name))}${i.slot === 'atk' ? `<small>${t('pk_fxNote')}</small>` : ''}</span></li>`).concat((extra || []).map(([ic, k]) => `<li><i>${ic}</i><span>${t(k)}</span></li>`));
  return `<ul class="pklist">${rows.join('')}</ul>`;
}
function pkgBlock(key, grant, extra) {
  return `<div class="pkg"><h5>${t('pk_title')} <small>${t('pk_all')}</small></h5><div class="pvbox" style="background:${PV[key][1]}"><canvas class="pvc" data-pv="${key}" width="320" height="224"></canvas><div class="pvwait">${t('pk_loading')}</div></div><p class="pvnote">${t('pk_prev')}</p>${pkgList(grant, extra)}</div>`;
}
S.shop = {
  hideHud: true,
  html: () => {
    const vip = Shop.has('vip'), sea = Shop.has('season'), sup = Shop.has('supporter');
    return `<div class="corner l"><button class="chip" data-act="shopBack">‹ ${t('back')}</button></div><div class="corner"><button class="chip" data-act="lang">${VP.lang() === 'pt' ? '🇧🇷 PT' : '🇺🇸 EN'}</button></div>
    <div class="wrap" style="margin-top:46px"><h2 class="gold">🛍 ${t('shop')}</h2><p class="small">${t('shopSub')}</p>
    <div class="shopgrid">
      <div class="card vip"><div class="badge">${t('popular')}</div><div class="art" style="background-image:url('${art('shop_vip')}')"><span class="artnote">${t('pk_art')}</span></div><div class="body"><h4>👑 ${t('p_vip')}</h4><p>${t('p_vip_d')}</p>
        ${pkgBlock('vip', 'vip', [['🏎', 'pk_vip1'], ['💃', 'pk_vip2'], ['👑', 'pk_vip3'], ['🌴', 'pk_vip4']])}
        <div class="buy">${vip ? `<span class="owned">${t('owned')}</span>` : price('vip')}<button class="btn ghost sm" data-act="tryOn">👗 ${t('tryOn')}</button>${vip ? '' : `<button class="btn gold" data-act="buy" data-p="vip">${t('buy')}</button>`}</div></div></div>
      <div class="card"><div class="art" style="background-image:url('${art('shop_season')}')"><span class="artnote">${t('pk_art')}</span></div><div class="body"><h4>🎄 ${t('p_season')}</h4><p>${t('p_season_d')}</p>
        ${pkgBlock('season', 'season', [['❄', 'pk_sea1'], ['🎄', 'pk_sea2']])}
        <div class="buy">${sea ? `<span class="owned">${t('owned')}</span>` : price('season') + `<button class="btn teal" data-act="buy" data-p="season">${t('buy')}</button>`}</div></div></div>
      <div class="card"><div class="art" style="background-image:url('${art('shop_apoio')}')"></div><div class="body"><h4>💖 ${t('p_apoio')} ${sup ? '· ' + t('supporter') + ' ✓' : ''}</h4><p>${t('p_apoio_d')}</p>
        <div class="amts">${['supporter_small', 'apoio5', 'apoio10', 'apoio20'].map(p => `<button class="btn sm" data-act="buy" data-p="${p}">R$ ${PRICE[p].replace(',00', '')}</button>`).join('')}</div>
        <div class="buy" style="margin-top:8px"><button class="btn ghost sm" data-act="mural">🌟 ${t('mural')}</button></div></div></div>
      <div class="card mini"><div class="art" style="background:linear-gradient(135deg,#ff4f7a,#7a1050);display:flex;align-items:center;justify-content:center;font-size:44px">❤️</div><div class="body"><h4>${t('p_lives10')}</h4><p>${t('p_lives10_d')}</p><div class="buy">${price('lives10')}<button class="btn sm" data-act="buy" data-p="lives10">${t('buy')}</button></div></div></div>
    </div>
    <h3 class="teal" style="margin:14px 0 2px">👕 ${t('packs')}</h3><p class="small">${t('packsSub')}</p>
    <div class="packgrid">${PACKS.map(([prod, g, icon, bg]) => { const own = Shop.has(g); return `<div class="card pack"><div class="art" style="background:${bg}">${icon}</div><div class="body"><h4>${t('p_' + g)}</h4>${pkgBlock(g, g)}<div class="buy">${own ? `<span class="owned">${t('owned')}</span>` : price(prod)}<button class="btn ghost sm" data-act="packTry" data-g="${g}">👗 ${t('tryOn')}</button>${own ? '' : `<button class="btn teal sm" data-act="buy" data-p="${prod}">${t('buy')}</button>`}</div></div></div>`; }).join('')}</div>
    <button class="btn ghost" data-act="restore">🔑 ${t('restore')}</button>
    <p class="legal">${t('legal')}</p><div class="foot">${t('fan')}</div></div>`;
  },
  after: () => Shop.startPreviews(),
};
// 3D previews: rendered once per product into a few canvases (one per frame), then played back slowly, ping-pong, in the cards
const PVC = {}; let pvTimer = null, pvJob = 0;
Shop.previews = PVC;
Shop.pvFrames = function (key, opt) {
  const R3 = VP.R3, Wd = VP.Wardrobe; if (!R3 || !R3.ok || !R3.turntable || !Wd || !Wd.data) return null;
  const grant = PV[key][0], names = ['mimo', 'mimosa', 'morticia'], X = [-1.75, 0, 1.75], Z = [0.2, 0.55, 0.2];
  const items = names.map((n, i) => ({ spec: Wd.setSpec(grant, n), x: X[i], z: Z[i] })), atk = Wd.setItems(grant).find(i => i.slot === 'atk');
  const mobile = innerWidth < 700;
  return R3.turntable(items, Object.assign({ w: mobile ? 450 : 480, h: mobile ? 315 : 336, frames: mobile ? 7 : 9, bg: PV[key][1], dist: 7.4, lookY: 1.15, camY: 1.9, fxDemo: atk ? atk.fx : null, demoX: -0.9, amp: 0.45 }, opt || {}));
};
Shop.startPreviews = function () {
  const job = ++pvJob, keys = [...document.querySelectorAll('canvas.pvc')].map(c => c.dataset.pv);
  const draw = () => { for (const c of document.querySelectorAll('canvas.pvc')) { const fr = PVC[c.dataset.pv]; if (!fr) continue; const i = Math.floor(Shop._pvT) % (2 * fr.length - 2), k = i < fr.length ? i : 2 * fr.length - 2 - i; if (c.width !== fr[0].width) { c.width = fr[0].width; c.height = fr[0].height; } c.getContext('2d').drawImage(fr[k], 0, 0); const w = c.parentNode.querySelector('.pvwait'); if (w) w.remove(); } };
  Shop._pvT = 0; clearInterval(pvTimer);
  pvTimer = setInterval(() => { if (!document.getElementById('s-shop')) { clearInterval(pvTimer); pvTimer = null; return; } Shop._pvT += 0.5; draw(); }, 130);
  const next = () => { if (job !== pvJob || !document.getElementById('s-shop')) return; const k = keys.shift(); if (!k) return; if (!(k in PVC)) { try { PVC[k] = Shop.pvFrames(k); } catch (e) { PVC[k] = null; } } if (PVC[k]) draw(); else { const w = document.querySelector(`canvas.pvc[data-pv="${k}"]`); if (w) w.parentNode.style.display = 'none'; } setTimeout(next, 30); };
  setTimeout(next, 60);
};
Shop.open = () => UI.show('shop');
// preview a cosmetic pack on the cats in the wardrobe (items stay locked until bought)
UI.act.packTry = el => { const Wd = VP.Wardrobe, g = el.dataset.g, first = Wd.data.items.find(i => i.grant === g); Wd.slot = first.slot; Wd.tryPack = g; Wd.open(); };
UI.act.shopBack = () => { const G = VP.Game.G; if (G && UI.state === 'play') { UI.hide(); UI.paused = false; } else UI.show('title'); };

// ---------- try before you buy ----------
S.tryon = {
  cls: 'clear', hideHud: true, stage: true,
  html: () => `<div class="corner l"><button class="chip" data-act="shop">‹ ${t('back')}</button></div>
    <div class="wrap narrow" style="margin-top:auto"><h2 class="gold">👑 ${t('tryTitle')}</h2><p class="small">${t('p_vip_d')}</p>
    <div class="row"><button class="btn teal sm" data-act="testLap">🚗 ${t('testLap')}</button>${Shop.has('vip') ? '' : `<button class="btn gold" data-act="buy" data-p="vip">R$ ${PRICE.vip} · ${t('buy')}</button>`}</div></div>`,
  after: () => {
    const M3 = VP.R3; if (!M3 || !M3.ok) return;
    const sp = n => M3.spec(n, true);
    M3.showcase([{ spec: sp('mimo'), x: -1.5, z: 0.6 }, { spec: sp('mimosa'), x: 0, z: 1.2 }, { spec: sp('morticia'), x: 1.4, z: 0.7 }, { car: 'gold', x: 0, z: -1.6, s: 0.8 }], { dist: 8.2, shift: 1.8, lookY: 1.0, sway: true, fxDemo: 'gold', demoX: -1.3, demoLen: 2.6 });
  },
};
UI.act.tryOn = () => UI.show('tryon');
UI.act.testLap = () => UI.free(null, false, { trial: true });

// ---------- supporters ----------
S.mural = {
  hideHud: true,
  html: () => `<div class="corner l"><button class="chip" data-act="shop">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="gold">🌟 ${t('mural')}</h2>
    <div class="hero" style="background-image:url('${art('shop_apoio')}');aspect-ratio:1"></div>
    <div class="mur">${P.mural.length ? P.mural.map(n => `<span>💖 ${esc(n)}</span>`).join('') : `<p class="small">${t('muralEmpty')}</p>`}</div>
    <button class="btn" data-act="shop">${t('back')}</button></div>`,
};
UI.act.mural = () => UI.show('mural');
S.thanks = {
  cls: 'clear', hideHud: true, stage: true,
  html: () => `<div class="wrap narrow" style="margin-top:auto"><h2 class="gold">💖 ${t('thanks')}</h2><p>${t('thanksSub')}</p><div class="row"><button class="btn ghost sm" data-act="mural">🌟 ${t('mural')}</button><button class="btn" data-act="shop">${t('close')}</button></div></div>`,
  after: () => { const M3 = VP.R3; if (!M3 || !M3.ok) return; const sp = n => M3.spec(n, Shop.has('vip')); M3.showcase([{ spec: sp('mimo'), x: -1.4 }, { spec: sp('mimosa'), x: 0, z: 0.5 }, { spec: sp('morticia'), x: 1.3 }], { dance: true, spin: false, dist: 7.5, shift: 2.2 }); UI.confetti(); },
};

// ---------- checkout ----------
let poll = null;
function closeModal() { clearInterval(poll); poll = null; const m = document.querySelector('#ui .modal'); if (m) m.remove(); }
function modal(html) { closeModal(); const d = document.createElement('div'); d.className = 'modal on'; d.innerHTML = `<div class="sheet">${html}</div>`; document.getElementById('ui').appendChild(d); return d; }
UI.act.closeModal = closeModal;
// what a purchase shows on the celebration: the grant whose look arrives (VIP, a pack or the season set)
const lookGrant = grants => (grants || []).find(g => g === 'vip' || g === 'season' || /^pack_/.test(g)) || null;
function paid(id, product, grants) {
  closeModal();
  const fresh = Shop.apply(id, product, grants);
  UI.confetti(); VP.Audio.sfx('win');
  const sup = (grants || []).includes('supporter'), lg = lookGrant(grants), M3 = VP.R3, Wd = VP.Wardrobe;
  let cele = '';
  if (lg && !sup && M3 && M3.ok && Wd && Wd.data) {
    // celebration: the three cats wearing the new look, front-facing (stage behind the receipt sheet)
    const items = Wd.setItems(lg);
    UI.show('bought', lg);
    cele = `<h2 class="gold">🎉 ${t('pk_ready')}</h2><p class="small">${esc(t(lg === 'vip' ? 'p_vip' : lg === 'season' ? 'p_season' : 'p_' + lg))}</p><ul class="pklist cel">${items.map(i => `<li><i>${iconOf(i)}</i><span>${esc(L2(i.name))}</span></li>`).join('')}</ul>
      <button class="btn gold big" data-act="equipNow" data-g="${lg}">✨ ${t('pk_equip')}</button>`;
  }
  const m = modal(`${cele || '<h2 class="gold">🎉</h2>'}<p><b>${t('pixPaid')}</b></p><p class="small">${t('pixCode')}</p><div class="code" id="pcode">${esc(id)}</div>
    <div class="row"><button class="btn ghost sm" data-act="copyCode">📋 ${t('copied').replace('!', '')}</button><button class="btn ${cele ? 'ghost' : ''}" data-act="${sup ? 'thanksGo' : 'paidClose'}">${cele ? t('pk_later') : t('close')}</button></div>`);
  if (cele) m.classList.add('celebrate');
  void fresh;
}
S.bought = {
  cls: 'clear', hideHud: true, stage: true, html: () => '',
  after: g => {
    const M3 = VP.R3, Wd = VP.Wardrobe; if (!M3 || !M3.ok || !Wd) return;
    const atk = Wd.setItems(g).find(i => i.slot === 'atk');
    M3.showcase(['mimo', 'mimosa', 'morticia'].map((n, i) => ({ spec: Wd.setSpec(g, n), x: [-1.35, 0, 1.35][i], z: [0.2, 0.6, 0.2][i] })), { sway: true, dist: 9.8, shift: 3.0, lookY: 1.1, fxDemo: atk ? atk.fx : null, demoX: -1.3, demoLen: 2.6 });
  },
};
UI.act.equipNow = el => { const Wd = VP.Wardrobe; Wd.equipSet(el.dataset.g); if (Wd.autoAtk) Wd.autoAtk(el.dataset.g); el.textContent = '✓ ' + t('pk_equipped'); el.disabled = true; UI.confetti(); VP.Audio.sfx('win'); };
UI.act.copyCode = () => { const c = document.getElementById('pcode'); copy(c ? c.textContent : ''); };
UI.act.paidClose = () => { closeModal(); UI.show('shop'); };
UI.act.thanksGo = () => { closeModal(); UI.show('thanks'); };
function copy(text) {
  const ok = () => UI.toast(t('copied'));
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, () => fallback()); return; } } catch (e) { /* fall through */ }
  fallback();
  function fallback() { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); ok(); }
}
UI.act.buy = async el => {
  if (VP.Acct && VP.Acct.minorBlock && VP.Acct.minorBlock()) { UI.toast(t('ac_guardBlock'), 3500); return; }
  const product = el.dataset.p; el.disabled = true;
  let r, j = null;
  try { r = await fetch('/api/pix/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product, name: VP.S.name || '' }) }); j = await r.json().catch(() => null); } catch (e) { r = null; }
  el.disabled = false;
  if (!r || r.status === 503 || r.status === 404) { UI.toast(t('shopOff'), 3000); return; }
  if (!r.ok || !j || !j.id) { UI.toast(t('shopErr'), 3000); return; }
  const label = product.startsWith('apoio') ? t('p_apoio') : t('p_' + product);
  modal(`<h3>${t('pixTitle')}</h3><p><b>${esc(label)}</b> · R$ ${PRICE[product]}</p>
    ${j.qrBase64 ? `<img class="qr" alt="QR Pix" src="data:image/png;base64,${j.qrBase64}">` : ''}
    <p class="small">${t('pixScan')}</p><div class="code" id="pixcode">${esc(j.qr || '')}</div>
    <button class="btn teal" data-act="copyPix">📋 ${t('pixCopy')}</button>
    <div class="wait" id="pixwait"><span class="spin"></span>${t('pixWait')}</div>
    <button class="btn ghost sm" data-act="closeModal">${t('cancel')}</button><p class="legal">${t('legal')}</p>`);
  const t0 = Date.now(); let busy = false;
  const check = async () => {
    if (busy) return; busy = true;
    try {
      const s = await fetch('/api/pix/status?id=' + encodeURIComponent(j.id), { cache: 'no-store' });
      if (s.ok) { const k = await s.json(); if (k.paid) { paid(j.id, k.product || product, k.grants || []); return; } }
    } catch (e) { /* keep waiting */ }
    busy = false;
    if (Date.now() - t0 > 30 * 60e3) { clearInterval(poll); poll = null; const w = document.getElementById('pixwait'); if (w) w.textContent = t('pixExpired'); }
  };
  poll = setInterval(check, 4000);
  Shop._check = check;
};
UI.act.copyPix = () => { const c = document.getElementById('pixcode'); copy(c ? c.textContent : ''); };

// ---------- restore ----------
Shop.restorePrompt = function () {
  modal(`<h3>🔑 ${t('restore')}</h3><p class="small">${t('restoreHint')}</p><input class="txt" id="rcode" inputmode="numeric" placeholder="123456789"><div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="closeModal">${t('cancel')}</button><button class="btn" data-act="restoreGo">OK</button></div>`);
};
UI.act.restore = Shop.restorePrompt;
UI.act.restoreGo = async () => {
  const id = (document.getElementById('rcode').value || '').replace(/\D/g, '');
  if (!id) return;
  try {
    const s = await fetch('/api/pix/status?id=' + id, { cache: 'no-store' });
    if (s.status === 503) { UI.toast(t('shopOff'), 3000); return; }
    const k = s.ok ? await s.json() : null;
    if (k && k.paid) { closeModal(); Shop.apply(id, k.product, k.grants || []); UI.toast(t('restoreOk'), 3000); UI.confetti(); if (UI.screen) UI.relabel(); }
    else UI.toast(t('restoreNo'), 3200);
  } catch (e) { UI.toast(t('shopOff'), 3000); }
};
})();
