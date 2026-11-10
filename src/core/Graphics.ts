import { storage } from './Platform';

export type ShadowMode = 'none' | 'blob' | 'real';
export type Preset = 'low' | 'mid' | 'high' | 'custom';

export interface GraphicsSettings {
  preset: Preset;
  shadows: ShadowMode;
  shadowRes: 512 | 1024 | 2048;
  resolution: number; // 0.5..1 of device pixel ratio (capped at 2)
  fps: 30 | 60;
  antialias: boolean;
  drawDistance: number; // 40..200
  particles: 0 | 1 | 2;
  cloudAnim: boolean;
  maxActors: number; // max animated characters updated per frame
  showFps: boolean;
  bgm: number; // 0..1
  sfx: number; // 0..1
  autoDetected: boolean;
}

export const PRESETS: Record<Exclude<Preset, 'custom'>, Partial<GraphicsSettings>> = {
  low: { shadows: 'blob', shadowRes: 512, resolution: 0.6, fps: 30, antialias: false, drawDistance: 60, particles: 0, cloudAnim: false, maxActors: 12 },
  mid: { shadows: 'blob', shadowRes: 1024, resolution: 0.8, fps: 60, antialias: false, drawDistance: 100, particles: 1, cloudAnim: true, maxActors: 24 },
  high: { shadows: 'real', shadowRes: 2048, resolution: 1, fps: 60, antialias: true, drawDistance: 180, particles: 2, cloudAnim: true, maxActors: 60 },
};

export const PRESET_LABEL: Record<Preset, string> = { low: '省電力', mid: '標準', high: '高画質', custom: 'カスタム' };

const KEY = 'kumoumi.graphics.v1';

export function defaultSettings(): GraphicsSettings {
  return {
    preset: 'mid',
    shadows: 'blob',
    shadowRes: 1024,
    resolution: 0.8,
    fps: 60,
    antialias: false,
    drawDistance: 100,
    particles: 1,
    cloudAnim: true,
    maxActors: 24,
    showFps: false,
    bgm: 0.5,
    sfx: 0.7,
    autoDetected: false,
  };
}

export const gfx: GraphicsSettings = defaultSettings();

export async function loadGraphics(): Promise<boolean> {
  const raw = await storage.get(KEY);
  if (!raw) return false;
  try {
    Object.assign(gfx, JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

export function saveGraphics(): void {
  void storage.set(KEY, JSON.stringify(gfx));
}

export function applyPreset(p: Exclude<Preset, 'custom'>): void {
  Object.assign(gfx, PRESETS[p]);
  gfx.preset = p;
}

/** Initial guess before measuring FPS. */
export function guessPreset(gl: WebGLRenderingContext | WebGL2RenderingContext | null): Exclude<Preset, 'custom'> {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  let renderer = '';
  try {
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    }
  } catch {
    /* ignore */
  }
  const weakGpu = /Mali-(4|T)|Adreno \(TM\) [3-5]\d\d|PowerVR|SwiftShader|llvmpipe/i.test(renderer);
  if (weakGpu || mem <= 2 || cores <= 4) return 'low';
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile) return mem >= 8 && /Adreno \(TM\) (7|8)\d\d|Mali-G7\d|Immortalis/i.test(renderer) ? 'high' : 'mid';
  return 'high';
}
