import * as THREE from 'three';
import type { Season, Weather } from '../core/Clock';

type Kind = 'petal' | 'firefly' | 'leaf' | 'snow' | 'rain' | 'stardust' | 'none';

function particleTex(kind: Kind): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d')!;
  if (kind === 'rain') {
    g.strokeStyle = 'rgba(200,220,255,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(16, 2);
    g.lineTo(16, 30);
    g.stroke();
  } else if (kind === 'petal' || kind === 'leaf') {
    g.fillStyle = kind === 'petal' ? '#ffc0d8' : '#ff8a3a';
    g.beginPath();
    g.ellipse(16, 16, 10, 6, 0.6, 0, Math.PI * 2);
    g.fill();
  } else {
    const c = kind === 'firefly' ? '200,255,120' : kind === 'stardust' ? '255,240,160' : '255,255,255';
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, `rgba(${c},1)`);
    gr.addColorStop(0.4, `rgba(${c},0.7)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Seasonal particles (petals, fireflies, leaves, snow) + rain. */
export class WeatherFx {
  private points: THREE.Points | null = null;
  private kind: Kind = 'none';
  private vel: Float32Array = new Float32Array(0);
  private density = 1;
  private texCache = new Map<Kind, THREE.Texture>();

  constructor(private scene: THREE.Scene) {}

  private pick(season: Season, weather: Weather, night: boolean): Kind {
    if (weather === 'rain') return 'rain';
    if (weather === 'snow') return 'snow';
    if (weather === 'starry' && night) return 'stardust';
    if (season === 'spring') return 'petal';
    if (season === 'summer') return night ? 'firefly' : 'none';
    if (season === 'autumn') return 'leaf';
    if (season === 'winter') return night ? 'stardust' : 'snow';
    return 'none';
  }

  setDensity(level: 0 | 1 | 2): void {
    const d = [0.25, 0.6, 1][level];
    if (d !== this.density) {
      this.density = d;
      this.rebuild(this.kind);
    }
  }

  private rebuild(kind: Kind): void {
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      (this.points.material as THREE.Material).dispose();
      this.points = null;
    }
    this.kind = kind;
    if (kind === 'none') return;
    const base = kind === 'rain' ? 900 : kind === 'snow' ? 700 : kind === 'firefly' ? 160 : kind === 'stardust' ? 260 : 300;
    const n = Math.max(20, Math.floor(base * this.density));
    const pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
      this.vel[i * 3 + 1] = kind === 'rain' ? -18 : kind === 'firefly' ? 0 : kind === 'stardust' ? -0.6 : -1.2 - Math.random();
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    let tex = this.texCache.get(kind);
    if (!tex) this.texCache.set(kind, (tex = particleTex(kind)));
    const size = kind === 'rain' ? 0.5 : kind === 'firefly' ? 0.45 : kind === 'snow' ? 0.3 : 0.35;
    const mat = new THREE.PointsMaterial({
      map: tex,
      size,
      transparent: true,
      depthWrite: false,
      blending: kind === 'firefly' || kind === 'stardust' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  update(dt: number, center: THREE.Vector3, season: Season, weather: Weather, night: boolean, enabled: boolean): void {
    const want = enabled ? this.pick(season, weather, night) : 'none';
    if (want !== this.kind) this.rebuild(want);
    if (!this.points) return;
    const p = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const t = performance.now() * 0.001;
    for (let i = 0; i < p.count; i++) {
      const ix = i * 3;
      if (this.kind === 'firefly') {
        a[ix] += Math.sin(t * 0.7 + i) * dt * 0.6;
        a[ix + 1] += Math.sin(t * 1.3 + i * 2) * dt * 0.4;
        a[ix + 2] += Math.cos(t * 0.6 + i) * dt * 0.6;
        if (a[ix + 1] < 0.3) a[ix + 1] = 0.3;
        if (a[ix + 1] > 4) a[ix + 1] = 4;
      } else {
        const sway = this.kind === 'petal' || this.kind === 'leaf' ? Math.sin(t * 2 + i) * 0.8 : 0;
        a[ix] += (this.vel[ix] + sway) * dt;
        a[ix + 1] += this.vel[ix + 1] * dt;
        a[ix + 2] += this.vel[ix + 2] * dt;
        if (a[ix + 1] < -2) {
          a[ix + 1] = 18 + Math.random() * 4;
          a[ix] = (Math.random() - 0.5) * 60;
          a[ix + 2] = (Math.random() - 0.5) * 60;
        }
      }
    }
    p.needsUpdate = true;
    if (this.kind === 'firefly') (this.points.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(t * 3) * 0.3;
    this.points.position.set(center.x, center.y, center.z);
  }
}
