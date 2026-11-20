// Stand-in maps for World Tour cities whose real OpenStreetMap extract has not been delivered yet.
// The Miami street grid (streets only, 22 buildings, so the procedural infill builds the town) is served under the planned
// id with the planned name, country, coordinates and tags. City packs place their waypoints by latitude/longitude, so a pack
// can be played end to end before its real map exists. Real data files are never modified.
const fs = require('fs'), path = require('path');
const pub = path.resolve(__dirname, '../../public');
let cache = null;
exports.table = async () => cache || (cache = await import('../../tools/city-meta.mjs'));
exports.present = id => fs.existsSync(path.join(pub, 'data/cities', id + '.json'));
exports.build = async function (id) {
  const { PLANNED } = await exports.table(), row = PLANNED.find(r => r[0] === id); if (!row) throw new Error('not a planned city: ' + id);
  const C = JSON.parse(fs.readFileSync(path.join(pub, 'data/cities/miami.json'), 'utf8')), tags = row[6] ? row[6].split(',') : [];
  C.id = id; C.name = row[1]; C.country = row[2]; C.lat = row[3]; C.lon = row[4]; C.tags = tags;
  C.buildings = C.buildings.filter((b, i) => i % 27 === 0).slice(0, 22); C.green = C.green.slice(0, 6); C.roads = C.roads.filter(r => r[1] !== 1 && r[0] >= 5);
  if (!tags.includes('beach')) { C.coast = []; C.beach = []; C.water = []; }
  C.landmarks = []; // the real names are unknown until the extract arrives; packs must work from their own places
  return C;
};
exports.meta = async function (C) {
  const { META } = await exports.table(), keys = Object.keys(META), m = META[C.id] || { flag: '🌍', mood: 0, pal: 0, stars: 30 };
  return Object.assign({ id: C.id, name: C.name, country: C.country, lat: C.lat, lon: C.lon, file: C.id + '.json', kb: 100, landmarks: 0, tags: C.tags, elev: 1, order: keys.indexOf(C.id) < 0 ? 999 : keys.indexOf(C.id) }, m, C.tags.includes('hometown') ? { hometown: 1, stars: 0 } : {});
};
// Playwright routes: every id in `ids` that has no real file gets a stand-in (catalogue entry + map)
exports.routes = ids => async function (page) {
  const made = [];
  for (const id of ids) if (!exports.present(id)) { const C = await exports.build(id); made.push([C, await exports.meta(C)]); }
  await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await page.route('**/data/cities/index.json', async r => { const idx = JSON.parse(fs.readFileSync(path.join(pub, 'data/cities/index.json'), 'utf8')); for (const [, m] of made) idx.cities.push(m); idx.cities.sort((a, b) => (b.hometown || 0) - (a.hometown || 0) || a.order - b.order); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(idx) }); });
  for (const [C] of made) await page.route('**/data/cities/' + C.id + '.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(C) }));
  return made.map(m => m[0].id);
};
