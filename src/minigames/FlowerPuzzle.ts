import { h, clear } from '../ui/dom';
import type { UI } from '../ui/UI';
import { FLOWER_COLORS, getItem } from '../data/items';
import { gs } from '../systems/State';
import { Rng } from '../core/rng';
import { audio } from '../core/Audio';
import { haptic } from '../core/Platform';
import { toast } from '../core/events';

/** cross-breeding rules: unordered pair -> result */
const RULES: [string, string, string][] = [
  ['red', 'yellow', 'orange'],
  ['red', 'blue', 'purple'],
  ['yellow', 'blue', 'green'],
  ['red', 'white', 'pink'],
  ['blue', 'white', 'sky'],
  ['yellow', 'white', 'cream'],
  ['purple', 'green', 'black'],
  ['orange', 'cream', 'gold'],
  ['gold', 'black', 'rainbow'],
];

export function mix(a: string, b: string): string | null {
  for (const [x, y, r] of RULES) if ((a === x && b === y) || (a === y && b === x)) return r;
  return null;
}

const TIERS: string[][] = [
  ['orange', 'purple', 'green', 'pink', 'sky', 'cream'],
  ['black', 'gold'],
  ['rainbow'],
];

const DEPTH: Record<string, number> = { orange: 1, purple: 1, green: 1, pink: 1, sky: 1, cream: 1, black: 3, gold: 3, rainbow: 7 };

function colorOf(id: string): string {
  return FLOWER_COLORS.find((f) => f.id === id)?.color ?? '#ffffff';
}

/** 花の交配パズル (infinite procedural stages). */
export class FlowerPuzzle {
  private el: HTMLElement;
  private board: string[] = [];
  private size = 5;
  private sel = -1;
  private target = 'orange';
  private need = 1;
  private moves = 0;
  private made = 0;
  private level = 1;
  private onDone: (() => void) | null = null;

  constructor(private ui: UI) {
    this.el = h('div', { class: 'mg' });
  }

  open(onDone?: () => void): void {
    this.onDone = onDone ?? null;
    this.ui.root.append(this.el);
    this.ui.overlayStack.push(this.back);
    this.setup();
  }

  private back = (): boolean => {
    if (!this.el.isConnected) return false;
    this.close();
    return true;
  };

  close(): void {
    this.el.remove();
    this.ui.overlayStack = this.ui.overlayStack.filter((f) => f !== this.back);
    gs.markDirty();
    this.onDone?.();
  }

  private setup(): void {
    this.level = gs.d.puzzleLevel;
    const rng = new Rng(this.level * 7919 + 13);
    const tier = this.level <= 6 ? 0 : this.level <= 14 ? (rng.chance(0.75) ? 0 : 1) : this.level <= 30 ? (rng.chance(0.6) ? 1 : 0) : rng.chance(0.3) ? 2 : 1;
    this.target = rng.pick(TIERS[tier]);
    this.need = Math.min(4, 1 + Math.floor(this.level / 5));
    this.size = this.level >= 10 ? 6 : 5;
    const primaries = ['red', 'yellow', 'blue', 'white'];
    this.board = [];
    for (let i = 0; i < this.size * this.size; i++) this.board.push(rng.pick(primaries));
    // add a few helpful secondaries at higher levels
    if (tier >= 1) for (let i = 0; i < 3; i++) this.board[rng.int(0, this.board.length - 1)] = rng.pick(TIERS[0]);
    const slack = Math.max(2, 8 - Math.floor(this.level / 6));
    this.moves = DEPTH[this.target] * this.need * 2 + slack;
    this.made = 0;
    this.sel = -1;
    this.render();
  }

  private neighbors(i: number): number[] {
    const s = this.size,
      x = i % s,
      y = Math.floor(i / s);
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < s - 1) out.push(i + 1);
    if (y > 0) out.push(i - s);
    if (y < s - 1) out.push(i + s);
    return out;
  }

  private tap(i: number): void {
    if (this.moves <= 0) return;
    if (this.sel < 0) {
      this.sel = i;
      audio.sfx('click');
      return this.render();
    }
    if (i === this.sel) {
      this.sel = -1;
      return this.render();
    }
    if (!this.neighbors(this.sel).includes(i)) {
      this.sel = i;
      return this.render();
    }
    const a = this.board[this.sel],
      b = this.board[i];
    const r = mix(a, b) ?? a; // unknown combination: pollen spreads (copy color)
    this.board[i] = r;
    this.moves--;
    if (mix(a, b)) {
      audio.sfx('bloom');
      void haptic('light');
      if (!gs.d.flowerColors.includes(r)) {
        gs.d.flowerColors.push(r);
        toast(`新しい花の色「${FLOWER_COLORS.find((f) => f.id === r)?.name}」を発見！色ぬりに使えるよ`, '🌷');
      }
    } else audio.sfx('click');
    if (r === this.target) {
      this.made++;
      // harvested flower is replaced by a random primary
      this.board[i] = ['red', 'yellow', 'blue', 'white'][Math.floor(Math.random() * 4)];
      gs.add('fl_' + this.target, 1, true);
    }
    this.sel = -1;
    if (this.made >= this.need) return this.win();
    if (this.moves <= 0) return this.lose();
    this.render();
  }

  private win(): void {
    gs.d.puzzleLevel++;
    gs.add('petal', 2 + Math.floor(this.level / 3), true);
    gs.addSkill('puzzle', 20 + this.level * 5);
    gs.stat('puzzle');
    const p = gs.d.pets[0];
    if (p) p.traits.flower += 3;
    audio.sfx('success');
    this.render(`ステージ${this.level} クリア！ ${getItem('fl_' + this.target).name}×${this.need} と花びらを手に入れた`);
  }

  private lose(): void {
    audio.sfx('fail');
    this.render('手数がなくなっちゃった…もう一度やってみよう');
  }

  private render(msg?: string): void {
    clear(this.el);
    const boardEl = h('div', { class: 'board', style: `grid-template-columns:repeat(${this.size},auto)` });
    const nb = this.sel >= 0 ? this.neighbors(this.sel) : [];
    this.board.forEach((c, i) => {
      boardEl.append(
        h(
          'button',
          {
            class: 'cell' + (i === this.sel ? ' sel' : '') + (c === this.target ? ' goal' : ''),
            style: nb.includes(i) ? 'background:#a8dcb0' : '',
            onclick: () => this.tap(i),
          },
          h('div', { class: 'flower-dot', style: `background:${c === 'rainbow' ? 'conic-gradient(#ff6b6b,#ffcf5a,#6bdc8a,#6b9aff,#b46bff,#ff6b6b)' : colorOf(c)}` }),
        ),
      );
    });
    const rules = h('div', { class: 'rules', style: 'font-size:12px;line-height:1.7;background:#fff;border-radius:12px;padding:8px 10px' });
    for (const [a, b, r] of RULES) {
      const known = gs.d.flowerColors.includes(r);
      rules.append(h('div', null, h('span', { style: `color:${colorOf(a)}` }, '●'), '+', h('span', { style: `color:${colorOf(b)}` }, '●'), ' → ', known ? h('span', { style: `color:${colorOf(r)}` }, `● ${FLOWER_COLORS.find((f) => f.id === r)?.name}`) : '？？？'));
    }
    const done = msg !== undefined;
    const side = h(
      'div',
      { class: 'side' },
      h('div', { style: 'font-size:18px' }, `🌷 花パズル ステージ${this.level}`),
      h('div', null, 'お題: ', h('span', { class: 'sw', style: `display:inline-block;width:20px;height:20px;vertical-align:middle;background:${colorOf(this.target)}` }), ` ${FLOWER_COLORS.find((f) => f.id === this.target)?.name}の花を ${this.need} 本（${this.made}/${this.need}）`),
      h('div', null, `のこり手数 ${this.moves}`),
      h('div', { style: 'font-weight:600;font-size:12px;color:#5a7a60' }, '花をえらんで、となりの花をタップすると交配。組み合わせがないと花粉がうつって同じ色になる。'),
      rules,
      msg ? h('div', { style: 'background:#fff6d8;border-radius:12px;padding:8px' }, msg) : null,
      h(
        'div',
        { style: 'display:flex;gap:8px' },
        done ? h('button', { class: 'chip primary', onclick: () => this.setup() }, msg?.includes('クリア') ? '次のステージ' : 'もう一度') : h('button', { class: 'chip', onclick: () => this.setup() }, 'やりなおす'),
        h('button', { class: 'chip', onclick: () => this.close() }, 'もどる'),
      ),
    );
    this.el.append(h('div', { class: 'fpuzzle' }, boardEl, side));
  }
}
