// Aviso do Mercado Pago quando um pagamento muda. O jogo confirma pelo /api/pix/status,
// então aqui só respondemos 200 (o Mercado Pago exige resposta rápida).
export default function handler(req, res) { res.status(200).json({ ok: true }); }
