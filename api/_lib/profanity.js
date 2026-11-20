// Basic PT/EN blocklist for cat names, bios and handles. It is intentionally
// simple: whole-word matches (so "disputa" or "Scunthorpe" pass) plus a few
// unambiguous stems, after undoing accents, leetspeak and stretched letters.
const WORDS = [
  // pt
  'puta', 'putas', 'puto', 'putos', 'putinha', 'putaria', 'caralho', 'caralhos', 'krl', 'porra', 'merda', 'merdas',
  'bosta', 'foder', 'foda', 'fodase', 'fodido', 'fodida', 'cu', 'cuzao', 'cuzinho', 'buceta', 'boceta', 'piroca',
  'viado', 'viadinho', 'arrombado', 'arrombada', 'babaca', 'vagabunda', 'vadia', 'corno', 'desgracado',
  'desgracada', 'fdp', 'pqp', 'vsf', 'vtnc', 'tnc', 'punheta', 'xoxota', 'xereca', 'cacete', 'escroto', 'escrota',
  'retardado', 'retardada', 'estupro', 'estuprador', 'pedofilo', 'pedofilia', 'nazista', 'hitler', 'prostituta',
  'sapatao', 'traveco', 'penis', 'vagina', 'porno', 'pornografia',
  // en
  'fuck', 'fucker', 'fucking', 'fuckin', 'fucked', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bitches',
  'cunt', 'dick', 'dickhead', 'cock', 'pussy', 'asshole', 'arsehole', 'bastard', 'slut', 'whore', 'nigger', 'nigga',
  'faggot', 'fag', 'retard', 'retarded', 'rape', 'rapist', 'nazi', 'porn', 'wanker', 'twat', 'pedo', 'pedophile',
  'tranny', 'kike', 'spic', 'chink',
];
// Substring matches: only stems that do not occur inside ordinary PT/EN words.
const STEMS = ['fuck', 'caralh', 'bucet', 'bocet', 'nigg', 'faggot', 'arromb', 'motherf', 'fodase', 'punhet',
  'xoxot', 'estupr', 'pedofil', 'asshole', 'cuzao', 'piroc', 'vagabund', 'filhodaputa', 'filhadaputa'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
const squeeze = (s) => s.replace(/(.)\1+/g, '$1');
const RAW = new Set(WORDS);
const SQUEEZED = new Set(WORDS.map(squeeze));

function normalize(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[013457@$]/g, (c) => LEET[c]);
}

/** true when the text contains a blocked word. */
export function isProfane(text) {
  const tokens = normalize(text).split(/[^a-z]+/).filter(Boolean);
  // "f u c k" / "p.u.t.a": glue runs of single letters back together
  const glued = [];
  let run = '';
  for (const t of tokens) {
    if (t.length === 1) { run += t; continue; }
    if (run) { glued.push(run); run = ''; }
    glued.push(t);
  }
  if (run) glued.push(run);
  for (const t of new Set([...tokens, ...glued])) {
    if (RAW.has(t)) return true;
    const s = squeeze(t);
    if (s !== t && SQUEEZED.has(s)) return true;          // "puuuta", "fuuuck"
    if (STEMS.some((stem) => t.includes(stem) || s.includes(stem))) return true;
  }
  const joined = tokens.join('');
  return STEMS.some((stem) => stem.length >= 6 && joined.includes(stem));
}
