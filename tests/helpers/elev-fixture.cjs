// Test fixture: a synthetic hilly "comunidade" city built in memory from the real Copacabana extract.
// The real data file (public/data/cities/rio.json) is never modified; tests serve this copy through a route.
const fs = require('fs'), path = require('path');
const N = 33;
// height in metres at (x east, z south): a slope rising to the north-west with rolling bumps, always >= 0
const height = (x, z) => Math.max(0, 40 + 0.07 * x - 0.09 * z + 22 * Math.sin(x / 150) * Math.cos(z / 170));
exports.height = height;
exports.build = function () {
  const C = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/data/cities/rio.json'), 'utf8'));
  const half = C.half, data = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) data.push(+height(-half + i / (N - 1) * half * 2, -half + j / (N - 1) * half * 2).toFixed(2)); // row-major, j runs south (+z), i runs east (+x)
  C.id = 'fix_morro'; C.name = 'Morro de Teste'; C.tags = ['comunidade', 'morro']; C.elev = { n: N, size: half * 2, min: 0, data };
  return C;
};
exports.meta = C => ({ id: C.id, name: C.name, country: 'Teste', file: C.id + '.json', kb: 100, landmarks: C.landmarks.length, tags: C.tags, order: 950, flag: '🧪', mood: 2, pal: 2, palms: 1, stars: 0 });
// Playwright routes: adds the fixture to the catalogue and serves its JSON
exports.routes = async function (page) {
  const C = exports.build();
  await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await page.route('**/data/cities/index.json', async r => { const idx = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/data/cities/index.json'), 'utf8')); idx.cities.push(exports.meta(C)); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(idx) }); });
  await page.route('**/data/cities/fix_morro.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(C) }));
};
