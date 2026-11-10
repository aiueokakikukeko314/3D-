import { h, clear } from './dom';
import { hexToHsv, hsvToHex, PATTERNS, type PatternId } from '../build/materials';
import { gs } from '../systems/State';
import { FLOWER_COLORS } from '../data/items';
import { toast } from '../core/events';

const PRESETS: { name: string; colors: string[] }[] = [
  { name: '基本', colors: ['#ffffff', '#f4ead8', '#d8d0c4', '#8a8a9a', '#3a3a4a', '#1f1f2a', '#8b5e3c', '#c9965c'] },
  { name: '春', colors: ['#ffc0d8', '#ff8fb8', '#fff27a', '#b8f2c8', '#8fd86a', '#e6e0ff'] },
  { name: '夏', colors: ['#5cc8ff', '#3f7fbf', '#ffcf2a', '#ff6b6b', '#7fe0d8', '#ffffff'] },
  { name: '秋', colors: ['#e8873a', '#c94a3a', '#d8b860', '#8a5a3a', '#a65d22', '#f2d27a'] },
  { name: '冬', colors: ['#e8f4ff', '#bfe6ff', '#6a7aff', '#3a4a8a', '#c8d8f2', '#ffffff'] },
  { name: '夜空', colors: ['#141a48', '#3a3f6a', '#a07aff', '#5affc8', '#ffe27a', '#ff7af0'] },
];

export interface PickerOpts {
  color: string;
  pattern?: PatternId;
  color2?: string;
  allowPattern?: boolean;
  onChange: (color: string, pattern: PatternId, color2: string) => void;
}

/** HSV color picker with presets, my palette, flower colors, and pattern choice. */
export function colorPicker(opts: PickerOpts): HTMLElement {
  let color = opts.color;
  let pattern: PatternId = opts.pattern ?? 'none';
  let color2 = opts.color2 ?? '#ffffff';
  let editing: 1 | 2 = 1;
  const wrap = h('div', { class: 'hsv' });

  const emit = () => opts.onChange(color, pattern, color2);
  const cur = () => (editing === 1 ? color : color2);
  const set = (c: string) => {
    if (editing === 1) color = c;
    else color2 = c;
    emit();
  };

  const render = () => {
    clear(wrap);
    const [hh, ss, vv] = hexToHsv(cur());
    const preview = h('div', { class: 'preview-sw', style: `background:${cur()}` });
    const which = opts.allowPattern && pattern !== 'none'
      ? h(
          'div',
          { class: 'seg' },
          h('button', { class: editing === 1 ? 'on' : '', onclick: () => ((editing = 1), render()) }, 'メイン色'),
          h('button', { class: editing === 2 ? 'on' : '', onclick: () => ((editing = 2), render()) }, '模様の色'),
        )
      : null;
    wrap.append(h('div', { style: 'display:flex;align-items:center;gap:10px' }, preview, which, h('button', { class: 'chip', style: 'margin-left:auto', onclick: () => saveToPalette(cur(), render) }, '＋マイパレット')));
    const slider = (label: string, val: number, bg: string, on: (v: number) => void) =>
      h(
        'div',
        { style: 'display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700' },
        h('span', { style: 'width:36px' }, label),
        h(
          'div',
          { class: 'track', style: `flex:1;background:${bg}` },
          h('input', {
            type: 'range',
            min: '0',
            max: '1000',
            value: String(Math.round(val * 1000)),
            oninput: (e: Event) => {
              on(Number((e.target as HTMLInputElement).value) / 1000);
              preview.style.background = cur();
            },
            onchange: () => render(),
          }),
        ),
      );
    let H = hh,
      S = ss,
      V = vv;
    wrap.append(
      slider('色相', H, 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)', (v) => {
        H = v;
        set(hsvToHex(H, S, V));
      }),
      slider('あざやか', S, `linear-gradient(90deg,${hsvToHex(H, 0, V)},${hsvToHex(H, 1, V)})`, (v) => {
        S = v;
        set(hsvToHex(H, S, V));
      }),
      slider('明るさ', V, `linear-gradient(90deg,#000,${hsvToHex(H, S, 1)})`, (v) => {
        V = v;
        set(hsvToHex(H, S, V));
      }),
    );
    const swRow = (name: string, colors: string[]) => {
      const row = h('div', { class: 'swatches' });
      for (const c of colors)
        row.append(
          h('button', {
            class: 'sw' + (c.toLowerCase() === cur().toLowerCase() ? ' on' : ''),
            style: `background:${c}`,
            onclick: () => {
              set(c);
              render();
            },
          }),
        );
      return h('div', null, h('div', { class: 'section-title' }, name), row);
    };
    wrap.append(swRow('マイパレット', gs.d.palette));
    const flowerCols = FLOWER_COLORS.filter((f) => gs.d.flowerColors.includes(f.id)).map((f) => f.color);
    if (flowerCols.length) wrap.append(swRow('花の色（花パズルで増える）', flowerCols));
    for (const p of PRESETS) wrap.append(swRow(p.name, p.colors));
    if (opts.allowPattern) {
      const row = h('div', { class: 'seg' });
      for (const p of PATTERNS)
        row.append(
          h(
            'button',
            {
              class: p.id === pattern ? 'on' : '',
              onclick: () => {
                pattern = p.id;
                if (pattern === 'none') editing = 1;
                emit();
                render();
              },
            },
            p.name,
          ),
        );
      wrap.append(h('div', { class: 'section-title' }, '模様'), row);
    }
  };
  render();
  return wrap;
}

function saveToPalette(c: string, rerender: () => void): void {
  if (gs.d.palette.includes(c)) return;
  gs.d.palette.push(c);
  if (gs.d.palette.length > 16) gs.d.palette.shift();
  gs.markDirty();
  toast('マイパレットに保存した', '🎨');
  rerender();
}
