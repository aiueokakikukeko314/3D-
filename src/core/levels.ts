/**
 * Unlimited level curve. XP needed to go from level n to n+1 = floor(100 * n^1.5).
 * Works for any number of levels (no cap).
 */
export function xpToNext(level: number): number {
  return Math.floor(100 * Math.pow(Math.max(1, level), 1.5));
}

export interface LevelInfo {
  level: number;
  into: number; // xp into current level
  need: number; // xp needed for next level
  ratio: number;
}

export function levelFromXp(totalXp: number, curveScale = 1): LevelInfo {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  // Fast skip for very large values
  for (;;) {
    const need = Math.floor(xpToNext(level) * curveScale);
    if (rest < need) return { level, into: rest, need, ratio: need > 0 ? rest / need : 0 };
    rest -= need;
    level++;
    if (level > 1_000_000) return { level, into: 0, need: 1, ratio: 0 };
  }
}

/** Title for a level, generated without cap. */
const TITLES = ['見習い', '駆け出し', '一人前', '熟練', '達人', '名人', '匠', '伝説', '雲上', '星詠み', '天の'];
export function titleForLevel(level: number, suffix: string): string {
  const tier = Math.floor((level - 1) / 10);
  const base = TITLES[Math.min(tier, TITLES.length - 1)];
  const extra = tier >= TITLES.length ? `${tier - TITLES.length + 2}代目` : '';
  return `${extra}${base}${suffix}`;
}

export function formatNum(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + '兆';
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '億';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return String(Math.floor(n));
}
