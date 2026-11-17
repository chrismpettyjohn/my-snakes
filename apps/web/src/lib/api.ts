import {API_URL} from '../config';
import {storage} from './storage';
import {createResource, createSignal} from 'solid-js';
import type {AuthResponse, User} from '@snake/shared';

const TOKEN_KEY = 'snake.token';

const [token, setTokenSignal] = createSignal<string | null>(storage.get(TOKEN_KEY));
export {token};

export function setToken(t: string | null) {
  storage.set(TOKEN_KEY, t);
  setTokenSignal(t);
}

export const logout = () => setToken(null);

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: {method?: string; body?: unknown} = {}): Promise<T> {
  const t = token();
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      ...(init.body ? {'Content-Type': 'application/json'} : {}),
      ...(t ? {Authorization: `Bearer ${t}`} : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401 && t) setToken(null);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(res.status, typeof m === 'string' ? m : m?.fieldErrors ? JSON.stringify(m.fieldErrors) : res.statusText);
  }
  return data as T;
}

export const auth = {
  me: () => api<User>('/auth/me'),
  login: (email: string, password: string) => api<AuthResponse>('/auth/login', {body: {email, password}}),
  register: (email: string, password: string, displayName: string) => api<AuthResponse>('/auth/register', {body: {email, password, displayName}}),
};

export const [me] = createResource(token, () => auth.me());
