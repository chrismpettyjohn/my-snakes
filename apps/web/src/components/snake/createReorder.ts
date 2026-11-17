import {createMemo, createSignal, onCleanup} from 'solid-js';

const DRAG_SLOP = 6;
const LONG_PRESS_MS = 350;
const EDGE_PX = 60;
const EDGE_SCROLL = 12;

export function createReorder<T extends {id: string}>(opts: {
  items: () => T[];
  container: () => HTMLElement;
  save: (ids: string[]) => Promise<unknown>;
}) {
  const [order, setOrder] = createSignal<string[] | null>(null);
  const [dragId, setDragId] = createSignal<string | null>(null);
  const rows = createMemo(() => {
    const list = opts.items();
    const o = order();
    if (!o) return list;
    const at = new Map(o.map((id, i) => [id, i]));
    return [...list].sort((a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity));
  });
  const currentIds = () => rows().map(r => r.id);

  let before = '';
  let pending: {id: string; x: number; y: number; touch: boolean; timer?: number} | null = null;
  let dragged = false;

  async function commit(ids: string[]) {
    if (ids.join() === before) return setOrder(null);
    try {
      await opts.save(ids);
    } finally {
      setOrder(null);
    }
  }

  const blockScroll = (e: TouchEvent) => {
    if (dragId()) e.preventDefault();
  };
  const listen = (on: boolean) => {
    if (on) {
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      window.addEventListener('touchmove', blockScroll, {passive: false});
    } else {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('touchmove', blockScroll);
    }
  };

  function press(e: PointerEvent, id: string) {
    if (e.button !== 0 || rows().length < 2) return;
    dragged = false;
    const touch = e.pointerType !== 'mouse';
    pending = {id, x: e.clientX, y: e.clientY, touch};
    if (touch) pending.timer = window.setTimeout(begin, LONG_PRESS_MS);
    listen(true);
  }

  function begin() {
    if (!pending) return;
    const {id, timer} = pending;
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
      if (pending.touch) return end();
      begin();
    }
    const id = dragId();
    if (!id) return;
    const el = opts.container();
    const others = [...el.querySelectorAll<HTMLElement>('.snake-row')].filter(r => r.dataset.id !== id);
    const wide = el.clientWidth * 0.75;
    const idx = others.filter(r => {
      const b = r.getBoundingClientRect();
      if (e.clientY > b.bottom) return true;
      if (e.clientY < b.top) return false;
      return b.width < wide ? e.clientX > b.left + b.width / 2 : e.clientY > b.top + b.height / 2;
    }).length;
    const ids = others.map(r => r.dataset.id!);
    ids.splice(idx, 0, id);
    if (ids.join() !== order()?.join()) setOrder(ids);
    if (e.clientY < EDGE_PX) window.scrollBy(0, -EDGE_SCROLL);
    else if (e.clientY > window.innerHeight - EDGE_PX) window.scrollBy(0, EDGE_SCROLL);
  }

  function end() {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    listen(false);
    if (!dragId()) return;
    setDragId(null);
    void commit(order() ?? []);
  }

  function keyMove(e: KeyboardEvent, id: string, refocus: (id: string) => void) {
    const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    const ids = currentIds();
    const i = ids.indexOf(id),
      j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    before = currentIds().join();
    setOrder(ids);
    void commit(ids);
    requestAnimationFrame(() => refocus(id));
  }

  onCleanup(end);

  return {rows, dragId, press, keyMove, wasDragged: () => dragged};
}
