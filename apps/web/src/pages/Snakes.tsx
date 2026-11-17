import { createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { A } from "@solidjs/router";
import type { Snake, SnakeStatus } from "@snake/shared";
import { api } from "../lib/api";
import { EmptyScene, SnakePic } from "../lib/art";
import { plural } from "../lib/format";
import { homeId } from "../lib/home";
import { Icon } from "../lib/icons";
import { storage, createStoredSignal } from "../lib/storage";
import { PageHead, Sheet } from "../lib/ui";
import { createReorder } from "../components/snake/createReorder";
import { QuickLog } from "../components/snake/QuickLog";
import { SnakeForm } from "../components/snake/SnakeForm";
import { SnakeSheet } from "../components/snake/SnakeSheet";
import { ZonePicker, type ZonePick } from "../components/snake/ZonePicker";
import { VIEWS, Zones, isView } from "../components/snake/Zones";

const STATUS_REFRESH_MS = 30_000;
const COLLAPSED_KEY = "collapsed";

export default function Snakes() {
  const [status, { refetch: refetchStatus }] = createResource(homeId, (id) => api<SnakeStatus[]>(`/homes/${id}/status`));
  const [snakes, { refetch: refetchSnakes }] = createResource(homeId, (id) => api<Snake[]>(`/homes/${id}/snakes`));
  const timer = setInterval(refetchStatus, STATUS_REFRESH_MS);
  onCleanup(() => clearInterval(timer));
  const refresh = () => { refetchStatus(); refetchSnakes(); };
  const byId = createMemo(() => new Map((snakes() ?? []).map((a) => [a.id, a])));

  const [openId, setOpenId] = createSignal<string | null>(null);
  const [adding, setAdding] = createSignal(false);
  const [pick, setPick] = createSignal<ZonePick | null>(null);

  // Collapsed rows and the layout are per-browser conveniences; everything is expanded by default.
  const [collapsed, setCollapsed] = createSignal(new Set(storage.getJson<string[]>(COLLAPSED_KEY, [])));
  const toggle = (id: string) => {
    const next = new Set(collapsed());
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
    storage.setJson(COLLAPSED_KEY, [...next]);
  };
  const [view, setView] = createStoredSignal("view", "full", isView);
  const viewIdx = () => VIEWS.findIndex((v) => v.id === view());
  const nextView = () => VIEWS[(viewIdx() + 1) % VIEWS.length]!;

  let rowsEl!: HTMLDivElement;
  const reorder = createReorder({
    items: () => status() ?? [],
    container: () => rowsEl,
    save: async (ids) => {
      await api(`/homes/${homeId()}/snakes/order`, { method: "PUT", body: { ids } });
      await refetchStatus();
      refetchSnakes();
    },
  });
  const focusRow = (id: string) => rowsEl.querySelector<HTMLElement>(`.snake-row[data-id="${id}"] .snake-toggle`)?.focus();

  const title = () => {
    const n = status()?.length;
    return n == null ? "Snakes" : plural(n, "Snake");
  };

  return (
    <>
      <PageHead title={title()}>
        <Show when={status()?.length}>
          {/* One button cycles Full → Compact → Mini → Activity; its icon shows the current view. */}
          <button type="button" class="btn gray round" onClick={() => setView(nextView().id)}
            aria-label={`${VIEWS[viewIdx()]!.label} view. Switch to ${nextView().label.toLowerCase()} view`} title={`${VIEWS[viewIdx()]!.label} view`}>
            {VIEWS[viewIdx()]!.icon()}
          </button>
        </Show>
        <button class="btn" onClick={() => setAdding(true)}>{Icon.plus()}Add</button>
      </PageHead>

      <Show when={status()?.length === 0}>
        <div class="empty">
          <EmptyScene />
          <h2>Add your first snake</h2>
          <p>Give it a name, then link its warm side, cold side, basking and RHP sensors in <A href="/settings">Settings</A>.</p>
          <button class="btn" onClick={() => setAdding(true)}>Add snake</button>
        </div>
      </Show>

      <div class={`rows ${view()}`} ref={rowsEl}>
        <For each={reorder.rows()}>{(s) => (
          <section data-id={s.id} class={`snake-row ${s.alerts.length ? "alerting" : ""} ${reorder.dragId() === s.id ? "dragging" : ""}`}>
            {/* Header: avatar opens the snake's sheet, the name collapses the row, and the whole header is the drag handle. */}
            <div class={`snake-head ${collapsed().has(s.id) ? "collapsed" : ""}`}
              onPointerDown={(e) => reorder.press(e, s.id)} onContextMenu={(e) => reorder.dragId() && e.preventDefault()}>
              <button type="button" class="snake-open" aria-label={`Open ${s.name}`} onClick={() => !reorder.wasDragged() && setOpenId(s.id)}>
                <SnakePic s={s} size={44} sad={s.alerts.length > 0} />
              </button>
              <button type="button" class="snake-toggle" aria-expanded={!collapsed().has(s.id)}
                aria-keyshortcuts="ArrowUp ArrowDown" onClick={() => !reorder.wasDragged() && toggle(s.id)}
                onKeyDown={(e) => reorder.keyMove(e, s.id, focusRow)}>
                <span class="snake-name">
                  <span class="name">{s.name}</span>
                </span>
                <span class="sub">{s.species || "Species not set"}</span>
              </button>
              <QuickLog snakeId={s.id} name={s.name} onLogged={refetchStatus} />
            </div>
            <Show when={!collapsed().has(s.id)}>
              <Zones s={s} snake={byId().get(s.id)} view={view()} onPick={(role) => setPick({ s, role })} onOpen={() => setOpenId(s.id)} />
            </Show>
          </section>
        )}</For>
      </div>

      <SnakeSheet status={status()?.find((s) => s.id === openId())} snake={openId() ? byId().get(openId()!) : undefined}
        onClose={() => setOpenId(null)} onChange={refresh} onPick={(s, role) => setPick({ s, role })} />
      <ZonePicker pick={pick()} onClose={() => setPick(null)} onChange={refresh} />
      <Sheet open={adding()} onClose={() => setAdding(false)} title="New Snake">
        <SnakeForm onDone={() => { setAdding(false); refresh(); }} />
      </Sheet>
    </>
  );
}
