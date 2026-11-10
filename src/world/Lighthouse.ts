import * as THREE from 'three';
import { Builder } from '../build/Builder';
import { getMaterial } from '../build/materials';

/** Lighthouse center (cell coords) on the home island. */
export const LIGHTHOUSE_POS: [number, number] = [0, -13];

export class Lighthouse {
  group = new THREE.Group();
  private beam: THREE.Mesh;
  private halo: THREE.Sprite;
  private lamp: THREE.MeshLambertMaterial = new THREE.MeshLambertMaterial();
  level = 1;

  constructor(parent: THREE.Object3D) {
    const b = new Builder();
    b.cyl('stone', 1.9, 2.1, 0.5, 0, 0, 0, 12);
    for (let i = 0; i < 6; i++) {
      const r0 = 1.45 - i * 0.12;
      b.cyl(i % 2 ? 'red' : 'white', r0 - 0.12, r0, 1.05, 0, 0.5 + i * 1.05, 0, 12);
    }
    const top = 0.5 + 6 * 1.05;
    b.cyl('stone', 1.2, 1.1, 0.2, 0, top, 0, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.cyl('metal', 0.03, 0.03, 0.5, Math.cos(a) * 1.15, top + 0.2, Math.sin(a) * 1.15, 4);
    }
    b.torus('metal', 1.15, 0.03, 0, top + 0.7, 0, Math.PI / 2, 0);
    b.cyl('glass', 0.7, 0.7, 1.1, 0, top + 0.2, 0, 10);
    b.cone('red', 0.95, 0.9, 0, top + 1.3, 0, 10);
    b.sphere('metal', 0.12, 0, top + 2.25, 0, 1, 1, 1, 0);
    b.box('door', 0.7, 1.1, 0.1, 0, 0.5, 1.38);
    for (let i = 0; i < 3; i++) b.box('glass', 0.3, 0.4, 0.06, 0, 2 + i * 1.7, 1.25 - i * 0.12);
    // little keeper's porch
    b.box('wood', 1.6, 0.12, 1.0, 0, 0.5, 1.9);
    b.box('wood', 0.08, 0.5, 0.08, 0.75, 0.6, 2.35);
    b.box('wood', 0.08, 0.5, 0.08, -0.75, 0.6, 2.35);
    const geos = b.merge();
    const colors: Record<string, string> = { stone: '#c8c0b4', red: '#e2574c', white: '#fbf6ee', metal: '#3a3f58', glass: '#ffe9a0', door: '#5a6aa8', wood: '#a8754a' };
    for (const [slot, geo] of geos) {
      const mat = getMaterial(colors[slot], 'none', '#fff', slot === 'glass' ? 'glow' : 'normal');
      if (slot === 'glass') this.lamp = mat as THREE.MeshLambertMaterial;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.group.add(mesh);
    }
    // beam
    const bg = new THREE.ConeGeometry(2.4, 26, 16, 1, true);
    bg.translate(0, -13, 0);
    bg.rotateZ(Math.PI / 2);
    const bm = new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(bg, bm);
    this.beam.position.y = top + 0.75;
    this.group.add(this.beam);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,180,1)');
    gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.scale.set(6, 6, 1);
    this.halo.position.y = top + 0.75;
    this.group.add(this.halo);
    this.group.position.set(LIGHTHOUSE_POS[0], 0, LIGHTHOUSE_POS[1]);
    parent.add(this.group);
  }

  get topY(): number {
    return 0.5 + 6 * 1.05;
  }

  update(dt: number, night: number, lit: boolean, time: number): void {
    const target = lit ? 0.18 + night * 0.25 : 0;
    const bm = this.beam.material as THREE.MeshBasicMaterial;
    bm.opacity += (target * Math.min(1, 0.4 + night) - bm.opacity) * Math.min(1, dt * 2);
    this.beam.visible = bm.opacity > 0.01;
    this.beam.rotation.y += dt * 0.6;
    const hm = this.halo.material as THREE.SpriteMaterial;
    hm.opacity = lit ? 0.5 + night * 0.5 + Math.sin(time * 3) * 0.05 : night * 0.15;
    this.halo.scale.setScalar(5 + this.level * 0.3 + (lit ? 2 : 0));
    this.lamp.emissiveIntensity = lit ? 1.2 + night : 0.3 + night * 0.3;
  }
}
