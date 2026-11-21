// Powers, attacks and personalities: data integrity of public/data/powers.json and server-side validation of the cat spec.   node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSpec, validateCat, PERSONALITIES, ATTACKS, POWERS, ROLES } from '../api/_lib/validate.js';

const D = JSON.parse(await readFile(new URL('../public/data/powers.json', import.meta.url), 'utf8'));
const bilingual = (o, what) => { assert.ok(o && typeof o.pt === 'string' && o.pt && typeof o.en === 'string' && o.en, what + ' needs pt + en'); };
const goodSet = (attack, powers, what) => {
  assert.ok(D.attacks[attack], what + ': attack ' + attack);
  assert.equal(powers.length, 4, what + ': 4 powers');
  assert.equal(new Set(powers).size, 4, what + ': powers are different');
  for (const p of powers) assert.ok(D.powers[p], what + ': power ' + p);
};

test('powers.json: about 20 powers and 5 attacks, all bilingual with sane numbers', () => {
  assert.ok(Object.keys(D.powers).length >= 20, 'has ' + Object.keys(D.powers).length + ' powers');
  assert.deepEqual(Object.keys(D.attacks).sort(), ['bite', 'bubbles', 'pounce', 'swipe', 'yarn']);
  for (const [id, p] of Object.entries(D.powers)) {
    bilingual(p.name, id); bilingual(p.desc, id);
    assert.ok(p.emoji, id + ' emoji');
    assert.ok(p.cd >= 2 && p.cd <= 40, id + ' cooldown');
    assert.ok(p.cost >= 5 && p.cost <= 40, id + ' energy cost');
  }
  for (const [id, a] of Object.entries(D.attacks)) { bilingual(a.name, id); bilingual(a.desc, id); assert.equal(typeof a.ranged, 'boolean', id + ' ranged flag'); }
  assert.deepEqual(Object.keys(D.attacks).filter(k => D.attacks[k].ranged).sort(), ['bubbles', 'yarn'], 'only bolhas and bola de lã have a reticle');
});

test('powers.json: the official cats keep the owner\'s sets', () => {
  assert.deepEqual(D.official.mimo.powers, ['nap', 'yawn', 'pillow', 'snore']);
  assert.deepEqual(D.official.mimosa.powers, ['tantrum', 'lightning', 'spiky', 'glare']);
  assert.deepEqual(D.official.morticia.powers, ['feast', 'magnet', 'pilfer', 'burp']);
  assert.equal(D.official.mimo.attack, 'bubbles'); assert.equal(D.official.mimosa.attack, 'bite'); assert.equal(D.official.morticia.attack, 'pounce');
  for (const [n, o] of Object.entries(D.official)) goodSet(o.attack, o.powers, n);
  assert.ok(D.powers.feast.name.pt.includes('LANCHÃO'));
});

test('powers.json: 8 personalities with valid suggested sets, and every power is offered somewhere', () => {
  assert.deepEqual(Object.keys(D.personalities), ['dorminhoco', 'nervosinho', 'comilao', 'brincalhao', 'curioso', 'carinhoso', 'aventureiro', 'elegante']);
  const used = new Set();
  for (const [id, q] of Object.entries(D.personalities)) {
    bilingual(q.name, id); bilingual(q.desc, id); assert.ok(q.emoji, id + ' emoji');
    assert.ok(ROLES.includes(q.role), id + ' role');
    goodSet(q.attack, q.powers, id); q.powers.forEach(p => used.add(p));
  }
  for (const o of Object.values(D.official)) o.powers.forEach(p => used.add(p));
  for (const p of Object.keys(D.powers)) assert.ok(used.has(p), p + ' is in no suggested set');
});

test('server enum lists mirror powers.json', () => {
  assert.deepEqual([...PERSONALITIES].sort(), Object.keys(D.personalities).sort());
  assert.deepEqual([...ATTACKS].sort(), Object.keys(D.attacks).sort());
  assert.deepEqual([...POWERS].sort(), Object.keys(D.powers).sort());
});

test('validateSpec: personality, attack and powers are stored when valid', () => {
  const s = validateSpec({ personality: 'brincalhao', attack: 'yarn', powers: ['furball', 'zoomies', 'doublejump', 'spin'] });
  assert.equal(s.personality, 'brincalhao'); assert.equal(s.attack, 'yarn'); assert.deepEqual(s.powers, ['furball', 'zoomies', 'doublejump', 'spin']);
  // old cats without the new fields still validate and gain nothing
  const old = validateSpec({ pattern: 'solid' });
  assert.equal(old.personality, undefined); assert.equal(old.attack, undefined); assert.equal(old.powers, undefined);
  // a player may swap any slot for any power of the full list
  assert.deepEqual(validateSpec({ powers: ['glare', 'burp', 'nap', 'catnap'] }).powers, ['glare', 'burp', 'nap', 'catnap']);
});

test('validateSpec: unknown or malformed values are rejected', () => {
  const bad = [
    { personality: 'malvado' }, { personality: 5 }, { attack: 'laser' }, { attack: 'BITE' }, { attack: ['bite'] },
    { powers: ['nap', 'yawn', 'pillow'] }, { powers: ['nap', 'yawn', 'pillow', 'snore', 'burp'] },
    { powers: ['nap', 'yawn', 'pillow', 'fireball'] }, { powers: ['nap', 'nap', 'pillow', 'snore'] },
    { powers: 'nap,yawn,pillow,snore' }, { powers: ['nap', 'yawn', 'pillow', 7] }, { powers: [null, 'yawn', 'pillow', 'snore'] },
  ];
  for (const b of bad) assert.throws(() => validateSpec(b), e => e && (e.status === 400 || e.statusCode === 400 || /invalid/.test(String(e.message || e.code || JSON.stringify(e)))), JSON.stringify(b));
});

test('validateCat carries the powers through to the stored spec', () => {
  const c = validateCat({ name: 'Bolinha', breed: 'srd', spec: { role: 'shooter', personality: 'dorminhoco', attack: 'bubbles', powers: D.personalities.dorminhoco.powers } });
  assert.equal(c.spec.personality, 'dorminhoco'); assert.deepEqual(c.spec.powers, ['nap', 'yawn', 'pillow', 'snore']);
  assert.throws(() => validateCat({ name: 'Bolinha', breed: 'srd', spec: { powers: ['nap', 'yawn', 'pillow', 'x'] } }));
});
