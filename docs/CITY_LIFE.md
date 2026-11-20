# Vida na cidade (city life)

A cidade livre e as cidades reais agora têm gente, bichos, trânsito, barracas e coisas de gato para fazer. Tudo é amigável: ninguém
se machuca, ninguém xinga, nada custa dinheiro de verdade.

## Arquivos

```
public/data/stalls.json     barracas e lojas: itens, preços em Moedas, efeito, favor grátis, onde ficam
public/data/npcs.json       limites por aparelho, raios de aparição, cores de gente, gatos de rua, cachorros, chances
public/js/life/logic.js     lógica pura (testada em tests/life.test.mjs): rede de calçadas, regras de aparição, semáforos, checagem de dados, moedas
public/js/life/i18n.js      falas e textos (chaves lf_*, PT-BR e EN; variantes separadas por "|")
public/js/life/sim.js       VP.Life: pedestres, gatos e cachorros, pombos, borboletas, reações, gancho do botão de ação
public/js/life/traffic.js   ônibus, vans e motos; semáforos; "Ufa!"; API VP.Life.traffic
public/js/life/shops.js     barracas, compra, efeitos na HUD, favores (minijogos), painéis (DOM)
public/js/life/props.js     atividades de gato, brinquedos, relógio dia/noite, chuva e poças, rádio, lista de Atividades
public/js/life/celebs.js    os Mimos como celebridades (quando o jogador não joga com eles), selfie, "Quero esse look"
public/js/life/photo.js     modo foto (pose, girar, tirar, salvar no aparelho)
public/js/life/hud.js       balões de fala, placas, "E: Interagir", ícones no radar, botão do celular, menu, Atividades
public/js/life/gfx.js       desenho em 3D (InstancedMesh), dia/noite/chuva, colisão suave da câmera
public/js/minimap.js        mapa grande com ícones, legenda, zoom, destino com rota no radar
public/css/life.css         estilo dos painéis
```

Estado em `G.life` (criado no primeiro `Life.update`). Na cidade livre e nas cidades reais o modo é completo; **dentro de missões**
só aparece gente andando (modo `ambient`: sem lojas, sem trânsito extra, sem interação), para não mexer no equilíbrio nem nos testes das missões.

## Gente e bichos

- **Rede de calçadas** (`LL.gridNet` na cidade do jogo: anel de calçada de cada quarteirão, faixas de pedestre ligadas ao semáforo da esquina,
  caminhos por praças e parques; `LL.roadNet` nas cidades reais: as duas beiradas de cada rua e o meio das vias de pedestre do OpenStreetMap).
  Nós sem chão livre e trechos sem linha de visão são descartados, então a rede se adapta a mapas maiores.
- **Aparição**: num anel em volta do líder (`radius` em `npcs.json`), de preferência à frente da câmera, crescendo de tamanho ao surgir;
  somem longe. O teto (`caps`) depende da qualidade gráfica, do celular e de um regulador que mede o FPS a cada 2 s.
- **Papéis**: caminhante, dupla conversando, corredor, passeador de cachorro (com guia), turista fotografando, criança, gente comendo, gente no banco,
  vendedores, garçom, dono da loja de sofás, fãs.
- **Reações**: miar (emote 😺) faz as pessoas dizerem "Own, que gatinho!" e fazerem carinho (cura um pouco) ou darem petisco; crianças seguem o gato;
  o garçom espanta da mesa (três miados amolecem e ele dá um peixinho); se a Mortícia rouba o lanche de alguém (botão de ataque perto de quem
  está comendo), o dono leva um susto, corre atrás de braços para cima e desiste; gatos de rua viram amigos e seguem por um tempo ou bufam e
  correm (sentar acalma os tímidos); a Turma do Beco dá dica e uma vaquinha por dia; gatos nas janelas respondem ao miado; pombos voam.

## Trânsito

Ônibus, vans de entrega e motos seguem a faixa, param no vermelho e antes da faixa de pedestres, freiam e buzinam para gatos, gente e
outros carros. Os carros que o jogo já tinha (`ai: 'traffic'`) passam a respeitar o semáforo e os pedestres. Ninguém é atropelado: gato
na frente de veículo em movimento ganha um "Ufa!", um pulinho e uma buzinada. Carro dirigido pelo jogador faz as pessoas pularem de lado e perde velocidade.

API para outros módulos (`VP.Life.traffic`): `list()`, `near(x, y, r)`, `light(i, j)`, `mustStop(x, y, dir)`, `pause(on)`, `clear(x, y, r)`.

## Barracas e lojas (`stalls.json`)

```json
{ "id": "hotdog", "icon": "🌭", "model": "cart|shop|fair", "cols": ["#..", "#.."], "stand": "hotdog",
  "name": {"pt": "…", "en": "…"}, "hello": {"pt": "…", "en": "…"},
  "items": [{ "id": "salsicha", "icon": "🌭", "art": "hotdog", "price": 15, "prog": "racao?",
              "buff": { "kind": "energy|heal|life|speed|cooldown|belly|regen|catnip|toy", "amount": 100, "dur": 45 },
              "name": {…}, "desc": {…} }],
  "favor": { "kind": "meow|photo|pigeons|mouse|delivery", "reward": "salsicha", "name": {…}, "desc": {…} } }
```

- `stand` liga a barraca às barraquinhas que a cidade já tinha (cachorro-quente, sushi, rosquinha): agora dá para chegar perto e comprar.
- `placement.home`: para cada bairro, em qual lote (papel) e de que lado fica cada loja; `placement.real`: ordem e espaçamento nas cidades reais.
- `prog`: se o módulo de progressão existir (`VP.Prog.give`), o item vai para a mochila; senão (ou com a mochila cheia) o efeito é aplicado na hora.
- Cada barraca tem um **favor** grátis (minijogo curto) que paga com a comida da casa; depois de feito, descansa 2 minutos.
- `LL.checkStalls` recusa arquivo com preço fora de 1-500, texto sem tradução, efeito desconhecido, favor sem prêmio ou menção a dinheiro de verdade.

## Coisas de gato

Derrubar copos das mesas (pontos), dormir na caixa de papelão (vida cheia, passa o tempo, salva), arranhar o sofá da vitrine (o dono corre atrás),
subir no ar-condicionado, no toldo e no telhado (percurso de parkour: é só andar), cantinho de sol (cura), pontinho laser, borboletas, novelo,
modo foto, rádio com 3 estações (músicas do `audio.js`), dia e noite com postes acesos, chuva com poças. Os pontos de travessura viram algumas moedas.

## Mapa, destino e Atividades

Tocar no radar (ou `N`) abre o mapa grande com ícones (comida, lojas, clínica, missões, amigos, diversão). Um toque marca o destino: aparece a rota no
radar, um feixe no mundo e a distância. O botão 📱 (ou `T`) abre o celular: Mapa, Atividades perto de você (toque = marcar destino), Rádio e Foto.
Teclas: `E` interagir, `N` mapa, `T` celular, `O` rádio, `U` foto.

## Celebridades

Quando o jogador não está jogando com Mimo, Mimosa e Mortícia (`VP.Party.active()`), eles aparecem numa praça com o "Look dos Mimos da semana",
cercados de fãs com câmeras. Chegando perto: selfie (modo foto com a estrela olhando para a câmera) e "Quero esse look" (lista dos itens e atalho para o
guarda-roupa). O look vem de `getMimosShowcaseLook()` (feat/progression); sem ela, `Life.showcaseLook()` devolve as roupas padrão (`outfits.json → defaults`).

## Ganchos em arquivos que já existiam (todos marcados `HOOK city-life`)

| Arquivo | Gancho |
|---|---|
| `public/index.html` | uma linha com os `<script>` do módulo |
| `public/js/game.js` | `Game.update`: `VP.Life.update(G, dt)` depois de `Missions.update`; `updContext`: `VP.Life.context(G, c)` antes de "entrar no carro" |
| `public/js/hud.js` | `H.hit`: `LifeHUD.hit` (botão do celular, toque no radar); `H.draw`: `LifeHUD.draw` depois do radar; `controls`: botão de ação com ícone e texto do que está em foco |
| `public/js/gfx/render.js` | `R.render`: `LifeGfx.sync(G, dt, ctx)` depois de `applyMood`; `updateCamera`: `LifeGfx.camClip` (colisão suave) |
| `public/js/life/celebs.js` | substituto de `getMimosShowcaseLook()` |

## Testes

`npm test` (inclui `tests/life.test.mjs`) e `node tests/e2e/citylife.cjs` (Playwright: cidade cheia, trânsito que freia, compra, favores, reações,
atividades, mapa e destino, foto, noite, chuva, celebridades, missões, Copacabana e Santa Marta; capturas em `$VP_SHOTS`).
