// Authoring helper for public/data/missions.json: keeps the story missions that are already in the file (n < 200)
// and (re)writes the 15 extra chapters ("arcs", n 201-350) from the compact tables below.
// Usage: node tools/gen-missions.mjs [bot-results.json]
//   With a bot results file (tests/e2e/results.json) the par time of each arc mission is calibrated from the
//   time the test bot needed (a human gets ~2.4x that plus 20 s). missions.json stays the single source of truth for the game.
import fs from 'node:fs';
const file = new URL('../public/data/missions.json', import.meta.url);
const old = JSON.parse(fs.readFileSync(file, 'utf8'));
const res = process.argv[2] && fs.existsSync(process.argv[2]) ? Object.fromEntries(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(r => r.win).map(r => [r.n, r.time])) : {};
const oldPar = Object.fromEntries(old.missions.map(m => [m.n, m.par]));

// chapter: [name pt, name en, geo, song, stars needed, first level, level step, intro pt, intro en, colour]
// mission: [type, name pt, name en, params, who, line pt, line en]
const CH = [
  ['Verão na Orla', 'Boardwalk Summer', 0, 0, 6, 3, 0.8, 'Férias na praia: vôlei, pipas, pescaria e muita foto pro Instagram.', 'Beach holidays: volleyball, kites, fishing and lots of photos for Instagram.', '#ff8a5c,#ffd23f', [
    ['volley', 'Vôlei de Praia', 'Beach Volleyball', { points: 6 }, 'mimosa', 'Essa bola é MINHA. Sai da frente!', 'That ball is MINE. Out of my way!'],
    ['kites', 'Pipas no Céu', 'Kites in the Sky', { n: 6, time: 80 }, 'mimo', 'Correr atrás de pipa cansa… mas é bonito.', 'Chasing kites is tiring… but pretty.'],
    ['fish', 'Pescaria na Orla', 'Shoreline Fishing', { n: 4, time: 110 }, 'morticia', 'Peixe fresco? Eu fico com todos.', 'Fresh fish? I will take them all.'],
    ['photo', 'Fotos pro Insta', 'Pics for Insta', { n: 3 }, 'mimosa', 'Meu melhor ângulo é todos.', 'My best angle is all of them.'],
    ['chain', 'Entregador de Coco', 'Coconut Courier', { stops: 4, bonus: 5 }, 'mimo', 'Quatro paradas. Depois eu durmo.', 'Four stops. Then I sleep.'],
    ['parkour', 'Corrida no Calçadão', 'Boardwalk Dash', { cps: 5 }, 'morticia', 'Quem chegar por último não come!', 'Last one there gets no snacks!'],
    ['escort', 'Passeio da Vovó Gata', "Grandma Cat's Stroll", { stops: 2 }, 'mimosa', 'Ninguém encosta na vovó. NINGUÉM.', 'Nobody touches grandma. NOBODY.'],
    ['eat', 'Piquenique na Areia', 'Picnic on the Sand', { n: 24, time: 110 }, 'morticia', 'Piquenique dos outros é o melhor piquenique.', "Other people's picnic is the best picnic."],
    ['kittens', 'Gatinhos na Praia', 'Kittens on the Beach', { kinds: ['free', 'guard'] }, 'mimo', 'Dois filhotes sumiram. Bora achar.', 'Two kittens are missing. Let us find them.'],
    ['duel', 'Salva-Vidas Bulldogue', 'Lifeguard Bulldog', { elite: 'cop', hp: 5 }, 'mimosa', 'Ele apita, eu mordo.', 'He blows the whistle, I bite.'],
  ]],
  ['Becos de Neon', 'Neon Alleys', 1, 1, 15, 9, 0.9, 'O centro à noite esconde atalhos, gatinhos perdidos e cachorros dorminhocos.', 'Downtown at night hides shortcuts, lost kittens and sleepy dogs.', '#3a1560,#b0189a', [
    ['stealth', 'Pé Ante Pé', 'Tiptoe', { dogs: 5 }, 'morticia', 'Shhh… eles roncam mais alto que o Mimo.', 'Shhh… they snore louder than Mimo.'],
    ['photo', 'Caça aos Letreiros', 'Sign Hunt', { n: 4, groups: 1 }, 'mimo', 'Tanta luz que nem dá sono. Quase.', 'So many lights I can not even nap. Almost.'],
    ['chain', 'Motoboy do Sushi', 'Sushi Rider', { stops: 4, car: 1, bonus: 4 }, 'morticia', 'Entrego tudo. Menos o que eu comer.', 'I deliver everything. Except what I eat.'],
    ['parkour', 'Atalho pelos Becos', 'Alley Shortcut', { cps: 6 }, 'mimosa', 'Beco é comigo mesma.', 'Alleys are my thing.'],
    ['steal', 'Lanche Alheio', "Someone Else's Lunch", { n: 5, time: 130 }, 'morticia', 'Se tá na pata do cachorro, tá sobrando.', 'If a dog is holding it, it is a leftover.'],
    ['kittens', 'Gatinhos do Fliper', 'Arcade Kittens', { kinds: ['free', 'cage', 'guard'] }, 'mimosa', 'Jaula? Eu abro no dente.', 'A cage? I open it with my teeth.'],
    ['waves', 'Confusão no Karaokê', 'Karaoke Trouble', { waves: 3 }, 'mimo', 'Eles cantam mal E latem. Chega.', 'They sing badly AND bark. Enough.'],
    ['heist', 'O Caminhão do Neon', 'The Neon Truck', { time: 170, wanted: 1 }, 'morticia', 'Aquele caminhão cheira a sachê. É nosso.', 'That truck smells like treats. It is ours.'],
    ['escort', 'A Vovó vai ao Bingo', 'Grandma Goes to Bingo', { stops: 2, from: 'plaza2', to: 'plaza3' }, 'mimo', 'Vovó anda devagar. Finalmente alguém no meu ritmo.', 'Grandma walks slowly. Finally someone at my pace.'],
    ['duel', 'DJ Rottweiler', 'DJ Rottweiler', { elite: 'heavy', hp: 4 }, 'mimosa', 'Abaixa esse som ou eu abaixo você.', 'Turn that down or I turn you down.'],
  ]],
  ['Maré Alta', 'High Tide', 2, 2, 27, 14, 0.9, 'No porto tem peixe, iate, sol e um caminhão de petiscos dando sopa.', 'The harbor has fish, yachts, sun and a treat truck just asking for it.', '#27c4d6,#3fc27f', [
    ['fish', 'O Píer da Sorte', 'Lucky Pier', { n: 5, time: 120 }, 'morticia', 'Uma bota? Tudo bem, eu como também.', 'A boot? Fine, I will eat that too.'],
    ['volley', 'Torneio da Marina', 'Marina Tournament', { points: 8, speed: 1.08 }, 'mimosa', 'Oito pontos e ninguém chora.', 'Eight points and nobody cries.'],
    ['kites', 'Vento do Porto', 'Harbor Wind', { n: 8, time: 85 }, 'mimo', 'O vento trabalha, eu só pego.', 'The wind does the work, I just catch.'],
    ['chain', 'Entrega nos Iates', 'Yacht Delivery', { stops: 6, bonus: 4, thieves: 1 }, 'morticia', 'Rico pede muito petisco. Gosto de rico.', 'Rich folks order lots of treats. I like rich folks.'],
    ['escort', 'O Capitão Aposentado', 'The Retired Captain', { stops: 2, last: 1 }, 'mimo', 'Ele conta história de pescador o caminho todo…', 'He tells fishing stories the whole way…'],
    ['cash', 'Caixotes do Cais', 'Pier Crates', { cash: 260, time: 150 }, 'mimosa', 'Caixote fechado é ofensa pessoal.', 'A closed crate is a personal insult.'],
    ['heist', 'Assalto ao Frigorífico', 'Cold Truck Heist', { time: 170, wanted: 2 }, 'morticia', 'Peixe congelado ainda é peixe.', 'Frozen fish is still fish.'],
    ['rescue', 'Presos no Depósito', 'Locked in the Warehouse', { cages: [['switch', 'bite'], ['gap', 'link']] }, 'mimo', 'Eu acerto o botão. De longe. Sentado.', 'I will hit the button. From afar. Sitting.'],
    ['chase', 'Van em Fuga', 'Runaway Van', { targets: ['van'], time: 120 }, 'mimosa', 'Pisa fundo, Mimo! Acorda!', 'Floor it, Mimo! Wake up!'],
    ['duel', 'Contramestre Pitbull', 'Bosun Pitbull', { elite: 'heavy', hp: 5 }, 'mimosa', 'Armadura? Meu dente não sabe ler.', 'Armor? My teeth can not read.'],
  ]],
  ['Noite de Tempestade', 'Stormy Night', 3, 3, 40, 19, 0.9, 'Chove nas docas. Bom para passar despercebido e para resgatar quem ficou na chuva.', 'It is raining on the docks. Good for sneaking, and for rescuing whoever got left in the rain.', '#262d3a,#4c7fa8', [
    ['stealth', 'Sono de Trovão', 'Thunder Sleep', { dogs: 7 }, 'morticia', 'Com esse trovão eles nem me ouvem mastigar.', 'With this thunder they can not even hear me chew.'],
    ['kittens', 'Filhotes na Chuva', 'Kittens in the Rain', { kinds: ['guard', 'cage', 'free'] }, 'mimosa', 'Ninguém fica na chuva. Bora.', 'Nobody stays out in the rain. Move.'],
    ['parkour', 'Contêiner em Contêiner', 'Container to Container', { cps: 6 }, 'morticia', 'Molhar a pata eu não molho.', 'I am not getting my paws wet.'],
    ['defend', 'Abrigo na Tempestade', 'Storm Shelter', { waves: 3 }, 'mimo', 'Protejam a casinha. Eu protejo o sofá.', 'Guard the house. I will guard the couch.'],
    ['fish', 'Pesca de Bagre', 'Catfish Night', { n: 5, time: 120, groups: 1 }, 'morticia', 'Na chuva o peixe morde melhor. Eu também.', 'Fish bite better in the rain. So do I.'],
    ['truck', 'Carga Molhada', 'Wet Cargo', { gate: 'fence', wanted: 2 }, 'mimosa', 'A cerca é de madeira. Coitada.', 'The fence is made of wood. Poor thing.'],
    ['photo', 'Raios e Flashes', 'Lightning and Flashes', { n: 4, groups: 2 }, 'mimo', 'Foto com raio no fundo. Arte.', 'A photo with lightning behind. Art.'],
    ['escape', 'Sirene na Neblina', 'Sirens in the Fog', { wanted: 2, car: 1 }, 'mimosa', 'Eles não enxergam nada. Nem eu. Vai!', 'They can not see a thing. Neither can I. Go!'],
    ['heist', 'O Caminhão Fantasma', 'The Ghost Truck', { time: 180, wanted: 2, drop: 4 }, 'morticia', 'Fantasma nada. É sachê com rodas.', 'No ghost. That is treats on wheels.'],
    ['duel', 'Capataz Mastim', 'Foreman Mastiff', { elite: 'heavy', hp: 6 }, 'mimosa', 'Grande assim cai mais bonito.', 'The bigger they are, the prettier they fall.'],
  ]],
  ['Luxo nas Colinas', 'Hillside Luxury', 4, 4, 55, 24, 0.9, 'Mansões, piscinas e cofres: Vice Heights é o parquinho dos ricos e dos gatos espertos.', 'Mansions, pools and vaults: Vice Heights is a playground for the rich and for clever cats.', '#8a2a8a,#ff4fb8', [
    ['photo', 'Tour das Mansões', 'Mansion Tour', { n: 5, groups: 1 }, 'mimosa', 'Essa casa combina comigo. Fico com ela.', 'This house suits me. I will keep it.'],
    ['stealth', 'A Festa Acabou', 'The Party Is Over', { dogs: 8 }, 'morticia', 'Dormiram na festa. Sobrou tudo pra mim.', 'They fell asleep at the party. More for me.'],
    ['volley', 'Vôlei na Cobertura', 'Rooftop Volley', { points: 9, speed: 1.12 }, 'mimo', 'Dá pra jogar deitado?', 'Can I play lying down?'],
    ['chain', 'Delivery de Caviar', 'Caviar Delivery', { stops: 6, car: 1, bonus: 3 }, 'morticia', 'Caviar é só ovo de peixe chique. Aprovado.', 'Caviar is just fancy fish eggs. Approved.'],
    ['vault', 'Cofre da Mansão', 'Mansion Vault', { gate: 'fence', wanted: 2 }, 'mimo', 'Um tiro no botão e volto pro cochilo.', 'One shot at the button and back to my nap.'],
    ['escort', 'A Diva e Seus Fãs', 'The Diva and Her Fans', { stops: 2, last: 1 }, 'mimosa', 'Fã de quatro patas que late não entra.', 'Four-legged fans that bark are not on the list.'],
    ['kites', 'Pipas ao Pôr do Sol', 'Sunset Kites', { n: 9, time: 85 }, 'mimo', 'Pôr do sol rosa. Minha hora de dormir.', 'Pink sunset. My bedtime.'],
    ['cash', 'Gorjeta Gorda', 'Fat Tips', { cash: 420, time: 160 }, 'mimosa', 'Rico esquece dinheiro em caixote. Vai entender.', 'Rich folks leave money in crates. Go figure.'],
    ['parkour', 'Subida das Colinas', 'Hill Climb', { cps: 7 }, 'morticia', 'Lá em cima tem churrasco. Corre!', 'There is a barbecue up there. Run!'],
    ['duel', 'Segurança Dobermann', 'Bouncer Doberman', { elite: 'shooter', hp: 6 }, 'mimosa', 'Meu nome tá na lista. Eu escrevi agora.', 'My name is on the list. I just wrote it.'],
  ]],
  ['Festival das Pipas', 'Kite Festival', 0, 0, 70, 12, 0.7, 'A praia inteira olha para o céu. Tem campeonato, entrega de linha e muita correria.', 'The whole beach is looking up. There is a championship, string deliveries and lots of running.', '#ffb347,#2de2e6', [
    ['kites', 'Abertura do Festival', 'Festival Opening', { n: 7, time: 80 }, 'mimo', 'Pipa colorida… dá vontade de deitar e olhar.', 'Colourful kites… makes me want to lie down and watch.'],
    ['chain', 'Linha e Rabiola', 'String and Tails', { stops: 4, bonus: 5 }, 'mimosa', 'Sem linha não tem festival. Anda!', 'No string, no festival. Move!'],
    ['photo', 'A Pipa Gigante', 'The Giant Kite', { n: 4 }, 'morticia', 'Se fosse de presunto eu comia.', 'If it were made of ham I would eat it.'],
    ['kites', 'Vento Forte', 'Strong Wind', { n: 9, time: 80, max: 4 }, 'mimosa', 'O vento não manda em mim.', 'The wind is not the boss of me.'],
    ['escort', 'O Mestre Pipeiro', 'The Kite Master', { stops: 2 }, 'mimo', 'O mestre anda devagar. Gostei dele.', 'The master walks slowly. I like him.'],
    ['parkour', 'Corre que a Pipa Caiu', 'Run, the Kite Fell', { cps: 6 }, 'morticia', 'Pipa caída é de quem pegar!', 'A fallen kite belongs to whoever grabs it!'],
    ['waves', 'Os Corta-Linhas', 'The String Cutters', { waves: 3 }, 'mimosa', 'Cortaram a linha das crianças. Agora é pessoal.', "They cut the kids' strings. Now it is personal."],
    ['eat', 'Barraquinhas do Festival', 'Festival Stalls', { n: 30, time: 115 }, 'morticia', 'Festival é comida com música de fundo.', 'A festival is food with background music.'],
    ['kites', 'A Grande Final', 'The Grand Final', { n: 12, time: 95, max: 4 }, 'mimo', 'Doze pipas. Depois, doze horas de sono.', 'Twelve kites. Then twelve hours of sleep.'],
    ['duel', 'O Rei das Linhas', 'The String King', { elite: 'catcher', hp: 6 }, 'mimosa', 'Rede, linha, tanto faz. Eu rasgo.', 'Net, string, whatever. I rip it.'],
  ]],
  ['Os Gatinhos Perdidos', 'The Lost Kittens', 1, 1, 88, 22, 0.8, 'Uma ninhada inteira se perdeu no centro. Os três não voltam para casa sem todos eles.', 'A whole litter got lost downtown. The three are not going home without every one of them.', '#5a2a8a,#2de2e6', [
    ['kittens', 'O Primeiro Miado', 'The First Meow', { kinds: ['free', 'free', 'guard'] }, 'mimosa', 'Ouvi um miado. Ninguém fica pra trás.', 'I heard a meow. No cat left behind.'],
    ['photo', 'Cartazes de Procura-se', 'Missing Posters', { n: 5, groups: 1 }, 'mimo', 'Colar cartaz é trabalho. Fotografar eu fotografo.', 'Putting up posters is work. Taking photos I can do.'],
    ['rescue', 'O Canil Clandestino', 'The Secret Kennel', { cages: [['fence', 'bite'], ['switch', 'link']] }, 'mimosa', 'Quem prende gatinho arruma briga comigo.', 'Whoever cages kittens picks a fight with me.'],
    ['stealth', 'A Chave do Canil', 'The Kennel Key', { dogs: 8 }, 'morticia', 'A sacola tá no meio deles. Fácil.', 'The bag is right between them. Easy.'],
    ['kittens', 'Gatinhos no Telhado', 'Kittens on the Roof', { kinds: ['guard', 'cage', 'free', 'guard'] }, 'mimo', 'Quatro filhotes. Vou precisar de café.', 'Four kittens. I am going to need coffee.'],
    ['escort', 'A Mãe Gata', 'Mother Cat', { stops: 2, last: 1 }, 'mimosa', 'Ela só quer os filhos. A gente leva.', 'She just wants her kids. We will take her.'],
    ['chase', 'A Van do Canil', 'The Kennel Van', { targets: ['van'], time: 120, drop: 4 }, 'mimosa', 'Tem gatinho naquela van. Bate nela!', 'There are kittens in that van. Ram it!'],
    ['defend', 'Creche dos Gatinhos', 'Kitten Daycare', { waves: 4 }, 'mimo', 'Shhh, os filhotes estão dormindo. Que inveja.', 'Shhh, the kittens are asleep. I am jealous.'],
    ['kittens', 'O Último Filhote', 'The Last Kitten', { kinds: ['cage', 'guard', 'cage', 'guard'] }, 'morticia', 'O último tá com fome. Eu entendo ele.', 'The last one is hungry. I understand him.'],
    ['duel', 'O Dono do Canil', 'The Kennel Boss', { elite: 'catcher', hp: 7 }, 'mimosa', 'Agora quem vai pra jaula é você.', 'Now you are the one going into a cage.'],
  ]],
  ['Rota dos Petiscos', 'Treat Route', 2, 2, 105, 26, 0.8, 'Os caminhões de petisco cruzam o porto toda manhã. A Mortícia decorou os horários.', 'Treat trucks cross the harbor every morning. Morticia has memorised the timetable.', '#ffd27a,#ff8a70', [
    ['chain', 'Rota da Manhã', 'Morning Route', { stops: 6, car: 1, bonus: 3 }, 'mimo', 'Trabalhar de manhã devia ser proibido.', 'Working in the morning should be illegal.'],
    ['heist', 'Caminhão das Sete', 'The Seven O’Clock Truck', { time: 170, wanted: 2 }, 'morticia', 'Pontual todo dia. Eu também.', 'On time every day. So am I.'],
    ['eat', 'Degustação Grátis', 'Free Samples', { n: 40, time: 120 }, 'morticia', 'Amostra grátis? Vou levar todas.', 'Free samples? I will take all of them.'],
    ['truck', 'O Depósito Central', 'The Main Depot', { gate: 'switch', wanted: 2 }, 'mimo', 'Um botão vermelho. Meu tipo de trabalho.', 'One red button. My kind of job.'],
    ['steal', 'Marmita dos Guardas', "The Guards' Lunchboxes", { n: 7, time: 140 }, 'morticia', 'Guarda de barriga cheia não corre.', 'A guard with a full belly does not run.'],
    ['chain', 'Entrega Relâmpago', 'Lightning Delivery', { stops: 8, bonus: 4, thieves: 1 }, 'mimosa', 'Ladrão de entrega apanha em dobro.', 'Delivery thieves get bitten twice.'],
    ['cash', 'Troco do Frete', 'Shipping Change', { cash: 480, time: 160 }, 'mimosa', 'Frete caro assim eu cobro no dente.', 'With shipping this pricey, I collect with my teeth.'],
    ['heist', 'Comboio de Sachê', 'Sachet Convoy', { time: 180, wanted: 3, drop: 3.5 }, 'morticia', 'Caminhão cheio? Hoje eu janto duas vezes.', 'A full truck? Tonight I dine twice.'],
    ['vault', 'O Cofre do Atacado', 'The Wholesale Vault', { gate: 'key', wanted: 2 }, 'morticia', 'A chave tá no bolso do grandão. Deixa comigo.', 'The key is in the big one’s pocket. Leave it to me.'],
    ['duel', 'O Gerente Buldogue', 'Manager Bulldog', { elite: 'heavy', hp: 7 }, 'mimosa', 'Quero falar com o gerente. Com os dentes.', 'I want to speak to the manager. With my teeth.'],
  ]],
  ['Operação Soneca', 'Operation Nap', 3, 3, 125, 30, 0.8, 'À noite as docas inteiras dormem. É a hora da Mortícia trabalhar e do Mimo sentir inveja.', 'At night the whole docks fall asleep. Time for Morticia to work, and for Mimo to feel jealous.', '#1c2430,#7f8ab0', [
    ['stealth', 'Turno da Noite', 'Night Shift', { dogs: 8, wake: 62 }, 'morticia', 'Eles dormem em serviço. Eu trabalho comendo.', 'They sleep on the job. I work while eating.'],
    ['steal', 'Bolsos Dorminhocos', 'Sleepy Pockets', { n: 8, time: 150 }, 'morticia', 'Tira devagar que ele nem acorda.', 'Take it slowly and he will not even wake up.'],
    ['stealth', 'O Galpão 9', 'Warehouse 9', { dogs: 10, wake: 60, from: 'plaza2' }, 'morticia', 'Dez roncos diferentes. Parece uma orquestra.', 'Ten different snores. Sounds like an orchestra.'],
    ['photo', 'Provas do Crime', 'Evidence', { n: 5, groups: 2 }, 'mimo', 'Foto de cachorro dormindo. Fofo, até.', 'Photos of sleeping dogs. Kind of cute.'],
    ['rescue', 'Presos no Porão', 'Locked Below Deck', { cages: [['gap', 'link'], ['key', 'bite']] }, 'mimosa', 'Passagem pequena é com a Mortícia. O resto é comigo.', 'Small gaps are for Morticia. The rest is mine.'],
    ['vault', 'O Cofre do Vigia', "The Watchman's Vault", { gate: 'gap', wanted: 2 }, 'morticia', 'O vigia dorme. O cofre não. Ainda.', 'The watchman sleeps. The vault does not. Yet.'],
    ['stealth', 'Roncos e Trovões', 'Snores and Thunder', { dogs: 11, wake: 60 }, 'morticia', 'Se o trovão não acordou, eu é que não vou.', 'If thunder did not wake them, I will not either.'],
    ['escape', 'Acordaram!', 'They Woke Up!', { wanted: 3, survive: 35 }, 'mimosa', 'Agora é comigo. Finalmente.', 'Now it is my turn. Finally.'],
    ['heist', 'O Caminhão do Sono', 'The Sleepy Truck', { time: 180, wanted: 3 }, 'mimo', 'Um caminhão de travesseiros? Ah… é ração.', 'A truck full of pillows? Oh… it is kibble.'],
    ['duel', 'Vigia Noturno', 'The Night Watchman', { elite: 'shooter', hp: 7 }, 'mimosa', 'Boa noite pra você. Literalmente.', 'Good night to you. Literally.'],
  ]],
  ['Liga dos Vira-Latas', 'The Mutt League', 4, 4, 145, 34, 0.8, 'Os valentões de Vice Heights montaram uma liga. A Mimosa quer o cinturão.', 'The bullies of Vice Heights started a league. Mimosa wants the belt.', '#b0189a,#ffd23f', [
    ['duel', 'Rodada 1: O Novato', 'Round 1: The Rookie', { elite: 'mutt', hp: 9 }, 'mimosa', 'Aquecimento. Nem vou suar.', 'Warm-up. I will not even sweat.'],
    ['waves', 'Torcida Organizada', 'The Rowdy Fans', { arena: 1, waves: 4 }, 'mimo', 'A torcida invadiu. Que canseira.', 'The fans stormed in. How exhausting.'],
    ['duel', 'Rodada 2: O Veloz', 'Round 2: The Quick One', { elite: 'chi', hp: 22 }, 'mimosa', 'Pequeno e rápido. Igual pulga.', 'Small and fast. Like a flea.'],
    ['steal', 'Vestiário Aberto', 'Open Locker Room', { n: 8, time: 150 }, 'morticia', 'Lanche de atleta é reforçado. Aprovo.', 'Athlete snacks are hearty. I approve.'],
    ['duel', 'Rodada 3: O Atirador', 'Round 3: The Sharpshooter', { elite: 'shooter', hp: 8 }, 'mimosa', 'Bolinha de tênis não me assusta.', 'Tennis balls do not scare me.'],
    ['defend', 'Protejam o Troféu', 'Guard the Trophy', { waves: 4 }, 'mimo', 'O troféu parece um travesseiro dourado.', 'The trophy looks like a golden pillow.'],
    ['duel', 'Semifinal: O Blindado', 'Semifinal: The Armored One', { elite: 'heavy', hp: 8 }, 'mimosa', 'Lata por fora, medo por dentro.', 'Tin on the outside, fear on the inside.'],
    ['cash', 'Bilheteria da Liga', 'League Box Office', { cash: 560, time: 170 }, 'morticia', 'Ingresso esgotado. O lanche também, fui eu.', 'Tickets sold out. So did the snacks, that was me.'],
    ['waves', 'Todos Contra Três', 'All Against Three', { arena: 1, waves: 5 }, 'mimosa', 'Só isso? Chama mais.', 'Is that all? Call more.'],
    ['duel', 'A Grande Final', 'The Grand Final', { elite: 'heavy', hp: 11 }, 'mimosa', 'O cinturão vai combinar com o meu laço.', 'The belt will match my bow.'],
  ]],
  ['Copa das Patas', 'The Paw Cup', 0, 0, 165, 30, 0.6, 'Campeonato de verão na praia: vôlei, corrida e pescaria valendo a taça.', 'Summer championship on the beach: volleyball, racing and fishing for the cup.', '#2de2e6,#ff4fb8', [
    ['volley', 'Fase de Grupos', 'Group Stage', { points: 8, speed: 1.1 }, 'mimosa', 'Grupo fácil. Próximo.', 'Easy group. Next.'],
    ['race', 'Rali da Areia', 'Sand Rally', { cps: 7, time: 105 }, 'mimo', 'Dirigir sentado eu aceito.', 'Driving while sitting, I accept.'],
    ['fish', 'Torneio de Pesca', 'Fishing Tournament', { n: 7, time: 130 }, 'morticia', 'Pesca esportiva? Eu não devolvo, não.', 'Catch and release? I do not release.'],
    ['volley', 'Quartas de Final', 'Quarterfinals', { points: 10, speed: 1.18 }, 'mimosa', 'Dez pontos sem deixar cair.', 'Ten points without a drop.'],
    ['parkour', 'Revezamento', 'Relay Race', { cps: 8 }, 'morticia', 'O bastão é um salsichão. Posso comer no final?', 'The baton is a sausage. Can I eat it at the end?'],
    ['kites', 'Prova das Pipas', 'Kite Trial', { n: 11, time: 90, max: 4 }, 'mimo', 'Esporte olhando pra cima. Quase deitado.', 'A sport where you look up. Almost lying down.'],
    ['volley', 'Semifinal', 'Semifinal', { points: 11, speed: 1.26 }, 'mimosa', 'Tô começando a me divertir.', 'I am starting to enjoy this.'],
    ['chase', 'O Juiz Fugiu', 'The Referee Ran Off', { targets: ['limo'], time: 130, drop: 4 }, 'mimosa', 'Roubou no placar e fugiu de limusine!', 'He fixed the score and ran off in a limo!'],
    ['volley', 'A Grande Final', 'The Grand Final', { points: 13, speed: 1.34 }, 'mimosa', 'Essa taça é do tamanho do meu ego.', 'That cup is the size of my ego.'],
    ['duel', 'O Mascote Rival', 'The Rival Mascot', { elite: 'cop', hp: 10 }, 'mimosa', 'Mascote feio. Vou melhorar.', 'Ugly mascot. Let me fix that.'],
  ]],
  ['Paparazzi Felino', 'Feline Paparazzi', 1, 1, 190, 34, 0.6, 'Os três viraram celebridades. Tem tapete vermelho, fã, fofoca e um fotógrafo intrometido.', 'The three became celebrities. There is a red carpet, fans, gossip and a nosy photographer.', '#ff4fb8,#fffb96', [
    ['photo', 'Ensaio no Centro', 'Downtown Photoshoot', { n: 5, groups: 2 }, 'mimosa', 'Luz boa. Anota aí: lado esquerdo.', 'Good light. Take note: left side.'],
    ['escape', 'Fuga dos Fãs', 'Escape from the Fans', { wanted: 2, car: 1 }, 'mimo', 'Fama dá muito trabalho.', 'Fame is a lot of work.'],
    ['chain', 'Autógrafos em Domicílio', 'Autographs to Go', { stops: 6, car: 1, bonus: 3 }, 'mimosa', 'Autógrafo de pata vale mais.', 'A paw-print autograph is worth more.'],
    ['chase', 'O Carro da Fofoca', 'The Gossip Car', { targets: ['van'], time: 125, drop: 3.5 }, 'mimosa', 'Publicou foto minha descabelada. Vai pagar.', 'He published a bad-hair photo of me. He will pay.'],
    ['stealth', 'Camarim Alheio', "Someone Else's Dressing Room", { dogs: 9 }, 'morticia', 'O camarim dos outros tem lanche melhor.', 'Other people’s dressing rooms have better snacks.'],
    ['escort', 'Tapete Vermelho', 'Red Carpet', { stops: 2, last: 1 }, 'mimo', 'Andar devagar acenando. Eu nasci pra isso.', 'Walking slowly and waving. I was born for this.'],
    ['photo', 'Capa de Revista', 'Magazine Cover', { n: 6, groups: 2, time: 200 }, 'morticia', 'Na capa eu quero estar comendo.', 'On the cover I want to be eating.'],
    ['waves', 'Invasão de Camarim', 'Dressing Room Invasion', { arena: 1, waves: 4 }, 'mimosa', 'Sem crachá não entra. Sem dente não sai.', 'No badge, no entry. No teeth, no exit.'],
    ['heist', 'O Caminhão do Bufê', 'The Catering Truck', { time: 180, wanted: 3, drop: 4 }, 'morticia', 'Bufê de festa de famoso. Meu sonho.', 'A celebrity party buffet. My dream.'],
    ['duel', 'O Paparazzo Chefe', 'The Head Paparazzo', { elite: 'shooter', hp: 9 }, 'mimosa', 'Sorria. É a sua última foto hoje.', 'Smile. It is your last photo today.'],
  ]],
  ['Pescaria Lendária', 'Legendary Fishing', 2, 2, 215, 38, 0.6, 'Dizem que um atum dourado mora na baía. A Mortícia não dorme enquanto não provar.', 'They say a golden tuna lives in the bay. Morticia will not sleep until she has tasted it.', '#27c4d6,#ffd23f', [
    ['fish', 'Iscas e Boatos', 'Bait and Rumours', { n: 6, time: 130 }, 'morticia', 'Atum dourado. Dourado de fritura, espero.', 'A golden tuna. Golden as in fried, I hope.'],
    ['chain', 'A Loja de Iscas', 'The Bait Shop', { stops: 6, bonus: 4, thieves: 1 }, 'mimo', 'Minhoca eu não carrego. Tá bom, carrego.', 'I am not carrying worms. Fine, I am.'],
    ['steal', 'O Mapa do Pescador', "The Fisherman's Map", { n: 8, time: 150 }, 'morticia', 'O mapa tá com um deles. E o almoço também.', 'One of them has the map. And lunch.'],
    ['fish', 'Maré Cheia', 'Full Tide', { n: 8, time: 140, groups: 1 }, 'morticia', 'Cada bota que eu pesco eu fico mais brava.', 'Every boot I catch makes me angrier.'],
    ['defend', 'O Barco Encalhado', 'The Stranded Boat', { waves: 5 }, 'mimosa', 'O barco é nosso. A praia também. Tudo.', 'The boat is ours. The beach too. Everything.'],
    ['escort', 'O Velho Lobo do Mar', 'The Old Sea Cat', { stops: 2, last: 1 }, 'mimo', 'Ele sabe onde o atum mora. Protejam o velhinho.', 'He knows where the tuna lives. Protect the old cat.'],
    ['chase', 'Os Pescadores Rivais', 'The Rival Fishermen', { targets: ['van', 'van'], time: 160, drop: 3.5 }, 'mimosa', 'Roubaram nossa isca. Um por um.', 'They stole our bait. One at a time.'],
    ['kittens', 'Náufragos Miudinhos', 'Tiny Castaways', { kinds: ['guard', 'cage', 'guard', 'free'] }, 'mimosa', 'Filhote não é isca. Solta.', 'Kittens are not bait. Let them go.'],
    ['fish', 'O Atum Dourado', 'The Golden Tuna', { n: 10, time: 160, groups: 2 }, 'morticia', 'Hoje eu pesco a lenda. E como a lenda.', 'Today I catch the legend. And eat the legend.'],
    ['duel', 'Almirante Terra-Nova', 'Admiral Newfoundland', { elite: 'heavy', hp: 10 }, 'mimosa', 'O atum é da Mortícia. Recua.', 'The tuna belongs to Morticia. Back off.'],
  ]],
  ['Blecaute nas Docas', 'Docks Blackout', 3, 3, 240, 42, 0.6, 'A luz caiu no porto inteiro. No escuro, os gatos enxergam melhor que qualquer cachorro.', 'The power is out across the port. In the dark, cats see better than any dog.', '#10161f,#ffd23f', [
    ['defend', 'O Gerador Reserva', 'The Backup Generator', { waves: 5, gen: 1 }, 'mimo', 'Se a luz voltar eu não durmo. Dilema.', 'If the lights come back I can not sleep. Dilemma.'],
    ['stealth', 'No Escuro', 'In the Dark', { dogs: 11, wake: 62 }, 'morticia', 'Preta no escuro. Boa sorte pra eles.', 'A black cat in the dark. Good luck to them.'],
    ['rescue', 'Elevadores Parados', 'Stuck Elevators', { cages: [['switch', 'link'], ['fence', 'bite'], ['gap', 'link']] }, 'mimosa', 'Três presos. Três portas a menos.', 'Three trapped. Three fewer doors.'],
    ['chain', 'Velas e Pilhas', 'Candles and Batteries', { stops: 8, car: 1, bonus: 3 }, 'mimo', 'Entregar vela no escuro. Que ideia.', 'Delivering candles in the dark. What an idea.'],
    ['truck', 'O Caminhão de Baterias', 'The Battery Truck', { gate: 'key', wanted: 3, heavy: 1 }, 'morticia', 'Bateria não se come. Mas o motorista tem lanche.', 'You can not eat batteries. But the driver has a snack.'],
    ['kittens', 'Medo de Escuro', 'Afraid of the Dark', { kinds: ['guard', 'cage', 'guard', 'cage'] }, 'mimosa', 'Calma, pequenos. A brava chegou.', 'Easy, little ones. The fierce one is here.'],
    ['escape', 'Sem Farol', 'No Headlights', { wanted: 4, car: 1 }, 'mimosa', 'No escuro eles batem sozinhos.', 'In the dark they crash by themselves.'],
    ['waves', 'Saqueadores', 'Looters', { arena: 1, waves: 5 }, 'mimo', 'Aproveitar o apagão pra roubar? Feio. Só a gente pode.', 'Using the blackout to steal? Rude. Only we may.'],
    ['vault', 'O Cofre Sem Alarme', 'The Vault with No Alarm', { gate: 'switch', wanted: 3 }, 'morticia', 'Sem luz, sem alarme. Com fome.', 'No power, no alarm. Just hunger.'],
    ['duel', 'O Eletricista', 'The Electrician', { elite: 'heavy', hp: 11 }, 'mimosa', 'Foi você que desligou a luz? Que choque.', 'Did you cut the power? Shocking.'],
  ]],
  ['A Grande Festa', 'The Grand Party', 4, 4, 270, 46, 0.6, 'A cidade inteira vai festejar os três gatos. Só falta buscar o bolo, os convidados e a paz.', 'The whole city is throwing a party for the three cats. All that is missing is the cake, the guests and some peace.', '#ff4fb8,#2de2e6', [
    ['chain', 'Convites', 'Invitations', { stops: 8, car: 1, bonus: 3 }, 'mimosa', 'Cachorro não foi convidado. Deixei claro.', 'Dogs are not invited. I made that clear.'],
    ['heist', 'O Caminhão do Bolo', 'The Cake Truck', { time: 180, wanted: 3, drop: 3.5 }, 'morticia', 'Eu busco o bolo. Sozinha. Confia.', 'I will fetch the cake. Alone. Trust me.'],
    ['escort', 'A Convidada de Honra', 'The Guest of Honor', { stops: 2, last: 1 }, 'mimo', 'A vovó gata vem. Coloca uma almofada pra ela. E uma pra mim.', 'Grandma cat is coming. Get her a cushion. And one for me.'],
    ['kites', 'Decoração no Céu', 'Decorations in the Sky', { n: 12, time: 90, max: 4 }, 'mimosa', 'Pipa rosa na frente. As outras atrás.', 'Pink kites in front. The rest behind.'],
    ['photo', 'Álbum da Festa', 'Party Album', { n: 6, groups: 2 }, 'morticia', 'Tira foto da mesa antes que eu coma.', 'Take a photo of the table before I eat it.'],
    ['defend', 'A Mesa do Bolo', 'The Cake Table', { waves: 6 }, 'morticia', 'Defender o bolo dos outros… de mim ninguém defende.', 'Guarding the cake from others… nobody guards it from me.'],
    ['volley', 'Brincadeira de Festa', 'Party Game', { points: 12, speed: 1.3 }, 'mimo', 'Balão não pode cair. Nem eu, mas eu vou.', 'The balloon must not drop. Neither should I, but I will.'],
    ['kittens', 'Os Penetras Fofos', 'The Cute Gatecrashers', { kinds: ['free', 'guard', 'cage', 'guard'] }, 'mimosa', 'Filhote entra de graça. Sempre.', 'Kittens get in free. Always.'],
    ['waves', 'Os Penetras Chatos', 'The Rude Gatecrashers', { arena: 1, waves: 6 }, 'mimosa', 'A festa é nossa. A porta é ali.', 'This is our party. The door is over there.'],
    ['duel', 'O Rei dos Penetras', 'The King of Gatecrashers', { elite: 'heavy', hp: 10 }, 'mimosa', 'Último da lista. Depois, bolo.', 'Last one on the list. Then cake.'],
  ]],
];

const districts = old.districts.filter(d => d.id <= 6), missions = old.missions.filter(m => m.n < 200);
const PAR = { volley: 110, kites: 75, fish: 100, photo: 110, chain: 110, parkour: 90, escort: 130, eat: 80, kittens: 150, duel: 110, stealth: 80, steal: 100, waves: 160, heist: 150, cash: 120, rescue: 160, chase: 100, defend: 190, truck: 120, escape: 100, vault: 90, race: 85 };
CH.forEach((c, i) => {
  const id = 7 + i, from = 201 + i * 10, [pt, en, geo, song, stars, lv0, step, ipt, ien, col, list] = c;
  districts.push({ id, geo, song, from, to: from + 9, grant: null, arc: true, req: { stars }, col, name: { pt, en }, intro: { pt: ipt, en: ien } });
  list.forEach((m, k) => {
    const n = from + k, [type, npt, nen, params, who, lpt, len] = m, t = res[n];
    const par = t ? Math.max(40, Math.min(300, Math.round((t * 2.4 + 20) / 5) * 5)) : oldPar[n] || PAR[type] || 120;
    missions.push({ n, type, name: { pt: npt, en: nen }, lv: Math.round(lv0 + k * step * (10 / 9) * 0.9 + (k === 9 ? 1 : 0)), par, params, talk: [[who, lpt, len]] });
  });
});
const out = '{\n  "version": 2,\n  "districts": [\n' + districts.map(d => '    ' + JSON.stringify(d)).join(',\n') + '\n  ],\n  "missions": [\n' + missions.map(m => '    ' + JSON.stringify(m)).join(',\n') + '\n  ]\n}\n';
fs.writeFileSync(file, out);
const by = {}; for (const m of missions) by[m.type] = (by[m.type] || 0) + 1;
console.log(missions.length, 'missions,', districts.length, 'districts', JSON.stringify(by));
