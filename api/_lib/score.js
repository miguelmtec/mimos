// Leaderboard entry validation (pure, unit-tested in tests/score.test.mjs).
// The ranking counts every mission: story, chapters, bonus districts, time trials and World Tour cities.
// `missions` = how many different missions the player has cleared; older clients only send `level` (story mission 1-50).
export const MAX_MISSIONS = 2000;      // generous ceiling: ~210 home missions + 10 per real city
const PER_MISSION = 25000;             // a single mission cannot realistically pass ~25k points
export function cleanScore(b) {
  b = b || {};
  const name = String(b.name || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 12).trim();
  const score = Math.floor(Number(b.score)), stars = Math.floor(Number(b.stars)), vip = b.vip === true;
  let level = Math.floor(Number(b.level)), missions = b.missions === undefined ? null : Math.floor(Number(b.missions));
  if (!name || !Number.isFinite(score) || score < 1 || !Number.isFinite(stars) || stars < 1) return null;
  if (missions === null) { // legacy client: story missions only
    if (!(level >= 1 && level <= 50) || stars > Math.min(150, level * 3) || score > level * PER_MISSION) return null;
    return { name, score, level, stars, vip, missions: 0 };
  }
  if (!Number.isFinite(missions) || missions < 1 || missions > MAX_MISSIONS) return null;
  if (!Number.isFinite(level)) level = 1;
  level = Math.max(1, Math.min(50, level));
  if (stars > missions * 3 || score > missions * PER_MISSION) return null;
  return { name, score, level, stars, vip, missions };
}
