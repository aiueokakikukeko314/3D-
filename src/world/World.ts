import * as THREE from 'three';
import { Builder, G } from '../build/Builder';
import { getMaterial } from '../build/materials';
import { createBuildingObject, getBuildingDef, cellsOf, centerOf, resolveColor } from '../build/Placeable';
import { clock, type Season } from '../core/Clock';
import { gfx } from '../core/Graphics';
import { Rng, hashString } from '../core/rng';
import { gs, type PlacedBuilding } from '../systems/State';
import { buildIslandMesh, edgeRadius, generateProps, makeIsland, type IslandInfo, type PropDef } from './Islands';
import { Lighthouse, LIGHTHOUSE_POS } from './Lighthouse';

export interface Collectible {
  key: string;
  item: string;
  x: number;
  z: number;
  mesh: THREE.Object3D;
}

interface BridgeInfo {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

type Occ = { kind: 'building'; uid: number } | { kind: 'prop'; id: string } | { kind: 'reserved' };

export class World {
  islands: IslandInfo[] = [];
  bridges: BridgeInfo[] = [];
  root = new THREE.Group();
  private islandGroups: THREE.Group[] = [];
  private buildingGroup = new THREE.Group();
  buildingObjs = new Map<number, THREE.Group>();
  private propMeshes: THREE.Group[] = [];
  occ = new Map<string, Occ>();
  props = new Map<string, PropDef>();
  collectibles: Collectible[] = [];
  private collectGroup = new THREE.Group();
  lighthouse!: Lighthouse;
  season: Season = 'spring';
  private grassMeshes: THREE.InstancedMesh[] = [];
  rising: { index: number; t: number } | null = null;

  constructor(private scene: THREE.Scene) {
    scene.add(this.root);
    this.root.add(this.buildingGroup, this.collectGroup);
  }

  init(): void {
    this.season = clock.season();
    const count = 1 + gs.d.islands;
    for (let i = 0; i < count; i++) this.addIslandData(i);
    for (const isl of this.islands) this.buildIslandVisual(isl);
    this.lighthouse = new Lighthouse(this.root);
    this.reserveLighthouse();
    for (const isl of this.islands) this.buildProps(isl);
    this.rebuildBridges();
    for (const b of gs.d.buildings) this.addBuildingObject(b);
    this.spawnCollectibles();
  }

  private addIslandData(i: number): IslandInfo {
    const isl = makeIsland(i, gs.d.seed, this.islands);
    this.islands.push(isl);
    return isl;
  }

  private reserveLighthouse(): void {
    const [lx, lz] = LIGHTHOUSE_POS;
    for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) this.occ.set(`${lx + i},${lz + j}`, { kind: 'reserved' });
  }

  private buildIslandVisual(isl: IslandInfo): void {
    const g = new THREE.Group();
    g.add(buildIslandMesh(isl, this.season));
    // grass tufts / flowers (instanced)
    const rng = new Rng(isl.seed + 5);
    const n = Math.floor(isl.radius * isl.radius * 0.5);
    const tuft = new THREE.ConeGeometry(0.07, 0.28, 3);
    tuft.translate(0, 0.14, 0);
    const grassColor = this.season === 'winter' ? '#e0ecf0' : this.season === 'autumn' ? '#c8b050' : '#5fae4a';
    const inst = new THREE.InstancedMesh(tuft, getMaterial(grassColor), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = rng.float() * Math.PI * 2;
      const r = Math.sqrt(rng.float()) * (edgeRadius(isl, a) - 0.8);
      const s = 0.6 + rng.float() * 0.9;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.float() * 6);
      m.compose(new THREE.Vector3(isl.cx + Math.cos(a) * r, 0, isl.cz + Math.sin(a) * r), q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m);
    }
    inst.receiveShadow = false;
    g.add(inst);
    this.grassMeshes.push(inst);
    // wild flowers
    if (this.season !== 'winter') {
      const nf = Math.floor(n * (isl.biome === 'flower' ? 0.6 : 0.15));
      const fg = new THREE.IcosahedronGeometry(0.07, 0);
      fg.translate(0, 0.12, 0);
      const colors = ['#ffffff', '#ffd84a', '#ff8fb8', '#a08aff', '#ff7a5a'];
      const fl = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial(), nf);
      const c = new THREE.Color();
      for (let i = 0; i < nf; i++) {
        const a = rng.float() * Math.PI * 2;
        const r = Math.sqrt(rng.float()) * (edgeRadius(isl, a) - 0.8);
        m.makeTranslation(isl.cx + Math.cos(a) * r, 0, isl.cz + Math.sin(a) * r);
        fl.setMatrixAt(i, m);
        fl.setColorAt(i, c.set(rng.pick(colors)));
      }
      g.add(fl);
    }
    this.root.add(g);
    this.islandGroups[isl.index] = g;
  }

  private buildProps(isl: IslandInfo): void {
    const removed = new Set(gs.d.removedProps);
    const props = generateProps(isl, removed, (cx, cz) => this.occ.has(`${cx},${cz}`));
    isl.props = props;
    for (const p of props) {
      if (p.x < -9000) continue;
      this.props.set(p.id, p);
      this.occ.set(`${p.cx},${p.cz}`, { kind: 'prop', id: p.id });
    }
    this.rebuildPropMesh(isl);
  }

  rebuildPropMesh(isl: IslandInfo): void {
    const old = this.propMeshes[isl.index];
    if (old) {
      this.root.remove(old);
      old.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    const b = new Builder();
    for (const p of isl.props) {
      if (!this.props.has(p.id)) continue;
      const lx = p.x,
        lz = p.z;
      const s = 0.85 + (hashString(p.id) % 100) / 250;
      switch (p.kind) {
        case 'tree':
          b.cyl('trunk', 0.12 * s, 0.18 * s, 1.1 * s, lx, 0, lz, 6);
          b.sphere('leaf', 0.75 * s, lx, 1.45 * s, lz, 1, 0.9, 1, 1);
          break;
        case 'fruit':
          b.cyl('trunk', 0.12 * s, 0.18 * s, 1.0 * s, lx, 0, lz, 6);
          b.sphere('leaf', 0.7 * s, lx, 1.35 * s, lz, 1, 0.9, 1, 1);
          for (let i = 0; i < 4; i++) b.sphere('fruit', 0.09, lx + Math.cos(i * 1.6) * 0.55 * s, 1.15 * s + (i % 2) * 0.3, lz + Math.sin(i * 1.6) * 0.55 * s, 1, 1, 1, 0);
          break;
        case 'pine':
          b.cyl('trunk', 0.1 * s, 0.14 * s, 0.6 * s, lx, 0, lz, 6);
          b.cone('pine', 0.8 * s, 1.0 * s, lx, 0.5 * s, lz, 7);
          b.cone('pine', 0.6 * s, 0.9 * s, lx, 1.1 * s, lz, 7);
          b.cone('pine', 0.4 * s, 0.7 * s, lx, 1.65 * s, lz, 7);
          break;
        case 'rock':
          b.sphere('rock', 0.5 * s, lx, 0.25, lz, 1, 0.7, 0.9, 0);
          b.sphere('rock', 0.28 * s, lx + 0.3, 0.12, lz + 0.2, 1, 0.8, 1, 0);
          break;
        case 'orerock':
          b.sphere('rock', 0.5 * s, lx, 0.25, lz, 1, 0.75, 0.9, 0);
          b.sphere('ore', 0.14, lx + 0.2, 0.55, lz + 0.15, 1, 1, 1, 0);
          b.sphere('ore', 0.1, lx - 0.25, 0.45, lz + 0.2, 1, 1, 1, 0);
          break;
        case 'bush':
          b.sphere('leaf', 0.45 * s, lx, 0.35, lz, 1.1, 0.8, 1, 1);
          break;
      }
    }
    const geos = b.merge();
    const g = new THREE.Group();
    const colors: Record<string, string> = {
      trunk: '#8a5a3a',
      leaf: resolveColor('season:leaf', this.season),
      pine: resolveColor('season:pine', this.season),
      rock: isl.biome === 'starry' ? '#8a8ac0' : '#a8a094',
      ore: '#6ad8ff',
      fruit: isl.biome === 'orchard' && isl.index % 2 ? '#d8e86b' : '#e8473f',
    };
    for (const [slot, geo] of geos) {
      const mesh = new THREE.Mesh(geo, getMaterial(colors[slot] ?? '#888', 'none', '#fff', slot === 'ore' ? 'glow' : 'normal'));
      mesh.castShadow = gfx.shadows === 'real';
      g.add(mesh);
    }
    this.root.add(g);
    this.propMeshes[isl.index] = g;
  }

  removeProp(id: string): void {
    const p = this.props.get(id);
    if (!p) return;
    this.props.delete(id);
    this.occ.delete(`${p.cx},${p.cz}`);
    if (!gs.d.removedProps.includes(id)) gs.d.removedProps.push(id);
    const isl = this.islands[Number(id.split(':')[0])];
    this.rebuildPropMesh(isl);
  }

  // ---------- bridges ----------
  private bridgeGroup = new THREE.Group();
  rebuildBridges(): void {
    this.root.remove(this.bridgeGroup);
    this.bridgeGroup.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.bridgeGroup = new THREE.Group();
    this.bridges = [];
    const b = new Builder();
    for (const isl of this.islands) {
      if (isl.bridgeTo < 0) continue;
      const other = this.islands[isl.bridgeTo];
      const ang = Math.atan2(isl.cz - other.cz, isl.cx - other.cx);
      const ra = edgeRadius(other, ang) - 0.6;
      const rb = edgeRadius(isl, ang + Math.PI) - 0.6;
      const ax = other.cx + Math.cos(ang) * ra,
        az = other.cz + Math.sin(ang) * ra;
      const bx = isl.cx - Math.cos(ang) * rb,
        bz = isl.cz - Math.sin(ang) * rb;
      this.bridges.push({ ax, az, bx, bz });
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.ceil(len / 0.45);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = ax + (bx - ax) * t,
          z = az + (bz - az) * t;
        const sag = -Math.sin(t * Math.PI) * 0.35;
        b.add('plank', G.box(1.8, 0.08, 0.38), x, sag + 0.02, z, 0, -ang + Math.PI / 2, 0);
        if (s % 4 === 0) {
          const px = Math.cos(ang + Math.PI / 2) * 0.95,
            pz = Math.sin(ang + Math.PI / 2) * 0.95;
          b.cyl('post', 0.05, 0.05, 0.7, x + px, sag, z + pz, 4);
          b.cyl('post', 0.05, 0.05, 0.7, x - px, sag, z - pz, 4);
          b.sphere('rainbow', 0.07, x + px, sag + 0.75, z + pz, 1, 1, 1, 0);
          b.sphere('rainbow', 0.07, x - px, sag + 0.75, z - pz, 1, 1, 1, 0);
        }
      }
    }
    const geos = b.merge();
    const colors: Record<string, string> = { plank: '#c9965c', post: '#8a5a3a', rainbow: '#ffd27a' };
    for (const [slot, geo] of geos) this.bridgeGroup.add(new THREE.Mesh(geo, getMaterial(colors[slot], 'none', '#fff', slot === 'rainbow' ? 'glow' : 'normal')));
    this.root.add(this.bridgeGroup);
  }

  // ---------- new islands ----------
  raiseIsland(): IslandInfo {
    const isl = this.addIslandData(this.islands.length);
    this.buildIslandVisual(isl);
    this.buildProps(isl);
    this.rebuildBridges();
    const g = this.islandGroups[isl.index];
    const pg = this.propMeshes[isl.index];
    g.position.y = -14;
    pg.position.y = -14;
    this.rising = { index: isl.index, t: 0 };
    return isl;
  }

  // ---------- buildings ----------
  addBuildingObject(pb: PlacedBuilding): void {
    const def = getBuildingDef(pb.type);
    const obj = createBuildingObject(pb, this.season, gfx.shadows === 'real');
    const [cx, cz] = centerOf(def, pb.x, pb.z, pb.rot);
    obj.position.set(cx, 0, cz);
    obj.userData.uid = pb.uid;
    this.buildingGroup.add(obj);
    this.buildingObjs.set(pb.uid, obj);
    for (const [i, j] of cellsOf(def, pb.x, pb.z, pb.rot)) this.occ.set(`${i},${j}`, { kind: 'building', uid: pb.uid });
    if (pb.crop) this.updateCropVisual(pb);
  }

  removeBuildingObject(uid: number): void {
    const obj = this.buildingObjs.get(uid);
    if (obj) {
      this.buildingGroup.remove(obj);
      this.buildingObjs.delete(uid);
    }
    for (const [k, v] of [...this.occ]) if (v.kind === 'building' && v.uid === uid) this.occ.delete(k);
  }

  refreshBuilding(pb: PlacedBuilding): void {
    this.removeBuildingObject(pb.uid);
    this.addBuildingObject(pb);
  }

  rebuildAllBuildings(): void {
    for (const uid of [...this.buildingObjs.keys()]) this.removeBuildingObject(uid);
    for (const b of gs.d.buildings) this.addBuildingObject(b);
  }

  updateCropVisual(pb: PlacedBuilding): void {
    const obj = this.buildingObjs.get(pb.uid);
    if (!obj) return;
    const old = obj.getObjectByName('crop');
    if (old) obj.remove(old);
    if (!pb.crop) return;
    const stage = pb.crop.stage ?? 0;
    const g = new THREE.Group();
    g.name = 'crop';
    const leaf = getMaterial(stage >= 3 ? '#4fae4a' : '#7fd06a');
    for (let i = 0; i < 3; i++) {
      const z = -0.3 + i * 0.3;
      const h = 0.1 + stage * 0.12;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.08 + stage * 0.03, h, 4), leaf);
      m.position.set(0, 0.18 + h / 2, z);
      g.add(m);
      if (stage >= 3) {
        const cropColors: Record<string, string> = { cloudberry: '#ff5a7a', skywheat: '#f2d27a', mooncarrot: '#ff9a3a', pumpkin: '#ff8a2a', teaherb: '#6fd06a' };
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(pb.crop.id === 'pumpkin' ? 0.16 : 0.08, 0), getMaterial(cropColors[pb.crop.id] ?? '#fff', 'none', '#fff', pb.crop.id === 'mooncarrot' ? 'glow' : 'normal'));
        f.position.set(0.12, 0.25 + h * 0.7, z);
        g.add(f);
      }
    }
    if (pb.crop.watered > Date.now() - 3 * 3600_000) {
      const wet = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.01, 0.94), getMaterial('#4a3220'));
      wet.position.y = 0.13;
      g.add(wet);
    }
    g.rotation.y = (pb.rot * Math.PI) / 2;
    obj.add(g);
  }

  // ---------- queries ----------
  islandAt(x: number, z: number, margin = 0.4): IslandInfo | null {
    for (const isl of this.islands) {
      const dx = x - isl.cx,
        dz = z - isl.cz;
      const d = Math.hypot(dx, dz);
      if (d > isl.radius * 1.25) continue;
      if (d < edgeRadius(isl, Math.atan2(dz, dx)) - margin) return isl;
    }
    return null;
  }

  onBridge(x: number, z: number): boolean {
    for (const br of this.bridges) {
      const vx = br.bx - br.ax,
        vz = br.bz - br.az;
      const len2 = vx * vx + vz * vz;
      const t = ((x - br.ax) * vx + (z - br.az) * vz) / len2;
      if (t < -0.05 || t > 1.05) continue;
      const px = br.ax + vx * t,
        pz = br.az + vz * t;
      if (Math.hypot(x - px, z - pz) < 0.8) return true;
    }
    return false;
  }

  bridgeHeight(x: number, z: number): number {
    for (const br of this.bridges) {
      const vx = br.bx - br.ax,
        vz = br.bz - br.az;
      const len2 = vx * vx + vz * vz;
      const t = ((x - br.ax) * vx + (z - br.az) * vz) / len2;
      if (t < 0 || t > 1) continue;
      const px = br.ax + vx * t,
        pz = br.az + vz * t;
      if (Math.hypot(x - px, z - pz) < 1.0) return -Math.sin(t * Math.PI) * 0.35 + 0.06;
    }
    return 0;
  }

  isBlocked(x: number, z: number): boolean {
    const o = this.occ.get(`${Math.floor(x)},${Math.floor(z)}`);
    if (!o) return false;
    if (o.kind === 'building') {
      const pb = gs.building(o.uid);
      return pb ? !getBuildingDef(pb.type).walkable : false;
    }
    return true;
  }

  walkable(x: number, z: number): boolean {
    if (this.onBridge(x, z)) return true;
    if (!this.islandAt(x, z, 0.5)) return false;
    return !this.isBlocked(x, z);
  }

  /** Can a building be placed with its top-left at (x,z)? */
  canPlace(defId: string, x: number, z: number, rot: number, ignoreUid = -1): boolean {
    const def = getBuildingDef(defId);
    for (const [i, j] of cellsOf(def, x, z, rot)) {
      const o = this.occ.get(`${i},${j}`);
      if (o && !(o.kind === 'building' && o.uid === ignoreUid)) return false;
      // all 4 corners on land
      for (const [cx, cz] of [
        [i + 0.1, j + 0.1],
        [i + 0.9, j + 0.1],
        [i + 0.1, j + 0.9],
        [i + 0.9, j + 0.9],
      ])
        if (!this.islandAt(cx, cz, 0.7)) return false;
    }
    return true;
  }

  nearIslandEdge(x: number, z: number): { isl: IslandInfo; angle: number } | null {
    const isl = this.islandAt(x, z, 0);
    if (!isl) return null;
    const ang = Math.atan2(z - isl.cz, x - isl.cx);
    const d = Math.hypot(x - isl.cx, z - isl.cz);
    if (edgeRadius(isl, ang) - d < 1.6) return { isl, angle: ang };
    return null;
  }

  // ---------- daily collectibles ----------
  spawnCollectibles(): void {
    for (const c of this.collectibles) this.collectGroup.remove(c.mesh);
    this.collectibles = [];
    const day = clock.dayKey();
    if (gs.d.collectDay !== day) {
      gs.d.collectDay = day;
      gs.d.collected = [];
    }
    const season = clock.season();
    const night = clock.isNight();
    for (const isl of this.islands) {
      const rng = new Rng(hashString(day + ':' + isl.index));
      const n = 3 + Math.floor(isl.radius / 4);
      for (let i = 0; i < n; i++) {
        const key = `${isl.index}:${i}`;
        const a = rng.float() * Math.PI * 2;
        const r = Math.sqrt(rng.float()) * (edgeRadius(isl, a) - 1.5);
        const x = isl.cx + Math.cos(a) * r,
          z = isl.cz + Math.sin(a) * r;
        const pool: string[] = ['t_leaf', 'cotton', 'petal'];
        if (isl.biome === 'beach') pool.push('t_shell', 't_shell', 't_bottle');
        if (isl.biome === 'rocky') pool.push('stone', 'skyore');
        if (isl.biome === 'forest') pool.push('wood', 'mushroom', 'mushroom');
        if (isl.biome === 'orchard') pool.push('apple', 'pear', 'honey');
        if (isl.biome === 'flower') pool.push('petal', 'honey', 'teaherb');
        if (isl.biome === 'starry' || night) pool.push('stardust', 'stardust');
        if (isl.biome === 'misty') pool.push('cotton', 'cotton', 'teaherb');
        if (season === 'autumn') pool.push('t_acorn', 't_acorn', 't_leaf', 'mushroom');
        if (season === 'winter') pool.push('t_snowball', 't_snowball');
        if (season === 'spring') pool.push('t_clover', 'petal', 'petal');
        if (season === 'summer') pool.push('t_shell', 't_feather');
        if (rng.chance(0.03)) pool.splice(0, pool.length, 't_lantern');
        const item = rng.pick(pool);
        if (gs.d.collected.includes(key) || this.isBlocked(x, z)) continue;
        const mesh = makeCollectibleMesh(item);
        mesh.position.set(x, 0.15, z);
        this.collectGroup.add(mesh);
        this.collectibles.push({ key, item, x, z, mesh });
      }
    }
  }

  pickCollectible(c: Collectible): void {
    this.collectGroup.remove(c.mesh);
    this.collectibles = this.collectibles.filter((x) => x !== c);
    gs.d.collected.push(c.key);
  }

  // ---------- per frame ----------
  update(dt: number, center: THREE.Vector3, nightFactor: number, time: number): void {
    this.lighthouse.update(dt, nightFactor, gs.d.fuelDay === clock.dayKey() && gs.d.fuelTonight > 0, time);
    for (const c of this.collectibles) {
      c.mesh.rotation.y += dt * 1.5;
      c.mesh.position.y = 0.2 + Math.sin(time * 2 + c.x) * 0.06;
    }
    if (this.rising) {
      this.rising.t += dt / 6;
      const t = Math.min(1, this.rising.t);
      const e = 1 - Math.pow(1 - t, 3);
      const y = -14 * (1 - e);
      this.islandGroups[this.rising.index].position.y = y;
      this.propMeshes[this.rising.index].position.y = y;
      if (t >= 1) this.rising = null;
    }
    // distance culling of island decorations and buildings
    const dd = gfx.drawDistance;
    for (const isl of this.islands) {
      const d = Math.hypot(isl.cx - center.x, isl.cz - center.z) - isl.radius;
      const vis = d < dd;
      if (this.propMeshes[isl.index]) this.propMeshes[isl.index].visible = vis;
      const g = this.islandGroups[isl.index];
      if (g) g.visible = d < dd * 1.6;
    }
    for (const [, obj] of this.buildingObjs) {
      const d = Math.hypot(obj.position.x - center.x, obj.position.z - center.z);
      obj.visible = d < dd;
    }
  }

  setSeason(season: Season): void {
    if (season === this.season) return;
    this.season = season;
    // rebuild island visuals with new tints
    for (const g of this.islandGroups) {
      this.root.remove(g);
      g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    this.islandGroups = [];
    this.grassMeshes = [];
    for (const isl of this.islands) {
      this.buildIslandVisual(isl);
      this.rebuildPropMesh(isl);
    }
    this.rebuildAllBuildings();
  }

  dispose(): void {
    this.scene.remove(this.root);
  }
}

const colMeshCache = new Map<string, THREE.Object3D>();
function makeCollectibleMesh(item: string): THREE.Object3D {
  let base = colMeshCache.get(item);
  if (!base) {
    const colorMap: Record<string, string> = {
      t_leaf: '#e8873a', cotton: '#ffffff', petal: '#ffb6d0', t_shell: '#ffe0d0', t_bottle: '#8fd8c8', stone: '#a8a094', skyore: '#6ad8ff',
      wood: '#a8754a', mushroom: '#e2493f', apple: '#e8473f', pear: '#d8e86b', honey: '#ffc531', teaherb: '#6fd06a', stardust: '#ffe27a',
      t_acorn: '#b07a3a', t_snowball: '#f4fbff', t_clover: '#4fd86a', t_feather: '#e8e8ff', t_lantern: '#ff9a4a',
    };
    const g = new THREE.Group();
    const glow = item === 'stardust' || item === 'skyore' || item === 't_lantern';
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), getMaterial(colorMap[item] ?? '#ffffff', 'none', '#fff', glow ? 'glow' : 'normal'));
    g.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.12;
    g.add(ring);
    base = g;
    colMeshCache.set(item, base);
  }
  return base.clone();
}
