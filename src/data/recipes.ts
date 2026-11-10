import type { ItemCat, Taste } from './items';

/** Ingredient: specific item id or any item from a category. */
export interface Ingredient {
  id?: string;
  cat?: ItemCat;
  n: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  taste: Taste;
  food: number;
  price: number;
  bpm: number;
  ingredients: Ingredient[];
  starter?: boolean; // known from the beginning
  desc: string;
}

export const RECIPES: RecipeDef[] = [
  { id: 'grilled_fish', name: '雲焼き魚', icon: '🍢', taste: 'sea', food: 18, price: 60, bpm: 90, ingredients: [{ cat: 'fish', n: 1 }], starter: true, desc: 'シンプルに焼いた魚。' },
  { id: 'berry_jam', name: '雲いちごジャム', icon: '🍯', taste: 'sweet', food: 20, price: 70, bpm: 96, ingredients: [{ id: 'cloudberry', n: 2 }], starter: true, desc: 'ふわふわのジャム。' },
  { id: 'bread', name: '空小麦パン', icon: '🍞', taste: 'sweet', food: 16, price: 50, bpm: 88, ingredients: [{ id: 'skywheat', n: 2 }], starter: true, desc: '焼きたての香り。' },
  { id: 'star_candy', name: '星屑キャンディ', icon: '🍬', taste: 'star', food: 15, price: 65, bpm: 110, ingredients: [{ id: 'stardust', n: 2 }], starter: true, desc: '口の中でぱちぱちはじける。' },
  { id: 'flower_tea', name: '花びら茶', icon: '🍵', taste: 'flower', food: 14, price: 55, bpm: 84, ingredients: [{ cat: 'flower', n: 1 }, { id: 'teaherb', n: 1 }], desc: '香り高いお茶。' },
  { id: 'apple_pie', name: 'そらりんごパイ', icon: '🥧', taste: 'sweet', food: 30, price: 120, bpm: 104, ingredients: [{ id: 'apple', n: 2 }, { id: 'skywheat', n: 1 }], desc: 'さくさくの生地。' },
  { id: 'fish_stew', name: '雲海シチュー', icon: '🍲', taste: 'sea', food: 34, price: 140, bpm: 92, ingredients: [{ cat: 'fish', n: 2 }, { id: 'mooncarrot', n: 1 }], desc: '体があたたまる。' },
  { id: 'moon_soup', name: '月にんじんスープ', icon: '🥣', taste: 'star', food: 24, price: 90, bpm: 86, ingredients: [{ id: 'mooncarrot', n: 2 }], desc: 'ほんのり光るスープ。' },
  { id: 'pumpkin_pudding', name: '灯りプリン', icon: '🍮', taste: 'sweet', food: 32, price: 150, bpm: 100, ingredients: [{ id: 'pumpkin', n: 1 }, { id: 'honey', n: 1 }], desc: 'とろけるかぼちゃプリン。' },
  { id: 'mushroom_risotto', name: '星きのこリゾット', icon: '🍛', taste: 'star', food: 30, price: 130, bpm: 94, ingredients: [{ id: 'mushroom', n: 2 }, { id: 'skywheat', n: 1 }], desc: '星の香りのリゾット。' },
  { id: 'honey_cake', name: 'はちみつケーキ', icon: '🍰', taste: 'flower', food: 28, price: 125, bpm: 108, ingredients: [{ id: 'honey', n: 2 }, { id: 'skywheat', n: 1 }], desc: 'しっとり甘い。' },
  { id: 'sushi', name: '雲海ずし', icon: '🍣', taste: 'sea', food: 36, price: 180, bpm: 116, ingredients: [{ cat: 'fish', n: 2 }, { id: 'skywheat', n: 1 }], desc: '新鮮な魚のおすし。' },
  { id: 'star_jelly', name: '流れ星ゼリー', icon: '🍧', taste: 'star', food: 34, price: 170, bpm: 120, ingredients: [{ cat: 'star', n: 2 }, { id: 'cloudberry', n: 1 }], desc: 'ぷるぷるで光る。' },
  { id: 'flower_salad', name: '花のサラダ', icon: '🥗', taste: 'flower', food: 22, price: 95, bpm: 90, ingredients: [{ cat: 'flower', n: 2 }], desc: '色とりどり。' },
  { id: 'pear_tart', name: '霧なしタルト', icon: '🥮', taste: 'sweet', food: 28, price: 120, bpm: 102, ingredients: [{ id: 'pear', n: 2 }, { id: 'honey', n: 1 }], desc: 'みずみずしいタルト。' },
  { id: 'feast', name: '灯台守の大ごちそう', icon: '🍱', taste: 'sea', food: 60, price: 400, bpm: 128, ingredients: [{ cat: 'fish', n: 2 }, { cat: 'crop', n: 2 }, { cat: 'star', n: 1 }], desc: 'みんなで食べたいごちそう。' },
  { id: 'cotton_candy', name: '雲わたあめ', icon: '🍭', taste: 'sweet', food: 18, price: 80, bpm: 112, ingredients: [{ id: 'cotton', n: 2 }], desc: '雲綿でつくる綿あめ。' },
  { id: 'aurora_parfait', name: 'オーロラパフェ', icon: '🍨', taste: 'star', food: 50, price: 320, bpm: 124, ingredients: [{ id: 's_aurora', n: 1 }, { id: 'cloudberry', n: 2 }, { id: 'honey', n: 1 }], desc: '冬の夜空をとじこめたパフェ。' },
];

export function getRecipe(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}
