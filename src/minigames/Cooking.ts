import { Minigame, roundRect } from './Base';
import { h, clear } from '../ui/dom';
import { RECIPES, type RecipeDef, type Ingredient } from '../data/recipes';
import { getItem, dishId, CAT_LABEL, TASTE_LABEL } from '../data/items';
import { gs } from '../systems/State';
import { audio } from '../core/Audio';
import { haptic } from '../core/Platform';
import type { UI } from '../ui/UI';

interface Note {
  lane: number;
  t: number; // hit time (s)
  hit: boolean;
  missed: boolean;
}

const LANES = ['きる', 'まぜる', 'やく', 'もる'];
const LANE_ICON = ['🔪', '🥄', '🔥', '🍽️'];
const LANE_COLOR = ['#ff8a8a', '#ffcf5a', '#ff9a4a', '#8fd0ff'];
const KEYS = ['d', 'f', 'j', 'k'];

export function findIngredients(r: RecipeDef): Record<string, number> | null {
  const use: Record<string, number> = {};
  const avail = (id: string) => gs.count(id) - (use[id] ?? 0);
  for (const ing of r.ingredients) {
    let need = ing.n;
    const cands = ing.id ? [ing.id] : Object.keys(gs.d.inv).filter((k) => getItem(k).cat === ing.cat).sort((a, b) => getItem(a).price - getItem(b).price);
    for (const c of cands) {
      const take = Math.min(need, avail(c));
      if (take > 0) {
        use[c] = (use[c] ?? 0) + take;
        need -= take;
      }
      if (need <= 0) break;
    }
    if (need > 0) return null;
  }
  return use;
}

function ingLabel(i: Ingredient): string {
  return `${i.id ? getItem(i.id).name : CAT_LABEL[i.cat!] + 'どれでも'}×${i.n}`;
}

/** 料理リズム: pick a recipe, then hit notes in 4 lanes to the beat. */
export class Cooking extends Minigame {
  private recipe: RecipeDef | null = null;
  private notes: Note[] = [];
  private time = -2;
  private dur = 0;
  private score = 0;
  private combo = 0;
  private judge = '';
  private judgeT = 0;
  private laneFlash = [0, 0, 0, 0];
  private picker: HTMLElement | null = null;
  private counts = { perfect: 0, good: 0, miss: 0 };
  private beatNext = 0;
  private playing = false;

  constructor(ui: UI) {
    super(ui, '🍳 料理');
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const lane = Math.floor((e.clientX / this.w) * 4);
      this.hitLane(Math.max(0, Math.min(3, lane)));
    });
    this.key = (e: KeyboardEvent) => {
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) this.hitLane(i);
    };
  }
  private key: (e: KeyboardEvent) => void;

  start(): void {
    window.addEventListener('keydown', this.key);
    this.showPicker();
  }

  close(): void {
    window.removeEventListener('keydown', this.key);
    super.close();
  }

  private showPicker(): void {
    this.playing = false;
    this.picker?.remove();
    const list = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr))' });
    for (const r of RECIPES.filter((x) => gs.d.recipes.includes(x.id))) {
      const ok = !!findIngredients(r);
      list.append(
        h(
          'button',
          { class: 'card' + (ok ? '' : ' locked'), onclick: () => ok && this.begin(r) },
          h('span', { class: 'ic' }, r.icon),
          r.name,
          h('small', null, r.ingredients.map(ingLabel).join('・')),
          h('small', null, `${TASTE_LABEL[r.taste]} ／ ♪${r.bpm}`),
        ),
      );
    }
    const body = h('div', { class: 'sheet-body' }, h('div', { class: 'section-title' }, '作る料理をえらぶ（材料がそろっているものだけ作れる）'), list);
    this.picker = h('div', { class: 'mg-result' }, h('div', { class: 'sheet', style: 'height:min(520px,92vh)' }, h('div', { class: 'sheet-head' }, h('h2', null, '🍳 レシピ'), h('button', { class: 'close-btn', onclick: () => this.close() }, '✕')), body));
    if (!gs.d.recipes.length) clear(body);
    this.el.append(this.picker);
  }

  private begin(r: RecipeDef): void {
    const use = findIngredients(r);
    if (!use) return;
    for (const [k, v] of Object.entries(use)) gs.remove(k, v);
    this.picker?.remove();
    this.picker = null;
    this.recipe = r;
    const beat = 60 / r.bpm;
    this.notes = [];
    const nBeats = 32;
    const seed = r.id.length * 7;
    for (let i = 0; i < nBeats; i++) {
      const pat = (i * 5 + seed) % 7;
      if (pat === 3 && i % 4 !== 0) continue;
      const lane = (i * 3 + seed + Math.floor(i / 4)) % 4;
      this.notes.push({ lane, t: i * beat, hit: false, missed: false });
      if (i % 8 === 6 && r.bpm > 100) this.notes.push({ lane: (lane + 2) % 4, t: i * beat + beat / 2, hit: false, missed: false });
    }
    this.dur = nBeats * beat + 1;
    this.time = -2;
    this.score = 0;
    this.combo = 0;
    this.counts = { perfect: 0, good: 0, miss: 0 };
    this.beatNext = 0;
    this.playing = true;
  }

  private hitLane(lane: number): void {
    if (!this.playing) return;
    this.laneFlash[lane] = 1;
    let best: Note | null = null,
      bd = 0.2;
    for (const n of this.notes) {
      if (n.hit || n.missed || n.lane !== lane) continue;
      const d = Math.abs(n.t - this.time);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (!best) return;
    best.hit = true;
    if (bd < 0.07) {
      this.score += 3;
      this.counts.perfect++;
      this.judge = 'パーフェクト！';
    } else {
      this.score += 1;
      this.counts.good++;
      this.judge = 'グッド';
    }
    this.combo++;
    this.judgeT = 0.5;
    this.sfx('hit');
    void haptic('light');
  }

  update(dt: number): void {
    for (let i = 0; i < 4; i++) this.laneFlash[i] = Math.max(0, this.laneFlash[i] - dt * 5);
    this.judgeT -= dt;
    if (!this.playing || !this.recipe) return;
    this.time += dt;
    const beat = 60 / this.recipe.bpm;
    const ctx = audio.ctx;
    if (this.time >= this.beatNext * beat - 0.05 && ctx) {
      audio.beat(ctx.currentTime + Math.max(0, this.beatNext * beat - this.time), this.beatNext % 4 === 0);
      this.beatNext++;
    }
    for (const n of this.notes) {
      if (!n.hit && !n.missed && this.time - n.t > 0.2) {
        n.missed = true;
        this.counts.miss++;
        this.combo = 0;
        this.judge = 'ミス';
        this.judgeT = 0.4;
      }
    }
    if (this.time > this.dur) this.finish();
  }

  private finish(): void {
    this.playing = false;
    const r = this.recipe!;
    const max = this.notes.length * 3;
    const ratio = this.score / max;
    const q = ratio > 0.8 ? 3 : ratio > 0.5 ? 2 : 1;
    const id = dishId(r.id, q);
    gs.add(id, 1, true);
    gs.addSkill('cooking', 15 + q * 15);
    gs.stat('cook');
    this.petTrait('sweet', 2);
    this.sfx('success');
    const d = getItem(id);
    this.result(`${d.name} ができた！`, r.icon, [`パーフェクト ${this.counts.perfect} ／ グッド ${this.counts.good} ／ ミス ${this.counts.miss}`, `品質 ${'★'.repeat(q)}${'☆'.repeat(3 - q)}`, '住民やソラモチにあげると大よろこび'], {
      label: 'ほかの料理も作る',
      act: () => this.showPicker(),
    });
  }

  draw(): void {
    const g = this.ctx,
      W = this.w,
      H = this.h;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff3e0');
    bg.addColorStop(1, '#ffd8b0');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const lw = W / 4;
    const hitY = H * 0.82;
    const speed = H * 0.6; // px per second
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)';
      g.fillRect(i * lw, 0, lw, H);
      if (this.laneFlash[i] > 0) {
        g.fillStyle = `rgba(255,255,255,${this.laneFlash[i] * 0.5})`;
        g.fillRect(i * lw, 0, lw, H);
      }
      g.fillStyle = '#7a5a4a';
      g.font = 'bold 15px sans-serif';
      g.textAlign = 'center';
      g.fillText(`${LANE_ICON[i]} ${LANES[i]}`, i * lw + lw / 2, H - 14);
      g.fillStyle = 'rgba(120,80,60,0.25)';
      g.font = '12px sans-serif';
      g.fillText(KEYS[i].toUpperCase(), i * lw + lw / 2, H - 34);
    }
    g.strokeStyle = '#ff8a5a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, hitY);
    g.lineTo(W, hitY);
    g.stroke();
    if (this.playing) {
      for (const n of this.notes) {
        if (n.hit || n.missed) continue;
        const y = hitY - (n.t - this.time) * speed;
        if (y < -40 || y > H + 40) continue;
        const x = n.lane * lw + lw / 2;
        roundRect(g, x - lw * 0.32, y - 16, lw * 0.64, 32, 16);
        g.fillStyle = LANE_COLOR[n.lane];
        g.fill();
        g.fillStyle = '#fff';
        g.font = '20px sans-serif';
        g.fillText(LANE_ICON[n.lane], x, y + 7);
      }
      g.fillStyle = '#5a3a2a';
      g.font = 'bold 20px sans-serif';
      if (this.time < 0) g.fillText(`${this.recipe?.icon} ${this.recipe?.name}  ${Math.ceil(-this.time)}…`, W / 2, H * 0.35);
      if (this.judgeT > 0) {
        g.font = 'bold 28px sans-serif';
        g.fillStyle = this.judge === 'ミス' ? '#9a8a8a' : '#ff6a3a';
        g.fillText(this.judge, W / 2, hitY - 60);
      }
      if (this.combo > 2) {
        g.font = 'bold 16px sans-serif';
        g.fillStyle = '#5a3a2a';
        g.fillText(`${this.combo} コンボ`, W / 2, hitY - 30);
      }
    }
  }
}
