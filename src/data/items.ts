import type { Season, TimeOfDay, Weather } from '../core/Clock';

export type ItemCat = 'material' | 'crop' | 'fish' | 'star' | 'flower' | 'dish' | 'seed' | 'treasure';
export type Taste = 'sweet' | 'sea' | 'star' | 'flower';

export const TASTE_LABEL: Record<Taste, string> = {
  sweet: '甘い',
  sea: '海の幸',
  star: '星の味',
  flower: '花の香り',
};
export const TASTE_COLOR: Record<Taste, string> = {
  sweet: '#ffb36b',
  sea: '#5cc8ff',
  star: '#c9a6ff',
  flower: '#ff8fc8',
};

export const CAT_LABEL: Record<ItemCat, string> = {
  material: '素材',
  crop: '作物',
  fish: '魚',
  star: '星・虫',
  flower: '花',
  dish: '料理',
  seed: '種',
  treasure: 'お宝',
};

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  cat: ItemCat;
  price: number;
  taste?: Taste;
  food?: number; // nourishment value when fed
  fuel?: number; // lighthouse fuel value
  desc?: string;
  color?: string; // used by flowers / palettes
}

export interface FishDef extends ItemDef {
  seasons: Season[] | 'all';
  times: TimeOfDay[] | 'all';
  weathers?: Weather[];
  rarity: number; // 1..5
  minSkill?: number;
}

export interface CatchDef extends ItemDef {
  seasons: Season[] | 'all';
  rarity: number;
}

const M = (id: string, name: string, icon: string, price: number, fuel = 0, desc = ''): ItemDef => ({
  id,
  name,
  icon,
  cat: 'material',
  price,
  fuel: fuel || undefined,
  desc,
});

export const MATERIALS: ItemDef[] = [
  M('wood', '木材', '🪵', 8, 1, '木をゆらすと手に入る。建設の基本素材。'),
  M('stone', '石材', '🪨', 10, 0, '岩をたたくと手に入る。'),
  M('cotton', '雲綿', '☁️', 14, 2, '雲海から釣れるふわふわの綿。'),
  M('stardust', '星屑', '✨', 18, 3, '夜空から降るきらきら。灯台のよい燃料。'),
  M('petal', '花びら', '🌸', 12, 1, '花から集めたやわらかい素材。'),
  M('skyore', '空色鉱石', '💎', 40, 0, '新しい浮島の岩から出る鉱石。'),
  M('glass', 'ガラス玉', '🔮', 30, 0, '星屑と石を焼いてできる。'),
];

const C = (id: string, name: string, icon: string, price: number, taste: Taste, food: number, desc = ''): ItemDef => ({
  id,
  name,
  icon,
  cat: 'crop',
  price,
  taste,
  food,
  desc,
});

export const CROPS: ItemDef[] = [
  C('cloudberry', '雲いちご', '🍓', 20, 'sweet', 8, '雲のようにふわっと甘いいちご。'),
  C('skywheat', '空小麦', '🌾', 14, 'sweet', 5, 'パンやお菓子の材料。'),
  C('mooncarrot', '月にんじん', '🥕', 18, 'star', 7, '夜にほんのり光るにんじん。'),
  C('pumpkin', '灯りかぼちゃ', '🎃', 30, 'sweet', 12, '中に灯りをともせる大きなかぼちゃ。'),
  C('teaherb', '風の茶葉', '🍃', 22, 'flower', 6, '香りのよいお茶になる葉。'),
  C('apple', 'そらりんご', '🍎', 16, 'sweet', 7, '木から落ちてくる赤い実。'),
  C('pear', '霧なし', '🍐', 18, 'sweet', 7, '霧の島で育つみずみずしい実。'),
  C('honey', '花の蜜', '🍯', 26, 'flower', 9, '花壇のまわりで集まる蜜。'),
  C('mushroom', '星きのこ', '🍄', 24, 'star', 8, '木の根元に生える小さなきのこ。'),
];

export const SEEDS: ItemDef[] = [
  { id: 'seed_cloudberry', name: '雲いちごの種', icon: '🌱', cat: 'seed', price: 10, desc: '畑に植えると雲いちごが育つ。' },
  { id: 'seed_skywheat', name: '空小麦の種', icon: '🌱', cat: 'seed', price: 6, desc: '畑に植えると空小麦が育つ。' },
  { id: 'seed_mooncarrot', name: '月にんじんの種', icon: '🌱', cat: 'seed', price: 9, desc: '畑に植えると月にんじんが育つ。' },
  { id: 'seed_pumpkin', name: 'かぼちゃの種', icon: '🌱', cat: 'seed', price: 14, desc: '畑に植えると灯りかぼちゃが育つ。' },
  { id: 'seed_teaherb', name: '茶葉の種', icon: '🌱', cat: 'seed', price: 11, desc: '畑に植えると風の茶葉が育つ。' },
];

export const SEED_TO_CROP: Record<string, string> = {
  seed_cloudberry: 'cloudberry',
  seed_skywheat: 'skywheat',
  seed_mooncarrot: 'mooncarrot',
  seed_pumpkin: 'pumpkin',
  seed_teaherb: 'teaherb',
};

const F = (
  id: string,
  name: string,
  icon: string,
  rarity: number,
  seasons: Season[] | 'all',
  times: TimeOfDay[] | 'all',
  weathers?: Weather[],
  desc = '',
): FishDef => ({
  id,
  name,
  icon,
  cat: 'fish',
  price: 20 + rarity * rarity * 25,
  taste: 'sea',
  food: 5 + rarity * 3,
  rarity,
  seasons,
  times,
  weathers,
  desc,
});

export const FISH: FishDef[] = [
  F('f_kumohaze', 'くもハゼ', '🐟', 1, 'all', 'all', undefined, '雲海のどこにでもいる小さな魚。'),
  F('f_fuwafuna', 'ふわブナ', '🐟', 1, 'all', ['morning', 'day'], undefined, 'ふわふわ泳ぐのんびり屋。'),
  F('f_asagiri', 'あさぎりアユ', '🐠', 2, ['spring', 'summer'], ['morning'], undefined, '朝霧の中だけで見られる。'),
  F('f_sakuramasu', '桜雲マス', '🐠', 3, ['spring'], 'all', undefined, '桜色のうろこを持つ春の魚。'),
  F('f_hanabira', '花びらメダカ', '🐟', 2, ['spring'], ['day'], undefined, '花びらのように小さい。'),
  F('f_kaminari', '雷ウナギ', '🐍', 4, ['spring', 'summer'], 'all', ['rain'], '雨の日にぴりぴり光る。'),
  F('f_natsugumo', '入道雲ダイ', '🐡', 3, ['summer'], ['day'], ['sunny'], '夏の大きな雲にすむ鯛。'),
  F('f_hotaru', 'ほたるイカ', '🦑', 3, ['summer'], ['night'], undefined, '夏の夜に青く光る。'),
  F('f_niji', 'にじトビウオ', '🐬', 4, ['summer'], ['evening'], undefined, '夕焼けの雲を跳ねる。'),
  F('f_momiji', 'もみじ雲魚', '🐠', 2, ['autumn'], 'all', undefined, '紅葉の色をした秋の魚。'),
  F('f_yuyake', '夕焼けサーモン', '🐟', 3, ['autumn'], ['evening'], undefined, '夕方にだけ雲面に上がる。'),
  F('f_tsukimi', '月見フグ', '🐡', 4, ['autumn'], ['night'], undefined, '満月が大好きなフグ。'),
  F('f_kinoko', 'きのこカレイ', '🐟', 2, ['autumn'], ['day', 'morning'], undefined, 'かさのようなひれ。'),
  F('f_yukigumo', '雪雲ダラ', '🐟', 2, ['winter'], 'all', undefined, '冷たい雲を好むタラ。'),
  F('f_shimo', '霜ワカサギ', '🐟', 2, ['winter'], ['morning'], undefined, '霜の朝に群れる。'),
  F('f_aurora', 'オーロラクジラ', '🐋', 5, ['winter'], ['night'], undefined, '冬の夜空色をした雲海の主。'),
  F('f_hoshikuzu', '星屑ザメ', '🦈', 5, 'all', ['night'], ['starry'], '星降りの夜にだけ現れる。'),
  F('f_nagare', 'ながれ星エイ', '🐟', 4, 'all', ['night'], undefined, '流れ星のように泳ぐ。'),
  F('f_kiri', '霧クラゲ', '🪼', 3, 'all', ['morning'], ['cloudy'], '霧の朝にただよう。'),
  F('f_amagumo', '雨雲ナマズ', '🐟', 3, 'all', 'all', ['rain'], '雨が好きなのんびり屋。'),
  F('f_taiyou', '太陽マンボウ', '🐡', 5, ['summer'], ['day'], ['sunny'], 'まぶしい日だけ顔を出す。'),
  F('f_yuki', '雪うさぎウオ', '🐇', 4, ['winter'], ['day'], ['snow'], '雪の日に跳ねる魚。'),
  F('f_kaze', '風切りサヨリ', '🐟', 2, 'all', ['day'], undefined, '風の強い日に速く泳ぐ。'),
  F('f_sora', 'そらイワシ', '🐟', 1, 'all', ['evening', 'night'], undefined, '群れで空を泳ぐ。'),
  F('f_old', '古代雲シーラカンス', '🐉', 5, 'all', 'all', undefined, 'めったに見られない伝説の魚。'),
];

const S = (id: string, name: string, icon: string, rarity: number, seasons: Season[] | 'all', desc = ''): CatchDef => ({
  id,
  name,
  icon,
  cat: 'star',
  price: 15 + rarity * rarity * 20,
  taste: 'star',
  food: 4 + rarity * 3,
  fuel: 3 + rarity * 4,
  rarity,
  seasons,
  desc,
});

export const CATCHES: CatchDef[] = [
  S('s_kirakira', 'きらきら星', '⭐', 1, 'all', 'よく降ってくる小さな星。'),
  S('s_nagare', '流れ星のかけら', '🌠', 3, 'all', '願いごとがつまったかけら。'),
  S('s_tsuki', '月のしずく', '🌙', 4, 'all', '月の光が固まったもの。'),
  S('s_sakura', '夜桜ボタル', '🌸', 2, ['spring'], '春の夜にだけ飛ぶ桜色の虫。'),
  S('s_hotaru', 'ほたる', '🪲', 2, ['summer'], '夏の夜に光る虫。'),
  S('s_kingyo', '金魚星', '🎐', 3, ['summer'], '夏祭りのような赤い星。'),
  S('s_momiji', '紅葉ホタル', '🍁', 2, ['autumn'], '秋の夜に赤く光る虫。'),
  S('s_suzumushi', '鈴虫星', '🔔', 3, ['autumn'], 'りんりんと鳴る星。'),
  S('s_yuki', '雪の結晶', '❄️', 2, ['winter'], '冬の夜に舞う結晶。'),
  S('s_aurora', 'オーロラの糸', '🌌', 4, ['winter'], '冬の夜空からほどけた糸。'),
  S('s_suisei', 'ほうき星', '☄️', 5, 'all', 'ごくまれに落ちてくる大きな星。'),
];

export interface FlowerColorDef {
  id: string;
  name: string;
  color: string;
}

/** Flower colors used by the flower puzzle. Index = genetic code. */
export const FLOWER_COLORS: FlowerColorDef[] = [
  { id: 'red', name: 'あか', color: '#ff5a6e' },
  { id: 'yellow', name: 'きいろ', color: '#ffd84a' },
  { id: 'blue', name: 'あお', color: '#5b8cff' },
  { id: 'white', name: 'しろ', color: '#f6f3ea' },
  { id: 'orange', name: 'だいだい', color: '#ff9a3c' },
  { id: 'purple', name: 'むらさき', color: '#a56bff' },
  { id: 'green', name: 'みどり', color: '#6bdc7a' },
  { id: 'pink', name: 'もも', color: '#ff9cc8' },
  { id: 'sky', name: 'そら', color: '#8fd8ff' },
  { id: 'cream', name: 'たまご', color: '#fff0b0' },
  { id: 'black', name: 'よる', color: '#3a3355' },
  { id: 'gold', name: 'こがね', color: '#ffc531' },
  { id: 'rainbow', name: 'にじ', color: '#ff7af0' },
];

export const FLOWERS: ItemDef[] = FLOWER_COLORS.map((c, i) => ({
  id: 'fl_' + c.id,
  name: `${c.name}の花`,
  icon: i % 3 === 0 ? '🌷' : i % 3 === 1 ? '🌼' : '🌺',
  cat: 'flower' as const,
  price: 20 + i * 12,
  taste: 'flower' as const,
  food: 4 + Math.floor(i / 2),
  fuel: 1,
  color: c.color,
  desc: `花パズルで生まれた${c.name}色の花。`,
}));

export const TREASURES: ItemDef[] = [
  { id: 't_bottle', name: '雲のびん詰め手紙', icon: '🍾', cat: 'treasure', price: 120, desc: 'どこかの島から流れてきた手紙。' },
  { id: 't_feather', name: '渡り鳥の羽', icon: '🪶', cat: 'treasure', price: 80, desc: '季節の渡り鳥が落とした羽。' },
  { id: 't_shell', name: '空貝', icon: '🐚', cat: 'treasure', price: 50, desc: '雲海の浜で拾える貝。' },
  { id: 't_acorn', name: 'ひかりどんぐり', icon: '🌰', cat: 'treasure', price: 35, fuel: 2, desc: '秋に光るどんぐり。' },
  { id: 't_leaf', name: '色づいた葉', icon: '🍂', cat: 'treasure', price: 15, fuel: 1, desc: '季節を感じる一枚。' },
  { id: 't_snowball', name: '溶けない雪玉', icon: '⚪', cat: 'treasure', price: 45, desc: '冬の島で拾える雪玉。' },
  { id: 't_clover', name: '四つ葉', icon: '🍀', cat: 'treasure', price: 90, desc: '見つけたらいいことがある。' },
  { id: 't_lantern', name: '古いランタン', icon: '🏮', cat: 'treasure', price: 150, fuel: 8, desc: '昔の灯台守が使っていたらしい。' },
];

// Dishes are dynamic: "dish:<recipeId>:<quality>"
import { RECIPES } from './recipes';

const ITEM_MAP = new Map<string, ItemDef>();
for (const list of [MATERIALS, CROPS, SEEDS, FISH, CATCHES, FLOWERS, TREASURES]) {
  for (const it of list) ITEM_MAP.set(it.id, it);
}

export function dishId(recipeId: string, quality: number): string {
  return `dish:${recipeId}:${quality}`;
}

export function getItem(id: string): ItemDef {
  const found = ITEM_MAP.get(id);
  if (found) return found;
  if (id.startsWith('dish:')) {
    const [, rid, q] = id.split(':');
    const r = RECIPES.find((x) => x.id === rid);
    const quality = Number(q) || 1;
    if (r) {
      const def: ItemDef = {
        id,
        name: `${r.name}${'★'.repeat(quality)}`,
        icon: r.icon,
        cat: 'dish',
        price: Math.floor(r.price * (0.7 + quality * 0.3)),
        taste: r.taste,
        food: Math.floor(r.food * (0.6 + quality * 0.4)),
        fuel: 3 + quality * 3,
        desc: r.desc,
      };
      ITEM_MAP.set(id, def);
      return def;
    }
  }
  return { id, name: id, icon: '❔', cat: 'material', price: 1 };
}

export function allCollectibleDefs(): ItemDef[] {
  return [...FISH, ...CATCHES, ...FLOWERS, ...CROPS, ...TREASURES];
}

export const FOOD_CATS: ItemCat[] = ['crop', 'fish', 'star', 'flower', 'dish'];
export function isFood(id: string): boolean {
  const d = getItem(id);
  return !!d.food && FOOD_CATS.includes(d.cat);
}
