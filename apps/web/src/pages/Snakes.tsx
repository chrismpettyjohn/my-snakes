import { createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { ROLE_LABEL, SENSOR_ROLES, type SnakeStatus, type SensorRole, type Zone } from "@snake/shared";
import { api } from "../lib/api";
import { homeId } from "../lib/home";
import { ago } from "../lib/format";
import { findSpecies, SPECIES, type SpeciesPreset } from "../lib/species";
import { Icon, PageHead, Section, Segmented, Sheet } from "../lib/ui";
import { EmptyScene, Glyph, IconTile, LOG_STYLE, SnakePic } from "../lib/art";
import type { Device, DeviceList } from "./Settings";

export interface Snake {
  id: string; name: string; species: string | null; morph: string | null; sex: "male" | "female" | "unknown";
  hatchDate: string | null; notes: string | null; photo: string | null;
  minTempF: number | null; maxTempF: number | null; minHumidity: number | null; maxHumidity: number | null;
}
interface Log { id: string; type: string; at: string; value: number | null; notes: string | null }
type Reading = SnakeStatus["readings"][number];

const LOG_LABEL = LOG_STYLE;

const subtitle = (a: { species: string | null; morph: string | null }) => [a.species, a.morph].filter(Boolean).join(" · ");

const g = (d: JSX.Element) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>
);
/** SF Symbols–style glyphs per zone. */
const ZONE_GLYPH: Record<SensorRole, () => JSX.Element> = {
  warm: () => g(<><path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" /><path d="M12 9v7" /></>),
  cold: () => g(<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />),
  bask: () => g(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z" /></>),
  rhp: () => g(<><rect x="3" y="4" width="18" height="6" rx="1.5" /><path d="M7 14c0 1.5 1.2 1.5 1.2 3S7 18.5 7 20M12 14c0 1.5 1.2 1.5 1.2 3S12 18.5 12 20M17 14c0 1.5 1.2 1.5 1.2 3S17 18.5 17 20" /></>),
};

/** One enclosure zone tile: temperature, plus humidity (ambient) or heater power (basking / RHP). */
function ZoneCard(p: { role: SensorRole; z?: Zone; onOpen: () => void }) {
  const heat = p.role === "bask" || p.role === "rhp";
  const detail = () => {
    const z = p.z;
    if (!z) return "Not linked";
    if (z.stale && z.at) return `Updated ${ago(z.at)}`;
    if (heat) return [z.powerPct != null && `${Math.round(z.powerPct)}% power`, z.setpointF != null && `Set ${z.setpointF}°`].filter(Boolean).join(" · ") || "\u00a0";
    return z.humidity != null ? `${Math.round(z.humidity)}% humidity` : "\u00a0";
  };
  return (
    <button type="button" class={`zone ${p.role} ${p.z?.bad ? "bad" : ""} ${p.z?.stale ? "stale" : ""} ${p.z ? "" : "empty"}`}
      onClick={p.onOpen} title={p.z?.at ? `Updated ${ago(p.z.at)}` : undefined}>
      <span class="zone-top">
        <span class="zone-ic">{ZONE_GLYPH[p.role]()}</span>
        <Show when={p.z?.tempF != null}><span class="zone-v">{p.z!.tempF!.toFixed(1)}<small>°</small></span></Show>
      </span>
      <span class="zone-text">
        <span class="zone-l">{ROLE_LABEL[p.role]}</span>
        <span class="zone-sub">{detail()}</span>
      </span>
      <Show when={heat && p.z?.powerPct != null}>
        <span class="power"><span style={{ width: `${Math.min(100, Math.max(0, p.z!.powerPct!))}%` }} /></span>
      </Show>
    </button>
  );
}

/**
 * Safety rating for one reading against a [lo, hi] range: outside → "bad"; inside but within the
 * margin of either edge → "warn"; otherwise "ok". The margin is 15% of the range's width, but at
 * least `minMargin` (2°F / 5% RH), so narrow ranges still get a usable warning band.
 */
type Health = "ok" | "warn" | "bad";
const HEALTH_RANK: Record<Health, number> = { ok: 0, warn: 1, bad: 2 };
function rate(v: number | null, lo: number | null | undefined, hi: number | null | undefined, minMargin: number): Health | null {
  if (v == null || (lo == null && hi == null)) return null;
  if ((lo != null && v < lo) || (hi != null && v > hi)) return "bad";
  const m = lo != null && hi != null ? Math.max(minMargin, (hi - lo) * 0.15) : minMargin;
  if ((lo != null && v < lo + m) || (hi != null && v > hi - m)) return "warn";
  return "ok";
}

/**
 * Mini view: one tile averaging the warm & cold ambient sensors. Its colour rates the averaged temp
 * and humidity (worse of the two wins). Ranges come from the snake's own alert thresholds, falling
 * back to its species' recommended ranges.
 */
function ClimateCard(p: { s: SnakeStatus; snake?: Snake; onOpen: () => void }) {
  const zs = () => [p.s.zones.warm, p.s.zones.cold].filter((z): z is Zone => !!z);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const temp = () => avg(zs().map((z) => z.tempF));
  const rh = () => avg(zs().map((z) => z.humidity));
  const stale = () => zs().length > 0 && zs().every((z) => z.stale);
  const health = (): Health | null => {
    const a = p.snake, sp = findSpecies(p.s.species);
    const r = {
      minT: a?.minTempF ?? sp?.minTempF, maxT: a?.maxTempF ?? sp?.maxTempF,
      minH: a?.minHumidity ?? sp?.minHumidity, maxH: a?.maxHumidity ?? sp?.maxHumidity,
    };
    const all = [rate(temp(), r.minT, r.maxT, 2), rate(rh(), r.minH, r.maxH, 5)].filter((h): h is Health => h != null);
    return all.length ? all.reduce((w, h) => (HEALTH_RANK[h] > HEALTH_RANK[w] ? h : w)) : null;
  };
  return (
    <button type="button" class={`zone climate ${health() ?? ""} ${stale() ? "stale" : ""} ${zs().length ? "" : "empty"}`}
      onClick={p.onOpen}>
      <span class="zone-top"><span class="zone-ic">{ZONE_GLYPH.warm()}</span></span>
      <span class="zone-text">
        <span class="zone-v">{temp() != null ? <>{temp()!.toFixed(1)}<small>°</small></> : "—"}</span>
        <span class="zone-sub">{!zs().length ? "Not linked" : rh() != null ? `${Math.round(rh()!)}% humidity` : "\u00a0"}</span>
      </span>
    </button>
  );
}

/** Elapsed time as one compact unit: "45m", "6h", "3d". */
function since(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const latest = (...xs: (string | undefined)[]) => xs.filter((x): x is string => !!x).sort().at(-1);

/**
 * Activity view: how long since the snake was last fed, its enclosure cleaned, and it last passed
 * waste. Each tile shows the elapsed time big, and the date (plus any caveat) underneath.
 */
const ACTIVITY: { key: string; label: string; style: string; at: (l: SnakeStatus["lastLog"]) => string | undefined; sub: (l: SnakeStatus["lastLog"], at: string) => string }[] = [
  {
    key: "fed", label: "Fed", style: "feeding", at: (l) => l.feeding,
    // A refusal after the last meal is the thing worth knowing.
    sub: (l, at) => l.refused && l.refused > at ? `Refused ${ago(l.refused)}` : day(at),
  },
  { key: "clean", label: "Cleaned", style: "cleaning", at: (l) => l.cleaning, sub: (_, at) => day(at) },
  {
    key: "waste", label: "Waste", style: "poop", at: (l) => latest(l.poop, l.urates),
    sub: (l, at) => `${at === l.poop ? "Poop" : "Urates"} · ${day(at)}`,
  },
];

function ActivityCard(p: { a: (typeof ACTIVITY)[number]; s: SnakeStatus; onOpen: () => void }) {
  const at = () => p.a.at(p.s.lastLog ?? {});
  const st = LOG_STYLE[p.a.style];
  return (
    <button type="button" class={`zone activity-tile ${at() ? "" : "empty"}`} style={{ "--c": st.color }} onClick={p.onOpen}
      title={at() ? new Date(at()!).toLocaleString() : undefined}>
      <span class="zone-top">
        <span class="zone-ic">{st.emoji}</span>
        <Show when={at()}>{(t) => <span class="zone-v">{since(t())}</span>}</Show>
      </span>
      <span class="zone-text">
        <span class="zone-l">{p.a.label}</span>
        <span class="zone-sub">{at() ? p.a.sub(p.s.lastLog, at()!) : "Not logged"}</span>
      </span>
    </button>
  );
}

const VIEWS: { id: View; label: string; icon: () => JSX.Element }[] = [
  { id: "full", label: "Full", icon: () => Icon.rows() },
  { id: "compact", label: "Compact", icon: () => Icon.grid() },
  { id: "mini", label: "Mini", icon: () => Icon.dots() },
  { id: "activity", label: "Activity", icon: () => Icon.clock() },
];
export type View = "full" | "compact" | "mini" | "activity";
// Compact view only shows the ambient zones (warm/cold sides).
const COMPACT_ROLES: SensorRole[] = ["warm", "cold"];

function Zones(p: { s: SnakeStatus; snake?: Snake; view?: View; onPick: (role: SensorRole) => void; onOpen?: () => void }) {
  return (
    <div class="zones">
      <Switch fallback={
        <For each={p.view === "compact" ? COMPACT_ROLES : SENSOR_ROLES}>{(r) => <ZoneCard role={r} z={p.s.zones[r]} onOpen={() => p.onPick(r)} />}</For>
      }>
        <Match when={p.view === "mini"}><ClimateCard s={p.s} snake={p.snake} onOpen={() => p.onOpen?.()} /></Match>
        <Match when={p.view === "activity"}><For each={ACTIVITY}>{(a) => <ActivityCard a={a} s={p.s} onOpen={() => p.onOpen?.()} />}</For></Match>
      </Switch>
    </div>
  );
}

/** Thermostat outputs drive heat zones; air sensors read the ambient ones. */
const ROLE_KIND: Record<SensorRole, Device["kind"]> = { warm: "govee", cold: "govee", bask: "herpstat", rhp: "herpstat" };

/** Pick which device channel feeds one zone of one snake's enclosure. */
function ZonePicker(p: { pick: { s: SnakeStatus; role: SensorRole } | null; onClose: () => void; onChange: () => void }) {
  // Keyed on the pick so each open shows current assignments.
  const [data] = createResource(() => p.pick && { id: homeId(), pick: p.pick }, ({ id }) => api<DeviceList>(`/homes/${id}/devices`));
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const chans = () => {
    const pk = p.pick;
    if (!pk) return [];
    return (data()?.devices ?? []).filter((d) => d.kind === ROLE_KIND[pk.role])
      .flatMap((d) => d.channels.map((c) => ({ d, c })));
  };
  const isCurrent = (c: Device["channels"][number]) => c.snakeIds.includes(p.pick!.s.id) && c.role === p.pick!.role;
  const assign = (d: Device, c: Device["channels"][number], snakeIds: string[], role: SensorRole | null) =>
    api("/sensor-assignments", { method: "PUT", body: { deviceId: d.id, channel: c.channel, snakeIds, role: snakeIds.length ? role : null } });

  async function choose(target: { d: Device; c: Device["channels"][number] } | null) {
    const { s, role } = p.pick!;
    setBusy(true); setError("");
    try {
      // Unlink whatever currently feeds this zone (other snakes on that channel keep it).
      for (const { d, c } of chans()) {
        if (isCurrent(c) && c !== target?.c) await assign(d, c, c.snakeIds.filter((id) => id !== s.id), c.role);
      }
      if (target && !isCurrent(target.c)) {
        const { d, c } = target;
        // A channel shared by a rack keeps its other snakes only if it already measures this zone.
        await assign(d, c, c.role === role ? [...new Set([...c.snakeIds, s.id])] : [s.id], role);
      }
      p.onChange(); p.onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const devices = () => (data()?.devices ?? []).filter((d) => p.pick && d.kind === ROLE_KIND[p.pick.role] && d.channels.length);
  const herp = () => !!p.pick && ROLE_KIND[p.pick.role] === "herpstat";
  const linked = () => chans().some(({ c }) => isCurrent(c));
  /** Who else a channel already serves, so sharing a rack output is visible before you tap. */
  const sharedWith = (c: Device["channels"][number]) => {
    const others = c.snakeIds.filter((id) => id !== p.pick?.s.id).length;
    return others ? `Also used by ${others} other snake${others === 1 ? "" : "s"}` : undefined;
  };

  return (
    <Sheet open={!!p.pick} onClose={() => { setError(""); p.onClose(); }} title="Sensor">
      <Show when={p.pick}>{(pk) => (
        <div>
          <div class={`pick-hero ${pk().role}`}>
            <span class="zone-ic">{ZONE_GLYPH[pk().role]()}</span>
            <h1>{ROLE_LABEL[pk().role]}</h1>
            <p>{pk().s.name}<Show when={devices().length}> · {herp() ? "Choose a Herpstat output" : "Choose a Govee sensor"}</Show></p>
          </div>

          <For each={devices()}>{(d) => (
            <Section title={<span class="st">
              <IconTile color={herp() ? "linear-gradient(135deg,#ffb340,#ff7a00)" : "linear-gradient(135deg,#7ad7ff,#32ade6)"}>
                {herp() ? Glyph.thermostat() : Glyph.droplet()}
              </IconTile>{d.name}</span>}>
              <For each={d.channels}>{(c) => (
                <button type="button" class={`cell ${isCurrent(c) ? "on" : ""}`} disabled={busy()} onClick={() => choose({ d, c })}
                  style={{ "--c": `var(--zone-${pk().role})` }}>
                  <span class="chan-ic">{herp() ? Glyph.plug() : Glyph.droplet()}</span>
                  <span class="grow">
                    <span class="title">{c.label ?? c.channel}</span>
                    <Show when={sharedWith(c)}>{(t) => <span class="detail">{t()}</span>}</Show>
                  </span>
                  <Show when={isCurrent(c)}>{Icon.check()}</Show>
                </button>
              )}</For>
            </Section>
          )}</For>

          <Section foot={error() ? <span class="error">{error()}</span>
            : <>Add or rename devices in <A href="/settings" onClick={p.onClose}>Settings</A>.</>}>
            <button type="button" class="cell" disabled={busy()} onClick={() => choose(null)}>
              <span class="grow">None</span>
              <Show when={data() && !linked()}>{Icon.check()}</Show>
            </button>
          </Section>
        </div>
      )}</Show>
    </Sheet>
  );
}

export default function Snakes() {
  const [status, { refetch: refetchStatus }] = createResource(homeId, (id) => api<SnakeStatus[]>(`/homes/${id}/status`));
  const [snakes, { refetch: refetchSnakes }] = createResource(homeId, (id) => api<Snake[]>(`/homes/${id}/snakes`));
  const t = setInterval(refetchStatus, 30_000);
  onCleanup(() => clearInterval(t));

  const [openId, setOpenId] = createSignal<string | null>(null);
  // Collapsed rows are a per-browser convenience; everything is expanded by default.
  const [collapsed, setCollapsed] = createSignal(new Set<string>((() => {
    try { return JSON.parse(localStorage.getItem("collapsed") ?? "[]") as string[]; } catch { return []; }
  })()));
  const toggle = (id: string) => {
    const next = new Set(collapsed());
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
    try { localStorage.setItem("collapsed", JSON.stringify([...next])); } catch { /* ignore */ }
  };
  // Full / compact / mini / activity layout, remembered per browser.
  const [view, setViewSig] = createSignal<View>((() => {
    try { const v = localStorage.getItem("view"); return VIEWS.some((x) => x.id === v) ? v as View : "full"; } catch { return "full"; }
  })());
  const setView = (v: View) => {
    setViewSig(v);
    try { localStorage.setItem("view", v); } catch { /* ignore */ }
  };
  const [adding, setAdding] = createSignal(false);
  const [pick, setPick] = createSignal<{ s: SnakeStatus; role: SensorRole } | null>(null);
  const byId = createMemo(() => new Map((snakes() ?? []).map((a) => [a.id, a])));
  const refresh = () => { refetchStatus(); refetchSnakes(); };

  // ----- Drag to reorder -----
  // `order` overrides the server order while dragging and until the saved order comes back.
  const [order, setOrder] = createSignal<string[] | null>(null);
  const [dragId, setDragId] = createSignal<string | null>(null);
  const rows = createMemo(() => {
    const list = status() ?? [];
    const o = order();
    if (!o) return list;
    const at = new Map(o.map((id, i) => [id, i]));
    return [...list].sort((a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity));
  });
  let rowsEl!: HTMLDivElement;
  let before = "";
  onCleanup(() => endDrag());

  async function saveOrder(ids: string[]) {
    if (ids.join() === before) return;
    try {
      await api(`/homes/${homeId()}/snakes/order`, { method: "PUT", body: { ids } });
      await refetchStatus();
      refetchSnakes();
    } finally { setOrder(null); }
  }
  // The whole row header is the drag handle. Mouse: drag once the pointer moves a few px.
  // Touch: long-press first, so a normal swipe still scrolls the page.
  let pending: { id: string; x: number; y: number; touch: boolean; timer?: number } | null = null;
  let dragged = false; // swallow the click that follows a drag
  const blockScroll = (e: TouchEvent) => { if (dragId()) e.preventDefault(); };
  function pressHead(e: PointerEvent, id: string) {
    if (e.button !== 0 || rows().length < 2) return;
    dragged = false;
    const touch = e.pointerType !== "mouse";
    pending = { id, x: e.clientX, y: e.clientY, touch };
    if (touch) pending.timer = window.setTimeout(beginDrag, 350);
    // Listen on window: reordering moves this row's DOM node, which can drop pointer capture.
    window.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("touchmove", blockScroll, { passive: false });
  }
  function beginDrag() {
    if (!pending) return;
    const { id, timer } = pending;
    clearTimeout(timer);
    pending = null;
    dragged = true;
    const ids = rows().map((r) => r.id);
    before = ids.join();
    setOrder(ids);
    setDragId(id);
    navigator.vibrate?.(10);
  }
  function moveDrag(e: PointerEvent) {
    if (pending) {
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < 6) return;
      // Touch moved before the long-press fired: it's a scroll, not a drag.
      if (pending.touch) return endDrag();
      beginDrag();
    }
    const id = dragId();
    if (!id) return;
    // Insert the dragged row after every other row that comes before the pointer in reading order.
    // Rows on the pointer's line compare by x when laid out in columns (compact/mini/activity), else by y.
    const others = [...rowsEl.querySelectorAll<HTMLElement>(".snake-row")].filter((el) => el.dataset.id !== id);
    const wide = rowsEl.clientWidth * 0.75;
    const idx = others.filter((el) => {
      const r = el.getBoundingClientRect();
      if (e.clientY > r.bottom) return true;
      if (e.clientY < r.top) return false;
      return r.width < wide ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    }).length;
    const ids = others.map((el) => el.dataset.id!);
    ids.splice(idx, 0, id);
    if (ids.join() !== order()?.join()) setOrder(ids);
    // Nudge the page when dragging near the top/bottom edge.
    const edge = 60;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }
  function endDrag() {
    if (pending) { clearTimeout(pending.timer); pending = null; }
    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("touchmove", blockScroll);
    if (!dragId()) return;
    setDragId(null);
    saveOrder(order() ?? []);
  }
  function keyMove(e: KeyboardEvent, id: string) {
    const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    const ids = rows().map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    before = rows().map((r) => r.id).join();
    setOrder(ids);
    saveOrder(ids);
    requestAnimationFrame(() => rowsEl.querySelector<HTMLElement>(`.snake-row[data-id="${id}"] .snake-toggle`)?.focus());
  }

  const title = () => {
    const n = status()?.length;
    return n == null ? "Snakes" : `${n} Snake${n === 1 ? "" : "s"}`;
  };

  return (
    <>
      <PageHead title={title()}>
        <Show when={status()?.length}>
          {(() => {
            // One button cycles Full → Compact → Mini → Activity; its icon shows the current view.
            const i = () => VIEWS.findIndex((v) => v.id === view());
            const next = () => VIEWS[(i() + 1) % VIEWS.length];
            return (
              <button type="button" class="btn gray round" onClick={() => setView(next().id)}
                aria-label={`${VIEWS[i()].label} view. Switch to ${next().label.toLowerCase()} view`} title={`${VIEWS[i()].label} view`}>
                {VIEWS[i()].icon()}
              </button>
            );
          })()}
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
        <For each={rows()}>{(s) => (
          <section data-id={s.id} class={`snake-row ${s.alerts.length ? "alerting" : ""} ${dragId() === s.id ? "dragging" : ""}`}>
            {/* Row label: sits on the page background, outside the cards. */}
            {/* Accordion header: tap to collapse/expand this snake's zones. */}
            {/* Avatar opens the snake's sheet; the rest of the header collapses the row. */}
            {/* The whole header is also the drag handle for reordering. */}
            <div class={`snake-head ${collapsed().has(s.id) ? "collapsed" : ""}`}
              onPointerDown={(e) => pressHead(e, s.id)} onContextMenu={(e) => dragId() && e.preventDefault()}>
              <button type="button" class="snake-open" aria-label={`Open ${s.name}`} onClick={() => !dragged && setOpenId(s.id)}>
                <SnakePic s={s} size={44} sad={s.alerts.length > 0} />
              </button>
              <button type="button" class="snake-toggle" aria-expanded={!collapsed().has(s.id)}
                aria-keyshortcuts="ArrowUp ArrowDown" onClick={() => !dragged && toggle(s.id)} onKeyDown={(e) => keyMove(e, s.id)}>
                <span class="snake-name">
                  <span class="name">{s.name}</span>
                </span>
                <span class="sub">{s.species || "Species not set"}</span>
              </button>
              <QuickLog snakeId={s.id} name={s.name} onLogged={refetchStatus} />
            </div>
            <Show when={!collapsed().has(s.id)}><Zones s={s} snake={byId().get(s.id)} view={view()} onPick={(role) => setPick({ s, role })} onOpen={() => setOpenId(s.id)} /></Show>
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

// Header action menu: one-tap husbandry logging without opening the snake's sheet.
// Groups expand in place (one open at a time); a single-item group is just a direct action.
const QUICK_LOG: { group: string; emoji: string; items: { label: string; type: string }[] }[] = [
  { group: "Food", emoji: "🍽️", items: [{ label: "Ate", type: "feeding" }, { label: "Rejected", type: "refused" }] },
  { group: "Waste", emoji: "💩", items: [{ label: "Pooped", type: "poop" }, { label: "Urates", type: "urates" }] },
  { group: "Body", emoji: "✨", items: [{ label: "Shed", type: "shed" }] },
  { group: "Cleaning", emoji: "🧽", items: [{ label: "Water changed", type: "water" }, { label: "Cleanup performed", type: "cleaning" }] },
];

function QuickLog(p: { snakeId: string; name: string; onLogged?: () => void }) {
  const [open, setOpen] = createSignal(false);
  const [done, setDone] = createSignal<string | null>(null);
  const [group, setGroup] = createSignal<string | null>(null);
  let root!: HTMLDivElement;
  const close = () => { setOpen(false); setGroup(null); };
  const onDoc = (e: PointerEvent) => { if (open() && !root.contains(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => { if (open() && e.key === "Escape") close(); };
  document.addEventListener("pointerdown", onDoc);
  document.addEventListener("keydown", onKey);
  onCleanup(() => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); });

  async function log(type: string) {
    await api(`/snakes/${p.snakeId}/logs`, { body: { type } });
    setDone(type);
    p.onLogged?.();
    setTimeout(() => { setDone(null); close(); }, 650);
  }
  const item = (it: { label: string; type: string }) => (
    <button type="button" role="menuitem" disabled={!!done()} onClick={() => log(it.type)}>
      <span class="emoji">{done() === it.type ? "✓" : LOG_LABEL[it.type]?.emoji}</span>{it.label}
    </button>
  );

  return (
    // Stop pointerdown so pressing the menu never starts a header drag.
    <div class="log-menu-wrap" ref={root} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" class="icon-btn" aria-label={`Log for ${p.name}`} aria-haspopup="menu" aria-expanded={open()}
        onClick={() => open() ? close() : setOpen(true)}>{Icon.more()}</button>
      <Show when={open()}>
        <div class="user-dropdown log-menu" role="menu">
          <div class="log-menu-title">Activity Log</div>
          <For each={QUICK_LOG}>{(g) => g.items.length === 1 ? item(g.items[0]) : (
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

function SnakeSheet(p: { status?: SnakeStatus; snake?: Snake; onClose: () => void; onChange: () => void; onPick: (s: SnakeStatus, role: SensorRole) => void }) {
  const [editing, setEditing] = createSignal(false);
  const close = () => { setEditing(false); p.onClose(); };
  return (
    <Sheet open={!!p.status} onClose={close} title={editing() ? "Edit" : ""}
      done={editing() ? undefined : <button type="button" onClick={() => setEditing(true)}>Edit</button>}>
      <Show when={p.status}>{(s) => (
        <Show when={!editing()} fallback={
          <SnakeForm snake={p.snake} onDone={(deleted) => { setEditing(false); p.onChange(); if (deleted) p.onClose(); }} />
        }>
          <div class="sheet-hero">
            <SnakePic s={s()} size={88} sad={s().alerts.length > 0} class="hero-avatar" />
            <h1>{s().name}</h1>
            <Show when={subtitle(s())}><p class="muted">{subtitle(s())}</p></Show>
            <Show when={s().alerts.length}>
              <div class="alerts" role="alert">
                <For each={s().alerts}>{(a) => <div class="alert-banner"><span class="alert-ic">⚠️</span><span class="grow">{a}</span></div>}</For>
              </div>
            </Show>
            <Zones s={s()} onPick={(role) => p.onPick(s(), role)} />
          </div>
          <CareLog snakeId={s().id} />
          <Show when={p.snake && (p.snake.minTempF != null || p.snake.minHumidity != null)}>
            <Section title="Alert ranges">
              <div class="cell"><span class="log-ic" style={{ "--c": "#ff9f0a" }}>🌡️</span><span class="grow">Ambient temperature</span><span class="value">{p.snake!.minTempF ?? "–"}–{p.snake!.maxTempF ?? "–"}°F</span></div>
              <div class="cell"><span class="log-ic" style={{ "--c": "#64d2ff" }}>💧</span><span class="grow">Ambient humidity</span><span class="value">{p.snake!.minHumidity ?? "–"}–{p.snake!.maxHumidity ?? "–"}%</span></div>
            </Section>
          </Show>
          <Show when={findSpecies(s().species)}>{(sp) => <Recommended sp={sp()} />}</Show>
          <Show when={!Object.keys(s().zones).length}>
            <Section foot={<>Link sensors to {s().name} in <A href="/settings" onClick={close}>Settings</A>.</>}>
              <div class="cell"><span class="grow muted">No zones linked</span></div>
            </Section>
          </Show>
        </Show>
      )}</Show>
    </Sheet>
  );
}

/** The two most recent husbandry logs. */
function CareLog(p: { snakeId: string }) {
  const [logs] = createResource(() => p.snakeId, (id) => api<Log[]>(`/snakes/${id}/logs`));
  return (
    <div class="activity">
      <Section title="Activity Log">
        <Show when={logs()?.length} fallback={<div class="cell activity-empty"><span class="muted">{logs.loading ? "\u00a0" : "No logs yet"}</span></div>}>
          <For each={logs()!.slice(0, 2)}>{(l) => (
            <div class="cell">
              <span class="log-ic" style={{ "--c": LOG_LABEL[l.type]?.color ?? "#8e8e93" }}>{LOG_LABEL[l.type]?.emoji ?? "•"}</span>
              <span class="grow"><span class="title">
                {LOG_LABEL[l.type]?.label ?? l.type}{l.value != null ? ` · ${l.value} g` : ""}{l.notes ? ` · ${l.notes}` : ""}
              </span></span>
              <span class="value">{ago(l.at)}</span>
            </div>
          )}</For>
        </Show>
      </Section>
    </div>
  );
}

/** The species' healthy baseline: what to program into the Herpstat, and the Govee alarm ranges. */
function Recommended(p: { sp: SpeciesPreset }) {
  const h = p.sp.herpstat;
  const row = (label: string, value: string) => <div class="cell"><span class="grow">{label}</span><span class="value">{value}</span></div>;
  /** Parent row with indented day/night child rows underneath. */
  const split = (label: string, day: number, night: number) => (
    <>
      <div class="cell parent"><span class="grow">{label}</span></div>
      <div class="cell child"><span class="grow">Day</span><span class="value">{day}°F</span></div>
      <div class="cell child"><span class="grow">Night</span><span class="value">{night}°F</span></div>
    </>
  );
  return (
    <>
      <Section title={`Herpstat · ${p.sp.name}`} foot="Recommended thermostat program for this species.">
        {split("Basking", h.baskDay, h.baskNight)}
        {split("RHP", h.rhpDay, h.rhpNight)}
        {row("Alarms", `${h.lowAlarm}–${h.highAlarm}°F`)}
      </Section>
      <Section title="Govee alarms">
        {row("Temperature", `${p.sp.minTempF}–${p.sp.maxTempF}°F`)}
        {row("Humidity", `${p.sp.minHumidity}–${p.sp.maxHumidity}%`)}
      </Section>
    </>
  );
}

/** Add (name + species) or edit. Species presets fill the alert ranges; everything else is tucked away. */
function SnakeForm(p: { snake?: Snake; onDone: (deleted?: boolean) => void }) {
  const a = p.snake;
  const [species, setSpecies] = createSignal(a?.species ?? "");
  const [name, setName] = createSignal(a?.name ?? "");
  const [morph, setMorph] = createSignal(a?.morph ?? findSpecies(a?.species)?.morphs[0] ?? "");
  const morphs = () => findSpecies(species())?.morphs ?? [];
  const [sex, setSex] = createSignal<Snake["sex"]>(a?.sex ?? "unknown");
  const [range, setRange] = createSignal({
    minTempF: a?.minTempF ?? null, maxTempF: a?.maxTempF ?? null, minHumidity: a?.minHumidity ?? null, maxHumidity: a?.maxHumidity ?? null,
  });
  const [custom, setCustom] = createSignal(!!a?.species && !findSpecies(a.species));
  const [photo, setPhoto] = createSignal<string | null>(a?.photo ?? null);
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const pickSpecies = (v: string) => {
    if (v === "__other") { setCustom(true); setSpecies(""); return; }
    setCustom(false); setSpecies(v);
    const preset = findSpecies(v);
    setMorph(preset?.morphs[0] ?? "");
    if (preset) applyPreset(preset);
  };
  const applyPreset = (p: SpeciesPreset) =>
    setRange({ minTempF: p.minTempF, maxTempF: p.maxTempF, minHumidity: p.minHumidity, maxHumidity: p.maxHumidity });
  const num = (k: keyof ReturnType<typeof range>) => (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement).value;
    setRange({ ...range(), [k]: v === "" ? null : Number(v) });
  };

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const f = new FormData(e.currentTarget as HTMLFormElement);
    const s = (k: string) => (String(f.get(k) ?? "").trim() || undefined);
    const body = {
      name: s("name"), species: species().trim() || undefined, morph: morph().trim() || undefined, sex: sex(),
      hatchDate: s("hatchDate") ?? null, notes: s("notes"), photo: photo(), ...range(),
    };
    setBusy(true); setError("");
    try {
      if (a) await api(`/snakes/${a.id}`, { method: "PUT", body });
      else await api(`/homes/${homeId()}/snakes`, { body });
      p.onDone();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function remove() {
    if (!a || !confirm(`Delete ${a.name} and its history?`)) return;
    await api(`/snakes/${a.id}`, { method: "DELETE" });
    p.onDone(true);
  }

  return (
    <form onSubmit={save}>
      <div class="form-avatar">
        <label class="photo-pick">
          <SnakePic s={{ name: name(), species: species(), morph: morph(), photo: photo() }} size={96} />
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (f) { try { setPhoto(await toThumb(f)); } catch { setError("Couldn't read that image"); } }
          }} />
          <span class="photo-btn">{photo() ? "Change Photo" : "Add Photo"}</span>
        </label>
        <Show when={photo()}><button type="button" class="link-btn" onClick={() => setPhoto(null)}>Remove photo</button></Show>
      </div>
      <Section>
        <label class="cell"><input name="name" required placeholder="Name" value={a?.name ?? ""} autofocus={!a} onInput={(e) => setName(e.currentTarget.value)} /></label>
        <label class="cell">
          <span class="grow">Species</span>
          <select value={custom() ? "__other" : species()} onChange={(e) => pickSpecies(e.currentTarget.value)}>
            <option value="">Not set</option>
            <For each={SPECIES}>{(sp) => <option value={sp.name}>{sp.name}</option>}</For>
            <option value="__other">Other…</option>
          </select>
        </label>
        <Show when={morphs().length > 1}>
          <div class="cell"><span class="label">Morph</span><Segmented value={morph()} options={morphs()} onChange={setMorph} /></div>
        </Show>
        <Show when={morphs().length === 1}>
          <div class="cell"><span class="grow">Morph</span><span class="value">{morphs()[0]}</span></div>
        </Show>
        <Show when={custom()}>
          <label class="cell"><input placeholder="Species name" value={species()} onInput={(e) => setSpecies(e.currentTarget.value)} /></label>
        </Show>
      </Section>

      <details class="section more" open={!!a}>
        <summary class="section-title"><span>Details</span>{Icon.chevron()}</summary>
        <div class="group">
          <Show when={!morphs().length}>
            <label class="cell"><span class="label">Morph</span><input placeholder="Optional" value={morph()} onInput={(e) => setMorph(e.currentTarget.value)} /></label>
          </Show>
          <div class="cell"><span class="label">Sex</span><Segmented value={sex()} options={["unknown", "male", "female"] as const} onChange={setSex} /></div>
          <label class="cell"><span class="label">Hatched</span><input name="hatchDate" type="date" value={a?.hatchDate ?? ""} /></label>
          <label class="cell"><textarea name="notes" rows="2" placeholder="Notes">{a?.notes ?? ""}</textarea></label>
        </div>
      </details>

      <details class="section more">
        <summary class="section-title"><span>Alert ranges</span>{Icon.chevron()}</summary>
        <div class="group">
          <label class="cell"><span class="grow">Min temperature</span><input class="value" style={{ "text-align": "right", flex: "0 0 72px" }} type="number" step="0.1" inputmode="decimal" placeholder="°F" value={range().minTempF ?? ""} onInput={num("minTempF")} /></label>
          <label class="cell"><span class="grow">Max temperature</span><input class="value" style={{ "text-align": "right", flex: "0 0 72px" }} type="number" step="0.1" inputmode="decimal" placeholder="°F" value={range().maxTempF ?? ""} onInput={num("maxTempF")} /></label>
          <label class="cell"><span class="grow">Min humidity</span><input class="value" style={{ "text-align": "right", flex: "0 0 72px" }} type="number" inputmode="numeric" placeholder="%" value={range().minHumidity ?? ""} onInput={num("minHumidity")} /></label>
          <label class="cell"><span class="grow">Max humidity</span><input class="value" style={{ "text-align": "right", flex: "0 0 72px" }} type="number" inputmode="numeric" placeholder="%" value={range().maxHumidity ?? ""} onInput={num("maxHumidity")} /></label>
        </div>
        <p class="section-foot">
          Picking a species fills these in. You'll get an alert when a linked sensor reads outside them.
          <Show when={findSpecies(species())}>{(sp) => <> <button type="button" class="link" onClick={() => applyPreset(sp())}>Reset to {sp().name} defaults</button></>}</Show>
        </p>
      </details>

      <Show when={error()}><p class="error" style={{ "margin-bottom": "12px" }}>{error()}</p></Show>
      <button class="btn block" disabled={busy()}>{a ? "Save" : "Add Snake"}</button>
      <Show when={a}>
        <button type="button" class="btn block gray danger" style={{ "margin-top": "12px" }} onClick={remove}>Delete Snake</button>
      </Show>
    </form>
  );
}

/** Center-crop to a 320px square JPEG data URL so photos stay small enough to store inline. */
async function toThumb(file: File, size = 320): Promise<string> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.82);
}
