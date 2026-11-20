// Copies the OpenStreetMap city extracts into public/data/cities/ and writes index.json (the World Tour catalogue).
// Usage: node tools/build-cities.mjs [sourceDir]     (default: ../vp_art/cities)
// Add a row to META to give a new city its look; unknown ids get sensible defaults. See DESIGN.md.
import fs from 'node:fs'; import path from 'node:path';
const src = process.argv[2] || path.resolve('..', 'vp_art', 'cities'), dst = path.resolve('public', 'data', 'cities');
// mood: sky preset (0 sunset, 1 neon night, 2 bright day, 3 storm/rain, 4 magenta dusk, 5 golden hour, 6 snow); pal: colour palette 0-4
const META = {
  miami: { flag: '🇺🇸', mood: 0, pal: 0, palms: 1, stars: 0 }, rio: { flag: '🇧🇷', mood: 2, pal: 2, palms: 1, stars: 0 },
  rio_vidigal: { flag: '🇧🇷', mood: 0, pal: 0, palms: 1, stars: 6 }, rio_santamarta: { flag: '🇧🇷', mood: 2, pal: 2, palms: 1, stars: 6 }, rio_urca: { flag: '🇧🇷', mood: 5, pal: 2, palms: 1, stars: 9 },
  rio_lapa: { flag: '🇧🇷', mood: 4, pal: 4, palms: 1, stars: 9 }, rio_maracana: { flag: '🇧🇷', mood: 2, pal: 2, palms: 1, stars: 12 },
  rioverde: { flag: '🏡', mood: 5, pal: 2, palms: 1, stars: 0, hometown: 1 }, goiania: { flag: '🇧🇷', mood: 5, pal: 2, palms: 1, stars: 6 },
  saopaulo: { flag: '🇧🇷', mood: 1, pal: 1, stars: 9 }, brasilia: { flag: '🇧🇷', mood: 5, pal: 2, palms: 1, stars: 9 }, salvador: { flag: '🇧🇷', mood: 0, pal: 0, palms: 1, stars: 12 },
  bh: { flag: '🇧🇷', mood: 4, pal: 4, stars: 12 }, recife: { flag: '🇧🇷', mood: 2, pal: 2, palms: 1, stars: 15 }, fortaleza: { flag: '🇧🇷', mood: 2, pal: 2, palms: 1, stars: 15 }, natal: { flag: '🇧🇷', mood: 0, pal: 0, palms: 1, stars: 15 },
  belem: { flag: '🇧🇷', mood: 3, pal: 3, palms: 1, stars: 18 }, manaus: { flag: '🇧🇷', mood: 2, pal: 2, palms: 1, stars: 18 }, floripa: { flag: '🇧🇷', mood: 2, pal: 2, palms: 1, stars: 18 },
  curitiba: { flag: '🇧🇷', mood: 3, pal: 3, stars: 21 }, portoalegre: { flag: '🇧🇷', mood: 4, pal: 4, stars: 21 },
  newyork: { flag: '🇺🇸', mood: 1, pal: 1, stars: 24 }, lasvegas: { flag: '🇺🇸', mood: 1, pal: 1, palms: 1, stars: 24 }, cdmx: { flag: '🇲🇽', mood: 0, pal: 0, palms: 1, stars: 27 }, buenosaires: { flag: '🇦🇷', mood: 4, pal: 4, stars: 27 },
  lisboa: { flag: '🇵🇹', mood: 5, pal: 2, stars: 30 }, madri: { flag: '🇪🇸', mood: 5, pal: 2, stars: 30 }, paris: { flag: '🇫🇷', mood: 4, pal: 4, stars: 33 }, londres: { flag: '🇬🇧', mood: 3, pal: 3, stars: 33 },
  roma: { flag: '🇮🇹', mood: 5, pal: 2, stars: 36 }, berlim: { flag: '🇩🇪', mood: 1, pal: 1, stars: 36 }, cairo: { flag: '🇪🇬', mood: 5, pal: 0, palms: 1, stars: 39 }, dubai: { flag: '🇦🇪', mood: 5, pal: 2, palms: 1, stars: 39 },
  toquio: { flag: '🇯🇵', mood: 1, pal: 1, stars: 42 }, seul: { flag: '🇰🇷', mood: 1, pal: 1, stars: 42 }, sydney: { flag: '🇦🇺', mood: 2, pal: 2, stars: 45 },
};
fs.mkdirSync(dst, { recursive: true });
const cities = [];
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.json') && f !== 'index.json').sort()) {
  let c; try { c = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')); } catch (e) { console.warn('skip', f, e.message); continue; }
  if (!c.id || !c.buildings || !c.roads) { console.warn('skip (not a city)', f); continue; }
  fs.writeFileSync(path.join(dst, c.id + '.json'), JSON.stringify(c));
  const m = META[c.id] || { flag: '🌍', mood: 0, pal: 0, stars: 30 }, tags = c.tags || [];
  cities.push(Object.assign({ id: c.id, name: c.name, country: c.country || '', file: c.id + '.json', kb: Math.round(fs.statSync(path.join(dst, c.id + '.json')).size / 1024), landmarks: (c.landmarks || []).length, tags, order: Object.keys(META).indexOf(c.id) < 0 ? 999 : Object.keys(META).indexOf(c.id) }, m, tags.includes('hometown') ? { hometown: 1, stars: 0 } : {}));
}
cities.sort((a, b) => (b.hometown || 0) - (a.hometown || 0) || a.order - b.order);
fs.writeFileSync(path.join(dst, 'index.json'), JSON.stringify({ version: 1, attribution: '© OpenStreetMap contributors (ODbL)', cities }, null, 1));
console.log(cities.length, 'cities:', cities.map(c => c.id + ' ' + c.kb + 'KB').join(', '));
