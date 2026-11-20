'use strict';
// VICE PAWS — player identity ("Jogar com meu gato"): the player's own cat takes one of the three roles
// (atirador / mordedor / comilão) and up to two companion presets fill the others. Guests and the owner keep the three stars.
// The simulation still knows the slots as mimo / mimosa / morticia (the roles); only the looks and the names change.
(function () {
const VP = window.VP, UI = VP.UI, ACT = UI.act, SC = UI.SCREENS, t = (...a) => VP.t(...a);
const Pa = VP.Party = { thumbs: {}, imgs: {} };
const SLOTS = Pa.SLOTS = ['mimo', 'mimosa', 'morticia'], ROLE = Pa.ROLE = { mimo: 'shooter', mimosa: 'biter', morticia: 'glutton' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
Object.assign(VP.L, {
  pa_title: ['Jogar com meu gato', 'Play as my cat'], pa_sub: ['Seu gato entra no time no papel que você escolher. Os outros dois lugares ficam com companheiros.', 'Your cat joins the team in the role you pick. Companions take the other two spots.'],
  pa_on: ['Jogando com {0}', 'Playing as {0}'], pa_off: ['Jogar com o trio original', 'Play with the original trio'], pa_use: ['Jogar com {0}', 'Play as {0}'], pa_none: ['Crie seu gato primeiro', 'Create your cat first'],
  pa_role: ['Papel do seu gato', "Your cat's role"], pa_comp: ['Companheiros', 'Companions'], pa_star: ['Estrela', 'Star'],
  role_shooter: ['Atirador', 'Shooter'], role_biter: ['Mordedor', 'Biter'], role_glutton: ['Comilão', 'Glutton'],
  rd_shooter: ['Atira bolhas de longe e tira a SONECA (como o Mimo)', 'Shoots bubbles from afar and takes the NAP (like Mimo)'], rd_biter: ['Morde em combo, aguenta pancada e ROSNA (como a Mimosa)', 'Bite combos, tanks hits and ROARS (like Mimosa)'], rd_glutton: ['Rouba, come, passa por portinhas e faz o LANCHÃO (como a Mortícia)', 'Steals, eats, fits through cat flaps and FEASTS (like Morticia)'],
  cp_laranja: ['Laranjinha', 'Ginger'], cp_frajola: ['Frajola', 'Tuxedo'], cp_siames: ['Siamês', 'Siamese'], cp_preto: ['Pretinho', 'Blackie'], cp_branco: ['Floquinho', 'Snowball'], cp_cinza: ['Cinzento', 'Smokey'],
});
// companion presets (looks only)
Pa.PRESETS = {
  laranja: { size: 0.95, fur: '#f6a94a', fur2: '#fff3df', pattern: 'tabby', patchA: '#d9822b', eye: '#7bd88f', earIn: '#f4a9b8', face: 'round', fluff: 0.5, acc: { collar: '#2de2e6' } },
  frajola: { size: 0.95, fur: '#2b2b33', fur2: '#ffffff', pattern: 'tuxedo', eye: '#ffd23f', earIn: '#f4a9b8', face: 'round', fluff: 0.4, acc: { bowtie: '#e01e37' } },
  siames: { size: 0.9, fur: '#f2e6d0', fur2: '#fff7ea', pattern: 'points', patchA: '#5a4030', eye: '#3fa9f5', earIn: '#c9a090', face: 'round', headShape: 'wedge', fluff: 0.2, ears: 'big', acc: { collar: '#ff4fb8' } },
  preto: { size: 0.9, fur: '#1f1c24', fur2: '#2f2b36', pattern: 'solid', eye: '#7CFF6B', earIn: '#6a4a5a', face: 'round', fluff: 0.5, acc: { scarf: '#ffd23f' } },
  branco: { size: 1, fur: '#ffffff', fur2: '#ffffff', pattern: 'solid', eye: '#6fc3ff', eye2: '#ffd23f', earIn: '#f4a9b8', face: 'round', fluff: 1.2, tail: 'fluffy', acc: { bow: '#2de2e6' } },
  cinza: { size: 1.05, fur: '#8f97a3', fur2: '#c9ced6', pattern: 'tabby', patchA: '#6b727d', eye: '#f2b01e', earIn: '#f4a9b8', face: 'round', headShape: 'square', fluff: 0.7, acc: { collar: '#e01e37', bell: '#ffd23f' } },
};
const S = () => { const s = VP.S; if (!s.party || typeof s.party !== 'object') s.party = { on: false, role: 'mimo', comp: {} }; if (!s.party.comp) s.party.comp = {}; if (!SLOTS.includes(s.party.role)) s.party.role = 'mimo'; return s.party; };
Pa.S = S;
Pa.active = () => !!(S().on && VP.S.avatar);
Pa.slotOf = () => (Pa.active() ? S().role : null);
// what a slot looks like: null = the star itself (wardrobe and all)
Pa.specFor = function (name) {
  const p = S();
  if (Pa.active() && name === p.role) { const sp = Object.assign({}, VP.S.avatar, { acc: Object.assign({}, VP.S.avatar.acc) }); if (name === 'mimo') sp.tool = 'blaster'; if (name === 'morticia') sp.tongue = 1; if (name === 'mimosa') sp.brows = 1; return sp; }
  if (Pa.active() && p.comp[name] && Pa.PRESETS[p.comp[name]]) return Pa.PRESETS[p.comp[name]];
  return null;
};
const ORIG = {}; for (const n of SLOTS) ORIG[n] = VP.L[n].slice();
Pa.nameFor = function (name) { const p = S(); if (Pa.active() && name === p.role) return VP.S.avatar.label || t('gc_mine'); if (Pa.active() && p.comp[name] && Pa.PRESETS[p.comp[name]]) return t('cp_' + p.comp[name]); return null; };
// names and portraits follow the party (the sim prints VP.t('mimo') etc.)
Pa.apply = function () {
  for (const n of SLOTS) { const nm = Pa.nameFor(n); VP.L[n] = nm ? [nm, nm] : ORIG[n].slice(); }
  Pa.thumbs = {}; Pa.imgs = {};
  if (VP.R3 && VP.R3.refreshCats) VP.R3.refreshCats();
};
function thumb(name) {
  const sp = Pa.specFor(name); if (!sp) return null;
  if (Pa.thumbs[name] !== undefined) return Pa.thumbs[name];
  const R3 = VP.R3; if (!R3 || !R3.ok || !R3.snapshot) return null;
  try { const cv = R3.snapshot([{ spec: sp, s: 1.3 }], 160, 160); Pa.thumbs[name] = cv ? cv.toDataURL('image/jpeg', 0.85) : ''; } catch (e) { Pa.thumbs[name] = ''; }
  if (Pa.thumbs[name]) { const im = new Image(); im.src = Pa.thumbs[name]; Pa.imgs[name] = im; }
  return Pa.thumbs[name];
}
Pa.portrait = name => thumb(name) || null;                       // data URL for HTML screens
Pa.image = name => { if (!Pa.specFor(name)) return null; thumb(name); const im = Pa.imgs[name]; return im && im.complete && im.naturalWidth ? im : null; }; // <img> for the HUD canvas
Pa.custom = name => !!Pa.specFor(name);
Pa.set = function (on, role) { const p = S(); p.on = !!on && !!VP.S.avatar; if (role && SLOTS.includes(role)) p.role = role; for (const n of SLOTS) if (n === p.role) delete p.comp[n]; VP.persist(); Pa.apply(); if (VP.onProgress) VP.onProgress(); };
Pa.setComp = function (slot, id) { const p = S(); if (id && Pa.PRESETS[id]) p.comp[slot] = id; else delete p.comp[slot]; VP.persist(); Pa.apply(); };
// the role chosen in the creator travels with the cat
Pa.roleSlot = role => SLOTS.find(n => ROLE[n] === role) || 'mimo';

SC.party = {
  cls: 'glass', hideHud: true,
  html: () => {
    const p = S(), has = !!VP.S.avatar, nm = has ? esc(VP.S.avatar.label || t('gc_mine')) : '';
    const img = n => { const u = Pa.portrait(n) || VP.Assets.get('portrait_' + n); return u ? `<img src="${u}" alt="">` : '<span class="ph">🐱</span>'; };
    return `<div class="corner l"><button class="chip" data-act="paBack">‹ ${t('back')}</button></div><div class="wrap narrow" style="margin-top:46px"><h2 class="teal">🐱 ${t('pa_title')}</h2><p class="small">${t('pa_sub')}</p>
      ${has ? `<div class="grid2"><button class="btn ${p.on ? '' : 'ghost'} sm" data-act="paOn">${p.on ? '✓ ' : ''}${t('pa_use', nm)}</button><button class="btn ${p.on ? 'ghost' : ''} sm" data-act="paOff">${p.on ? '' : '✓ '}${t('pa_off')}</button></div>
      <h3>${t('pa_role')}</h3><div class="pg-cats">${SLOTS.map(n => `<button class="${p.role === n ? 'on' : ''}" style="--c:#ffd23f" data-act="paRole" data-n="${n}"><span style="font-size:26px">${{ mimo: '🫧', mimosa: '🦷', morticia: '🍖' }[n]}</span><span>${t('role_' + ROLE[n])}</span><span class="small" style="font-weight:600;line-height:1.2">${t('rd_' + ROLE[n])}</span></button>`).join('')}</div>
      ${p.on ? `<h3>${t('pa_comp')}</h3>${SLOTS.filter(n => n !== p.role).map(n => `<div class="panel t" style="padding:8px 10px"><b>${t('role_' + ROLE[n])}</b><div class="row" style="margin-top:6px"><button class="tab ${!p.comp[n] ? 'on' : ''}" data-act="paComp" data-s="${n}" data-id="">⭐ ${esc(ORIG[n][VP.lang() === 'pt' ? 0 : 1])}</button>${Object.keys(Pa.PRESETS).map(id => `<button class="tab ${p.comp[n] === id ? 'on' : ''}" data-act="paComp" data-s="${n}" data-id="${id}">${t('cp_' + id)}</button>`).join('')}</div></div>`).join('')}
      <div class="pg-cats">${SLOTS.map(n => `<button style="--c:#2de2e6;cursor:default">${img(n)}<span>${esc(t(n))}</span><span class="small">${t('role_' + ROLE[n])}</span></button>`).join('')}</div>` : ''}`
      : `<div class="panel t"><p>${t('pa_none')}</p></div><button class="btn" data-act="creator" data-i="${VP.Acct && VP.Acct.status === 'in' ? 'new' : 'local'}">🐱 ${t('ac_create')}</button>`}
      <button class="btn ${has && p.on ? 'big' : 'ghost'}" data-act="play">▶ ${t('play')}</button></div>`;
  },
};
ACT.party = () => UI.show('party');
ACT.paBack = () => UI.show(VP.Acct && VP.Acct.status === 'in' ? 'account' : 'title');
ACT.paOn = () => { Pa.set(true); UI.show('party'); };
ACT.paOff = () => { Pa.set(false); UI.show('party'); };
ACT.paRole = el => { Pa.set(true, el.dataset.n); UI.show('party'); };
ACT.paComp = el => { Pa.setComp(el.dataset.s, el.dataset.id); UI.show('party'); };
// title: first-launch card, now a small dismissible pill above the play button (the cat buttons live in the "Meu Gato" sheet)
{ const s = SC.title, h0 = s.html; s.html = a => {
    let html = h0(a); const has = !!VP.S.avatar, seen = VP.S.prog && VP.S.prog.seen && VP.S.prog.seen.creator;
    const card = !has && !seen ? `<div class="pg-card tl-pill"><button class="pl-go" data-act="myCat"><span class="em">🐱</span><span class="tx"><b>${t('cr_card')}</b></span><span class="go">${t('cr_cardGo')}</span></button><button class="pl-x" data-act="cardNo" aria-label="x">✕</button></div>` : '';
    return html.replace('<!--vp:toast-->', card);
  }; }
ACT.myCat = () => { if (VP.Prog) { VP.Prog.S().seen.creator = 1; VP.persist(); } ACT.creator({ dataset: { i: VP.Acct && VP.Acct.status === 'in' ? (VP.Acct.cats.length ? '0' : 'new') : 'local' } }); };
ACT.cardNo = () => { if (VP.Prog) { VP.Prog.S().seen.creator = 1; VP.persist(); } UI.relabel(); };
if (VP.S.party && VP.S.party.on) Pa.apply();
})();
