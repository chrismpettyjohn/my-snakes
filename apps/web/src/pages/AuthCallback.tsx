import {onMount} from 'solid-js';
import {storage} from '../lib/storage';
import {OAUTH_STATE_KEY} from './Login';
import {refetchHomes} from '../lib/home';
import {api, setToken} from '../lib/api';
import type {AuthResponse} from '@snake/shared';
import {useNavigate, useSearchParams} from '@solidjs/router';

export default function AuthCallback() {
  const nav = useNavigate();
  const [params] = useSearchParams<{code?: string; state?: string; error?: string}>();
  const fail = (msg: string) => nav(`/login?error=${encodeURIComponent(msg)}`, {replace: true});

  onMount(async () => {
    const expected = storage.get(OAUTH_STATE_KEY);
    storage.set(OAUTH_STATE_KEY, null);
    if (params.error) return fail(params.error === 'access_denied' ? 'Discord sign-in was cancelled.' : 'Discord sign-in failed.');
    if (!params.code || !params.state || params.state !== expected) return fail('Sign-in expired. Please try again.');
    try {
      const r = await api<AuthResponse>('/auth/discord', {body: {code: params.code}});
      setToken(r.token);
      await refetchHomes();
      nav('/', {replace: true});
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Discord sign-in failed.');
    }
  });

  return (
    <div class="auth">
      <div class="auth-card">
        <p class="lede">Signing you in…</p>
      </div>
    </div>
  );
}
