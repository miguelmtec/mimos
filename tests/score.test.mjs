// Leaderboard validation: the ranking counts every mission, not only the 50 story ones.
import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanScore, MAX_MISSIONS } from '../api/_lib/score.js';
test('ranking accepts totals from all missions (chapters and World Tour included)', () => {
  const e = cleanScore({ name: 'Mimosa', score: 900000, level: 50, missions: 180, stars: 520, vip: false });
  assert.ok(e); assert.equal(e.missions, 180); assert.equal(e.stars, 520); assert.equal(e.level, 50);
});
test('a player who only played World Tour missions can still post', () => {
  const e = cleanScore({ name: 'Turista', score: 12000, level: 0, missions: 4, stars: 10 });
  assert.ok(e); assert.equal(e.level, 1);
});
test('legacy clients (no missions field) keep the old 50-mission rules', () => {
  assert.ok(cleanScore({ name: 'Old', score: 5000, level: 3, stars: 9 }));
  assert.equal(cleanScore({ name: 'Old', score: 5000, level: 3, stars: 10 }), null);
  assert.equal(cleanScore({ name: 'Old', score: 5000, level: 51, stars: 3 }), null);
});
test('impossible totals are refused', () => {
  assert.equal(cleanScore({ name: 'X', score: 5000, missions: 2, stars: 7 }), null);          // more than 3 stars per mission
  assert.equal(cleanScore({ name: 'X', score: 60000, missions: 2, stars: 6 }), null);         // more than 25k per mission
  assert.equal(cleanScore({ name: 'X', score: 10, missions: MAX_MISSIONS + 1, stars: 3 }), null);
  assert.equal(cleanScore({ name: '', score: 10, missions: 1, stars: 3 }), null);
  assert.equal(cleanScore({ name: 'X', score: 0, missions: 1, stars: 3 }), null);
});
test('names are cleaned and cut to 12 characters', () => {
  assert.equal(cleanScore({ name: '<b>Mortícia a comilona</b>', score: 10, missions: 1, stars: 1 }).name, 'bMortícia a');
});
