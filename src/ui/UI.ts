import { h, clear } from './dom';
import { events } from '../core/events';
import { clock, SEASON_LABEL, TOD_LABEL, WEATHER_ICON, WEATHER_LABEL } from '../core/Clock';
import { levelFromXp, formatNum } from '../core/levels';
import { gs } from '../systems/State';
import { townLevel } from '../systems/Life';
import { getItem, CAT_LABEL, type ItemCat, type ItemDef } from '../data/items';
import { audio } from '../core/Audio';
import { gfx } from '../core/Graphics';
import { activeFestival } from '../data/festivals';

export interface DialogOpt {
  label: string;
  cls?: string;
  disabled?: boolean;
  act: () => void | Promise<void>;
}

/** Root UI: HUD, buttons, toasts, dialogs and modal sheets. */
export class UI {
  root: HTMLElement;
  private hud: HTMLElement;
  private toasts: HTMLElement;
  private actBtn: HTMLButtonElement;
  private fpsEl: HTMLElement;
  private dialogEl: HTMLElement | null = null;
  private sheetEl: HTMLElement | null = null;
  private sheetClose: (() => void) | null = null;
  overlayStack: (() => boolean)[] = [];
  onAction: (() => void) | null = null;
  onBuild: (() => void) | null = null;
  onMenu: (() => void) | null = null;
  topRight: HTMLElement;
  actions: HTMLElement;

  constructor() {
    this.root = document.getElementById('ui')!;
    this.hud = h('div', { class: 'hud' });
    this.toasts = h('div', { class: 'toasts' });
    this.fpsEl = h('div', { class: 'fps', style: 'display:none' });
    this.actBtn = h('button', { class: 'act-btn dim', onclick: () => this.onAction?.() }, h('span', { class: 'ic' }, '✋'), h('span', null, 'しらべる'));
    this.actions = h('div', { class: 'actions' }, this.actBtn);
    this.topRight = h(
      'div',
      { class: 'topright' },
      h('button', { class: 'round-btn', onclick: () => this.onMenu?.() }, '📖', h('small', null, 'メニュー')),
      h('button', { class: 'round-btn', onclick: () => this.onBuild?.() }, '🔨', h('small', null, 'けんせつ')),
    );
    this.root.append(this.hud, this.toasts, this.fpsEl, this.actions, this.topRight);
    events.on('toast', ({ text, icon }) => this.toast(text, icon));
    events.on('levelUp', ({ level, label }) => this.levelUp(label, level));
  }

  setGameplayVisible(v: boolean): void {
    this.actions.style.display = v ? '' : 'none';
    this.topRight.style.display = v ? '' : 'none';
    this.hud.style.display = v ? '' : 'none';
    const joy = this.root.querySelector('.joy-zone') as HTMLElement | null;
    if (joy) joy.style.display = v ? '' : 'none';
  }

  setAction(label: string | null, icon = '✋'): void {
    clear(this.actBtn);
    this.actBtn.append(h('span', { class: 'ic' }, icon), h('span', null, label ?? 'しらべる'));
    this.actBtn.classList.toggle('dim', !label);
  }

  private hudCache = '';
  updateHud(fps: number): void {
    const lh = levelFromXp(gs.d.lighthouseXp);
    const w = clock.weather();
    const key = [clock.formatTime(), w, gs.d.coins, lh.level, Math.floor(lh.ratio * 50), townLevel()].join('|');
    if (key !== this.hudCache) {
      this.hudCache = key;
      clear(this.hud);
      this.hud.append(
        h('div', { class: 'pill' }, `${WEATHER_ICON[w]} ${clock.formatTime()}`, h('small', null, `${SEASON_LABEL[clock.season()]}・${TOD_LABEL[clock.timeOfDay()]}・${WEATHER_LABEL[w]}`)),
        h('div', { class: 'pill' }, `🪙 ${formatNum(gs.d.coins)}`),
        h('div', { class: 'pill' }, `🗼 Lv.${lh.level}`, h('div', { class: 'xpbar' }, h('i', { style: `width:${Math.floor(lh.ratio * 100)}%` }))),
        h('div', { class: 'pill' }, `🏘️ 街Lv.${townLevel()}`),
      );
      const fest = activeFestival();
      if (fest) this.hud.append(h('div', { class: 'pill' }, `${fest.icon} ${fest.name}開催中`));
    }
    this.fpsEl.style.display = gfx.showFps ? '' : 'none';
    if (gfx.showFps) this.fpsEl.textContent = `${fps.toFixed(0)} fps`;
  }

  toast(text: string, icon?: string): void {
    const t = h('div', { class: 'toast' }, `${icon ? icon + ' ' : ''}${text}`);
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  levelUp(label: string, level: number): void {
    audio.sfx('levelup');
    const el = h('div', { class: 'levelup' }, `${label} Lv.${level}！`, h('small', null, 'レベルアップ'));
    this.root.append(el);
    setTimeout(() => el.remove(), 2200);
  }

  // ---------- dialog ----------
  get dialogOpen(): boolean {
    return !!this.dialogEl;
  }

  dialog(name: string, sub: string, text: string, opts: DialogOpt[]): void {
    this.closeDialog();
    audio.sfx('talk');
    const optsEl = h('div', { class: 'opts' });
    for (const o of opts) {
      optsEl.append(
        h(
          'button',
          {
            class: 'chip ' + (o.cls ?? ''),
            disabled: o.disabled,
            onclick: () => {
              audio.sfx('click');
              void o.act();
            },
          },
          o.label,
        ),
      );
    }
    const el = h('div', { class: 'dialog' }, h('div', { class: 'name' }, name, sub ? h('small', null, sub) : null), h('div', { class: 'text' }, text), optsEl);
    this.dialogEl = el;
    this.root.append(el);
  }

  /** simple message with OK */
  say(name: string, text: string, then?: () => void): void {
    this.dialog(name, '', text, [{ label: 'OK', cls: 'primary', act: () => (this.closeDialog(), then?.()) }]);
  }

  closeDialog(): void {
    this.dialogEl?.remove();
    this.dialogEl = null;
  }

  // ---------- sheet ----------
  get sheetOpen(): boolean {
    return !!this.sheetEl;
  }

  sheet(title: string, build: (body: HTMLElement, head: HTMLElement) => void, onClose?: () => void, tabs?: { id: string; label: string }[], tab?: string, onTab?: (t: string) => void): HTMLElement {
    this.closeSheet();
    const body = h('div', { class: 'sheet-body' });
    const head = h('div', { class: 'sheet-head' }, h('h2', null, title), h('button', { class: 'close-btn', onclick: () => this.closeSheet() }, '✕'));
    const parts: HTMLElement[] = [head];
    if (tabs) {
      const tabsEl = h('div', { class: 'tabs' });
      for (const t of tabs) tabsEl.append(h('button', { class: t.id === tab ? 'on' : '', onclick: () => onTab?.(t.id) }, t.label));
      parts.push(tabsEl);
    }
    const sheet = h('div', { class: 'sheet' }, ...parts, body);
    const bd = h('div', { class: 'backdrop' }, sheet);
    bd.addEventListener('pointerdown', (e) => {
      if (e.target === bd) this.closeSheet();
    });
    this.root.append(bd);
    this.sheetEl = bd;
    this.sheetClose = onClose ?? null;
    build(body, head);
    return body;
  }

  closeSheet(): void {
    if (!this.sheetEl) return;
    this.sheetEl.remove();
    this.sheetEl = null;
    const cb = this.sheetClose;
    this.sheetClose = null;
    cb?.();
  }

  /** Back button handling: close top-most overlay */
  back(): boolean {
    for (let i = this.overlayStack.length - 1; i >= 0; i--) if (this.overlayStack[i]()) return true;
    if (this.sheetEl) {
      this.closeSheet();
      return true;
    }
    if (this.dialogEl) {
      this.closeDialog();
      return true;
    }
    return false;
  }

  /** Item picker (feed, gift, fuel, sell, plant...). */
  pickItem(title: string, filter: (d: ItemDef, id: string) => boolean, onPick: (id: string) => void, note?: (d: ItemDef) => string, multi = false): void {
    const render = (body: HTMLElement) => {
      clear(body);
      const ids = Object.keys(gs.d.inv)
        .filter((id) => gs.count(id) > 0 && filter(getItem(id), id))
        .sort((a, b) => getItem(a).cat.localeCompare(getItem(b).cat) || getItem(b).price - getItem(a).price);
      if (!ids.length) {
        body.append(h('div', { class: 'empty' }, '使えるものを持っていないみたい…'));
        return;
      }
      const byCat = new Map<ItemCat, string[]>();
      for (const id of ids) {
        const c = getItem(id).cat;
        if (!byCat.has(c)) byCat.set(c, []);
        byCat.get(c)!.push(id);
      }
      for (const [cat, list] of byCat) {
        body.append(h('div', { class: 'section-title' }, CAT_LABEL[cat]));
        const grid = h('div', { class: 'grid' });
        for (const id of list) {
          const d = getItem(id);
          grid.append(
            h(
              'button',
              {
                class: 'card',
                onclick: () => {
                  audio.sfx('click');
                  onPick(id);
                  if (multi && this.sheetEl) render(body);
                },
              },
              h('span', { class: 'n' }, `×${gs.count(id)}`),
              h('span', { class: 'ic' }, d.icon),
              d.name,
              note ? h('small', null, note(d)) : null,
            ),
          );
        }
        body.append(grid);
      }
    };
    this.sheet(title, (body) => render(body));
  }

  confirm(text: string, yes: () => void, yesLabel = 'はい'): void {
    this.dialog('かくにん', '', text, [
      { label: 'やめる', act: () => this.closeDialog() },
      { label: yesLabel, cls: 'primary', act: () => (this.closeDialog(), yes()) },
    ]);
  }
}
