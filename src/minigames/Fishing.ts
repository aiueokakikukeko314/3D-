import { Minigame, roundRect } from './Base';
import { FISH, getItem, type FishDef } from '../data/items';
import { clock } from '../core/Clock';
import { gs } from '../systems/State';
import { Rng } from '../core/rng';
import { haptic } from '../core/Platform';
import type { UI } from '../ui/UI';
import type { Biome } from '../world/Islands';

type Phase = 'aim' | 'wait' | 'bite' | 'reel' | 'done';

/** 雲釣り: cast → wait → hook on bite → keep tension in the green zone. */
export class Fishing extends Minigame {
  private phase: Phase = 'aim';
  private power = 0;
  private powerDir = 1;
  private castDist = 0.5;
  private waitT = 0;
  private biteT = 0;
  private tension = 0.3;
  private progress = 0;
  private holding = false;
  private fish: FishDef | null = null;
  private fishPull = 0;
  private pullT = 0;
  private t = 0;
  private message = '';
  private junk: string | null = null;
  private splash = 0;
  private caught = 0;

  constructor(
    ui: UI,
    private biome: Biome,
  ) {
    super(ui, '🎣 雲釣り');
    const down = (e: PointerEvent) => {
      e.preventDefault();
      this.press();
    };
    this.canvas.addEventListener('pointerdown', down);
    const up = () => (this.holding = false);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.keyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'e' || e.key === 'Enter') {
        if (!this.holding) this.press();
      }
    };
    this.keyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'e' || e.key === 'Enter') this.holding = false;
    };
  }
  private keyDown: (e: KeyboardEvent) => void;
  private keyUp: (e: KeyboardEvent) => void;

  start(): void {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    this.reset();
  }

  close(): void {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    super.close();
  }

  private reset(): void {
    this.phase = 'aim';
    this.message = 'タップで投げる（ゲージが高いほど遠くへ）';
    this.power = 0;
    this.progress = 0;
    this.tension = 0.3;
    this.fish = null;
    this.junk = null;
  }

  private press(): void {
    this.holding = true;
    if (this.phase === 'aim') {
      this.castDist = 0.2 + this.power * 0.8;
      this.phase = 'wait';
      this.waitT = 1.5 + Math.random() * 3.5;
      this.message = 'じっと待つ…';
      this.splash = 1;
      this.sfx('splash');
    } else if (this.phase === 'wait') {
      this.message = 'まだ早い！もう少し待って';
      this.waitT += 0.6;
    } else if (this.phase === 'bite') {
      this.hook();
    }
  }

  private pickFish(): void {
    const season = clock.season();
    const tod = clock.timeOfDay();
    const weather = clock.weather();
    const skill = gs.skillLevel('fishing');
    const rng = new Rng(Date.now());
    if (rng.chance(0.08)) {
      this.junk = rng.pick(['cotton', 'cotton', 't_bottle', 't_shell', 'stardust']);
      return;
    }
    const pool = FISH.filter((f) => (f.seasons === 'all' || f.seasons.includes(season)) && (f.times === 'all' || f.times.includes(tod)) && (!f.weathers || f.weathers.includes(weather)));
    this.fish = rng.weighted(pool, (f) => {
      let w = [0, 40, 22, 10, 4, 1.2][f.rarity];
      w *= 1 + (skill * 0.03 * f.rarity) / 2;
      if (this.castDist > 0.75 && f.rarity >= 3) w *= 1.8;
      if (this.biome === 'beach') w *= 1.2;
      return w;
    });
  }

  private hook(): void {
    this.pickFish();
    this.phase = 'reel';
    this.tension = 0.4;
    this.progress = 0.15;
    this.pullT = 0;
    this.message = '長押しで巻く！緑のゾーンをキープ';
    void haptic('medium');
    this.sfx('hit');
  }

  update(dt: number): void {
    this.t += dt;
    this.splash = Math.max(0, this.splash - dt * 1.5);
    switch (this.phase) {
      case 'aim':
        this.power += this.powerDir * dt * 1.2;
        if (this.power > 1) (this.power = 1), (this.powerDir = -1);
        if (this.power < 0) (this.power = 0), (this.powerDir = 1);
        break;
      case 'wait':
        this.waitT -= dt;
        if (this.waitT <= 0) {
          this.phase = 'bite';
          this.biteT = 0.9;
          this.message = 'いまだ！タップ！';
          void haptic('heavy');
          this.sfx('splash');
        }
        break;
      case 'bite':
        this.biteT -= dt;
        if (this.biteT <= 0) {
          this.phase = 'wait';
          this.waitT = 1.5 + Math.random() * 2.5;
          this.message = '逃げられた…もう一度待とう';
          this.sfx('miss');
        }
        break;
      case 'reel': {
        const rarity = this.fish?.rarity ?? 1;
        this.pullT -= dt;
        if (this.pullT <= 0) {
          this.fishPull = (Math.random() * 0.6 + 0.4) * (0.25 + rarity * 0.12);
          this.pullT = 0.5 + Math.random() * (1.4 - rarity * 0.15);
        }
        const pull = this.fishPull * (0.5 + 0.5 * Math.sin(this.t * (2 + rarity)));
        if (this.holding) this.tension += dt * (0.55 + rarity * 0.05);
        else this.tension -= dt * 0.6;
        this.tension += pull * dt * 0.9 * (this.holding ? 1 : -0.3);
        this.tension = Math.max(0, Math.min(1.05, this.tension));
        const zoneLo = 0.35,
          zoneHi = 0.75 - rarity * 0.035;
        if (this.tension >= zoneLo && this.tension <= zoneHi) this.progress += dt * (0.32 - rarity * 0.03);
        else this.progress -= dt * 0.12;
        if (this.holding && Math.random() < dt * 8) this.sfx('reel');
        if (this.tension >= 1.0) this.finish(false, '糸が切れちゃった…');
        else if (this.progress <= 0) this.finish(false, '逃げられた…');
        else if (this.progress >= 1) this.finish(true);
        break;
      }
    }
  }

  private finish(ok: boolean, why = ''): void {
    this.phase = 'done';
    this.holding = false;
    if (!ok) {
      this.sfx('fail');
      this.result(why, '💧', ['また挑戦してみよう'], { label: 'もう一回', act: () => this.reset() });
      return;
    }
    this.caught++;
    this.sfx('success');
    void haptic('heavy');
    const id = this.junk ?? this.fish!.id;
    const d = getItem(id);
    const first = !gs.d.dex[id];
    gs.add(id, 1, true);
    gs.addSkill('fishing', 10 + (this.fish?.rarity ?? 1) * 12);
    gs.stat('fish');
    this.petTrait('sea', 2);
    const size = this.fish ? (10 + this.fish.rarity * 12 + Math.random() * 20).toFixed(1) : '';
    this.result(`${d.name} をつりあげた！`, d.icon, [first ? '✨ 図鑑に新しく登録！' : '', this.fish ? `${size} cm ・ ${'★'.repeat(this.fish.rarity)}` : '', d.desc ?? ''].filter(Boolean), { label: 'もう一回', act: () => this.reset() });
  }

  draw(): void {
    const g = this.ctx,
      W = this.w,
      H = this.h;
    const night = clock.isNight();
    const sky = g.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, night ? '#141a48' : '#6fb6ff');
    sky.addColorStop(1, night ? '#3a3a78' : '#d8f0ff');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // cloud sea
    const seaY = H * 0.5;
    g.fillStyle = night ? '#4a5490' : '#ffffff';
    g.fillRect(0, seaY, W, H - seaY);
    for (let i = 0; i < 14; i++) {
      const x = ((i * 137 + this.t * 20) % (W + 200)) - 100;
      const y = seaY + 10 + ((i * 53) % (H - seaY));
      g.fillStyle = night ? 'rgba(120,130,200,0.5)' : 'rgba(200,220,245,0.7)';
      g.beginPath();
      g.ellipse(x, y, 60 + (i % 3) * 30, 14, 0, 0, Math.PI * 2);
      g.fill();
    }
    // island edge & keeper silhouette (left)
    g.fillStyle = '#7fbf5a';
    g.beginPath();
    g.moveTo(0, seaY - 40);
    g.lineTo(W * 0.18, seaY - 40);
    g.lineTo(W * 0.14, H);
    g.lineTo(0, H);
    g.fill();
    g.fillStyle = '#8a6a5a';
    g.fillRect(0, seaY - 30, W * 0.17, 30);
    const rodX = W * 0.13,
      rodY = seaY - 110;
    g.fillStyle = '#3a3350';
    g.beginPath();
    g.arc(W * 0.1, seaY - 70, 16, 0, Math.PI * 2);
    g.fill();
    g.fillRect(W * 0.1 - 12, seaY - 56, 24, 22);
    // rod
    const bend = this.phase === 'reel' ? this.tension * 40 : 0;
    g.strokeStyle = '#6a4a2a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(W * 0.1, seaY - 50);
    g.quadraticCurveTo(rodX + 30, rodY - 20 + bend * 0.5, rodX + 60, rodY + bend);
    g.stroke();
    // bobber
    const bx = W * 0.25 + this.castDist * W * 0.6;
    let by = seaY + 20;
    if (this.phase === 'wait') by += Math.sin(this.t * 3) * 3;
    if (this.phase === 'bite') by += 12 + Math.sin(this.t * 30) * 4;
    if (this.phase === 'reel') by += 8 + Math.sin(this.t * 12) * 6;
    if (this.phase !== 'aim') {
      g.strokeStyle = 'rgba(60,60,80,0.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(rodX + 60, rodY + bend);
      g.quadraticCurveTo((rodX + bx) / 2, by - 40, bx, by);
      g.stroke();
      g.fillStyle = '#ff5a5a';
      g.beginPath();
      g.arc(bx, by - 4, 8, Math.PI, 0);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(bx, by - 4, 8, 0, Math.PI);
      g.fill();
      if (this.splash > 0) {
        g.strokeStyle = `rgba(255,255,255,${this.splash})`;
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(bx, by, 30 * (1.5 - this.splash), 8 * (1.5 - this.splash), 0, 0, Math.PI * 2);
        g.stroke();
      }
      // fish shadow approaching
      if (this.phase === 'wait' || this.phase === 'bite') {
        const k = this.phase === 'bite' ? 0 : Math.min(1, this.waitT / 3);
        g.fillStyle = 'rgba(40,60,120,0.25)';
        g.beginPath();
        g.ellipse(bx + 40 * k + Math.sin(this.t) * 6, by + 24, 26, 8, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // HUD
    g.fillStyle = '#3a3350';
    g.font = 'bold 18px sans-serif';
    g.textAlign = 'center';
    g.fillText(this.message, W / 2, H * 0.14);
    if (this.phase === 'aim') {
      const bw = 26,
        bh = H * 0.4,
        x = W * 0.84,
        y = H * 0.3;
      roundRect(g, x, y, bw, bh, 12);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fill();
      const ph = bh * this.power;
      roundRect(g, x + 3, y + bh - ph, bw - 6, ph, 10);
      g.fillStyle = this.power > 0.75 ? '#ff7a5a' : '#ffcf4a';
      g.fill();
      g.fillStyle = '#3a3350';
      g.font = 'bold 13px sans-serif';
      g.fillText('とおく', x + bw / 2, y - 8);
    }
    if (this.phase === 'reel') {
      const bw = W * 0.5,
        x = (W - bw) / 2,
        y = H * 0.8;
      const rarity = this.fish?.rarity ?? 1;
      roundRect(g, x, y, bw, 22, 11);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fill();
      g.fillStyle = 'rgba(92,200,138,0.7)';
      g.fillRect(x + bw * 0.35, y + 2, bw * (0.4 - rarity * 0.035), 18);
      g.fillStyle = '#ff6b6b';
      g.fillRect(x + bw * 0.95, y + 2, bw * 0.05 - 2, 18);
      g.fillStyle = '#3a3350';
      g.fillRect(x + bw * Math.min(1, this.tension) - 3, y - 4, 6, 30);
      g.font = 'bold 13px sans-serif';
      g.fillText('糸のはり', x + bw / 2, y - 10);
      roundRect(g, x, y + 34, bw, 12, 6);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fill();
      roundRect(g, x, y + 34, bw * Math.max(0, this.progress), 12, 6);
      g.fillStyle = '#6fb5ff';
      g.fill();
      g.fillStyle = '#3a3350';
      g.fillText(this.holding ? '巻いてる…！' : '長押しで巻く', W / 2, y + 66);
    }
    if (this.caught) {
      g.textAlign = 'left';
      g.font = 'bold 14px sans-serif';
      g.fillText(`今回の釣果 ${this.caught}`, 16, H - 16);
    }
  }
}
