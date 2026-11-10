import * as THREE from 'three';
import { h, clear } from '../ui/dom';
import type { UI } from '../ui/UI';
import { colorPicker } from '../ui/ColorPicker';
import { BUILDINGS, BUILD_CAT_ICON, BUILD_CAT_LABEL, type BuildCat, type BuildingDef } from '../data/buildings';
import { getItem } from '../data/items';
import { gs, type PlacedBuilding } from '../systems/State';
import { townLevel, emptyHomes } from '../systems/Life';
import { createBuildingObject, getBuildingDef, centerOf, footprint, slotColor } from './Placeable';
import type { World } from '../world/World';
import { audio } from '../core/Audio';
import { events, toast } from '../core/events';
import { haptic } from '../core/Platform';
import { clock } from '../core/Clock';
import type { PatternId } from './materials';

type Mode = 'place' | 'select' | 'move' | 'eyedrop';

export class BuildMode {
  active = false;
  private cat: BuildCat = 'home';
  private sel: BuildingDef | null = null;
  private ghost: THREE.Group | null = null;
  cell = { x: 0, z: 0 };
  private rot = 0;
  private mode: Mode = 'select';
  private selected: PlacedBuilding | null = null;
  private selectedProp: string | null = null;
  private bar: HTMLElement | null = null;
  private tools: HTMLElement | null = null;
  private info: HTMLElement | null = null;
  private paintEl: HTMLElement | null = null;
  private grid: THREE.Group;
  private selBox: THREE.LineSegments;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  onExit: (() => void) | null = null;
  private moveFrom: { x: number; z: number; rot: number } | null = null;

  constructor(
    private scene: THREE.Scene,
    private world: World,
    private ui: UI,
    private camera: THREE.Camera,
  ) {
    this.grid = new THREE.Group();
    const gm = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 });
    const pts: number[] = [];
    const R = 14;
    for (let i = -R; i <= R; i++) {
      pts.push(i, 0.03, -R, i, 0.03, R, -R, 0.03, i, R, 0.03, i);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid.add(new THREE.LineSegments(gg, gm));
    this.grid.visible = false;
    scene.add(this.grid);
    const bg = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.selBox = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: '#ffcf4a' }));
    this.selBox.visible = false;
    scene.add(this.selBox);
  }

  enter(px: number, pz: number): void {
    this.active = true;
    this.cell = { x: Math.floor(px), z: Math.floor(pz) - 2 };
    this.mode = 'select';
    this.sel = null;
    this.grid.visible = true;
    this.renderBar();
    this.renderTools();
    this.ui.overlayStack.push(this.backHandler);
  }

  private backHandler = (): boolean => {
    if (!this.active) return false;
    if (this.paintEl) {
      this.closePaint();
      return true;
    }
    if (this.mode === 'place' || this.mode === 'move' || this.mode === 'eyedrop' || this.selected || this.selectedProp) {
      this.cancel();
      return true;
    }
    this.exit();
    return true;
  };

  exit(): void {
    if (this.mode === 'move') this.cancel();
    this.active = false;
    this.clearGhost();
    this.closePaint();
    this.selected = null;
    this.selectedProp = null;
    this.selBox.visible = false;
    this.grid.visible = false;
    this.bar?.remove();
    this.tools?.remove();
    this.info?.remove();
    this.bar = this.tools = this.info = null;
    this.ui.overlayStack = this.ui.overlayStack.filter((f) => f !== this.backHandler);
    gs.markDirty();
    this.onExit?.();
  }

  // ---------- UI ----------
  private renderBar(): void {
    this.bar?.remove();
    const tl = townLevel();
    const catRow = h('div', { class: 'catrow' });
    for (const c of Object.keys(BUILD_CAT_LABEL) as BuildCat[]) {
      catRow.append(h('button', { class: c === this.cat ? 'on' : '', onclick: () => ((this.cat = c), this.renderBar()) }, `${BUILD_CAT_ICON[c]} ${BUILD_CAT_LABEL[c]}`));
    }
    catRow.append(h('button', { onclick: () => this.exit(), style: 'margin-left:auto;background:#ff6b6b;color:#fff' }, '✕ 終わる'));
    const items = h('div', { class: 'items' });
    const list = BUILDINGS.filter((b) => b.cat === this.cat);
    for (const def of list) {
      const unlocked = gs.isUnlocked(def.id, tl);
      const afford = gs.canAfford(def.cost);
      const lockNote = def.unlock.blueprint && !gs.d.blueprints.includes(def.id) ? '設計図が必要' : def.unlock.town && tl < def.unlock.town ? `街Lv.${def.unlock.town}` : def.unlock.lighthouse ? `灯台Lv.${def.unlock.lighthouse}` : '';
      items.append(
        h(
          'button',
          {
            class: 'card' + (this.sel?.id === def.id ? ' sel' : '') + (unlocked ? '' : ' locked'),
            onclick: () => {
              if (!unlocked) return toast(`${def.name}：${lockNote}`, '🔒');
              audio.sfx('click');
              this.startPlace(def);
            },
          },
          h('span', { class: 'ic' }, unlocked ? def.icon : '🔒'),
          def.name,
          h('span', { class: 'cost' }, unlocked ? this.costLabel(def.cost, afford) : lockNote),
        ),
      );
    }
    this.bar = h('div', { class: 'build-bar' }, catRow, items);
    this.ui.root.append(this.bar);
  }

  private costLabel(cost: BuildingDef['cost'], afford: boolean): HTMLElement {
    const el = h('span', { class: afford ? '' : 'lack' });
    const parts = [`🪙${cost.coins}`];
    for (const [k, v] of Object.entries(cost.mats ?? {})) parts.push(`${getItem(k).icon}${v}`);
    el.textContent = parts.join(' ');
    return el;
  }

  private renderTools(): void {
    this.tools?.remove();
    this.info?.remove();
    const t = h('div', { class: 'build-tools' });
    let info = '';
    if (this.mode === 'place' && this.sel) {
      info = `${this.sel.icon} ${this.sel.name}：地面をタップして場所を選んでね`;
      t.append(
        h('button', { class: 'chip primary', onclick: () => this.place() }, '✔ ここに置く'),
        h('button', { class: 'chip', onclick: () => this.rotate() }, '↻ 回転'),
        h('button', { class: 'chip', onclick: () => this.cancel() }, '✕ やめる'),
      );
    } else if (this.mode === 'move' && this.selected) {
      info = `${getBuildingDef(this.selected.type).name}を移動中：場所をタップ`;
      t.append(
        h('button', { class: 'chip primary', onclick: () => this.confirmMove() }, '✔ ここに移す'),
        h('button', { class: 'chip', onclick: () => this.rotate() }, '↻ 回転'),
        h('button', { class: 'chip', onclick: () => this.cancel() }, '✕ もどす'),
      );
    } else if (this.mode === 'eyedrop') {
      info = '🧪 スポイト：色をまねしたい建物をタップ';
      t.append(h('button', { class: 'chip', onclick: () => ((this.mode = 'select'), this.renderTools()) }, '✕ やめる'));
    } else if (this.selected) {
      const def = getBuildingDef(this.selected.type);
      const owner = this.selected.owner;
      info = `${def.icon} ${def.name} Lv.${this.selected.level}${owner && owner !== 'player' ? `（住人あり）` : ''}`;
      const up = this.upgradeCost(this.selected);
      t.append(
        h('button', { class: 'chip blue', onclick: () => this.openPaint() }, '🎨 色をぬる'),
        h('button', { class: 'chip', onclick: () => this.startMove() }, '✥ 移動'),
        h('button', { class: 'chip good', onclick: () => this.upgrade() }, `⬆ 強化 🪙${up.coins}`),
        h('button', { class: 'chip bad', onclick: () => this.remove() }, '🗑 片づける'),
        h('button', { class: 'chip', onclick: () => this.deselect() }, '✕ 閉じる'),
      );
    } else if (this.selectedProp) {
      info = '自然の木や岩：片づけると素材がもらえる';
      t.append(h('button', { class: 'chip bad', onclick: () => this.removeProp() }, '🗑 片づける'), h('button', { class: 'chip', onclick: () => this.deselect() }, '✕ 閉じる'));
    } else {
      info = '下から建物を選ぶか、置いた建物をタップして編集';
      t.append(h('button', { class: 'chip', onclick: () => ((this.mode = 'eyedrop'), this.renderTools()) }, '🧪 スポイト'));
    }
    this.info = h('div', { class: 'build-info' }, info);
    this.tools = t;
    this.ui.root.append(this.info, t);
  }

  // ---------- actions ----------
  private startPlace(def: BuildingDef): void {
    this.selected = null;
    this.selectedProp = null;
    this.selBox.visible = false;
    this.sel = def;
    this.mode = 'place';
    this.makeGhost();
    this.renderBar();
    this.renderTools();
  }

  private makeGhost(): void {
    this.clearGhost();
    const def = this.mode === 'move' && this.selected ? getBuildingDef(this.selected.type) : this.sel;
    if (!def) return;
    const ok = this.world.canPlace(def.id, this.cell.x, this.cell.z, this.rot, this.selected?.uid ?? -1);
    this.ghost = createBuildingObject({ type: def.id, level: this.selected?.level ?? 1, colors: {}, patterns: {}, rot: this.rot }, this.world.season, false, ok ? 'ok' : 'bad');
    const [cx, cz] = centerOf(def, this.cell.x, this.cell.z, this.rot);
    this.ghost.position.set(cx, 0.02, cz);
    this.scene.add(this.ghost);
  }

  private clearGhost(): void {
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = null;
  }

  private rotate(): void {
    this.rot = (this.rot + 1) % 4;
    audio.sfx('click');
    this.makeGhost();
  }

  private place(): void {
    const def = this.sel;
    if (!def) return;
    if (!this.world.canPlace(def.id, this.cell.x, this.cell.z, this.rot)) {
      audio.sfx('fail');
      return toast('ここには置けないみたい', '⚠️');
    }
    if (!gs.pay(def.cost)) {
      audio.sfx('fail');
      return toast('素材か灯貨がたりない', '💦');
    }
    const pb: PlacedBuilding = { uid: gs.d.nextUid++, type: def.id, x: this.cell.x, z: this.cell.z, rot: this.rot, level: 1, colors: {}, patterns: {} };
    gs.d.buildings.push(pb);
    this.world.addBuildingObject(pb);
    this.popIn(pb.uid);
    gs.addSkill('building', 10 + def.town * 2);
    gs.stat('built');
    audio.sfx('build');
    void haptic('medium');
    if (def.fn === 'home') toast(`空き家ができた（${emptyHomes().length}軒）。旅人を誘えるよ`, '🏠');
    gs.markDirty();
    events.emit('buildingsChanged');
    this.makeGhost();
    this.renderBar();
  }

  private popIn(uid: number): void {
    const obj = this.world.buildingObjs.get(uid);
    if (!obj) return;
    const target = obj.scale.x;
    obj.scale.setScalar(0.01);
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 350);
      const e = 1 + 0.3 * Math.sin(t * Math.PI) * (1 - t);
      obj.scale.setScalar(target * t * e + 0.01);
      if (t < 1) requestAnimationFrame(step);
      else obj.scale.setScalar(target);
    };
    requestAnimationFrame(step);
  }

  private cancel(): void {
    if (this.mode === 'move' && this.selected && this.moveFrom) {
      this.world.addBuildingObject(this.selected);
      this.moveFrom = null;
    }
    this.mode = 'select';
    this.sel = null;
    this.clearGhost();
    this.deselect();
    this.renderBar();
  }

  private deselect(): void {
    this.selected = null;
    this.selectedProp = null;
    this.selBox.visible = false;
    this.closePaint();
    this.renderTools();
  }

  private startMove(): void {
    if (!this.selected) return;
    this.closePaint();
    this.moveFrom = { x: this.selected.x, z: this.selected.z, rot: this.selected.rot };
    this.rot = this.selected.rot;
    this.cell = { x: this.selected.x, z: this.selected.z };
    this.world.removeBuildingObject(this.selected.uid);
    this.mode = 'move';
    this.selBox.visible = false;
    this.makeGhost();
    this.renderTools();
  }

  private confirmMove(): void {
    const pb = this.selected;
    if (!pb) return;
    if (!this.world.canPlace(pb.type, this.cell.x, this.cell.z, this.rot, pb.uid)) {
      audio.sfx('fail');
      return toast('ここには移せないみたい', '⚠️');
    }
    pb.x = this.cell.x;
    pb.z = this.cell.z;
    pb.rot = this.rot;
    this.moveFrom = null;
    this.world.addBuildingObject(pb);
    this.popIn(pb.uid);
    audio.sfx('build');
    this.clearGhost();
    this.mode = 'select';
    gs.markDirty();
    events.emit('buildingsChanged');
    this.selectBuilding(pb);
  }

  upgradeCost(pb: PlacedBuilding): { coins: number; mats: Record<string, number> } {
    const def = getBuildingDef(pb.type);
    const f = 0.5 + pb.level * 0.5;
    const mats: Record<string, number> = {};
    for (const [k, v] of Object.entries(def.cost.mats ?? {})) mats[k] = Math.ceil(v * f * 0.6);
    if (pb.level >= 5) mats.skyore = Math.floor(pb.level / 5);
    return { coins: Math.floor(Math.max(50, def.cost.coins) * f), mats };
  }

  private upgrade(): void {
    const pb = this.selected;
    if (!pb) return;
    const cost = this.upgradeCost(pb);
    const parts = [`🪙${cost.coins}`, ...Object.entries(cost.mats).map(([k, v]) => `${getItem(k).name}×${v}`)];
    this.ui.confirm(`Lv.${pb.level + 1} に強化する？\n（${parts.join('、')}）`, () => {
      if (!gs.pay(cost)) return toast('素材か灯貨がたりない', '💦');
      pb.level++;
      this.world.refreshBuilding(pb);
      this.popIn(pb.uid);
      gs.addSkill('building', 15 * pb.level);
      audio.sfx('levelup');
      toast(`${getBuildingDef(pb.type).name}が Lv.${pb.level} になった！`, '⬆️');
      gs.markDirty();
      events.emit('buildingsChanged');
      this.selectBuilding(pb);
    }, '強化する');
  }

  private remove(): void {
    const pb = this.selected;
    if (!pb) return;
    if (pb.owner && pb.owner !== 'player') return toast('住人が住んでいるので片づけられない（移動はできるよ）', '🏠');
    const def = getBuildingDef(pb.type);
    this.ui.confirm(`${def.name}を片づける？（素材は戻ってくる）`, () => {
      gs.d.buildings = gs.d.buildings.filter((b) => b.uid !== pb.uid);
      this.world.removeBuildingObject(pb.uid);
      for (const [k, v] of Object.entries(def.cost.mats ?? {})) gs.add(k, v, true);
      gs.addCoins(Math.floor(def.cost.coins / 2), true);
      audio.sfx('pick');
      gs.markDirty();
      events.emit('buildingsChanged');
      this.deselect();
    }, '片づける');
  }

  private removeProp(): void {
    const id = this.selectedProp;
    if (!id) return;
    const p = this.world.props.get(id);
    if (!p) return;
    this.world.removeProp(id);
    const mat = p.kind === 'rock' ? 'stone' : p.kind === 'orerock' ? 'skyore' : 'wood';
    gs.add(mat, p.kind === 'bush' ? 1 : 3);
    audio.sfx('pick');
    gs.markDirty();
    this.deselect();
  }

  private selectBuilding(pb: PlacedBuilding): void {
    this.selected = pb;
    this.selectedProp = null;
    const def = getBuildingDef(pb.type);
    const [w, d] = footprint(def, pb.rot);
    const [cx, cz] = centerOf(def, pb.x, pb.z, pb.rot);
    this.selBox.scale.set(w, 0.2, d);
    this.selBox.position.set(cx, 0.1, cz);
    this.selBox.visible = true;
    this.renderTools();
  }

  // ---------- paint ----------
  private openPaint(): void {
    const pb = this.selected;
    if (!pb) return;
    this.closePaint();
    const def = getBuildingDef(pb.type);
    let slot = def.slots[0]?.key;
    const body = h('div', { class: 'sheet-body' });
    const draw = () => {
      clear(body);
      const seg = h('div', { class: 'seg', style: 'margin-bottom:8px' });
      for (const s of def.slots)
        seg.append(
          h(
            'button',
            { class: s.key === slot ? 'on' : '', onclick: () => ((slot = s.key), draw()) },
            h('span', { class: 'sw', style: `display:inline-block;width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:4px;background:${slotColor(pb, s.key, clock.season())}` }),
            s.label,
          ),
        );
      body.append(seg);
      const pat = pb.patterns[slot];
      body.append(
        colorPicker({
          color: slotColor(pb, slot, clock.season()),
          pattern: pat?.p ?? 'none',
          color2: pat?.c2 ?? '#ffffff',
          allowPattern: true,
          onChange: (c, p: PatternId, c2) => {
            pb.colors[slot] = c;
            if (p === 'none') delete pb.patterns[slot];
            else pb.patterns[slot] = { p, c2 };
            this.world.refreshBuilding(pb);
            gs.markDirty();
          },
        }),
      );
      body.append(
        h(
          'div',
          { style: 'display:flex;gap:8px;margin-top:10px' },
          h('button', { class: 'chip', onclick: () => ((pb.colors = {}), (pb.patterns = {}), this.world.refreshBuilding(pb), draw()) }, '↺ もとの色'),
          h('button', { class: 'chip', onclick: () => this.randomize(pb, draw) }, '🎲 おまかせ'),
        ),
      );
    };
    draw();
    this.paintEl = h('div', { class: 'paint' }, h('div', { class: 'sheet-head' }, h('h2', null, `🎨 ${def.name}`), h('button', { class: 'close-btn', onclick: () => this.closePaint() }, '✕')), body);
    this.ui.root.append(this.paintEl);
    if (this.bar) this.bar.style.display = 'none';
    if (this.tools) this.tools.style.display = 'none';
  }

  private randomize(pb: PlacedBuilding, redraw: () => void): void {
    const def = getBuildingDef(pb.type);
    const base = Math.random();
    def.slots.forEach((s, i) => {
      const hh = (base + i * 0.17 + Math.random() * 0.08) % 1;
      const c = new THREE.Color().setHSL(hh, 0.45 + Math.random() * 0.3, 0.6 + Math.random() * 0.25);
      pb.colors[s.key] = '#' + c.getHexString(THREE.SRGBColorSpace);
    });
    this.world.refreshBuilding(pb);
    gs.markDirty();
    redraw();
  }

  private closePaint(): void {
    this.paintEl?.remove();
    this.paintEl = null;
    if (this.bar) this.bar.style.display = '';
    if (this.tools) this.tools.style.display = '';
    if (this.selected) events.emit('buildingsChanged');
  }

  // ---------- input ----------
  tap(sx: number, sy: number): void {
    if (!this.active || this.paintEl) return;
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return;
    const cx = Math.floor(hit.x),
      cz = Math.floor(hit.z);
    if (this.mode === 'place' || this.mode === 'move') {
      const def = this.mode === 'move' && this.selected ? getBuildingDef(this.selected.type) : this.sel!;
      const [w, d] = footprint(def, this.rot);
      this.cell = { x: cx - Math.floor((w - 1) / 2), z: cz - Math.floor((d - 1) / 2) };
      audio.sfx('click');
      this.makeGhost();
      return;
    }
    const o = this.world.occ.get(`${cx},${cz}`);
    if (this.mode === 'eyedrop') {
      if (o?.kind === 'building') {
        const src = gs.building(o.uid);
        if (src) this.eyedrop(src);
      }
      return;
    }
    if (o?.kind === 'building') {
      const pb = gs.building(o.uid);
      if (pb) {
        audio.sfx('click');
        this.selectBuilding(pb);
      }
    } else if (o?.kind === 'prop') {
      this.selected = null;
      this.selectedProp = o.id;
      this.selBox.scale.set(1, 1.5, 1);
      this.selBox.position.set(cx + 0.5, 0.75, cz + 0.5);
      this.selBox.visible = true;
      this.renderTools();
    } else this.deselect();
  }

  private eyedrop(src: PlacedBuilding): void {
    const season = clock.season();
    const sdef = getBuildingDef(src.type);
    const colors = sdef.slots.map((s) => slotColor(src, s.key, season));
    gs.d.palette = [...new Set([...colors, ...gs.d.palette])].slice(0, 16);
    toast(`${sdef.name}の色をマイパレットに取りこんだ`, '🧪');
    audio.sfx('pick');
    this.mode = 'select';
    this.selectBuilding(src);
    gs.markDirty();
  }

  update(center: THREE.Vector3, time: number): void {
    if (!this.active) return;
    this.grid.position.set(Math.floor(center.x), 0, Math.floor(center.z));
    if (this.ghost) this.ghost.position.y = 0.05 + Math.sin(time * 4) * 0.03;
    if (this.selBox.visible) (this.selBox.material as THREE.LineBasicMaterial).opacity = 0.6 + Math.sin(time * 5) * 0.4;
  }
}
