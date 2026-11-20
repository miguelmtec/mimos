// Authoring helper for public/data/citypacks.json (city mission packs) and public/data/events.json (weekly events).
// Usage: node tools/gen-packs.mjs      The JSON files are what the game reads; edit here and re-run, or edit the JSON directly.
// mission: [kind, name pt, name en, story pt, story en, params?, at? (landmark / place names of that city), needs? (tags)]
import fs from 'node:fs';
const M = (kind, pt, en, spt, sen, params, at, needs) => Object.assign({ kind, name: { pt, en }, story: { pt: spt, en: sen } }, kind === 'photo' ? { par: 280 } : {}, params ? { params } : {}, at ? { at } : {}, needs ? { needs } : {});
const templates = [
  M('race', 'Rali dos Cartões-Postais', 'Postcard Rally', 'Cinco pontos turísticos, um conversível e nenhum mapa. O Mimo dirige (acordado, por enquanto).', 'Five sights, one convertible and no map. Mimo is driving (awake, for now).'),
  M('photo', 'Turistas de Primeira Viagem', 'First-Time Tourists', 'A Mimosa quer foto em tudo que é lugar famoso. A pé, que é pra aparecer no fundo.', 'Mimosa wants a photo at every famous spot. On foot, so the background shows.', { n: 4 }),
  M('deliver', 'Entrega Especial', 'Special Delivery', 'Um petisco importado precisa chegar inteiro. A Mortícia jurou que não vai abrir.', 'An imported treat must arrive in one piece. Morticia swore she will not open it.'),
  M('feast', 'Banquete de Rua', 'Street Feast', 'Cidade nova, comida nova. A Mortícia vai provar tudo antes do relógio zerar.', 'New city, new food. Morticia will taste everything before the clock hits zero.', { n: 22 }),
  M('chain', 'Motoboy Internacional', 'International Courier', 'Busca aqui, entrega ali. Cada entrega certa dá mais tempo.', 'Pick up here, drop off there. Every good delivery adds time.', { n: 4, car: 1 }),
  M('kites', 'Pipas no Céu Novo', 'Kites in a New Sky', 'O vento daqui é diferente. As pipas também caem diferente.', 'The wind is different here. So is the way kites fall.', { n: 8 }),
  M('parkour', 'Corrida de Rua', 'Street Run', 'Checkpoints a pé pelas ruas de verdade. Sem carro!', 'Checkpoints on foot through real streets. No cars!', { n: 5 }),
  M('brawl', 'Briga na Praça', 'Plaza Brawl', 'Os vira-latas locais não gostaram dos turistas. A Mimosa não gostou dos vira-latas.', 'The local mutts did not like the tourists. Mimosa did not like the mutts.'),
  M('rescue', 'Gatinho Perdido', 'Lost Kitten', 'Um filhote miou lá longe. Ninguém fica pra trás, em país nenhum.', 'A kitten meowed far away. No cat left behind, in any country.'),
  M('escape', 'Fuga Turística', 'Tourist Getaway', 'A carrocinha daqui também não gosta de gato. Aguente firme e suma do mapa.', 'The local dog catchers do not like cats either. Hold on, then vanish.'),
];
const comunidade = [
  M('groceries', 'As Compras da Vovó', "Grandma's Groceries", 'A vovó gata mora lá no alto e as sacolas pesam. Suba com ela, no ritmo dela.', 'Grandma cat lives up the hill and the bags are heavy. Walk up with her, at her pace.'),
  M('paws', 'Patinhas na Escadaria', 'Paws on the Stairway', 'Alguém espalhou patinhas douradas pelos becos e escadarias. Vale conhecer cada cantinho.', 'Someone scattered golden paws through the alleys and stairways. Worth getting to know every corner.', { n: 12 }),
  M('kites', 'Concurso de Pipas', 'Kite Contest', 'O céu do morro é o mais colorido da cidade. Pegue as pipas que o vento trouxer!', 'The sky over the hill is the most colourful in town. Catch the kites the wind brings!', { n: 9 }),
  M('rescue', 'Gatinho no Telhado', 'Kitten on the Roof', 'Um filhote subiu atrás de uma pipa e não sabe descer. Suba até lá e traga ele pra casa.', 'A kitten climbed after a kite and can not get down. Go up there and bring it home.'),
  M('football', 'Altinha na Laje', 'Rooftop Keepie-Uppie', 'A molecada chamou pra altinha na laje, com vista pro mar. A bola não pode cair!', 'The kids invited you for keepie-uppie on the rooftop, with an ocean view. Do not let the ball drop!', { n: 8 }),
  M('photo', 'Rota dos Murais', 'Mural Route', 'Os muros daqui são uma galeria a céu aberto. Fotografe os mais bonitos.', 'The walls here are an open-air gallery. Photograph the prettiest ones.', { n: 4 }),
  M('chain', 'Entregas Morro Acima', 'Deliveries Up the Hill', 'Pão quentinho, gás e encomenda: tudo sobe pela escadaria, de pata em pata.', 'Warm bread, parcels and more: everything goes up the stairway, paw by paw.', { n: 4 }),
  M('parkour', 'Subida do Mirante', 'Climb to the Lookout', 'Corrida a pé até o ponto mais alto. A vista lá de cima compensa cada degrau.', 'A run on foot to the highest spot. The view up there is worth every step.', { n: 5 }),
  M('treats', 'Lanche da Tarde', 'Afternoon Snack', 'As tias da comunidade deixaram petiscos pra visita. A Mortícia agradece em nome de todos.', 'The neighbours left treats out for the visitors. Morticia says thanks on behalf of everyone.', { n: 20 }),
  M('deliver', 'Bolo de Aniversário', 'Birthday Cake', 'Tem festa na laje hoje! Leve o bolo inteiro até lá (Mortícia, estamos de olho).', 'There is a rooftop party today! Deliver the cake in one piece (Morticia, we are watching).'),
];
const packs = {
  miami: {
    places: [['Lummus Park', 25.7806, -80.1301], ['Ocean Drive', 25.7786, -80.1306], ['Collins Avenue', 25.7790, -80.1322]],
    missions: [
      M('race', 'Rali da Ocean Drive', 'Ocean Drive Rally', 'Do Art Deco Welcome Center ao letreiro de Miami Beach, passando pelos hotéis mais famosos.', 'From the Art Deco Welcome Center to the Miami Beach sign, past the most famous hotels.', null, ['Art Deco Welcome Center', 'The Carlyle', 'Hotel Victor', 'The Colony Hotel', 'Miami Beach Sign']),
      M('photo', 'Safári Art Déco', 'Art Deco Safari', 'Fachadas em tons pastel pedem foto. A Mimosa exige o Carlyle e a Casa Casuarina.', 'Pastel facades are begging for photos. Mimosa demands the Carlyle and Casa Casuarina.', { n: 4 }, ['The Carlyle', 'Cardozo Hotel South Beach', 'Leslie Hotel', 'The Villa Casa Casuarina']),
      M('volley', 'Vôlei em Lummus Park', 'Lummus Park Volleyball', 'Quadra de areia de frente pro Atlântico. Oito pontos pra virar lenda de South Beach.', 'A sand court facing the Atlantic. Eight points to become a South Beach legend.', { n: 8 }, null, ['beach']),
      M('chain', 'Serviço de Quarto', 'Room Service', 'Os hóspedes do Pelican, do Avalon, do Beacon e do Park Central pediram sachê. Todos ao mesmo tempo.', 'Guests at the Pelican, the Avalon, the Beacon and the Park Central ordered treats. All at once.', { n: 4 }, ['Pelican Hotel', 'Avalon Hotel', 'Beacon Hotel', 'Park Central Hotel']),
      M('feast', 'Brunch em South Beach', 'South Beach Brunch', 'Brunch de hotel chique espalhado pela calçada. A Mortícia não fez reserva.', 'A fancy hotel brunch spread along the sidewalk. Morticia has no reservation.', { n: 24 }),
      M('kites', 'Pipas sobre o Atlântico', 'Kites over the Atlantic', 'A brisa do mar empurra as pipas pra cidade. Corra atrás delas!', 'The sea breeze pushes the kites into town. Chase them!', { n: 9 }),
      M('deliver', 'Encomenda para o Wolfsonian', 'Parcel for the Wolfsonian', 'O museu encomendou uma estátua de gato. Frágil. Muito frágil.', 'The museum ordered a cat statue. Fragile. Very fragile.', null, ['The Wolfsonian - FIU']),
      M('parkour', 'Corrida na Collins', 'Collins Avenue Dash', 'Checkpoints a pé entre os neons da Collins Avenue. O café ajuda o Mimo.', 'Checkpoints on foot among the neon signs of Collins Avenue. Coffee helps Mimo.', { n: 6 }),
      M('brawl', 'Confusão no Breakwater', 'Breakwater Brawl', 'Uns buldogues de óculos escuros tomaram a calçada do Breakwater. Hora de devolver pros turistas.', 'Some bulldogs in shades took over the Breakwater sidewalk. Time to give it back to the tourists.', null, ['Hotel Breakwater South Beach']),
      M('escape', 'Fuga de South Beach', 'South Beach Getaway', 'A carrocinha de Miami tem até lancha. Aguente e desapareça em South Beach.', 'The Miami dog catchers even have a speedboat. Hold out, then disappear into South Beach.', null, ['South Beach']),
    ],
  },
  rio: {
    places: [['Copacabana Palace', -22.9670, -43.1787], ['Praça Serzedelo Correia', -22.9689, -43.1853], ['Estação Siqueira Campos', -22.9670, -43.1868], ['Bairro Peixoto', -22.9655, -43.1893], ['Calçadão de Copacabana', -22.9712, -43.1830]],
    missions: [
      M('race', 'Rali da Avenida Atlântica', 'Avenida Atlântica Rally', 'Do Posto 3 ao Posto 4, com parada no 18 do Forte e no Copacabana Palace. Sem buzinar pro calçadão!', 'From Posto 3 to Posto 4, with stops at the 18 do Forte monument and the Copacabana Palace. No honking at the boardwalk!', null, ['Posto 3', '18 do Forte', 'Posto 4', 'Copacabana Palace', 'Ayrton Senna']),
      M('volley', 'Vôlei no Posto 4', 'Volleyball at Posto 4', 'Rede armada na areia de Copacabana. A Mimosa não aceita menos que oito pontos.', 'The net is up on Copacabana sand. Mimosa accepts no less than eight points.', { n: 8 }, null, ['beach']),
      M('photo', 'Cartões-Postais de Copa', 'Copacabana Postcards', 'O Palace, a estátua do Ayrton Senna, o 18 do Forte e o Posto 3: o álbum da viagem começa aqui.', 'The Palace, the Ayrton Senna statue, 18 do Forte and Posto 3: the travel album starts here.', { n: 4 }, ['Copacabana Palace', 'Ayrton Senna', '18 do Forte', 'Posto 3']),
      M('football', 'Altinha no Posto 3', 'Keepie-Uppie at Posto 3', 'Na beira do mar ninguém deixa a bola cair. Nem gato.', 'By the sea nobody lets the ball drop. Not even cats.', { n: 9 }, null, ['beach']),
      M('chain', 'Mate e Biscoito de Polvilho', 'Iced Tea and Crunchy Biscuits', 'O lanche oficial da praia precisa chegar em toda barraca. Busque na praça e leve até a areia.', 'The official beach snack must reach every tent. Pick up at the square and take it to the sand.', { n: 4 }, ['Praça Serzedelo Correia', 'Posto 3', 'Estação Siqueira Campos', 'Posto 4']),
      M('kites', 'Pipas na Orla', 'Kites on the Shore', 'Fim de tarde, vento do mar e o céu cheio de pipa. Pegue as que o vento soltar.', 'Late afternoon, sea wind and a sky full of kites. Catch the ones the wind sets loose.', { n: 9 }),
      M('deliver', 'Bilhete do Trem do Corcovado', 'Corcovado Train Ticket', 'A vovó gata quer ver o Cristo de perto. Leve o bilhete até a bilheteria antes que feche.', 'Grandma cat wants to see the Christ statue up close. Get her ticket to the ticket office before it closes.', null, ['Ticket Office Trem de Corcovado']),
      M('feast', 'Quiosques do Calçadão', 'Boardwalk Kiosks', 'Água de coco, queijo coalho e camarão: a Mortícia vai de quiosque em quiosque.', 'Coconut water, grilled cheese and shrimp: Morticia goes from kiosk to kiosk.', { n: 24 }),
      M('parkour', 'Subida do Bairro Peixoto', 'Bairro Peixoto Climb', 'Copacabana também tem ladeira! Corrida a pé morro acima, com vista pro mar na chegada.', 'Copacabana has hills too! A run on foot uphill, with an ocean view at the finish.', { n: 5 }, ['Bairro Peixoto']),
      M('escape', 'Fuga pela Siqueira Campos', 'Siqueira Campos Getaway', 'A carrocinha fechou a orla. Aguente firme e despiste pela estação Siqueira Campos.', 'The dog catchers closed off the shore. Hold out and lose them by Siqueira Campos station.', null, ['Estação Siqueira Campos']),
    ],
  },
  rio_vidigal: { places: [['Praia do Vidigal', -22.9931, -43.2331], ['Mirante do Leblon', -22.9893, -43.2279]], missions: [] },
  rio_santamarta: { places: [['Laje do Michael Jackson', -22.9492, -43.1947], ['Plano Inclinado', -22.9483, -43.1931]], missions: [] },
  // Rio Verde (GO), the owner's hometown: "capital do agronegócio" flavour, all friendly missions, pickup trucks
  rioverde: {
    places: [],
    missions: [
      M('race', 'Rali das Caminhonetes', 'Pickup Truck Rally', 'Na capital do agro, corrida boa é de caminhonete. Cinco pontos da cidade, poeira e sertanejo no rádio.', 'In the farming capital, a proper race is a pickup race. Five spots around town, dust and country music on the radio.', { car: 2 }),
      M('chain', 'Ração para a Feira', 'Feed for the Fair', 'A feira agropecuária abre hoje e falta ração. Carregue a caçamba e entregue nos estandes.', 'The livestock fair opens today and feed is short. Load the truck bed and deliver to the stands.', { n: 4, car: 2 }),
      M('photo', 'Fotos na Exposição', 'Photos at the Fair', 'Tem gado premiado, trator brilhando e barraca de pamonha. A Mimosa quer foto com tudo.', 'Prize cattle, shiny tractors and a corn-cake stall. Mimosa wants a photo with everything.', { n: 4 }),
      M('feast', 'Pamonha, Pequi e Churrasco', 'Corn Cakes and Barbecue', 'Comida goiana de verdade. A Mortícia nunca foi tão feliz (cuidado com o caroço do pequi!).', 'Real Goiás food. Morticia has never been happier (mind the pequi stone!).', { n: 24 }),
      M('groceries', 'A Feira da Vovó', "Grandma's Market Run", 'A vovó gata comprou queijo, doce de leite e mais um tanto. Acompanhe ela até em casa.', 'Grandma cat bought cheese, milk caramel and a whole lot more. Walk her home.'),
      M('kites', 'Pipas no Cerrado', 'Kites over the Cerrado', 'Céu aberto do cerrado e vento bom. Dia perfeito pra soltar pipa.', 'Wide open savanna sky and a good wind. A perfect day for kites.', { n: 9 }),
      M('paws', 'Patinhas na Praça', 'Paws in the Square', 'Espalharam patinhas douradas pelo centro. Quem conhece a cidade acha todas.', 'Golden paws are scattered across the town centre. Those who know the town will find them all.', { n: 12 }),
      M('parkour', 'Corrida do Boiadeiro', "The Cowboy's Dash", 'Corrida a pé de checkpoint em checkpoint. O prêmio é um chapéu (e muito orgulho).', 'A run on foot from checkpoint to checkpoint. The prize is a hat (and a lot of pride).', { n: 6 }),
      M('rescue', 'Gatinho no Silo', 'Kitten on the Silo', 'Um filhote subiu no ponto mais alto pra ver a plantação e travou. Bora buscar.', 'A kitten climbed the highest spot to see the fields and froze. Let us fetch it.'),
      M('deliver', 'Encomenda da Fazenda', 'Parcel from the Farm', 'Queijo fresco da fazenda pro centro da cidade. Chega inteiro se a Mortícia colaborar.', 'Fresh farm cheese for the town centre. It arrives whole if Morticia cooperates.'),
    ],
  },
};
fs.writeFileSync(new URL('../public/data/citypacks.json', import.meta.url), JSON.stringify({ version: 1, note: 'City mission packs. places = [name, lat, lon] (approximate, snapped to the nearest street). Maps tagged comunidade only ever get the positive kinds.', templates, comunidade, packs }, null, 1));
const E = (id, icon, pt, en, dpt, den, types, extra) => Object.assign({ id, icon, name: { pt, en }, desc: { pt: dpt, en: den }, types, mult: 1.5 }, extra || {});
const events = [
  E('kites', '🪁', 'Semana da Pipa', 'Kite Week', 'Missões de pipa e de corrida a pé rendem +50% de moedas.', 'Kite and foot-race missions pay +50% coins.', ['kites', 'parkour', 'kiterun']),
  E('fishing', '🎣', 'Semana do Pescador', "Fisher's Week", 'Pescarias e missões de comilança rendem +50% de moedas.', 'Fishing and eating missions pay +50% coins.', ['fish', 'eat', 'feast', 'treats']),
  E('rescue', '🐱', 'Semana do Resgate', 'Rescue Week', 'Resgates, gatinhos e escoltas rendem +50% de moedas.', 'Rescues, kittens and escorts pay +50% coins.', ['rescue', 'kittens', 'escort', 'groceries']),
  E('turbo', '🏎️', 'Semana Turbo', 'Turbo Week', 'Corridas, perseguições e entregas rendem +50% de moedas.', 'Races, chases and deliveries pay +50% coins.', ['race', 'chase', 'chain', 'heist', 'deliver']),
  E('mimosa', '😾', 'Semana da Mimosa', "Mimosa's Week", 'Duelos, ondas, defesas e chefões rendem +50% de moedas.', 'Duels, waves, defences and bosses pay +50% coins.', ['duel', 'waves', 'defend', 'boss', 'brawl']),
  E('world', '✈️', 'Semana Volta ao Mundo', 'World Tour Week', 'Toda missão de viagem rende +50% de moedas.', 'Every travel mission pays +50% coins.', [], { tour: true }),
  E('sneak', '🤫', 'Semana Furtiva', 'Sneaky Week', 'Missões furtivas, roubos e cofres rendem +50% de moedas.', 'Stealth, steal and vault missions pay +50% coins.', ['stealth', 'steal', 'vault', 'truck']),
  E('beach', '🏐', 'Semana da Praia', 'Beach Week', 'Vôlei, altinha e caça às fotos rendem +50% de moedas.', 'Volleyball, keepie-uppie and photo hunts pay +50% coins.', ['volley', 'football', 'photo', 'paws']),
];
fs.writeFileSync(new URL('../public/data/events.json', import.meta.url), JSON.stringify({ version: 1, note: 'One event per week, rotating from the epoch (a Monday). Coins only: events never sell anything.', epoch: '2026-01-05', events }, null, 1));
console.log('packs:', Object.keys(packs).map(k => k + ' ' + packs[k].missions.length).join(', '), '| templates', templates.length, '| comunidade', comunidade.length, '| events', events.length);
