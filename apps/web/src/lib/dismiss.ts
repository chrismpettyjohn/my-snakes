import { onCleanup } from "solid-js";

/** Calls `close` on a press outside `root()` or on Escape, for popover menus. Cleans up with the owner. */
export function onDismiss(root: () => HTMLElement | undefined, close: () => void) {
  const onPress = (e: Event) => { const el = root(); if (el && !el.contains(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  document.addEventListener("pointerdown", onPress);
  document.addEventListener("keydown", onKey);
  onCleanup(() => { document.removeEventListener("pointerdown", onPress); document.removeEventListener("keydown", onKey); });
}
