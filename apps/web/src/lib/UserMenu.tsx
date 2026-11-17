import {Avatar} from './ui';
import {Icon} from './icons';
import {logout, me} from './api';
import {A} from '@solidjs/router';
import {onDismiss} from './dismiss';
import {createSignal, For, Show} from 'solid-js';
import {homeId, homes, selectHome} from './home';

export function UserMenu() {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  onDismiss(
    () => root,
    () => setOpen(false),
  );

  return (
    <Show when={me()}>
      {u => (
        <div class="user-menu" ref={root}>
          <button type="button" class="user-btn" aria-haspopup="menu" aria-expanded={open()} onClick={() => setOpen(!open())}>
            <Avatar name={u().displayName} size={28} />
            <span class="user-name">{u().displayName}</span>
          </button>
          <Show when={open()}>
            <div class="user-dropdown" role="menu">
              <div class="user-head">
                <span class="title">{u().displayName}</span>
                <span class="detail">{u().email}</span>
              </div>
              <Show when={(homes()?.length ?? 0) > 1}>
                <div class="menu-label">Collections</div>
                <For each={homes()}>
                  {h => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={h.id === homeId()}
                      class="menu-check"
                      onClick={() => {
                        selectHome(h.id);
                        setOpen(false);
                      }}
                    >
                      <span class="grow">{h.name}</span>
                      <Show when={h.id === homeId()}>{Icon.check()}</Show>
                    </button>
                  )}
                </For>
                <div class="menu-sep" />
              </Show>
              <A href="/settings" role="menuitem" onClick={() => setOpen(false)}>
                Settings
              </A>
              <button
                type="button"
                role="menuitem"
                class="danger"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
              >
                Log Out
              </button>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
