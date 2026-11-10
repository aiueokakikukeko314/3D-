export type EarType = 'long' | 'cat' | 'fox' | 'round' | 'tuft' | 'small' | 'horn' | 'floppy' | 'none';
export type TailType = 'round' | 'long' | 'fluffy' | 'thick' | 'wing' | 'stripe' | 'tentacle' | 'tiny';
export type BodyType = 'round' | 'tall' | 'egg' | 'wool' | 'jelly';

export interface SpeciesDef {
  id: string;
  name: string;
  ears: EarType;
  tail: TailType;
  body: BodyType;
  colors: [string, string, string]; // body, belly, accent
  snout?: boolean;
  mask?: boolean;
  floating?: boolean;
}

export const SPECIES: SpeciesDef[] = [
  { id: 'usagi', name: '雲うさぎ', ears: 'long', tail: 'round', body: 'round', colors: ['#f4f1fb', '#ffffff', '#ffb6c9'] },
  { id: 'neko', name: '星ねこ', ears: 'cat', tail: 'long', body: 'round', colors: ['#3d4a7a', '#c9d2ff', '#ffe27a'] },
  { id: 'kitsune', name: '霧ぎつね', ears: 'fox', tail: 'fluffy', body: 'tall', colors: ['#d9c9f2', '#fffaf2', '#8b6fd6'], snout: true },
  { id: 'kuma', name: '苔くま', ears: 'round', tail: 'tiny', body: 'round', colors: ['#7fae62', '#d8e8b8', '#4f7a3f'], snout: true },
  { id: 'fukurou', name: '灯りフクロウ', ears: 'tuft', tail: 'wing', body: 'egg', colors: ['#b4834f', '#f3dcb0', '#ffcf5a'] },
  { id: 'kawauso', name: '潮カワウソ', ears: 'small', tail: 'thick', body: 'tall', colors: ['#4fa3a5', '#d4f0ea', '#2b6d73'], snout: true },
  { id: 'hitsuji', name: '花ひつじ', ears: 'horn', tail: 'tiny', body: 'wool', colors: ['#ffd3e6', '#fff6fb', '#c98aa6'] },
  { id: 'risu', name: '風りす', ears: 'small', tail: 'fluffy', body: 'round', colors: ['#f1a253', '#fff0d8', '#a65d22'] },
  { id: 'pengin', name: '霜ペンギン', ears: 'none', tail: 'wing', body: 'egg', colors: ['#8fc1e8', '#ffffff', '#ffb347'] },
  { id: 'koinu', name: '雷こいぬ', ears: 'floppy', tail: 'tiny', body: 'round', colors: ['#ffd84d', '#fff6c8', '#3a3a5a'], snout: true },
  { id: 'tanuki', name: '実りタヌキ', ears: 'round', tail: 'stripe', body: 'round', colors: ['#a77b55', '#f1e0c6', '#4a3628'], mask: true },
  { id: 'kurage', name: '月クラゲ', ears: 'none', tail: 'tentacle', body: 'jelly', colors: ['#c8e6ff', '#ffffff', '#a0a6ff'], floating: true },
];

export function getSpecies(id: string): SpeciesDef {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0];
}
