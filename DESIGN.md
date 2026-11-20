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
  js/missions.js  tipos de missão + passos de objetivo, mundo livre, Volta ao Mundo, desafios diários e eventos semanais
  js/minigames.js modelos novos (escolta, furtivo, fotos, entregas, duelo, parkour, pipas, vôlei, pesca, golpe, gatinhos, treino) e as missões de cidade real
  js/hud.js       HUD 2D por cima do WebGL (retratos, radar, controles de toque, rótulos projetados)
  js/ui.js        telas HTML, loop principal, ranking, compartilhar, ganchos de teste (window.__vp)
  js/shop.js      Loja dos Mimos (Pix), provador, restaurar, mural
  js/wardrobe.js  Guarda-roupa por slots
  js/accounts.js  login por código, Meus gatos (criador), save na nuvem, galeria
  js/tour.js      Volta ao Mundo: mapa (Brasil/mundo), alfinetes, cartões por país com progresso, voo animado
  js/share.js     cartão PNG 1080×1350 para compartilhar e links "Desafie um amigo"
  js/gfx/models.js   modelos low-poly paramétricos (buildCat(spec), cachorros, carros, props) em geometria mesclada
  js/gfx/city.js     cidade 3D estática (chão, prédios, neon, palmeiras, céu, água)
  js/gfx/realcity.js cidade real 3D (terreno com elevação, vias, prédios extrudados, marcos)
  js/gfx/lod.js      blocos espaciais com frustum culling, corte por distância e LOD de instâncias
  js/gfx/render.js   renderizador: sincroniza a simulação com a cena, câmera, partículas, qualidade automática
api/              funções Vercel: scores, pix/*, auth, me, cats, save (ver docs/ACCOUNTS.md)
tools/build-cities.mjs  copia os extratos OSM e gera data/cities/index.json
tools/city-meta.mjs     visual de cada cidade (META) e destinos previstos (PLANNED); usado pelo build e pelos testes
tools/gen-missions.mjs  tabelas dos 15 capítulos -> data/missions.json (calibra o tempo-alvo com os resultados do bot)
tools/gen-packs.mjs     pacotes de missões por cidade e eventos semanais -> data/citypacks.json, data/events.json
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

**Cidades esparsas (preenchimento procedural).** Muitas cidades têm todas as ruas no OpenStreetMap e quase nenhum prédio (Rio Verde: 162 ruas, 22 prédios). `World.fromCity` mede a fração construída (`w.builtRatio`); abaixo de 5% (ou com a tag `infill`; `noinfill` ou `"infill": false` desligam) chama `World.infill(C, w, occ)`: percorre cada rua por comprimento de arco, dos dois lados, e encaixa lotes retangulares na testada (recuo de calçada, sem cobrir rua, beco, água, parque, praia nem prédio mapeado; células de 120 m que já têm prédios do OSM ficam como estão). Cada lote vira `house`, `shop` ou `block` conforme o estilo (`World.STYLES`, escolhido por país/tags em `World.styleOf`): `br_interior` (casas coloridas com muro e portão, telha de barro, lojas com toldo, ipês), `br_coast`, `us`, `eu`, `asia` (letreiros neon), `desert`. Tudo sai de `U.rng(hash(id))`, então a cidade é igual para todo mundo; as ruas mais centrais são preenchidas primeiro (teto de 1300 lotes). Os lotes entram na grade da simulação (colisão) e `realcity.js` desenha os mesmos lotes (`W.infill`, `W.infillTrees`); quintais longe de qualquer rua viram grama. Para dar um estilo a uma cidade específica: `"style": "eu"` no JSON.

**Horizonte.** `SKYLINE` em `realcity.js` lista marcos (hoje Cristo Redentor e Pão de Açúcar) que aparecem como silhueta low-poly fora do mapa, na direção real, em qualquer cidade a menos de 14 km (sem neblina, desenhados depois do céu). Ao chegar numa cidade real a câmera começa baixa, olhando o horizonte (e o marco, se houver), e sobe em ~4 s (`R.arrive`).

**Volta ao Mundo.** `World.fromCity(json)` rasteriza um extrato do OpenStreetMap (3 m por tile) na mesma grade da simulação; `realcity.js` constrói o 3D (terreno com `elev`, vias em fitas, prédios extrudados, marcos como faróis). Mapas com tag `comunidade` não têm polícia, procurado, trânsito nem cachorros hostis: só missões positivas (ver §6, regra aplicada no código, não só nos dados). Atribuição "© OpenStreetMap contributors" aparece na tela de viagem e no HUD dos mapas reais.

**Parkour de telhado.** `Game.addCourse(plats, pads)` cria um percurso sem sair da simulação 2D: plataformas são retângulos com altura (`{x, y, hw, hh, h, solid}`), o gato líder sobe qualquer degrau de até 0,85 só andando (`pkMove`), salta sozinho um vão de até 150 px quando sai da borda em direção a outra plataforma, cai sem dano em qualquer outro caso, e os trampolins (`pads`) lançam em arco até a plataforma de destino. Caixote alto demais é parede para quem está no chão; toldos e telhados sobre postes deixam passar por baixo. `minigames.js` (`courseSite` + `buildCourse`) procura o trecho reto livre mais longo perto da largada (670 px mínimo; com 1000 px entra o trampolim e o telhado alto) e monta: 3 caixotes, toldo, vão, telhado, trampolim, telhado alto. Vale para o tipo `parkour` da cidade e para o `kind: parkour` das cidades reais; `params.flat: true` desliga. Sem botão de pulo: mesma jogabilidade no toque e no teclado. O bot joga o percurso pelos mesmos passos.

## 4. Controles

- **Celular (retrato):** analógico esquerdo anda (relativo à câmera); direito mira/ataca (segurar = mira automática); botões: especial, dash, ação (reanimar / entrar e sair do carro); toque nos retratos troca de gato; pausa.
- **PC:** WASD/setas, mouse mira, clique ataca, Espaço especial, Shift dash, E ação, 1/2/3 ou Q troca, botão direito gira a câmera, P pausa, M mudo.
- **Emotes:** `Game.emote('miau'|'dance'|'sit'|'wave')` no gato ativo; no celular o botão 😺 (só na cidade livre e nas visitas, a pé) abre quatro botões grandes; no PC, Z X C V. Andar ou atacar encerra o gesto. O emote viaja em `Game.snapshot()` (`cats[i].e`), pronto para o mundo compartilhado.
- **Vibração:** `VP.haptic(ms)` (golpes dados e recebidos, batidas, trampolim) usa `navigator.vibrate` quando existe e a tela é de toque; iOS ignora em silêncio. Liga/desliga em Ajustes (`vp_haptic`).
- **HUD no celular:** a caixa do objetivo fica abaixo do minimapa e do nome do bairro, com letra um pouco maior; rótulos do mundo (missões, loja, cartões-postais) não se sobrepõem nem passam por baixo do HUD; a seta do objetivo fica acima dos botões; seguidores que entram na frente da câmera somem do quadro.

## 5. Loja (honesta)

Jogo grátis e 100% zerável sem pagar. Sem sorteio, sem caixas, sem pressão. `vip` R$4,90 (roupas, rastro, conversível dourado com neon e buzina, dança, coroa no ranking, bairro bônus Marina Dourada), `season` R$2,90 (Natal Neon: 4 missões + neve e decoração), `lives10` R$1,99, `supporter_small` R$0,99 e `apoio5/10/20` (selo, nome dourado, mural), e os pacotes de visual `skin_praia` R$0,99, `skin_agro` R$0,99, `skin_festa` R$1,99, `skin_natal` R$1,99 (só roupas e acessórios; dá para provar no guarda-roupa antes). O preço vale sempre de `api/pix/_products.js`; não existe dobrador de moedas nem item que mude a dificuldade. Provador com pedestal 3D e volta de teste de 20 s. Checkout Pix com QR, copia-e-cola, consulta a cada 4 s por até 30 min, confete, código de compra; restaurar por código; 503 → "Loja abre em breve 🐾". Grants aplicados uma única vez por id de pagamento (`vp_purchases`). No máximo um cartão dispensável do VIP por sessão, só em tela de bairro concluído.

## 6. Conteúdo orientado a dados (para expandir sem tocar no motor)

### `public/data/missions.json`
```json
{ "districts": [{ "id": 0, "geo": 0, "song": 0, "from": 1, "to": 10, "grant": null, "name": {"pt": "…", "en": "…"} }],
  "missions":  [{ "n": 1, "type": "reach", "name": {"pt": "…", "en": "…"}, "lv": 1, "par": 65, "boss": "chief", "params": { } }] }
```
- `geo` = bairro físico (0 Beach, 1 Downtown, 2 Harbor, 3 Docks, 4 Heights); `grant` = `vip`/`season` para bairros bônus; `song` 0-7. O `id` do distrito é o índice na lista.
- **Capítulos** (`"arc": true`): `req: {stars: N, after?: n}` abre o capítulo com N estrelas no total (e/ou depois da missão n); dentro dele as missões abrem em sequência. `col` = duas cores do cartão, `intro` = texto do capítulo. Cada capítulo aberto ganha um feixe azul no bairro (`geo`) dele.
- Missão: `talk: [[gato, pt, en]]` = fala mostrada no briefing e no começo da missão; `geo` opcional troca o bairro só daquela missão.
- `lv` escala vida/dano/tamanho dos grupos pela curva `Game.eff(lv)` (acima de 20 o nível efetivo cresce na metade do ritmo: 50 → 35), o que deixou o fim de Vice Heights mais justo; `par` = tempo da 3ª estrela; missões com `n` entre `from` e `to` de um distrito pertencem a ele. Para um novo capítulo: adicione um distrito com nova faixa de `n` e as missões.
- `type` e `params`: `reach {groups, time?, tut?}` · `waves {waves: N | [[tipos]], arena?}` · `eat {n, time, hunger?}` · `steal {n, time}` · `cash {cash, time}` · `rescue {cages: [[portão, tranca]]}` (portão `fence|switch|gap|key|open`, tranca `bite|key|link`) · `truck {gate, wanted, heavy?}` · `vault {gate, wanted}` · `escape {wanted, car?, survive?}` · `chase {targets: [van|limo|…], time, drop?}` · `race {cps, time}` · `defend {waves, gen?}` · `boss {}` (+ `"boss": chief|poodle|rott|pug|dogcatcher`).
- Modelos novos: `escort {stops, from?, to?, vip?, last?}` (acompanhar um gato lento; os cachorros miram nele) · `stealth {dogs, wake?, bags?, time?}` (Mortícia solo entre cachorros dormindo; o anel azul é o raio que acorda; o sumiço atravessa) · `photo {n, groups?, time?}` · `chain {stops, car? (1 conversível, 2 caminhonete), bonus?, thieves?}` · `duel {elite: tipo, hp}` (valentão com vida multiplicada que chama reforço a 66% e 33%) · `parkour {cps, time?}` (a pé, sem carro) · `kites {n, time, max?}` · `volley {points, speed?}` (3 bolas no chão = falha) · `fish {n, time, groups?}` (esperar o ❗ e tocar em atacar) · `heist {time, wanted, drop?}` (bater no caminhão em movimento, subir nele e levar para casa) · `kittens {kinds: [free|guard|cage…]}`.
- Tipos de cachorro: `mutt, chi, cop, shooter, catcher, heavy`.
- Para criar um tipo novo: registre `TYPES.nome = { setup(B) {…} }` em `minigames.js` usando os passos (`B.goto`, `B.wave`, `B.step({txt, at, done, tick, exit, fail, prog})`). O bot de teste lê os mesmos passos (`cat`, `act`, `fight`, `car`, `sneak`, `tap`+`ready`, `mini`).

### Desafios do dia e evento da semana
`Missions.daily(data)` sorteia 3 desafios com uma semente feita da data (vencer / vencer sem desmaiar / vencer abaixo do tempo) entre as missões já abertas: a mesma data e o mesmo progresso dão sempre os mesmos três. Recompensa em moedas e, completando os três, +1 vida e sequência de dias. `data/events.json`: `{epoch, events: [{id, icon, name, desc, types: [tipos ou kinds], tour?, mult}]}`; um evento por semana em rodízio, que só multiplica moedas das missões daquele tipo (`Missions.weeklyHooks` fica reservado para ganchos futuros). Nada disso vende nada.

### `public/data/activities.json`
`pawsPerDistrict`, `trials: [{id, d, lv, name, start: [i, j], cps: [[i, j]…], time, reward}]` (cruzamentos da grade, i 0-12, j 0-8) e `quests: [{id, d, npc: f0-f3, spot: papel do bairro, name, text, type: eat|ko|steal|cash, n, reward}]`.

### `public/data/outfits.json`
`slots: [head, eyes, neck, body, back, trail]`, `defaults` por gato, `sets` (vip/season), `packs: {grant: {product, icon}}` e `items: [{id, slot, name, acc: {…chaves de acc do buildCat…} | trail: {shape: star|heart|dot, col}, free | price (moedas) | grant (vip|season|pack_praia|pack_agro|pack_festa|pack_natal)}]`. São 80 itens (cabeça 21, olhos 9, pescoço 13, roupa 19, costas 10, rastro 8). Chaves novas de `acc`: `cowboy`+`band`, `antlers`, `party`, `halo`, `phones`, `flowers: [cores]`, `beanie`+`trim2`, `star`, `bells`, `lei: [cores]`, `board`, `guitar`, `balloon`, `gift`.

### `public/data/items.json`
Valores de comida (`belly`, `heal`, `coins`) e coletáveis.

### `public/data/cities/index.json` + `<id>.json`
Gerados por `node tools/build-cities.mjs <pasta com os JSON do OSM>`. Cada cidade: `{id, name, country, lat, lon, half, buildings: [[altura, x1, z1, …]], roads: [[largura, éCalçada, x1, z1, …]], water, beach, green, coast, waterways, landmarks: [[nome, x, z, altura]], elev: {n, size, min, data}, tags}`. O visual (céu `mood`, paleta `pal`, palmeiras, estrelas para desbloquear, cidade natal) fica na tabela `META` do script.
- **Relevo (`elev`)**: grade n×n em ordem de linha, `j` para o sul (+z) e `i` para o leste (+x), metros acima de `min`, cobrindo `[-size/2, size/2]`. `World.fromCity` expõe `W.hM(x, z)` / `W.hpx(px, py)` (bilinear). A simulação usa isso para a velocidade (subida até 45% mais lenta, descida até 15% mais rápida, carros também) e o renderizador assenta terreno, vias, prédios, objetos e câmera na mesma função. Calçadas íngremes viram escadarias; prédios que cobririam vias ou becos são encolhidos para manter a passagem livre.
- **Tags**: `comunidade` (regras abaixo), `morro` (câmera mais alta, tempos-alvo maiores), `beach` (vôlei e altinha na areia; se houver costa e nenhum polígono de praia, uma faixa de ~60 m de areia é gerada ao longo do mar), `hometown` (primeira da lista, sem exigir estrelas), `landmark`, `neon`.
- **Comunidade**: casas coloridas empilhadas, escadarias com degraus pintados, murais, caixas-d'água, pipas, campinho e lajes com futebol, gatos vizinhos passeando. `G.noPolice`/`G.noHeat`, sem trânsito e sem cachorros. As missões vêm do modelo `comunidade` e passam pelo filtro `Missions.COMU_SAFE` (compras da vovó, patinhas na escadaria, concurso de pipas, gatinho no telhado, altinha na laje, rota dos murais, entregas morro acima, subida do mirante, lanche da tarde, bolo de aniversário): mesmo que um pacote peça outra coisa, o código troca por uma missão positiva.
- **`data/citypacks.json`**: `{templates: [10], comunidade: [10], packs: {id: {places: [[nome, lat, lon]], missions: [{kind, name, story, params?, at?: [nomes de marcos/lugares], needs?: [tags], par?}]}}}`. Cidade com pacote usa o pacote; sem pacote usa `templates` (ou `comunidade`), então toda cidade nova já chega com 10 missões. `kind`: `race, photo, deliver, feast, chain, kites, parkour, brawl, rescue, escape, groceries, paws, football, volley, treats, fish, kiterun`. Os `places` (aproximados) são encaixados na rua mais próxima e servem de destino das missões. O número da missão é `1000 + ordem da cidade em META × 10 + k`.
- **Rio Verde (`rioverde`)**: cidade natal do dono, com pacote próprio de 10 missões amistosas, caminhonetes (trânsito, estacionadas e nas missões de carro), feira agropecuária ao lado da chegada (barracas, fardos de feno, gado, bandeirinhas), gatos fazendeiros e a faixa sertaneja (`song` 7). Basta o arquivo chegar em `vp_art/cities/` e rodar `node tools/build-cities.mjs`.
- Nomes de lugares passam por um filtro de classificação livre antes de aparecer na tela.

### Volta ao Mundo: catálogo, progresso e destravamento
`index.json` (versão 2) traz, por cidade, `lat`/`lon` (alfinete no mapa), `flag`, `mood`, `pal`, `palms`, `stars` (estrelas para abrir; Miami e Rio = 0, cidade natal = 0) e uma lista `soon` com os destinos previstos que ainda não chegaram (pontos "em breve"). `Tour.progress(c)` soma as estrelas das 10 missões (`M.tourBase`), as 5 patinhas (`S.paws[id_i]`) e os cartões-postais vistos. A tela agrupa por país (Brasil primeiro, cidade natal no topo), o mapa é um SVG equiretangular com contornos low-poly desenhados à mão (`LAND`, `BRAZIL` em `tour.js`), e `Tour.flight` anima o avião numa curva enquanto `Tour.load` baixa o mapa. Nenhuma cidade é vendida.

### Pacotes de cidade antes do mapa chegar
Os pacotes usam `places: [[nome, lat, lon]]` (encaixados na rua ligada mais próxima, raio de ~165 m) e `at: [nomes]` nas missões; como não dependem dos nomes do extrato, podem ser escritos antes do arquivo existir e passam a valer quando ele aparece. `tests/helpers/planned.cjs` monta um mapa substituto com as coordenadas previstas (`tools/city-meta.mjs` → `PLANNED`) e `tests/e2e/packs.cjs` joga as 10 missões de cada pacote com o bot, no mapa real quando existe. Rio Verde não usa coordenadas de propósito: os destinos saem dos marcos do próprio extrato, para não rotular errado a cidade natal.

### Ranking e galeria
O ranking soma todas as missões: o cliente envia `score` (soma de `S.best`), `stars` (todas), `missions` (quantas missões diferentes têm estrela) e `level` (última da história, só para exibir em linhas antigas). `api/_lib/score.js` valida (até 3 estrelas e 25 mil pontos por missão; clientes antigos sem `missions` seguem a regra das 50). A tela "Cidade dos Gatos" (`accounts.js`) lista `/api/cats/public` com um retrato 3D por gato (`R3.snapshot`), abre cada um no palco 3D e leva para a cidade, onde os mesmos gatos passeiam.

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


### Capítulos (missões 201-350)

Cada capítulo tem 10 missões com uma fala de um dos gatos e termina num duelo. Abrem pelo total de estrelas.

| # | Capítulo (PT / EN) | Bairro | Abre com | Níveis | Tipos |
|---|---|---|---|---|---|
| 201-210 | Verão na Orla / Boardwalk Summer | Sunset Beach | 6⭐ | 3-11 | `volley`, `kites`, `fish`, `photo`, `chain`, `parkour`, `escort`, `eat`, `kittens`, `duel` |
| 211-220 | Becos de Neon / Neon Alleys | Neon Downtown | 15⭐ | 9-18 | `stealth`, `photo`, `chain`, `parkour`, `steal`, `kittens`, `waves`, `heist`, `escort`, `duel` |
| 221-230 | Maré Alta / High Tide | Palm Harbor | 27⭐ | 14-23 | `fish`, `volley`, `kites`, `chain`, `escort`, `cash`, `heist`, `rescue`, `chase`, `duel` |
| 231-240 | Noite de Tempestade / Stormy Night | Storm Docks | 40⭐ | 19-28 | `stealth`, `kittens`, `parkour`, `defend`, `fish`, `truck`, `photo`, `escape`, `heist`, `duel` |
| 241-250 | Luxo nas Colinas / Hillside Luxury | Vice Heights | 55⭐ | 24-33 | `photo`, `stealth`, `volley`, `chain`, `vault`, `escort`, `kites`, `cash`, `parkour`, `duel` |
| 251-260 | Festival das Pipas / Kite Festival | Sunset Beach | 70⭐ | 12-19 | `kites`, `chain`, `photo`, `kites`, `escort`, `parkour`, `waves`, `eat`, `kites`, `duel` |
| 261-270 | Os Gatinhos Perdidos / The Lost Kittens | Neon Downtown | 88⭐ | 22-30 | `kittens`, `photo`, `rescue`, `stealth`, `kittens`, `escort`, `chase`, `defend`, `kittens`, `duel` |
| 271-280 | Rota dos Petiscos / Treat Route | Palm Harbor | 105⭐ | 26-34 | `chain`, `heist`, `eat`, `truck`, `steal`, `chain`, `cash`, `heist`, `vault`, `duel` |
| 281-290 | Operação Soneca / Operation Nap | Storm Docks | 125⭐ | 30-38 | `stealth`, `steal`, `stealth`, `photo`, `rescue`, `vault`, `stealth`, `escape`, `heist`, `duel` |
| 291-300 | Liga dos Vira-Latas / The Mutt League | Vice Heights | 145⭐ | 34-42 | `duel`, `waves`, `duel`, `steal`, `duel`, `defend`, `duel`, `cash`, `waves`, `duel` |
| 301-310 | Copa das Patas / The Paw Cup | Sunset Beach | 165⭐ | 30-36 | `volley`, `race`, `fish`, `volley`, `parkour`, `kites`, `volley`, `chase`, `volley`, `duel` |
| 311-320 | Paparazzi Felino / Feline Paparazzi | Neon Downtown | 190⭐ | 34-40 | `photo`, `escape`, `chain`, `chase`, `stealth`, `escort`, `photo`, `waves`, `heist`, `duel` |
| 321-330 | Pescaria Lendária / Legendary Fishing | Palm Harbor | 215⭐ | 38-44 | `fish`, `chain`, `steal`, `fish`, `defend`, `escort`, `chase`, `kittens`, `fish`, `duel` |
| 331-340 | Blecaute nas Docas / Docks Blackout | Storm Docks | 240⭐ | 42-48 | `defend`, `stealth`, `rescue`, `chain`, `truck`, `kittens`, `escape`, `waves`, `vault`, `duel` |
| 341-350 | A Grande Festa / The Grand Party | Vice Heights | 270⭐ | 46-52 | `chain`, `heist`, `escort`, `kites`, `photo`, `defend`, `volley`, `kittens`, `waves`, `duel` |

Total: **209 missões** — `duel` 19, `waves` 12, `rescue` 11, `defend` 11, `chain` 11, `chase` 10, `photo` 10, `escape` 9, `vault` 9, `escort` 9, `kittens` 9, `stealth` 9, `eat` 8, `truck` 8, `volley` 8, `kites` 8, `heist` 8, `steal` 7, `fish` 7, `race` 6, `cash` 6, `parkour` 6, `boss` 5, `reach` 3.

Chefões: 10 **Delegado Bulldogão** (investida, pancada, redes, reforços) · 20 **Madame Poodle** (perfume em anel, barris) · 30 **Capitão Rottweiler** (âncora) · 40 **Don Pug** (robô aspirador que suga) · 50 **O Rei da Carrocinha** (tudo junto). Ciclo: Mimosa quebra a armadura → chefão exposto → Mortícia rouba o lanche (senão ele come e se cura) → todos batem.

## 8. Desempenho

- Geometria mesclada com cores por vértice, **dividida em blocos espaciais** (`gfx/lod.js`, 56-80 unidades) com esfera envolvente: o Three.js só desenha os blocos dentro da câmera (frustum culling) e os que passam da neblina são escondidos. Blocos de detalhe (neon, enfeites, murais, postes) somem antes, conforme a qualidade.
- Palmeiras/árvores e postes são `InstancedMesh` por bloco com **dois níveis de detalhe** (palmeira de ~300 triângulos perto, ~56 longe).
- Qualidade **leve / médio / alto / auto** em Ajustes (com contador de FPS opcional). Auto mede o FPS e desce de nível quando fica abaixo de 27. No nível leve os personagens são montados com esferas mais simples (~40% dos triângulos), o pixel ratio fica em 1 e a neblina fecha 25% antes.
- Sem sombras reais (blobs), brilho falso com sprites aditivos, pixel ratio limitado (1 / 1,25 / 1,5 no celular), tratamento de perda de contexto WebGL e tela amigável sem WebGL.
- Medido com `node tests/e2e/perf.cjs 4` (Chromium com WebGL por software e CPU 4x mais lenta; serve para comparar versões, não como FPS de celular): cidade livre no nível leve caiu de 214 mil para ~66 mil triângulos visíveis.

## 9. Testes

Scripts Playwright em `tests/e2e/` (ver README): bot que joga todas as missões de forma acelerada (`missions.cjs`), testes de controles (teclado/mouse/toque), loja e contas com API simulada, `expansion.cjs` (modelos novos, diário/semanal, treino no toque, relevo e regras de comunidade com um mapa sintético de `tests/helpers/elev-fixture.cjs` servido por rota sem tocar no arquivo real, Rio Verde com mapa substituto, cartão de compartilhar, pacotes, orçamento de triângulos), `perf.cjs` e `shots.cjs`. `npm test` também valida o conteúdo (`tests/data.test.mjs`): 200+ missões, capítulos, catálogo da loja x preços do cliente, guarda-roupa, pacotes de cidade e eventos. `expansion2.cjs` cobre a expansão 2 (preenchimento procedural determinístico e sem cobrir ruas, estilos por país, horizonte do Rio, mapa-múndi no toque e no desktop, ranking, galeria, emotes, vibração, parkour de telhado, HUD no celular e o peso da primeira carga, abaixo de 2,5 MB sem baixar cidade nenhuma); `packs.cjs` joga todos os pacotes de cidade; `tests/score.test.mjs` valida as regras do ranking.
