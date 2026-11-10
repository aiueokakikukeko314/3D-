import { h, clear } from './dom';
import type { UI } from './UI';
import { colorPicker } from './ColorPicker';
import { gs, SKILL_LABEL, type Skill } from '../systems/State';
import { friendLevel, petLevel, townLevel, townRating, feedPet, petPet } from '../systems/Life';
import { levelFromXp, formatNum, titleForLevel } from '../core/levels';
import { getItem, CAT_LABEL, FISH, CATCHES, FLOWERS, CROPS, TREASURES, TASTE_LABEL, isFood, type ItemCat, type Taste } from '../data/items';
import { RECIPES } from '../data/recipes';
import { getResident, PERSONALITY_LABEL, RESIDENTS } from '../data/residents';
import { SPIRITS } from '../data/spirits';
import { getSpecies } from '../data/species';
import { BUILDINGS } from '../data/buildings';
import { PET_FORM_LABEL, petForm } from '../entities/CharacterFactory';
import { gfx, applyPreset, saveGraphics, PRESET_LABEL, type Preset } from '../core/Graphics';
import { clock, SEASON_LABEL } from '../core/Clock';
import { audio } from '../core/Audio';
import { events } from '../core/events';
import { BIOME_LABEL } from '../world/Islands';
import type { PatternId } from '../build/materials';

export interface MenuApi {
  applyGraphics(reload: boolean): void;
  setTimeOverride(o: { month: number; hour: number } | null): void;
  resetSave(): void;
  rebuildPlayer(): void;
  islands(): { name: string; biome: string }[];
  debugLevelUp?(): void;
}

type Tab = 'items' | 'people' | 'pets' | 'dex' | 'record' | 'style' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'items', label: '🎒 持ち物' },
  { id: 'people', label: '🏘️ 住民' },
  { id: 'pets', label: '☁️ ソラモチ' },
  { id: 'dex', label: '📖 図鑑' },
  { id: 'record', label: '🗼 記録' },
  { id: 'style', label: '👕 着せかえ' },
  { id: 'settings', label: '⚙️ 設定' },
];

export class Menu {
  private tab: Tab = 'items';
  private petSel = 0;
  private dexCat: ItemCat | 'spirit' | 'resident' = 'fish';

  constructor(
    private ui: UI,
    private api: MenuApi,
  ) {}

  open(tab?: Tab): void {
    if (tab) this.tab = tab;
    this.ui.sheet('メニュー', (body) => this.render(body), () => gs.markDirty(), TABS, this.tab, (t) => this.open(t as Tab));
  }

  private render(body: HTMLElement): void {
    clear(body);
    switch (this.tab) {
      case 'items':
        return this.items(body);
      case 'people':
        return this.people(body);
      case 'pets':
        return this.pets(body);
      case 'dex':
        return this.dex(body);
      case 'record':
        return this.record(body);
      case 'style':
        return this.style(body);
      case 'settings':
        return this.settings(body);
    }
  }

  private items(body: HTMLElement): void {
    const ids = Object.keys(gs.d.inv).filter((k) => gs.count(k) > 0);
    body.append(h('div', { class: 'section-title' }, `🪙 ${formatNum(gs.d.coins)} 灯貨 ／ ${ids.length} 種類`));
    if (!ids.length) return void body.append(h('div', { class: 'empty' }, 'まだ何も持っていない'));
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
            'div',
            { class: 'card', title: d.desc ?? '' },
            h('span', { class: 'n' }, `×${gs.count(id)}`),
            h('span', { class: 'ic' }, d.icon),
            d.name,
            h('small', null, d.taste ? TASTE_LABEL[d.taste] : `${d.price}灯貨`),
          ),
        );
      }
      body.append(grid);
    }
    body.append(h('div', { class: 'section-title' }, `覚えたレシピ (${gs.d.recipes.length}/${RECIPES.length})`));
    const rg = h('div', { class: 'grid' });
    for (const r of RECIPES) {
      const known = gs.d.recipes.includes(r.id);
      rg.append(h('div', { class: 'card' + (known ? '' : ' locked') }, h('span', { class: 'ic' }, known ? r.icon : '❔'), known ? r.name : '？？？', known ? h('small', null, r.ingredients.map((i) => (i.id ? getItem(i.id).name : CAT_LABEL[i.cat!]) + '×' + i.n).join(' ')) : null));
    }
    body.append(rg);
  }

  private people(body: HTMLElement): void {
    body.append(h('div', { class: 'section-title' }, `島の住民 ${gs.d.residents.length} 人`));
    for (const r of gs.d.residents) {
      const def = getResident(r.id);
      const lv = friendLevel(r.xp);
      const sp = getSpecies(def.species);
      const home = r.home !== undefined ? gs.building(r.home) : undefined;
      body.append(
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'big-ic', style: `color:${def.color ?? sp.colors[0]}` }, '●'),
          h(
            'div',
            { class: 'grow' },
            h('h3', null, `${def.name} `, h('small', null, `${sp.name}・${PERSONALITY_LABEL[def.personality]}`)),
            h('p', null, `好き: ${TASTE_LABEL[def.likes]}（大好物: ${getItem(def.favorite).name}）／ 苦手: ${TASTE_LABEL[def.dislikes]} ／ 誕生日 ${def.birthday.replace('-', '月')}日${home ? ` ／ 家 Lv.${home.level}` : ''}`),
            h('div', { class: 'bar' }, h('i', { style: `width:${Math.floor(lv.ratio * 100)}%` })),
          ),
          h('div', { style: 'font-weight:800;text-align:center' }, `なかよし`, h('br'), `Lv.${lv.level}`),
        ),
      );
    }
    const visitors = gs.d.visitors.filter((v) => !v.done);
    if (visitors.length) {
      body.append(h('div', { class: 'section-title' }, '今日の訪問者'));
      for (const v of visitors) {
        const name = v.kind === 'spirit' ? SPIRITS.find((s) => s.id === v.id)?.name ?? v.id : getResident(v.id).name;
        body.append(h('div', { class: 'row' }, h('div', { class: 'big-ic' }, v.kind === 'spirit' ? '✨' : '🎒'), h('div', { class: 'grow' }, h('h3', null, name), h('p', null, v.kind === 'spirit' ? '季節の精霊。お願いをかなえるとお礼がもらえる' : '旅人。話しかけて仲良くなると、空き家に住んでくれるかも'))));
      }
    }
    body.append(h('p', { class: 'cost', style: 'margin-top:12px' }, `出会える住民 ${RESIDENTS.length} 人 ＋ 無限の旅人。夜に灯台を灯すと、翌日たくさんの旅人がやってくる。`));
  }

  private pets(body: HTMLElement): void {
    if (!gs.d.pets.length) return void body.append(h('div', { class: 'empty' }, 'ソラモチはまだいない'));
    const tabs = h('div', { class: 'seg', style: 'margin-bottom:8px' });
    gs.d.pets.forEach((p, i) => tabs.append(h('button', { class: i === this.petSel ? 'on' : '', onclick: () => ((this.petSel = i), this.render(body)) }, p.name)));
    body.append(tabs);
    const p = gs.d.pets[Math.min(this.petSel, gs.d.pets.length - 1)];
    const lv = petLevel(p.xp);
    const form = petForm(lv.level, p.traits);
    body.append(
      h('div', { class: 'row' }, h('div', { class: 'big-ic' }, form === 'egg' ? '🥚' : '☁️'), h('div', { class: 'grow' }, h('h3', null, `${p.name}（${PET_FORM_LABEL[form]}）Lv.${lv.level}`), h('p', null, '食べたもの・遊び方で姿が変わる。レベルの上限はなく、大きく育つほどオーラや王冠がつく。'), h('div', { class: 'bar gold' }, h('i', { style: `width:${Math.floor(lv.ratio * 100)}%` })))),
      h('div', { class: 'row' }, h('div', { class: 'big-ic' }, '🍙'), h('div', { class: 'grow' }, h('h3', null, `まんぷく ${Math.floor(p.fullness)}%`), h('div', { class: 'bar blue' }, h('i', { style: `width:${p.fullness}%` })))),
    );
    const tr = h('div', { class: 'grid' });
    for (const t of Object.keys(p.traits) as Taste[]) tr.append(h('div', { class: 'card' }, h('span', { class: 'ic' }, { sweet: '🍰', sea: '🐟', star: '⭐', flower: '🌸' }[t]), TASTE_LABEL[t], h('small', null, String(Math.floor(p.traits[t])))));
    body.append(h('div', { class: 'section-title' }, '性格の傾向（一番高い系統で大人の姿が決まる）'), tr);
    body.append(
      h(
        'div',
        { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' },
        h('button', { class: 'chip primary', onclick: () => this.ui.pickItem(`${p.name}にごはん`, (d, id) => isFood(id), (id) => (this.ui.toast(feedPet(p, id), '☁️'), events.emit('residentsChanged')), (d) => TASTE_LABEL[d.taste!] ?? '', true) }, '🍙 ごはんをあげる'),
        h('button', { class: 'chip', onclick: () => (this.ui.toast(petPet(p), '💕'), this.render(body)) }, '🤚 なでる'),
      ),
    );
  }

  private dex(body: HTMLElement): void {
    const cats: { id: ItemCat | 'spirit' | 'resident'; label: string; list: { id: string; name: string; icon: string; desc?: string }[] }[] = [
      { id: 'fish', label: '魚', list: FISH },
      { id: 'star', label: '星・虫', list: CATCHES },
      { id: 'flower', label: '花', list: FLOWERS },
      { id: 'crop', label: '作物', list: CROPS },
      { id: 'treasure', label: 'お宝', list: TREASURES },
      { id: 'dish', label: '料理', list: RECIPES.map((r) => ({ id: 'dish:' + r.id, name: r.name, icon: r.icon, desc: r.desc })) },
      { id: 'spirit', label: '精霊', list: SPIRITS.map((s) => ({ id: s.id, name: `${s.title} ${s.name}`, icon: '✨', desc: `${SEASON_LABEL[s.season]}に現れる。${s.line}` })) },
      { id: 'resident', label: '住民', list: RESIDENTS.map((r) => ({ id: r.id, name: r.name, icon: '🏠', desc: getSpecies(r.species).name })) },
    ];
    const seg = h('div', { class: 'seg', style: 'margin-bottom:8px' });
    for (const c of cats) seg.append(h('button', { class: c.id === this.dexCat ? 'on' : '', onclick: () => ((this.dexCat = c.id), this.render(body)) }, c.label));
    body.append(seg);
    const cur = cats.find((c) => c.id === this.dexCat)!;
    const known = (id: string) => (cur.id === 'spirit' ? gs.d.spiritsMet.includes(id) : cur.id === 'resident' ? !!gs.resident(id) : !!gs.d.dex[id]);
    const got = cur.list.filter((x) => known(x.id)).length;
    body.append(h('div', { class: 'section-title' }, `${got} / ${cur.list.length} 発見`));
    const grid = h('div', { class: 'grid' });
    for (const it of cur.list) {
      const k = known(it.id);
      grid.append(h('div', { class: 'card' + (k ? '' : ' locked'), title: k ? it.desc ?? '' : '' }, h('span', { class: 'ic' }, k ? it.icon : '❔'), k ? it.name : '？？？', k && gs.d.dex[it.id] ? h('small', null, `${gs.d.dex[it.id]}回`) : null));
    }
    body.append(grid);
    if (cur.id === 'fish') body.append(h('p', { class: 'cost' }, '魚は季節・時間・天気で変わる。雲海の島のふちで釣りができる。'));
  }

  private record(body: HTMLElement): void {
    const lh = levelFromXp(gs.d.lighthouseXp);
    const add = (icon: string, title: string, lvl: number, ratio: number, note: string, cls = 'gold') =>
      body.append(h('div', { class: 'row' }, h('div', { class: 'big-ic' }, icon), h('div', { class: 'grow' }, h('h3', null, `${title} Lv.${lvl}`), h('p', null, note), h('div', { class: 'bar ' + cls }, h('i', { style: `width:${Math.floor(ratio * 100)}%` })))));
    add('🗼', '灯台', lh.level, lh.ratio, `${titleForLevel(lh.level, '灯台守')} ／ 次まで ${formatNum(lh.need - lh.into)}。レベルが上がるたびに新しい浮島が雲海から現れる（上限なし）`);
    const tl = townLevel();
    add('🏘️', '街', tl, levelFromXp(townRating() * 4, 0.6).ratio, `街の評価 ${formatNum(townRating())}。建物・住民・なかよし度で上がり、新しい建物が解放される`, 'blue');
    for (const s of Object.keys(SKILL_LABEL) as Skill[]) {
      const info = levelFromXp(gs.d.skills[s], 0.5);
      add({ fishing: '🎣', cooking: '🍳', gathering: '🧺', gardening: '🌱', building: '🔨', stars: '🌠', puzzle: '🌷' }[s], SKILL_LABEL[s], info.level, info.ratio, titleForLevel(info.level, ''), '');
    }
    body.append(h('div', { class: 'section-title' }, `浮島 ${this.api.islands().length} 個`));
    const ig = h('div', { class: 'grid' });
    for (const isl of this.api.islands()) ig.append(h('div', { class: 'card' }, h('span', { class: 'ic' }, '🏝️'), isl.name, h('small', null, BIOME_LABEL[isl.biome as keyof typeof BIOME_LABEL] ?? '')));
    body.append(ig);
    const bpUnlocked = BUILDINGS.filter((b) => gs.isUnlocked(b.id, tl)).length;
    body.append(h('p', { class: 'cost', style: 'margin-top:10px' }, `建てられる建物 ${bpUnlocked} / ${BUILDINGS.length} 種類 ／ 釣った魚 ${gs.d.stats.fish ?? 0} 匹 ／ 作った料理 ${gs.d.stats.cook ?? 0} 品 ／ 遊んだ日数 ${gs.d.stats.days ?? 1} 日`));
  }

  private style(body: HTMLElement): void {
    const parts: { key: 'shirt' | 'pants' | 'hat' | 'hair'; label: string }[] = [
      { key: 'shirt', label: '服' },
      { key: 'pants', label: 'ズボン' },
      { key: 'hat', label: '帽子' },
      { key: 'hair', label: '髪' },
    ];
    let sel: (typeof parts)[number]['key'] = 'shirt';
    const wrap = h('div');
    const draw = () => {
      clear(wrap);
      const seg = h('div', { class: 'seg', style: 'margin-bottom:8px' });
      for (const p of parts) seg.append(h('button', { class: p.key === sel ? 'on' : '', onclick: () => ((sel = p.key), draw()) }, p.label));
      wrap.append(h('div', { class: 'section-title' }, '灯台守の着せかえ'), seg);
      wrap.append(
        colorPicker({
          color: gs.d.player[sel],
          pattern: sel === 'shirt' ? gs.d.player.pattern : 'none',
          allowPattern: sel === 'shirt',
          onChange: (c, pat) => {
            gs.d.player[sel] = c;
            if (sel === 'shirt') gs.d.player.pattern = pat;
            gs.markDirty();
            this.api.rebuildPlayer();
          },
        }),
      );
      if (gs.d.pets.length) {
        const p = gs.d.pets[Math.min(this.petSel, gs.d.pets.length - 1)];
        let which: 'body' | 'accent' = 'body';
        const petWrap = h('div');
        const drawPet = () => {
          clear(petWrap);
          const s2 = h('div', { class: 'seg', style: 'margin-bottom:8px' });
          s2.append(h('button', { class: which === 'body' ? 'on' : '', onclick: () => ((which = 'body'), drawPet()) }, 'からだ'), h('button', { class: which === 'accent' ? 'on' : '', onclick: () => ((which = 'accent'), drawPet()) }, 'かざり'));
          petWrap.append(h('div', { class: 'section-title' }, `${p.name}の色`), s2);
          petWrap.append(
            colorPicker({
              color: p[which],
              pattern: which === 'body' ? p.pattern : 'none',
              color2: p.accent,
              allowPattern: which === 'body',
              onChange: (c, pat: PatternId) => {
                p[which] = c;
                if (which === 'body') p.pattern = pat;
                gs.markDirty();
                events.emit('residentsChanged');
              },
            }),
          );
        };
        drawPet();
        wrap.append(petWrap);
      }
    };
    draw();
    body.append(wrap);
  }

  private settings(body: HTMLElement): void {
    const seg = <T extends string | number | boolean>(label: string, note: string, opts: { v: T; l: string }[], cur: T, on: (v: T) => void) => {
      const s = h('div', { class: 'seg' });
      for (const o of opts)
        s.append(
          h(
            'button',
            {
              class: o.v === cur ? 'on' : '',
              onclick: () => {
                on(o.v);
                audio.sfx('click');
                this.render(body);
              },
            },
            o.l,
          ),
        );
      body.append(h('div', { class: 'setting' }, h('div', { class: 'label' }, label, note ? h('small', null, note) : null), s));
    };
    const custom = (fn: () => void, reload = false) => {
      fn();
      gfx.preset = 'custom';
      saveGraphics();
      this.api.applyGraphics(reload);
    };
    body.append(h('div', { class: 'section-title' }, '画質（スマホが熱い・重いときは「省電力」に）'));
    seg<Preset>(
      'プリセット',
      '一括で設定を切り替え',
      (['low', 'mid', 'high'] as const).map((p) => ({ v: p, l: PRESET_LABEL[p] })).concat(gfx.preset === 'custom' ? [{ v: 'custom' as 'low', l: 'カスタム' }] : []),
      gfx.preset,
      (v) => {
        if (v === 'custom') return;
        const reload = gfx.antialias !== (v === 'high');
        applyPreset(v);
        saveGraphics();
        this.api.applyGraphics(reload);
      },
    );
    seg('影', 'リアルタイム影は重め', [{ v: 'none', l: 'なし' }, { v: 'blob', l: '丸影' }, { v: 'real', l: 'リアルタイム' }], gfx.shadows, (v) => custom(() => (gfx.shadows = v as typeof gfx.shadows)));
    if (gfx.shadows === 'real') seg('影の解像度', '', [{ v: 512, l: '512' }, { v: 1024, l: '1024' }, { v: 2048, l: '2048' }], gfx.shadowRes, (v) => custom(() => (gfx.shadowRes = v as typeof gfx.shadowRes)));
    seg('描画解像度', '下げると軽くなる', [0.5, 0.6, 0.75, 0.85, 1].map((v) => ({ v, l: `${Math.round(v * 100)}%` })), gfx.resolution, (v) => custom(() => (gfx.resolution = v)));
    seg('フレームレート', '30にすると電池が長持ち', [{ v: 30, l: '30 FPS' }, { v: 60, l: '60 FPS' }], gfx.fps, (v) => custom(() => (gfx.fps = v as 30 | 60)));
    seg('アンチエイリアス', '切替時に再読み込み', [{ v: false, l: 'オフ' }, { v: true, l: 'オン' }], gfx.antialias, (v) => custom(() => (gfx.antialias = v), true));
    seg('描画距離', '遠くの島や建物を省略', [{ v: 60, l: '近い' }, { v: 100, l: '普通' }, { v: 180, l: '遠い' }], gfx.drawDistance, (v) => custom(() => (gfx.drawDistance = v)));
    seg('季節のエフェクト量', '桜・蛍・紅葉・雪', [{ v: 0, l: '少' }, { v: 1, l: '中' }, { v: 2, l: '多' }], gfx.particles, (v) => custom(() => (gfx.particles = v as 0 | 1 | 2)));
    seg('雲海のゆらぎ', '', [{ v: false, l: '静止' }, { v: true, l: 'ゆらぐ' }], gfx.cloudAnim, (v) => custom(() => (gfx.cloudAnim = v)));
    seg('キャラの動作数', '同時に動かす住民の数', [{ v: 12, l: '12' }, { v: 24, l: '24' }, { v: 60, l: '60' }], gfx.maxActors, (v) => custom(() => (gfx.maxActors = v)));
    seg('FPS表示', '', [{ v: false, l: 'オフ' }, { v: true, l: 'オン' }], gfx.showFps, (v) => {
      gfx.showFps = v;
      saveGraphics();
    });
    body.append(h('div', { class: 'section-title' }, '音'));
    const vol = (label: string, key: 'bgm' | 'sfx') =>
      body.append(
        h(
          'div',
          { class: 'setting' },
          h('div', { class: 'label' }, label),
          h('input', {
            type: 'range',
            min: '0',
            max: '100',
            value: String(Math.round(gfx[key] * 100)),
            onchange: (e: Event) => {
              gfx[key] = Number((e.target as HTMLInputElement).value) / 100;
              saveGraphics();
              audio.applyVolume();
            },
          }),
        ),
      );
    vol('BGM', 'bgm');
    vol('効果音', 'sfx');
    body.append(h('div', { class: 'section-title' }, '時刻プレビュー（見た目だけ。季節・時間を試せる）'));
    const ov = clock.override;
    const mo = h('select', { class: 'chip' }) as HTMLSelectElement;
    for (let m = 1; m <= 12; m++) mo.append(h('option', { value: String(m), selected: (ov?.month ?? clock.month()) === m }, `${m}月`));
    const hr = h('input', { type: 'range', min: '0', max: '235', value: String(Math.round((ov?.hour ?? clock.hour()) * 10)) }) as HTMLInputElement;
    const lbl = h('span', { style: 'width:52px;font-weight:800' }, `${Math.floor(Number(hr.value) / 10)}時`);
    const apply = () => {
      lbl.textContent = `${Math.floor(Number(hr.value) / 10)}時`;
      this.api.setTimeOverride({ month: Number(mo.value), hour: Number(hr.value) / 10 });
    };
    mo.addEventListener('change', apply);
    hr.addEventListener('input', apply);
    body.append(
      h('div', { class: 'setting' }, h('div', { class: 'label' }, ov ? 'プレビュー中' : '現実の時刻と連動中'), mo, hr, lbl, h('button', { class: 'chip', onclick: () => (this.api.setTimeOverride(null), this.render(body)) }, '現実に戻す')),
    );
    body.append(h('div', { class: 'section-title' }, 'データ'));
    body.append(
      h(
        'div',
        { class: 'setting' },
        h('div', { class: 'label' }, 'セーブ', h('small', null, '自動でセーブされます')),
        h('button', { class: 'chip good', onclick: () => void gs.save().then(() => this.ui.toast('セーブしました', '💾')) }, 'いまセーブ'),
        h('button', { class: 'chip bad', onclick: () => this.ui.confirm('最初からやり直しますか？（データは消えます）', () => this.api.resetSave(), '消してやり直す') }, '最初から'),
      ),
    );
    if (this.api.debugLevelUp) body.append(h('div', { class: 'setting' }, h('div', { class: 'label' }, 'デバッグ'), h('button', { class: 'chip', onclick: () => this.api.debugLevelUp!() }, '灯台+1')));
  }
}
