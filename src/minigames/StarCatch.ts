import { Minigame, roundRect } from './Base';
import { CATCHES, getItem, type CatchDef } from '../data/items';
import { clock } from '../core/Clock';
import { gs } from '../systems/State';
import { haptic } from '../core/Platform';
import type { UI } from '../ui/UI';

interface Fall {
  x: number;
  y: number;
  vy: number;
  vx: number;
  def: CatchDef | null; // null = stardust
  r: number;
  wob: number;
  cloud?: boolean;
}

/** 星集め: move the net and catch falling stars/fireflies before time runs out. */
export class StarCatch extends Minigame {
  private netX = 0.5;
  private targetX = 0.5;
  private falls: Fall[] = [];
  private time = 45;
  private spawnT = 0;
  private got = new Map<string, number>();
  private combo = 0;
  private score = 0;
  private playing = false;
  private stun = 0;
  private bg: { x: number; y: number; s: number }[] = [];
  private keys = new Set<string>();
  private kd = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  private ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private sparkles: { x: number; y: number; t: number; text: string }[] = [];

  constructor(ui: UI) {
    super(ui, '🌠 星集め');
    const move = (e: PointerEvent) => (this.targetX = e.clientX / this.w);
    this.canvas.addEventListener('pointerdown', move);
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.buttons || e.pointerType === 'touch') move(e);
    });
    for (let i = 0; i < 120; i++) this.bg.push({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5 });
  }

  start(): void {
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    this.begin();
  }

  close(): void {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    super.close();
  }

  private begin(): void {
    this.falls = [];
    this.time = 45;
    this.got.clear();
    this.score = 0;
    this.combo = 0;
    this.playing = true;
  }

  private spawn(): void {
    const season = clock.season();
    const pool = CATCHES.filter((c) => c.seasons === 'all' || c.seasons.includes(season));
    const skill = gs.skillLevel('stars');
    const r = Math.random();
    let def: CatchDef | null = null;
    let cloud = false;
    if (r < 0.12) cloud = true;
    else if (r < 0.55) def = null;
    else {
      const wsum = pool.reduce((s, c) => s + 1 / Math.pow(c.rarity, 2.2 - Math.min(0.8, skill * 0.02)), 0);
      let x = Math.random() * wsum;
      for (const c of pool) {
        x -= 1 / Math.pow(c.rarity, 2.2 - Math.min(0.8, skill * 0.02));
        if (x <= 0) {
          def = c;
          break;
        }
      }
    }
    const rar = def?.rarity ?? 1;
    this.falls.push({
      x: Math.random() * 0.9 + 0.05,
      y: -0.05,
      vy: 0.18 + Math.random() * 0.12 + rar * 0.04 + (45 - this.time) * 0.002,
      vx: (Math.random() - 0.5) * 0.05 * rar,
      def,
      r: def ? 16 + rar * 2 : cloud ? 26 : 10,
      wob: Math.random() * 6,
      cloud,
    });
  }

  update(dt: number): void {
    for (const s of this.sparkles) s.t -= dt;
    this.sparkles = this.sparkles.filter((s) => s.t > 0);
    if (!this.playing) return;
    this.time -= dt;
    this.stun = Math.max(0, this.stun - dt);
    if (this.keys.has('arrowleft') || this.keys.has('a')) this.targetX -= dt * 1.2;
    if (this.keys.has('arrowright') || this.keys.has('d')) this.targetX += dt * 1.2;
    this.targetX = Math.max(0.05, Math.min(0.95, this.targetX));
    const sp = this.stun > 0 ? 2 : 10;
    this.netX += (this.targetX - this.netX) * Math.min(1, dt * sp);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = 0.35 + Math.random() * 0.4;
    }
    const netY = 0.86;
    for (const f of this.falls) {
      f.y += f.vy * dt;
      f.x += f.vx * dt + Math.sin((f.wob += dt * 3)) * 0.0015;
      const dx = (f.x - this.netX) * this.w;
      const dy = (f.y - netY) * this.h;
      if (Math.abs(dx) < 60 && Math.abs(dy) < 22) {
        f.y = 2; // remove
        if (f.cloud) {
          this.stun = 1.2;
          this.combo = 0;
          this.sfx('miss');
          this.sparkles.push({ x: f.x, y: netY, t: 0.8, text: 'もくもく…' });
          continue;
        }
        this.combo++;
        const id = f.def?.id ?? 'stardust';
        this.got.set(id, (this.got.get(id) ?? 0) + 1);
        this.score += (f.def?.rarity ?? 1) * (1 + Math.floor(this.combo / 5));
        this.sfx('star');
        void haptic('light');
        this.sparkles.push({ x: f.x, y: netY - 0.03, t: 0.7, text: (f.def?.icon ?? '✨') + (this.combo >= 5 ? ` ×${this.combo}` : '') });
      }
    }
    this.falls = this.falls.filter((f) => f.y < 1.1);
    if (this.time <= 0) this.finish();
  }

  private finish(): void {
    this.playing = false;
    const lines: string[] = [];
    let total = 0;
    for (const [id, n] of this.got) {
      gs.add(id, n, true);
      total += n;
      lines.push(`${getItem(id).icon} ${getItem(id).name} ×${n}`);
    }
    gs.addSkill('stars', 10 + this.score * 2);
    gs.stat('stars', total);
    this.petTrait('star', Math.min(10, total));
    this.sfx('success');
    this.result(total ? `${total} こ集めた！` : '今回は集められなかった…', '🌠', lines.length ? lines.slice(0, 6) : ['星の降る夜にまた来よう'], { label: 'もう一回', act: () => this.begin() });
  }

  draw(): void {
    const g = this.ctx,
      W = this.w,
      H = this.h;
    const season = clock.season();
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b1030');
    sky.addColorStop(1, season === 'winter' ? '#3a4a8a' : '#2a2f6a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const t = performance.now() / 1000;
    for (const s of this.bg) {
      g.fillStyle = `rgba(255,255,240,${0.4 + Math.sin(t * 2 + s.x * 30) * 0.3})`;
      g.fillRect(s.x * W, s.y * H * 0.8, s.s, s.s);
    }
    // hill
    g.fillStyle = '#2a3a4a';
    g.beginPath();
    g.ellipse(W / 2, H * 1.15, W * 0.8, H * 0.28, 0, 0, Math.PI * 2);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.falls) {
      const x = f.x * W,
        y = f.y * H;
      if (f.cloud) {
        g.fillStyle = 'rgba(120,120,150,0.85)';
        g.beginPath();
        g.arc(x - 14, y, 14, 0, Math.PI * 2);
        g.arc(x + 6, y - 6, 18, 0, Math.PI * 2);
        g.arc(x + 20, y + 2, 12, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      const glow = g.createRadialGradient(x, y, 0, x, y, f.r * 2);
      glow.addColorStop(0, 'rgba(255,240,180,0.6)');
      glow.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = glow;
      g.fillRect(x - f.r * 2, y - f.r * 2, f.r * 4, f.r * 4);
      g.font = `${f.r * 1.6}px sans-serif`;
      g.fillText(f.def?.icon ?? '✨', x, y);
      if ((f.def?.rarity ?? 0) >= 3) {
        g.strokeStyle = 'rgba(255,255,220,0.4)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - f.vx * 400, y - 50);
        g.stroke();
      }
    }
    // net
    const nx = this.netX * W,
      ny = 0.86 * H;
    g.strokeStyle = '#c9965c';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(nx, ny + 10);
    g.lineTo(nx + 10, H);
    g.stroke();
    g.fillStyle = this.stun > 0 ? 'rgba(160,160,180,0.6)' : 'rgba(255,255,255,0.35)';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(nx, ny, 60, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (const s of this.sparkles) {
      g.globalAlpha = Math.min(1, s.t * 2);
      g.fillStyle = '#fff6c8';
      g.font = 'bold 20px sans-serif';
      g.fillText(s.text, s.x * W, s.y * H - (0.7 - s.t) * 60);
      g.globalAlpha = 1;
    }
    // HUD
    roundRect(g, W / 2 - 90, 50, 180, 34, 17);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();
    g.fillStyle = '#3a3350';
    g.font = 'bold 16px sans-serif';
    g.fillText(`⏱ ${Math.max(0, Math.ceil(this.time))}  ✨ ${[...this.got.values()].reduce((a, b) => a + b, 0)}`, W / 2, 67);
    if (this.playing && this.time > 42) {
      g.fillStyle = '#ffffff';
      g.font = 'bold 16px sans-serif';
      g.fillText('左右にドラッグして網を動かそう。灰色の雲に注意！', W / 2, H * 0.4);
    }
  }
}
