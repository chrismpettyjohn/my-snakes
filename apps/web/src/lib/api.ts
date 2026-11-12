import { createResource, createSignal } from "solid-js";
import type { AuthResponse } from "@snake/shared";
import { API_URL } from "../config";

const TOKEN_KEY = "snake.token";
const read = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };

const [token, setTokenSignal] = createSignal<string | null>(read());
export { token };

export function setToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  setTokenSignal(t);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401 && token()) setToken(null);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(res.status, typeof m === "string" ? m : m?.fieldErrors ? JSON.stringify(m.fieldErrors) : res.statusText);
  }
  return data as T;
}

export type Me = AuthResponse["user"];

export const auth = {
  me: () => api<Me>("/auth/me"),
  login: (email: string, password: string) => api<AuthResponse>("/auth/login", { body: { email, password } }),
  register: (email: string, password: string, displayName: string) =>
    api<AuthResponse>("/auth/register", { body: { email, password, displayName } }),
};

/** The signed-in user; refetches whenever the token changes. */
export const [me] = createResource(token, () => auth.me());
