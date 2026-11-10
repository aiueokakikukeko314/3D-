import * as THREE from 'three';
import { clock, type Season, type Weather } from '../core/Clock';
import { setNightGlow } from '../build/materials';

interface SkyKey {
  h: number;
  top: string;
  bottom: string;
  sun: string;
  sunI: number;
  amb: string;
  ambI: number;
}

// keyframes over 24h
const KEYS: SkyKey[] = [
  { h: 0, top: '#0b1030', bottom: '#28305e', sun: '#9fb0ff', sunI: 0.5, amb: '#5a64a8', ambI: 0.95 },
  { h: 4.5, top: '#141a44', bottom: '#3a3a70', sun: '#9fb0ff', sunI: 0.45, amb: '#5a64a8', ambI: 0.95 },
  { h: 6, top: '#7aa4e8', bottom: '#ffc7a8', sun: '#ffd0a0', sunI: 0.9, amb: '#b0a8d8', ambI: 0.9 },
  { h: 8, top: '#6fb6ff', bottom: '#d8f0ff', sun: '#fff4e0', sunI: 1.4, amb: '#c8dcff', ambI: 1.0 },
  { h: 12, top: '#4aa8ff', bottom: '#cfeeff', sun: '#ffffff', sunI: 1.6, amb: '#d0e4ff', ambI: 1.05 },
  { h: 16, top: '#5aa8f0', bottom: '#e0f0ff', sun: '#fff0d0', sunI: 1.4, amb: '#d0dcf0', ambI: 1.0 },
  { h: 17.5, top: '#6a7ad8', bottom: '#ffb07a', sun: '#ffb070', sunI: 1.1, amb: '#d8a8a8', ambI: 0.9 },
  { h: 18.7, top: '#3a3a8a', bottom: '#ff8a6a', sun: '#ff8a5a', sunI: 0.7, amb: '#a07aa8', ambI: 0.8 },
  { h: 20, top: '#141a48', bottom: '#3a3a78', sun: '#9fb0ff', sunI: 0.5, amb: '#5a64a8', ambI: 0.95 },
  { h: 24, top: '#0b1030', bottom: '#28305e', sun: '#9fb0ff', sunI: 0.5, amb: '#5a64a8', ambI: 0.95 },
];

const SEASON_SKY_TINT: Record<Season, string> = {
  spring: '#ffd8ec',
  summer: '#a8e0ff',
  autumn: '#ffd8a8',
  winter: '#e8f0ff',
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

export class Sky {
  group = new THREE.Group();
  sun: THREE.DirectionalLight;
  amb: THREE.HemisphereLight;
  private dome: THREE.Mesh;
  private uniforms: { top: { value: THREE.Color }; bottom: { value: THREE.Color } };
  private stars: THREE.Points;
  private sunSprite: THREE.Sprite;
  private moonSprite: THREE.Sprite;
  private aurora: THREE.Mesh;
  nightFactor = 0;
  fogColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.uniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(vP.y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, t),1.0); }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // stars
    const sp: number[] = [];
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const y = Math.abs(u) * 0.9 + 0.05;
      const r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(th) * r * 400, y * 400, Math.sin(th) * r * 400);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#fff6d8'), transparent: true, fog: false, depthWrite: false }));
    this.sunSprite.scale.set(60, 60, 1);
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(), transparent: true, fog: false, depthWrite: false }));
    this.moonSprite.scale.set(30, 30, 1);
    this.group.add(this.sunSprite, this.moonSprite);

    const am = new THREE.MeshBasicMaterial({ map: auroraTex(), transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.aurora = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 120, 32, 1, true, 0, Math.PI), am);
    this.aurora.position.y = 160;
    this.group.add(this.aurora);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sun.position.set(30, 50, 20);
    this.amb = new THREE.HemisphereLight(0xd0e4ff, 0x6a7a5a, 1.0);
    scene.add(this.group, this.sun, this.sun.target, this.amb);
  }

  update(dt: number, center: THREE.Vector3, weather: Weather, season: Season): void {
    const h = clock.hour();
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i],
      b = KEYS[i + 1];
    const t = (h - a.h) / Math.max(0.001, b.h - a.h);
    const tint = new THREE.Color(SEASON_SKY_TINT[season]);
    const dark = weather === 'rain' || weather === 'snow' || weather === 'cloudy';
    const top = this.uniforms.top.value.copy(tmpA.set(a.top)).lerp(tmpB.set(b.top), t).lerp(tint, 0.08);
    const bottom = this.uniforms.bottom.value.copy(tmpA.set(a.bottom)).lerp(tmpB.set(b.bottom), t).lerp(tint, 0.12);
    if (dark) {
      const grey = new THREE.Color(weather === 'snow' ? '#c8d0e0' : '#8a94a8');
      top.lerp(grey, 0.45);
      bottom.lerp(grey, 0.4);
    }
    this.fogColor.copy(bottom);
    this.sun.color.copy(tmpA.set(a.sun)).lerp(tmpB.set(b.sun), t);
    this.sun.intensity = (a.sunI + (b.sunI - a.sunI) * t) * (dark ? 0.6 : 1);
    this.amb.color.copy(tmpA.set(a.amb)).lerp(tmpB.set(b.amb), t);
    this.amb.intensity = (a.ambI + (b.ambI - a.ambI) * t) * (dark ? 1.1 : 1);
    this.amb.groundColor.set(season === 'winter' ? '#a8b0c0' : '#6a7a5a');

    // night factor 0..1
    const nf = h < 5 || h > 20 ? 1 : h < 6.5 ? 1 - (h - 5) / 1.5 : h > 18.3 ? (h - 18.3) / 1.7 : 0;
    this.nightFactor = Math.max(0, Math.min(1, nf));
    setNightGlow(this.nightFactor);
    (this.stars.material as THREE.PointsMaterial).opacity = this.nightFactor * (dark ? 0.25 : 1);

    // sun & moon arcs
    const sunAng = ((h - 6) / 12) * Math.PI; // 6am rise .. 18 set
    const sunDir = new THREE.Vector3(Math.cos(sunAng) * 0.8, Math.sin(sunAng), 0.45).normalize();
    this.sunSprite.position.copy(sunDir).multiplyScalar(380);
    this.sunSprite.visible = sunDir.y > -0.1 && !dark;
    const moonAng = ((h - 18) / 12) * Math.PI;
    const moonDir = new THREE.Vector3(-Math.cos(moonAng) * 0.8, Math.sin(((h + 6) % 24 - 6) / 12 * Math.PI) * 0.8 + 0.1, -0.4).normalize();
    const mh = h >= 18 ? h - 18 : h + 6;
    moonDir.set(Math.cos((mh / 12) * Math.PI) * 0.8, Math.max(0.15, Math.sin((mh / 12) * Math.PI)), -0.4).normalize();
    this.moonSprite.position.copy(moonDir).multiplyScalar(380);
    this.moonSprite.visible = this.nightFactor > 0.05;
    (this.moonSprite.material as THREE.SpriteMaterial).opacity = this.nightFactor;
    // light direction (sun by day, moon by night)
    const ld = this.nightFactor > 0.5 ? moonDir : sunDir.y > 0.15 ? sunDir : new THREE.Vector3(0.4, 0.8, 0.3).normalize();
    this.sun.position.copy(center).addScaledVector(ld, 40);
    this.sun.target.position.copy(center);

    // aurora in winter nights
    const am = this.aurora.material as THREE.MeshBasicMaterial;
    const want = season === 'winter' && this.nightFactor > 0.5 ? (weather === 'starry' ? 0.9 : 0.45) : weather === 'starry' ? 0.3 * this.nightFactor : 0;
    am.opacity += (want - am.opacity) * Math.min(1, dt);
    this.aurora.visible = am.opacity > 0.01;
    this.aurora.rotation.y += dt * 0.01;

    this.group.position.copy(center);
    this.stars.rotation.y += dt * 0.002;
  }
}

function glowTex(c: string): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, c);
  gr.addColorStop(0.25, c);
  gr.addColorStop(0.4, 'rgba(255,240,200,0.4)');
  gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function moonTex(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 10, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,250,220,0.5)');
  gr.addColorStop(1, 'rgba(255,250,220,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff8dc';
  g.beginPath();
  g.arc(32, 32, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(200,190,160,0.6)';
  g.beginPath();
  g.arc(28, 29, 3, 0, Math.PI * 2);
  g.arc(36, 36, 2, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function auroraTex(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d')!;
  for (let x = 0; x < 256; x += 2) {
    const h = 30 + Math.sin(x * 0.05) * 15 + Math.sin(x * 0.13) * 8;
    const gr = g.createLinearGradient(0, 64, 0, 64 - h);
    gr.addColorStop(0, 'rgba(80,255,180,0)');
    gr.addColorStop(0.3, 'rgba(80,255,180,0.7)');
    gr.addColorStop(1, 'rgba(160,100,255,0)');
    g.fillStyle = gr;
    g.fillRect(x, 64 - h, 2, h);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
