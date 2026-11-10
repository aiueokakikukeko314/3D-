type Handler<T> = (payload: T) => void;

export interface GameEvents {
  toast: { text: string; icon?: string };
  inventoryChanged: void;
  coinsChanged: void;
  levelUp: { kind: string; level: number; label: string };
  islandAdded: { index: number };
  buildingsChanged: void;
  residentsChanged: void;
  settingsChanged: void;
  timeChanged: void;
  dayChanged: { dayKey: string };
}

class EventBus {
  private map = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(key: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.map.get(key);
    if (!set) {
      set = new Set();
      this.map.set(key, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof GameEvents>(key: K, payload?: GameEvents[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload as GameEvents[K]);
      } catch (e) {
        console.error('event handler error', key, e);
      }
    }
  }
}

export const events = new EventBus();

export function toast(text: string, icon?: string): void {
  events.emit('toast', { text, icon });
}
