// Whitelist validation for cat profiles. Everything the 3D model or the gallery
// reads is checked here; unknown keys are dropped, invalid values are rejected.
import { fail } from './http.js';
import { isProfane } from './profanity.js';

export const MAX_CATS = 5;
export const BREEDS = ['persa', 'siames', 'vira-lata', 'srd', 'maine-coon', 'sphynx', 'angora', 'bengal',
  'ragdoll', 'british', 'sem-raca', 'outro'];
export const FACE_SHAPES = ['round', 'flat', 'wedge', 'square', 'long'];
export const PATTERNS = ['solid', 'calico', 'tuxedo', 'tabby', 'bicolor', 'pointed'];
export const ACCESSORIES = ['collar', 'bell', 'bow', 'bowtie', 'bandana', 'scarf', 'sunglasses', 'glasses',
  'hat', 'cap', 'crown', 'flower', 'chain'];
export const MAX_PATCH_COLORS = 4;
export const MAX_ACCESSORIES = 4;
export const DEFAULT_SPEC = Object.freeze({
  size: 1, faceShape: 'round', furBase: '#d9a066', pattern: 'solid', patchColors: [], eyeColor: '#7bc86c', accessories: [],
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const invalid = (field) => fail(400, 'invalid', { field });
const blocked = (field) => fail(422, 'moderation', { field });

export function hex(v) {
  if (typeof v !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].toLowerCase();
  return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h);
}

// Control chars, bidi overrides and angle brackets never reach the database.
const clean = (v) => String(v).normalize('NFC')
  .replace(/[\p{Cc}​‪-‮⁦-⁩﻿<>]/gu, ' ').replace(/\s+/g, ' ').trim();

export function validateSpec(input) {
  if (input == null) return { ...DEFAULT_SPEC };
  if (typeof input !== 'object' || Array.isArray(input)) throw invalid('spec');
  const out = { ...DEFAULT_SPEC };

  if (input.size != null) {
    const n = Number(input.size);
    if (typeof input.size !== 'number' || !Number.isFinite(n) || n < 0.8 || n > 1.2) throw invalid('spec.size');
    out.size = Math.round(n * 100) / 100;
  }
  if (input.faceShape != null) {
    if (!FACE_SHAPES.includes(input.faceShape)) throw invalid('spec.faceShape');
    out.faceShape = input.faceShape;
  }
  if (input.pattern != null) {
    if (!PATTERNS.includes(input.pattern)) throw invalid('spec.pattern');
    out.pattern = input.pattern;
  }
  for (const key of ['furBase', 'eyeColor']) {
    if (input[key] != null) {
      const h = hex(input[key]);
      if (!h) throw invalid(`spec.${key}`);
      out[key] = h;
    }
  }
  if (input.patchColors != null) {
    if (!Array.isArray(input.patchColors) || input.patchColors.length > MAX_PATCH_COLORS) throw invalid('spec.patchColors');
    out.patchColors = input.patchColors.map((c) => {
      const h = hex(c);
      if (!h) throw invalid('spec.patchColors');
      return h;
    });
  }
  if (input.accessories != null) {
    if (!Array.isArray(input.accessories) || input.accessories.length > MAX_ACCESSORIES) throw invalid('spec.accessories');
    if (input.accessories.some((a) => !ACCESSORIES.includes(a))) throw invalid('spec.accessories');
    out.accessories = [...new Set(input.accessories)];
  }
  return out;
}

/** Validates a POST/PUT body. Returns the row to store, or throws 400 / 422. */
export function validateCat(b) {
  if (typeof b.name !== 'string') throw invalid('name');
  const name = clean(b.name).replace(/[^\p{L}\p{M}\p{N} '._-]/gu, '').replace(/\s+/g, ' ').trim();
  if (!name || [...name].length > 20) throw invalid('name');

  if (!BREEDS.includes(b.breed)) throw invalid('breed');

  let bio = '';
  if (b.bio != null) {
    if (typeof b.bio !== 'string') throw invalid('bio');
    bio = clean(b.bio);
    if ([...bio].length > 120) throw invalid('bio');
  }

  let instagram = null;
  if (b.instagram != null && b.instagram !== '') {
    if (typeof b.instagram !== 'string') throw invalid('instagram');
    const h = b.instagram.trim().replace(/^@/, '').toLowerCase();
    // Instagram rules: letters, digits, "." and "_", up to 30, no leading/trailing/double dots.
    if (!/^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/.test(h)) throw invalid('instagram');
    instagram = h;
  }

  if (b.isPublic != null && typeof b.isPublic !== 'boolean') throw invalid('isPublic');
  const spec = validateSpec(b.spec);

  if (isProfane(name)) throw blocked('name');
  if (bio && isProfane(bio)) throw blocked('bio');
  if (instagram && isProfane(instagram)) throw blocked('instagram');

  return { name, breed: b.breed, spec, bio, instagram, isPublic: b.isPublic ?? true };
}
