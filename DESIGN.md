# VICE PAWS — Design

Jogo de fã em 3D (Three.js r160, sem build) com os gatos **Mimo, Mimosa e Mortícia** (@mimo.mimosa.morticia). Mundo aberto neon estilo "Vice", missões, loja Pix honesta, contas e mapas reais. **Sem vínculo com nenhum estúdio de games.**

## 1. Arquitetura

```
public/
  index.html, css/style.css
  vendor/three.module.min.js      three r160 (MIT), sem CDN
  data/                           TODO O CONTEÚDO (ver §6): missions, items, outfits, activities, cities/
  assets/                         arte ilustrada (manifest.json mapeia chave -> arquivo; tudo tem fallback)
  js/core.js      utilitários, save (localStorage sempre em try/catch), assets, input unificado (teclado/mouse/toque)
  js/i18n.js      PT-BR / EN
  js/art.js       ícones 2D do HUD + paletas de cachorros/carros
  js/audio.js     música synthwave + SFX em WebAudio (sem arquivos)
  js/world.js     gerador da cidade (grade de tiles), colisão, flow-fields; World.fromCity() rasteriza cidades reais
  js/game.js      SIMULAÇÃO (camada de estado): gatos, cachorros, chefões, projéteis, itens, carros, procurado
  js/missions.js  tipos de missão + passos de objetivo, mundo livre, Volta ao Mundo
  js/hud.js       HUD 2D por cima do WebGL (retratos, radar, controles de toque, rótulos projetados)
  js/ui.js        telas HTML, loop principal, ranking, compartilhar, ganchos de teste (window.__vp)
  js/shop.js      Loja dos Mimos (Pix), provador, restaurar, mural
  js/wardrobe.js  Guarda-roupa por slots
  js/accounts.js  login por código, Meus gatos (criador), save na nuvem, galeria
  js/tour.js      Volta ao Mundo (mapas reais)
  js/gfx/models.js   modelos low-poly paramétricos (buildCat(spec), cachorros, carros, props) em geometria mesclada
  js/gfx/city.js     cidade 3D estática (chão, prédios, neon, palmeiras, céu, água)
  js/gfx/realcity.js cidade real 3D (terreno com elevação, vias, prédios extrudados, marcos)
  js/gfx/render.js   renderizador: sincroniza a simulação com a cena, câmera, partículas, qualidade automática
api/              funções Vercel: scores, pix/*, auth, me, cats, save (ver docs/ACCOUNTS.md)
tools/build-cities.mjs  copia os extratos OSM e gera data/cities/index.json
```

**Separação estado × render.** `game.js` não conhece Three.js: é uma simulação 2D vista de cima (x, y em px; 48 px = 1 tile = 2 unidades 3D). `render.js` só lê o estado e desenha. `Game.snapshot()` devolve um JSON pequeno (posição, direção, animação, gato ativo, carro) pronto para sincronizar jogadores remotos por interpolação no futuro.

**Gato paramétrico.** `buildCat(spec)` com `spec = {size, fur, fur2, pattern: solid|calico|tuxedo|tabby|points, patchA, patchB, eye, earIn, face: flat|round, headShape, fluff, lids, brows, tongue, acc: {bow, hat, crown, santa, glasses, scarf, collar, bell, bowtie, shirt, shirt2, jacket, trim, studs, hoodie, pack, cape, wings}, tool, cup, trail}`. Mimo, Mimosa e Mortícia são presets (`CAT_SPECS`); o criador de gatos e a galeria usam o mesmo construtor (`Acct.toSpec` converte o formato da API).

## 2. Os gatos e a interdependência

| Gato | Papel | Ataque | Dash | Especial | Medidor |
|---|---|---|---|---|---|
| **Mimo** (o cansado) | atirador | blaster de bolhas de espinha de peixe (mira automática no celular) | bola de pelo que atordoa | **SONECA**: câmera lenta + recarrega | energia: cai ao atirar; exausto anda e atira devagar; café ☕ recarrega |
| **Mimosa** (a brava) | tanque corpo a corpo | combo de 3 mordidas | bote com mordida | **ROSNADO**: atordoa em área, racha armadura, apaga projéteis | recarga do rosnado; leva 28% menos dano e atrai a agressão |
| **Mortícia** (a comilona) | ladra furtiva | rouba o item que o cachorro carrega (comida, munição, rede, chave) e come | some por 2 s | **LANCHÃO**: aspira tudo em volta | fome: barriga vazia tira vida; cheia libera o Lanchão |

Dependência real: Mimo acerta **botões** à distância (lasers/cofres); Mimosa **morde** portões de madeira, caixotes, cadeados e quebra **armaduras**; Mortícia passa por **portinhas** (tile GAP), puxa alavancas e rouba **chaves**. Comer cura o time; o pique do time depende da energia do Mimo. Troca instantânea entre os três (retratos ou 1/2/3), com os outros dois como seguidores de IA.

**Vidas / ninguém fica pra trás.** Gato caído é reanimado ficando ao lado e SEGURANDO o botão de ação (gasta 1 vida). Missão só termina com os três de pé. Vidas: patinhas douradas, 1ª vez com 3 estrelas, chefões, todas as patinhas de um bairro. Sem vidas, aparece uma patinha de misericórdia. Gato caído em lugar inalcançável é carregado para perto do líder.

## 3. Mundo

Um mapa contínuo de 12×8 quarteirões (352×240 m): **Sunset Beach**, **Neon Downtown**, **Palm Harbor**, **Storm Docks** (chuva e raios) e **Vice Heights**. Cada bairro tem papéis fixos usados pelas missões: `arena`, `house`, `plaza1-3`, `park`, `compA-D` (cercados configuráveis por missão: portão `fence|switch|gap|key|open`, cofre opcional). Céu, neblina e luzes mudam por bairro. No mundo livre: feixes de missão, loja, contra-relógios, NPCs com missões de bairro, 25 patinhas douradas, tráfego, carros para dirigir, nível de procurado com bulldogs e viaturas.

**Volta ao Mundo.** `World.fromCity(json)` rasteriza um extrato do OpenStreetMap (3 m por tile) na mesma grade da simulação; `realcity.js` constrói o 3D (terreno com `elev`, vias em fitas, prédios extrudados, marcos como faróis). Mapas com tag `comunidade` não têm polícia, procurado nem cachorros hostis: só missões positivas (entregas, petiscos nas escadarias, gatinho no telhado, festival de pipas). Atribuição "© OpenStreetMap contributors" aparece na tela de viagem e no HUD dos mapas reais.

## 4. Controles

- **Celular (retrato):** analógico esquerdo anda (relativo à câmera); direito mira/ataca (segurar = mira automática); botões: especial, dash, ação (reanimar / entrar e sair do carro); toque nos retratos troca de gato; pausa.
- **PC:** WASD/setas, mouse mira, clique ataca, Espaço especial, Shift dash, E ação, 1/2/3 ou Q troca, botão direito gira a câmera, P pausa, M mudo.

## 5. Loja (honesta)

Jogo grátis e 100% zerável sem pagar. Sem sorteio, sem caixas, sem pressão. `vip` R$4,90 (roupas, rastro, conversível dourado com neon e buzina, dança, coroa no ranking, bairro bônus Marina Dourada), `season` R$2,90 (Natal Neon: 4 missões + neve e decoração), `lives10` R$1,99, `apoio5/10/20` (selo, nome dourado, mural). Provador com pedestal 3D e volta de teste de 20 s. Checkout Pix com QR, copia-e-cola, consulta a cada 4 s por até 30 min, confete, código de compra; restaurar por código; 503 → "Loja abre em breve 🐾". Grants aplicados uma única vez por id de pagamento (`vp_purchases`). No máximo um cartão dispensável do VIP por sessão, só em tela de bairro concluído.

## 6. Conteúdo orientado a dados (para expandir sem tocar no motor)

### `public/data/missions.json`
```json
{ "districts": [{ "id": 0, "geo": 0, "song": 0, "from": 1, "to": 10, "grant": null, "name": {"pt": "…", "en": "…"} }],
  "missions":  [{ "n": 1, "type": "reach", "name": {"pt": "…", "en": "…"}, "lv": 1, "par": 65, "boss": "chief", "params": { } }] }
```
- `geo` = bairro físico (0 Beach, 1 Downtown, 2 Harbor, 3 Docks, 4 Heights); `grant` = `vip`/`season` para bairros bônus; `song` 0-6.
- `lv` escala vida/dano/tamanho dos grupos; `par` = tempo da 3ª estrela; missões com `n` entre `from` e `to` de um distrito pertencem a ele. Para um novo capítulo: adicione um distrito com nova faixa de `n` e as missões.
- `type` e `params`: `reach {groups, time?, tut?}` · `waves {waves: N | [[tipos]], arena?}` · `eat {n, time, hunger?}` · `steal {n, time}` · `cash {cash, time}` · `rescue {cages: [[portão, tranca]]}` (portão `fence|switch|gap|key|open`, tranca `bite|key|link`) · `truck {gate, wanted, heavy?}` · `vault {gate, wanted}` · `escape {wanted, car?, survive?}` · `chase {targets: [van|limo|…], time, drop?}` · `race {cps, time}` · `defend {waves, gen?}` · `boss {}` (+ `"boss": chief|poodle|rott|pug|dogcatcher`).
- Tipos de cachorro: `mutt, chi, cop, shooter, catcher, heavy`.

### `public/data/activities.json`
`pawsPerDistrict`, `trials: [{id, d, lv, name, start: [i, j], cps: [[i, j]…], time, reward}]` (cruzamentos da grade, i 0-12, j 0-8) e `quests: [{id, d, npc: f0-f3, spot: papel do bairro, name, text, type: eat|ko|steal|cash, n, reward}]`.

### `public/data/outfits.json`
`slots: [head, eyes, neck, body, back, trail]`, `defaults` por gato, `sets` (vip/season) e `items: [{id, slot, name, acc: {…chaves de acc do buildCat…} | trail: {shape: star|heart|dot, col}, free | price (moedas) | grant (vip|season)}]`.

### `public/data/items.json`
Valores de comida (`belly`, `heal`, `coins`) e coletáveis.

### `public/data/cities/index.json` + `<id>.json`
Gerados por `node tools/build-cities.mjs <pasta com os JSON do OSM>`. Cada cidade: `{id, name, country, half, buildings: [[altura, x1, z1, …]], roads: [[largura, éCalçada, x1, z1, …]], water, beach, green, coast, waterways, landmarks: [[nome, x, z, altura]], elev: {n, size, min, data}, tags}`. O visual (céu `mood`, paleta `pal`, palmeiras, estrelas para desbloquear, cidade natal) fica na tabela `META` do script. As missões de viagem são geradas a partir dos marcos (`tk_*` em i18n).

### Slots de arte (`public/assets/manifest.json`)
`title_bg` (640×960), `portrait_mimo|mimosa|morticia` (512²), `boss_1` … `boss_5` (512², chefões das missões 10-50), `share`/`og_share` (1200×630), `shop_vip`, `shop_season`, `shop_apoio` (512²). Chave ausente = arte procedural.

## 7. As missões

| # | Bairro | Nome (PT / EN) | Tipo | Objetivo | Parâmetros | Par |
|---|---|---|---|---|---|---|
| 1 | Sunset Beach | Rolê na Orla / Boardwalk Stroll | `reach` | Atravessar o bairro até o marcador e limpar os guardas |  | 65s |
| 2 | Sunset Beach | Vira-latas na Areia / Beach Mutts | `waves` | Sobreviver a ondas de cachorros | ondas=3 | 75s |
| 3 | Sunset Beach | Rodízio da Mortícia / Morticia's Buffet | `eat` | Mortícia come X petiscos antes do tempo | n=25, time=110 | 45s |
| 4 | Sunset Beach | Miau por Socorro / Meow for Help | `rescue` | Abrir cercados/jaulas, soltar gatinhos e escoltar | jaulas=fence/bite | 45s |
| 5 | Sunset Beach | O Caminhão de Petiscos / The Treat Truck | `truck` | Abrir o cercado, roubar o caminhão de petiscos e levar para casa | gate=switch, wanted=1 | 45s |
| 6 | Sunset Beach | A Portinha Secreta / The Secret Cat Flap | `rescue` | Abrir cercados/jaulas, soltar gatinhos e escoltar | jaulas=gap/link | 45s |
| 7 | Sunset Beach | Entrega de Sushi / Sushi Delivery | `race` | Corrida de checkpoints contra o relógio | time=80 | 65s |
| 8 | Sunset Beach | Nossa Casinha / Home Sweet Home | `defend` | Defender a casinha/gerador/árvore de ondas | ondas=3 | 80s |
| 9 | Sunset Beach | Fuga da Carrocinha / Dodge the Dog Catchers | `escape` | Fugir da carrocinha (nível de procurado fixo) | wanted=2 | 65s |
| 10 | Sunset Beach | Delegado Bulldogão / Chief Bulldog | `boss` | Luta de chefão na arena | chefão=chief | 100s |
| 11 | Neon Downtown | Mão Leve / Sticky Paws | `steal` | Mortícia rouba X itens dos cachorros | n=5, time=130 | 70s |
| 12 | Neon Downtown | A Chave do Baú / Key to the Truck | `truck` | Abrir o cercado, roubar o caminhão de petiscos e levar para casa | gate=key, wanted=2 | 75s |
| 13 | Neon Downtown | Briga no Beco / Alley Brawl | `waves` | Sobreviver a ondas de cachorros | ondas=4 | 115s |
| 14 | Neon Downtown | Pega a Van! / Catch That Van! | `chase` | No conversível: parar o(s) veículo(s) alvo | time=90, alvos=van | 50s |
| 15 | Neon Downtown | O Cofre de Atum / The Tuna Vault | `vault` | Golpe a três: portão, botão do cofre, portinha, fuga | gate=fence, wanted=2 | 80s |
| 16 | Neon Downtown | Feira Noturna / Night Market | `eat` | Mortícia come X petiscos antes do tempo | n=38, time=120 | 80s |
| 17 | Neon Downtown | Gatinhos do Fliperama / Arcade Kittens | `rescue` | Abrir cercados/jaulas, soltar gatinhos e escoltar | jaulas=switch/key+fence/bite | 95s |
| 18 | Neon Downtown | Travessia Neon / Neon Crossing | `reach` | Atravessar o bairro até o marcador e limpar os guardas | time=150 | 105s |
| 19 | Neon Downtown | Sirenes na Avenida / Sirens on the Avenue | `escape` | Fugir da carrocinha (nível de procurado fixo) | wanted=3 | 85s |
| 20 | Neon Downtown | Madame Poodle / Madame Poodle | `boss` | Luta de chefão na arena | chefão=poodle | 135s |
| 21 | Palm Harbor | Peixe Fresco Expresso / Fresh Fish Express | `race` | Corrida de checkpoints contra o relógio | time=100 | 80s |
| 22 | Palm Harbor | Churrasco no Píer / Pier Barbecue | `defend` | Defender a casinha/gerador/árvore de ondas | ondas=4 | 170s |
| 23 | Palm Harbor | Carga do Cais / Dock Cargo | `truck` | Abrir o cercado, roubar o caminhão de petiscos e levar para casa | gate=gap, wanted=2 | 120s |
| 24 | Palm Harbor | Quebra-Caixotes / Crate Cracker | `cash` | Juntar $X (caixotes, nocautes, roubos) | time=150, cash=220 | 110s |
| 25 | Palm Harbor | Resgate na Marina / Marina Rescue | `rescue` | Abrir cercados/jaulas, soltar gatinhos e escoltar | jaulas=fence/bite+open/key+gap/link | 130s |
| 26 | Palm Harbor | Maré de Latidos / Tide of Barks | `waves` | Sobreviver a ondas de cachorros | ondas=5 | 195s |
| 27 | Palm Harbor | A Limusine do Capitão / The Captain's Limo | `chase` | No conversível: parar o(s) veículo(s) alvo | time=110, alvos=limo | 75s |
| 28 | Palm Harbor | Cofre do Iate Clube / Yacht Club Vault | `vault` | Golpe a três: portão, botão do cofre, portinha, fuga | gate=key, wanted=3 | 80s |
| 29 | Palm Harbor | Cerco no Porto / Harbor Lockdown | `escape` | Fugir da carrocinha (nível de procurado fixo) | wanted=3, survive=50 | 175s |
| 30 | Palm Harbor | Capitão Rottweiler / Captain Rott | `boss` | Luta de chefão na arena | chefão=rott | 190s |
| 31 | Storm Docks | Tempestade no Cais / Storm on the Docks | `reach` | Atravessar o bairro até o marcador e limpar os guardas | time=170 | 135s |
| 32 | Storm Docks | Contêiner 32 / Container 32 | `truck` | Abrir o cercado, roubar o caminhão de petiscos e levar para casa | gate=switch, wanted=3 | 80s |
| 33 | Storm Docks | Fome de Trovão / Thunder Hunger | `eat` | Mortícia come X petiscos antes do tempo | n=48, time=130 | 95s |
| 34 | Storm Docks | O Gerador / The Generator | `defend` | Defender a casinha/gerador/árvore de ondas | ondas=5 | 245s |
| 35 | Storm Docks | Comboio da Carrocinha / Catcher Convoy | `chase` | No conversível: parar o(s) veículo(s) alvo | time=150, alvos=van+van | 105s |
| 36 | Storm Docks | Jaulas na Chuva / Cages in the Rain | `rescue` | Abrir cercados/jaulas, soltar gatinhos e escoltar | jaulas=switch/link+key/bite+fence/key | 230s |
| 37 | Storm Docks | Lanche dos Estivadores / Dockworkers' Lunch | `steal` | Mortícia rouba X itens dos cachorros | n=9, time=150 | 105s |
| 38 | Storm Docks | Cofre do Contrabando / Smuggler's Vault | `vault` | Golpe a três: portão, botão do cofre, portinha, fuga | gate=switch, wanted=3 | 85s |
| 39 | Storm Docks | Quatro Estrelas / Four Stars | `escape` | Fugir da carrocinha (nível de procurado fixo) | wanted=4 | 95s |
| 40 | Storm Docks | Don Pug / Don Pug | `boss` | Luta de chefão na arena | chefão=pug | 230s |
| 41 | Vice Heights | Cobertura de Luxo / Penthouse Payday | `cash` | Juntar $X (caixotes, nocautes, roubos) | time=170, cash=600 | 130s |
| 42 | Vice Heights | Corrida das Colinas / Hillside Rush | `race` | Corrida de checkpoints contra o relógio | time=120 | 95s |
| 43 | Vice Heights | O Grande Golpe do Sachê / The Great Sachet Heist | `truck` | Abrir o cercado, roubar o caminhão de petiscos e levar para casa | gate=key, wanted=4 | 300s |
| 44 | Vice Heights | Última Trincheira / Last Stand | `defend` | Defender a casinha/gerador/árvore de ondas | ondas=6 | 300s |
| 45 | Vice Heights | Ninguém Fica Pra Trás / No Cat Left Behind | `rescue` | Abrir cercados/jaulas, soltar gatinhos e escoltar | jaulas=fence/key+switch/link+gap/link+key/bite | 300s |
| 46 | Vice Heights | Caça ao Caminhão-Jaula / Hunt the Cage Truck | `chase` | No conversível: parar o(s) veículo(s) alvo | time=170, alvos=van+limo | 135s |
| 47 | Vice Heights | Tropa de Elite Canina / Canine Elite Squad | `waves` | Sobreviver a ondas de cachorros | ondas=6 | 300s |
| 48 | Vice Heights | O Cofre do Rei / The King's Vault | `vault` | Golpe a três: portão, botão do cofre, portinha, fuga | gate=gap, wanted=4 | 90s |
| 49 | Vice Heights | Cinco Estrelas / Five Stars | `escape` | Fugir da carrocinha (nível de procurado fixo) | wanted=5, survive=30 | 170s |
| 50 | Vice Heights | O Rei da Carrocinha / The Dog Catcher King | `boss` | Luta de chefão na arena | chefão=dogcatcher | 300s |
| 51 | Marina Dourada | Volta de Ouro / Golden Lap | `race` | Corrida de checkpoints contra o relógio | time=110 | 90s |
| 52 | Marina Dourada | Buffet do Iate / Yacht Buffet | `eat` | Mortícia come X petiscos antes do tempo | n=42, time=125 | 75s |
| 53 | Marina Dourada | Cofre do Comodoro / Commodore's Vault | `vault` | Golpe a três: portão, botão do cofre, portinha, fuga | gate=fence, wanted=2 | 60s |
| 54 | Marina Dourada | Festa no Convés / Deck Party | `waves` | Sobreviver a ondas de cachorros | ondas=5 | 230s |
| 55 | Marina Dourada | Regata Dourada / Golden Regatta | `chase` | No conversível: parar o(s) veículo(s) alvo | time=160, alvos=limo+limo | 130s |
| 61 | Natal Neon | Entrega de Presentes / Gift Delivery | `race` | Corrida de checkpoints contra o relógio | time=100 | 75s |
| 62 | Natal Neon | Ceia de Natal / Christmas Feast | `eat` | Mortícia come X petiscos antes do tempo | n=36, time=120 | 95s |
| 63 | Natal Neon | Gatinhos de Natal / Christmas Kittens | `rescue` | Abrir cercados/jaulas, soltar gatinhos e escoltar | jaulas=fence/bite+switch/link+gap/link | 165s |
| 64 | Natal Neon | A Árvore de Natal / The Christmas Tree | `defend` | Defender a casinha/gerador/árvore de ondas | ondas=5 | 220s |

Chefões: 10 **Delegado Bulldogão** (investida, pancada, redes, reforços) · 20 **Madame Poodle** (perfume em anel, barris) · 30 **Capitão Rottweiler** (âncora) · 40 **Don Pug** (robô aspirador que suga) · 50 **O Rei da Carrocinha** (tudo junto). Ciclo: Mimosa quebra a armadura → chefão exposto → Mortícia rouba o lanche (senão ele come e se cura) → todos batem.

## 8. Desempenho

Geometria mesclada com cores por vértice, InstancedMesh para palmeiras/postes/sombras, ~60-80 draw calls, sem sombras reais (blobs), brilho falso com sprites aditivos, pixel ratio limitado (1.5 no celular), qualidade automática por FPS medido (ou manual em Ajustes), tratamento de perda de contexto WebGL e tela amigável sem WebGL.

## 9. Testes

Scripts Playwright em `tests/e2e/` (ver README): bot que joga todas as missões de forma acelerada, testes de controles (teclado/mouse/toque), loja e contas com API simulada, capturas de tela.
