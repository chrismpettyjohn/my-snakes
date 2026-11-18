import {api} from '../../lib/api';
import {ago} from '../../lib/format';
import {createAction} from '../../lib/action';
import {CopyCell, Section, Sheet} from '../../lib/ui';
import type {Bridge, CreatedBridge} from '@snake/shared';
import {Glyph, Icon, IconTile, TILE} from '../../lib/icons';
import {createResource, createSignal, For, Show} from 'solid-js';

const ONLINE_MS = 15 * 60_000;
const online = (b: Bridge) => !!b.lastSeenAt && Date.now() - new Date(b.lastSeenAt).getTime() < ONLINE_MS;

export function BridgeSection(p: {onChange: () => void; onError: (msg: string) => void}) {
  const [bridges, {refetch}] = createResource(() => api<Bridge[]>('/bridges'));
  const [created, setCreated] = createSignal<CreatedBridge | null>(null);
  const {busy, run} = createAction();
  const act = (fn: () => Promise<void>) =>
    run(async () => {
      p.onError('');
      try {
        await fn();
      } catch (e) {
        p.onError((e as Error).message);
      }
    });

  const add = () =>
    act(async () => {
      setCreated(await api<CreatedBridge>('/bridges', {method: 'POST'}));
    });
  const remove = (b: Bridge) =>
    confirm(`Remove ${b.hostname ?? 'this bridge'}? Its Herpstats stop reporting until another bridge picks them up.`) &&
    act(async () => {
      await api(`/bridges/${b.id}`, {method: 'DELETE'});
      void refetch();
    });

  return (
    <>
      <Section
        collapse="setup-bridge"
        title={
          <span class="st">
            <IconTile color={TILE.bridge}>{Glyph.plug()}</IconTile>
            Bridge
          </span>
        }
        foot={
          <>
            Herpstats can't send HTTPS, so a small bridge runs in Docker on a computer on the same network. It finds every Herpstat with{' '}
            <b>/RAWSTATUS</b> enabled (<b>Admin → Show Advanced Status Integration Options</b>), forwards its status to that unit's webhook, and
            starts again on boot.
          </>
        }
      >
        <For each={bridges()}>
          {b => (
            <div class="cell">
              <span class="tile-wrap">
                <IconTile color={TILE.bridge}>{Glyph.plug()}</IconTile>
                <span class={`dot mini ${online(b) ? '' : 'idle'}`} />
              </span>
              <span class="grow">
                <span class="title">{b.hostname ?? 'New bridge'}</span>
                <span class="detail">{b.lastSeenAt ? `checked in ${ago(b.lastSeenAt)}` : 'Waiting for first check-in'}</span>
              </span>
              <button type="button" class="icon-btn" aria-label="Remove bridge" title="Remove bridge" disabled={busy()} onClick={() => remove(b)}>
                {Icon.more()}
              </button>
            </div>
          )}
        </For>
        <button type="button" class="cell action" disabled={busy()} onClick={add}>
          Install Bridge…
        </button>
      </Section>

      <Show when={created()}>
        {c => (
          <Sheet
            open
            title="Install Bridge"
            onClose={() => {
              setCreated(null);
              void refetch();
              p.onChange();
            }}
          >
            <Section
              foot={
                <>
                  Needs Docker. Run one of these on a computer that stays on and shares a network with your Herpstats. The command holds a secret
                  token and is only shown once. Every Herpstat it finds is added here automatically.
                </>
              }
            >
              <CopyCell label="macOS / Linux" value={c().install.unix} />
              <CopyCell label="Windows (PowerShell)" value={c().install.windows} />
            </Section>
          </Sheet>
        )}
      </Show>
    </>
  );
}
