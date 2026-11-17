import { createEffect, createSignal, For, Show, type JSX } from "solid-js";
import { createAction } from "./action";
import { Icon } from "./icons";
import { storage } from "./storage";

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
    const open = storage.get(key) !== "closed";
    const onToggle = (e: Event) => storage.set(key, (e.currentTarget as HTMLDetailsElement).open ? "open" : "closed");
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

/** Page title row with actions on the right. Without a title, the actions still sit right-aligned. */
/** `lead` sits left of the title block and is stretched to its full height (title + sub). */
export function PageHead(p: { title?: JSX.Element; small?: boolean; sub?: JSX.Element; lead?: JSX.Element; children?: JSX.Element }) {
  const text = () => <><Show when={p.title}><h1>{p.title}</h1></Show><Show when={p.sub}><p>{p.sub}</p></Show></>;
  return (
    <header class={`page-head ${p.small ? "small" : ""}`}>
      <Show when={p.lead} fallback={<div>{text()}</div>}>
        <div class="page-head-lead"><span class="lead">{p.lead}</span><div>{text()}</div></div>
      </Show>
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

/** Colored initial avatar; hue is derived from the name so it's stable per person. */
export function Avatar(p: { name: string; size?: number }) {
  const hue = () => [...p.name].reduce((h, ch) => h + ch.charCodeAt(0) * 37, 0) % 360;
  return (
    <span class="person" style={{ background: `hsl(${hue()} 70% 60%)`, ...(p.size ? { width: `${p.size}px`, height: `${p.size}px`, "font-size": `${Math.round(p.size * 0.44)}px` } : {}) }}>
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Keyboard activation (Enter / Space) for a non-button element with role="button". */
export const onActivate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fn(); }
};

/** Value of a named field in the submitted form, trimmed. */
export const formValue = (e: SubmitEvent, name: string) =>
  String(new FormData(e.currentTarget as HTMLFormElement).get(name) ?? "").trim();

/**
 * A sheet wrapping one form: Done submits it, and a failed submit shows its error in the footer.
 * `after` renders below the form, for related content that isn't part of the submit.
 */
export function FormSheet(p: { open: boolean; title: string; onClose: () => void; onSubmit: (e: SubmitEvent) => Promise<unknown>; foot?: JSX.Element; after?: JSX.Element; children: JSX.Element }) {
  const { busy, error, setError, run } = createAction();
  let form!: HTMLFormElement;
  return (
    <Sheet open={p.open} title={p.title} onClose={() => { setError(""); p.onClose(); }}
      done={<button type="button" disabled={busy()} onClick={() => form.requestSubmit()}>Done</button>}>
      <form ref={form} onSubmit={(e) => { e.preventDefault(); void run(() => p.onSubmit(e)); }}>
        <Section foot={error() ? <span class="error">{error()}</span> : p.foot}>{p.children}</Section>
        <button hidden />
      </form>
      {p.after}
    </Sheet>
  );
}
