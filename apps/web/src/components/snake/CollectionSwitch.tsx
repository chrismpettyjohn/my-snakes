import {Show} from 'solid-js';
import {CollectionTile} from '../../lib/icons';
import {currentHome, homeId, homes, selectHome} from '../../lib/home';

export function CollectionSwitch() {
  const next = () => {
    const list = homes() ?? [];
    const i = list.findIndex(h => h.id === homeId());
    return list.length > 1 ? list[(i + 1) % list.length] : undefined;
  };
  return (
    <Show when={next()} fallback={<CollectionTile icon={currentHome()?.icon} color={currentHome()?.color} />}>
      {n => (
        <button
          type="button"
          class="coll-btn"
          aria-label={`Switch to ${n().name}`}
          title={`Switch to ${n().name}`}
          onClick={() => selectHome(n().id)}
        >
          <CollectionTile icon={currentHome()?.icon} color={currentHome()?.color} />
        </button>
      )}
    </Show>
  );
}
