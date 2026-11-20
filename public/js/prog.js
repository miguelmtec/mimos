'use strict';
// VICE PAWS — progression and the free-roam activity loop.
//   * XP and levels per cat (earned by playing, never sold), with small stat growth
//   * consumables (ração, ômega 3, sachê, catnip, leite sem lactose) kept in an inventory, found in the world, dropped by missions
//   * an upgrade tree per cat, bought with the coins missions pay
//   * things to do in the city: dog-catcher patrols, fishing spots, the daily "Feira de Petiscos", soft map edges
// Everything lives in VP.S.prog, so it travels with the normal save (localStorage + /api/save). The simulation asks
// VP.Prog.v(key) for a handful of numbers; a fresh save returns the neutral value for every key (the game plays as before).
(function () {
const VP = window.VP, U = VP.U, I = VP.I, T = VP.TILE, Game = VP.Game, M = VP.Missions, World = VP.World;
const P = VP.Prog = {};
const CATS = P.CATS = ['mimo', 'mimosa', 'morticia'];
const t = (...a) => VP.t(...a);
const lang = () => (VP.lang() === 'pt' ? 0 : 1);

Object.assign(VP.L, {
  hood5: ['Calçadão', 'The Boardwalk'], hood6: ['Parque da Lagoa', 'Lagoon Park'], hood7: ['Zona Industrial', 'Industrial Zone'], hood8: ['Morro do Mirante', 'Lookout Hill'],
  pg_lv: ['Nv', 'Lv'], pg_lvup: ['{0} subiu para o nível {1}!', '{0} reached level {1}!'], pg_xp: ['+{0} XP', '+{0} XP'], pg_max: ['MÁX', 'MAX'],
  pg_inv: ['Mochila', 'Backpack'], pg_invSub: ['Itens achados na cidade ou ganhos em missões. Não se vendem por dinheiro de verdade.', 'Items found in the city or earned in missions. Never sold for real money.'],
  pg_use: ['Usar', 'Use'], pg_slot: ['Atalho {0}', 'Slot {0}'], pg_empty: ['Vazio', 'Empty'], pg_full: ['Mochila cheia de {0}', 'Backpack full of {0}'], pg_none: ['Acabou: ache mais pela cidade ou na Feira de Petiscos', 'None left: find more around town or at the Treat Market'],
  pg_noNeed: ['Não precisa agora', 'No need right now'], pg_got: ['{0} guardado na mochila', '{0} stored in the backpack'], pg_hintUse: ['Toque no atalho lá embaixo (ou teclas 4 · 5 · 6) para usar', 'Tap the slot at the bottom (or keys 4 · 5 · 6) to use it'],
  it_racao: ['Ração', 'Kibble'], it_omega: ['Ômega 3', 'Omega 3'], it_sache: ['Sachê', 'Wet food'], it_catnip: ['Catnip', 'Catnip'], it_leite: ['Leite sem lactose', 'Lactose-free milk'],
  id_racao: ['Recupera a energia do Mimo e a barriga da Mortícia', "Restores Mimo's energy and Morticia's belly"], id_omega: ['Pelo brilhante por 20 s: o time leva 35% menos dano', 'Shiny coat for 20 s: the team takes 35% less damage'],
  id_sache: ['Cura boa parte da vida do time', "Heals a good share of the team's health"], id_catnip: ['10 s de velocidade e força extra', '10 s of extra speed and strength'], id_leite: ['Solta das redes, tira o cansaço e protege por 5 s', 'Frees from nets, clears exhaustion and protects for 5 s'],
  fx_racao: ['Barriga cheia, energia total!', 'Full belly, full energy!'], fx_omega: ['PELO BRILHANTE!', 'SHINY COAT!'], fx_sache: ['Sachê para todo mundo!', 'Wet food for everyone!'], fx_leite: ['Ninguém segura esses gatos!', 'Nobody holds these cats!'],
  pg_up: ['Evolução', 'Upgrades'], pg_upSub: ['Compre com as moedas das missões. Cada gato tem duas trilhas.', 'Buy with mission coins. Each cat has two tracks.'], pg_buy: ['Comprar', 'Buy'], pg_owned: ['Ativo', 'Active'],
  pg_needLv: ['Precisa do nível {0}', 'Needs level {0}'], pg_needPrev: ['Compre a anterior primeiro', 'Buy the previous one first'], pg_needCash: ['Faltam {0} moedas', '{0} coins short'], pg_bought: ['{0} ativado!', '{0} unlocked!'],
  pg_stats: ['Bônus do nível', 'Level bonus'],
  up_m_a1: ['Bolhas Duplas', 'Double Bubbles'], up_m_a2: ['Bolhas Triplas', 'Triple Bubbles'], up_m_a3: ['Espinha Afiada', 'Sharp Fishbone'], up_m_b1: ['Café Forte', 'Strong Coffee'], up_m_b2: ['Soneca Profunda', 'Deep Nap'], up_m_b3: ['Bola de Pelo Turbo', 'Turbo Hairball'],
  ud_m_a1: ['Cada tiro solta 2 bolhas', 'Every shot fires 2 bubbles'], ud_m_a2: ['Cada tiro solta 3 bolhas em leque', 'Every shot fires a fan of 3 bubbles'], ud_m_a3: ['+20% de dano do blaster', '+20% blaster damage'],
  ud_m_b1: ['Atirar gasta 25% menos energia', 'Shooting costs 25% less energy'], ud_m_b2: ['Soneca dura +1,5 s e recarrega mais', 'Nap lasts +1.5 s and refills more'], ud_m_b3: ['Bola de pelo recarrega 40% mais rápido', 'Hairball recharges 40% faster'],
  up_s_a1: ['Dentes Afiados', 'Sharp Teeth'], up_s_a2: ['Mordida Giratória', 'Spinning Bite'], up_s_a3: ['Bote Relâmpago', 'Lightning Lunge'], up_s_b1: ['Pelo Grosso', 'Thick Fur'], up_s_b2: ['Rosnado Trovão', 'Thunder Roar'], up_s_b3: ['Sete Vidas', 'Nine Lives'],
  ud_s_a1: ['+15% de dano de mordida', '+15% bite damage'], ud_s_a2: ['A 3ª mordida do combo acerta tudo em volta', 'The 3rd bite of the combo hits all around'], ud_s_a3: ['Bote recarrega 35% mais rápido', 'Lunge recharges 35% faster'],
  ud_s_b1: ['Mimosa leva 12% menos dano', 'Mimosa takes 12% less damage'], ud_s_b2: ['Rosnado alcança +25% e atordoa +1 s', 'Roar reaches +25% and stuns +1 s'], ud_s_b3: ['1 vez por missão, aguenta um golpe que a derrubaria', 'Once per mission, survives a blow that would knock her out'],
  up_c_a1: ['Mão Leve', 'Light Paws'], up_c_a2: ['Bolso Sem Fundo', 'Bottomless Pocket'], up_c_a3: ['Sombra Longa', 'Long Shadow'], up_c_b1: ['Estômago de Avestruz', 'Iron Stomach'], up_c_b2: ['Lanchão Família', 'Family Feast'], up_c_b3: ['Banquete', 'Banquet'],
  ud_c_a1: ['Rouba 20% mais rápido', 'Steals 20% faster'], ud_c_a2: ['+3 de cada item na mochila e +15 moedas por roubo', '+3 of each item in the backpack and +15 coins per steal'], ud_c_a3: ['Fica invisível por +1,5 s', 'Stays invisible +1.5 s'],
  ud_c_b1: ['A fome chega 25% mais devagar', 'Hunger builds 25% slower'], ud_c_b2: ['Lanchão alcança +30%', 'Feast reaches +30%'], ud_c_b3: ['Lanchão dura +2 s', 'Feast lasts +2 s'],
  pg_7lives: ['SETE VIDAS! Mimosa aguentou!', 'NINE LIVES! Mimosa held on!'],
  st_mimo: ['Blaster +{0}% · gasta {1}% menos energia', 'Blaster +{0}% · {1}% less energy used'], st_mimosa: ['Mordida +{0}% · vida +{1}%', 'Bite +{0}% · health +{1}%'], st_morticia: ['Rouba {0}% mais rápido · Lanchão +{1}% de alcance', 'Steals {0}% faster · Feast reach +{1}%'],
  ac_title: ['O que fazer na cidade', 'What to do in town'], ac_btn: ['Atividades', 'Activities'], ac_go: ['Ir', 'Go'], ac_near: ['Perto de você', 'Near you'], ac_open: ['Abrir', 'Open'],
  ac_how: ['Como funciona', 'How it works'], ac_how1: ['Siga um feixe de luz e entre nele para começar uma missão.', 'Follow a light beam and step into it to start a mission.'], ac_how2: ['Missões dão moedas, estrelas, XP e itens.', 'Missions pay coins, stars, XP and items.'],
  ac_how3: ['Com XP os gatos sobem de nível; com moedas você compra melhorias em Evolução.', 'XP levels the cats up; coins buy upgrades in Upgrades.'], ac_how4: ['Entre uma missão e outra: patrulhas, pesca, corridas, patinhas douradas e favores.', 'Between missions: patrols, fishing, races, golden paws and favours.'],
  ac_mission: ['Missão', 'Mission'], ac_race: ['Corrida contra o relógio', 'Time trial'], ac_paw: ['Patinha dourada', 'Golden paw'], ac_pawSub: ['{0} de {1} achadas neste bairro', '{0} of {1} found in this neighbourhood'], ac_npc: ['Favor', 'Favour'],
  ac_fish: ['Ponto de pesca', 'Fishing spot'], ac_fishSub: ['Espere o ❗ e toque em ATACAR', 'Wait for the ❗ and tap ATTACK'], ac_patrol: ['Patrulha da carrocinha', 'Dog-catcher patrol'], ac_patrolSub: ['Derrote a patrulha: moedas, XP e um item', 'Beat the patrol: coins, XP and an item'],
  ac_feira: ['Feira de Petiscos', 'Treat Market'], ac_feiraSub: ['Hoje no {0}: troque moedas por itens', 'Today at {0}: trade coins for items'], ac_shop: ['Loja dos Mimos (só enfeites)', "Mimos' Shop (cosmetics only)"], ac_tour: ['Volta ao Mundo', 'World Tour'], ac_tourSub: ['Viaje para bairros reais', 'Travel to real neighbourhoods'],
  ac_land: ['Cartão-postal', 'Landmark'], ac_guide: ['Seguindo: {0}', 'Heading to: {0}'], ac_arrived: ['Chegou!', 'You made it!'], ac_none: ['Tudo feito por aqui. Que tal viajar?', 'All done around here. How about a trip?'],
  pt_name: ['Patrulha da Carrocinha', 'Dog-Catcher Patrol'], pt_done: ['Patrulha derrotada! +{0} moedas', 'Patrol beaten! +{0} coins'],
  fi_wait: ['🎣 Linha na água… espere o ❗', '🎣 Line in the water… wait for the ❗'], fi_now: ['❗ AGORA! Toque em ATACAR', '❗ NOW! Tap ATTACK'], fi_early: ['Cedo demais! De novo…', 'Too early! Again…'], fi_miss: ['Escapou! De novo…', 'It got away! Again…'],
  fi_got: ['Pescou! +{0} moedas', 'Caught one! +{0} coins'], fi_rest: ['Os peixes sumiram. Volte daqui a pouco.', 'The fish are gone. Come back in a while.'], fi_label: ['Pescar', 'Fish here'],
  fe_title: ['Feira de Petiscos', 'Treat Market'], fe_sub: ['A barraca muda de bairro todo dia. Aqui só entram moedas ganhas no jogo.', 'The stall moves every day. Only coins earned in the game are accepted here.'], fe_left: ['restam {0} hoje', '{0} left today'],
  fe_sold: ['Esgotado hoje', 'Sold out today'], fe_deal: ['Oferta do dia', 'Deal of the day'], fe_buy: ['Comprar', 'Buy'], fe_bought: ['{0} comprado!', '{0} bought!'], fe_wallet: ['Suas moedas', 'Your coins'],
  ed_home: ['Fim do bairro — viajar para outro lugar?', 'End of the neighbourhood — travel somewhere else?'], ed_real: ['Fim do mapa — viajar para outro lugar?', 'End of the map — travel somewhere else?'], ed_go: ['Viajar', 'Travel'],
  ed_next: ['{0} continua por aqui', '{0} carries on this way'], ed_cross: ['Seguir', 'Go on'], ed_load: ['Carregando o próximo trecho…', 'Loading the next stretch…'], ed_n: ['norte', 'north'], ed_s: ['sul', 'south'], ed_e: ['leste', 'east'], ed_w: ['oeste', 'west'],
  rs_next: ['PRÓXIMA MISSÃO', 'NEXT MISSION'], rs_what: ['E agora?', 'What now?'], rs_tip: ['Na cidade, o feixe rosa leva à próxima missão e o botão 📋 mostra o que fazer por perto.', 'In the city the pink beam leads to the next mission and the 📋 button shows what to do nearby.'],
  rs_drop: ['Achado da missão: {0}', 'Mission find: {0}'], rs_xp: ['+{0} XP para os três', '+{0} XP for all three'],
});

// ---------- tables ----------
// consumables: icon (HUD and screens), price at the Feira (coins), cap in the backpack
P.ITEMS = {
  racao: { icon: '🥣', price: 60, col: '#ffb347', w: 5 }, omega: { icon: '🐟', price: 120, col: '#8ff3ff', w: 2 }, sache: { icon: '🥫', price: 150, col: '#ff7ac0', w: 2 },
  catnip: { icon: '🌿', price: 100, col: '#7CFF6B', w: 3 }, leite: { icon: '🥛', price: 80, col: '#ffffff', w: 3 },
};
P.ORDER = ['racao', 'omega', 'sache', 'catnip', 'leite'];
P.MAXLV = 100;
// xp needed to go from level lv to lv + 1 (the story ends around level 25-30; 100 is the long road)
P.need = lv => Math.round(70 + 24 * Math.pow(lv, 1.25));
// stats grow one step per level up to 25 and a quarter step after that: level 100 is a title to show off, not a wall for newcomers
const effL = lv => { const L = lv - 1; return L <= 24 ? L : 24 + (L - 24) * 0.25; };
// tiers: the frame and glow other players see
P.TIERS = [['bronze', 1, '#c98f4b'], ['prata', 20, '#c9ced6'], ['ouro', 40, '#ffd23f'], ['diamante', 60, '#8ff3ff'], ['lenda', 80, '#ff7ac0']];
P.tier = lv => { let r = P.TIERS[0]; for (const x of P.TIERS) if (lv >= x[1]) r = x; return { id: r[0], from: r[1], col: r[2] }; };
// "Poder": levels + upgrades, one number to compare
P.power = () => CATS.reduce((a, n) => a + P.level(n).lv * 10, 0) + Object.keys(P.S().up).length * 25;
// upgrade trees: two tracks (b) of three tiers (t) per cat; eff keys are the numbers the simulation reads through P.v
const MUL = ['boltDmg', 'energyCost', 'biteDmg', 'dashCd', 'roarR', 'stealCd', 'feastR', 'hairCd', 'hunger', 'res_mimo', 'res_mimosa', 'res_morticia', 'hp_mimo', 'hp_mimosa', 'hp_morticia'];
const ADD = ['napT', 'roarStun', 'feastT', 'invisT', 'invCap', 'stealCoins'], SET = ['bolts', 'spin', 'lives7'];
const TIER = [[300, 2], [900, 5], [2200, 9]]; // [cost, cat level] of tiers 1-3
const up = (id, b, tier, eff) => ({ id, b, t: tier, cost: TIER[tier - 1][0], lv: TIER[tier - 1][1], eff });
P.UP = {
  mimo: [up('m_a1', 0, 1, { bolts: 2 }), up('m_a2', 0, 2, { bolts: 3 }), up('m_a3', 0, 3, { boltDmg: 1.2 }), up('m_b1', 1, 1, { energyCost: 0.75 }), up('m_b2', 1, 2, { napT: 1.5 }), up('m_b3', 1, 3, { hairCd: 0.6 })],
  mimosa: [up('s_a1', 0, 1, { biteDmg: 1.15 }), up('s_a2', 0, 2, { spin: 1 }), up('s_a3', 0, 3, { dashCd: 0.65 }), up('s_b1', 1, 1, { res_mimosa: 0.88 }), up('s_b2', 1, 2, { roarR: 1.25, roarStun: 1 }), up('s_b3', 1, 3, { lives7: 1 })],
  morticia: [up('c_a1', 0, 1, { stealCd: 0.8 }), up('c_a2', 0, 2, { invCap: 3, stealCoins: 15 }), up('c_a3', 0, 3, { invisT: 1.5 }), up('c_b1', 1, 1, { hunger: 0.75 }), up('c_b2', 1, 2, { feastR: 1.3 }), up('c_b3', 1, 3, { feastT: 2 })],
};
P.upById = id => { for (const n of CATS) for (const u of P.UP[n]) if (u.id === id) return Object.assign({ cat: n }, u); return null; };

// ---------- save ----------
const fresh = () => ({ xp: { mimo: 0, mimosa: 0, morticia: 0 }, inv: {}, up: {}, quick: ['racao', 'sache', 'catnip'], feira: null, stats: { patrols: 0, fish: 0, used: 0 }, seen: {} });
P.S = function () {
  const s = VP.S; if (!s.prog || typeof s.prog !== 'object') s.prog = fresh();
  const p = s.prog, f = fresh(); for (const k in f) if (p[k] === undefined || p[k] === null && k !== 'feira') p[k] = f[k];
  for (const n of CATS) if (typeof p.xp[n] !== 'number' || !(p.xp[n] >= 0)) p.xp[n] = 0;
  if (!Array.isArray(p.quick) || p.quick.length !== 3) p.quick = f.quick;
  return p;
};
let dirty = false, V = null, vOf = null;
P.touch = () => { dirty = true; };
P.save = () => { dirty = false; VP.persist(); if (VP.onProgress) VP.onProgress(); };

// ---------- levels ----------
P.level = function (name) {
  let xp = P.S().xp[name] || 0, lv = 1;
  while (lv < P.MAXLV && xp >= P.need(lv)) { xp -= P.need(lv); lv++; }
  return { lv, cur: lv >= P.MAXLV ? 0 : Math.round(xp), need: lv >= P.MAXLV ? 0 : P.need(lv), max: lv >= P.MAXLV };
};
P.addXp = function (name, n, G) {
  if (!(n > 0) || !CATS.includes(name)) return 0;
  const s = P.S(), before = P.level(name).lv; s.xp[name] = Math.round(s.xp[name] + n); dirty = true;
  const after = P.level(name).lv;
  if (after > before) {
    V = null;
    if (G && !G.over) {
      const c = G.cats.find(k => k.name === name);
      if (c) { const base = c.base || c.max, m = P.v('hp_' + name), nm = Math.round(base * m); if (!c.down) c.hp = Math.min(nm, c.hp + (nm - c.max) + Math.round(nm * 0.25)); c.max = nm; Game.fx.burst(c.x, c.y - 20, 14, ['#ffd23f', '#fff'], 200, 'star', 8, 0.8); Game.fx.part({ x: c.x, y: c.y - 16, k: 'ring', col: '#ffd23f', size: 18, life: 0.6, grow: 320 }); }
      Game.fx.say('⬆ ' + t('pg_lvup', P.nameOf(name), after), '#ffd23f', 2.8); VP.Audio.sfx('paw');
    }
  }
  return after - before;
};
P.nameOf = name => t(name);
// the level bonus of a cat as two percentages (for the screens)
P.bonus = function (name) { const L = effL(P.level(name).lv); return name === 'mimo' ? [Math.round(L * 1.5), Math.round(Math.min(30, L * 1.2))] : name === 'mimosa' ? [Math.round(L * 1.5), Math.round(L * 2)] : [Math.round(Math.min(30, L * 1.2)), Math.round(L * 1.5)]; };

// ---------- numbers the simulation reads ----------
function calc() {
  const v = {}; for (const k of MUL) v[k] = 1; for (const k of ADD) v[k] = 0; for (const k of SET) v[k] = 0; v.bolts = 1; v.invCap = 9;
  const s = P.S(), L = n => effL(P.level(n).lv);
  v.boltDmg *= 1 + 0.015 * L('mimo'); v.energyCost *= 1 - Math.min(0.3, 0.012 * L('mimo')); v.hp_mimo *= 1 + 0.01 * L('mimo');
  v.biteDmg *= 1 + 0.015 * L('mimosa'); v.hp_mimosa *= 1 + 0.02 * L('mimosa');
  v.stealCd *= 1 - Math.min(0.3, 0.012 * L('morticia')); v.feastR *= 1 + 0.015 * L('morticia'); v.hp_morticia *= 1 + 0.01 * L('morticia');
  for (const n of CATS) for (const u of P.UP[n]) if (s.up[u.id]) for (const k in u.eff) { if (MUL.includes(k)) v[k] *= u.eff[k]; else if (ADD.includes(k)) v[k] += u.eff[k]; else v[k] = Math.max(v[k], u.eff[k]); }
  return v;
}
P.v = function (k) { if (!V || vOf !== VP.S) { V = calc(); vOf = VP.S; } return V[k]; };
P.recalc = () => { V = null; };
P.applyStats = function (G) {
  V = null; G.used7 = false;
  for (const c of G.cats) { c.base = c.max; c.max = Math.round(c.base * P.v('hp_' + c.name)); c.hp = c.max; }
};
// Bolhas Duplas / Triplas: the shot that was just fired becomes a fan
P.shot = function (G, c, ang) {
  const n = P.v('bolts'); if (n <= 1) return;
  const b = G.bullets[G.bullets.length - 1]; if (!b || b.k !== 'bolt') return;
  b.dmg *= n === 2 ? 0.62 : 0.47;
  for (const off of n === 2 ? [0.1] : [-0.13, 0.13]) { const a = ang + off + U.rand(-0.02, 0.02); G.bullets.push(Object.assign({}, b, { vx: Math.cos(a) * 640, vy: Math.sin(a) * 640 })); }
  if (n === 2) { const a = ang - 0.1; b.vx = Math.cos(a) * 640; b.vy = Math.sin(a) * 640; }
};
P.lastStand = function (G, c) {
  if (c.name !== 'mimosa' || !P.v('lives7') || G.used7) return false;
  G.used7 = true; c.hp = Math.round(c.max * 0.3); c.inv = 2; c.flash = 0.3;
  Game.fx.say(t('pg_7lives'), '#ff7ac0', 2.4); Game.fx.burst(c.x, c.y - 16, 14, ['#ff7ac0', '#fff'], 180, 'heart', 8, 0.8); VP.Audio.sfx('revive');
  return true;
};

// ---------- inventory + consumables ----------
P.count = id => P.S().inv[id] || 0;
P.cap = () => P.v('invCap');
P.give = function (id, n) { if (!P.ITEMS[id]) return 0; const s = P.S(), have = s.inv[id] || 0, add = Math.max(0, Math.min(n || 1, P.cap() - have)); s.inv[id] = have + add; if (add) dirty = true; return add; };
const label = id => P.ITEMS[id].icon + ' ' + t('it_' + id);
P.pick = function (G, c, it) {
  const id = it.k.slice(2); if (!P.ITEMS[id]) return true;
  if (!P.give(id, 1)) { if (!(it.fullT > G.real)) { it.fullT = G.real + 2.5; Game.fx.text(it.x, it.y - 24, t('pg_full', t('it_' + id)), '#ffb347', 12); } return false; }
  VP.Audio.sfx('pickup', 0.05); Game.fx.text(it.x, it.y - 24, '+1 ' + label(id), P.ITEMS[id].col, 14); Game.fx.burst(it.x, it.y - 8, 6, P.ITEMS[id].col, 120, 'star', 5, 0.4);
  const s = P.S(); if (!s.seen.inv && !G.tutorial) { s.seen.inv = 1; Game.fx.say(t('pg_got', label(id)) + '. ' + t('pg_hintUse'), '#ffd23f', 4.5); }
  return true;
};
P.use = function (id, G) {
  G = G || Game.G; const it = P.ITEMS[id]; if (!G || G.over || !it) return false;
  const a = G.cats[G.active], say = (k, col) => Game.fx.say(it.icon + ' ' + t(k), col || it.col, 2);
  const flash = k => { if (VP.UI && !VP.UI.screen) Game.fx.text(a.x, a.y - 56, t(k), '#ffb347', 13); else if (VP.UI) VP.UI.toast(t(k)); P.flashT = 0.6; };
  if (!P.count(id)) { flash('pg_none'); return false; }
  const up = G.cats.filter(c => !c.down);
  if (id === 'racao') {
    const mi = G.cats[0], mo = G.cats[2];
    if (!((!mi.down && (mi.energy < 90 || mi.exhausted)) || (!mo.down && mo.belly < 70))) { flash('pg_noNeed'); return false; }
    if (!mi.down) { mi.energy = 100; mi.exhausted = false; } if (!mo.down) { mo.belly = Math.min(100, mo.belly + 45); mo.hungerT = 0; }
    say('fx_racao');
  } else if (id === 'omega') { G.omega = 20; say('fx_omega'); }
  else if (id === 'sache') {
    if (!up.some(c => c.hp < c.max)) { flash('pg_noNeed'); return false; }
    for (const c of up) { const n = Math.round(c.max * 0.45); if (c.hp < c.max) { c.hp = Math.min(c.max, c.hp + n); Game.fx.text(c.x, c.y - 46, '+' + n, '#7CFF6B', 14); Game.fx.part({ x: c.x, y: c.y - 20, k: 'ring', col: '#7CFF6B', size: 10, life: 0.4 }); } }
    say('fx_sache');
  } else if (id === 'catnip') { G.catnip = 10; for (const c of G.cats) c.root = 0; Game.fx.say(t('catnip'), '#7CFF6B', 2); }
  else if (id === 'leite') { for (const c of up) { c.root = 0; c.inv = Math.max(c.inv, 1); if (c.name === 'mimo') { c.exhausted = false; c.energy = Math.max(c.energy, 40); } if (c.hp < c.max) c.hp = Math.min(c.max, c.hp + 12); } G.milkT = 5; say('fx_leite'); }
  const s = P.S(); s.inv[id]--; s.stats.used = (s.stats.used || 0) + 1; dirty = true;
  VP.Audio.sfx(id === 'catnip' ? 'paw' : 'coffee'); Game.fx.burst(a.x, a.y - 20, 10, [it.col, '#fff'], 160, 'star', 6, 0.6); Game.fx.part({ x: a.x, y: a.y - 16, k: 'ring', col: it.col, size: 14, life: 0.5, grow: 260 });
  P.usedT = 0.5; P.usedId = id;
  return true;
};
// weighted random consumable (ração is the common one)
P.roll = function (r) { r = r || Math.random; let tot = 0; for (const id of P.ORDER) tot += P.ITEMS[id].w; let x = r() * tot; for (const id of P.ORDER) { x -= P.ITEMS[id].w; if (x <= 0) return id; } return 'racao'; };

// pick-ups scattered in the world (own random stream: the mission layout does not change)
P.populate = function (G, o) {
  const W = G.W; if (G.m.type === 'tutorial' || (o && o.noItems)) return;
  const r = U.rng((G.id || 0) * 53 + 211 + (G.m.free ? 7 : 0)), n = W.real ? 7 : Math.round(4 * (W.cols * W.rows) / 96);
  for (let i = 0; i < n; i++) { const q = W.randWalk(r); Game.addItem('c_' + P.roll(r), q.x, q.y); }
};
P.onKo = function (G, e) {
  if (G.tutorial) return;
  const st = Game.DOG[e.type] || {}, xp = Math.round((4 + (st.cash || 40) / 3) * (e.isBoss ? 12 : e.elite ? 2.5 : 1)), act = G.cats[G.active].name;
  for (const n of CATS) P.addXp(n, n === act ? xp : Math.ceil(xp * 0.4), G);
  if (Math.random() < (e.isBoss ? 1 : 0.035)) Game.addItem('c_' + P.roll(), e.x, e.y, true);
  if (e.patrol) e.patrol.left--;
};
// mission won: XP for the three cats and a find for the backpack
P.onResult = function (r, G) {
  if (!r.win || r.m.type === 'tutorial') return;
  const lv = Game.eff(r.m.lv || 1), xp = Math.round(30 + r.stars * 22 + lv * 3), ups = [];
  for (const n of CATS) if (P.addXp(n, xp, null)) ups.push(n);
  r.xp = xp; r.rewards.push('✨ ' + t('rs_xp', xp));
  for (const n of ups) r.rewards.push('⬆ ' + t('pg_lvup', P.nameOf(n), P.level(n).lv));
  const rr = U.rng((r.m.n * 7919 + Math.round(G ? G.time * 10 : 1)) >>> 0), drops = [P.roll(rr)]; if (r.stars === 3 || r.m.boss) drops.push(P.roll(rr));
  const got = drops.filter(id => P.give(id, 1)); r.drops = got;
  if (got.length) r.rewards.push('🎒 ' + t('rs_drop', got.map(label).join(' · ')));
  V = null; dirty = false;
};

// ---------- upgrades ----------
P.wallet = function (G) { G = G || Game.G; const S = VP.S; if (G && G.free && !G.over) { S.cash += G.stat.cash - (G.bank || 0); G.bank = G.stat.cash; } return S.cash; };
P.canBuy = function (id) {
  const u = P.upById(id), s = P.S(); if (!u) return 'x';
  if (s.up[id]) return 'owned';
  if (u.t > 1 && !s.up[P.UP[u.cat].find(x => x.b === u.b && x.t === u.t - 1).id]) return 'prev';
  if (P.level(u.cat).lv < u.lv) return 'lv';
  if (P.wallet() < u.cost) return 'cash';
  return 'ok';
};
P.buy = function (id) {
  if (P.canBuy(id) !== 'ok') return false;
  const u = P.upById(id); VP.S.cash -= u.cost; P.S().up[id] = 1; V = null;
  const G = Game.G; if (G && !G.over) for (const c of G.cats) { const nm = Math.round((c.base || c.max) * P.v('hp_' + c.name)); if (nm !== c.max) { c.hp += nm - c.max; c.max = nm; } }
  P.save(); return true;
};

// ---------- free roam: patrols, fishing spots, the daily market ----------
const HOODNAME = d => t(World.hoodKey(d));
P.feiraSpot = function (W, day) {
  const spots = [[5, 'kiosk1'], [6, 'kiosk1'], [8, 'kiosk1'], [6, 'kiosk2'], [7, 'kiosk1'], [5, 'kiosk3']].filter(s => W.roles[s[0]] && W.roles[s[0]][s[1]]);
  if (!spots.length) return null;
  const s = spots[(day === undefined ? M.dayKey() : day) % spots.length], lot = W.roles[s[0]][s[1]], pt = W.front(lot, 's');
  return { x: pt.x, y: pt.y, d: s[0], lot };
};
// today's stall: four of the five items, small price swings, one deal, three of each per day
P.feira = function (day) {
  const key = day === undefined ? M.dayKey() : day, r = U.rng(key * 131 + 7), ids = r.shuffle(P.ORDER.slice()).slice(0, 4), deal = ids[Math.floor(r() * ids.length)];
  const s = P.S(); if (day === undefined && (!s.feira || s.feira.k !== key)) s.feira = { k: key, b: {} };
  return { key, deal, list: ids.map(id => { const base = P.ITEMS[id].price * (0.85 + r() * 0.3) * (id === deal ? 0.7 : 1); return { id, price: Math.max(5, Math.round(base / 5) * 5), limit: 3, deal: id === deal }; }) };
};
P.feiraBuy = function (id) {
  const f = P.feira(), s = P.S(), row = f.list.find(x => x.id === id); if (!row) return 'x';
  const bought = s.feira.b[id] || 0;
  if (bought >= row.limit) return 'sold'; if (P.count(id) >= P.cap()) return 'full'; if (P.wallet() < row.price) return 'cash';
  VP.S.cash -= row.price; s.feira.b[id] = bought + 1; P.give(id, 1); P.save(); return 'ok';
};
function spawnPatrol(G, B, avoid, d) {
  const W = G.W; let q = null;
  for (let i = 0; i < 30 && !q; i++) { const c = d !== undefined && !W.real ? W.randWalkD(d, B.rng) : W.randWalk(B.rng); if (U.d2(c.x, c.y, avoid.x, avoid.y) > 700 * 700 && !G.patrols.some(p => U.d2(p.x, p.y, c.x, c.y) < 600 * 600) && !World.edgeAt(W, c.x, c.y)) q = c; }
  if (!q) return null;
  const lv = G.n, types = ['catcher', lv >= 4 ? 'cop' : 'mutt', lv >= 14 ? 'shooter' : 'mutt'], pat = { x: q.x, y: q.y, left: types.length, dogs: [], d, done: false };
  types.forEach((ty, i) => { const p = Game.nearFree(q.x, q.y, 20 + i * 26, 0) || q, e = Game.addDog(ty, p.x, p.y, { guard: true, aggro: 230, tag: 'patrol', big: i === 0 ? 1.12 : 0 }); e.patrol = pat; e.police = true; if (i === 0) e.label = VP.L.pt_name; pat.dogs.push(e); });
  pat.mk = { x: q.x, y: q.y, k: 'patrol', col: '#ff4f5e', lbl: '🚨 ' + t('pt_name'), thin: true, quiet: true };
  G.markers.push(pat.mk); G.patrols.push(pat);
  return pat;
}
P.freeSetup = function (G, B, sp, opts) {
  opts = opts || {}; const W = G.W;
  G.patrols = []; G.fishSpots = []; G.edge = null; G.guide = null;
  if (opts.trial) return;
  // fishing spots on the piers (home city)
  for (const f of W.fish || []) { const mk = { x: f.x, y: f.y, k: 'fish', col: '#2de2e6', lbl: '🎣 ' + t('fi_label'), thin: true, quiet: true, cool: 0, d: f.d }; mk.act = () => P.fishStart(G, mk); G.markers.push(mk); G.fishSpots.push(mk); }
  // the daily market stall
  if (!W.real) { const f = P.feiraSpot(W); if (f) { const v = Game.addFriend(f.x + 26, f.y - 20, 'farmer'); v.stay = true; v.label = ''; const mk = { x: f.x, y: f.y, k: 'feira', col: '#ffb347', lbl: '🧺 ' + t('fe_title'), d: f.d }; mk.act = () => P.openFeira(); G.markers.push(mk); G.feira = mk; } }
  // dog-catcher patrols: one in each new neighbourhood and two roaming the old ones (none in comunidade maps)
  if (VP.Story) VP.Story.freeSetup(G, B, sp, opts);
  const locked = d => !W.real && G.lockedHoods && G.lockedHoods[d];
  G.markers = G.markers.filter(m => !(m.k === 'fish' && locked(m.d))); G.fishSpots = G.fishSpots.filter(m => !locked(m.d));
  if (!opts.comu && !G.noPolice) { const plan = W.real ? [undefined, undefined] : [5, 6, 7, 8, 1 + Math.floor(B.rng() * 4), 0]; for (const d of plan) if (!locked(d)) spawnPatrol(G, B, sp, d); G.patrolB = B; }
};
function patrolTick(G, dt) {
  for (const p of G.patrols) {
    if (p.done) { p.t -= dt; if (p.t <= 0 && G.patrolB) { G.patrols.splice(G.patrols.indexOf(p), 1); const a = G.cats[G.active]; spawnPatrol(G, G.patrolB, a, p.d); return; } continue; }
    const lead = p.dogs.find(e => !e.dead); if (lead) { p.mk.x = p.x = lead.x; p.mk.y = p.y = lead.y; }
    if (p.left <= 0 || !lead) {
      p.done = true; p.t = 80; const i = G.markers.indexOf(p.mk); if (i >= 0) G.markers.splice(i, 1);
      const coins = 70 + Math.round(G.n * 4); G.stat.cash += coins; for (const n of CATS) P.addXp(n, 30, G);
      Game.addItem('c_' + P.roll(), p.x, p.y, true); P.S().stats.patrols++; dirty = true;
      if (VP.Long && Math.random() < 0.5) { const got = VP.Long.rescue(VP.Long.pick(Math.random, false), 'patrol'); if (got) setTimeout(() => { if (Game.G === G) Game.fx.say('🐱 ' + t('lg_rescued', got.def.name[VP.lang() === 'pt' ? 'pt' : 'en']), '#ffd23f', 3); }, 2600); }
      Game.fx.say('🚨 ' + t('pt_done', coins), '#7CFF6B', 3); VP.Audio.sfx('win'); if (G.guide && G.guide.src === p.mk) G.guide = null;
    }
  }
}
// fishing: step on the spot, wait for the bite, tap attack
P.fishStart = function (G, mk) {
  if (G.car || G.fishing) return;
  if (mk.cool > G.real) { Game.fx.say('🎣 ' + t('fi_rest'), '#bfe9ff', 2.2); return; }
  G.fishing = { mk, phase: 'wait', t: U.rand(1.3, 3.2), n: 0, prev: true };
};
function fishTick(G, dt) {
  const f = G.fishing, a = G.cats[G.active]; if (!f) return;
  if (G.car || U.d2(a.x, a.y, f.mk.x, f.mk.y) > 95 * 95) { G.fishing = null; return; }
  const press = I.attack && !f.prev; f.prev = I.attack; f.t -= dt;
  if (f.msgT > 0) f.msgT -= dt;
  if (f.phase === 'wait') {
    if (press) { f.t = U.rand(1.3, 3); f.msg = 'fi_early'; f.msgT = 1.2; }
    else if (f.t <= 0) { f.phase = 'bite'; f.t = 1.15; VP.Audio.sfx('alarm', 0.2); VP.haptic(30); Game.fx.part({ x: f.mk.x, y: f.mk.y - 40, k: 'txt', txt: '❗', col: '#ffd23f', size: 30, life: 1.1, vy: -12 }); }
  } else if (f.phase === 'bite') {
    if (press) {
      const coins = 20 + Math.floor(Math.random() * 6) * 5; G.stat.cash += coins; f.n++; P.addXp(a.name, 12, G); P.S().stats.fish++; dirty = true;
      Game.fx.say('🐟 ' + t('fi_got', coins), '#7CFF6B', 1.8); VP.Audio.sfx('cash'); Game.fx.burst(f.mk.x, f.mk.y - 10, 10, ['#8ff3ff', '#fff'], 170, 'star', 6, 0.6); Game.fx.part({ x: f.mk.x, y: f.mk.y - 30, k: 'fly', icon: 'treat', tx: a, life: 0.35, size: 13 });
      if (Math.random() < 0.18) { const id = P.roll(); if (P.give(id, 1)) Game.fx.text(a.x, a.y - 60, '+1 ' + label(id), P.ITEMS[id].col, 14); }
      if (f.n >= 3) { f.mk.cool = G.real + 60; G.fishing = null; Game.fx.text(f.mk.x, f.mk.y - 40, t('fi_rest'), '#bfe9ff', 12); return; }
      f.phase = 'wait'; f.t = U.rand(1.3, 3.2); f.msg = null;
    } else if (f.t <= 0) { f.phase = 'wait'; f.t = U.rand(1.3, 3); f.msg = 'fi_miss'; f.msgT = 1.2; }
  }
}
P.fishText = G => { const f = G.fishing; if (!f) return null; return f.phase === 'bite' ? t('fi_now') : f.msgT > 0 && f.msg ? t(f.msg) : t('fi_wait'); };

// ---------- soft edges ----------
// Real cities can ship neighbour tiles (<id>_n, <id>_e, …) listed under `tiles` in data/cities/index.json.
P.tileAt = function (G, side) {
  if (!G.tour || !VP.Tour || !VP.Tour.neighbor) return null;
  return VP.Tour.neighbor(G.tour, side);
};
function edgeTick(G) {
  const a = G.car || G.cats[G.active], side = World.edgeAt(G.W, a.x, a.y);
  if (!side) { G.edge = null; return; }
  if (!G.edge || G.edge.side !== side) {
    G.edge = { side, tile: P.tileAt(G, side) };
    if (!G.edgeSaid || G.edgeSaid < G.real) { G.edgeSaid = G.real + 25; if (!G.edge.tile) Game.fx.say((G.W.real ? '🗺 ' : '🌊 ') + t(G.W.real ? 'ed_real' : 'ed_home'), '#ffd23f', 3.2); }
  }
  // warm the neighbour up while the player walks to the line
  if (G.edge.tile && !G.edge.tile.state && VP.Tour.loadTile) { const tl = G.edge.tile; tl.state = 'loading'; VP.Tour.loadTile(tl.id).then(w => { tl.state = w ? 'ready' : 'missing'; if (!w && G.edge && G.edge.tile === tl) G.edge.tile = null; }); }
}
P.edgeAct = function (G) {
  G = G || Game.G; if (!G || !G.edge) return;
  const tl = G.edge.tile;
  if (tl && tl.state === 'ready') { P.cross(G, G.edge.side, tl); return; }
  if (tl && tl.state === 'loading') { VP.UI.toast(t('ed_load')); return; }
  VP.UI.paused = true; if (VP.Tour) VP.Tour.open(); else VP.UI.show('pause');
};
// walk into the neighbour tile: same spot on the opposite edge
P.cross = function (G, side, tl) {
  const W = G.W, a = G.car || G.cats[G.active], NW = VP.CityCache[tl.id]; if (!NW) return;
  const fx = a.x / W.pw, fy = a.y / W.ph, m = 10 * T;
  const at = side === 'n' ? { x: fx * NW.pw, y: NW.ph - m } : side === 's' ? { x: fx * NW.pw, y: m } : side === 'e' ? { x: m, y: fy * NW.ph } : { x: NW.pw - m, y: fy * NW.ph };
  VP.UI.tourTile(tl.id, at);
};

// ---------- per-frame ----------
let saveT = 0;
P.tick = function (G, dt) {
  if (dirty) { saveT += dt; if (saveT > 6) { saveT = 0; dirty = false; VP.persist(); } }
  if (P.usedT > 0) P.usedT -= dt; if (P.flashT > 0) P.flashT -= dt;
  for (let i = 0; i < 3; i++) if (I.take('q' + i)) P.use(P.S().quick[i], G);
  if (I.take('inv')) { if (VP.UI.act.inv) VP.UI.act.inv(); }
  if (I.take('acts')) { if (VP.UI.act.acts) VP.UI.act.acts(); }
  if (I.take('edge')) P.edgeAct(G);
  if (G.tutorial) return;
  if (G.milkT > 0) { G.milkT -= dt; for (const c of G.cats) c.root = 0; }
  if (G.omega > 0 && Math.random() < dt * 10) { const c = G.cats[(Math.random() * 3) | 0]; if (!c.down && !G.car) Game.fx.part({ x: c.x + U.rand(-12, 12), y: c.y - U.rand(4, 30), k: 'star', col: '#bff4ff', size: 5, life: 0.5, vy: -30 }); }
  { const st = G.stat.stolen, bonus = P.v('stealCoins'); if (G.stolen0 === undefined) G.stolen0 = st; if (st > G.stolen0) { if (bonus) G.stat.cash += bonus * (st - G.stolen0); G.stolen0 = st; } }
  if (!G.free) return;
  if (G.guide) { const a = G.car || G.cats[G.active], g = G.guide; if (g.src) { g.x = g.src.x; g.y = g.src.y; if (g.src.dead || (g.src.k && G.markers.indexOf(g.src) < 0 && !g.src.pid)) G.guide = null; } if (G.guide && U.d2(a.x, a.y, g.x, g.y) < 80 * 80) { G.guide = null; Game.fx.say('✔ ' + t('ac_arrived'), '#7CFF6B', 1.4); } }
  if (G.patrols) patrolTick(G, dt);
  fishTick(G, dt);
  edgeTick(G);
};

// ---------- "what to do": everything on offer, nearest first ----------
P.activities = function (G) {
  G = G || Game.G; if (!G || !G.free) return [];
  const a = G.car || G.cats[G.active], W = G.W, out = [], S = VP.S, dist = o => Math.round(Math.hypot(o.x - a.x, o.y - a.y) / 24);
  const add = (k, icon, title, sub, at, extra) => out.push(Object.assign({ k, icon, title, sub: sub || '', x: at ? at.x : a.x, y: at ? at.y : a.y, m: at ? dist(at) : 0, src: at || null }, extra));
  const nearest = (list, n) => list.slice().sort((p, q) => U.d2(p.x, p.y, a.x, a.y) - U.d2(q.x, q.y, a.x, a.y)).slice(0, n);
  for (const mk of nearest(G.markers.filter(m => m.k === 'mission'), 4)) { const m = M.get(mk.n); if (m) add('mission', m.boss ? '👑' : '▶', VP.mname(m), t('ac_mission') + (m.tourCity ? '' : ' · ' + t('d' + m.d)) + (S.stars[m.n] ? ' · ' + '★'.repeat(S.stars[m.n]) : ''), mk, { n: m.n }); }
  for (const p of nearest((G.patrols || []).filter(p => !p.done), 2)) add('patrol', '🚨', t('ac_patrol'), t('ac_patrolSub'), p.mk);
  if (G.feira) add('feira', '🧺', t('ac_feira'), t('ac_feiraSub', HOODNAME(G.feira.d)), G.feira, { open: 'feira' });
  for (const mk of nearest((G.fishSpots || []).filter(m => !(m.cool > G.real)), 1)) add('fish', '🎣', t('ac_fish'), t('ac_fishSub'), mk);
  for (const mk of nearest(G.markers.filter(m => m.k === 'race'), 1)) add('race', '🏁', mk.label, t('ac_race'), mk, { n: mk.n });
  for (const mk of nearest(G.markers.filter(m => m.k === 'npc'), 2)) add('npc', '💬', mk.label, t('ac_npc') + ' · 🪙 ' + mk.q.reward, mk);
  { const paws = G.items.filter(it => it.k === 'gpaw' && !it.dead); if (paws.length) { const it = nearest(paws, 1)[0], key = it.pid.split('_')[0], per = W.real ? 5 : (M.act.pawsPerDistrict || 5); let n = 0; for (const k in S.paws || {}) if (k.split('_')[0] === key) n++; add('paw', '🐾', t('ac_paw'), t('ac_pawSub', n, per), it); } }
  if (G.tour && W.landmarks) { const seen = (S.tour && S.tour[G.tour] && S.tour[G.tour].seen) || {}, left = W.landmarks.filter(l => !seen[l.name]).map(l => ({ x: l.gx, y: l.gy, name: l.name })); for (const l of nearest(left, 2)) add('land', '📸', l.name, t('ac_land') + ' · 🪙 20', l); }
  out.sort((p, q) => (p.k === 'mission' ? 0 : 1) - (q.k === 'mission' ? 0 : 1) || p.m - q.m);
  add('tour', '✈', t('ac_tour'), t('ac_tourSub'), null, { open: 'world' });
  return out;
};
P.guideTo = function (G, act) { G.guide = { x: act.x, y: act.y, label: act.title, src: act.src }; };
// best mission to offer after a win
P.nextMission = function (m) {
  const S = VP.S, open = x => M.unlocked(x) && !S.stars[x.n];
  if (m && m.tourCity) { const l = M.tourList.filter(x => x.tourCity === m.tourCity); return l.find(x => x.n > m.n && open(x)) || l.find(open) || null; }
  const same = m ? M.list.filter(x => x.d === m.d) : [];
  return same.find(x => x.n > m.n && open(x)) || M.list.find(x => !x.bonus && open(x)) || same.find(open) || M.list.find(open) || null;
};
})();
