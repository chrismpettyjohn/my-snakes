import {api} from '../../lib/api';
import {ago} from '../../lib/format';
import {Icon} from '../../lib/icons';
import {CopyCell} from '../../lib/ui';
import {createAction} from '../../lib/action';
import {createSignal, For, Show} from 'solid-js';
import type {Device, Webhook} from '@snake/shared';

export function WebhookCells(p: {d: Device; onChange: () => void; onError: (msg: string) => void}) {
  const [hooks, setHooks] = createSignal<Webhook[]>(p.d.webhooks ?? []);
  const {busy, run} = createAction();
  const base = `/devices/${p.d.id}/webhooks`;
  const act = (fn: () => Promise<void>) =>
    run(async () => {
      p.onError('');
      try {
        await fn();
        p.onChange();
      } catch (e) {
        p.onError((e as Error).message);
      }
    });

  const add = () =>
    act(async () => {
      const w = await api<Webhook>(base, {method: 'POST'});
      setHooks([...hooks(), w]);
    });
  const rotate = (id: string) =>
    act(async () => {
      const w = await api<Webhook>(`${base}/${id}/rotate-key`, {method: 'POST'});
      setHooks(hooks().map(h => (h.id === id ? w : h)));
    });
  const remove = (id: string) =>
    confirm('Remove this webhook? The Herpstat using it will stop reporting.') &&
    act(async () => {
      await api(`${base}/${id}`, {method: 'DELETE'});
      setHooks(hooks().filter(h => h.id !== id));
    });

  return (
    <>
      <For each={hooks()}>
        {(w, i) => (
          <>
            <CopyCell label={hooks().length > 1 ? `Webhook ${i() + 1} URL` : 'Webhook URL'} value={w.url} />
            <CopyCell
              label="API Key"
              value={w.apiKey}
              extra={
                <button
                  type="button"
                  class={`icon-btn ${busy() ? 'spin' : ''}`}
                  aria-label="Rotate API key"
                  title="Rotate API key"
                  disabled={busy()}
                  onClick={() => rotate(w.id)}
                >
                  {Icon.rotate()}
                </button>
              }
            />
            <button type="button" class="cell action danger" disabled={busy()} onClick={() => remove(w.id)}>
              Remove Webhook{w.lastReceivedAt ? ` · last used ${ago(w.lastReceivedAt)}` : ' · never used'}
            </button>
          </>
        )}
      </For>
      <Show when={!hooks().length}>
        <div class="cell">
          <span class="muted">No webhooks</span>
        </div>
      </Show>
      <button type="button" class="cell action" disabled={busy()} onClick={add}>
        New Webhook
      </button>
    </>
  );
}
