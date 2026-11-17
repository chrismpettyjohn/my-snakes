import {createSignal, type Signal} from 'solid-js';

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  },
  getJson<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(storage.get(key) ?? '') as T;
    } catch {
      return fallback;
    }
  },
  setJson(key: string, value: unknown) {
    storage.set(key, JSON.stringify(value));
  },
};

export function createStoredSignal<T extends string>(key: string, fallback: T, valid: (v: string) => v is T = (_): _ is T => true): Signal<T> {
  const stored = storage.get(key);
  const [get, set] = createSignal<T>(stored != null && valid(stored) ? stored : fallback);
  const setAndStore = ((v: T) => {
    storage.set(key, v);
    return set(() => v);
  }) as Signal<T>[1];
  return [get, setAndStore];
}
