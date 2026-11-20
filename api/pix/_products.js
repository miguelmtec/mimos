// Catálogo oficial da loja. O preço vale SEMPRE daqui (o navegador não decide preço).
export const PRODUCTS = {
  vip:      { title: 'Vice Paws — Pacote VIP (roupas, carro dourado, bairro bônus)', price: 4.90, grants: ['vip'] },
  lives10:  { title: 'Vice Paws — Pacote de 10 vidas', price: 1.99, grants: ['lives10'] },
  season:   { title: 'Vice Paws — Missões especiais da temporada', price: 2.90, grants: ['season'] },
  apoio5:   { title: 'Vice Paws — Apoio aos gatos R$5', price: 5.00, grants: ['supporter'] },
  apoio10:  { title: 'Vice Paws — Apoio aos gatos R$10', price: 10.00, grants: ['supporter'] },
  apoio20:  { title: 'Vice Paws — Apoio aos gatos R$20', price: 20.00, grants: ['supporter'] },
  // pacotes pequenos, só visual (nada de vantagem no jogo)
  supporter_small: { title: 'Vice Paws — Um petisco para os gatos', price: 0.99, grants: ['supporter'] },
  skin_praia: { title: 'Vice Paws — Pacote de visual Praia', price: 0.99, grants: ['pack_praia'] },
  skin_agro:  { title: 'Vice Paws — Pacote de visual Agro (Rio Verde)', price: 0.99, grants: ['pack_agro'] },
  skin_festa: { title: 'Vice Paws — Pacote de visual Festa', price: 1.99, grants: ['pack_festa'] },
  skin_natal: { title: 'Vice Paws — Pacote de visual Natal', price: 1.99, grants: ['pack_natal'] },
  // Passe da Temporada Natal Neon (aprovado pelo dono em 20/11/2026): só visual, sem sorteio
  season_natal:      { title: 'Vice Paws — Passe Natal Neon', price: 4.90, grants: ['pass_natal'] },
  season_natal_plus: { title: 'Vice Paws — Passe Natal Neon + Pacote', price: 9.90, grants: ['pass_natal', 'pass_natal_plus'] },
};
export const MP = 'https://api.mercadopago.com';
export const token = () => process.env.MP_ACCESS_TOKEN || '';
export function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
