import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { auth, setToken } from "../lib/api";
import { refetchHomes } from "../lib/home";

export default function Login() {
  const nav = useNavigate();
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const login = () => mode() === "login";

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const f = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(f.get("email")), password = String(f.get("password"));
    setBusy(true); setError("");
    try {
      const r = login() ? await auth.login(email, password) : await auth.register(email, password, String(f.get("displayName")));
      setToken(r.token);
      await refetchHomes();
      nav("/");
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div class="auth">
      <form class="auth-card" onSubmit={submit}>
        <img class="login-avatar login-logo" src="/logo.png" alt="MySnakes" />
        <h1>MySnakes</h1>
        <p class="lede">{login() ? "Sign in to check on your snakes." : "Create an account to get started."}</p>
        <div class="group">
          <Show when={!login()}>
            <label class="cell"><input name="displayName" required maxLength={60} placeholder="Name" autocomplete="name" /></label>
          </Show>
          <label class="cell"><input name="email" type="email" required placeholder="Email" autocomplete="email" /></label>
          <label class="cell"><input name="password" type="password" required minLength={login() ? 1 : 8} placeholder="Password"
            autocomplete={login() ? "current-password" : "new-password"} /></label>
        </div>
        <Show when={error()}><p class="error" style={{ "text-align": "center" }}>{error()}</p></Show>
        <button class="btn block" disabled={busy()}>{login() ? "Sign In" : "Create Account"}</button>
        <p class="switch">
          {login() ? "New here? " : "Have an account? "}
          <button type="button" onClick={() => { setError(""); setMode(login() ? "register" : "login"); }}>
            {login() ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
