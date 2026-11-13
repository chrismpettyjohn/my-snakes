import { A } from "@solidjs/router";
import { createSignal, onCleanup, Show } from "solid-js";
import { me, setToken } from "./api";
import { Avatar } from "./ui";

export function UserMenu() {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;

  const onDoc = (e: MouseEvent) => { if (!root.contains(e.target as Node)) setOpen(false); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
  document.addEventListener("mousedown", onDoc);
  document.addEventListener("keydown", onKey);
  onCleanup(() => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); });

  return (
    <Show when={me()}>{(u) => (
      <div class="user-menu" ref={root}>
        <button type="button" class="user-btn" aria-haspopup="menu" aria-expanded={open()} onClick={() => setOpen(!open())}>
          <Avatar name={u().displayName} size={28} />
          <span class="user-name">{u().displayName}</span>
        </button>
        <Show when={open()}>
          <div class="user-dropdown" role="menu">
            <div class="user-head"><span class="title">{u().displayName}</span><span class="detail">{u().email}</span></div>
            <A href="/settings" role="menuitem" onClick={() => setOpen(false)}>Settings</A>
            <button type="button" role="menuitem" class="danger" onClick={() => { setOpen(false); setToken(null); }}>Log Out</button>
          </div>
        </Show>
      </div>
    )}</Show>
  );
}
