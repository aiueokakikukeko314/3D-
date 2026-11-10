import { clock, SEASON_LABEL, WEATHER_LABEL } from '../core/Clock';
import type { Personality, ResidentDef } from './residents';
import { TASTE_LABEL, getItem } from './items';
import { Rng } from '../core/rng';

const GREET: Record<Personality, string[]> = {
  nonbiri: ['ふぁ〜、いい天気', 'のんびりしてる？', 'ゆっくりいこうよ', 'ひなたぼっこ中'],
  genki: ['やっほー！', 'きょうも元気いっぱい！', 'いっしょに走ろう！', 'わくわくするね！'],
  monoshiri: ['ごきげんよう', '知ってる？雲海の底には古い町があるらしいよ', '星の名前を覚えるのが好きなんだ', '本を読んでいたところ'],
  itazura: ['へへ、見つかっちゃった', 'こっそり何かしてないよ？', 'びっくりした？', 'あとで秘密を教えてあげる'],
  shokunin: ['仕事の手は止めないよ', 'いい道具はいい暮らしをつくる', 'この島の柱、ぼくが磨いたんだ', '今日の出来はまあまあ'],
  yumemi: ['雲の形が夢に出てきたの', 'いつか空のてっぺんまで行きたいな', '流れ星にお願いしたんだ', 'きらきらしたものが好き'],
};

const TIME_LINE: Record<string, string[]> = {
  morning: ['朝の空気って、雲のにおいがするね', 'おはよう！灯台の光、消えたね', '朝ごはんはもう食べた？'],
  day: ['お昼の雲海はまぶしいね', '今日は何をつくるの？', 'いい風が吹いてる'],
  evening: ['夕焼けがきれい…', 'そろそろ灯台に火をともす時間？', '夕方の雲は桃色だね'],
  night: ['星がよく見える夜だね', '灯台の光があったかい', '夜ふかしさん、こんばんは'],
};

const SEASON_LINE: Record<string, string[]> = {
  spring: ['桜の花びらが雲に乗って飛んでくるよ', '春の島はどこもいいにおい'],
  summer: ['ほたるを見に行こうよ', '入道雲がもくもく！'],
  autumn: ['紅葉の島に行ってみたいな', '秋は食べものがおいしいね'],
  winter: ['雪の島はしずかで好き', 'オーロラ、見たことある？'],
};

const FEED_LIKE = ['わあ、大好物！', 'これ食べたかったんだ！', 'しあわせ〜！'];
const FEED_OK = ['ありがとう、おいしい！', 'うれしいな', 'ごちそうさま！'];
const FEED_DISLIKE = ['うーん、ちょっと苦手かも…', 'ありがとう…（ちょっとにがて）'];
const FEED_FULL = ['もうおなかいっぱい！また明日ね', 'きょうはもう食べられないよ〜'];

export function greeting(def: ResidentDef, level: number): string {
  const rng = new Rng(def.id + clock.dayKey() + Math.floor(Date.now() / 60000));
  const tod = clock.timeOfDay();
  const pools = [GREET[def.personality], TIME_LINE[tod], SEASON_LINE[clock.season()]];
  let line = rng.pick(rng.pick(pools));
  const mmdd = clock.dayKey().slice(5);
  if (def.birthday === mmdd) line = 'きょうはぼくの誕生日なんだ！おぼえててくれた？';
  else if (rng.chance(0.25)) line = `${SEASON_LABEL[clock.season()]}の${WEATHER_LABEL[clock.weather()]}の日って、なんだか好き`;
  else if (rng.chance(0.2)) line = `${TASTE_LABEL[def.likes]}の食べものが好きなんだ。とくに${getItem(def.favorite).name}！`;
  if (level >= 10 && rng.chance(0.3)) line = 'あなたがこの島の灯台守でよかった';
  return `${line}${def.phrase ? '、' + def.phrase : ''}`;
}

export function feedLine(kind: 'fav' | 'like' | 'ok' | 'dislike' | 'full', def: ResidentDef): string {
  const rng = new Rng(Date.now());
  const pool = kind === 'fav' || kind === 'like' ? FEED_LIKE : kind === 'dislike' ? FEED_DISLIKE : kind === 'full' ? FEED_FULL : FEED_OK;
  return `${rng.pick(pool)}${def.phrase ? '、' + def.phrase : ''}`;
}

export const VISITOR_LINES = [
  '灯台の光が見えたから、ここまで来てみたんだ',
  'すてきな島だね。しばらくいてもいいかな',
  '雲の上を旅してるの。この島の名前は？',
  'あったかい光だね。ほっとする',
];
