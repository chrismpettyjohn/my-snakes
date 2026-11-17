import { createSignal, For, Show } from "solid-js";
import type { LogEventType } from "@snake/shared";
import { api } from "../../lib/api";
import { LOG_STYLE } from "../../lib/art";
import { onDismiss } from "../../lib/dismiss";
import { Icon } from "../../lib/icons";

export type LogItem = { label: string; type: LogEventType };

/**
 * Header action menu: one-tap husbandry logging without opening the snake's sheet.
 * Groups expand in place (one open at a time); a single-item group is just a direct action.
 */
export const QUICK_LOG: { group: string; emoji: string; items: LogItem[] }[] = [
  { group: "Food", emoji: "🍽️", items: [{ label: "Ate", type: "feeding" }, { label: "Rejected", type: "refused" }] },
  { group: "Waste", emoji: "💩", items: [{ label: "Pooped", type: "poop" }, { label: "Urates", type: "urates" }] },
  { group: "Body", emoji: "✨", items: [{ label: "Shed", type: "shed" }] },
  { group: "Cleanup", emoji: "🧽", items: [{ label: "Water changed", type: "water" }, { label: "Cleanup performed", type: "cleaning" }] },
];

/** How long the ✓ shows before the menu closes. */
const CONFIRM_MS = 650;

/** Logs an event for a snake, shows a ✓ on its menu item briefly, then calls `close`. */
export function createLogger(p: { snakeId: () => string; onLogged?: () => void; close: () => void }) {
  const [done, setDone] = createSignal<LogEventType | null>(null);
  async function log(type: LogEventType) {
    await api(`/snakes/${p.snakeId()}/logs`, { body: { type } });
    setDone(type);
    p.onLogged?.();
    setTimeout(() => { setDone(null); p.close(); }, CONFIRM_MS);
  }
  const item = (it: LogItem) => (
    <button type="button" role="menuitem" disabled={!!done()} onClick={() => log(it.type)}>
      <span class="emoji">{done() === it.type ? "✓" : LOG_STYLE[it.type].emoji}</span>{it.label}
    </button>
  );
  return { item };
}

export function QuickLog(p: { snakeId: string; name: string; onLogged?: () => void }) {
  const [open, setOpen] = createSignal(false);
  const [group, setGroup] = createSignal<string | null>(null);
  let root: HTMLDivElement | undefined;
  const close = () => { setOpen(false); setGroup(null); };
  onDismiss(() => root, () => open() && close());
  const { item } = createLogger({ snakeId: () => p.snakeId, onLogged: () => p.onLogged?.(), close });

  return (
    // Stop pointerdown so pressing the menu never starts a header drag.
    <div class="log-menu-wrap" ref={root} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" class="icon-btn" aria-label={`Log for ${p.name}`} aria-haspopup="menu" aria-expanded={open()}
        onClick={() => open() ? close() : setOpen(true)}>{Icon.more()}</button>
      <Show when={open()}>
        <div class="user-dropdown log-menu" role="menu">
          <div class="log-menu-title">Activity Log</div>
          <For each={QUICK_LOG}>{(g) => g.items.length === 1 ? item(g.items[0]!) : (
            <div class={`log-group ${group() === g.group ? "open" : ""}`}>
              <button type="button" class="log-group-head" aria-expanded={group() === g.group}
                onClick={() => setGroup(group() === g.group ? null : g.group)}>
                <span class="emoji">{g.emoji}</span>{g.group}{Icon.chevron()}
              </button>
              <Show when={group() === g.group}>
                <div class="log-group-items" role="group" aria-label={g.group}><For each={g.items}>{item}</For></div>
              </Show>
            </div>
          )}</For>
        </div>
      </Show>
    </div>
  );
}
