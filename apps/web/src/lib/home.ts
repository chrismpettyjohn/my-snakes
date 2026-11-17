import { createResource } from "solid-js";
import type { Home } from "@snake/shared";
import { api, token } from "./api";
import { createStoredSignal } from "./storage";

const [selected, setSelected] = createStoredSignal<string>("snake.home", "");

export const [homes, { refetch: refetchHomes }] = createResource(token, () => api<Home[]>("/homes"));

/** Current home id: the remembered one if still accessible, else the first. */
export const homeId = () => {
  const list = homes() ?? [];
  return list.find((h) => h.id === selected())?.id ?? list[0]?.id ?? null;
};
export const currentHome = () => homes()?.find((h) => h.id === homeId());
export const isOwner = () => currentHome()?.role === "owner";

export const selectHome = (id: string) => setSelected(id);
