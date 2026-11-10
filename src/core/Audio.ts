import { gfx } from './Graphics';
import type { TimeOfDay, Season } from './Clock';

type Sfx = 'pick' | 'click' | 'coin' | 'splash' | 'reel' | 'success' | 'fail' | 'hit' | 'miss' | 'build' | 'levelup' | 'talk' | 'star' | 'bloom' | 'light';

// pentatonic scales by time of day
const SCALES: Record<TimeOfDay, number[]> = {
  morning: [0, 2, 4, 7, 9, 12, 14],
  day: [0, 2, 4, 7, 9, 12, 16],
  evening: [0, 3, 5, 7, 10, 12, 15],
  night: [0, 2, 3, 7, 8, 12, 14],
};
const ROOT: Record<Season, number> = { spring: 64, summer: 67, autumn: 62, winter: 60 };

/** Synthesized ambient music + sound effects with WebAudio (no files). */
export class AudioSys {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private bgmGain!: GainNode;
  private sfxGain!: GainNode;
  private nextNote = 0;
  private step = 0;
  private tod: TimeOfDay = 'day';
  private season: Season = 'spring';
  private padOsc: OscillatorNode[] = [];
  private paused = false;
  private bgmEnabled = true;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(c.destination);
    this.bgmGain = c.createGain();
    this.sfxGain = c.createGain();
    this.bgmGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.applyVolume();
    // soft pad
    const padGain = c.createGain();
    padGain.gain.value = 0.035;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    padGain.connect(lp).connect(this.bgmGain);
    for (const det of [0, 7, 12]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = midi(48 + det);
      o.connect(padGain);
      o.start();
      this.padOsc.push(o);
    }
    this.nextNote = c.currentTime + 0.5;
  }

  applyVolume(): void {
    if (!this.ctx) return;
    this.bgmGain.gain.value = this.bgmEnabled ? gfx.bgm * 0.5 : 0;
    this.sfxGain.gain.value = gfx.sfx * 0.7;
  }

  setBgmEnabled(on: boolean): void {
    this.bgmEnabled = on;
    this.applyVolume();
  }

  setMood(tod: TimeOfDay, season: Season): void {
    if (tod === this.tod && season === this.season) return;
    this.tod = tod;
    this.season = season;
    if (!this.ctx) return;
    const root = ROOT[season] - 12;
    const chord = tod === 'night' || tod === 'evening' ? [0, 3, 7] : [0, 4, 7];
    this.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(midi(root - 12 + chord[i]), this.ctx!.currentTime, 1.5));
  }

  pause(): void {
    this.paused = true;
    void this.ctx?.suspend();
  }
  resume(): void {
    this.paused = false;
    void this.ctx?.resume();
  }

  /** schedule ambient arpeggio notes */
  update(): void {
    const c = this.ctx;
    if (!c || this.paused || !this.bgmEnabled || gfx.bgm <= 0) return;
    const tempo = this.tod === 'night' ? 0.55 : this.tod === 'day' ? 0.38 : 0.45;
    while (this.nextNote < c.currentTime + 0.3) {
      const sc = SCALES[this.tod];
      const root = ROOT[this.season];
      const pattern = [0, 2, 4, 1, 3, 5, 2, 6];
      const play = Math.random() < (this.tod === 'night' ? 0.55 : 0.75);
      if (play) {
        const deg = sc[(pattern[this.step % 8] + Math.floor(this.step / 16)) % sc.length];
        this.note(midi(root + deg), this.nextNote, tempo * 2.2, this.tod === 'night' ? 'sine' : 'triangle', 0.06, this.bgmGain);
        if (this.step % 8 === 0) this.note(midi(root - 12 + sc[0]), this.nextNote, tempo * 6, 'sine', 0.05, this.bgmGain);
      }
      this.step++;
      this.nextNote += tempo;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  sfx(kind: Sfx): void {
    const c = this.ctx;
    if (!c || gfx.sfx <= 0) return;
    const t = c.currentTime;
    const d = this.sfxGain;
    switch (kind) {
      case 'pick':
        this.note(880, t, 0.12, 'sine', 0.2, d);
        this.note(1320, t + 0.06, 0.15, 'sine', 0.15, d);
        break;
      case 'click':
        this.note(660, t, 0.06, 'square', 0.05, d);
        break;
      case 'coin':
        this.note(988, t, 0.1, 'square', 0.06, d);
        this.note(1319, t + 0.08, 0.25, 'square', 0.06, d);
        break;
      case 'splash':
        this.noise(t, 0.35, 0.2, 1200);
        break;
      case 'reel':
        this.note(440 + Math.random() * 80, t, 0.05, 'sawtooth', 0.03, d);
        break;
      case 'success':
        [0, 4, 7, 12].forEach((s, i) => this.note(midi(72 + s), t + i * 0.09, 0.3, 'triangle', 0.15, d));
        break;
      case 'fail':
        this.note(330, t, 0.2, 'triangle', 0.12, d);
        this.note(262, t + 0.15, 0.35, 'triangle', 0.12, d);
        break;
      case 'hit':
        this.note(1046, t, 0.08, 'triangle', 0.15, d);
        break;
      case 'miss':
        this.note(196, t, 0.1, 'square', 0.05, d);
        break;
      case 'build':
        this.noise(t, 0.08, 0.15, 400);
        this.noise(t + 0.15, 0.08, 0.15, 500);
        this.note(523, t + 0.3, 0.3, 'triangle', 0.12, d);
        break;
      case 'levelup':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.note(midi(67 + s), t + i * 0.07, 0.4, 'triangle', 0.12, d));
        break;
      case 'talk':
        for (let i = 0; i < 3; i++) this.note(500 + Math.random() * 300, t + i * 0.06, 0.05, 'sine', 0.06, d);
        break;
      case 'star':
        this.note(1568, t, 0.2, 'sine', 0.1, d);
        this.note(2093, t + 0.05, 0.3, 'sine', 0.08, d);
        break;
      case 'bloom':
        this.note(784, t, 0.2, 'sine', 0.12, d);
        this.note(988, t + 0.08, 0.25, 'sine', 0.1, d);
        break;
      case 'light':
        [0, 7, 12, 19].forEach((s, i) => this.note(midi(60 + s), t + i * 0.12, 1.2, 'sine', 0.1, d));
        break;
    }
  }

  private noise(t: number, dur: number, vol: number, freq: number): void {
    const c = this.ctx!;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  /** a short beat for the cooking game */
  beat(t: number, accent: boolean): void {
    if (!this.ctx) return;
    this.note(accent ? 880 : 660, t, 0.05, 'square', 0.04, this.sfxGain);
  }
}

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export const audio = new AudioSys();
