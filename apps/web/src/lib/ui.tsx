import { createEffect, createSignal, For, Show, type JSX } from "solid-js";

/** Modal sheet: bottom sheet on phones, centered card on larger screens. */
export function Sheet(p: { open: boolean; onClose: () => void; title?: string; done?: JSX.Element; closeButton?: boolean; children: JSX.Element }) {
  let el!: HTMLDialogElement;
  createEffect(() => {
    if (p.open && !el.open) el.showModal();
    else if (!p.open && el.open) el.close();
  });
  return (
    <dialog ref={el} class="sheet" onClose={() => p.open && p.onClose()}
      onClick={(e) => e.target === el && p.onClose()}>
      <Show when={p.open}>
        <header class="sheet-bar">
          <Show when={p.closeButton !== false} fallback={<div />}>
            <button type="button" onClick={p.onClose}>{p.done ? "Cancel" : "Close"}</button>
          </Show>
          <h2>{p.title}</h2>
          <div>{p.done}</div>
        </header>
        <div class="sheet-body">{p.children}</div>
      </Show>
    </dialog>
  );
}

/** `expand` turns the row into an accordion that reveals extra cells instead of running an action. */
export type Action = { label: string; danger?: boolean } & ({ run: () => void; expand?: never } | { expand: () => JSX.Element; run?: never });

/** iOS-style action sheet. Dismissed by tapping outside or Escape. */
export function ActionSheet(p: { open: boolean; onClose: () => void; title?: string; actions: Action[] }) {
  const [openLabel, setOpenLabel] = createSignal<string | null>(null);
  createEffect(() => { if (!p.open) setOpenLabel(null); });
  return (
    <Sheet open={p.open} onClose={p.onClose} title={p.title} closeButton={false}>
      <div class="group">
        <For each={p.actions}>{(a) => (
          <>
            <button type="button" class={`cell action ${a.danger ? "danger" : ""}`} aria-expanded={a.expand ? openLabel() === a.label : undefined}
              onClick={() => {
                if (a.expand) setOpenLabel(openLabel() === a.label ? null : a.label);
                else { p.onClose(); a.run(); }
              }}>{a.label}</button>
            <Show when={a.expand && openLabel() === a.label}>{a.expand!()}</Show>
          </>
        )}</For>
      </div>
    </Sheet>
  );
}

/** Inset grouped list. With `collapse` (a stable key) it becomes an accordion; open/closed is remembered per browser. */
export function Section(p: { title?: JSX.Element; foot?: JSX.Element; collapse?: string; children: JSX.Element }) {
  if (p.collapse) {
    const key = `section:${p.collapse}`;
    let open = true;
    try { open = localStorage.getItem(key) !== "closed"; } catch { /* ignore */ }
    const onToggle = (e: Event) => {
      try { localStorage.setItem(key, (e.currentTarget as HTMLDetailsElement).open ? "open" : "closed"); } catch { /* ignore */ }
    };
    return (
      <details class="section more" open={open} onToggle={onToggle}>
        <summary class="section-title"><span class="section-head">{p.title}</span>{Icon.chevron()}</summary>
        <div class="group">{p.children}</div>
        <Show when={p.foot}><p class="section-foot">{p.foot}</p></Show>
      </details>
    );
  }
  return (
    <section class="section">
      <Show when={p.title}><div class="section-title">{p.title}</div></Show>
      <div class="group">{p.children}</div>
      <Show when={p.foot}><p class="section-foot">{p.foot}</p></Show>
    </section>
  );
}

export function PageHead(p: { title: string; sub?: JSX.Element; children?: JSX.Element }) {
  return (
    <header class="page-head">
      <div><h1>{p.title}</h1><Show when={p.sub}><p>{p.sub}</p></Show></div>
      {p.children}
    </header>
  );
}

export function Segmented<T extends string>(p: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div class="segmented" role="radiogroup">
      <For each={p.options}>{(o) => (
        <button type="button" role="radio" aria-checked={p.value === o} class={p.value === o ? "on" : ""} onClick={() => p.onChange(o)}>{o}</button>
      )}</For>
    </div>
  );
}

/** Tap to copy. `extra` renders a trailing control (e.g. an icon button) beside the Copy label. */
export function CopyCell(p: { label: string; value: string; extra?: JSX.Element }) {
  const [done, setDone] = createSignal(false);
  return (
    <div class="cell copy-cell">
      <button type="button" class="copy-hit" onClick={async () => {
        try { await navigator.clipboard.writeText(p.value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ }
      }}>
        <span class="grow"><span class="title">{p.label}</span><span class="detail mono">{p.value}</span></span>
        <span class="value" style={{ color: "var(--tint)" }}>{done() ? "Copied" : "Copy"}</span>
      </button>
      {p.extra}
    </div>
  );
}

/* Icons (SF Symbols–style strokes) */
const svg = (d: JSX.Element) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>
);
export const Icon = {
  snake: () => svg(<><path d="M4 18c0 1.7 1.3 3 3 3h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6a3 3 0 0 0 3-3V5" /><circle cx="18" cy="3.5" r=".6" fill="currentColor" /></>),
  setup: () => svg(<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>),
  grid: () => svg(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  rows: () => svg(<><rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" /></>),
  dots: () => svg(<>{[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <rect x={x - 2} y={y - 2} width="4" height="4" rx="1" />))}</>),
  clock: () => svg(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></>),
  plus: () => svg(<path d="M12 5v14M5 12h14" />),
  more: () => svg(<><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>),
  chevron: () => <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>,
  rotate: () => svg(<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>),
  check: () => <svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>,
};

/** Colored initial avatar; hue is derived from the name so it's stable per person. */
export function Avatar(p: { name: string; size?: number }) {
  const hue = () => [...p.name].reduce((h, ch) => h + ch.charCodeAt(0) * 37, 0) % 360;
  return (
    <span class="person" style={{ background: `hsl(${hue()} 70% 60%)`, ...(p.size ? { width: `${p.size}px`, height: `${p.size}px`, "font-size": `${Math.round(p.size * 0.44)}px` } : {}) }}>
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
