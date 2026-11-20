# VICE PAWS 🐾🌴 — 50 missões

A neon getaway browser game starring **Mimo, Mimosa and Morticia**, the cats of [@mimo.mimosa.morticia](https://www.instagram.com/mimo.mimosa.morticia/).

**No cat left behind.** The three are one team. Each cat has 3 hearts. When one faints, spend a life ❤️ to revive them (tap their portrait or press R). A mission only ends when all three cross the finish line standing. Golden paws 🐾 give extra lives, and so does every first 3-star clear.

| Cat | Personality | Role |
|---|---|---|
| Mimo | The tired one 😴 | Drives. His energy drains, and when he's sleepy the steering gets wobbly, so grab ☕. **NAP**: slow motion. |
| Mimosa | The fierce one 😾 | **ROAR**: blasts nearby cars and bulldog cops, and damages the boss. |
| Morticia | The hungry one 😋 | Must keep eating 🐟 or she loses hearts. A full belly unlocks **FEAST**: treat magnet + x2 points. |

There are 5 districts × 10 missions: Sunset Beach, Neon Downtown, Palm Harbor, Storm Docks and Vice Heights. Every 10th mission is a **Bulldog Chief** boss. Each mission awards up to 3 stars: finish, reach the treat goal, and nobody faints. Progress is saved on the device.

## Stack
- `public/index.html` is the whole game: HTML5 canvas, no build step, PT/EN.
- `api/scores.js` is a Vercel function for the online ranking, using Neon Postgres (`DATABASE_URL`). Without a database the game still works offline.

Controls: ← → steer · 1 Nap · 2/Space Roar · 3 Feast · R revive · P pause. On touch screens, drag to steer and tap the cats.

Fan game made for fun. It is not affiliated with, endorsed by or connected to any game studio.
