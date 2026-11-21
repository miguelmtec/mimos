// v2: adds multipolygon relations (beaches, parks, water, forest), terrain height grid
// (AWS Terrain Tiles / Mapzen terrarium, public dataset) and more cities.
// Data © OpenStreetMap contributors (ODbL). Elevation: Terrain Tiles on AWS (public data).
import fs from 'node:fs';
import { PNG } from 'pngjs';
const OUT = '/vercel/out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'VicePawsGame/1.0 (fan game; contact jogo@mtec.tec.br)';
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
// [id, name, country, lat, lon, halfMeters, tags]
const CITIES = [
  ['miami', 'Miami Beach', 'EUA', 25.7790, -80.1315, 600, 'beach'],
  ['rio', 'Rio de Janeiro — Copacabana', 'Brasil', -22.9700, -43.1840, 600, 'beach'],
  ['rio_vidigal', 'Rio — Vidigal e Leblon', 'Brasil', -22.9905, -43.2300, 650, 'beach,comunidade,morro'],
  ['rio_santamarta', 'Rio — Morro Santa Marta (Botafogo)', 'Brasil', -22.9475, -43.1935, 500, 'comunidade,morro'],
  ['rio_urca', 'Rio — Urca e Pão de Açúcar', 'Brasil', -22.9500, -43.1620, 700, 'beach,morro,landmark'],
  ['rio_lapa', 'Rio — Lapa e Centro', 'Brasil', -22.9130, -43.1800, 600, 'landmark'],
  ['rio_maracana', 'Rio — Maracanã', 'Brasil', -22.9122, -43.2302, 550, 'landmark'],
  ['saopaulo', 'São Paulo — Av. Paulista', 'Brasil', -23.5614, -46.6559, 600, ''],
  ['brasilia', 'Brasília — Esplanada', 'Brasil', -15.7975, -47.8645, 700, 'landmark'],
  ['rioverde', 'Rio Verde — Centro', 'Brasil', -17.7980, -50.9280, 600, 'hometown'],
  ['goiania', 'Goiânia — Praça Cívica', 'Brasil', -16.6799, -49.2550, 600, ''],
  ['salvador', 'Salvador — Pelourinho', 'Brasil', -12.9714, -38.5108, 550, 'beach,morro,landmark'],
  ['bh', 'Belo Horizonte — Praça da Liberdade', 'Brasil', -19.9320, -43.9380, 600, 'morro'],
  ['recife', 'Recife — Marco Zero', 'Brasil', -8.0631, -34.8711, 600, 'beach'],
  ['fortaleza', 'Fortaleza — Beira-Mar', 'Brasil', -3.7250, -38.4950, 600, 'beach'],
  ['natal', 'Natal — Ponta Negra', 'Brasil', -5.8800, -35.1700, 650, 'beach,morro'],
  ['belem', 'Belém — Ver-o-Peso', 'Brasil', -1.4530, -48.5040, 550, 'landmark'],
  ['manaus', 'Manaus — Teatro Amazonas', 'Brasil', -3.1303, -60.0234, 550, 'landmark'],
  ['floripa', 'Florianópolis — Centro', 'Brasil', -27.5960, -48.5490, 600, 'beach,morro'],
  ['curitiba', 'Curitiba — Centro', 'Brasil', -25.4290, -49.2710, 600, ''],
  ['portoalegre', 'Porto Alegre — Centro Histórico', 'Brasil', -30.0277, -51.2287, 600, ''],
  ['vitoria', 'Vitória — Centro e Palácio Anchieta', 'Brasil', -20.3197, -40.3390, 550, 'morro'],
  ['saoluis', 'São Luís — Centro Histórico', 'Brasil', -2.5297, -44.3044, 550, 'landmark'],
  ['maceio', 'Maceió — Pajuçara', 'Brasil', -9.6658, -35.7133, 600, 'beach'],
  ['joaopessoa', 'João Pessoa — Tambaú', 'Brasil', -7.1153, -34.8226, 600, 'beach'],
  ['aracaju', 'Aracaju — Orla de Atalaia', 'Brasil', -10.9853, -37.0480, 600, 'beach'],
  ['teresina', 'Teresina — Centro', 'Brasil', -5.0892, -42.8019, 550, ''],
  ['cuiaba', 'Cuiabá — Centro', 'Brasil', -15.5989, -56.0949, 550, ''],
  ['campogrande', 'Campo Grande — Av. Afonso Pena', 'Brasil', -20.4628, -54.6156, 550, ''],
  ['palmas', 'Palmas — Praça dos Girassóis', 'Brasil', -10.1844, -48.3336, 650, 'landmark'],
  ['portovelho', 'Porto Velho — Madeira-Mamoré', 'Brasil', -8.7608, -63.9119, 550, 'landmark'],
  ['riobranco', 'Rio Branco — Centro', 'Brasil', -9.9747, -67.8100, 550, ''],
  ['macapa', 'Macapá — Fortaleza de São José', 'Brasil', 0.0372, -51.0498, 550, 'landmark'],
  ['boavista', 'Boa Vista — Centro Cívico', 'Brasil', 2.8197, -60.6733, 550, ''],
  ['newyork', 'Nova York — Times Square', 'EUA', 40.7580, -73.9855, 550, ''],
  ['paris', 'Paris — Torre Eiffel', 'França', 48.8570, 2.2970, 650, 'landmark'],
  ['londres', 'Londres — Westminster', 'Reino Unido', 51.5007, -0.1246, 600, 'landmark'],
  ['toquio', 'Tóquio — Shibuya', 'Japão', 35.6595, 139.7005, 550, 'neon'],
  ['roma', 'Roma — Coliseu', 'Itália', 41.8902, 12.4922, 600, 'landmark'],
  ['buenosaires', 'Buenos Aires — Obelisco', 'Argentina', -34.6037, -58.3816, 600, ''],
  ['lisboa', 'Lisboa — Baixa', 'Portugal', 38.7100, -9.1370, 600, 'morro'],
  ['cdmx', 'Cidade do México — Zócalo', 'México', 19.4326, -99.1332, 600, 'landmark'],
  ['dubai', 'Dubai — Burj Khalifa', 'Emirados', 25.1972, 55.2744, 700, 'landmark'],
  ['madri', 'Madri — Puerta del Sol', 'Espanha', 40.4168, -3.7038, 550, ''],
  ['berlim', 'Berlim — Portão de Brandemburgo', 'Alemanha', 52.5163, 13.3777, 600, 'landmark'],
  ['cairo', 'Gizé — Pirâmides', 'Egito', 29.9773, 31.1325, 800, 'landmark'],
  ['sydney', 'Sydney — Opera House', 'Austrália', -33.8590, 151.2100, 650, 'beach,landmark'],
  ['seul', 'Seul — Myeongdong', 'Coreia do Sul', 37.5636, 126.9850, 550, 'neon'],
  ['lasvegas', 'Las Vegas — Strip', 'EUA', 36.1147, -115.1728, 700, 'neon'],
];
const RW = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 9, residential: 7, unclassified: 7, service: 4, living_street: 5, pedestrian: 5, track: 3, footway: 2, path: 2, cycleway: 2, steps: 2 };
const FOOT = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'track']);
const GREEN = /park|garden|pitch|playground|grass|forest|recreation_ground|meadow|wood|scrub|golf|village_green|heath|grassland/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ov(q) {
  let err = '';
  for (let round = 0; round < 3; round++) for (const m of MIRRORS) {
    try {
      const r = await fetch(m, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA, accept: 'application/json' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(170000) });
      const t = await r.text();
      if (r.ok && t.trim().startsWith('{')) return JSON.parse(t).elements;
      err = `${m} ${r.status} ${t.slice(0, 100)}`;
    } catch (e) { err = `${m} ${e.message}`; }
    await sleep(3000);
  }
  throw new Error(err);
}
// --- terrain (terrarium PNG tiles) ---
const tileCache = new Map();
async function tile(z, x, y) {
  const k = `${z}/${x}/${y}`; if (tileCache.has(k)) return tileCache.get(k);
  const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${k}.png`, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error('tile ' + k + ' ' + r.status);
  const png = PNG.sync.read(Buffer.from(await r.arrayBuffer())); tileCache.set(k, png); return png;
}
async function elevAt(lat, lon, z = 15) {
  const n = 2 ** z, xf = (lon + 180) / 360 * n, yf = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
  const tx = Math.floor(xf), ty = Math.floor(yf), px = Math.min(255, Math.floor((xf - tx) * 256)), py = Math.min(255, Math.floor((yf - ty) * 256));
  const p = await tile(z, tx, ty), i = (py * 256 + px) * 4;
  return p.data[i] * 256 + p.data[i + 1] + p.data[i + 2] / 256 - 32768;
}
async function elevGrid(lat, lon, half, N = 49) {
  const kx = 111320 * Math.cos(lat * Math.PI / 180), kz = 111320, vals = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -half + 2 * half * i / (N - 1), zz = -half + 2 * half * j / (N - 1);
    vals.push(await elevAt(lat - zz / kz, lon + x / kx));
  }
  const min = Math.min(...vals);
  return { n: N, size: 2 * half, min: Math.round(min), data: vals.map(v => Math.round(v - min)) }; // row-major, j = z (south), i = x (east)
}
async function city([id, name, country, lat, lon, half, tags]) {
  const dLat = half / 111320, dLon = half / (111320 * Math.cos(lat * Math.PI / 180));
  const bb = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map(v => v.toFixed(6)).join(',');
  const kx = 111320 * Math.cos(lat * Math.PI / 180), kz = 111320;
  const P = g => { const o = []; for (const p of g) o.push(Math.round((p.lon - lon) * kx * 2) / 2, Math.round(-(p.lat - lat) * kz * 2) / 2); return o; };
  const file = `${OUT}/${id}.json`;
  let out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null;
  if (!out) {
    out = { id, name, country, lat, lon, half, attribution: '© OpenStreetMap contributors (ODbL)', buildings: [], roads: [], water: [], beach: [], green: [], coast: [], waterways: [], landmarks: [] };
    const els = [];
    els.push(...await ov(`[out:json][timeout:150];way["building"](${bb});out tags geom;`));
    els.push(...await ov(`[out:json][timeout:120];way["highway"](${bb});out tags geom;`));
    els.push(...await ov(`[out:json][timeout:120];(way["natural"](${bb});way["leisure"](${bb});way["landuse"](${bb});way["waterway"](${bb});way["amenity"="fountain"](${bb}););out tags geom;`));
    for (const e of els) {
      const t = e.tags || {}; if (!e.geometry) continue; const g = P(e.geometry);
      if (t.building) {
        let h = parseFloat(t.height) || (parseFloat(t['building:levels']) || 0) * 3.2 || 0;
        if (!h) h = t.building === 'house' ? 6 : t.building === 'church' || t.building === 'cathedral' ? 16 : 9;
        out.buildings.push([Math.round(Math.min(h, 830)), ...g]);
        if (t.name && (h > 45 || t.tourism || t.historic || t.building === 'cathedral')) out.landmarks.push([t.name.slice(0, 40), g[0], g[1], Math.round(h)]);
      } else if (t.highway) { const w = RW[t.highway]; if (w) out.roads.push([w, FOOT.has(t.highway) ? 1 : 0, ...g]); }
      else if (t.natural === 'coastline') out.coast.push(g);
      else if (t.natural === 'water' || t.landuse === 'reservoir' || t.landuse === 'basin' || t.waterway === 'riverbank' || t.amenity === 'fountain') out.water.push(g);
      else if (t.natural === 'beach' || t.natural === 'sand') out.beach.push(g);
      else if (t.waterway) out.waterways.push(g);
      else if (GREEN.test((t.leisure || '') + (t.landuse || '') + (t.natural || ''))) out.green.push(g);
    }
  }
  if (!out.v2) {
    // multipolygon relations: beaches, water, parks, forests, plus named tourism/historic nodes as landmarks
    const rel = await ov(`[out:json][timeout:150];(relation["natural"~"beach|water|wood|sand|scrub"](${bb});relation["leisure"~"park|garden"](${bb});relation["landuse"~"forest|grass|recreation_ground"](${bb}););out tags geom;`);
    for (const e of rel) {
      const t = e.tags || {};
      const k = t.natural === 'beach' || t.natural === 'sand' ? 'beach' : t.natural === 'water' ? 'water' : 'green';
      for (const m of e.members || []) if (m.geometry && m.role === 'outer') out[k].push(P(m.geometry));
    }
    const poi = await ov(`[out:json][timeout:90];(node["tourism"~"attraction|viewpoint|museum"]["name"](${bb});node["historic"]["name"](${bb});way["tourism"="attraction"]["name"](${bb}););out tags center 60;`);
    for (const e of poi) {
      const c = e.type === 'node' ? e : e.center; if (!c) continue;
      const nm = (e.tags.name || '').slice(0, 40); if (!nm || out.landmarks.some(l => l[0] === nm)) continue;
      out.landmarks.push([nm, Math.round((c.lon - lon) * kx), Math.round(-(c.lat - lat) * kz), 0]);
    }
    try { out.elev = await elevGrid(lat, lon, half); } catch (e) { out.elevError = e.message; }
    out.tags = tags ? tags.split(',') : [];
    out.v2 = 1;
    fs.writeFileSync(file, JSON.stringify(out));
  }
  const e = out.elev ? `elev ${out.elev.min}..${out.elev.min + Math.max(...out.elev.data)}m` : 'noelev';
  return `${id}: b=${out.buildings.length} r=${out.roads.length} beach=${out.beach.length} green=${out.green.length} water=${out.water.length} lm=${out.landmarks.length} ${e} bytes=${fs.statSync(file).size}`;
}
const log = m => { fs.appendFileSync(`${OUT}/_log2.txt`, m + '\n'); console.log(m); };
for (const c of CITIES) {
  if (fs.existsSync(`${OUT}/${c[0]}.json`) && JSON.parse(fs.readFileSync(`${OUT}/${c[0]}.json`)).elev) continue;
  try { log(await city(c)); } catch (e) { log(`${c[0]}: ERROR ${e.message}`); }
  await sleep(1500);
}
log('DONE');
