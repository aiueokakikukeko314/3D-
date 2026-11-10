import { h } from '../ui/dom';
import type { UI } from '../ui/UI';
import { gs } from '../systems/State';
import type { Taste } from '../data/items';
import { audio } from '../core/Audio';

/** Common full-screen minigame overlay with a 2D canvas. */
export abstract class Minigame {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  top: HTMLElement;
  w = 0;
  h = 0;
  dpr = 1;
  private raf = 0;
  private last = 0;
  running = false;
  protected onDone: (() => void) | null = null;
  private resizeObs: () => void;

  constructor(
    protected ui: UI,
    title: string,
  ) {
    this.canvas = h('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.top = h('div', { class: 'mg-top' }, h('div', { class: 'pill' }, title), h('button', { class: 'close-btn', onclick: () => this.close() }, '✕'));
    this.el = h('div', { class: 'mg' }, this.canvas, this.top);
    this.resizeObs = () => this.resize();
  }

  open(onDone?: () => void): void {
    this.onDone = onDone ?? null;
    this.ui.root.append(this.el);
    this.ui.overlayStack.push(this.back);
    window.addEventListener('resize', this.resizeObs);
    this.resize();
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.start();
  }

  private back = (): boolean => {
    if (!this.el.isConnected) return false;
    this.close();
    return true;
  };

  protected resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  close(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resizeObs);
    this.el.remove();
    this.ui.overlayStack = this.ui.overlayStack.filter((f) => f !== this.back);
    gs.markDirty();
    this.onDone?.();
  }

  /** show a result panel */
  result(title: string, icon: string, lines: string[], again?: { label: string; act: () => void }): void {
    const box = h('div', { class: 'box' }, h('div', { class: 'ic' }, icon), h('h2', null, title), ...lines.map((l) => h('p', { style: 'margin:4px 0;font-weight:700' }, l)));
    const btns = h('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px' });
    const ov = h('div', { class: 'mg-result' }, box);
    if (again)
      btns.append(
        h(
          'button',
          {
            class: 'chip primary',
            onclick: () => {
              ov.remove();
              again.act();
            },
          },
          again.label,
        ),
      );
    btns.append(h('button', { class: 'chip', onclick: () => this.close() }, 'もどる'));
    box.append(btns);
    this.el.append(ov);
  }

  protected petTrait(t: Taste, n: number): void {
    const p = gs.d.pets[0];
    if (p) p.traits[t] = (p.traits[t] ?? 0) + n;
  }

  protected sfx = audio.sfx.bind(audio);

  abstract start(): void;
  abstract update(dt: number): void;
  abstract draw(): void;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
