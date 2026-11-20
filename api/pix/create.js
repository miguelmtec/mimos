// Cria uma cobrança Pix no Mercado Pago e devolve o QR Code.
// Precisa da variável MP_ACCESS_TOKEN (colocada pelo dono no painel da Vercel).
import { PRODUCTS, MP, token, body } from './_products.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!token()) return res.status(503).json({ error: 'shop-offline' });
  const b = body(req);
  const p = PRODUCTS[b.product];
  if (!p) return res.status(400).json({ error: 'product' });
  const nick = String(b.name || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 20);
  const email = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(b.email || '') ? b.email : `jogador${Date.now()}@vicepaws.app`;
  const r = await fetch(`${MP}/v1/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}`, 'x-idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({
      transaction_amount: p.price, description: p.title, payment_method_id: 'pix',
      payer: { email }, external_reference: `${b.product}|${nick}`,
      notification_url: `https://${req.headers.host}/api/pix/webhook`,
      date_of_expiration: new Date(Date.now() + 30 * 60e3).toISOString(),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(502).json({ error: 'mp', detail: j.message || r.status });
  const t = j.point_of_interaction?.transaction_data || {};
  return res.status(200).json({ id: String(j.id), status: j.status, price: p.price, qr: t.qr_code, qrBase64: t.qr_code_base64 });
}
