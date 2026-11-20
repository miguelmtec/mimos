// Writes public/data/shelter.json: the cats that can be rescued for the shelter ("Adote do Abrigo") and the album.
// 12 breeds x 6 variants (4 common, 1 uncommon, 1 rare) = 72. Rare variants only show up as strays found by exploring.
// Usage: node tools/gen-shelter.mjs
import fs from 'node:fs';
// breed: [id, pt, en, base spec (buildCat fields)]
const BREEDS = [
  ['persa', 'Persa', 'Persian', { face: 'flat', fluff: 1.2, tail: 'fluffy', size: 0.95 }],
  ['sphynx', 'Sphynx', 'Sphynx', { face: 'round', headShape: 'wedge', fluff: 0, ears: 'big', tail: 'long', size: 0.85 }],
  ['mainecoon', 'Maine Coon', 'Maine Coon', { face: 'round', headShape: 'square', fluff: 1.1, ears: 'tuft', tail: 'fluffy', size: 1.15 }],
  ['siames', 'Siamês', 'Siamese', { face: 'round', headShape: 'wedge', fluff: 0.15, ears: 'big', tail: 'long', size: 0.88, pattern: 'points' }],
  ['srd', 'SRD (vira-lata)', 'Mixed breed', { face: 'round', fluff: 0.4, tail: 'long', size: 0.9 }],
  ['angora', 'Angorá', 'Angora', { face: 'round', fluff: 1.0, tail: 'fluffy', size: 0.92 }],
  ['bengal', 'Bengal', 'Bengal', { face: 'round', fluff: 0.15, tail: 'long', size: 0.98, pattern: 'spotted' }],
  ['ragdoll', 'Ragdoll', 'Ragdoll', { face: 'round', fluff: 0.9, tail: 'fluffy', size: 1.08, pattern: 'points' }],
  ['british', 'British', 'British Shorthair', { face: 'round', headShape: 'square', fluff: 0.5, ears: 'round', tail: 'short', size: 1.02 }],
  ['exotico', 'Exótico', 'Exotic Shorthair', { face: 'flat', fluff: 0.5, ears: 'round', tail: 'short', size: 0.95 }],
  ['himalaio', 'Himalaio', 'Himalayan', { face: 'flat', fluff: 1.2, tail: 'fluffy', size: 0.96, pattern: 'points' }],
  ['birmanes', 'Sagrado da Birmânia', 'Birman', { face: 'round', fluff: 0.9, tail: 'fluffy', size: 1.0, pattern: 'points' }],
];
// colour variants: [id, pt, en, rarity (0 common, 1 uncommon, 2 rare), spec]
const SOLID = [
  ['branco', 'branco', 'white', 0, { fur: '#ffffff', fur2: '#ffffff', eye: '#6fc3ff' }], ['preto', 'preto', 'black', 0, { fur: '#1f1c24', fur2: '#2f2b36', eye: '#ffc928' }],
  ['cinza', 'cinza', 'grey', 0, { fur: '#8f97a3', fur2: '#c9ced6', eye: '#f2b01e' }], ['laranja', 'laranja', 'ginger', 0, { fur: '#f6a94a', fur2: '#fff3df', pattern: 'tabby', patchA: '#d9822b', eye: '#7bd88f' }],
  ['tricolor', 'tricolor', 'calico', 1, { fur: '#ffffff', fur2: '#ffffff', pattern: 'calico', patchA: '#f28a2e', patchB: '#2b1f24', eye: '#f2b01e' }],
  ['dourado', 'dourado de olhos bicolores', 'golden with odd eyes', 2, { fur: '#ffd27a', fur2: '#fff3c8', eye: '#3fa9f5', eye2: '#7CFF6B', acc: { collar: '#ffd23f', bell: '#ffd23f' } }],
];
const POINTS = [
  ['seal', 'seal point', 'seal point', 0, { fur: '#f2e6d0', fur2: '#fff7ea', patchA: '#5a4030', eye: '#3fa9f5' }], ['blue', 'blue point', 'blue point', 0, { fur: '#eef0f2', fur2: '#ffffff', patchA: '#7d8794', eye: '#6fc3ff' }],
  ['chocolate', 'chocolate point', 'chocolate point', 0, { fur: '#f7ead0', fur2: '#fff7ea', patchA: '#8a5a3a', eye: '#3fa9f5' }], ['lilac', 'lilac point', 'lilac point', 0, { fur: '#f6f0f2', fur2: '#ffffff', patchA: '#b9a6b9', eye: '#8fd3ff' }],
  ['flame', 'flame point', 'flame point', 1, { fur: '#fff3e6', fur2: '#ffffff', patchA: '#f28a2e', eye: '#3fa9f5' }],
  ['neve', 'neve de olhos violeta', 'snow with violet eyes', 2, { fur: '#ffffff', fur2: '#ffffff', patchA: '#d8d0e8', eye: '#b967ff', acc: { bow: '#b967ff' } }],
];
const SPOT = [
  ['marrom', 'marrom', 'brown', 0, { fur: '#d9a066', fur2: '#f2d6a8', patchA: '#6b4326', eye: '#3fae6a' }], ['prata', 'prata', 'silver', 0, { fur: '#c9ced6', fur2: '#ffffff', patchA: '#4a4f5a', eye: '#7bd88f' }],
  ['carvao', 'carvão', 'charcoal', 0, { fur: '#6b6f7a', fur2: '#9aa0a8', patchA: '#1f1c24', eye: '#f2b01e' }], ['areia', 'areia', 'sand', 0, { fur: '#e8c9a0', fur2: '#fff3df', patchA: '#b5763a', eye: '#3fae6a' }],
  ['neve', 'neve', 'snow', 1, { fur: '#fff7ea', fur2: '#ffffff', patchA: '#c9a27e', eye: '#6fc3ff' }],
  ['melanico', 'melânico de olhos dourados', 'melanistic with golden eyes', 2, { fur: '#2b2530', fur2: '#3a3340', patchA: '#0f0c12', eye: '#ffd23f', acc: { collar: '#2de2e6' } }],
];
const SPHYNX = [
  ['rosa', 'rosado', 'pink', 0, { fur: '#f2c4b8', fur2: '#f7d6cc', eye: '#7bd88f', earIn: '#e89a9a' }], ['cinza', 'cinza', 'grey', 0, { fur: '#a8a4ac', fur2: '#c4c0c8', eye: '#f2b01e', earIn: '#c9a0a8' }],
  ['preto', 'preto', 'black', 0, { fur: '#3a343c', fur2: '#4a444c', eye: '#ffc928', earIn: '#6a4a5a' }], ['creme', 'creme', 'cream', 0, { fur: '#f7e2c8', fur2: '#fff0dc', eye: '#3fa9f5', earIn: '#f4a9b8' }],
  ['bicolor', 'bicolor', 'bicolour', 1, { fur: '#3a343c', fur2: '#f2c4b8', pattern: 'tuxedo', eye: '#7bd88f', earIn: '#e89a9a' }],
  ['fada', 'fada de olhos azul-gelo', 'elf with ice-blue eyes', 2, { fur: '#e8d0e0', fur2: '#f7e6f0', eye: '#8ff3ff', earIn: '#ff9fd0', ears: 'big', acc: { scarf: '#b967ff' } }],
];
const cats = [];
for (const [bid, bpt, ben, base] of BREEDS) {
  const set = bid === 'sphynx' ? SPHYNX : base.pattern === 'points' ? POINTS : base.pattern === 'spotted' ? SPOT : SOLID;
  for (const [vid, vpt, ven, rar, sp] of set) cats.push({ id: bid + '_' + vid, breed: bid, rarity: rar, name: { pt: bpt + ' ' + vpt, en: ven[0].toUpperCase() + ven.slice(1) + ' ' + ben }, spec: Object.assign({ earIn: '#f4a9b8', acc: {} }, base, sp, { pattern: sp.pattern || base.pattern || 'solid' }) });
}
const out = {
  version: 1,
  _doc: 'Cats of the shelter album. rarity 0 common / 1 uncommon (missions, patrols) / 2 rare (only strays found by exploring). Nothing here is sold. care: actions and their cooldown in seconds; home: reward for finding a home.',
  breeds: BREEDS.map(b => ({ id: b[0], name: { pt: b[1], en: b[2] } })),
  care: [{ id: 'feed', icon: '🥣', cd: 90, name: { pt: 'Dar ração', en: 'Feed' } }, { id: 'brush', icon: '🪮', cd: 90, name: { pt: 'Escovar', en: 'Brush' } }, { id: 'vet', icon: '🩺', cd: 120, name: { pt: 'Veterinário', en: 'Vet visit' } }, { id: 'play', icon: '🧶', cd: 90, name: { pt: 'Brincar', en: 'Play' } }],
  rewards: { care: { coins: 12, xp: 6 }, home: [{ coins: 150, xp: 60 }, { coins: 260, xp: 100 }, { coins: 500, xp: 180 }] },
  names: ['Bolinha', 'Paçoca', 'Mingau', 'Farofa', 'Pipoca', 'Amora', 'Jujuba', 'Tapioca', 'Fubá', 'Canjica', 'Pudim', 'Brigadeiro', 'Quindim', 'Cocada', 'Biscoito', 'Nuvem', 'Tofu', 'Sushi', 'Pingo', 'Fumaça', 'Mel', 'Pitanga', 'Caju', 'Feijão'],
  cats,
};
fs.writeFileSync('public/data/shelter.json', JSON.stringify(out));
console.log(cats.length, 'variants,', BREEDS.length, 'breeds,', cats.filter(c => c.rarity === 2).length, 'rare');
