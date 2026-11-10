import { hashString, Rng } from './rng';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'starry';

export const SEASON_LABEL: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};
export const TOD_LABEL: Record<TimeOfDay, string> = {
  morning: '朝',
  day: '昼',
  evening: '夕方',
  night: '夜',
};
export const WEATHER_LABEL: Record<Weather, string> = {
  sunny: '晴れ',
  cloudy: 'くもり',
  rain: '雨',
  snow: '雪',
  starry: '星降り',
};
export const WEATHER_ICON: Record<Weather, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  starry: '🌠',
};

export interface TimeOverride {
  month: number; // 1-12
  hour: number; // 0-23.99
}

/**
 * Real-time clock. Everything in the game derives from here.
 * An override can be set from the settings (time preview).
 */
export class Clock {
  override: TimeOverride | null = null;

  now(): Date {
    const d = new Date();
    if (this.override) {
      d.setMonth(this.override.month - 1, Math.min(d.getDate(), 28));
      const h = Math.floor(this.override.hour);
      const m = Math.floor((this.override.hour - h) * 60);
      d.setHours(h, m, 0, 0);
    }
    return d;
  }

  /** fractional hour 0..24 */
  hour(): number {
    const d = this.now();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  month(): number {
    return this.now().getMonth() + 1;
  }

  season(): Season {
    const m = this.month();
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'autumn';
    return 'winter';
  }

  timeOfDay(h = this.hour()): TimeOfDay {
    if (h >= 5 && h < 10) return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 19) return 'evening';
    return 'night';
  }

  isNight(): boolean {
    return this.timeOfDay() === 'night';
  }

  /** Logical game day. A day starts at 5:00 so late nights count as the same day. */
  dayKey(d = this.now()): string {
    const t = new Date(d.getTime() - 5 * 3600 * 1000);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }

  /** 0..1 moon phase (0 = new moon) */
  moonPhase(): number {
    const ref = Date.UTC(2000, 0, 6, 18, 14);
    const days = (this.now().getTime() - ref) / 86400000;
    const p = (days % 29.530588) / 29.530588;
    return p < 0 ? p + 1 : p;
  }

  weather(): Weather {
    const key = this.dayKey();
    const rng = new Rng(hashString('weather' + key));
    const season = this.season();
    const r = rng.float();
    const night = this.isNight();
    if (season === 'winter') {
      if (r < 0.3) return 'snow';
      if (r < 0.45) return 'cloudy';
      if (night && r > 0.92) return 'starry';
      return 'sunny';
    }
    if (season === 'summer' && r < 0.12) return 'rain';
    if (season === 'spring' && r < 0.18) return 'rain';
    if (season === 'autumn' && r < 0.15) return 'rain';
    if (r < 0.32) return 'cloudy';
    if (night && r > 0.9) return 'starry';
    return 'sunny';
  }

  formatTime(): string {
    const d = this.now();
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

export const clock = new Clock();
