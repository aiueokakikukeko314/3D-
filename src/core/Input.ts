/**
 * Unified input: keyboard, virtual joystick (touch/mouse), camera drag & pinch.
 */
export class Input {
  moveX = 0; // -1..1 (right)
  moveY = 0; // -1..1 (forward)
  camYawDelta = 0;
  camPitchDelta = 0;
  zoomDelta = 0;
  panDX = 0;
  panDY = 0;
  private keys = new Set<string>();
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyBase: HTMLDivElement;
  private joyKnob: HTMLDivElement;
  private camPointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  enabled = true;
  /** tap on world (for build mode); returns screen coords */
  onTap: ((x: number, y: number) => void) | null = null;
  private tapStart: { id: number; x: number; y: number; t: number } | null = null;
  onKey: ((key: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.joyBase = document.createElement('div');
    this.joyBase.className = 'joy-base';
    this.joyKnob = document.createElement('div');
    this.joyKnob.className = 'joy-knob';
    this.joyBase.appendChild(this.joyKnob);
    const zone = document.createElement('div');
    zone.className = 'joy-zone';
    zone.appendChild(this.joyBase);
    overlay.appendChild(zone);

    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.joyId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      const r = this.joyBase.getBoundingClientRect();
      this.joyOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.updateJoy(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyId) this.updateJoy(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.moveX = 0;
      this.moveY = 0;
      this.joyKnob.style.transform = 'translate(-50%,-50%)';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    // camera drag / pinch on canvas
    canvas.addEventListener('pointerdown', (e) => {
      this.camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (this.camPointers.size === 1) this.tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      else this.tapStart = null;
      if (this.camPointers.size === 2) this.pinchDist = this.pointerDist();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.camPointers.get(e.pointerId);
      if (!p) return;
      if (this.camPointers.size === 1) {
        this.camYawDelta += (e.clientX - p.x) * 0.006;
        this.camPitchDelta += (e.clientY - p.y) * 0.004;
        this.panDX += e.clientX - p.x;
        this.panDY += e.clientY - p.y;
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.camPointers.size === 2) {
        const d = this.pointerDist();
        if (this.pinchDist > 0) this.zoomDelta += (this.pinchDist - d) * 0.03;
        this.pinchDist = d;
      }
    });
    const camEnd = (e: PointerEvent) => {
      if (this.tapStart && this.tapStart.id === e.pointerId) {
        const dx = e.clientX - this.tapStart.x,
          dy = e.clientY - this.tapStart.y;
        if (Math.hypot(dx, dy) < 10 && performance.now() - this.tapStart.t < 400) this.onTap?.(e.clientX, e.clientY);
      }
      this.tapStart = null;
      this.camPointers.delete(e.pointerId);
      if (this.camPointers.size < 2) this.pinchDist = 0;
    };
    canvas.addEventListener('pointerup', camEnd);
    canvas.addEventListener('pointercancel', camEnd);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomDelta += e.deltaY * 0.01;
      },
      { passive: false },
    );

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.add(e.key.toLowerCase());
      this.onKey?.(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private pointerDist(): number {
    const ps = [...this.camPointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
  }

  private updateJoy(x: number, y: number): void {
    const max = 46;
    let dx = x - this.joyOrigin.x,
      dy = y - this.joyOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.moveX = dx / max;
    this.moveY = -dy / max;
  }

  /** returns combined movement (keyboard + joystick) */
  getMove(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = this.moveX,
      y = this.moveY;
    if (this.keys.has('w') || this.keys.has('arrowup')) y += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y -= 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('q')) this.camYawDelta -= 0.03;
    if (this.keys.has('r')) this.camYawDelta += 0.03;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  consumeCam(): { yaw: number; pitch: number; zoom: number; px: number; py: number } {
    const r = { yaw: this.camYawDelta, pitch: this.camPitchDelta, zoom: this.zoomDelta, px: this.panDX, py: this.panDY };
    this.panDX = 0;
    this.panDY = 0;
    this.camYawDelta = 0;
    this.camPitchDelta = 0;
    this.zoomDelta = 0;
    return r;
  }

  isDown(key: string): boolean {
    return this.keys.has(key);
  }

  reset(): void {
    this.keys.clear();
    this.moveX = this.moveY = 0;
    this.joyId = null;
    this.joyKnob.style.transform = 'translate(-50%,-50%)';
  }
}
