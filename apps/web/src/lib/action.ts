import { createSignal } from "solid-js";

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Busy + error state around async UI actions. `run` clears the error, sets busy while `fn` runs,
 * and records its message if it throws (resolving to undefined instead of rejecting).
 */
export function createAction() {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setError("");
    try { return await fn(); } catch (e) { setError(errorText(e)); return undefined; } finally { setBusy(false); }
  }
  return { busy, error, setError, run };
}
