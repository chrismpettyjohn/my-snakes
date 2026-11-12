import { createResource, createSignal } from "solid-js";
import type { Home } from "@snake/shared";
import { api, token } from "./api";

const KEY = "snake.home";
const [selected, setSelected] = createSignal<string | null>((() => { try { return localStorage.getItem(KEY); } catch { return null; } })());

export const [homes, { refetch: refetchHomes }] = createResource(token, () => api<Home[]>("/homes"));

/** Current home id: the remembered one if still accessible, else the first. */
export const homeId = () => {
  const list = homes() ?? [];
  return list.find((h) => h.id === selected())?.id ?? list[0]?.id ?? null;
};
export const currentHome = () => homes()?.find((h) => h.id === homeId());

export function selectHome(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  setSelected(id);
}
