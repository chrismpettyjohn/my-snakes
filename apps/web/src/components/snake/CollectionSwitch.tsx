import { Show } from "solid-js";
import { currentHome, homeId, homes, selectHome } from "../../lib/home";
import { CollectionTile } from "../../lib/icons";

/** Collection tile beside the page title: each tap jumps straight to the next collection. */
export function CollectionSwitch() {
  const next = () => {
    const list = homes() ?? [];
    const i = list.findIndex((h) => h.id === homeId());
    return list.length > 1 ? list[(i + 1) % list.length] : undefined;
  };
  return (
    <Show when={next()} fallback={<CollectionTile icon={currentHome()?.icon} color={currentHome()?.color} />}>{(n) => (
      // Switching collections re-mounts the page (see Layout), so its data reloads.
      <button type="button" class="coll-btn" aria-label={`Switch to ${n().name}`} title={`Switch to ${n().name}`}
        onClick={() => selectHome(n().id)}>
        <CollectionTile icon={currentHome()?.icon} color={currentHome()?.color} />
      </button>
    )}</Show>
  );
}
