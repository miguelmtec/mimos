// Consulta se o Pix foi pago. O item só é liberado com status "approved" vindo do próprio Mercado Pago.
// Também serve para restaurar compra em outro aparelho usando o código da compra (id).
import { PRODUCTS, MP, token } from './_products.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!token()) return res.status(503).json({ error: 'shop-offline' });
  const id = String(req.query.id || '').replace(/\D/g, '');
  if (!id) return res.status(400).json({ error: 'id' });
  const r = await fetch(`${MP}/v1/payments/${id}`, { headers: { authorization: `Bearer ${token()}` } });
  if (!r.ok) return res.status(404).json({ error: 'not-found' });
  const j = await r.json();
  const [product, name] = String(j.external_reference || '').split('|');
  const p = PRODUCTS[product];
  const paid = j.status === 'approved' && p && Math.abs(Number(j.transaction_amount) - p.price) < 0.001;
  return res.status(200).json({ id, status: j.status, paid, product: paid ? product : null, grants: paid ? p.grants : [], name: paid ? name : null });
}
