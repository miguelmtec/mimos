// Tiny req/res doubles shaped like Vercel's Node helpers, plus a PNG encoder for fixtures.
import { deflateSync } from 'node:zlib';

export const ORIGIN = 'https://vice-paws.vercel.app';

export async function call(handler, { method = 'GET', url = '/', body, cookie, origin = ORIGIN, ip = '203.0.113.7', headers = {} } = {}) {
  const req = {
    method, url, body,
    headers: { host: 'vice-paws.vercel.app', 'x-real-ip': ip, ...headers },
  };
  if (origin) req.headers.origin = origin;
  if (cookie) req.headers.cookie = cookie;
  if (body !== undefined) req.headers['content-type'] = 'application/json';
  const out = { status: 0, body: undefined, headers: {} };
  const res = {
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; return res; },
    getHeader: (k) => out.headers[k.toLowerCase()],
    status(c) { out.status = c; return res; },
    json(b) { out.body = JSON.parse(JSON.stringify(b)); return res; },
    end() { return res; },
  };
  await handler(req, res);
  return out;
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Encodes a PNG. `pixel(x, y)` returns the samples of one pixel (bytes).
 * colorType 6 = RGBA, 2 = RGB, 0 = grey, 3 = palette index. `filter` 0..4 is applied to every row.
 */
export function png(width, height, pixel, { colorType = 6, filter = 0, palette, interlace = 0 } = {}) {
  const channels = { 0: 1, 2: 3, 3: 1, 6: 4 }[colorType];
  const stride = width * channels;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * stride + x * channels);
  const out = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    out[y * (stride + 1)] = filter;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? raw[y * stride + i - channels] : 0;
      const b = y ? raw[(y - 1) * stride + i] : 0;
      const c = y && i >= channels ? raw[(y - 1) * stride + i - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      out[y * (stride + 1) + 1 + i] = (raw[y * stride + i] - pred) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colorType; ihdr[12] = interlace;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(palette ? [chunk('PLTE', Buffer.from(palette.flat()))] : []),
    chunk('IDAT', deflateSync(out)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const dataUrl = (buf, type = 'png') => `data:image/${type};base64,${buf.toString('base64')}`;
