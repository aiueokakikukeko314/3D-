import './ui/styles.css';
import { Game } from './core/Game';
import { gs } from './systems/State';
import { loadGraphics } from './core/Graphics';
import { isNative } from './core/Platform';
import { audio } from './core/Audio';

async function boot(): Promise<void> {
  const msg = document.getElementById('loading-msg')!;
  const loading = document.getElementById('loading')!;
  try {
    await loadGraphics();
    const hadSave = await gs.load();
    const game = new Game();
    await game.start(!hadSave);
    (window as unknown as { game: Game }).game = game;
    if (import.meta.env.DEV) {
      const life = await import('./systems/Life');
      (window as unknown as { dev: unknown }).dev = { gs, life };
    }
    msg.textContent = '';
    const btn = document.createElement('button');
    btn.className = 'start';
    btn.textContent = hadSave ? 'つづきから' : 'はじめる';
    btn.onclick = () => {
      audio.unlock();
      loading.style.opacity = '0';
      setTimeout(() => loading.remove(), 600);
    };
    loading.append(btn);
  } catch (e) {
    console.error(e);
    msg.textContent = 'エラーが起きました: ' + (e instanceof Error ? e.message : String(e));
  }
}

void boot();

// PWA offline support (web only)
if (!isNative && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
