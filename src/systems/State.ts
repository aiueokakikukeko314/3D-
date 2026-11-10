import { events, toast } from '../core/events';
import { levelFromXp } from '../core/levels';
import { storage } from '../core/Platform';
import { getItem, type Taste } from '../data/items';
import type { PatternId } from '../build/materials';
import { RECIPES } from '../data/recipes';
import { BUILDINGS } from '../data/buildings';
import { STARTER_RESIDENTS } from '../data/residents';

export type Skill = 'fishing' | 'cooking' | 'gathering' | 'gardening' | 'building' | 'stars' | 'puzzle';
export const SKILL_LABEL: Record<Skill, string> = {
  fishing: '釣り',
  cooking: '料理',
  gathering: '採集',
  gardening: '園芸',
  building: '建築',
  stars: '星集め',
  puzzle: '花パズル',
};

export interface PlacedBuilding {
  uid: number;
  type: string;
  x: number; // grid cell (top-left of footprint, in rotated space)
  z: number;
  rot: number; // 0..3
  level: number;
  colors: Record<string, string>;
  patterns: Record<string, { p: PatternId; c2: string }>;
  owner?: string; // resident id or 'player'
  crop?: { id: string; planted: number; watered: number; stage?: number };
  harvestDay?: string;
}

export interface ResidentState {
  id: string;
  xp: number;
  home?: number;
  joined: string;
  feedDay?: string;
  feedCount: number;
  talkDay?: string;
  giftDay?: string;
  rewardedLv: number;
}

export interface VisitorState {
  id: string;
  kind: 'resident' | 'spirit';
  talks: number;
  done?: boolean;
}

export interface PetState {
  id: number;
  name: string;
  xp: number;
  fullness: number; // 0..100
  traits: Record<Taste, number>;
  body: string;
  accent: string;
  pattern: PatternId;
  bornDay: string;
  petDay?: string;
  petCount: number;
  lastFed: number;
}

export interface SaveData {
  version: number;
  seed: number;
  created: number;
  lastPlayed: number;
  coins: number;
  inv: Record<string, number>;
  skills: Record<Skill, number>;
  lighthouseXp: number;
  fuelDay: string;
  fuelTonight: number;
  lastFuel: number; // fuel of the previous lit night (used for visitors)
  lastDay: string;
  islands: number;
  buildings: PlacedBuilding[];
  nextUid: number;
  residents: ResidentState[];
  visitors: VisitorState[];
  visitorDay: string;
  travelerCount: number;
  pets: PetState[];
  nextPetId: number;
  dex: Record<string, number>;
  spiritsMet: string[];
  spiritDone: Record<string, string>;
  blueprints: string[];
  recipes: string[];
  palette: string[];
  flowerColors: string[];
  puzzleLevel: number;
  collectDay: string;
  collected: string[];
  removedProps: string[];
  propHarvest: Record<string, string>;
  player: { shirt: string; pants: string; hat: string; hair: string; pattern: PatternId; x: number; z: number };
  stats: Record<string, number>;
  townBest: number;
  eventDay?: string;
}

const KEY = 'kumoumi.save.v1';
const VERSION = 1;

export function newSave(): SaveData {
  const now = Date.now();
  return {
    version: VERSION,
    seed: Math.floor(Math.random() * 1e9),
    created: now,
    lastPlayed: now,
    coins: 500,
    inv: { wood: 10, stone: 6, cotton: 4, seed_cloudberry: 4, seed_skywheat: 4, cloudberry: 2, f_kumohaze: 1 },
    skills: { fishing: 0, cooking: 0, gathering: 0, gardening: 0, building: 0, stars: 0, puzzle: 0 },
    lighthouseXp: 0,
    fuelDay: '',
    fuelTonight: 0,
    lastFuel: 0,
    lastDay: '',
    islands: 0,
    buildings: [],
    nextUid: 1,
    residents: [],
    visitors: [],
    visitorDay: '',
    travelerCount: 0,
    pets: [],
    nextPetId: 1,
    dex: {},
    spiritsMet: [],
    spiritDone: {},
    blueprints: [],
    recipes: RECIPES.filter((r) => r.starter).map((r) => r.id),
    palette: ['#ffffff', '#ff8fb8', '#8fd0ff', '#ffe27a'],
    flowerColors: ['red', 'yellow', 'blue', 'white'],
    puzzleLevel: 1,
    collectDay: '',
    collected: [],
    removedProps: [],
    propHarvest: {},
    player: { shirt: '#6fb5ff', pants: '#3f4a6a', hat: '#ffcf5a', hair: '#5a3a2a', pattern: 'none', x: 0, z: 4 },
    stats: {},
    townBest: 0,
  };
}

class GameState {
  d: SaveData = newSave();
  dirty = false;

  async load(): Promise<boolean> {
    const raw = await storage.get(KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = newSave();
      this.d = { ...base, ...parsed, skills: { ...base.skills, ...(parsed.skills ?? {}) }, player: { ...base.player, ...(parsed.player ?? {}) } } as SaveData;
      return true;
    } catch (e) {
      console.warn('save parse failed', e);
      return false;
    }
  }

  async save(): Promise<void> {
    this.d.lastPlayed = Date.now();
    await storage.set(KEY, JSON.stringify(this.d));
    this.dirty = false;
  }

  async reset(): Promise<void> {
    await storage.remove(KEY);
  }

  markDirty(): void {
    this.dirty = true;
  }

  // ---------- inventory ----------
  count(id: string): number {
    return this.d.inv[id] ?? 0;
  }

  add(id: string, n = 1, silent = false): void {
    this.d.inv[id] = (this.d.inv[id] ?? 0) + n;
    const def = getItem(id);
    if (['fish', 'star', 'flower', 'crop', 'treasure', 'dish'].includes(def.cat)) {
      const key = id.startsWith('dish:') ? id.split(':').slice(0, 2).join(':') : id;
      const first = !this.d.dex[key];
      this.d.dex[key] = (this.d.dex[key] ?? 0) + n;
      if (first && !silent) toast(`図鑑に登録: ${def.name}`, '📖');
    }
    if (!silent) toast(`${def.name} を手に入れた${n > 1 ? ` ×${n}` : ''}`, def.icon);
    this.markDirty();
    events.emit('inventoryChanged');
  }

  remove(id: string, n = 1): boolean {
    const c = this.count(id);
    if (c < n) return false;
    if (c === n) delete this.d.inv[id];
    else this.d.inv[id] = c - n;
    this.markDirty();
    events.emit('inventoryChanged');
    return true;
  }

  addCoins(n: number, silent = false): void {
    this.d.coins = Math.max(0, this.d.coins + n);
    if (!silent && n > 0) toast(`${n} 灯貨 を手に入れた`, '🪙');
    this.markDirty();
    events.emit('coinsChanged');
  }

  canAfford(cost: { coins: number; mats?: Record<string, number> }): boolean {
    if (this.d.coins < cost.coins) return false;
    for (const [k, v] of Object.entries(cost.mats ?? {})) if (this.count(k) < v) return false;
    return true;
  }

  pay(cost: { coins: number; mats?: Record<string, number> }): boolean {
    if (!this.canAfford(cost)) return false;
    this.d.coins -= cost.coins;
    for (const [k, v] of Object.entries(cost.mats ?? {})) this.remove(k, v);
    events.emit('coinsChanged');
    this.markDirty();
    return true;
  }

  stat(key: string, n = 1): void {
    this.d.stats[key] = (this.d.stats[key] ?? 0) + n;
  }

  // ---------- skills / levels ----------
  skillLevel(s: Skill): number {
    return levelFromXp(this.d.skills[s], 0.5).level;
  }

  addSkill(s: Skill, xp: number): void {
    const before = this.skillLevel(s);
    this.d.skills[s] += Math.max(0, Math.floor(xp));
    const after = this.skillLevel(s);
    if (after > before) events.emit('levelUp', { kind: 'skill', level: after, label: `${SKILL_LABEL[s]}の熟練度` });
    this.markDirty();
  }

  lighthouseLevel(): number {
    return levelFromXp(this.d.lighthouseXp).level;
  }

  isUnlocked(defId: string, townLevel: number): boolean {
    const def = BUILDINGS.find((b) => b.id === defId);
    if (!def) return false;
    const u = def.unlock;
    if (u.blueprint && !this.d.blueprints.includes(defId)) return false;
    if (u.town && townLevel < u.town) return false;
    if (u.lighthouse && this.lighthouseLevel() < u.lighthouse) return false;
    return true;
  }

  resident(id: string): ResidentState | undefined {
    return this.d.residents.find((r) => r.id === id);
  }

  building(uid: number): PlacedBuilding | undefined {
    return this.d.buildings.find((b) => b.uid === uid);
  }
}

export const gs = new GameState();

export { STARTER_RESIDENTS };
