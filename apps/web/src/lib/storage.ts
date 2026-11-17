import { createSignal, type Signal } from "solid-js";

/**
 * localStorage that never throws (private mode, blocked site data). Only for per-browser
 * conveniences: anything here can disappear at any time.
 */
export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  getJson<T>(key: string, fallback: T): T {
    try { return JSON.parse(storage.get(key) ?? "") as T; } catch { return fallback; }
  },
  setJson(key: string, value: unknown) {
    storage.set(key, JSON.stringify(value));
  },
};

/** A string signal mirrored to localStorage. `valid` rejects stale or unknown stored values. */
export function createStoredSignal<T extends string>(key: string, fallback: T, valid: (v: string) => v is T = (_): _ is T => true): Signal<T> {
  const stored = storage.get(key);
  const [get, set] = createSignal<T>(stored != null && valid(stored) ? stored : fallback);
  const setAndStore = ((v: T) => { storage.set(key, v); return set(() => v); }) as Signal<T>[1];
  return [get, setAndStore];
}
