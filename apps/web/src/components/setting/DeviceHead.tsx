import {Icon} from '../../lib/icons';
import {Show, type JSX} from 'solid-js';
import {onActivate} from '../../lib/ui';

export function DeviceHead(p: {
  expanded: boolean;
  onToggle: () => void;
  tile: JSX.Element;
  title: string;
  detail: string;
  badge?: JSX.Element;
  menuLabel: string;
  onMenu?: () => void;
}) {
  return (
    <div class="cell device-head" role="button" tabindex="0" aria-expanded={p.expanded} onClick={p.onToggle} onKeyDown={onActivate(p.onToggle)}>
      {p.tile}
      <span class="grow">
        <span class="title">{p.title}</span>
        <span class="detail">{p.detail}</span>
      </span>
      {p.badge}
      <Show when={p.onMenu}>
        {open => (
          <button
            type="button"
            class="icon-btn"
            aria-label={p.menuLabel}
            onClick={e => {
              e.stopPropagation();
              open()();
            }}
          >
            {Icon.more()}
          </button>
        )}
      </Show>
    </div>
  );
}
