import { A } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { logout, me } from "./api";
import { onDismiss } from "./dismiss";
import { Avatar } from "./ui";

export function UserMenu() {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  onDismiss(() => root, () => setOpen(false));

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
            <button type="button" role="menuitem" class="danger" onClick={() => { setOpen(false); logout(); }}>Log Out</button>
          </div>
        </Show>
      </div>
    )}</Show>
  );
}
