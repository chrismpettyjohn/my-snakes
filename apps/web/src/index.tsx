import { render } from "solid-js/web";
import { Router, Route, A, Navigate, type RouteSectionProps } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import "./styles.css";
import { token } from "./lib/api";
import { homeId } from "./lib/home";
import Login from "./pages/Login";
import Snakes from "./pages/Snakes";
import Settings from "./pages/Settings";
import { UserMenu } from "./lib/UserMenu";

function Layout(props: RouteSectionProps) {
  return (
    <Show when={token()} fallback={<Navigate href="/login" />}>
      <header class="navbar">
        <div class="navbar-inner">
          <A href="/" class="brand"><span class="brand-badge"><img class="brand-mark" src="/logo.png" alt="" /></span>MySnakes</A>
          <UserMenu />
        </div>
      </header>
      <main>
        {/* Keyed: re-mount the page when the selected home changes so its resources refetch. */}
        <Show when={homeId()} keyed>
          {(_id) => props.children as JSX.Element}
        </Show>
      </main>
    </Show>
  );
}

render(() => (
  <Router>
    <Route path="/login" component={Login} />
    <Route path="/" component={Layout}>
      <Route path="/" component={Snakes} />
      <Route path="/setup" component={() => <Navigate href="/settings" />} />
      <Route path="/settings" component={Settings} />
      <Route path="*" component={() => <Navigate href="/" />} />
    </Route>
  </Router>
), document.getElementById("root")!);
