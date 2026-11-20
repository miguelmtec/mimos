# VICE PAWS 🐾🌴

Jogo de fã em **3D de mundo aberto** com os gatos **Mimo, Mimosa e Mortícia**, do Instagram [@mimo.mimosa.morticia](https://www.instagram.com/mimo.mimosa.morticia/). Uma cidade neon estilo anos 80, 50 missões de história, chefões, carros, polícia de bulldogs, loja Pix honesta e mapas reais para viajar.

> Jogo de fã, sem vínculo com nenhum estúdio de games.

## Os três gatos

| Gato | Personalidade | Como joga |
|---|---|---|
| **Mimo** | o cansado 😴 | **Atira** bolhas de espinha de peixe. A energia acaba (café ☕ recarrega); exausto fica lento. Especial **SONECA**: câmera lenta. |
| **Mimosa** | a brava 😾 | **Morde** em combo, dá o bote e **ROSNA** para atordoar. É o tanque: quebra cercas, caixotes e armaduras. |
| **Mortícia** | a comilona 😋 | **Come as coisas dos outros**: rouba o que os cachorros carregam, passa por portinhas, pega chaves. Barriga cheia libera o **LANCHÃO**. |

**Ninguém fica pra trás:** gato caído é reanimado ficando ao lado e segurando o botão de ação (gasta 1 vida). A missão só termina com os três de pé.

## O que tem no jogo

- **Cidade aberta** com 5 bairros (Sunset Beach, Neon Downtown, Palm Harbor, Storm Docks com chuva, Vice Heights), tráfego, carros para dirigir, nível de procurado, minimapa.
- **50 missões** de 13 tipos (travessia, ondas, comer, roubar, juntar grana, resgate, caminhão de petiscos, cofre, fuga, perseguição, corrida, defesa, chefão) + **5 chefões**.
- **Atividades livres:** 25 patinhas douradas, 5 contra-relógios, 5 missões de bairro com gatos NPC.
- **Guarda-roupa** por slots (cabeça, olhos, pescoço, roupa, costas, rastro) com moedas ganhas nas missões.
- **Loja dos Mimos (Pix):** Pacote VIP, Temporada Natal Neon, +10 vidas e apoio. Só enfeite e bônus; dá para zerar sem pagar.
- **Conta opcional:** login por código no e-mail, "Meus gatos" (crie seu gato 3D), progresso na nuvem e a "Cidade dos Gatos" (gatos públicos de outros jogadores passeando).
- **Volta ao Mundo:** bairros reais extraídos do OpenStreetMap (Miami Beach, Copacabana e os próximos) com cartões-postais para colecionar e missões de viagem.
- PT-BR e inglês, feito primeiro para celular (retrato, navegador do Instagram).

## Controles

- **Celular:** analógico esquerdo anda · direito mira e ataca · botões de especial, dash e ação · toque nos retratos troca de gato.
- **PC:** WASD · mouse mira · clique ataca · Espaço especial · Shift dash · E ação/carro · 1 2 3 troca · botão direito gira a câmera · P pausa · M mudo.

## Como rodar

Não tem build. Sirva a pasta `public/`:

```bash
python3 -m http.server 8000 --directory public   # abra http://localhost:8000
```

Na Vercel: projeto estático com `outputDirectory = public`; as funções ficam em `api/`.

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Neon Postgres: ranking, contas, gatos e save na nuvem |
| `MP_ACCESS_TOKEN` | Mercado Pago: loja Pix (sem ela a loja mostra "abre em breve") |
| `RESEND_API_KEY`, `MAIL_FROM`, `AUTH_SECRET` | login por e-mail (ver `docs/ACCOUNTS.md`) |

Sem nenhuma variável o jogo funciona inteiro offline, com progresso salvo no aparelho.

## Adicionar conteúdo (sem mexer no motor)

Tudo fica em `public/data/` e o esquema está em [DESIGN.md](DESIGN.md):

- `missions.json`: bairros e missões (tipo + parâmetros).
- `activities.json`: contra-relógios, missões de NPC, patinhas.
- `outfits.json`: itens do guarda-roupa. `items.json`: valores de comida.
- `cities/`: mapas reais. Rode `node tools/build-cities.mjs <pasta-com-os-json>` para copiar os extratos e regerar o `index.json`.

## Testes

```bash
npm test                                   # API de contas (Node, sem instalar nada)
node tests/e2e/missions.cjs all             # bot joga as 59 missões em modo acelerado
node tests/e2e/missions.cjs 1000,1001 miami # missões de viagem
node tests/e2e/controls.cjs                 # teclado, mouse e toque
node tests/e2e/shop-accounts.cjs            # loja Pix e contas com API simulada
```
Os testes e2e usam Playwright (Chromium com WebGL por software). Capturas vão para `$VP_SHOTS` (padrão `/tmp`).

## Créditos e licenças

- Three.js r160 (MIT) em `public/vendor/`.
- Mapas reais: © OpenStreetMap contributors, licença ODbL (openstreetmap.org/copyright).
- Pagamentos via Pix processados pelo Mercado Pago. Itens digitais cosméticos/bônus, liberados na hora.
- Privacidade: `public/privacy.html`.

---

## English

**Vice Paws** is a free 3D open-world fan game starring three real Persian cats from [@mimo.mimosa.morticia](https://www.instagram.com/mimo.mimosa.morticia/): **Mimo** shoots (and gets tired), **Mimosa** bites (and tanks), **Morticia** eats other people's things (and sneaks through cat flaps). Switch between them at any time, revive the fallen (no cat left behind) and clear 50 story missions across a five-district neon city, plus bosses, time trials, side quests, a wardrobe, an optional account with your own custom cat, and a World Tour of real neighbourhoods built from OpenStreetMap data.

- No build step: serve `public/` (`python3 -m http.server 8000 --directory public`). Vercel serves `public/` and the functions in `api/`.
- All content is data-driven (`public/data/*.json`); the schema is documented in [DESIGN.md](DESIGN.md).
- The shop sells cosmetics and bonus content only; the game is fully completable for free.
- Tests: `npm test` for the accounts API and `node tests/e2e/*.cjs` for Playwright end-to-end runs.

Fan game, not affiliated with any game studio. Map data © OpenStreetMap contributors (ODbL).
