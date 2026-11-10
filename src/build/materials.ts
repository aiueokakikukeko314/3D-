import * as THREE from 'three';

export type PatternId = 'none' | 'stripe' | 'check' | 'dots' | 'brick' | 'wood' | 'star' | 'wave' | 'scale';

export const PATTERNS: { id: PatternId; name: string }[] = [
  { id: 'none', name: '無地' },
  { id: 'stripe', name: 'しま' },
  { id: 'check', name: 'チェック' },
  { id: 'dots', name: '水玉' },
  { id: 'brick', name: 'レンガ' },
  { id: 'wood', name: '木目' },
  { id: 'star', name: '星柄' },
  { id: 'wave', name: '波' },
  { id: 'scale', name: 'うろこ' },
];

const texCache = new Map<string, THREE.Texture>();
const matCache = new Map<string, THREE.Material>();

/** Materials that glow at night (windows, lanterns). Intensity driven by Sky. */
export const nightGlowMaterials = new Set<THREE.MeshLambertMaterial>();
let currentNightGlow = 0;

export function setNightGlow(v: number): void {
  if (Math.abs(v - currentNightGlow) < 0.01) return;
  currentNightGlow = v;
  for (const m of nightGlowMaterials) {
    const base = (m.userData.glowBase as number) ?? 0.15;
    m.emissiveIntensity = base + v * ((m.userData.glowNight as number) ?? 1);
  }
}

function patternTexture(p: PatternId, c1: string, c2: string): THREE.Texture {
  const key = `${p}|${c1}|${c2}`;
  const cached = texCache.get(key);
  if (cached) return cached;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = c1;
  g.fillRect(0, 0, S, S);
  g.fillStyle = c2;
  g.strokeStyle = c2;
  switch (p) {
    case 'stripe':
      for (let i = 0; i < S; i += 16) g.fillRect(i, 0, 8, S);
      break;
    case 'check':
      for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) if (((x + y) / 16) % 2 === 0) g.fillRect(x, y, 16, 16);
      break;
    case 'dots':
      for (let y = 8; y < S; y += 16)
        for (let x = (y / 16) % 2 ? 0 : 8; x < S + 8; x += 16) {
          g.beginPath();
          g.arc(x, y, 4, 0, Math.PI * 2);
          g.fill();
        }
      break;
    case 'brick':
      g.lineWidth = 2;
      for (let y = 0; y < S; y += 16) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
        const off = (y / 16) % 2 ? 0 : 16;
        for (let x = off; x < S; x += 32) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 16);
          g.stroke();
        }
      }
      break;
    case 'wood':
      g.lineWidth = 2;
      for (let y = 4; y < S; y += 10) {
        g.beginPath();
        for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 2);
        g.stroke();
      }
      break;
    case 'star':
      for (let y = 8; y < S; y += 32)
        for (let x = 8; x < S; x += 32) {
          drawStar(g, x, y, 6);
          drawStar(g, x + 16, y + 16, 4);
        }
      break;
    case 'wave':
      g.lineWidth = 3;
      for (let y = 8; y < S; y += 16) {
        g.beginPath();
        for (let x = 0; x <= S; x += 4) g.lineTo(x, y + Math.sin((x / S) * Math.PI * 4) * 4);
        g.stroke();
      }
      break;
    case 'scale':
      g.lineWidth = 2;
      for (let y = 0; y < S + 8; y += 8)
        for (let x = (y / 8) % 2 ? 0 : 8; x < S + 16; x += 16) {
          g.beginPath();
          g.arc(x, y, 8, 0, Math.PI);
          g.stroke();
        }
      break;
    default:
      break;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  texCache.set(key, tex);
  return tex;
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

export type MatKind = 'normal' | 'window' | 'glow' | 'water' | 'ghost' | 'ghostBad';

export function getMaterial(color: string, pattern: PatternId = 'none', color2 = '#ffffff', kind: MatKind = 'normal'): THREE.Material {
  const key = `${kind}|${color}|${pattern}|${pattern === 'none' ? '' : color2}`;
  const cached = matCache.get(key);
  if (cached) return cached;
  let m: THREE.Material;
  if (kind === 'ghost' || kind === 'ghostBad') {
    m = new THREE.MeshBasicMaterial({
      color: kind === 'ghost' ? 0x8affc0 : 0xff6a6a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
  } else if (kind === 'water') {
    m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.78 });
  } else {
    const lm = new THREE.MeshLambertMaterial({ color: pattern === 'none' ? color : '#ffffff' });
    if (pattern !== 'none') lm.map = patternTexture(pattern, color, color2);
    if (kind === 'window' || kind === 'glow') {
      lm.emissive = new THREE.Color(color);
      lm.userData.glowBase = kind === 'glow' ? 0.35 : 0.05;
      lm.userData.glowNight = kind === 'glow' ? 0.9 : 0.85;
      lm.emissiveIntensity = lm.userData.glowBase + currentNightGlow * lm.userData.glowNight;
      nightGlowMaterials.add(lm);
    }
    m = lm;
  }
  matCache.set(key, m);
  return m;
}

/** Simple solid lambert material, cached. */
export function solid(color: string | number): THREE.MeshLambertMaterial {
  const c = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
  return getMaterial(c) as THREE.MeshLambertMaterial;
}

// ---------- color helpers ----------
export function hexToHsv(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  const r = c.r,
    g = c.g,
    b = c.b;
  // Color stores linear; convert back to sRGB
  const sr = linToSrgb(r),
    sg = linToSrgb(g),
    sb = linToSrgb(b);
  const max = Math.max(sr, sg, sb),
    min = Math.min(sr, sg, sb);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === sr) h = ((sg - sb) / d) % 6;
    else if (max === sg) h = (sb - sr) / d + 2;
    else h = (sr - sg) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function linToSrgb(x: number): number {
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

export function hsvToHex(h: number, s: number, v: number): string {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (((i % 6) + 6) % 6) {
    case 0:
      [r, g, b] = [v, t, p];
      break;
    case 1:
      [r, g, b] = [q, v, p];
      break;
    case 2:
      [r, g, b] = [p, v, t];
      break;
    case 3:
      [r, g, b] = [p, q, v];
      break;
    case 4:
      [r, g, b] = [t, p, v];
      break;
    default:
      [r, g, b] = [v, p, q];
  }
  const h2 = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${h2(r)}${h2(g)}${h2(b)}`;
}
