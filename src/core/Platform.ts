import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

/** Key-value storage. Native: Capacitor Preferences, Web: localStorage. */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const r = await Preferences.get({ key });
        return r.value;
      } catch (e) {
        console.warn('Preferences.get failed', e);
      }
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key, value });
        return;
      } catch (e) {
        console.warn('Preferences.set failed', e);
      }
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
  async remove(key: string): Promise<void> {
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key });
        return;
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export async function haptic(kind: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (!isNative) {
    try {
      navigator.vibrate?.(kind === 'light' ? 10 : kind === 'medium' ? 25 : 50);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy });
  } catch {
    /* ignore */
  }
}

export interface AppHooks {
  onBack: () => boolean; // return true if handled
  onPause: () => void;
  onResume: () => void;
}

export async function setupNativeApp(hooks: AppHooks): Promise<void> {
  // visibility (web + native)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hooks.onPause();
    else hooks.onResume();
  });
  if (!isNative) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      if (!hooks.onBack()) App.minimizeApp();
    });
    App.addListener('pause', () => hooks.onPause());
    App.addListener('resume', () => hooks.onResume());
  } catch (e) {
    console.warn('App plugin unavailable', e);
  }
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch (e) {
    console.warn('orientation lock failed', e);
  }
}
