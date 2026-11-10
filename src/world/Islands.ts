import * as THREE from 'three';
import { Rng, valueNoise2 } from '../core/rng';
import type { Season } from '../core/Clock';

export type Biome = 'meadow' | 'forest' | 'flower' | 'rocky' | 'beach' | 'misty' | 'starry' | 'orchard';

export const BIOME_LABEL: Record<Biome, string> = {
  meadow: '草原の島',
  forest: '森の島',
  flower: '花の島',
  rocky: '岩の島',
  beach: 'なぎさの島',
  misty: '霧の島',
  starry: '星屑の島',
  orchard: '果樹の島',
};

const BIOME_GROUND: Record<Biome, string> = {
  meadow: '#8fcf6a',
  forest: '#6fae5a',
  flower: '#a8d87a',
  rocky: '#b8b098',
  beach: '#f0e2b0',
  misty: '#a8c8b8',
  starry: '#7a7ab8',
  orchard: '#9ad06a',
};

const SEASON_TINT: Record<Season, string> = {
  spring: '#b8e888',
  summer: '#7cc85a',
  autumn: '#d8b860',
  winter: '#f2f6ff',
};

export interface PropDef {
  id: string;
  kind: 'tree' | 'pine' | 'fruit' | 'rock' | 'bush' | 'orerock';
  x: number;
  z: number;
  cx: number; // cell
  cz: number;
}

export interface IslandInfo {
  index: number;
  cx: number;
  cz: number;
  radius: number;
  biome: Biome;
  seed: number;
  edge: number[]; // radial multipliers (N samples)
  bridgeTo: number;
  name: string;
  props: PropDef[];
}

const N = 36;

const NAME_A = ['そよかぜ', 'ほしぞら', 'わたぐも', 'こもれび', 'あさぎり', 'ゆうなぎ', 'つきあかり', 'はなさき', 'にじいろ', 'しずく', 'ひだまり', 'みずいろ', 'ささなみ', 'こがね', 'しろがね', 'あまつ'];
const NAME_B = ['島', '浮島', '岬', 'の丘', 'の庭', '小島'];

export function makeIsland(index: number, worldSeed: number, prev: IslandInfo[]): IslandInfo {
  const rng = new Rng(worldSeed + index * 1013);
  const edge: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    edge.push(0.86 + 0.22 * valueNoise2(Math.cos(a) * 1.6 + index * 3.1, Math.sin(a) * 1.6, worldSeed % 997));
  }
  if (index === 0) {
    return { index, cx: 0, cz: 0, radius: 17, biome: 'meadow', seed: worldSeed, edge: edge.map((e) => 0.92 + (e - 0.86) * 0.4), bridgeTo: -1, name: 'はじまりの島', props: [] };
  }
  const biomes: Biome[] = ['forest', 'flower', 'rocky', 'beach', 'misty', 'starry', 'orchard', 'meadow'];
  // first few islands are fixed so every minigame / resource appears early
  const fixed: Biome[] = ['beach', 'forest', 'flower', 'starry', 'rocky', 'orchard', 'misty'];
  const biome = index <= fixed.length ? fixed[index - 1] : rng.pick(biomes);
  const radius = rng.range(9, 14) + Math.min(6, index * 0.15);
  // golden-angle spiral placement, pushed outward until no overlap
  let ang = index * 2.39996 + rng.range(-0.3, 0.3);
  let dist = 26 + Math.sqrt(index) * 14;
  let cx = 0,
    cz = 0;
  for (let tries = 0; tries < 200; tries++) {
    cx = Math.cos(ang) * dist;
    cz = Math.sin(ang) * dist;
    let ok = true;
    for (const p of prev) {
      const d = Math.hypot(p.cx - cx, p.cz - cz);
      if (d < p.radius + radius + 7) {
        ok = false;
        break;
      }
    }
    if (ok) break;
    dist += 2.5;
    ang += 0.07;
  }
  // bridge to nearest previous island
  let best = 0,
    bd = Infinity;
  for (const p of prev) {
    const d = Math.hypot(p.cx - cx, p.cz - cz) - p.radius;
    if (d < bd) {
      bd = d;
      best = p.index;
    }
  }
  const name = rng.pick(NAME_A) + rng.pick(NAME_B);
  return { index, cx: Math.round(cx), cz: Math.round(cz), radius, biome, seed: worldSeed + index * 7, edge, bridgeTo: best, name, props: [] };
}

export function edgeRadius(isl: IslandInfo, angle: number): number {
  let a = angle / (Math.PI * 2);
  a = ((a % 1) + 1) % 1;
  const f = a * N;
  const i0 = Math.floor(f) % N;
  const i1 = (i0 + 1) % N;
  const t = f - Math.floor(f);
  return isl.radius * (isl.edge[i0] * (1 - t) + isl.edge[i1] * t);
}

/** Generates natural props for an island (deterministic). */
export function generateProps(isl: IslandInfo, removed: Set<string>, reserved: (cx: number, cz: number) => boolean): PropDef[] {
  const rng = new Rng(isl.seed * 31 + 17);
  const props: PropDef[] = [];
  const density: Record<Biome, number> = { meadow: 0.05, forest: 0.14, flower: 0.05, rocky: 0.06, beach: 0.03, misty: 0.07, starry: 0.04, orchard: 0.09 };
  const area = Math.PI * isl.radius * isl.radius;
  const count = Math.floor(area * density[isl.biome]) + (isl.index === 0 ? 10 : 0);
  const used = new Set<string>();
  for (let i = 0; i < count * 3 && props.length < count; i++) {
    const a = rng.float() * Math.PI * 2;
    const r = Math.sqrt(rng.float()) * (edgeRadius(isl, a) - 1.8);
    const x = isl.cx + Math.cos(a) * r;
    const z = isl.cz + Math.sin(a) * r;
    const cx = Math.floor(x),
      cz = Math.floor(z);
    const key = `${cx},${cz}`;
    if (used.has(key) || reserved(cx, cz)) continue;
    // home island: keep center open for building
    if (isl.index === 0 && Math.hypot(x, z) < 12) continue;
    used.add(key);
    let kind: PropDef['kind'];
    const roll = rng.float();
    switch (isl.biome) {
      case 'forest':
        kind = roll < 0.5 ? 'pine' : roll < 0.85 ? 'tree' : 'bush';
        break;
      case 'rocky':
        kind = roll < 0.45 ? 'rock' : roll < 0.75 ? 'orerock' : 'pine';
        break;
      case 'orchard':
        kind = roll < 0.65 ? 'fruit' : roll < 0.85 ? 'tree' : 'bush';
        break;
      case 'beach':
        kind = roll < 0.5 ? 'rock' : 'bush';
        break;
      default:
        kind = roll < 0.4 ? 'tree' : roll < 0.6 ? 'pine' : roll < 0.75 ? 'fruit' : roll < 0.9 ? 'rock' : 'bush';
    }
    const id = `${isl.index}:${props.length}`;
    if (removed.has(id)) {
      props.push({ id, kind, x: -9999, z: -9999, cx: -9999, cz: -9999 });
      continue;
    }
    props.push({ id, kind, x: cx + 0.5, z: cz + 0.5, cx, cz });
  }
  return props;
}

/** Build the terrain mesh (top + rocky underside). */
export function buildIslandMesh(isl: IslandInfo, season: Season): THREE.Mesh {
  const rng = new Rng(isl.seed);
  const pos: number[] = [];
  const col: number[] = [];
  const ground = new THREE.Color(BIOME_GROUND[isl.biome]).lerp(new THREE.Color(SEASON_TINT[season]), season === 'winter' ? 0.75 : 0.35);
  const ground2 = ground.clone().offsetHSL(0.015, 0.02, -0.05);
  const dirt = new THREE.Color('#b08a62');
  const rock = new THREE.Color(isl.biome === 'starry' ? '#5a5a8a' : '#9a8e80');
  const rockDark = rock.clone().offsetHSL(0, 0, -0.15);
  const rings = [0, 0.35, 0.7, 0.92, 1.0];
  const ringY = [0, 0, 0, 0, -0.18];
  const under = [
    { r: 0.97, y: -0.7 },
    { r: 0.8, y: -2.2 },
    { r: 0.55, y: -4.2 },
    { r: 0.28, y: -6.5 },
  ];
  const pt = (ri: number, i: number, top: boolean): [number, number, number] => {
    const a = (i / N) * Math.PI * 2;
    const er = edgeRadius(isl, a);
    if (top) {
      const r = rings[ri] * er;
      return [isl.cx + Math.cos(a) * r, ringY[ri], isl.cz + Math.sin(a) * r];
    }
    const u = under[ri];
    const j = valueNoise2(i * 0.7, ri * 1.3, isl.seed % 1000) * 0.5;
    const r = u.r * er * (0.9 + j * 0.3);
    return [isl.cx + Math.cos(a) * r, u.y * (isl.radius / 13) - j, isl.cz + Math.sin(a) * r];
  };
  const tmp = new THREE.Color();
  const push = (p: [number, number, number], c: THREE.Color) => {
    pos.push(...p);
    if (c === ground || c === ground2) {
      // smooth noise based tint so neighbouring triangles match
      const n = valueNoise2(p[0] * 0.18, p[2] * 0.18, isl.seed % 1000);
      tmp.copy(ground).lerp(ground2, n);
      col.push(tmp.r, tmp.g, tmp.b);
    } else col.push(c.r, c.g, c.b);
  };
  const center: [number, number, number] = [isl.cx, 0, isl.cz];
  const edgeCol = dirt.clone().lerp(ground, 0.3);
  for (let i = 0; i < N; i++) {
    const i2 = (i + 1) % N;
    // top center fan
    const cTop = rng.chance(0.5) ? ground : ground2;
    push(center, cTop);
    push(pt(1, i2, true), cTop);
    push(pt(1, i, true), cTop);
    for (let r = 1; r < rings.length - 1; r++) {
      const c = r === rings.length - 2 ? (rng.chance(0.5) ? ground2 : ground) : rng.chance(0.5) ? ground : ground2;
      const ce = r === rings.length - 2 ? edgeCol : c;
      const a = pt(r, i, true),
        b = pt(r, i2, true),
        d = pt(r + 1, i, true),
        e = pt(r + 1, i2, true);
      push(a, c);
      push(b, c);
      push(e, ce);
      push(a, c);
      push(e, ce);
      push(d, ce);
    }
    // underside
    let prevA = pt(rings.length - 1, i, true),
      prevB = pt(rings.length - 1, i2, true);
    for (let u = 0; u < under.length; u++) {
      const a = pt(u, i, false),
        b = pt(u, i2, false);
      const c = u === 0 ? dirt : rng.chance(0.5) ? rock : rockDark;
      push(prevA, c);
      push(prevB, c);
      push(b, c);
      push(prevA, c);
      push(b, c);
      push(a, c);
      prevA = a;
      prevB = b;
    }
    const tip: [number, number, number] = [isl.cx, (-8.5 * isl.radius) / 13, isl.cz];
    push(prevA, rockDark);
    push(prevB, rockDark);
    push(tip, rockDark);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
