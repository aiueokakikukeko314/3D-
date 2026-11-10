import { clock } from '../core/Clock';

export interface FestivalDef {
  id: string;
  name: string;
  icon: string;
  from: string; // MM-DD
  to: string; // MM-DD (inclusive)
  desc: string;
  reward: { item: string; n: number }[];
  coins: number;
}

export const FESTIVALS: FestivalDef[] = [
  { id: 'hanami', name: '花見', icon: '🌸', from: '03-28', to: '04-10', desc: '桜の島でみんなでお弁当を食べる春のお祭り。', reward: [{ item: 'petal', n: 10 }, { item: 'fl_pink', n: 2 }], coins: 300 },
  { id: 'hoshimatsuri', name: '星祭り', icon: '🎋', from: '07-01', to: '07-07', desc: '短冊に願いを書いて、星屑を空に返す夏の夜のお祭り。', reward: [{ item: 'stardust', n: 10 }, { item: 's_nagare', n: 1 }], coins: 300 },
  { id: 'tsukimi', name: 'お月見', icon: '🎑', from: '09-15', to: '09-25', desc: '月見台でおだんごを食べながら月をながめる夜。', reward: [{ item: 's_tsuki', n: 1 }, { item: 'skywheat', n: 5 }], coins: 300 },
  { id: 'shukaku', name: '収穫祭', icon: '🎃', from: '10-20', to: '10-31', desc: '実りに感謝して、灯りかぼちゃを飾る秋のお祭り。', reward: [{ item: 'pumpkin', n: 3 }, { item: 'seed_pumpkin', n: 3 }], coins: 400 },
  { id: 'yukiakari', name: '雪灯り祭り', icon: '🕯️', from: '12-20', to: '12-31', desc: '雪の島じゅうに小さな灯りをともす冬のお祭り。', reward: [{ item: 't_lantern', n: 1 }, { item: 'cotton', n: 10 }], coins: 500 },
  { id: 'hatsuhi', name: '初日の出', icon: '🌅', from: '01-01', to: '01-03', desc: '雲海から昇る一年最初の朝日をみんなで見る。', reward: [{ item: 'stardust', n: 5 }, { item: 't_clover', n: 1 }], coins: 500 },
];

export function activeFestival(): FestivalDef | null {
  const md = clock.dayKey().slice(5);
  return FESTIVALS.find((f) => md >= f.from && md <= f.to) ?? null;
}

export function festivalKey(f: FestivalDef): string {
  return clock.dayKey().slice(0, 4) + ':' + f.id;
}
