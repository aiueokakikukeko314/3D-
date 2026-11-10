import * as THREE from 'three';
import { Builder } from './Builder';
import { getMaterial, type MatKind } from './materials';
import { BUILDINGS, type BuildingDef } from '../data/buildings';
import type { PlacedBuilding } from '../systems/State';
import type { Season } from '../core/Clock';

const DEF_MAP = new Map(BUILDINGS.map((b) => [b.id, b]));
export function getBuildingDef(id: string): BuildingDef {
  return DEF_MAP.get(id) ?? BUILDINGS[0];
}

const SEASON_COLORS: Record<string, Record<Season, string>> = {
  leaf: { spring: '#8fd86a', summer: '#4fae4a', autumn: '#e8873a', winter: '#e8f0f4' },
  pine: { spring: '#4f9a5a', summer: '#3f8a4f', autumn: '#4f8a4a', winter: '#d8e8e8' },
  sakura: { spring: '#ffc0d8', summer: '#5aae4a', autumn: '#d8723a', winter: '#e8eef4' },
  maple: { spring: '#9ad86a', summer: '#5aae4a', autumn: '#e8402a', winter: '#e8eef4' },
};

export function resolveColor(token: string, season: Season): string {
  if (token.startsWith('season:')) {
    const k = token.slice(7);
    return SEASON_COLORS[k]?.[season] ?? '#7fbf5a';
  }
  return token;
}

export function slotColor(pb: PlacedBuilding, key: string, season: Season): string {
  const def = getBuildingDef(pb.type);
  const slot = def.slots.find((s) => s.key === key);
  return pb.colors[key] ?? resolveColor(slot?.def ?? '#cccccc', season);
}

/** Footprint size in cells taking rotation into account. */
export function footprint(def: BuildingDef, rot: number): [number, number] {
  return rot % 2 === 0 ? [def.size[0], def.size[1]] : [def.size[1], def.size[0]];
}

export function cellsOf(def: BuildingDef, x: number, z: number, rot: number): [number, number][] {
  const [w, d] = footprint(def, rot);
  const out: [number, number][] = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push([x + i, z + j]);
  return out;
}

export function centerOf(def: BuildingDef, x: number, z: number, rot: number): [number, number] {
  const [w, d] = footprint(def, rot);
  return [x + w / 2, z + d / 2];
}

const geoCache = new Map<string, Map<string, THREE.BufferGeometry>>();

function geometryFor(def: BuildingDef, level: number): Map<string, THREE.BufferGeometry> {
  const lvKey = Math.min(level, 12);
  const key = `${def.id}|${lvKey}`;
  let g = geoCache.get(key);
  if (!g) {
    const b = new Builder();
    def.build(b, lvKey);
    g = b.merge();
    geoCache.set(key, g);
  }
  return g;
}

/**
 * Creates a THREE.Group for a building (one mesh per color slot).
 * ghost: preview mode (translucent green/red).
 */
export function createBuildingObject(
  pb: Pick<PlacedBuilding, 'type' | 'level' | 'colors' | 'patterns' | 'rot'>,
  season: Season,
  shadows: boolean,
  ghost: 'ok' | 'bad' | null = null,
): THREE.Group {
  const def = getBuildingDef(pb.type);
  const group = new THREE.Group();
  const geos = geometryFor(def, pb.level);
  for (const [slotKey, geo] of geos) {
    const slot = def.slots.find((s) => s.key === slotKey);
    let mat: THREE.Material;
    if (ghost) mat = getMaterial('#ffffff', 'none', '#fff', ghost === 'ok' ? 'ghost' : 'ghostBad');
    else {
      const color = pb.colors[slotKey] ?? resolveColor(slot?.def ?? '#cccccc', season);
      const pat = pb.patterns[slotKey];
      const kind: MatKind = (slot?.kind as MatKind) ?? 'normal';
      mat = getMaterial(color, pat?.p ?? 'none', pat?.c2 ?? '#ffffff', kind);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.slot = slotKey;
    if (!ghost && shadows) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    group.add(mesh);
  }
  // level scale bonus (gentle, capped)
  const s = 1 + Math.min(0.15, (pb.level - 1) * 0.012);
  group.scale.setScalar(s);
  group.rotation.y = (-pb.rot * Math.PI) / 2;
  // sparkle ring for high levels
  if (!ghost && pb.level >= 10) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(def.size[0], def.size[1]) * 0.6, 0.03, 4, 24),
      getMaterial('#ffe27a', 'none', '#fff', 'glow'),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
  }
  return group;
}
