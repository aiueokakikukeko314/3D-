import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Collects primitive parts grouped by color slot, then merges them
 * into one geometry per slot (few draw calls per building).
 */
export class Builder {
  parts = new Map<string, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  /** global rotation/offset applied to subsequent parts */
  private stack: THREE.Matrix4[] = [];

  push(x = 0, y = 0, z = 0, ry = 0): this {
    const top = this.stack.length ? this.stack[this.stack.length - 1].clone() : new THREE.Matrix4();
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    this.stack.push(top.multiply(local));
    return this;
  }
  pop(): this {
    this.stack.pop();
    return this;
  }

  add(slot: string, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): this {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
    if (this.stack.length) this.m.premultiply(this.stack[this.stack.length - 1]);
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(this.m);
    if (!geo.getAttribute('uv')) {
      const n = geo.getAttribute('position').count;
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    // keep only position/normal/uv so all merge cleanly
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    let list = this.parts.get(slot);
    if (!list) this.parts.set(slot, (list = []));
    list.push(geo);
    return this;
  }

  // ---- primitives (y = bottom of the shape) ----
  box(slot: string, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0): this {
    return this.add(slot, G.box(w, h, d), x, y + h / 2, z, 0, ry);
  }
  cyl(slot: string, rt: number, rb: number, h: number, x = 0, y = 0, z = 0, seg = 8): this {
    return this.add(slot, G.cyl(rt, rb, h, seg), x, y + h / 2, z);
  }
  cone(slot: string, r: number, h: number, x = 0, y = 0, z = 0, seg = 8, ry = 0): this {
    return this.add(slot, G.cone(r, h, seg), x, y + h / 2, z, 0, ry);
  }
  sphere(slot: string, r: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 1): this {
    return this.add(slot, G.ico(r, detail), x, y, z, 0, 0, 0, sx, sy, sz);
  }
  /** Triangular prism roof along x axis. */
  gable(slot: string, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0): this {
    return this.add(slot, G.gable(w, h, d), x, y, z, 0, ry);
  }
  /** 4-sided pyramid roof */
  pyramid(slot: string, w: number, h: number, d: number, x = 0, y = 0, z = 0): this {
    return this.add(slot, G.cone(Math.SQRT1_2, 1, 4), x, y + h / 2, z, 0, Math.PI / 4, 0, w, h, d);
  }
  torus(slot: string, r: number, tube: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, arc = Math.PI * 2): this {
    return this.add(slot, G.torus(r, tube, arc), x, y, z, rx, ry);
  }
  plane(slot: string, w: number, d: number, x = 0, y = 0, z = 0): this {
    return this.add(slot, G.box(w, 0.04, d), x, y + 0.02, z);
  }

  /** Build final meshes. Returns map slot->geometry. */
  merge(): Map<string, THREE.BufferGeometry> {
    const out = new Map<string, THREE.BufferGeometry>();
    for (const [slot, list] of this.parts) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (g) {
        g.computeBoundingSphere();
        out.set(slot, g);
      }
      if (list.length > 1) for (const x of list) x.dispose();
    }
    this.parts.clear();
    return out;
  }
}

/** Shared base geometries (cached). */
const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

export const G = {
  box: (w: number, h: number, d: number) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, seg = 8) => cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 8) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  ico: (r: number, detail = 1) => cached(`i${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)),
  torus: (r: number, t: number, arc: number) => cached(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 6, 16, arc)),
  gable: (w: number, h: number, d: number) =>
    cached(`g${w},${h},${d}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-d / 2, 0);
      s.lineTo(d / 2, 0);
      s.lineTo(0, h);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
      geo.translate(0, 0, -w / 2);
      geo.rotateY(Math.PI / 2);
      return geo;
    }),
};
