import type { Season, TimeOfDay } from '../core/Clock';
import type { ItemCat } from './items';

export interface SpiritDef {
  id: string;
  name: string;
  title: string;
  season: Season;
  times: TimeOfDay[] | 'all';
  species: string;
  color: string;
  want: { id?: string; cat?: ItemCat; n: number; label: string };
  reward: { blueprint?: string; coins: number; color?: string };
  line: string;
}

type Row = [string, string, string, Season, TimeOfDay[] | 'all', string, string, SpiritDef['want'], SpiritDef['reward'], string];

const ROWS: Row[] = [
  // spring
  ['sp_harukaze', 'ハルカゼ', '春風の精', 'spring', 'all', 'risu', '#b8f2c8', { cat: 'flower', n: 2, label: '花 2つ' }, { blueprint: 'sakura_tree', coins: 300, color: '#ffc8dc' }, '春の風といっしょに旅をしているの。'],
  ['sp_tsubomi', 'ツボミ', 'つぼみの精', 'spring', ['morning'], 'hitsuji', '#ffd6ea', { id: 'cloudberry', n: 3, label: '雲いちご 3つ' }, { blueprint: 'flower_arch', coins: 250 }, 'ひらく前のつぼみが好きなの。'],
  ['sp_kasumi', 'カスミ', '霞の精', 'spring', ['morning', 'day'], 'kurage', '#e6e0ff', { cat: 'fish', n: 2, label: '魚 2匹' }, { blueprint: 'mist_fountain', coins: 280 }, 'かすみの向こうから来ました。'],
  ['sp_yozakura', 'ヨザクラ', '夜桜の精', 'spring', ['night'], 'neko', '#ff9ec4', { id: 's_sakura', n: 1, label: '夜桜ボタル' }, { blueprint: 'paper_lantern', coins: 400, color: '#ff7aa8' }, '夜の桜はいっとうきれい。'],
  ['sp_hibari', 'ヒバリ', 'ひばりの精', 'spring', ['day'], 'fukurou', '#ffe9a8', { cat: 'crop', n: 3, label: '作物 3つ' }, { blueprint: 'bird_house', coins: 220 }, 'ぴーちく、空のてっぺんまで！'],
  ['sp_nanohana', 'ナノハ', '菜の花の精', 'spring', ['evening'], 'usagi', '#fff27a', { id: 'honey', n: 2, label: '花の蜜 2つ' }, { blueprint: 'beehive', coins: 260, color: '#ffe94a' }, 'きいろい野原を探しているの。'],
  // summer
  ['su_nyudo', 'ニュードー', '入道雲の精', 'summer', ['day'], 'kuma', '#ffffff', { cat: 'fish', n: 3, label: '魚 3匹' }, { blueprint: 'cloud_slide', coins: 380 }, 'もくもく大きくなるのがとくい！'],
  ['su_hotaru', 'ホタル', '蛍火の精', 'summer', ['night'], 'kurage', '#c8ff9a', { id: 's_hotaru', n: 2, label: 'ほたる 2匹' }, { blueprint: 'firefly_jar', coins: 350, color: '#d4ff5a' }, 'あかりの点る場所が好き。'],
  ['su_fuurin', 'フウリン', '風鈴の精', 'summer', ['evening'], 'neko', '#9ad8ff', { id: 'glass', n: 1, label: 'ガラス玉' }, { blueprint: 'wind_chime', coins: 300 }, 'ちりん、と鳴ると涼しいでしょ。'],
  ['su_himawari', 'ヒマワリ', 'ひまわりの精', 'summer', ['morning', 'day'], 'koinu', '#ffcf3a', { cat: 'flower', n: 3, label: '花 3つ' }, { blueprint: 'sunflower_field', coins: 280, color: '#ffb800' }, 'お日さまの方をむいてるの！'],
  ['su_nagisa', 'ナギサ', '渚の精', 'summer', 'all', 'kawauso', '#7fe0d8', { id: 't_shell', n: 2, label: '空貝 2つ' }, { blueprint: 'beach_parasol', coins: 260 }, '雲のなぎさで貝をひろうの。'],
  ['su_hanabi', 'ハナビ', '花火の精', 'summer', ['night'], 'risu', '#ff7a5a', { cat: 'star', n: 3, label: '星・虫 3つ' }, { blueprint: 'firework_stand', coins: 500, color: '#ff4a4a' }, 'どーんと大きく咲かせたい！'],
  // autumn
  ['au_momiji', 'モミジ', '紅葉の精', 'autumn', 'all', 'kitsune', '#ff8a4a', { id: 't_leaf', n: 3, label: '色づいた葉 3枚' }, { blueprint: 'maple_tree', coins: 300, color: '#e8562a' }, '葉っぱを赤くそめて回っているの。'],
  ['au_tsukimi', 'ツキミ', '月見の精', 'autumn', ['night'], 'usagi', '#fff2b0', { cat: 'dish', n: 1, label: '料理 1つ' }, { blueprint: 'moon_viewing_deck', coins: 450 }, 'お月見だんごが食べたいな。'],
  ['au_minori', 'ミノリ', '実りの精', 'autumn', ['day'], 'tanuki', '#e8b04a', { cat: 'crop', n: 4, label: '作物 4つ' }, { blueprint: 'harvest_barn', coins: 380 }, 'みのりの秋、ばんざい！'],
  ['au_kinoko', 'キノコ', '森のきのこ精', 'autumn', ['morning'], 'kuma', '#d07a5a', { id: 'mushroom', n: 2, label: '星きのこ 2つ' }, { blueprint: 'mushroom_house', coins: 320 }, 'しっとりした森の朝が好き。'],
  ['au_suzumushi', 'スズムシ', '鈴虫の精', 'autumn', ['evening', 'night'], 'fukurou', '#c8b4ff', { id: 's_suzumushi', n: 1, label: '鈴虫星' }, { blueprint: 'bell_tower', coins: 420, color: '#9a7aff' }, 'りんりん、秋の夜の音楽会。'],
  ['au_kogarashi', 'コガラシ', '木枯らしの精', 'autumn', 'all', 'risu', '#c89a6a', { id: 'wood', n: 10, label: '木材 10個' }, { blueprint: 'windmill', coins: 350 }, 'ひゅうっと冬を連れてくるよ。'],
  // winter
  ['wi_yukinko', 'ユキンコ', '雪ん子', 'winter', 'all', 'pengin', '#f0f8ff', { id: 't_snowball', n: 2, label: '溶けない雪玉 2つ' }, { blueprint: 'snowman', coins: 300, color: '#e8f4ff' }, 'ゆきだるま、いっしょに作ろ？'],
  ['wi_aurora', 'オーロラ', '極光の精', 'winter', ['night'], 'kurage', '#9affd8', { id: 's_aurora', n: 1, label: 'オーロラの糸' }, { blueprint: 'aurora_gate', coins: 600, color: '#5affc8' }, '空のカーテンをゆらしているの。'],
  ['wi_tsurara', 'ツララ', 'つららの精', 'winter', ['morning'], 'kitsune', '#bfe6ff', { id: 'glass', n: 2, label: 'ガラス玉 2つ' }, { blueprint: 'ice_sculpture', coins: 400 }, 'きらきらのつらら、好き？'],
  ['wi_danro', 'ダンロ', '暖炉の精', 'winter', ['evening', 'night'], 'tanuki', '#ff9a5a', { id: 'wood', n: 15, label: '木材 15個' }, { blueprint: 'fireplace_hut', coins: 380 }, 'ぽかぽかのお部屋をつくろう。'],
  ['wi_hoshiyo', 'ホシヨ', '冬星の精', 'winter', ['night'], 'neko', '#b0b8ff', { id: 'stardust', n: 6, label: '星屑 6つ' }, { blueprint: 'star_observatory', coins: 500, color: '#6a7aff' }, '冬の星はいちばん澄んでいるの。'],
  ['wi_mochi', 'モチヅキ', '餅つきの精', 'winter', ['day'], 'usagi', '#ffffff', { id: 'skywheat', n: 5, label: '空小麦 5つ' }, { blueprint: 'mochi_stand', coins: 330 }, 'ぺったん、ぺったん！'],
];

export const SPIRITS: SpiritDef[] = ROWS.map(([id, name, title, season, times, species, color, want, reward, line]) => ({
  id,
  name,
  title,
  season,
  times,
  species,
  color,
  want,
  reward,
  line,
}));

export function getSpirit(id: string): SpiritDef | undefined {
  return SPIRITS.find((s) => s.id === id);
}
