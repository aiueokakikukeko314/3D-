import type { Taste } from './items';

export type Personality = 'nonbiri' | 'genki' | 'monoshiri' | 'itazura' | 'shokunin' | 'yumemi';

export const PERSONALITY_LABEL: Record<Personality, string> = {
  nonbiri: 'のんびり',
  genki: '元気',
  monoshiri: '物知り',
  itazura: 'いたずら',
  shokunin: '職人肌',
  yumemi: '夢見がち',
};

export interface ResidentDef {
  id: string;
  name: string;
  species: string;
  personality: Personality;
  likes: Taste;
  favorite: string; // item id (food)
  dislikes: Taste;
  birthday: string; // MM-DD
  phrase: string; // 口癖 (sentence ending)
  color?: string; // override body color
  procedural?: boolean;
}

type Row = [string, string, string, Personality, Taste, string, Taste, string, string, string?];

const ROWS: Row[] = [
  ['momo', 'モモ', 'usagi', 'genki', 'sweet', 'cloudberry', 'sea', '04-03', 'ぴょん'],
  ['kumo', 'クモスケ', 'kuma', 'nonbiri', 'sweet', 'honey', 'star', '09-21', 'だなぁ'],
  ['luna', 'ルナ', 'neko', 'yumemi', 'star', 's_tsuki', 'sea', '10-08', 'にゃ'],
  ['kiri', 'キリエ', 'kitsune', 'monoshiri', 'flower', 'teaherb', 'sweet', '11-17', 'ですわ'],
  ['hoho', 'ホーホ', 'fukurou', 'monoshiri', 'star', 'stardust', 'sweet', '01-25', 'ほう'],
  ['nami', 'ナミ', 'kawauso', 'genki', 'sea', 'f_sakuramasu', 'flower', '07-14', 'っす'],
  ['fuwa', 'フワリ', 'hitsuji', 'nonbiri', 'flower', 'fl_pink', 'star', '03-30', 'めぇ'],
  ['kaze', 'カザネ', 'risu', 'itazura', 'sweet', 'apple', 'flower', '10-29', 'へへっ'],
  ['shimo', 'シモン', 'pengin', 'shokunin', 'sea', 'f_yukigumo', 'sweet', '12-24', 'である'],
  ['pika', 'ピカ', 'koinu', 'genki', 'star', 's_kirakira', 'flower', '06-06', 'わん'],
  ['pon', 'ポン吉', 'tanuki', 'itazura', 'sweet', 'pumpkin', 'sea', '09-15', 'ぽん'],
  ['yura', 'ユラ', 'kurage', 'yumemi', 'flower', 'fl_sky', 'sweet', '08-31', 'ゆら〜'],
  ['sakura', 'サクラ', 'usagi', 'yumemi', 'flower', 'fl_pink', 'star', '04-01', 'ですの', '#ffd6e6'],
  ['gin', 'ギン', 'kitsune', 'shokunin', 'sea', 'f_yuyake', 'sweet', '10-10', 'だ', '#e8e8f2'],
  ['mugi', 'ムギ', 'kuma', 'shokunin', 'sweet', 'skywheat', 'star', '08-08', 'だべ', '#c7975e'],
  ['nova', 'ノヴァ', 'neko', 'genki', 'star', 's_nagare', 'flower', '02-14', 'にゃん！', '#2a2f55'],
  ['ame', 'アメ', 'kawauso', 'nonbiri', 'sea', 'f_amagumo', 'star', '06-18', 'ねぇ', '#6d8fb3'],
  ['coco', 'ココ', 'risu', 'genki', 'sweet', 'mushroom', 'sea', '05-05', 'りす！', '#c87a3a'],
  ['tera', 'テラ', 'fukurou', 'nonbiri', 'star', 'mooncarrot', 'flower', '11-03', 'ほっほ', '#8a6b4a'],
  ['yuki', 'ユキ', 'pengin', 'yumemi', 'sea', 'f_shimo', 'sweet', '01-11', 'です', '#dff0ff'],
  ['raku', 'ライク', 'koinu', 'itazura', 'sweet', 'apple', 'flower', '07-07', 'だぜ', '#ffb84d'],
  ['tama', 'タマ', 'tanuki', 'nonbiri', 'sweet', 'pear', 'star', '12-01', 'のぅ', '#8f6a4a'],
  ['mizu', 'ミズホ', 'kurage', 'monoshiri', 'sea', 'f_kiri', 'sweet', '03-14', 'かしら', '#b6f0ff'],
  ['wata', 'ワタ', 'hitsuji', 'genki', 'sweet', 'cotton', 'sea', '05-20', 'もこ', '#fffbe8'],
  ['hinata', 'ヒナタ', 'usagi', 'nonbiri', 'sweet', 'honey', 'star', '06-21', 'だよ〜', '#fff1c8'],
  ['kuro', 'クロ', 'neko', 'itazura', 'sea', 'f_sora', 'flower', '10-31', 'ニシシ', '#2b2433'],
  ['akane', 'アカネ', 'kitsune', 'genki', 'sweet', 'apple', 'star', '09-09', 'なのだ', '#f08a5d'],
  ['moss', 'モス', 'kuma', 'yumemi', 'flower', 'fl_green', 'sea', '05-31', 'もふ', '#9cc87a'],
  ['oto', 'オトハ', 'fukurou', 'yumemi', 'flower', 'teaherb', 'sea', '04-22', 'ですね', '#e3c18b'],
  ['umi', 'ウミ', 'kawauso', 'shokunin', 'sea', 'f_natsugumo', 'flower', '07-28', 'だぞ', '#3a8f9a'],
  ['hana', 'ハナ', 'hitsuji', 'monoshiri', 'flower', 'fl_purple', 'sea', '03-03', 'ですわね', '#e9c6ff'],
  ['kururi', 'クルリ', 'risu', 'yumemi', 'star', 's_sakura', 'sea', '04-15', 'くるり', '#e0b07a'],
  ['koori', 'コオリ', 'pengin', 'genki', 'sea', 'f_yuki', 'flower', '02-02', 'ぺん！', '#a8d8ff'],
  ['denki', 'デンキ', 'koinu', 'shokunin', 'star', 's_suisei', 'sweet', '08-15', 'っす', '#ffe066'],
  ['ponta', 'ポンタ', 'tanuki', 'genki', 'sea', 'f_kumohaze', 'flower', '11-23', 'ぽこ', '#9a7048'],
  ['hikari', 'ヒカリ', 'kurage', 'genki', 'star', 's_hotaru', 'sea', '07-20', 'きらっ', '#ffe6ff'],
  ['shion', 'シオン', 'neko', 'monoshiri', 'flower', 'fl_blue', 'sweet', '09-27', 'ですな', '#7a8fd6'],
  ['tsumugi', 'ツムギ', 'hitsuji', 'shokunin', 'sweet', 'cotton', 'star', '01-30', 'だよ', '#f3e3c3'],
  ['soyo', 'ソヨ', 'risu', 'nonbiri', 'flower', 'honey', 'sea', '05-12', 'そよ〜', '#ffcf9e'],
  ['kanata', 'カナタ', 'fukurou', 'itazura', 'star', 's_aurora', 'sweet', '12-12', 'ほほう', '#6b5a8a'],
  ['nagi', 'ナギ', 'kawauso', 'yumemi', 'sea', 'f_niji', 'star', '08-22', 'なぁ', '#79c5c0'],
  ['dango', 'ダンゴ', 'kuma', 'genki', 'sweet', 'cloudberry', 'flower', '09-30', 'だんご！', '#d09a6a'],
  ['suzu', 'スズ', 'usagi', 'monoshiri', 'star', 's_suzumushi', 'sea', '10-20', 'りん', '#e8e0ff'],
  ['riku', 'リク', 'koinu', 'nonbiri', 'sea', 'f_fuwafuna', 'star', '03-21', 'ワフ', '#e8c28a'],
  ['mikan', 'ミカン', 'tanuki', 'yumemi', 'sweet', 'pumpkin', 'star', '11-11', 'ほわ', '#e89a4a'],
  ['tsuki', 'ツキミ', 'kurage', 'nonbiri', 'star', 's_tsuki', 'flower', '09-17', 'ふわ', '#fff8c8'],
];

export const RESIDENTS: ResidentDef[] = ROWS.map(([id, name, species, personality, likes, favorite, dislikes, birthday, phrase, color]) => ({
  id,
  name,
  species,
  personality,
  likes,
  favorite,
  dislikes,
  birthday,
  phrase,
  color,
}));

/** The first two residents live on the island from the start. */
export const STARTER_RESIDENTS = ['momo', 'kumo'];

const SYL_A = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'コ', 'サ', 'シ', 'ス', 'ソ', 'タ', 'チ', 'ツ', 'ナ', 'ニ', 'ノ', 'ハ', 'ヒ', 'フ', 'ホ', 'マ', 'ミ', 'ム', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ'];
const SYL_END = ['ン', 'ル', 'ミ', 'コ', 'ノ', 'タ', 'リ', 'ナ', 'ロ', 'ポ', 'ム', 'ヤ'];
const PHRASES = ['ふむ', 'だよ', 'ね', 'なの', 'さ', 'だね', 'よ〜', 'かな', 'じゃ', 'ぞい', 'るん', 'ってば'];

import { Rng } from '../core/rng';
import { SPECIES } from './species';

const TASTES: Taste[] = ['sweet', 'sea', 'star', 'flower'];
const PERSONALITIES: Personality[] = ['nonbiri', 'genki', 'monoshiri', 'itazura', 'shokunin', 'yumemi'];
const FAVS: Record<Taste, string[]> = {
  sweet: ['cloudberry', 'apple', 'honey', 'pumpkin', 'pear'],
  sea: ['f_kumohaze', 'f_momiji', 'f_sora', 'f_kaze'],
  star: ['stardust', 's_kirakira', 'mooncarrot', 'mushroom'],
  flower: ['teaherb', 'fl_red', 'fl_yellow', 'fl_white'],
};

/** Unlimited procedural travelers (after all named residents moved in, and mixed in before). */
export function proceduralResident(index: number): ResidentDef {
  const rng = new Rng(9001 + index * 7919);
  const name = rng.pick(SYL_A) + rng.pick(SYL_A) + (rng.chance(0.6) ? rng.pick(SYL_END) : '');
  const likes = rng.pick(TASTES);
  let dislikes = rng.pick(TASTES);
  if (dislikes === likes) dislikes = TASTES[(TASTES.indexOf(likes) + 1) % 4];
  const hue = rng.float();
  const c = hslHex(hue, 0.45 + rng.float() * 0.3, 0.55 + rng.float() * 0.25);
  return {
    id: `trav_${index}`,
    name,
    species: rng.pick(SPECIES).id,
    personality: rng.pick(PERSONALITIES),
    likes,
    favorite: rng.pick(FAVS[likes]),
    dislikes,
    birthday: `${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
    phrase: rng.pick(PHRASES),
    color: c,
    procedural: true,
  };
}

function hslHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const residentCache = new Map<string, ResidentDef>();
export function getResident(id: string): ResidentDef {
  const c = residentCache.get(id);
  if (c) return c;
  let def = RESIDENTS.find((r) => r.id === id);
  if (!def && id.startsWith('trav_')) def = proceduralResident(Number(id.slice(5)));
  if (!def) def = RESIDENTS[0];
  residentCache.set(id, def);
  return def;
}
