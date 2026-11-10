import { G, type Builder } from '../build/Builder';

export type BuildCat = 'home' | 'shop' | 'public' | 'nature' | 'path' | 'sky' | 'furniture' | 'farm';
export const BUILD_CAT_LABEL: Record<BuildCat, string> = {
  home: '住まい',
  shop: 'お店',
  public: '公共',
  nature: '自然',
  path: '道・柵',
  sky: '空の建造物',
  furniture: '家具・小物',
  farm: '畑',
};
export const BUILD_CAT_ICON: Record<BuildCat, string> = {
  home: '🏠',
  shop: '🏪',
  public: '⛲',
  nature: '🌳',
  path: '🧱',
  sky: '🎈',
  furniture: '🪑',
  farm: '🌱',
};

export type BuildFn = 'home' | 'shop' | 'farm' | 'kitchen' | 'starhill' | 'flowerbed' | 'greenhouse' | 'sell' | 'tree' | 'bench' | 'board' | 'none';

export interface SlotDef {
  key: string;
  label: string;
  def: string; // default color, or "season:leaf" style token
  kind?: 'window' | 'glow' | 'water';
}

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  cat: BuildCat;
  size: [number, number];
  slots: SlotDef[];
  cost: { coins: number; mats?: Record<string, number> };
  unlock: { town?: number; lighthouse?: number; blueprint?: boolean };
  walkable?: boolean;
  fn?: BuildFn;
  income?: number;
  town: number;
  desc?: string;
  build: (b: Builder, lv: number) => void;
}

// ---------------- slot presets ----------------
const S = (key: string, label: string, def: string, kind?: SlotDef['kind']): SlotDef => ({ key, label, def, kind });
const WALL = (d = '#f4ead8') => S('wall', '壁', d);
const ROOF = (d = '#d9675b') => S('roof', '屋根', d);
const TRIM = (d = '#8b5e3c') => S('trim', '柱・ふち', d);
const DOOR = (d = '#7a4a2e') => S('door', '扉', d);
const WIN = (d = '#ffe9a0') => S('window', '窓', d, 'window');
const WOOD = (d = '#a8754a') => S('wood', '木', d);
const STONE = (d = '#b9b4ab') => S('stone', '石', d);
const LEAF = () => S('leaf', '葉', 'season:leaf');
const TRUNK = () => S('trunk', '幹', '#8a5a3a');
const GLOW = (d = '#ffd27a') => S('glow', '灯り', d, 'glow');
const CLOTH = (d = '#f2f2f2') => S('cloth', '布', d);
const METAL = (d = '#5a6378') => S('metal', '金属', d);
const ACC = (d = '#6fb5ff') => S('accent', '飾り', d);
const WATER = () => S('water', '水', '#7fd0ff', 'water');
const FLOWER = (d = '#ff8fb8') => S('flower', '花', d);

// ---------------- builder templates ----------------
interface HouseOpt {
  w: number;
  d: number;
  h: number;
  roof: 'gable' | 'pyramid' | 'cone' | 'dome' | 'flat';
  roofH?: number;
  chimney?: boolean;
  windows?: number;
  y?: number;
  door?: boolean;
  base?: boolean;
}

function house(b: Builder, o: HouseOpt, lv = 1): void {
  const y0 = o.y ?? 0;
  if (o.base !== false) b.box('trim', o.w + 0.2, 0.18, o.d + 0.2, 0, y0, 0);
  b.box('wall', o.w, o.h, o.d, 0, y0 + 0.18, 0);
  const top = y0 + 0.18 + o.h;
  const rh = o.roofH ?? o.w * 0.45;
  switch (o.roof) {
    case 'gable':
      b.gable('roof', o.w + 0.35, rh, o.d + 0.35, 0, top, 0);
      break;
    case 'pyramid':
      b.pyramid('roof', o.w + 0.4, rh, o.d + 0.4, 0, top, 0);
      break;
    case 'cone':
      b.cone('roof', Math.max(o.w, o.d) * 0.72, rh, 0, top, 0, 10);
      break;
    case 'dome':
      b.sphere('roof', Math.max(o.w, o.d) * 0.55, 0, top, 0, 1, 0.7, 1);
      break;
    case 'flat':
      b.box('roof', o.w + 0.3, 0.2, o.d + 0.3, 0, top, 0);
      break;
  }
  if (o.door !== false) {
    b.box('door', 0.55, 0.95, 0.06, 0, y0 + 0.18, o.d / 2 + 0.01);
    b.box('trim', 0.7, 0.08, 0.1, 0, y0 + 1.13, o.d / 2 + 0.02);
  }
  const nw = o.windows ?? 2;
  const wy = y0 + 0.18 + o.h * 0.55;
  for (let i = 0; i < nw; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    if (row === 0) {
      b.box('window', 0.42, 0.42, 0.06, side * o.w * 0.3, wy, o.d / 2 + 0.01);
      b.box('trim', 0.52, 0.06, 0.08, side * o.w * 0.3, wy - 0.04, o.d / 2 + 0.03);
    } else {
      b.box('window', 0.06, 0.42, 0.42, side * (o.w / 2 + 0.01), wy, 0);
    }
  }
  if (o.chimney) b.box('trim', 0.3, rh * 0.9 + 0.3, 0.3, o.w * 0.28, top, -o.d * 0.15);
  // growth ornaments
  if (lv >= 2) b.cyl('accent', 0.14, 0.11, 0.22, o.w / 2 - 0.15, y0, o.d / 2 + 0.25, 6);
  if (lv >= 3) b.sphere('accent', 0.16, o.w / 2 - 0.15, y0 + 0.32, o.d / 2 + 0.25, 1, 0.8, 1, 0);
  if (lv >= 5) {
    // second floor / attic
    b.box('wall', o.w * 0.55, o.h * 0.6, o.d * 0.55, -o.w * 0.12, top + rh * 0.4, 0);
    b.gable('roof', o.w * 0.65, rh * 0.6, o.d * 0.65, -o.w * 0.12, top + rh * 0.4 + o.h * 0.6, 0);
    b.box('window', 0.32, 0.32, 0.05, -o.w * 0.12, top + rh * 0.4 + o.h * 0.3, o.d * 0.28 + 0.01);
  }
  if (lv >= 8) {
    b.cyl('trim', 0.03, 0.03, 1.1, o.w / 2, top, -o.d / 2, 4);
    b.box('accent', 0.5, 0.3, 0.03, o.w / 2 + 0.26, top + 0.75, -o.d / 2);
  }
  if (lv >= 12) {
    b.cyl('wall', 0.45, 0.5, o.h + rh + 0.6, -o.w / 2 - 0.1, y0, -o.d / 2 + 0.3, 8);
    b.cone('roof', 0.62, 0.9, -o.w / 2 - 0.1, y0 + o.h + rh + 0.6, -o.d / 2 + 0.3, 8);
  }
}

function awning(b: Builder, w: number, y: number, z: number): void {
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + (w / 6) * (i + 0.5);
    b.box(i % 2 ? 'cloth' : 'accent', w / 6, 0.06, 0.7, x, y, z + 0.35);
  }
}

function sign(b: Builder, x: number, y: number, z: number): void {
  b.box('trim', 0.9, 0.36, 0.06, x, y, z);
  b.box('accent', 0.7, 0.2, 0.04, x, y + 0.08, z + 0.04);
}

function roundTree(b: Builder, x = 0, z = 0, s = 1): void {
  b.cyl('trunk', 0.12 * s, 0.18 * s, 1.1 * s, x, 0, z, 6);
  b.sphere('leaf', 0.75 * s, x, 1.45 * s, z, 1, 0.9, 1, 1);
  b.sphere('leaf', 0.5 * s, x + 0.35 * s, 1.15 * s, z + 0.2 * s, 1, 1, 1, 0);
}

function pineTree(b: Builder, x = 0, z = 0, s = 1): void {
  b.cyl('trunk', 0.1 * s, 0.14 * s, 0.6 * s, x, 0, z, 6);
  b.cone('leaf', 0.8 * s, 1.0 * s, x, 0.5 * s, z, 7);
  b.cone('leaf', 0.6 * s, 0.9 * s, x, 1.1 * s, z, 7);
  b.cone('leaf', 0.4 * s, 0.7 * s, x, 1.65 * s, z, 7);
}

function lampPost(b: Builder, x = 0, z = 0, h = 1.6): void {
  b.cyl('metal', 0.05, 0.07, h, x, 0, z, 6);
  b.box('metal', 0.3, 0.05, 0.3, x, h, z);
  b.box('glow', 0.2, 0.25, 0.2, x, h + 0.05, z);
  b.pyramid('metal', 0.34, 0.16, 0.34, x, h + 0.3, z);
}

function fenceSeg(b: Builder, len: number, slot = 'wood', h = 0.6): void {
  for (let i = 0; i < 3; i++) b.box(slot, 0.1, h, 0.1, -len / 2 + 0.05 + (i * (len - 0.1)) / 2, 0, 0);
  b.box(slot, len, 0.07, 0.05, 0, h * 0.4, 0);
  b.box(slot, len, 0.07, 0.05, 0, h * 0.8, 0);
}

const H = (o: HouseOpt) => (b: Builder, lv: number) => house(b, o, lv);

// ---------------- catalog ----------------
export const BUILDINGS: BuildingDef[] = [
  // ===== homes =====
  {
    id: 'tent', name: 'テント', icon: '⛺', cat: 'home', size: [2, 2], fn: 'home', town: 4,
    slots: [CLOTH('#f2c46d'), TRIM('#8b5e3c'), ACC('#e8735c')], cost: { coins: 100, mats: { cotton: 2 } }, unlock: {},
    build: (b, lv) => {
      b.cone('cloth', 1.15, 1.6, 0, 0, 0, 4, Math.PI / 4);
      b.box('trim', 0.45, 0.8, 0.05, 0, 0, 0.62);
      b.cyl('trim', 0.03, 0.03, 0.4, 0, 1.55, 0, 4);
      b.box('accent', 0.3, 0.18, 0.02, 0.15, 1.75, 0);
      if (lv >= 3) b.box('accent', 0.6, 0.05, 0.4, 0.9, 0, 0.6);
      if (lv >= 5) house(b, { w: 1.3, d: 1.3, h: 0.9, roof: 'gable', windows: 1, door: false, y: 0 }, 1);
    },
  },
  { id: 'log_cabin', name: '丸太小屋', icon: '🛖', cat: 'home', size: [3, 3], fn: 'home', town: 8, slots: [WALL('#b98457'), ROOF('#6d4b33'), TRIM('#6b4329'), DOOR(), WIN(), ACC('#ff9f6b')], cost: { coins: 400, mats: { wood: 12 } }, unlock: {}, build: H({ w: 2.4, d: 2.2, h: 1.4, roof: 'gable', chimney: true }) },
  { id: 'cottage', name: 'こじんまりコテージ', icon: '🏡', cat: 'home', size: [3, 3], fn: 'home', town: 10, slots: [WALL('#fbf1df'), ROOF('#4f7fbf'), TRIM('#7b5a43'), DOOR('#4f7fbf'), WIN(), ACC('#ff7aa0')], cost: { coins: 600, mats: { wood: 8, stone: 6 } }, unlock: {}, build: H({ w: 2.5, d: 2.2, h: 1.5, roof: 'gable', windows: 4 }) },
  { id: 'brick_house', name: 'レンガの家', icon: '🧱', cat: 'home', size: [3, 3], fn: 'home', town: 12, slots: [WALL('#c96d4f'), ROOF('#5a4a4a'), TRIM('#efe3cf'), DOOR('#3d6b4f'), WIN(), ACC('#7fd18f')], cost: { coins: 900, mats: { stone: 14 } }, unlock: { town: 3 }, build: H({ w: 2.6, d: 2.4, h: 1.7, roof: 'pyramid', chimney: true, windows: 4 }) },
  {
    id: 'tower_house', name: '塔の家', icon: '🗼', cat: 'home', size: [2, 2], fn: 'home', town: 12, slots: [WALL('#e9e2f5'), ROOF('#7a5cc9'), TRIM('#5e4a8a'), DOOR('#5e4a8a'), WIN(), ACC('#ffd36b')], cost: { coins: 1000, mats: { stone: 10, wood: 6 } }, unlock: { town: 4 },
    build: (b, lv) => {
      b.cyl('trim', 0.95, 1.0, 0.18, 0, 0, 0, 10);
      b.cyl('wall', 0.8, 0.85, 3.0, 0, 0.18, 0, 10);
      b.cone('roof', 1.05, 1.4, 0, 3.18, 0, 10);
      b.box('door', 0.5, 0.9, 0.06, 0, 0.18, 0.84);
      for (let i = 0; i < 3; i++) b.box('window', 0.3, 0.36, 0.05, 0, 1.1 + i * 0.7, 0.82);
      if (lv >= 3) b.cyl('accent', 0.03, 0.03, 0.6, 0, 4.5, 0, 4);
      if (lv >= 6) b.torus('accent', 0.9, 0.06, 0, 2.2, 0, Math.PI / 2);
    },
  },
  {
    id: 'mushroom_house', name: 'きのこの家', icon: '🍄', cat: 'home', size: [3, 3], fn: 'home', town: 14, slots: [WALL('#f7eedc'), ROOF('#e2493f'), ACC('#ffffff'), DOOR('#8b5e3c'), WIN()], cost: { coins: 900, mats: { wood: 6 } }, unlock: { blueprint: true },
    build: (b, lv) => {
      b.cyl('wall', 0.85, 1.05, 1.6, 0, 0, 0, 10);
      b.sphere('roof', 1.5, 0, 1.75, 0, 1, 0.6, 1, 1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.sphere('accent', 0.18, Math.cos(a) * 1.0, 2.3, Math.sin(a) * 1.0, 1, 0.5, 1, 0);
      }
      b.sphere('accent', 0.22, 0, 2.65, 0, 1, 0.5, 1, 0);
      b.box('door', 0.5, 0.85, 0.06, 0, 0, 1.0);
      b.box('window', 0.32, 0.32, 0.05, 0.55, 0.9, 0.84, -0.5);
      if (lv >= 4) b.sphere('roof', 0.5, 1.2, 0.3, 0.9, 1, 0.6, 1, 0);
    },
  },
  {
    id: 'cloud_house', name: '雲の家', icon: '☁️', cat: 'home', size: [3, 3], fn: 'home', town: 16, slots: [WALL('#ffffff'), ROOF('#dbe9ff'), DOOR('#9ab8ff'), WIN('#bfe3ff'), ACC('#ffe27a')], cost: { coins: 1500, mats: { cotton: 20 } }, unlock: { lighthouse: 3 },
    build: (b, lv) => {
      b.sphere('wall', 1.2, 0, 0.9, 0, 1.15, 0.85, 1, 1);
      b.sphere('roof', 0.8, -0.6, 1.6, 0, 1, 0.8, 1, 1);
      b.sphere('roof', 0.75, 0.65, 1.55, 0.1, 1, 0.8, 1, 1);
      b.sphere('roof', 0.7, 0, 1.95, -0.2, 1, 0.8, 1, 1);
      b.box('door', 0.5, 0.85, 0.06, 0, 0, 1.18);
      b.box('window', 0.34, 0.34, 0.05, -0.65, 0.95, 1.05, 0.4);
      if (lv >= 3) b.sphere('accent', 0.2, 0.9, 2.3, 0, 1, 1, 1, 0);
    },
  },
  {
    id: 'tree_house', name: 'ツリーハウス', icon: '🌳', cat: 'home', size: [3, 3], fn: 'home', town: 16, slots: [WALL('#c9965c'), ROOF('#6d8f4f'), TRUNK(), LEAF(), DOOR(), WIN(), TRIM('#7a5232')], cost: { coins: 1400, mats: { wood: 25 } }, unlock: { town: 5 },
    build: (b) => {
      b.cyl('trunk', 0.35, 0.55, 2.0, 0, 0, 0, 8);
      b.box('trim', 2.2, 0.15, 2.2, 0, 1.8, 0);
      house(b, { w: 1.6, d: 1.5, h: 1.1, roof: 'gable', y: 1.95, base: false, windows: 2 }, 1);
      b.sphere('leaf', 1.2, 0.4, 4.1, -0.3, 1, 0.8, 1, 1);
      for (let i = 0; i < 5; i++) b.box('trim', 0.5, 0.06, 0.12, 1.0, 0.3 + i * 0.35, 0.9);
    },
  },
  { id: 'dome_house', name: 'まるドームの家', icon: '🛸', cat: 'home', size: [3, 3], fn: 'home', town: 14, slots: [WALL('#f2f6ff'), ROOF('#8fc9ff'), TRIM('#6b7fa8'), DOOR('#6b7fa8'), WIN(), ACC('#ff9ad2')], cost: { coins: 1200, mats: { stone: 8, glass: 2 } }, unlock: { town: 6 }, build: H({ w: 2.3, d: 2.3, h: 1.2, roof: 'dome', windows: 2 }) },
  {
    id: 'boat_house', name: '帆船の家', icon: '⛵', cat: 'home', size: [4, 3], fn: 'home', town: 20, slots: [WOOD('#a8754a'), WALL('#f4ead8'), CLOTH('#ffffff'), ROOF('#3f6fa8'), WIN(), ACC('#e8573f')], cost: { coins: 2200, mats: { wood: 30, cotton: 10 } }, unlock: { lighthouse: 5 },
    build: (b) => {
      b.box('wood', 3.4, 0.7, 1.8, 0, 0, 0);
      b.box('wood', 0.8, 0.5, 1.4, 1.9, 0.2, 0, 0);
      b.cone('wood', 0.7, 1.0, 2.4, 0.35, 0, 4, Math.PI / 4);
      b.box('wall', 1.8, 1.1, 1.5, -0.4, 0.7, 0);
      b.gable('roof', 2.0, 0.6, 1.7, -0.4, 1.8, 0);
      b.box('window', 0.3, 0.3, 0.05, -0.8, 1.2, 0.76);
      b.box('window', 0.3, 0.3, 0.05, 0.0, 1.2, 0.76);
      b.cyl('wood', 0.06, 0.08, 3.4, 0.9, 0.7, 0, 6);
      b.box('cloth', 0.04, 1.6, 1.3, 0.9, 1.6, 0);
      b.box('cloth', 0.04, 0.9, 0.9, 0.9, 3.25, 0);
    },
  },
  { id: 'igloo', name: 'かまくら', icon: '⛄', cat: 'home', size: [3, 3], fn: 'home', town: 10, slots: [WALL('#f4fbff'), DOOR('#7fa8d8'), GLOW('#ffcf7a')], cost: { coins: 700, mats: { stone: 4, cotton: 8 } }, unlock: { town: 2 }, build: (b) => { b.sphere('wall', 1.3, 0, 0, 0, 1, 0.95, 1, 2); b.cyl('wall', 0.45, 0.5, 0.8, 0, 0, 1.1, 8); b.box('door', 0.5, 0.65, 0.05, 0, 0, 1.36); b.sphere('glow', 0.12, 0, 0.7, 1.4, 1, 1, 1, 0); } },
  { id: 'two_story', name: '二階建ての家', icon: '🏘️', cat: 'home', size: [4, 3], fn: 'home', town: 22, slots: [WALL('#fff4e6'), ROOF('#3f8f6f'), TRIM('#6f5a4a'), DOOR('#3f8f6f'), WIN(), ACC('#ffcf5a')], cost: { coins: 2500, mats: { wood: 20, stone: 20 } }, unlock: { town: 8 }, build: (b, lv) => { house(b, { w: 3.2, d: 2.4, h: 2.6, roof: 'gable', windows: 4, chimney: true }, lv); b.box('trim', 3.3, 0.1, 2.5, 0, 1.45, 0); for (const x of [-0.95, 0.95]) b.box('window', 0.42, 0.42, 0.05, x, 2.0, 1.21); } },
  { id: 'fireplace_hut', name: '暖炉の小屋', icon: '🔥', cat: 'home', size: [3, 3], fn: 'home', town: 16, slots: [WALL('#8a6a5a'), ROOF('#3a3a4a'), TRIM('#c9b8a0'), DOOR(), WIN('#ffb36b'), GLOW('#ff8a3a')], cost: { coins: 1200, mats: { wood: 15, stone: 10 } }, unlock: { blueprint: true }, build: (b, lv) => { house(b, { w: 2.4, d: 2.3, h: 1.5, roof: 'gable', chimney: true }, lv); b.sphere('glow', 0.14, 0.67, 3.0, -0.35, 1, 1.4, 1, 0); } },
  { id: 'lantern_house', name: 'ランタン小屋', icon: '🏮', cat: 'home', size: [3, 3], fn: 'home', town: 18, slots: [WALL('#ffe2b8'), ROOF('#c94a3a'), TRIM('#3a2a2a'), DOOR('#3a2a2a'), WIN('#ffcf7a'), GLOW('#ff9a4a')], cost: { coins: 1600, mats: { wood: 10, glass: 3 } }, unlock: { lighthouse: 4 }, build: (b, lv) => { house(b, { w: 2.3, d: 2.3, h: 1.6, roof: 'pyramid', windows: 4 }, lv); for (const x of [-1.25, 1.25]) { b.cyl('trim', 0.02, 0.02, 0.3, x, 1.5, 1.25, 4); b.sphere('glow', 0.18, x, 1.35, 1.25, 1, 1.3, 1, 0); } } },

  // ===== shops =====
  { id: 'bakery', name: 'パン屋', icon: '🥐', cat: 'shop', size: [3, 3], fn: 'kitchen', income: 60, town: 14, slots: [WALL('#ffe8c8'), ROOF('#b5653f'), TRIM('#7b4a2e'), DOOR('#7b4a2e'), WIN(), ACC('#ff9c6b'), CLOTH('#fff6ec')], cost: { coins: 900, mats: { wood: 10, stone: 6 } }, unlock: { town: 2 }, build: (b, lv) => { house(b, { w: 2.6, d: 2.2, h: 1.6, roof: 'gable', chimney: true }, lv); awning(b, 2.6, 1.55, 1.1); sign(b, 0, 2.0, 1.15); } },
  { id: 'cafe', name: '雲カフェ', icon: '☕', cat: 'shop', size: [3, 3], fn: 'kitchen', income: 70, town: 15, slots: [WALL('#f2e6ff'), ROOF('#6b5aa8'), TRIM('#4a3a6a'), DOOR('#4a3a6a'), WIN(), ACC('#ffcf5a'), CLOTH('#ffffff'), WOOD()], cost: { coins: 1000, mats: { wood: 12 } }, unlock: { town: 3 }, build: (b, lv) => { house(b, { w: 2.4, d: 2.0, h: 1.6, roof: 'flat' }, lv); awning(b, 2.4, 1.6, 1.0); b.cyl('wood', 0.3, 0.3, 0.05, 0.9, 0.6, 1.9, 8); b.cyl('wood', 0.04, 0.04, 0.6, 0.9, 0, 1.9, 4); b.cyl('cloth', 0.02, 0.6, 0.3, 0.9, 1.3, 1.9, 8); b.cyl('wood', 0.02, 0.02, 0.7, 0.9, 0.65, 1.9, 4); } },
  { id: 'general_store', name: '雑貨屋', icon: '🏪', cat: 'shop', size: [3, 3], fn: 'sell', income: 80, town: 15, slots: [WALL('#e8f4e8'), ROOF('#4f9a6a'), TRIM('#3f5a4a'), DOOR('#3f5a4a'), WIN(), ACC('#ffffff'), CLOTH('#4f9a6a')], cost: { coins: 1100, mats: { wood: 10, stone: 8 } }, unlock: { town: 2 }, build: (b, lv) => { house(b, { w: 2.6, d: 2.2, h: 1.7, roof: 'gable', windows: 2 }, lv); awning(b, 2.6, 1.6, 1.1); sign(b, 0, 2.05, 1.15); } },
  { id: 'flower_shop', name: '花屋', icon: '💐', cat: 'shop', size: [3, 3], fn: 'greenhouse', income: 60, town: 15, slots: [WALL('#fff0f6'), ROOF('#ff8fb8'), TRIM('#9a5a7a'), DOOR('#9a5a7a'), WIN(), FLOWER(), LEAF()], cost: { coins: 900, mats: { wood: 6, petal: 8 } }, unlock: { town: 3 }, build: (b, lv) => { house(b, { w: 2.4, d: 2.0, h: 1.5, roof: 'gable' }, lv); for (let i = 0; i < 4; i++) { b.box('trim', 0.45, 0.3, 0.4, -0.9 + i * 0.6, 0, 1.4); b.sphere(i % 2 ? 'flower' : 'leaf', 0.2, -0.9 + i * 0.6, 0.4, 1.4, 1, 0.7, 1, 0); } } },
  { id: 'fish_shop', name: '魚屋', icon: '🐟', cat: 'shop', size: [3, 3], fn: 'sell', income: 75, town: 14, slots: [WALL('#e0f4ff'), ROOF('#3f7fbf'), TRIM('#2f4a6a'), DOOR('#2f4a6a'), WIN(), ACC('#ffffff'), CLOTH('#3f7fbf')], cost: { coins: 1000, mats: { wood: 10 } }, unlock: { town: 4 }, build: (b, lv) => { house(b, { w: 2.4, d: 2.0, h: 1.5, roof: 'gable' }, lv); awning(b, 2.4, 1.45, 1.0); b.box('trim', 2.0, 0.6, 0.5, 0, 0, 1.55); b.sphere('accent', 0.12, -0.5, 0.7, 1.55, 2, 0.6, 1, 0); b.sphere('accent', 0.12, 0.3, 0.7, 1.55, 2, 0.6, 1, 0); } },
  { id: 'tailor', name: '仕立て屋', icon: '🧵', cat: 'shop', size: [3, 3], fn: 'none', income: 90, town: 16, slots: [WALL('#fff8e8'), ROOF('#c95a8a'), TRIM('#5a3a4a'), DOOR('#5a3a4a'), WIN(), ACC('#ffd36b'), CLOTH('#c95a8a')], cost: { coins: 1300, mats: { cotton: 15, wood: 6 } }, unlock: { town: 5 }, build: (b, lv) => { house(b, { w: 2.4, d: 2.2, h: 1.7, roof: 'pyramid', windows: 2 }, lv); sign(b, 0, 2.0, 1.15); b.box('cloth', 0.08, 0.9, 0.5, 1.3, 0.3, 0.8); } },
  { id: 'lamp_shop', name: '灯具店', icon: '🪔', cat: 'shop', size: [3, 3], fn: 'none', income: 100, town: 18, slots: [WALL('#3a3a5a'), ROOF('#ffcf5a'), TRIM('#2a2a3a'), DOOR('#ffcf5a'), WIN('#ffcf7a'), GLOW()], cost: { coins: 1600, mats: { glass: 4, stone: 8 } }, unlock: { lighthouse: 3 }, build: (b, lv) => { house(b, { w: 2.4, d: 2.2, h: 1.7, roof: 'cone', windows: 4 }, lv); for (let i = 0; i < 3; i++) b.sphere('glow', 0.14, -0.7 + i * 0.7, 1.75, 1.3, 1, 1.3, 1, 0); } },
  { id: 'tea_house', name: '茶屋', icon: '🍵', cat: 'shop', size: [3, 3], fn: 'kitchen', income: 70, town: 16, slots: [WOOD('#c9a06a'), ROOF('#3f4a3f'), CLOTH('#c94a4a'), TRIM('#5a3a2a'), WIN()], cost: { coins: 1100, mats: { wood: 15 } }, unlock: { town: 4 }, build: (b) => { b.box('wood', 2.6, 0.3, 2.4, 0, 0, 0); for (const [x, z] of [[-1.1, -1], [1.1, -1], [-1.1, 1], [1.1, 1]]) b.cyl('trim', 0.07, 0.07, 1.6, x, 0.3, z, 6); b.box('wood', 2.2, 1.2, 0.08, 0, 0.3, -1.0); b.box('window', 0.6, 0.5, 0.05, 0, 0.8, -0.95); b.gable('roof', 3.0, 0.9, 2.8, 0, 1.9, 0); b.box('cloth', 1.6, 0.06, 0.6, 0, 0.6, 1.4); b.box('cloth', 0.08, 0.7, 0.4, 1.0, 1.2, 1.2); } },
  { id: 'market_stall', name: '屋台', icon: '🏮', cat: 'shop', size: [2, 2], fn: 'sell', income: 40, town: 8, slots: [WOOD(), CLOTH('#ff7a5a'), ACC('#ffffff'), GLOW()], cost: { coins: 400, mats: { wood: 8, cotton: 3 } }, unlock: {}, build: (b) => { b.box('wood', 1.6, 0.8, 0.8, 0, 0, 0.2); for (const x of [-0.75, 0.75]) b.cyl('wood', 0.04, 0.04, 1.8, x, 0, -0.2, 4); for (let i = 0; i < 4; i++) b.box(i % 2 ? 'accent' : 'cloth', 0.45, 0.06, 1.1, -0.68 + i * 0.45, 1.8, 0.1); b.sphere('glow', 0.12, 0.6, 1.55, 0.5, 1, 1.3, 1, 0); } },
  { id: 'mochi_stand', name: '餅つき屋台', icon: '🍡', cat: 'shop', size: [2, 2], fn: 'kitchen', income: 60, town: 12, slots: [WOOD('#c9a06a'), CLOTH('#ffffff'), ACC('#ff8fb8'), TRIM('#6a4a2a')], cost: { coins: 700, mats: { wood: 8 } }, unlock: { blueprint: true }, build: (b) => { b.box('wood', 1.5, 0.8, 0.7, 0, 0, 0.2); b.cyl('trim', 0.35, 0.3, 0.45, 0, 0.8, 0.2, 10); b.cyl('wood', 0.04, 0.04, 0.9, 0.3, 1.0, 0.2, 4); for (const x of [-0.7, 0.7]) b.cyl('wood', 0.04, 0.04, 1.8, x, 0, -0.2, 4); b.gable('cloth', 1.7, 0.4, 1.1, 0, 1.8, 0); for (let i = 0; i < 3; i++) b.sphere('accent', 0.08, -0.5 + i * 0.12, 0.88, 0.45, 1, 1, 1, 0); } },
  { id: 'firework_stand', name: '花火屋', icon: '🎆', cat: 'shop', size: [2, 2], fn: 'none', income: 80, town: 14, slots: [WOOD(), CLOTH('#3a3a8a'), ACC('#ff4a4a'), GLOW('#ffcf5a')], cost: { coins: 900, mats: { wood: 6, stardust: 4 } }, unlock: { blueprint: true }, build: (b) => { b.box('wood', 1.5, 0.8, 0.7, 0, 0, 0.2); for (const x of [-0.7, 0.7]) b.cyl('wood', 0.04, 0.04, 1.8, x, 0, -0.2, 4); b.gable('cloth', 1.7, 0.4, 1.1, 0, 1.8, 0); for (let i = 0; i < 5; i++) b.cyl(i % 2 ? 'accent' : 'glow', 0.05, 0.05, 0.35, -0.5 + i * 0.25, 0.8, 0.3, 6); } },
  {
    id: 'star_observatory', name: '星の天文台', icon: '🔭', cat: 'shop', size: [3, 3], fn: 'starhill', income: 110, town: 22, slots: [WALL('#e8eaf6'), ROOF('#3a4a8a'), TRIM('#5a6a9a'), DOOR('#3a4a8a'), WIN(), METAL('#c9cfe0')], cost: { coins: 2200, mats: { stone: 20, glass: 4 } }, unlock: { blueprint: true },
    build: (b) => {
      b.cyl('wall', 1.15, 1.25, 1.8, 0, 0, 0, 12);
      b.sphere('roof', 1.2, 0, 1.8, 0, 1, 0.9, 1, 1);
      b.box('metal', 0.3, 0.3, 1.4, 0.3, 2.4, 0.4, 0);
      b.box('door', 0.55, 0.95, 0.06, 0, 0, 1.22);
      b.box('window', 0.35, 0.35, 0.06, -0.7, 1.0, 0.95, -0.6);
    },
  },
  { id: 'harvest_barn', name: '収穫小屋', icon: '🌾', cat: 'shop', size: [3, 3], fn: 'farm', income: 70, town: 15, slots: [WALL('#c9483a'), ROOF('#5a4a3a'), TRIM('#ffffff'), DOOR('#ffffff'), WIN()], cost: { coins: 1200, mats: { wood: 20 } }, unlock: { blueprint: true }, build: (b, lv) => { house(b, { w: 2.6, d: 2.4, h: 1.7, roof: 'gable', roofH: 1.2, windows: 0 }, lv); b.box('trim', 0.08, 0.95, 0.08, -0.3, 0.18, 1.22); b.box('trim', 0.08, 0.95, 0.08, 0.3, 0.18, 1.22); } },

  // ===== public =====
  { id: 'plaza', name: '石の広場', icon: '🟫', cat: 'public', size: [3, 3], walkable: true, town: 6, slots: [STONE('#d8d0c0'), ACC('#b8a890')], cost: { coins: 300, mats: { stone: 9 } }, unlock: {}, build: (b) => { for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) b.plane((x + z) % 2 === 0 ? 'stone' : 'accent', 0.96, 0.96, x, 0, z); } },
  { id: 'fountain', name: '噴水', icon: '⛲', cat: 'public', size: [3, 3], town: 14, slots: [STONE('#e6e2dc'), WATER(), ACC('#8fd0ff')], cost: { coins: 1000, mats: { stone: 16 } }, unlock: { town: 2 }, build: (b) => { b.cyl('stone', 1.35, 1.45, 0.5, 0, 0, 0, 14); b.cyl('water', 1.2, 1.2, 0.05, 0, 0.42, 0, 14); b.cyl('stone', 0.18, 0.25, 1.2, 0, 0, 0, 8); b.cyl('stone', 0.6, 0.45, 0.2, 0, 1.2, 0, 10); b.cone('water', 0.35, 0.6, 0, 1.35, 0, 8); b.sphere('accent', 0.12, 0, 2.05, 0, 1, 1, 1, 0); } },
  { id: 'mist_fountain', name: '霞の泉', icon: '🌫️', cat: 'public', size: [3, 3], town: 18, slots: [STONE('#cfc8e8'), WATER(), GLOW('#e6e0ff')], cost: { coins: 1400, mats: { stone: 12, cotton: 6 } }, unlock: { blueprint: true }, build: (b) => { b.cyl('stone', 1.3, 1.4, 0.35, 0, 0, 0, 10); b.cyl('water', 1.15, 1.15, 0.05, 0, 0.3, 0, 10); for (let i = 0; i < 5; i++) b.sphere('glow', 0.35 - i * 0.04, Math.sin(i) * 0.4, 0.6 + i * 0.35, Math.cos(i) * 0.3, 1, 0.7, 1, 1); } },
  { id: 'clock_tower', name: '時計台', icon: '🕰️', cat: 'public', size: [2, 2], town: 20, slots: [WALL('#f2e8d8'), ROOF('#3f6f8f'), TRIM('#7a6a5a'), ACC('#ffffff'), METAL('#3a3a3a')], cost: { coins: 2000, mats: { stone: 20, wood: 8 } }, unlock: { town: 5 }, build: (b) => { b.box('trim', 1.6, 0.2, 1.6, 0, 0, 0); b.box('wall', 1.3, 3.6, 1.3, 0, 0.2, 0); b.pyramid('roof', 1.6, 1.3, 1.6, 0, 3.8, 0); b.cyl('accent', 0.42, 0.42, 0.06, 0, 2.9, 0.66, 16); b.box('metal', 0.05, 0.32, 0.03, 0, 2.95, 0.7); b.box('metal', 0.22, 0.05, 0.03, 0.08, 2.9, 0.7); b.box('trim', 0.5, 0.9, 0.05, 0, 0.2, 0.66); } },
  { id: 'notice_board', name: '掲示板', icon: '📋', cat: 'public', size: [2, 1], fn: 'board', town: 4, slots: [WOOD(), ACC('#fff4d8'), ROOF('#c96d4f')], cost: { coins: 150, mats: { wood: 4 } }, unlock: {}, build: (b) => { for (const x of [-0.6, 0.6]) b.cyl('wood', 0.05, 0.06, 1.5, x, 0, 0, 5); b.box('wood', 1.4, 0.8, 0.08, 0, 0.6, 0); b.box('accent', 0.35, 0.45, 0.02, -0.35, 0.75, 0.05); b.box('accent', 0.35, 0.3, 0.02, 0.2, 0.85, 0.05); b.gable('roof', 1.6, 0.3, 0.4, 0, 1.45, 0); } },
  { id: 'bench', name: 'ベンチ', icon: '🪑', cat: 'public', size: [2, 1], fn: 'bench', town: 3, slots: [WOOD('#b7814f'), METAL('#4a4a5a')], cost: { coins: 120, mats: { wood: 3 } }, unlock: {}, build: (b) => { b.box('wood', 1.6, 0.07, 0.45, 0, 0.42, 0); b.box('wood', 1.6, 0.35, 0.06, 0, 0.55, -0.2); for (const x of [-0.7, 0.7]) b.box('metal', 0.07, 0.45, 0.45, x, 0, 0); } },
  { id: 'street_lamp', name: '街灯', icon: '💡', cat: 'public', size: [1, 1], town: 3, slots: [METAL('#3a4058'), GLOW()], cost: { coins: 150, mats: { stone: 2 } }, unlock: {}, build: (b) => lampPost(b) },
  { id: 'gazebo', name: '東屋', icon: '🛕', cat: 'public', size: [3, 3], town: 14, slots: [WOOD('#f2ebe0'), ROOF('#6b8f6b'), TRIM('#a89a8a')], cost: { coins: 1100, mats: { wood: 16 } }, unlock: { town: 3 }, build: (b) => { b.cyl('trim', 1.35, 1.35, 0.15, 0, 0, 0, 8); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.cyl('wood', 0.07, 0.07, 1.8, Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1, 6); } b.cone('roof', 1.6, 1.0, 0, 1.95, 0, 6); b.sphere('trim', 0.12, 0, 3.0, 0, 1, 1, 1, 0); } },
  { id: 'stage', name: '野外ステージ', icon: '🎪', cat: 'public', size: [4, 3], town: 18, slots: [WOOD('#c9965c'), CLOTH('#c94a6a'), ACC('#ffd36b'), GLOW()], cost: { coins: 1800, mats: { wood: 24, cotton: 6 } }, unlock: { town: 6 }, build: (b) => { b.box('wood', 3.6, 0.45, 2.4, 0, 0, 0); for (const x of [-1.7, 1.7]) b.cyl('wood', 0.08, 0.08, 2.2, x, 0.45, -1.0, 6); b.box('cloth', 3.6, 1.8, 0.08, 0, 0.45, -1.1); b.box('accent', 3.8, 0.3, 0.3, 0, 2.6, -1.0); for (let i = 0; i < 5; i++) b.sphere('glow', 0.1, -1.4 + i * 0.7, 2.5, -0.8, 1, 1, 1, 0); } },
  { id: 'library', name: '図書館', icon: '📚', cat: 'public', size: [4, 3], town: 22, slots: [WALL('#e8dcc8'), ROOF('#5a4a7a'), TRIM('#ffffff'), DOOR('#5a3a2a'), WIN()], cost: { coins: 2400, mats: { stone: 24, wood: 12 } }, unlock: { town: 7 }, build: (b, lv) => { house(b, { w: 3.4, d: 2.4, h: 2.0, roof: 'gable', windows: 4 }, lv); for (let i = 0; i < 4; i++) b.cyl('trim', 0.1, 0.1, 2.0, -1.2 + i * 0.8, 0.18, 1.35, 8); b.box('trim', 3.5, 0.18, 0.4, 0, 2.15, 1.35); } },
  {
    id: 'greenhouse', name: '温室', icon: '🪴', cat: 'public', size: [3, 3], fn: 'greenhouse', town: 16, slots: [METAL('#ffffff'), WIN('#d8f8e8'), LEAF(), FLOWER('#ff7aa0')], cost: { coins: 1300, mats: { glass: 4, wood: 6 } }, unlock: { town: 2 },
    build: (b) => {
      b.box('metal', 2.6, 0.2, 2.4, 0, 0, 0);
      b.box('window', 2.5, 1.4, 2.3, 0, 0.2, 0);
      b.gable('window', 2.6, 0.9, 2.4, 0, 1.6, 0);
      for (let i = 0; i < 4; i++) b.box('metal', 0.05, 1.4, 2.35, -1.2 + i * 0.8, 0.2, 0);
      for (let i = 0; i < 3; i++) b.sphere(i % 2 ? 'flower' : 'leaf', 0.3, -0.8 + i * 0.8, 0.5, 0, 1, 0.8, 1, 0);
    },
  },
  { id: 'bell_tower', name: '鈴の塔', icon: '🔔', cat: 'public', size: [2, 2], town: 18, slots: [WOOD('#d8c8e8'), ROOF('#7a5cc9'), METAL('#ffcf5a')], cost: { coins: 1500, mats: { wood: 14, stone: 8 } }, unlock: { blueprint: true }, build: (b) => { for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.cyl('wood', 0.08, 0.1, 2.6, x, 0, z, 6); b.box('wood', 1.5, 0.15, 1.5, 0, 2.6, 0); b.pyramid('roof', 1.7, 1.0, 1.7, 0, 2.75, 0); b.cone('metal', 0.35, 0.5, 0, 2.1, 0, 10); } },
  { id: 'well', name: '井戸', icon: '🪣', cat: 'public', size: [2, 2], town: 6, slots: [STONE(), WOOD(), ROOF('#8a5a3a'), WATER()], cost: { coins: 400, mats: { stone: 8, wood: 4 } }, unlock: {}, build: (b) => { b.cyl('stone', 0.65, 0.7, 0.7, 0, 0, 0, 10); b.cyl('water', 0.5, 0.5, 0.04, 0, 0.6, 0, 10); for (const x of [-0.55, 0.55]) b.cyl('wood', 0.05, 0.05, 1.4, x, 0.6, 0, 4); b.gable('roof', 1.4, 0.4, 1.0, 0, 1.9, 0); } },
  { id: 'statue', name: '灯台守の像', icon: '🗿', cat: 'public', size: [2, 2], town: 12, slots: [STONE('#d8d0c8'), ACC('#ffd36b')], cost: { coins: 1200, mats: { stone: 18 } }, unlock: { town: 4 }, build: (b) => { b.box('stone', 1.3, 0.6, 1.3, 0, 0, 0); b.cyl('stone', 0.28, 0.35, 1.0, 0, 0.6, 0, 8); b.sphere('stone', 0.32, 0, 1.85, 0, 1, 1, 1, 1); b.sphere('accent', 0.15, 0.35, 1.5, 0.2, 1, 1, 1, 0); } },
  { id: 'mailbox', name: 'ポスト', icon: '📮', cat: 'public', size: [1, 1], town: 2, slots: [ACC('#e8473f'), METAL('#3a3a3a')], cost: { coins: 80, mats: { stone: 1 } }, unlock: {}, build: (b) => { b.cyl('metal', 0.04, 0.04, 0.8, 0, 0, 0, 4); b.box('accent', 0.35, 0.3, 0.45, 0, 0.8, 0); b.cyl('accent', 0.175, 0.175, 0.45, 0, 1.1, 0, 8); } },

  // ===== nature =====
  { id: 'tree_round', name: 'まるい木', icon: '🌳', cat: 'nature', size: [1, 1], fn: 'tree', town: 2, slots: [LEAF(), TRUNK()], cost: { coins: 60 }, unlock: {}, build: (b) => roundTree(b) },
  { id: 'tree_pine', name: 'とんがり木', icon: '🌲', cat: 'nature', size: [1, 1], fn: 'tree', town: 2, slots: [S('leaf', '葉', 'season:pine'), TRUNK()], cost: { coins: 60 }, unlock: {}, build: (b) => pineTree(b) },
  { id: 'sakura_tree', name: '桜の木', icon: '🌸', cat: 'nature', size: [1, 1], fn: 'tree', town: 6, slots: [S('leaf', '花', 'season:sakura'), TRUNK()], cost: { coins: 300 }, unlock: { blueprint: true }, build: (b) => { roundTree(b, 0, 0, 1.15); b.sphere('leaf', 0.45, -0.4, 1.6, -0.2, 1, 1, 1, 0); } },
  { id: 'maple_tree', name: 'もみじの木', icon: '🍁', cat: 'nature', size: [1, 1], fn: 'tree', town: 6, slots: [S('leaf', '葉', 'season:maple'), TRUNK()], cost: { coins: 300 }, unlock: { blueprint: true }, build: (b) => { b.cyl('trunk', 0.1, 0.16, 1.2, 0, 0, 0, 6); for (let i = 0; i < 4; i++) b.cone('leaf', 0.55, 0.5, Math.cos(i * 1.6) * 0.3, 1.1 + i * 0.25, Math.sin(i * 1.6) * 0.3, 6); } },
  { id: 'apple_tree', name: 'そらりんごの木', icon: '🍎', cat: 'nature', size: [1, 1], fn: 'tree', town: 4, slots: [LEAF(), TRUNK(), ACC('#e8473f')], cost: { coins: 250 }, unlock: { town: 2 }, build: (b) => { roundTree(b); for (let i = 0; i < 5; i++) b.sphere('accent', 0.09, Math.cos(i * 1.3) * 0.6, 1.2 + (i % 2) * 0.4, Math.sin(i * 1.3) * 0.6 + 0.2, 1, 1, 1, 0); } },
  { id: 'pear_tree', name: '霧なしの木', icon: '🍐', cat: 'nature', size: [1, 1], fn: 'tree', town: 4, slots: [LEAF(), TRUNK(), ACC('#d8e86b')], cost: { coins: 250 }, unlock: { town: 3 }, build: (b) => { roundTree(b, 0, 0, 0.95); for (let i = 0; i < 4; i++) b.sphere('accent', 0.1, Math.cos(i * 1.7) * 0.55, 1.15 + (i % 2) * 0.35, Math.sin(i * 1.7) * 0.55 + 0.2, 0.9, 1.2, 0.9, 0); } },
  { id: 'bamboo', name: '竹林', icon: '🎋', cat: 'nature', size: [1, 1], town: 3, slots: [S('leaf', '竹', '#7fbf5a'), ACC('#a8d86b')], cost: { coins: 120 }, unlock: { town: 2 }, build: (b) => { for (let i = 0; i < 4; i++) { const x = Math.cos(i * 2.1) * 0.25, z = Math.sin(i * 2.1) * 0.25; b.cyl('leaf', 0.05, 0.06, 2.2 + i * 0.3, x, 0, z, 5); b.cone('accent', 0.25, 0.5, x, 2.0 + i * 0.3, z, 4); } } },
  { id: 'flowerbed', name: '花壇', icon: '🌷', cat: 'nature', size: [2, 1], fn: 'flowerbed', town: 4, slots: [WOOD('#a8754a'), FLOWER('#ff6b8a'), S('flower2', '花2', '#ffd84a'), S('leaf', '葉', '#6bbf5a')], cost: { coins: 150, mats: { wood: 2 } }, unlock: {}, build: (b) => { b.box('wood', 1.8, 0.25, 0.8, 0, 0, 0); b.box('leaf', 1.65, 0.1, 0.65, 0, 0.25, 0); for (let i = 0; i < 6; i++) b.sphere(i % 2 ? 'flower' : 'flower2', 0.12, -0.65 + i * 0.26, 0.45, (i % 3) * 0.15 - 0.15, 1, 0.8, 1, 0); } },
  { id: 'sunflower_field', name: 'ひまわり畑', icon: '🌻', cat: 'nature', size: [2, 2], town: 8, slots: [FLOWER('#ffcf2a'), S('leaf', '茎', '#5aa84a'), ACC('#7a4a2a')], cost: { coins: 400 }, unlock: { blueprint: true }, build: (b) => { for (let i = 0; i < 6; i++) { const x = -0.6 + (i % 3) * 0.6, z = -0.4 + Math.floor(i / 3) * 0.8; b.cyl('leaf', 0.03, 0.03, 1.3, x, 0, z, 4); b.cyl('flower', 0.22, 0.22, 0.05, x, 1.3, z + 0.03, 10); b.cyl('accent', 0.1, 0.1, 0.06, x, 1.3, z + 0.04, 8); } } },
  { id: 'pond', name: '池', icon: '🪷', cat: 'nature', size: [3, 3], town: 8, slots: [STONE('#a8a094'), WATER(), FLOWER('#ffb6e0'), LEAF()], cost: { coins: 500, mats: { stone: 6 } }, unlock: { town: 2 }, build: (b) => { b.cyl('stone', 1.4, 1.45, 0.12, 0, 0, 0, 12); b.cyl('water', 1.25, 1.25, 0.06, 0, 0.1, 0, 12); for (let i = 0; i < 3; i++) { b.cyl('leaf', 0.22, 0.22, 0.03, -0.5 + i * 0.5, 0.17, Math.sin(i) * 0.4, 8); } b.sphere('flower', 0.1, 0, 0.25, 0.35, 1, 0.8, 1, 0); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.sphere('stone', 0.18, Math.cos(a) * 1.35, 0.12, Math.sin(a) * 1.35, 1, 0.6, 1, 0); } } },
  { id: 'rock', name: '飾り岩', icon: '🪨', cat: 'nature', size: [1, 1], town: 1, slots: [STONE('#a8a094'), ACC('#7fae62')], cost: { coins: 50 }, unlock: {}, build: (b) => { b.sphere('stone', 0.45, 0, 0.25, 0, 1, 0.7, 0.9, 0); b.sphere('stone', 0.25, 0.3, 0.15, 0.2, 1, 0.8, 1, 0); b.sphere('accent', 0.2, -0.1, 0.5, 0, 1.2, 0.3, 1, 0); } },
  { id: 'bush', name: 'しげみ', icon: '🌿', cat: 'nature', size: [1, 1], town: 1, slots: [LEAF(), FLOWER('#ffffff')], cost: { coins: 40 }, unlock: {}, build: (b) => { b.sphere('leaf', 0.45, 0, 0.35, 0, 1.1, 0.8, 1, 1); b.sphere('leaf', 0.3, 0.3, 0.25, 0.1, 1, 1, 1, 0); for (let i = 0; i < 3; i++) b.sphere('flower', 0.06, Math.cos(i * 2) * 0.35, 0.55, Math.sin(i * 2) * 0.35, 1, 1, 1, 0); } },
  { id: 'hedge', name: '生け垣', icon: '🟩', cat: 'nature', size: [2, 1], town: 2, slots: [LEAF()], cost: { coins: 80 }, unlock: {}, build: (b) => { b.box('leaf', 1.9, 0.75, 0.6, 0, 0, 0); b.sphere('leaf', 0.35, -0.5, 0.75, 0, 1, 0.5, 1, 0); b.sphere('leaf', 0.35, 0.5, 0.75, 0, 1, 0.5, 1, 0); } },
  { id: 'mushroom_ring', name: 'きのこの輪', icon: '🍄', cat: 'nature', size: [2, 2], town: 4, slots: [ROOF('#e2493f'), WALL('#f7eedc')], cost: { coins: 200 }, unlock: { town: 3 }, build: (b) => { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, r = 0.7; const s = 0.6 + (i % 3) * 0.2; b.cyl('wall', 0.05 * s, 0.07 * s, 0.25 * s, Math.cos(a) * r, 0, Math.sin(a) * r, 5); b.sphere('roof', 0.16 * s, Math.cos(a) * r, 0.25 * s, Math.sin(a) * r, 1, 0.6, 1, 0); } } },
  { id: 'cloud_tree', name: '雲の木', icon: '☁️', cat: 'nature', size: [1, 1], fn: 'tree', town: 6, slots: [S('leaf', '雲', '#ffffff'), TRUNK()], cost: { coins: 400, mats: { cotton: 4 } }, unlock: { lighthouse: 2 }, build: (b) => { b.cyl('trunk', 0.08, 0.14, 1.3, 0, 0, 0, 6); b.sphere('leaf', 0.55, 0, 1.6, 0, 1, 0.7, 1, 1); b.sphere('leaf', 0.4, 0.45, 1.45, 0.1, 1, 0.7, 1, 1); b.sphere('leaf', 0.4, -0.45, 1.5, -0.1, 1, 0.7, 1, 1); } },

  // ===== path & fence =====
  { id: 'path_stone', name: '石畳', icon: '⬜', cat: 'path', size: [1, 1], walkable: true, town: 1, slots: [STONE('#d8d0c4'), ACC('#bfb6a6')], cost: { coins: 15, mats: { stone: 1 } }, unlock: {}, build: (b) => { b.plane('stone', 0.48, 0.48, -0.24, 0, -0.24); b.plane('accent', 0.48, 0.48, 0.24, 0, -0.24); b.plane('accent', 0.48, 0.48, -0.24, 0, 0.24); b.plane('stone', 0.48, 0.48, 0.24, 0, 0.24); } },
  { id: 'path_wood', name: '木道', icon: '🟫', cat: 'path', size: [1, 1], walkable: true, town: 1, slots: [WOOD('#c9965c')], cost: { coins: 15, mats: { wood: 1 } }, unlock: {}, build: (b) => { for (let i = 0; i < 4; i++) b.box('wood', 0.98, 0.06, 0.22, 0, 0, -0.36 + i * 0.24); } },
  { id: 'path_brick', name: 'レンガ道', icon: '🟥', cat: 'path', size: [1, 1], walkable: true, town: 1, slots: [S('stone', 'レンガ', '#c9765a'), ACC('#a85a42')], cost: { coins: 20, mats: { stone: 1 } }, unlock: { town: 2 }, build: (b) => { for (let i = 0; i < 4; i++) { b.plane(i % 2 ? 'accent' : 'stone', 0.46, 0.22, -0.24, 0, -0.36 + i * 0.24); b.plane(i % 2 ? 'stone' : 'accent', 0.46, 0.22, 0.24, 0, -0.36 + i * 0.24); } } },
  { id: 'path_flower', name: '花の小道', icon: '🌼', cat: 'path', size: [1, 1], walkable: true, town: 2, slots: [STONE('#efe6d8'), FLOWER('#ffb3d1'), S('flower2', '花2', '#fff07a')], cost: { coins: 30, mats: { petal: 1 } }, unlock: { town: 2 }, build: (b) => { b.plane('stone', 0.6, 0.6, 0, 0, 0); for (const [x, z, s] of [[-0.38, -0.38, 'flower'], [0.38, 0.38, 'flower2'], [0.38, -0.38, 'flower'], [-0.38, 0.38, 'flower2']] as const) b.sphere(s, 0.07, x, 0.06, z, 1, 0.6, 1, 0); } },
  { id: 'path_cloud', name: '雲の道', icon: '☁️', cat: 'path', size: [1, 1], walkable: true, town: 2, slots: [S('cloth', '雲', '#ffffff')], cost: { coins: 30, mats: { cotton: 1 } }, unlock: { lighthouse: 2 }, build: (b) => { b.sphere('cloth', 0.45, 0, 0.0, 0, 1.1, 0.12, 1.1, 1); } },
  { id: 'path_star', name: '星のタイル', icon: '⭐', cat: 'path', size: [1, 1], walkable: true, town: 3, slots: [STONE('#3a3f6a'), GLOW('#ffe27a')], cost: { coins: 50, mats: { stardust: 1 } }, unlock: { lighthouse: 3 }, build: (b) => { b.plane('stone', 0.96, 0.96, 0, 0, 0); b.cyl('glow', 0.12, 0.12, 0.05, 0, 0.01, 0, 5); b.cyl('glow', 0.05, 0.05, 0.05, 0.3, 0.01, 0.3, 5); } },
  { id: 'fence_wood', name: '木の柵', icon: '🪵', cat: 'path', size: [1, 1], town: 1, slots: [WOOD('#b7814f')], cost: { coins: 20, mats: { wood: 1 } }, unlock: {}, build: (b) => fenceSeg(b, 1.0) },
  { id: 'fence_white', name: '白い柵', icon: '🤍', cat: 'path', size: [1, 1], town: 1, slots: [WOOD('#ffffff')], cost: { coins: 25, mats: { wood: 1 } }, unlock: { town: 2 }, build: (b) => { for (let i = 0; i < 4; i++) { b.box('wood', 0.09, 0.7, 0.05, -0.4 + i * 0.27, 0, 0); b.cone('wood', 0.07, 0.12, -0.4 + i * 0.27, 0.7, 0, 4, Math.PI / 4); } b.box('wood', 1.0, 0.06, 0.04, 0, 0.45, 0); } },
  { id: 'fence_stone', name: '石垣', icon: '🧱', cat: 'path', size: [1, 1], town: 1, slots: [STONE('#b9b0a2'), ACC('#7fae62')], cost: { coins: 25, mats: { stone: 2 } }, unlock: {}, build: (b) => { b.box('stone', 1.0, 0.5, 0.5, 0, 0, 0); b.box('accent', 1.0, 0.08, 0.5, 0, 0.5, 0); } },
  { id: 'arch', name: 'アーチ', icon: '🌈', cat: 'path', size: [2, 1], walkable: true, town: 6, slots: [WOOD('#ffffff'), FLOWER('#ff8fb8'), LEAF()], cost: { coins: 350, mats: { wood: 6 } }, unlock: { town: 2 }, build: (b) => { b.torus('wood', 0.9, 0.07, 0, 0.9, 0, 0, 0, Math.PI); for (const x of [-0.9, 0.9]) b.cyl('wood', 0.07, 0.07, 0.9, x, 0, 0, 6); for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; b.sphere(i % 2 ? 'flower' : 'leaf', 0.13, Math.cos(a) * 0.9, 0.9 + Math.sin(a) * 0.9, 0.05, 1, 1, 1, 0); } } },
  { id: 'flower_arch', name: '花のゲート', icon: '💮', cat: 'path', size: [2, 1], walkable: true, town: 8, slots: [WOOD('#c9965c'), FLOWER('#ffd6ea'), S('flower2', '花2', '#fff4a0'), LEAF()], cost: { coins: 500, mats: { wood: 6, petal: 6 } }, unlock: { blueprint: true }, build: (b) => { for (const x of [-0.85, 0.85]) b.box('wood', 0.15, 1.9, 0.15, x, 0, 0); b.box('wood', 2.0, 0.15, 0.25, 0, 1.9, 0); for (let i = 0; i < 10; i++) b.sphere(i % 3 === 0 ? 'leaf' : i % 2 ? 'flower' : 'flower2', 0.15, -0.9 + i * 0.2, 2.05 + (i % 2) * 0.08, 0, 1, 1, 1, 0); } },
  { id: 'torii_gate', name: '空の鳥居', icon: '⛩️', cat: 'path', size: [3, 1], walkable: true, town: 10, slots: [WOOD('#e8473f'), ROOF('#2a2a2a')], cost: { coins: 900, mats: { wood: 12 } }, unlock: { town: 4 }, build: (b) => { for (const x of [-1.1, 1.1]) b.cyl('wood', 0.12, 0.14, 2.4, x, 0, 0, 8); b.box('wood', 2.8, 0.15, 0.25, 0, 1.9, 0); b.box('roof', 3.2, 0.2, 0.35, 0, 2.35, 0); } },

  // ===== sky structures =====
  { id: 'balloon_port', name: '気球の発着場', icon: '🎈', cat: 'sky', size: [3, 3], town: 20, slots: [WOOD('#a8754a'), CLOTH('#ff7a5a'), S('cloth2', '布2', '#ffe27a'), METAL('#5a4a3a')], cost: { coins: 2000, mats: { cotton: 20, wood: 12 } }, unlock: { lighthouse: 3 }, build: (b) => { b.cyl('wood', 1.3, 1.4, 0.2, 0, 0, 0, 10); b.box('wood', 0.7, 0.55, 0.7, 0, 0.2, 0); for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) b.cyl('metal', 0.015, 0.015, 1.0, x, 0.75, z, 3); b.sphere('cloth', 1.0, 0, 2.6, 0, 1, 1.15, 1, 1); b.cyl('cloth2', 0.5, 0.25, 0.4, 0, 1.55, 0, 8); } },
  { id: 'cloud_waterfall', name: '雲の滝', icon: '🌊', cat: 'sky', size: [2, 2], town: 16, slots: [STONE('#9a948a'), S('cloth', '雲', '#ffffff'), ACC('#bfe6ff')], cost: { coins: 1500, mats: { stone: 14, cotton: 10 } }, unlock: { lighthouse: 4 }, build: (b) => { b.box('stone', 1.6, 1.8, 0.8, 0, 0, -0.4); b.sphere('stone', 0.6, -0.4, 1.8, -0.4, 1, 0.6, 1, 0); for (let i = 0; i < 6; i++) b.sphere(i % 2 ? 'cloth' : 'accent', 0.32, (i % 3 - 1) * 0.35, 1.5 - i * 0.25, 0.1 + i * 0.05, 1, 0.8, 1, 0); b.sphere('cloth', 0.6, 0, 0.2, 0.4, 1.4, 0.4, 1, 1); } },
  {
    id: 'windmill', name: '風車', icon: '🌬️', cat: 'sky', size: [2, 2], fn: 'farm', income: 40, town: 16, slots: [WALL('#f4ead8'), ROOF('#c95a3a'), WOOD('#8a5a3a'), CLOTH('#ffffff')], cost: { coins: 1400, mats: { wood: 18, stone: 8 } }, unlock: { blueprint: true },
    build: (b) => {
      b.cyl('wall', 0.6, 0.85, 2.8, 0, 0, 0, 8);
      b.cone('roof', 0.8, 0.9, 0, 2.8, 0, 8);
      b.box('wood', 0.2, 0.2, 0.3, 0, 2.6, 0.8);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.4;
        b.add('cloth', G.box(0.22, 1.1, 0.04), -Math.sin(a) * 0.6, 2.7 + Math.cos(a) * 0.6, 0.98, 0, 0, a);
      }
      b.box('wood', 0.45, 0.8, 0.06, 0, 0, 0.82);
    },
  },
  { id: 'floating_lantern', name: '浮遊ランタン', icon: '🏮', cat: 'sky', size: [1, 1], town: 4, slots: [CLOTH('#ffb36b'), GLOW('#ffcf7a'), TRIM('#7a3a2a')], cost: { coins: 200, mats: { cotton: 2 } }, unlock: { lighthouse: 2 }, build: (b) => { b.cyl('cloth', 0.22, 0.18, 0.4, 0, 1.8, 0, 8); b.sphere('glow', 0.12, 0, 1.95, 0, 1, 1, 1, 0); b.cyl('trim', 0.24, 0.24, 0.04, 0, 2.2, 0, 8); b.cyl('trim', 0.2, 0.2, 0.04, 0, 1.78, 0, 8); } },
  { id: 'rainbow_arch', name: '虹のアーチ', icon: '🌈', cat: 'sky', size: [3, 1], walkable: true, town: 14, slots: [S('c1', '虹1', '#ff6b6b'), S('c2', '虹2', '#ffcf5a'), S('c3', '虹3', '#6bdc8a'), S('c4', '虹4', '#6b9aff'), S('c5', '虹5', '#b46bff')], cost: { coins: 1200, mats: { stardust: 4, petal: 8 } }, unlock: { lighthouse: 4 }, build: (b) => { for (let i = 0; i < 5; i++) b.torus('c' + (i + 1), 1.5 - i * 0.12, 0.07, 0, 0, 0, 0, 0, Math.PI); } },
  { id: 'star_tower', name: '星の観測塔', icon: '🌟', cat: 'sky', size: [2, 2], fn: 'starhill', town: 18, slots: [STONE('#e0e4f2'), ROOF('#3a4a8a'), GLOW('#ffe27a'), METAL('#8a9ac9')], cost: { coins: 1800, mats: { stone: 16, stardust: 6 } }, unlock: { lighthouse: 3 }, build: (b) => { b.cyl('stone', 0.7, 0.9, 3.0, 0, 0, 0, 8); b.cyl('metal', 0.95, 0.95, 0.12, 0, 3.0, 0, 8); b.cone('roof', 0.6, 0.8, 0, 3.12, 0, 8); b.sphere('glow', 0.22, 0, 4.15, 0, 1, 1, 1, 0); } },
  { id: 'aurora_gate', name: 'オーロラの門', icon: '🌌', cat: 'sky', size: [3, 1], walkable: true, town: 22, slots: [STONE('#c8d8f2'), GLOW('#5affc8'), S('glow2', '光2', '#a07aff', 'glow')], cost: { coins: 2400, mats: { stone: 14, stardust: 10 } }, unlock: { blueprint: true }, build: (b) => { for (const x of [-1.2, 1.2]) b.box('stone', 0.4, 2.6, 0.4, x, 0, 0); for (let i = 0; i < 8; i++) b.box(i % 2 ? 'glow' : 'glow2', 0.25, 0.9 + Math.sin(i) * 0.3, 0.05, -0.9 + i * 0.26, 1.4, 0); b.box('stone', 2.9, 0.25, 0.45, 0, 2.6, 0); } },
  { id: 'wind_chime', name: '風鈴やぐら', icon: '🎐', cat: 'sky', size: [1, 1], town: 6, slots: [WOOD(), WIN('#9ad8ff'), CLOTH('#ffffff')], cost: { coins: 500, mats: { wood: 4, glass: 1 } }, unlock: { blueprint: true }, build: (b) => { b.cyl('wood', 0.05, 0.06, 1.9, -0.3, 0, 0, 5); b.box('wood', 0.8, 0.06, 0.06, 0.05, 1.85, 0); for (const x of [0.0, 0.35]) { b.sphere('window', 0.12, x, 1.6, 0, 1, 0.9, 1, 0); b.box('cloth', 0.08, 0.2, 0.01, x, 1.35, 0); } } },
  { id: 'cloud_slide', name: '雲のすべり台', icon: '🛝', cat: 'sky', size: [3, 2], town: 12, slots: [S('cloth', '雲', '#ffffff'), ACC('#ffb6c9'), WOOD('#c9a8ff')], cost: { coins: 1100, mats: { cotton: 12 } }, unlock: { blueprint: true }, build: (b) => { b.box('wood', 0.8, 1.6, 0.8, -1.0, 0, 0); for (let i = 0; i < 6; i++) b.sphere(i % 2 ? 'cloth' : 'accent', 0.35, -0.6 + i * 0.32, 1.5 - i * 0.26, 0, 1, 0.5, 1, 0); b.sphere('cloth', 0.5, -1.0, 1.75, 0, 1, 0.5, 1, 1); } },
  { id: 'kite_post', name: '凧あげ台', icon: '🪁', cat: 'sky', size: [1, 1], town: 4, slots: [WOOD(), CLOTH('#ff6b9a'), ACC('#6bc8ff')], cost: { coins: 250, mats: { wood: 3, cotton: 2 } }, unlock: { town: 2 }, build: (b) => { b.cyl('wood', 0.05, 0.07, 1.4, 0, 0, 0, 5); b.box('accent', 0.02, 0.02, 1.5, 0.3, 1.9, 0, 0); b.add('cloth', G.box(0.5, 0.5, 0.03), 0.6, 2.8, 0, 0, 0, Math.PI / 4); b.box('accent', 0.04, 0.6, 0.02, 0.6, 2.2, 0); } },
  { id: 'weather_vane', name: '風見鶏', icon: '🐓', cat: 'sky', size: [1, 1], town: 3, slots: [METAL('#c9a04a'), STONE()], cost: { coins: 200, mats: { stone: 2 } }, unlock: {}, build: (b) => { b.cyl('stone', 0.25, 0.3, 0.3, 0, 0, 0, 6); b.cyl('metal', 0.03, 0.03, 1.8, 0, 0.3, 0, 4); b.box('metal', 0.5, 0.25, 0.04, 0.08, 1.9, 0); b.box('metal', 0.6, 0.03, 0.03, 0, 1.75, 0); b.box('metal', 0.03, 0.03, 0.6, 0, 1.75, 0); } },
  { id: 'sky_swing', name: '空のブランコ', icon: '🎠', cat: 'sky', size: [2, 1], town: 6, slots: [WOOD('#c9965c'), METAL('#8a8a9a'), ACC('#ff9ad2')], cost: { coins: 450, mats: { wood: 6 } }, unlock: { town: 2 }, build: (b) => { for (const x of [-0.85, 0.85]) b.cyl('wood', 0.06, 0.07, 1.9, x, 0, 0, 5); b.box('wood', 1.9, 0.1, 0.1, 0, 1.9, 0); for (const x of [-0.25, 0.25]) b.cyl('metal', 0.01, 0.01, 1.4, x, 0.5, 0, 3); b.box('accent', 0.6, 0.06, 0.25, 0, 0.5, 0); } },
  { id: 'sky_pier', name: '雲海の桟橋', icon: '⚓', cat: 'sky', size: [1, 3], walkable: true, town: 5, slots: [WOOD('#9a6a42'), METAL('#4a4a5a')], cost: { coins: 300, mats: { wood: 8 } }, unlock: {}, build: (b) => { for (let i = 0; i < 9; i++) b.box('wood', 0.9, 0.08, 0.3, 0, 0.02, -1.3 + i * 0.32); for (const z of [-1.3, 1.3]) for (const x of [-0.45, 0.45]) b.cyl('metal', 0.05, 0.05, 0.5, x, -0.3, z, 5); } },

  // ===== furniture & small =====
  { id: 'table', name: 'まるテーブル', icon: '🍽️', cat: 'furniture', size: [1, 1], town: 1, slots: [WOOD('#c9965c'), CLOTH('#ffffff')], cost: { coins: 80, mats: { wood: 2 } }, unlock: {}, build: (b) => { b.cyl('wood', 0.42, 0.42, 0.05, 0, 0.7, 0, 10); b.cyl('wood', 0.05, 0.08, 0.7, 0, 0, 0, 6); b.cyl('cloth', 0.44, 0.44, 0.02, 0, 0.75, 0, 10); } },
  { id: 'chair', name: 'いす', icon: '🪑', cat: 'furniture', size: [1, 1], fn: 'bench', town: 1, slots: [WOOD('#b7814f'), CLOTH('#7fa8d8')], cost: { coins: 60, mats: { wood: 2 } }, unlock: {}, build: (b) => { b.box('wood', 0.45, 0.06, 0.45, 0, 0.42, 0); b.box('cloth', 0.4, 0.05, 0.4, 0, 0.48, 0); b.box('wood', 0.45, 0.5, 0.06, 0, 0.45, -0.2); for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.box('wood', 0.05, 0.42, 0.05, x, 0, z); } },
  { id: 'lamp', name: 'スタンドランプ', icon: '🛋️', cat: 'furniture', size: [1, 1], town: 1, slots: [METAL('#5a4a3a'), CLOTH('#ffe2b0'), GLOW()], cost: { coins: 100, mats: { wood: 1 } }, unlock: {}, build: (b) => { b.cyl('metal', 0.2, 0.22, 0.05, 0, 0, 0, 8); b.cyl('metal', 0.025, 0.025, 1.1, 0, 0, 0, 4); b.sphere('glow', 0.08, 0, 1.1, 0, 1, 1, 1, 0); b.cyl('cloth', 0.14, 0.26, 0.3, 0, 1.05, 0, 8); } },
  { id: 'flower_pot', name: '植木鉢', icon: '🪴', cat: 'furniture', size: [1, 1], town: 1, slots: [S('stone', '鉢', '#c9765a'), LEAF(), FLOWER('#ff6b8a')], cost: { coins: 40 }, unlock: {}, build: (b) => { b.cyl('stone', 0.2, 0.15, 0.3, 0, 0, 0, 8); b.sphere('leaf', 0.22, 0, 0.42, 0, 1, 0.8, 1, 0); b.sphere('flower', 0.08, 0.1, 0.6, 0.05, 1, 1, 1, 0); b.sphere('flower', 0.07, -0.1, 0.55, -0.05, 1, 1, 1, 0); } },
  { id: 'hammock', name: 'ハンモック', icon: '🏝️', cat: 'furniture', size: [3, 1], fn: 'bench', town: 4, slots: [WOOD('#8a5a3a'), CLOTH('#6bc8b8')], cost: { coins: 300, mats: { wood: 6, cotton: 3 } }, unlock: { town: 2 }, build: (b) => { for (const x of [-1.25, 1.25]) b.cyl('wood', 0.07, 0.08, 1.4, x, 0, 0, 5); b.add('cloth', G.torus(1.25, 0.12, Math.PI), 0, 1.35, 0, 0, 0, Math.PI); } },
  { id: 'picnic', name: 'ピクニックシート', icon: '🧺', cat: 'furniture', size: [2, 2], walkable: true, town: 3, slots: [CLOTH('#e8473f'), ACC('#ffffff'), WOOD('#c9965c')], cost: { coins: 150, mats: { cotton: 2 } }, unlock: {}, build: (b) => { for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) b.plane((x + z) % 2 ? 'cloth' : 'accent', 0.42, 0.42, -0.66 + x * 0.44, 0, -0.66 + z * 0.44); b.box('wood', 0.4, 0.25, 0.3, 0.4, 0.04, 0.3); } },
  { id: 'beach_parasol', name: 'パラソル', icon: '⛱️', cat: 'furniture', size: [1, 1], town: 3, slots: [CLOTH('#ff6b6b'), S('cloth2', '布2', '#ffffff'), METAL('#cfcfcf')], cost: { coins: 200, mats: { cotton: 3 } }, unlock: { blueprint: true }, build: (b) => { b.cyl('metal', 0.03, 0.03, 1.8, 0, 0, 0, 4); b.cone('cloth', 0.9, 0.4, 0, 1.6, 0, 8); b.cone('cloth2', 0.5, 0.25, 0, 1.75, 0, 8); } },
  { id: 'barrel', name: 'たる', icon: '🛢️', cat: 'furniture', size: [1, 1], town: 1, slots: [WOOD('#a8754a'), METAL('#5a5a5a')], cost: { coins: 50, mats: { wood: 2 } }, unlock: {}, build: (b) => { b.cyl('wood', 0.3, 0.3, 0.7, 0, 0, 0, 10); b.cyl('metal', 0.315, 0.315, 0.05, 0, 0.12, 0, 10); b.cyl('metal', 0.315, 0.315, 0.05, 0, 0.53, 0, 10); } },
  { id: 'crate', name: '木箱', icon: '📦', cat: 'furniture', size: [1, 1], town: 1, slots: [WOOD('#c9a06a'), TRIM('#8a5a3a')], cost: { coins: 40, mats: { wood: 2 } }, unlock: {}, build: (b) => { b.box('wood', 0.6, 0.6, 0.6, 0, 0, 0); b.box('trim', 0.62, 0.08, 0.62, 0, 0.26, 0); b.box('wood', 0.45, 0.4, 0.45, 0.1, 0.6, 0.05); } },
  { id: 'firefly_jar', name: 'ほたるのびん', icon: '🫙', cat: 'furniture', size: [1, 1], town: 3, slots: [WIN('#d8ffe8'), GLOW('#d4ff5a'), WOOD()], cost: { coins: 200, mats: { glass: 1 } }, unlock: { blueprint: true }, build: (b) => { b.box('wood', 0.5, 0.4, 0.5, 0, 0, 0); b.cyl('window', 0.15, 0.15, 0.35, 0, 0.4, 0, 8); for (let i = 0; i < 3; i++) b.sphere('glow', 0.04, Math.cos(i * 2) * 0.07, 0.5 + i * 0.07, Math.sin(i * 2) * 0.07, 1, 1, 1, 0); } },
  { id: 'paper_lantern', name: 'ちょうちん', icon: '🏮', cat: 'furniture', size: [1, 1], town: 3, slots: [CLOTH('#ff7aa8'), GLOW('#ffd2a8'), WOOD('#3a2a2a')], cost: { coins: 180, mats: { wood: 2, cotton: 1 } }, unlock: { blueprint: true }, build: (b) => { b.cyl('wood', 0.04, 0.04, 1.6, -0.25, 0, 0, 4); b.box('wood', 0.5, 0.04, 0.04, 0, 1.6, 0); b.sphere('cloth', 0.2, 0.1, 1.3, 0, 1, 1.3, 1, 1); b.sphere('glow', 0.1, 0.1, 1.3, 0, 1, 1, 1, 0); } },
  { id: 'bird_house', name: '巣箱', icon: '🐦', cat: 'furniture', size: [1, 1], town: 3, slots: [WOOD('#c9965c'), ROOF('#e8735c'), TRIM('#3a2a2a')], cost: { coins: 150, mats: { wood: 3 } }, unlock: { blueprint: true }, build: (b) => { b.cyl('wood', 0.04, 0.05, 1.4, 0, 0, 0, 4); b.box('wood', 0.35, 0.35, 0.35, 0, 1.4, 0); b.gable('roof', 0.45, 0.2, 0.45, 0, 1.75, 0); b.cyl('trim', 0.06, 0.06, 0.02, 0, 1.6, 0.18, 8); } },
  { id: 'beehive', name: 'みつばちの巣箱', icon: '🐝', cat: 'furniture', size: [1, 1], fn: 'farm', income: 20, town: 4, slots: [WOOD('#ffe08a'), ROOF('#c99a3a'), TRIM('#8a5a3a')], cost: { coins: 250, mats: { wood: 4 } }, unlock: { blueprint: true }, build: (b) => { b.box('trim', 0.5, 0.3, 0.5, 0, 0, 0); for (let i = 0; i < 3; i++) b.box('wood', 0.45, 0.2, 0.45, 0, 0.3 + i * 0.21, 0); b.box('roof', 0.55, 0.08, 0.55, 0, 0.93, 0); } },
  { id: 'snowman', name: '雪だるま', icon: '⛄', cat: 'furniture', size: [1, 1], town: 3, slots: [WALL('#ffffff'), ACC('#ff6b3a'), CLOTH('#3a6abf')], cost: { coins: 100 }, unlock: { blueprint: true }, build: (b) => { b.sphere('wall', 0.38, 0, 0.35, 0, 1, 1, 1, 1); b.sphere('wall', 0.27, 0, 0.9, 0, 1, 1, 1, 1); b.cone('accent', 0.05, 0.2, 0, 0.88, 0.32, 5); b.torus('cloth', 0.2, 0.05, 0, 0.72, 0, Math.PI / 2); } },
  { id: 'ice_sculpture', name: '氷の彫刻', icon: '🧊', cat: 'furniture', size: [1, 1], town: 5, slots: [WIN('#bfe6ff'), STONE('#e0e8f0')], cost: { coins: 400, mats: { glass: 2 } }, unlock: { blueprint: true }, build: (b) => { b.box('stone', 0.6, 0.3, 0.6, 0, 0, 0); b.sphere('window', 0.3, 0, 0.65, 0, 1, 1.3, 1, 0); b.cone('window', 0.18, 0.5, 0, 1.0, 0, 5); } },
  { id: 'moon_deck', name: 'お月見台', icon: '🎑', cat: 'furniture', size: [2, 2], fn: 'bench', town: 8, slots: [WOOD('#c9a06a'), CLOTH('#c94a4a'), ACC('#ffffff'), S('leaf', 'すすき', '#d8c88a')], cost: { coins: 600, mats: { wood: 10 } }, unlock: { blueprint: true }, build: (b) => { b.box('wood', 1.8, 0.35, 1.8, 0, 0, 0); b.box('cloth', 1.4, 0.04, 0.9, 0, 0.35, 0); b.cyl('wood', 0.2, 0.15, 0.15, 0.4, 0.39, -0.4, 6); for (let i = 0; i < 3; i++) b.sphere('accent', 0.07, 0.4 + (i - 1) * 0.08, 0.6, -0.4, 1, 1, 1, 0); for (let i = 0; i < 4; i++) b.cyl('leaf', 0.015, 0.015, 0.9, -0.6 + i * 0.05, 0.35, -0.65, 3); } },
  { id: 'campfire', name: 'たき火', icon: '🔥', cat: 'furniture', size: [1, 1], town: 2, slots: [WOOD('#7a4a2a'), GLOW('#ff8a3a'), STONE()], cost: { coins: 80, mats: { wood: 3 } }, unlock: {}, build: (b) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.sphere('stone', 0.1, Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35, 1, 0.7, 1, 0); } for (let i = 0; i < 3; i++) b.box('wood', 0.5, 0.08, 0.08, 0, 0.05, 0, (i * Math.PI) / 3); b.cone('glow', 0.18, 0.45, 0, 0.1, 0, 6); } },
  { id: 'signpost', name: '道しるべ', icon: '🪧', cat: 'furniture', size: [1, 1], town: 1, slots: [WOOD('#a8754a'), ACC('#fff4d8')], cost: { coins: 50, mats: { wood: 2 } }, unlock: {}, build: (b) => { b.cyl('wood', 0.04, 0.05, 1.4, 0, 0, 0, 4); b.box('accent', 0.6, 0.18, 0.04, 0.2, 1.15, 0); b.box('accent', 0.55, 0.16, 0.04, -0.15, 0.9, 0, 0.3); } },
  { id: 'kitchen_counter', name: '屋外キッチン', icon: '🍳', cat: 'furniture', size: [2, 1], fn: 'kitchen', town: 4, slots: [WOOD('#c9965c'), STONE('#e8e4dc'), METAL('#4a4a5a'), ACC('#e8735c')], cost: { coins: 300, mats: { wood: 4, stone: 4 } }, unlock: {}, build: (b) => { b.box('wood', 1.7, 0.8, 0.7, 0, 0, 0); b.box('stone', 1.8, 0.07, 0.78, 0, 0.8, 0); b.cyl('metal', 0.18, 0.18, 0.1, -0.4, 0.87, 0, 10); b.cyl('accent', 0.15, 0.12, 0.25, 0.4, 0.87, 0, 10); } },
  { id: 'sell_box', name: '出荷箱', icon: '📦', cat: 'furniture', size: [1, 1], fn: 'sell', town: 1, slots: [WOOD('#c9a06a'), ACC('#5a8fd8')], cost: { coins: 100, mats: { wood: 3 } }, unlock: {}, build: (b) => { b.box('wood', 0.8, 0.55, 0.6, 0, 0, 0); b.box('accent', 0.84, 0.08, 0.64, 0, 0.55, 0); b.box('accent', 0.3, 0.12, 0.04, 0, 0.35, 0.31); } },
  { id: 'star_bench', name: '星見のベンチ', icon: '🌙', cat: 'furniture', size: [2, 1], fn: 'starhill', town: 4, slots: [WOOD('#5a6a9a'), GLOW('#ffe27a'), METAL('#3a3a5a')], cost: { coins: 250, mats: { wood: 4, stardust: 1 } }, unlock: {}, build: (b) => { b.box('wood', 1.6, 0.07, 0.5, 0, 0.42, 0); b.box('wood', 1.6, 0.3, 0.06, 0, 0.5, -0.25, 0); for (const x of [-0.7, 0.7]) b.box('metal', 0.07, 0.45, 0.5, x, 0, 0); b.sphere('glow', 0.06, -0.5, 0.9, -0.25, 1, 1, 1, 0); b.sphere('glow', 0.05, 0.4, 0.88, -0.25, 1, 1, 1, 0); } },
  { id: 'telescope', name: '望遠鏡', icon: '🔭', cat: 'furniture', size: [1, 1], fn: 'starhill', town: 3, slots: [METAL('#c9a04a'), WOOD('#5a3a2a')], cost: { coins: 350, mats: { glass: 1, wood: 2 } }, unlock: { town: 2 }, build: (b) => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; b.cyl('wood', 0.025, 0.025, 1.0, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, 4); } b.cyl('metal', 0.08, 0.12, 0.9, 0, 1.0, 0, 8); } },
  { id: 'cushion_pile', name: 'クッションの山', icon: '🛋️', cat: 'furniture', size: [1, 1], fn: 'bench', town: 2, slots: [CLOTH('#ffb6c9'), S('cloth2', '布2', '#b6d8ff'), ACC('#fff0a0')], cost: { coins: 120, mats: { cotton: 3 } }, unlock: {}, build: (b) => { b.sphere('cloth', 0.35, 0, 0.18, 0, 1, 0.45, 1, 1); b.sphere('cloth2', 0.28, 0.15, 0.36, 0.05, 1, 0.45, 1, 1); b.sphere('accent', 0.2, -0.1, 0.52, 0, 1, 0.5, 1, 1); } },

  // ===== farm =====
  { id: 'field', name: '畑', icon: '🟫', cat: 'farm', size: [1, 1], fn: 'farm', walkable: true, town: 1, slots: [S('soil', '土', '#7a5236'), LEAF()], cost: { coins: 40 }, unlock: {}, build: (b) => { b.box('soil', 0.94, 0.12, 0.94, 0, 0, 0); for (let i = 0; i < 3; i++) b.box('soil', 0.9, 0.06, 0.12, 0, 0.12, -0.3 + i * 0.3); } },
  { id: 'scarecrow', name: 'かかし', icon: '🧑‍🌾', cat: 'farm', size: [1, 1], town: 2, slots: [CLOTH('#c94a4a'), WOOD(), S('hat', '帽子', '#e8c86a'), WALL('#fff0d8')], cost: { coins: 120, mats: { wood: 3, cotton: 1 } }, unlock: {}, build: (b) => { b.cyl('wood', 0.04, 0.04, 1.6, 0, 0, 0, 4); b.box('wood', 1.0, 0.06, 0.06, 0, 1.1, 0); b.box('cloth', 0.45, 0.55, 0.25, 0, 0.75, 0); b.sphere('wall', 0.2, 0, 1.55, 0, 1, 1, 1, 0); b.cone('hat', 0.32, 0.25, 0, 1.68, 0, 8); } },
  { id: 'compost', name: 'たい肥箱', icon: '♻️', cat: 'farm', size: [1, 1], fn: 'farm', income: 10, town: 1, slots: [WOOD('#8a5a3a'), S('soil', '土', '#5a3a26')], cost: { coins: 100, mats: { wood: 4 } }, unlock: { town: 2 }, build: (b) => { b.box('wood', 0.8, 0.5, 0.8, 0, 0, 0); b.box('soil', 0.7, 0.05, 0.7, 0, 0.5, 0); } },
  { id: 'water_tank', name: '雨水タンク', icon: '🛢️', cat: 'farm', size: [1, 1], fn: 'farm', income: 10, town: 2, slots: [WOOD('#8aa8c8'), METAL('#4a5a6a'), WATER()], cost: { coins: 200, mats: { wood: 4, stone: 2 } }, unlock: { town: 3 }, build: (b) => { b.cyl('wood', 0.38, 0.38, 0.9, 0, 0.3, 0, 10); for (let i = 0; i < 4; i++) b.cyl('metal', 0.03, 0.03, 0.3, Math.cos(i * 1.57) * 0.3, 0, Math.sin(i * 1.57) * 0.3, 4); b.cyl('water', 0.34, 0.34, 0.03, 0, 1.2, 0, 10); } },
];
