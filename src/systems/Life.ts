import { events, toast } from '../core/events';
import { clock } from '../core/Clock';
import { levelFromXp } from '../core/levels';
import { Rng, hashString } from '../core/rng';
import { getItem, isFood, type Taste, SEED_TO_CROP } from '../data/items';
import { RECIPES } from '../data/recipes';
import { BUILDINGS } from '../data/buildings';
import { RESIDENTS, getResident, proceduralResident, STARTER_RESIDENTS } from '../data/residents';
import { SPIRITS, getSpirit } from '../data/spirits';
import { feedLine } from '../data/dialogue';
import { getBuildingDef } from '../build/Placeable';
import { gs, type PetState, type PlacedBuilding } from './State';
import { audio } from '../core/Audio';
import { activeFestival, festivalKey } from '../data/festivals';

export function claimFestival(): string | null {
  const f = activeFestival();
  if (!f) return null;
  const key = festivalKey(f);
  if (gs.d.eventDay === key) return `${f.icon} ${f.name}のおみやげはもう受け取ったよ。おまつりを楽しんでね！`;
  gs.d.eventDay = key;
  for (const r of f.reward) gs.add(r.item, r.n, true);
  gs.addCoins(f.coins, true);
  for (const r of gs.d.residents) addFriendship(r.id, 30);
  audio.sfx('success');
  gs.markDirty();
  return `${f.icon} ${f.name}のおみやげ：${f.reward.map((r) => getItem(r.item).name + '×' + r.n).join('、')} と ${f.coins} 灯貨！住民みんなとなかよしになった。`;
}

export const friendLevel = (xp: number) => levelFromXp(xp, 0.5);
export const petLevel = (xp: number) => levelFromXp(xp, 0.6);

export function townRating(): number {
  let r = 0;
  const types = new Set<string>();
  for (const b of gs.d.buildings) {
    const def = getBuildingDef(b.type);
    r += def.town * (1 + 0.25 * (b.level - 1));
    types.add(b.type);
  }
  r += types.size * 4;
  r += gs.d.residents.length * 15;
  for (const res of gs.d.residents) r += friendLevel(res.xp).level * 2;
  r += gs.d.pets.length * 10;
  return Math.floor(r);
}

export function townLevel(): number {
  return levelFromXp(townRating() * 4, 0.6).level;
}

// ---------- feeding ----------
export interface FeedResult {
  text: string;
  xp: number;
  kind: 'fav' | 'like' | 'ok' | 'dislike' | 'full';
}

export function feedResident(id: string, itemId: string): FeedResult {
  const r = gs.resident(id);
  const def = getResident(id);
  const today = clock.dayKey();
  if (r) {
    if (r.feedDay !== today) {
      r.feedDay = today;
      r.feedCount = 0;
    }
    if (r.feedCount >= 3) return { text: feedLine('full', def), xp: 0, kind: 'full' };
  }
  const item = getItem(itemId);
  if (!isFood(itemId) || !gs.remove(itemId, 1)) return { text: '……？', xp: 0, kind: 'ok' };
  let mult = 1;
  let kind: FeedResult['kind'] = 'ok';
  if (itemId === def.favorite) {
    mult = 3;
    kind = 'fav';
  } else if (item.taste === def.likes) {
    mult = 2;
    kind = 'like';
  } else if (item.taste === def.dislikes) {
    mult = 0.5;
    kind = 'dislike';
  }
  if (item.cat === 'dish') mult *= 1.5;
  const xp = Math.floor((item.food ?? 5) * 4 * mult);
  if (r) {
    r.feedCount++;
    addFriendship(id, xp);
  }
  gs.stat('fed');
  return { text: feedLine(kind, def), xp, kind };
}

export function addFriendship(id: string, xp: number): void {
  const r = gs.resident(id);
  if (!r) return;
  const before = friendLevel(r.xp).level;
  r.xp += xp;
  const after = friendLevel(r.xp).level;
  gs.markDirty();
  if (after > before) {
    const def = getResident(id);
    events.emit('levelUp', { kind: 'friend', level: after, label: `${def.name}となかよし` });
    for (let lv = before + 1; lv <= after; lv++) residentReward(id, lv);
    events.emit('residentsChanged');
  }
}

/** Rewards when friendship reaches a level (unlimited). */
function residentReward(id: string, lv: number): void {
  const def = getResident(id);
  const r = gs.resident(id)!;
  r.rewardedLv = Math.max(r.rewardedLv, lv);
  const rng = new Rng(hashString(id + lv));
  // house grows every 4 levels
  if (lv % 4 === 0 && r.home !== undefined) {
    const h = gs.building(r.home);
    if (h) {
      h.level++;
      events.emit('buildingsChanged');
      toast(`${def.name}の家が増築された！（Lv.${h.level}）`, '🏠');
    }
  }
  if (lv % 3 === 0) {
    const lockedRecipes = RECIPES.filter((x) => !gs.d.recipes.includes(x.id));
    const lockedBp = BUILDINGS.filter((b) => b.unlock.blueprint && !gs.d.blueprints.includes(b.id));
    if (lockedRecipes.length && (rng.chance(0.5) || !lockedBp.length)) {
      const rec = rng.pick(lockedRecipes);
      gs.d.recipes.push(rec.id);
      toast(`${def.name}から「${rec.name}」のレシピを教わった！`, '📜');
      return;
    }
    if (lockedBp.length) {
      const bp = rng.pick(lockedBp);
      gs.d.blueprints.push(bp.id);
      toast(`${def.name}から「${bp.name}」の設計図をもらった！`, '📐');
      return;
    }
  }
  const coins = 50 + lv * 20;
  gs.addCoins(coins, true);
  toast(`${def.name}からお礼に ${coins} 灯貨`, '🎁');
}

export function talkResident(id: string): number {
  const r = gs.resident(id);
  if (!r) return 0;
  const today = clock.dayKey();
  if (r.talkDay === today) return 0;
  r.talkDay = today;
  addFriendship(id, 25);
  return 25;
}

export function giftResident(id: string, itemId: string): number {
  const r = gs.resident(id);
  if (!r) return 0;
  const today = clock.dayKey();
  if (r.giftDay === today) return -1;
  const item = getItem(itemId);
  if (!gs.remove(itemId, 1)) return 0;
  r.giftDay = today;
  const xp = Math.floor(20 + item.price * 0.5);
  addFriendship(id, xp);
  return xp;
}

// ---------- pets ----------
export function feedPet(p: PetState, itemId: string): string {
  const item = getItem(itemId);
  if (!isFood(itemId)) return 'たべられないみたい';
  // digest over real time (about 12% per hour)
  const hours = (Date.now() - p.lastFed) / 3600_000;
  if (hours > 0) p.fullness = Math.max(0, p.fullness - hours * 12);
  if (p.fullness >= 100) return 'おなかいっぱいみたい。少し遊んでからね';
  if (!gs.remove(itemId, 1)) return '';
  const before = petLevel(p.xp).level;
  const food = item.food ?? 5;
  p.fullness = Math.min(100, p.fullness + food * 1.5);
  p.xp += Math.floor(food * (item.cat === 'dish' ? 16 : 9));
  const t = (item.taste ?? 'sweet') as Taste;
  p.traits[t] = (p.traits[t] ?? 0) + food;
  p.lastFed = Date.now();
  gs.markDirty();
  const after = petLevel(p.xp).level;
  if (after > before) onPetLevel(p, before, after);
  events.emit('residentsChanged');
  return 'もぐもぐ…うれしそう！';
}

export function petPet(p: PetState): string {
  const today = clock.dayKey();
  if (p.petDay !== today) {
    p.petDay = today;
    p.petCount = 0;
  }
  if (p.petCount >= 5) return 'ねむそうにしている…';
  p.petCount++;
  const before = petLevel(p.xp).level;
  p.xp += 40;
  const after = petLevel(p.xp).level;
  if (after > before) onPetLevel(p, before, after);
  gs.markDirty();
  return 'ふわふわ…きもちよさそう';
}

function onPetLevel(p: PetState, before: number, after: number): void {
  events.emit('levelUp', { kind: 'pet', level: after, label: `${p.name}が成長` });
  if (before < 5 && after >= 5) toast(`${p.name}がたまごから生まれた！こぐもになった！`, '🐣');
  if (before < 15 && after >= 15) toast(`${p.name}が大人になった！`, '✨');
  // new eggs at milestones (unlimited pets)
  const milestones = [10, 25, 45, 70, 100];
  for (const m of milestones) if (before < m && after >= m) layEgg();
  if (after > 100 && Math.floor(after / 50) > Math.floor(before / 50)) layEgg();
  events.emit('residentsChanged');
}

const PET_NAMES = ['モチ', 'フワ', 'ポコ', 'ソラ', 'クゥ', 'ミル', 'ピノ', 'ルル', 'タマ', 'ユメ', 'ホシ', 'ナギ'];
export function layEgg(): PetState {
  const rng = new Rng(gs.d.nextPetId * 97 + gs.d.seed);
  const hue = rng.float();
  const p: PetState = {
    id: gs.d.nextPetId++,
    name: PET_NAMES[(gs.d.nextPetId - 2) % PET_NAMES.length] + (gs.d.nextPetId > PET_NAMES.length + 1 ? String(Math.floor(gs.d.nextPetId / PET_NAMES.length)) : ''),
    xp: 0,
    fullness: 60,
    traits: { sweet: 0, sea: 0, star: 0, flower: 0 },
    body: gs.d.pets.length === 0 ? '#ffffff' : `hsl(${Math.floor(hue * 360)}, 70%, 92%)`,
    accent: gs.d.pets.length === 0 ? '#ffb6d0' : `hsl(${Math.floor(hue * 360 + 40)}, 70%, 75%)`,
    pattern: 'none',
    bornDay: clock.dayKey(),
    petCount: 0,
    lastFed: Date.now(),
  };
  p.body = cssToHex(p.body);
  p.accent = cssToHex(p.accent);
  gs.d.pets.push(p);
  if (gs.d.pets.length > 1) toast(`ソラモチのたまご「${p.name}」が生まれた！`, '🥚');
  gs.markDirty();
  return p;
}

function cssToHex(c: string): string {
  if (c.startsWith('#')) return c;
  const m = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(c);
  if (!m) return '#ffffff';
  const h = (Number(m[1]) % 360) / 360,
    s = Number(m[2]) / 100,
    l = Number(m[3]) / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ---------- lighthouse ----------
export function addFuel(itemId: string, n: number): number {
  const item = getItem(itemId);
  const fuel = (item.fuel ?? 0) * n;
  if (fuel <= 0 || !gs.remove(itemId, n)) return 0;
  const today = clock.dayKey();
  if (gs.d.fuelDay !== today) {
    gs.d.fuelDay = today;
    gs.d.fuelTonight = 0;
  }
  gs.d.fuelTonight += fuel;
  const before = gs.lighthouseLevel();
  gs.d.lighthouseXp += fuel * 8;
  const after = gs.lighthouseLevel();
  gs.markDirty();
  audio.sfx('light');
  if (after > before) {
    events.emit('levelUp', { kind: 'lighthouse', level: after, label: '灯台' });
    for (let i = before; i < after; i++) {
      gs.d.islands++;
      events.emit('islandAdded', { index: gs.d.islands });
    }
  }
  return fuel;
}

// ---------- day processing ----------
export function ensureStarter(): void {
  if (gs.d.residents.length || gs.d.buildings.length) return;
  const day = clock.dayKey();
  const place = (type: string, x: number, z: number, rot = 0, owner?: string): PlacedBuilding => {
    const pb: PlacedBuilding = { uid: gs.d.nextUid++, type, x, z, rot, level: 1, colors: {}, patterns: {}, owner };
    gs.d.buildings.push(pb);
    return pb;
  };
  place('cottage', -7, -3, 0, 'player');
  const t1 = place('tent', 4, -5, 0);
  const t2 = place('tent', 7, -1, 0);
  place('kitchen_counter', -3, 1);
  place('sell_box', -4, -2);
  place('flowerbed', 2, 2);
  place('star_bench', -1, 8);
  place('bench', 3, 5);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) place('field', -7 + i, 3 + j);
  for (let z = -9; z <= 6; z++) place('path_stone', -1, z);
  place('street_lamp', 0, -6);
  place('notice_board', 1, -9);
  STARTER_RESIDENTS.forEach((id, i) => {
    gs.d.residents.push({ id, xp: 0, home: i === 0 ? t1.uid : t2.uid, joined: day, feedCount: 0, rewardedLv: 1 });
    (i === 0 ? t1 : t2).owner = id;
  });
  layEgg();
  gs.d.lastDay = day;
  gs.d.visitorDay = day;
  gs.markDirty();
}

/** Called on load and whenever the logical day changes. */
export function processNewDay(): string[] {
  const today = clock.dayKey();
  const msgs: string[] = [];
  if (gs.d.lastDay === today) return msgs;
  const prev = gs.d.lastDay;
  const daysPassed = prev ? Math.max(1, Math.min(30, Math.round((Date.parse(today) - Date.parse(prev)) / 86400000))) : 1;
  gs.d.lastDay = today;
  gs.stat('days', 1);

  // shop income
  let income = 0;
  for (const b of gs.d.buildings) {
    const def = getBuildingDef(b.type);
    if (def.income) income += Math.floor(def.income * (1 + (b.level - 1) * 0.5) * (1 + gs.d.residents.length * 0.03));
  }
  income *= Math.min(daysPassed, 7);
  const fest = activeFestival();
  if (fest) income *= 2;
  if (income > 0) {
    gs.addCoins(income, true);
    msgs.push(`お店の売り上げ ${income} 灯貨が届いた`);
  }

  // pets get a little hungry, never sick
  for (const p of gs.d.pets) p.fullness = Math.max(10, p.fullness - 25 * daysPassed);

  // lighthouse visitors (based on last lit night)
  const wasLit = gs.d.fuelDay === prev && gs.d.fuelTonight > 0;
  const fuel = wasLit ? gs.d.fuelTonight : 0;
  gs.d.lastFuel = fuel;
  gs.d.visitors = gs.d.visitors.filter((v) => !v.done && v.kind === 'resident' && v.talks > 0).slice(0, 2);
  const count = (wasLit ? Math.min(6, 1 + Math.floor(fuel / 12)) : Math.random() < 0.5 ? 1 : 0) + (fest ? 2 : 0);
  const rng = new Rng(hashString('visit' + today + gs.d.seed));
  const season = clock.season();
  const yearSeason = today.slice(0, 4) + season;
  for (let i = 0; i < count; i++) {
    const spiritPool = SPIRITS.filter((s) => s.season === season && gs.d.spiritDone[s.id] !== yearSeason && !gs.d.visitors.some((v) => v.id === s.id));
    if (spiritPool.length && rng.chance(wasLit ? 0.45 : 0.2)) {
      const sp = rng.pick(spiritPool);
      gs.d.visitors.push({ id: sp.id, kind: 'spirit', talks: 0 });
      continue;
    }
    const resPool = RESIDENTS.filter((r) => !gs.resident(r.id) && !gs.d.visitors.some((v) => v.id === r.id));
    let id: string;
    if (resPool.length && rng.chance(0.85)) id = rng.pick(resPool).id;
    else id = proceduralResident(gs.d.travelerCount++).id;
    gs.d.visitors.push({ id, kind: 'resident', talks: 0 });
  }
  if (fest) msgs.push(`${fest.icon} 今日は「${fest.name}」！${fest.desc} 掲示板でおまつりのおみやげをもらおう`);
  if (gs.d.visitors.length) msgs.push(wasLit ? `灯台の光に導かれて ${gs.d.visitors.length} 人の旅人が島に来ている` : '旅人が島に立ち寄っている');
  gs.d.visitorDay = today;
  gs.d.fuelTonight = 0;
  gs.d.fuelDay = '';
  gs.markDirty();
  events.emit('dayChanged', { dayKey: today });
  return msgs;
}

// ---------- visitors ----------
export function emptyHomes(): PlacedBuilding[] {
  return gs.d.buildings.filter((b) => getBuildingDef(b.type).fn === 'home' && !b.owner);
}

export function inviteVisitor(id: string): string {
  const v = gs.d.visitors.find((x) => x.id === id);
  if (!v || v.kind !== 'resident') return '';
  const homes = emptyHomes();
  if (!homes.length) return 'すみたいけど…空いているおうちがないみたい。家を建ててね！';
  const home = homes[0];
  home.owner = id;
  gs.d.residents.push({ id, xp: 60, home: home.uid, joined: clock.dayKey(), feedCount: 0, rewardedLv: 1 });
  v.done = true;
  gs.markDirty();
  events.emit('residentsChanged');
  events.emit('buildingsChanged');
  const def = getResident(id);
  toast(`${def.name}が島に引っ越してきた！`, '🎉');
  audio.sfx('success');
  return `わあい！きょうからここに住むね。よろしく${def.phrase ? '、' + def.phrase : ''}！`;
}

export function fulfillSpirit(id: string): string | null {
  const sp = getSpirit(id);
  if (!sp) return null;
  const want = sp.want;
  // gather items matching
  const candidates = Object.keys(gs.d.inv).filter((k) => (want.id ? k === want.id : getItem(k).cat === want.cat));
  let have = 0;
  for (const k of candidates) have += gs.count(k);
  if (have < want.n) return null;
  let need = want.n;
  for (const k of candidates) {
    const take = Math.min(need, gs.count(k));
    gs.remove(k, take);
    need -= take;
    if (need <= 0) break;
  }
  gs.d.spiritDone[sp.id] = clock.dayKey().slice(0, 4) + sp.season;
  if (!gs.d.spiritsMet.includes(sp.id)) gs.d.spiritsMet.push(sp.id);
  const v = gs.d.visitors.find((x) => x.id === id);
  if (v) v.done = true;
  gs.addCoins(sp.reward.coins, true);
  let msg = `お礼に ${sp.reward.coins} 灯貨`;
  if (sp.reward.blueprint && !gs.d.blueprints.includes(sp.reward.blueprint)) {
    gs.d.blueprints.push(sp.reward.blueprint);
    const bd = getBuildingDef(sp.reward.blueprint);
    msg += `と「${bd.name}」の設計図`;
  }
  if (sp.reward.color && !gs.d.palette.includes(sp.reward.color)) {
    gs.d.palette.push(sp.reward.color);
    msg += 'と特別な色';
  }
  toast(`${sp.title}${sp.name}：${msg}をもらった！`, '✨');
  audio.sfx('success');
  gs.markDirty();
  events.emit('residentsChanged');
  return msg;
}

// ---------- farming ----------
const STAGE_HOURS = 3; // hours per growth stage (real time)

export function updateCrops(): PlacedBuilding[] {
  const changed: PlacedBuilding[] = [];
  const now = Date.now();
  for (const b of gs.d.buildings) {
    if (!b.crop) continue;
    const bonus = 1 + gardenBonus();
    const wateredBonus = b.crop.watered > b.crop.planted ? 1.5 : 1;
    const hours = ((now - b.crop.planted) / 3600_000) * bonus * wateredBonus;
    const stage = Math.min(3, Math.floor(hours / STAGE_HOURS));
    if (stage !== (b.crop.stage ?? 0)) {
      b.crop.stage = stage;
      changed.push(b);
    }
  }
  return changed;
}

function gardenBonus(): number {
  let n = 0;
  for (const b of gs.d.buildings) {
    if (b.type === 'windmill' || b.type === 'water_tank' || b.type === 'compost' || b.type === 'harvest_barn') n += 0.1 * b.level;
  }
  return Math.min(2, n + gs.skillLevel('gardening') * 0.02);
}

export function plant(b: PlacedBuilding, seedId: string): boolean {
  if (b.crop || !gs.remove(seedId, 1)) return false;
  b.crop = { id: SEED_TO_CROP[seedId], planted: Date.now(), watered: 0, stage: 0 };
  gs.addSkill('gardening', 5);
  gs.markDirty();
  return true;
}

export function water(b: PlacedBuilding): void {
  if (!b.crop) return;
  b.crop.watered = Date.now();
  gs.markDirty();
}

export function harvest(b: PlacedBuilding): number {
  if (!b.crop || (b.crop.stage ?? 0) < 3) return 0;
  const n = 2 + Math.floor(Math.random() * 2) + Math.floor(gs.skillLevel('gardening') / 10);
  gs.add(b.crop.id, n);
  if (Math.random() < 0.5) gs.add('seed_' + b.crop.id, 1, true);
  b.crop = undefined;
  gs.addSkill('gardening', 20);
  gs.stat('harvest');
  gs.markDirty();
  return n;
}

export function cropRemaining(b: PlacedBuilding): string {
  if (!b.crop) return '';
  const stage = b.crop.stage ?? 0;
  if (stage >= 3) return '収穫できる！';
  const bonus = 1 + gardenBonus();
  const wateredBonus = b.crop.watered > b.crop.planted ? 1.5 : 1;
  const hours = ((Date.now() - b.crop.planted) / 3600_000) * bonus * wateredBonus;
  const left = Math.max(0, (3 * STAGE_HOURS - hours) / (bonus * wateredBonus));
  return left >= 1 ? `あと約${Math.ceil(left)}時間` : `あと約${Math.ceil(left * 60)}分`;
}
