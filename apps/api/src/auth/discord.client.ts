import {DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, WEB_URL} from '../config';

const API = 'https://discord.com/api/v10';
const REDIRECT_URI = `${WEB_URL}/auth/callback`;

const SCOPES = ['identify', 'email', 'guilds.join'];

export interface DiscordTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  email?: string | null;
  verified?: boolean;
}

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {...init, signal: AbortSignal.timeout(15_000)});
  const json = (await res.json().catch(() => ({}))) as T & {error_description?: string; message?: string};
  if (!res.ok) throw new Error(`Discord ${path}: ${res.status} ${json.error_description ?? json.message ?? ''}`.trim());
  return json;
}

export function exchangeCode(code: string): Promise<DiscordTokens> {
  return call('/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${DISCORD_CLIENT_ID}:${DISCORD_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI}),
  });
}

export function fetchMe(accessToken: string): Promise<DiscordUser> {
  return call('/users/@me', {headers: {Authorization: `Bearer ${accessToken}`}});
}

export const avatarUrl = (discordId: string | null, avatar: string | null) =>
  discordId && avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128` : null;
