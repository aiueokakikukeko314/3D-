import * as THREE from 'three';
import { createAnimal, createPet, createPlayer, petForm } from './CharacterFactory';
import { getResident } from '../data/residents';
import { getSpirit } from '../data/spirits';
import { gfx } from '../core/Graphics';
import { clock } from '../core/Clock';
import { levelFromXp } from '../core/levels';
import { gs, type PetState } from '../systems/State';
import { friendLevel } from '../systems/Life';
import type { World } from '../world/World';
import { getBuildingDef, centerOf } from '../build/Placeable';
import { getMaterial } from '../build/materials';
import { activeFestival } from '../data/festivals';

const blobTex = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,30,0.45)');
    gr.addColorStop(1, 'rgba(0,0,30,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(cv);
    return t;
  };
})();
let blobMat: THREE.MeshBasicMaterial | null = null;
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export function makeBlob(size: number): THREE.Mesh {
  blobMat ??= new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
  const m = new THREE.Mesh(blobGeo, blobMat);
  m.scale.setScalar(size);
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

export function makeTextSprite(text: string, color = '#ffffff', bg = 'rgba(40,40,80,0.75)'): THREE.Sprite {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d')!;
  g.font = 'bold 40px sans-serif';
  const w = Math.ceil(g.measureText(text).width) + 40;
  cv.width = w;
  cv.height = 64;
  g.font = 'bold 40px sans-serif';
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(0, 0, w, 64, 28);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set((w / 64) * 0.4, 0.4, 1);
  s.renderOrder = 10;
  return s;
}

export class Player {
  obj: THREE.Group;
  pos = new THREE.Vector3();
  facing = 0;
  private inner: THREE.Group;
  private blob: THREE.Mesh;
  speed = 4.2;
  moving = false;
  private t = 0;

  constructor(private scene: THREE.Scene) {
    this.obj = createPlayer(gs.d.player, gfx.shadows === 'real');
    this.inner = this.obj.userData.inner;
    this.blob = makeBlob(0.9);
    scene.add(this.obj, this.blob);
    this.pos.set(gs.d.player.x, 0, gs.d.player.z);
  }

  rebuild(): void {
    this.scene.remove(this.obj);
    this.obj = createPlayer(gs.d.player, gfx.shadows === 'real');
    this.inner = this.obj.userData.inner;
    this.scene.add(this.obj);
  }

  update(dt: number, move: { x: number; y: number }, camYaw: number, world: World): void {
    this.t += dt;
    const len = Math.hypot(move.x, move.y);
    this.moving = len > 0.05;
    if (this.moving) {
      // camera-relative direction
      const fx = -Math.sin(camYaw),
        fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw),
        rz = -Math.sin(camYaw);
      const dx = (fx * move.y + rx * move.x) * this.speed * dt;
      const dz = (fz * move.y + rz * move.x) * this.speed * dt;
      const tryMove = (nx: number, nz: number) => {
        // check feet ring
        const r = 0.28;
        for (const [ox, oz] of [
          [0, 0],
          [r, 0],
          [-r, 0],
          [0, r],
          [0, -r],
        ])
          if (!world.walkable(nx + ox, nz + oz)) return false;
        return true;
      };
      if (tryMove(this.pos.x + dx, this.pos.z + dz)) {
        this.pos.x += dx;
        this.pos.z += dz;
      } else if (tryMove(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
      else if (tryMove(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
      const target = Math.atan2(dx, dz);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 12);
    }
    this.pos.y = world.onBridge(this.pos.x, this.pos.z) && !world.islandAt(this.pos.x, this.pos.z, 0.3) ? world.bridgeHeight(this.pos.x, this.pos.z) : 0;
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.facing;
    const bob = this.moving ? Math.abs(Math.sin(this.t * 10)) * 0.08 : Math.sin(this.t * 2) * 0.01;
    this.inner.position.y = bob;
    this.inner.rotation.z = this.moving ? Math.sin(this.t * 10) * 0.05 : 0;
    this.blob.position.set(this.pos.x, this.pos.y + 0.02, this.pos.z);
    this.blob.visible = gfx.shadows !== 'none';
  }
}

export type ActorKind = 'resident' | 'visitor' | 'pet';

export class Actor {
  obj: THREE.Group;
  inner: THREE.Group;
  pos = new THREE.Vector3();
  target: THREE.Vector3 | null = null;
  wait = Math.random() * 3;
  facing = Math.random() * 6;
  speed = 1.4;
  blob: THREE.Mesh;
  emote: THREE.Sprite | null = null;
  emoteT = 0;
  umbrella: THREE.Group | null = null;
  homeX = 0;
  homeZ = 0;
  t = Math.random() * 10;
  hidden = false;
  floatBase = 0;

  constructor(
    public kind: ActorKind,
    public id: string,
    public name: string,
    obj: THREE.Group,
  ) {
    this.obj = obj;
    this.inner = obj.userData.inner;
    this.blob = makeBlob(0.8);
    this.floatBase = this.inner.position.y;
  }

  showEmote(text: string, seconds = 2): void {
    if (this.emote) this.obj.remove(this.emote);
    this.emote = makeTextSprite(text, '#ffffff', 'rgba(255,120,160,0.85)');
    this.emote.position.y = 1.7;
    this.obj.add(this.emote);
    this.emoteT = seconds;
  }
}

export class ActorManager {
  actors: Actor[] = [];
  group = new THREE.Group();
  private signature = '';

  constructor(
    scene: THREE.Scene,
    private world: World,
  ) {
    scene.add(this.group);
  }

  /** Sync actors with state (residents/visitors/pets). */
  sync(force = false): void {
    const sig = JSON.stringify([
      gs.d.residents.map((r) => r.id + ':' + r.home),
      gs.d.visitors.filter((v) => !v.done).map((v) => v.id),
      gs.d.pets.map((p) => `${p.id}:${petForm(levelFromXp(p.xp, 0.6).level, p.traits)}:${p.body}:${p.accent}:${p.pattern}:${Math.floor(levelFromXp(p.xp, 0.6).level / 10)}`),
      gfx.shadows,
    ]);
    if (sig === this.signature && !force) return;
    this.signature = sig;
    const oldPos = new Map(this.actors.map((a) => [a.kind + a.id, a.pos.clone()]));
    for (const a of this.actors) this.group.remove(a.obj, a.blob);
    this.actors = [];
    const sh = gfx.shadows === 'real';
    for (const r of gs.d.residents) {
      const def = getResident(r.id);
      const obj = createAnimal({ species: def.species, body: def.color, cloth: friendshipCloth(friendLevel(r.xp).level) }, sh);
      const a = new Actor('resident', r.id, def.name, obj);
      const home = r.home !== undefined ? gs.building(r.home) : undefined;
      if (home) {
        const hd = getBuildingDef(home.type);
        const [cx, cz] = centerOf(hd, home.x, home.z, home.rot);
        a.homeX = cx;
        a.homeZ = cz + (home.rot === 0 ? hd.size[1] / 2 + 0.8 : 0);
      } else {
        a.homeX = (Math.random() - 0.5) * 8;
        a.homeZ = (Math.random() - 0.5) * 8;
      }
      this.place(a, oldPos.get('resident' + r.id));
    }
    for (const v of gs.d.visitors) {
      if (v.done) continue;
      let a: Actor;
      if (v.kind === 'spirit') {
        const sp = getSpirit(v.id);
        if (!sp) continue;
        const obj = createAnimal({ species: sp.species, body: sp.color, accent: '#ffffff', glow: true, cloth: '#ffffff' }, sh);
        a = new Actor('visitor', v.id, sp.name, obj);
      } else {
        const def = getResident(v.id);
        const obj = createAnimal({ species: def.species, body: def.color, cloth: '#ffe27a' }, sh);
        a = new Actor('visitor', v.id, def.name, obj);
        // backpack for travelers
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.18), getMaterial('#c9965c'));
        pack.position.set(0, 0.5, -0.3);
        a.inner.add(pack);
      }
      a.homeX = 2 + Math.random() * 3;
      a.homeZ = -8 + Math.random() * 3;
      this.place(a, oldPos.get('visitor' + v.id));
    }
    gs.d.pets.forEach((p, i) => {
      const obj = makePetObj(p, sh);
      const a = new Actor('pet', String(p.id), p.name, obj);
      a.speed = 3.5;
      a.homeX = -3 + i;
      a.homeZ = 2;
      this.place(a, oldPos.get('pet' + p.id));
    });
  }

  private place(a: Actor, old?: THREE.Vector3): void {
    if (old) a.pos.copy(old);
    else {
      a.pos.set(a.homeX + (Math.random() - 0.5) * 2, 0, a.homeZ + (Math.random() - 0.5) * 2);
      if (!this.world.walkable(a.pos.x, a.pos.z)) a.pos.set(a.homeX, 0, a.homeZ);
      if (!this.world.walkable(a.pos.x, a.pos.z)) a.pos.set(0, 0, 4);
    }
    a.obj.position.copy(a.pos);
    this.group.add(a.obj, a.blob);
    this.actors.push(a);
  }

  festivalSpot: THREE.Vector3 | null = null;

  private updateFestivalSpot(): void {
    if (!activeFestival()) {
      this.festivalSpot = null;
      return;
    }
    const spot = gs.d.buildings.find((b) => ['plaza', 'fountain', 'stage', 'gazebo', 'clock_tower'].includes(b.type));
    if (spot) {
      const d = getBuildingDef(spot.type);
      const [cx, cz] = centerOf(d, spot.x, spot.z, spot.rot);
      this.festivalSpot = new THREE.Vector3(cx, 0, cz);
    } else this.festivalSpot = new THREE.Vector3(1, 0, 0);
  }

  update(dt: number, player: Player, cam: THREE.Vector3): void {
    if (Math.random() < 0.01) this.updateFestivalSpot();
    const h = clock.hour();
    const night = h >= 22 || h < 6;
    const rain = clock.weather() === 'rain';
    // LOD: update only the closest N actors fully
    const sorted = [...this.actors].sort((a, b) => a.pos.distanceToSquared(cam) - b.pos.distanceToSquared(cam));
    const pets = this.actors.filter((a) => a.kind === 'pet');
    sorted.forEach((a, idx) => {
      const full = idx < gfx.maxActors;
      const far = a.pos.distanceTo(cam) > gfx.drawDistance;
      a.obj.visible = !far && !a.hidden;
      a.blob.visible = a.obj.visible && gfx.shadows !== 'none';
      if (!full && far) return;
      this.think(a, dt, player, night, pets.indexOf(a));
      this.animate(a, full ? dt : dt * 0.5, rain);
    });
  }

  private think(a: Actor, dt: number, player: Player, night: boolean, petIdx: number): void {
    a.t += dt;
    if (a.kind === 'pet' && petIdx >= 0 && petIdx < 3) {
      // follow player in a little line
      const behind = new THREE.Vector3(Math.sin(player.facing + Math.PI + (petIdx - 1) * 0.6), 0, Math.cos(player.facing + Math.PI + (petIdx - 1) * 0.6)).multiplyScalar(1.3 + petIdx * 0.5);
      const goal = player.pos.clone().add(behind);
      const d = goal.distanceTo(a.pos);
      if (d > 0.4) a.target = goal;
      else a.target = null;
      if (d > 14) a.pos.copy(goal);
      a.speed = d > 3 ? 5.5 : 3.2;
    } else if (a.kind === 'resident' && this.festivalSpot && !night && (a.t % 40 < 30)) {
      // festival: gather around the plaza
      if (!a.target) {
        a.wait -= dt;
        if (a.wait <= 0) {
          const ang = Math.random() * Math.PI * 2;
          a.target = new THREE.Vector3(this.festivalSpot.x + Math.cos(ang) * 2.5, 0, this.festivalSpot.z + Math.sin(ang) * 2.5);
          a.wait = 3 + Math.random() * 4;
        }
      }
      a.hidden = false;
    } else if (a.kind === 'resident' && night) {
      // go home and rest (hidden inside)
      a.target = new THREE.Vector3(a.homeX, 0, a.homeZ);
      if (a.pos.distanceTo(a.target) < 0.6) {
        a.hidden = true;
        a.target = null;
      }
    } else {
      a.hidden = false;
      if (!a.target) {
        a.wait -= dt;
        if (a.wait <= 0) {
          const r = a.kind === 'visitor' ? 3 : 6;
          a.target = new THREE.Vector3(a.homeX + (Math.random() - 0.5) * r * 2, 0, a.homeZ + (Math.random() - 0.5) * r * 2);
          a.wait = 2 + Math.random() * 5;
        }
      }
    }
    if (a.target) {
      const dx = a.target.x - a.pos.x,
        dz = a.target.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) a.target = null;
      else {
        const step = Math.min(d, a.speed * dt);
        const nx = a.pos.x + (dx / d) * step,
          nz = a.pos.z + (dz / d) * step;
        if (this.world.walkable(nx, nz) || a.kind === 'pet') {
          a.pos.x = nx;
          a.pos.z = nz;
        } else a.target = null;
        const tf = Math.atan2(dx, dz);
        let diff = tf - a.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        a.facing += diff * Math.min(1, dt * 8);
      }
    }
    // face the player when close and idle
    if (!a.target && a.kind !== 'pet' && a.pos.distanceTo(player.pos) < 2.5) {
      const tf = Math.atan2(player.pos.x - a.pos.x, player.pos.z - a.pos.z);
      let diff = tf - a.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.facing += diff * Math.min(1, dt * 5);
    }
  }

  private animate(a: Actor, dt: number, rain: boolean): void {
    a.pos.y = this.world.onBridge(a.pos.x, a.pos.z) && !this.world.islandAt(a.pos.x, a.pos.z, 0.3) ? this.world.bridgeHeight(a.pos.x, a.pos.z) : 0;
    a.obj.position.copy(a.pos);
    a.obj.rotation.y = a.facing;
    const moving = !!a.target;
    a.inner.position.y = a.floatBase + (moving ? Math.abs(Math.sin(a.t * 9)) * 0.1 : Math.sin(a.t * 2) * 0.02) + (a.kind === 'visitor' ? Math.sin(a.t * 1.5) * 0.05 : 0);
    const sq = moving ? 1 : 1 + Math.sin(a.t * 2) * 0.02;
    a.inner.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    a.blob.position.set(a.pos.x, a.pos.y + 0.02, a.pos.z);
    if (a.emote) {
      a.emoteT -= dt;
      a.emote.position.y = 1.7 + (2 - a.emoteT) * 0.1;
      if (a.emoteT <= 0) {
        a.obj.remove(a.emote);
        a.emote = null;
      }
    }
    const wantUmbrella = rain && a.kind === 'resident';
    if (wantUmbrella && !a.umbrella) {
      a.umbrella = makeUmbrella(a.id);
      a.obj.add(a.umbrella);
    } else if (!wantUmbrella && a.umbrella) {
      a.obj.remove(a.umbrella);
      a.umbrella = null;
    }
  }

  nearest(pos: THREE.Vector3, maxD: number, skipPets = false): Actor | null {
    let best: Actor | null = null,
      bd = maxD;
    for (const a of this.actors) {
      if (a.hidden || (skipPets && a.kind === 'pet')) continue;
      const d = a.pos.distanceTo(pos);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  find(kind: ActorKind, id: string): Actor | undefined {
    return this.actors.find((a) => a.kind === kind && a.id === id);
  }
}

function makePetObj(p: PetState, shadows: boolean): THREE.Group {
  const lv = levelFromXp(p.xp, 0.6).level;
  return createPet(petForm(lv, p.traits), p.body, p.accent, p.pattern, lv, shadows);
}

function makeUmbrella(seed: string): THREE.Group {
  const colors = ['#ff7a9a', '#7ab8ff', '#ffd84a', '#8adc7a', '#c8a0ff'];
  const c = colors[seed.length % colors.length];
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.3, 8), getMaterial(c));
  top.position.y = 1.65;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), getMaterial('#5a4a3a'));
  stick.position.y = 1.2;
  g.add(top, stick);
  g.position.x = 0.2;
  return g;
}

export function friendshipCloth(level: number): string {
  const tiers = ['#ffffff', '#ffd6e0', '#ffe8a0', '#b8f0c0', '#b0d8ff', '#e0c0ff', '#ffb070', '#ff7aa8', '#7affd8', '#ffd700'];
  return tiers[Math.min(tiers.length - 1, Math.floor(level / 3))];
}
