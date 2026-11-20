// Photo -> fur colours, fully local: a tiny PNG reader (node:zlib) + k-means on
// a downsampled, centre-weighted grid. No external AI, nothing is stored.
import { inflateSync } from 'node:zlib';
import { fail } from './http.js';

export const MAX_DATA_URL = 300 * 1024;      // characters of the whole data URL
const MAX_PIXELS = 4_000_000;                // decoded size guard (decompression bombs)
const GRID = 48;                             // sample at most GRID x GRID points
const K = 5;

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Decodes a non-interlaced PNG and returns { width, height, at(x, y) -> [r, g, b, a] }. */
export function decodePng(buf) {
  const bad = () => fail(400, 'invalid-image');
  if (buf.length < 45 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) throw bad();
  let pos = 8, ihdr = null, palette = null, trns = null;
  const idat = [];
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (data.length !== len) throw bad();
    if (type === 'IHDR') ihdr = data;
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += len + 12;
  }
  if (!ihdr || ihdr.length !== 13 || !idat.length) throw bad();
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  const depth = ihdr[8], ctype = ihdr[9], interlace = ihdr[12];
  const channels = CHANNELS[ctype];
  if (!width || !height || !channels || ![1, 2, 4, 8, 16].includes(depth)) throw bad();
  if (depth < 8 && ctype !== 0 && ctype !== 3) throw bad();
  if (ctype === 3 && (!palette || depth === 16)) throw bad();
  if (interlace) throw fail(415, 'unsupported-image', { hint: 'png-not-interlaced' });
  if (width * height > MAX_PIXELS) throw fail(413, 'image-too-large');

  const bpp = Math.max(1, (channels * depth) >> 3);           // bytes per pixel, for filtering
  const stride = Math.ceil((width * channels * depth) / 8);
  let raw;
  try { raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height }); } catch { throw bad(); }
  if (raw.length !== (stride + 1) * height) throw bad();

  // Undo the per-row filters in place.
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0;
      const b = y ? px[up + i] : 0;
      const c = y && i >= bpp ? px[up + i - bpp] : 0;
      let v = raw[src + i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw bad();
      px[dst + i] = v & 255;
    }
  }

  const sample = (x, y, ch) => {                                // one channel, scaled to 0..255
    const row = y * stride;
    if (depth === 8) return px[row + x * channels + ch];
    if (depth === 16) return px[row + (x * channels + ch) * 2];
    const bit = (x * channels + ch) * depth;                    // 1, 2 or 4 bits (grey / palette)
    const v = (px[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    return ctype === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
  };
  const at = (x, y) => {
    if (ctype === 3) {
      const i = depth === 8 ? px[y * stride + x] : sample(x, y, 0);
      if (i * 3 + 2 >= palette.length) return [0, 0, 0, 0];
      return [palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2], trns && i < trns.length ? trns[i] : 255];
    }
    if (ctype === 0) { const g = sample(x, y, 0); return [g, g, g, 255]; }
    if (ctype === 4) { const g = sample(x, y, 0); return [g, g, g, sample(x, y, 1)]; }
    return [sample(x, y, 0), sample(x, y, 1), sample(x, y, 2), ctype === 6 ? sample(x, y, 3) : 255];
  };
  return { width, height, at };
}

const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Weighted k-means. points: [[r, g, b, weight]]. Returns [{ rgb, share }] sorted by share. */
export function dominantColors(points, k = K) {
  const total = points.reduce((s, p) => s + p[3], 0);
  if (!points.length || !total) return [];
  // Deterministic farthest-point start: the weighted mean, then the most distant points.
  const mean = [0, 1, 2].map((c) => points.reduce((s, p) => s + p[c] * p[3], 0) / total);
  const centers = [mean];
  while (centers.length < k) {
    let best = null, bestD = -1;
    for (const p of points) {
      const d = Math.min(...centers.map((c) => dist2(p, c)));
      if (d > bestD) { bestD = d; best = p; }
    }
    if (bestD < 1) break;
    centers.push([best[0], best[1], best[2]]);
  }
  let weights = [];
  for (let iter = 0; iter < 10; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of points) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < centers.length; i++) { const d = dist2(p, centers[i]); if (d < bd) { bd = d; bi = i; } }
      const s = sums[bi];
      s[0] += p[0] * p[3]; s[1] += p[1] * p[3]; s[2] += p[2] * p[3]; s[3] += p[3];
    }
    weights = sums.map((s) => s[3]);
    sums.forEach((s, i) => { if (s[3]) centers[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  // Merge near-identical clusters so a plain coat does not come back as 5 shades.
  const out = [];
  centers.map((rgb, i) => ({ rgb, w: weights[i] })).filter((c) => c.w > 0).sort((a, b) => b.w - a.w).forEach((c) => {
    const near = out.find((o) => dist2(o.rgb, c.rgb) < 40 * 40);
    if (!near) return out.push({ ...c });
    const w = near.w + c.w;
    near.rgb = near.rgb.map((v, i) => (v * near.w + c.rgb[i] * c.w) / w);
    near.w = w;
  });
  return out.sort((a, b) => b.w - a.w).map((c) => ({ rgb: c.rgb, share: c.w / total }));
}

function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** Heuristic coat-pattern guess from the palette. It is only a starting point for the editor. */
export function guessPattern(palette) {
  if (!palette.length || palette[0].share >= 0.78) return 'solid';
  let white = 0, black = 0, orange = 0, dark = 0, light = 0;
  for (const { rgb, share } of palette) {
    const { h, s, l } = hsl(rgb);
    if (l > 0.88 || (l > 0.76 && s < 0.3)) white += share;
    else if (l > 0.6 && s < 0.5) light += share;
    if (l < 0.2) black += share;
    else if (l < 0.4) dark += share;
    if (h >= 12 && h <= 45 && s > 0.4 && l > 0.3 && l < 0.75) orange += share;
  }
  if (white >= 0.12 && orange >= 0.1 && black + dark >= 0.1) return 'calico';
  if (white >= 0.12 && black >= 0.25 && orange < 0.05) return 'tuxedo';
  if (white >= 0.2 && white <= 0.8) return 'bicolor';
  if (white + light >= 0.45 && dark + black >= 0.08 && dark + black <= 0.4) return 'pointed';
  return palette.length > 1 && palette[1].share >= 0.15 ? 'tabby' : 'solid';
}

/** data URL (PNG) -> { spec: { furBase, patchColors, pattern }, palette: [{ color, share }] } */
export function suggestFromDataUrl(image) {
  if (typeof image !== 'string' || !image.startsWith('data:')) throw fail(400, 'invalid-image');
  if (image.length > MAX_DATA_URL) throw fail(413, 'image-too-large');
  const m = /^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!m) throw fail(400, 'invalid-image');
  if (m[1] !== 'png') throw fail(415, 'unsupported-image', { hint: 'png' });
  const img = decodePng(Buffer.from(m[2], 'base64'));

  const nx = Math.min(GRID, img.width), ny = Math.min(GRID, img.height);
  const points = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [r, g, b, a] = img.at(Math.floor(((i + 0.5) * img.width) / nx), Math.floor(((j + 0.5) * img.height) / ny));
      if (a < 128) continue;
      // The cat is usually in the middle: the edges (background) weigh much less.
      const dx = (i + 0.5) / nx - 0.5, dy = (j + 0.5) / ny - 0.5;
      points.push([r, g, b, Math.exp(-(dx * dx + dy * dy) / 0.08)]);
    }
  }
  const found = dominantColors(points);
  if (!found.length) throw fail(400, 'invalid-image');
  const palette = found.map((c) => ({ color: toHex(c.rgb), share: Math.round(c.share * 1000) / 1000 }));
  return {
    spec: {
      furBase: palette[0].color,
      patchColors: palette.slice(1).filter((c) => c.share >= 0.06).slice(0, 3).map((c) => c.color),
      pattern: guessPattern(found),
    },
    palette,
  };
}
