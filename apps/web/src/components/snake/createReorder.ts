import { createMemo, createSignal, onCleanup } from "solid-js";

/** Pointer travel (px) before a mouse press becomes a drag. */
const DRAG_SLOP = 6;
/** Touch must hold this long before dragging, so a normal swipe still scrolls. */
const LONG_PRESS_MS = 350;
/** Auto-scroll when the pointer is this close to the top/bottom edge. */
const EDGE_PX = 60;
const EDGE_SCROLL = 12;

/**
 * Drag (and arrow-key) reordering of rows rendered as `.snake-row[data-id]` inside `container()`.
 * `rows` is the server order with any in-progress override applied; `save` persists a new order.
 */
export function createReorder<T extends { id: string }>(opts: {
  items: () => T[];
  container: () => HTMLElement;
  save: (ids: string[]) => Promise<unknown>;
}) {
  // `order` overrides the server order while dragging and until the saved order comes back.
  const [order, setOrder] = createSignal<string[] | null>(null);
  const [dragId, setDragId] = createSignal<string | null>(null);
  const rows = createMemo(() => {
    const list = opts.items();
    const o = order();
    if (!o) return list;
    const at = new Map(o.map((id, i) => [id, i]));
    return [...list].sort((a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity));
  });
  const currentIds = () => rows().map((r) => r.id);

  let before = "";
  let pending: { id: string; x: number; y: number; touch: boolean; timer?: number } | null = null;
  /** True right after a drag, so the click that follows it can be swallowed. */
  let dragged = false;

  async function commit(ids: string[]) {
    if (ids.join() === before) return setOrder(null);
    try { await opts.save(ids); } finally { setOrder(null); }
  }

  const blockScroll = (e: TouchEvent) => { if (dragId()) e.preventDefault(); };
  const listen = (on: boolean) => {
    if (on) {
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      window.addEventListener("touchmove", blockScroll, { passive: false });
    } else {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("touchmove", blockScroll);
    }
  };

  /** pointerdown on a row header: the whole header is the drag handle. */
  function press(e: PointerEvent, id: string) {
    if (e.button !== 0 || rows().length < 2) return;
    dragged = false;
    const touch = e.pointerType !== "mouse";
    pending = { id, x: e.clientX, y: e.clientY, touch };
    if (touch) pending.timer = window.setTimeout(begin, LONG_PRESS_MS);
    // Listen on window: reordering moves this row's DOM node, which can drop pointer capture.
    listen(true);
  }

  function begin() {
    if (!pending) return;
    const { id, timer } = pending;
    clearTimeout(timer);
    pending = null;
    dragged = true;
    before = currentIds().join();
    setOrder(currentIds());
    setDragId(id);
    navigator.vibrate?.(10);
  }

  function move(e: PointerEvent) {
    if (pending) {
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_SLOP) return;
      // Touch moved before the long-press fired: it's a scroll, not a drag.
      if (pending.touch) return end();
      begin();
    }
    const id = dragId();
    if (!id) return;
    // Insert the dragged row after every other row that comes before the pointer in reading order.
    // Rows on the pointer's line compare by x when laid out in columns (compact/mini/activity), else by y.
    const el = opts.container();
    const others = [...el.querySelectorAll<HTMLElement>(".snake-row")].filter((r) => r.dataset.id !== id);
    const wide = el.clientWidth * 0.75;
    const idx = others.filter((r) => {
      const b = r.getBoundingClientRect();
      if (e.clientY > b.bottom) return true;
      if (e.clientY < b.top) return false;
      return b.width < wide ? e.clientX > b.left + b.width / 2 : e.clientY > b.top + b.height / 2;
    }).length;
    const ids = others.map((r) => r.dataset.id!);
    ids.splice(idx, 0, id);
    if (ids.join() !== order()?.join()) setOrder(ids);
    if (e.clientY < EDGE_PX) window.scrollBy(0, -EDGE_SCROLL);
    else if (e.clientY > window.innerHeight - EDGE_PX) window.scrollBy(0, EDGE_SCROLL);
  }

  function end() {
    if (pending) { clearTimeout(pending.timer); pending = null; }
    listen(false);
    if (!dragId()) return;
    setDragId(null);
    void commit(order() ?? []);
  }

  /** ArrowUp / ArrowDown on a focused row moves it one place. */
  function keyMove(e: KeyboardEvent, id: string, refocus: (id: string) => void) {
    const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    const ids = currentIds();
    const i = ids.indexOf(id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    before = currentIds().join();
    setOrder(ids);
    void commit(ids);
    requestAnimationFrame(() => refocus(id));
  }

  onCleanup(end);

  return { rows, dragId, press, keyMove, wasDragged: () => dragged };
}
