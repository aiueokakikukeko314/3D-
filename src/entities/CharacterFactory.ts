import * as THREE from 'three';
import { Builder, G } from '../build/Builder';
import { getMaterial, type PatternId } from '../build/materials';
import { getSpecies, type SpeciesDef } from '../data/species';
import type { Taste } from '../data/items';

export interface CharLook {
  species: string;
  body?: string;
  belly?: string;
  accent?: string;
  cloth?: string; // scarf / clothes color
  glow?: boolean;
}

const geoCache = new Map<string, Map<string, THREE.BufferGeometry>>();

function buildAnimal(b: Builder, sp: SpeciesDef): void {
  const body = sp.body;
  // body
  if (body === 'jelly') {
    b.sphere('body', 0.42, 0, 0.75, 0, 1, 0.8, 1, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add('accent', G.cyl(0.05, 0.02, 0.5, 4), Math.cos(a) * 0.25, 0.32, Math.sin(a) * 0.25);
    }
  } else {
    const sy = body === 'tall' ? 1.2 : body === 'egg' ? 1.15 : 1;
    b.sphere('body', 0.3, 0, 0.32 * sy, 0, 1, sy, 0.9, 1);
    b.sphere('belly', 0.2, 0, 0.3 * sy, 0.14, 1, sy, 0.6, 1);
    if (body === 'wool') for (let i = 0; i < 7; i++) b.sphere('belly', 0.14, Math.cos(i) * 0.25, 0.35 + (i % 3) * 0.12, Math.sin(i) * 0.2 - 0.05, 1, 1, 1, 0);
    // feet
    b.sphere('accent', 0.09, -0.13, 0.05, 0.08, 1, 0.6, 1.3, 0);
    b.sphere('accent', 0.09, 0.13, 0.05, 0.08, 1, 0.6, 1.3, 0);
  }
  // head
  const hy = body === 'jelly' ? 0.75 : body === 'tall' ? 0.98 : 0.86;
  if (body !== 'jelly') b.sphere('body', 0.34, 0, hy, 0, 1.05, 0.95, 1, 1);
  if (sp.snout) b.sphere('belly', 0.13, 0, hy - 0.08, 0.28, 1.1, 0.8, 1, 0);
  if (sp.mask) {
    b.sphere('accent', 0.1, -0.13, hy + 0.02, 0.24, 1.3, 0.9, 0.5, 0);
    b.sphere('accent', 0.1, 0.13, hy + 0.02, 0.24, 1.3, 0.9, 0.5, 0);
  }
  // eyes & cheeks
  const ez = body === 'jelly' ? 0.36 : 0.3;
  b.sphere('eye', 0.045, -0.11, hy + 0.03, ez, 1, 1.25, 0.6, 0);
  b.sphere('eye', 0.045, 0.11, hy + 0.03, ez, 1, 1.25, 0.6, 0);
  b.sphere('cheek', 0.05, -0.19, hy - 0.06, ez - 0.04, 1, 0.6, 0.4, 0);
  b.sphere('cheek', 0.05, 0.19, hy - 0.06, ez - 0.04, 1, 0.6, 0.4, 0);
  // ears
  const ey = hy + 0.25;
  switch (sp.ears) {
    case 'long':
      b.add('body', G.cyl(0.07, 0.09, 0.45, 6), -0.12, ey + 0.18, -0.02, 0, 0, 0.15);
      b.add('body', G.cyl(0.07, 0.09, 0.45, 6), 0.12, ey + 0.18, -0.02, 0, 0, -0.15);
      b.add('accent', G.cyl(0.035, 0.05, 0.35, 5), -0.12, ey + 0.18, 0.03, 0, 0, 0.15);
      b.add('accent', G.cyl(0.035, 0.05, 0.35, 5), 0.12, ey + 0.18, 0.03, 0, 0, -0.15);
      break;
    case 'cat':
    case 'fox': {
      const h = sp.ears === 'fox' ? 0.24 : 0.17;
      b.add('body', G.cone(0.1, h, 4), -0.18, ey, 0, 0, 0, 0.3);
      b.add('body', G.cone(0.1, h, 4), 0.18, ey, 0, 0, 0, -0.3);
      b.add('accent', G.cone(0.05, h * 0.7, 4), -0.18, ey - 0.01, 0.04, 0, 0, 0.3);
      b.add('accent', G.cone(0.05, h * 0.7, 4), 0.18, ey - 0.01, 0.04, 0, 0, -0.3);
      break;
    }
    case 'round':
      b.sphere('body', 0.1, -0.22, ey - 0.03, 0, 1, 1, 0.6, 0);
      b.sphere('body', 0.1, 0.22, ey - 0.03, 0, 1, 1, 0.6, 0);
      break;
    case 'small':
      b.sphere('body', 0.07, -0.2, ey - 0.06, 0, 1, 1, 0.6, 0);
      b.sphere('body', 0.07, 0.2, ey - 0.06, 0, 1, 1, 0.6, 0);
      break;
    case 'tuft':
      b.add('accent', G.cone(0.07, 0.16, 4), -0.2, ey - 0.02, 0, 0, 0, 0.5);
      b.add('accent', G.cone(0.07, 0.16, 4), 0.2, ey - 0.02, 0, 0, 0, -0.5);
      b.add('accent', G.cone(0.05, 0.08, 4), 0, hy - 0.03, 0.33, Math.PI / 2, 0, 0);
      break;
    case 'horn':
      b.torus('accent', 0.1, 0.04, -0.25, ey - 0.08, 0, 0, Math.PI / 2);
      b.torus('accent', 0.1, 0.04, 0.25, ey - 0.08, 0, 0, Math.PI / 2);
      break;
    case 'floppy':
      b.sphere('accent', 0.11, -0.3, hy, 0, 0.6, 1.4, 0.8, 0);
      b.sphere('accent', 0.11, 0.3, hy, 0, 0.6, 1.4, 0.8, 0);
      break;
    default:
      break;
  }
  if (sp.id === 'pengin') b.add('accent', G.cone(0.06, 0.12, 4), 0, hy - 0.06, 0.36, Math.PI / 2, 0, 0);
  // tail
  switch (sp.tail) {
    case 'round':
      b.sphere('belly', 0.1, 0, 0.25, -0.3, 1, 1, 1, 0);
      break;
    case 'long':
      b.add('body', G.cyl(0.035, 0.04, 0.5, 5), 0, 0.42, -0.36, -0.7, 0, 0);
      break;
    case 'fluffy':
      b.sphere('body', 0.2, 0, 0.45, -0.34, 0.8, 1.3, 0.8, 1);
      b.sphere('belly', 0.1, 0, 0.7, -0.38, 1, 1, 1, 0);
      break;
    case 'thick':
      b.add('body', G.cyl(0.05, 0.1, 0.45, 6), 0, 0.15, -0.38, -1.2, 0, 0);
      break;
    case 'stripe':
      b.sphere('body', 0.13, 0, 0.3, -0.33, 1, 1, 1.2, 0);
      b.sphere('accent', 0.11, 0, 0.32, -0.45, 1, 1, 1, 0);
      break;
    case 'wing':
      b.sphere('accent', 0.14, -0.3, 0.38, 0, 0.4, 1, 0.9, 0);
      b.sphere('accent', 0.14, 0.3, 0.38, 0, 0.4, 1, 0.9, 0);
      break;
    case 'tiny':
      b.sphere('body', 0.07, 0, 0.22, -0.3, 1, 1, 1, 0);
      break;
    default:
      break;
  }
  // scarf
  if (body !== 'jelly') b.torus('cloth', 0.25, 0.05, 0, hy - 0.3, 0, Math.PI / 2, 0);
}

function animalGeo(speciesId: string): Map<string, THREE.BufferGeometry> {
  let g = geoCache.get('a:' + speciesId);
  if (!g) {
    const b = new Builder();
    buildAnimal(b, getSpecies(speciesId));
    g = b.merge();
    geoCache.set('a:' + speciesId, g);
  }
  return g;
}

export function createAnimal(look: CharLook, shadows: boolean): THREE.Group {
  const sp = getSpecies(look.species);
  const geos = animalGeo(look.species);
  const colors: Record<string, string> = {
    body: look.body ?? sp.colors[0],
    belly: look.belly ?? sp.colors[1],
    accent: look.accent ?? sp.colors[2],
    eye: '#2a2230',
    cheek: '#ff9ab0',
    cloth: look.cloth ?? '#ffffff',
  };
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  for (const [slot, geo] of geos) {
    const kind = look.glow && (slot === 'body' || slot === 'accent') ? 'glow' : 'normal';
    const mesh = new THREE.Mesh(geo, getMaterial(colors[slot] ?? '#ffffff', 'none', '#fff', kind));
    mesh.castShadow = shadows;
    inner.add(mesh);
  }
  if (sp.floating || look.glow) inner.position.y = 0.25;
  root.userData.inner = inner;
  return root;
}

// ---------- player ----------
export interface PlayerLook {
  shirt: string;
  pants: string;
  hat: string;
  hair: string;
  pattern: PatternId;
}

export function createPlayer(look: PlayerLook, shadows: boolean): THREE.Group {
  let geos = geoCache.get('player');
  if (!geos) {
    const b = new Builder();
    // legs
    b.box('pants', 0.12, 0.28, 0.14, -0.08, 0, 0);
    b.box('pants', 0.12, 0.28, 0.14, 0.08, 0, 0);
    b.box('shoe', 0.14, 0.08, 0.2, -0.08, 0, 0.03);
    b.box('shoe', 0.14, 0.08, 0.2, 0.08, 0, 0.03);
    // body
    b.cyl('shirt', 0.2, 0.25, 0.42, 0, 0.26, 0, 8);
    b.sphere('shirt', 0.08, -0.26, 0.5, 0, 1, 1.6, 1, 0);
    b.sphere('shirt', 0.08, 0.26, 0.5, 0, 1, 1.6, 1, 0);
    b.sphere('skin', 0.06, -0.27, 0.34, 0, 1, 1, 1, 0);
    b.sphere('skin', 0.06, 0.27, 0.34, 0, 1, 1, 1, 0);
    // head
    b.sphere('skin', 0.3, 0, 0.95, 0, 1, 0.95, 1, 1);
    b.sphere('hair', 0.31, 0, 1.02, -0.04, 1.02, 0.8, 1, 1);
    b.sphere('eye', 0.04, -0.1, 0.95, 0.27, 1, 1.4, 0.6, 0);
    b.sphere('eye', 0.04, 0.1, 0.95, 0.27, 1, 1.4, 0.6, 0);
    b.sphere('cheek', 0.045, -0.17, 0.86, 0.24, 1, 0.6, 0.4, 0);
    b.sphere('cheek', 0.045, 0.17, 0.86, 0.24, 1, 0.6, 0.4, 0);
    // lighthouse keeper cap
    b.cyl('hat', 0.33, 0.33, 0.06, 0, 1.17, 0.02, 12);
    b.cyl('hat', 0.24, 0.27, 0.2, 0, 1.2, -0.02, 10);
    b.box('hat', 0.3, 0.03, 0.16, 0, 1.17, 0.3);
    b.sphere('lamp', 0.05, 0, 1.33, 0.18, 1, 1, 1, 0);
    // bag strap
    b.box('pants', 0.04, 0.45, 0.42, 0.0, 0.3, 0, 0.7);
    geos = b.merge();
    geoCache.set('player', geos);
  }
  const colors: Record<string, string> = {
    pants: look.pants,
    shoe: '#5a3a2a',
    shirt: look.shirt,
    skin: '#ffe0c8',
    hair: look.hair,
    eye: '#2a2230',
    cheek: '#ff9ab0',
    hat: look.hat,
    lamp: '#ffe27a',
  };
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  for (const [slot, geo] of geos) {
    const mat =
      slot === 'shirt' && look.pattern !== 'none'
        ? getMaterial(colors.shirt, look.pattern, '#ffffff')
        : getMaterial(colors[slot] ?? '#fff', 'none', '#fff', slot === 'lamp' ? 'glow' : 'normal');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadows;
    mesh.userData.slot = slot;
    inner.add(mesh);
  }
  root.userData.inner = inner;
  return root;
}

// ---------- Soramochi (pet) ----------
export type PetForm = 'egg' | 'kogumo' | Taste;

export function petForm(level: number, traits: Record<Taste, number>): PetForm {
  if (level < 5) return 'egg';
  if (level < 15) return 'kogumo';
  let best: Taste = 'sweet';
  for (const k of Object.keys(traits) as Taste[]) if (traits[k] > traits[best]) best = k;
  return best;
}

export const PET_FORM_LABEL: Record<PetForm, string> = {
  egg: 'たまご雲',
  kogumo: 'こぐも',
  sweet: 'ふわもちソラモチ',
  sea: 'なみのりソラモチ',
  star: 'ほしよみソラモチ',
  flower: 'はなかざりソラモチ',
};

export function createPet(form: PetForm, body: string, accent: string, pattern: PatternId, level: number, shadows: boolean): THREE.Group {
  const key = 'pet:' + form + ':' + (level >= 50 ? 3 : level >= 30 ? 2 : 1);
  let geos = geoCache.get(key);
  if (!geos) {
    const b = new Builder();
    if (form === 'egg') {
      b.sphere('body', 0.3, 0, 0.32, 0, 0.9, 1.15, 0.9, 1);
      b.sphere('accent', 0.12, 0.1, 0.5, 0.18, 1, 0.6, 0.6, 0);
      b.sphere('eye', 0.035, -0.08, 0.36, 0.26, 1, 1.3, 0.6, 0);
      b.sphere('eye', 0.035, 0.08, 0.36, 0.26, 1, 1.3, 0.6, 0);
    } else {
      const big = form !== 'kogumo';
      const r = big ? 0.42 : 0.32;
      b.sphere('body', r, 0, r, 0, 1.15, 0.85, 1, 1);
      b.sphere('body', r * 0.55, -r * 0.8, r * 0.75, -0.05, 1, 0.85, 1, 1);
      b.sphere('body', r * 0.55, r * 0.8, r * 0.75, -0.05, 1, 0.85, 1, 1);
      b.sphere('body', r * 0.5, 0, r * 1.45, -0.05, 1, 0.8, 1, 1);
      b.sphere('eye', 0.045, -0.12, r * 1.05, r * 0.85, 1, 1.3, 0.6, 0);
      b.sphere('eye', 0.045, 0.12, r * 1.05, r * 0.85, 1, 1.3, 0.6, 0);
      b.sphere('cheek', 0.05, -0.22, r * 0.88, r * 0.78, 1, 0.6, 0.4, 0);
      b.sphere('cheek', 0.05, 0.22, r * 0.88, r * 0.78, 1, 0.6, 0.4, 0);
      if (form === 'kogumo') {
        b.add('accent', G.cone(0.07, 0.14, 4), -0.15, r * 1.75, 0, 0, 0, 0.3);
        b.add('accent', G.cone(0.07, 0.14, 4), 0.15, r * 1.75, 0, 0, 0, -0.3);
      }
      if (form === 'sweet') {
        b.add('accent', G.cone(0.12, 0.25, 5), 0.05, r * 1.9, 0, 0, 0, -0.3);
        b.sphere('accent', 0.08, -0.12, r * 1.85, 0, 1.4, 0.5, 1, 0);
      }
      if (form === 'sea') {
        b.add('accent', G.cone(0.14, 0.3, 4), 0, r * 0.7, -r * 1.05, -1.2, 0, 0);
        b.sphere('accent', 0.12, -r * 1.05, r * 0.5, 0, 0.4, 0.8, 1.2, 0);
        b.sphere('accent', 0.12, r * 1.05, r * 0.5, 0, 0.4, 0.8, 1.2, 0);
      }
      if (form === 'star') {
        b.add('accent', G.cyl(0.015, 0.015, 0.3, 4), 0, r * 1.9, 0);
        b.add('glow', G.ico(0.09, 0), 0, r * 1.9 + 0.32, 0);
      }
      if (form === 'flower') for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.sphere('accent', 0.08, Math.cos(a) * 0.17, r * 1.85, Math.sin(a) * 0.17, 1, 0.5, 1, 0);
      }
      if (level >= 30) b.torus('glow', r * 1.6, 0.025, 0, 0.05, 0, Math.PI / 2, 0);
      if (level >= 50) {
        b.cyl('crown', 0.12, 0.14, 0.1, 0, r * 2.0, 0, 6);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          b.add('crown', G.cone(0.03, 0.08, 4), Math.cos(a) * 0.12, r * 2.0 + 0.13, Math.sin(a) * 0.12);
        }
      }
    }
    geos = b.merge();
    geoCache.set(key, geos);
  }
  const colors: Record<string, string> = { body, accent, eye: '#2a2230', cheek: '#ff9ab0', glow: '#ffe27a', crown: '#ffcf3a' };
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  for (const [slot, geo] of geos) {
    const mat = slot === 'body' && pattern !== 'none' ? getMaterial(body, pattern, accent) : getMaterial(colors[slot], 'none', '#fff', slot === 'glow' ? 'glow' : 'normal');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadows;
    inner.add(mesh);
  }
  const s = 0.75 + Math.min(0.9, level * 0.012);
  root.scale.setScalar(s);
  inner.position.y = 0.15;
  root.userData.inner = inner;
  return root;
}
