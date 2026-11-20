// Catálogo oficial da loja. O preço vale SEMPRE daqui (o navegador não decide preço).
export const PRODUCTS = {
  vip:      { title: 'Vice Paws — Pacote VIP (roupas, carro dourado, bairro bônus)', price: 4.90, grants: ['vip'] },
  lives10:  { title: 'Vice Paws — Pacote de 10 vidas', price: 1.99, grants: ['lives10'] },
  season:   { title: 'Vice Paws — Missões especiais da temporada', price: 2.90, grants: ['season'] },
  apoio5:   { title: 'Vice Paws — Apoio aos gatos R$5', price: 5.00, grants: ['supporter'] },
  apoio10:  { title: 'Vice Paws — Apoio aos gatos R$10', price: 10.00, grants: ['supporter'] },
  apoio20:  { title: 'Vice Paws — Apoio aos gatos R$20', price: 20.00, grants: ['supporter'] },
};
export const MP = 'https://api.mercadopago.com';
export const token = () => process.env.MP_ACCESS_TOKEN || '';
export function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
