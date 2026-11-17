import {createSignal} from 'solid-js';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createAction() {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError('');
    try {
      return await fn();
    } catch (e) {
      setError(errorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return {busy, error, setError, run};
}
