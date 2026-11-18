import {Show} from 'solid-js';
import {api} from '../lib/api';
import {storage} from '../lib/storage';
import {createAction} from '../lib/action';
import {useSearchParams} from '@solidjs/router';

export const OAUTH_STATE_KEY = 'snake.oauthState';

export default function Login() {
  const [params] = useSearchParams<{error?: string}>();
  const {busy, error, run} = createAction();

  function signIn() {
    void run(async () => {
      const state = crypto.randomUUID();
      storage.set(OAUTH_STATE_KEY, state);
      const {url} = await api<{url: string}>(`/auth/discord/url?state=${state}`);
      location.assign(url);
      await new Promise(() => {});
    });
  }

  return (
    <div class="auth">
      <div class="auth-card">
        <img class="login-avatar login-logo" src="/logo.png" alt="MySnakes" />
        <h1>MySnakes</h1>
        <p class="lede">Sign in to check on your snakes.</p>
        <Show when={error() || params.error}>
          <p class="error">{error() || params.error}</p>
        </Show>
        <button class="btn block discord" disabled={busy()} onClick={signIn}>
          Continue with Discord
        </button>
      </div>
    </div>
  );
}
