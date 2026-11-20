// Copies the OpenStreetMap city extracts into public/data/cities/ and writes index.json (the World Tour catalogue).
// Usage: node tools/build-cities.mjs [sourceDir]     (default: ../vp_art/cities)
// Add a row to META to give a new city its look; unknown ids get sensible defaults. See DESIGN.md.
// City files may carry `elev` {n, size, min, data} (n x n heights, row-major, j south / i east, metres above min) and `tags`
// (comunidade, morro, beach, landmark, neon, hometown). Missions come from public/data/citypacks.json (a pack for the id, or the templates).
import fs from 'node:fs'; import path from 'node:path';
import { META } from './city-meta.mjs';
const src = process.argv[2] || path.resolve('..', 'vp_art', 'cities'), dst = path.resolve('public', 'data', 'cities');
fs.mkdirSync(dst, { recursive: true });
const cities = [];
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.json') && f !== 'index.json').sort()) {
  let c; try { c = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')); } catch (e) { console.warn('skip', f, e.message); continue; }
  if (!c.id || !c.buildings || !c.roads) { console.warn('skip (not a city)', f); continue; }
  fs.writeFileSync(path.join(dst, c.id + '.json'), JSON.stringify(c));
  const m = META[c.id] || { flag: '🌍', mood: 0, pal: 0, stars: 30 }, tags = c.tags || [], half = c.half || 600;
  // same rules as World.fromCity: inside the map and family friendly
  const NOPE = /erotic|adult|sex|strip ?club|casino|cassino|liquor|vape|hookah|cannabis|tabac|gun\b/i, lms = (c.landmarks || []).filter(l => !NOPE.test(l[0]) && Math.abs(l[1]) < half - 20 && Math.abs(l[2]) < half - 20).length;
  cities.push(Object.assign({ id: c.id, name: c.name, country: c.country || '', lat: c.lat, lon: c.lon, file: c.id + '.json', kb: Math.round(fs.statSync(path.join(dst, c.id + '.json')).size / 1024), landmarks: lms, tags, elev: c.elev && c.elev.n > 1 ? 1 : 0, order: Object.keys(META).indexOf(c.id) < 0 ? 999 : Object.keys(META).indexOf(c.id) }, m, tags.includes('hometown') ? { hometown: 1, stars: 0 } : {}));
}
cities.sort((a, b) => (b.hometown || 0) - (a.hometown || 0) || a.order - b.order);
fs.writeFileSync(path.join(dst, 'index.json'), JSON.stringify({ version: 1, attribution: '© OpenStreetMap contributors (ODbL)', cities }, null, 1));
console.log(cities.length, 'cities:', cities.map(c => c.id + ' ' + c.kb + 'KB').join(', '));
