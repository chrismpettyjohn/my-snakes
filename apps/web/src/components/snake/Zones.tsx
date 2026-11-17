import {LOG_STYLE} from '../../lib/art';
import {onDismiss} from '../../lib/dismiss';
import {ago, day, since} from '../../lib/format';
import {Icon, ZONE_GLYPH} from '../../lib/icons';
import {ambientHealth, rangesFor} from './health';
import {QUICK_LOG, createLogger} from './QuickLog';
import {createSignal, For, Match, Show, Switch, type JSX} from 'solid-js';
import {ROLE_LABEL, SENSOR_ROLES, ambient, type LogEventType, type Snake, type SnakeStatus, type SensorRole, type Zone} from '@snake/shared';

const NBSP = ' ';

function ZoneCard(p: {role: SensorRole; z?: Zone; onOpen: () => void}) {
  const heat = p.role === 'bask' || p.role === 'rhp';
  const detail = () => {
    const z = p.z;
    if (!z) return 'Not linked';
    if (z.stale && z.at) return `Updated ${ago(z.at)}`;
    if (heat)
      return (
        [z.powerPct != null && `${Math.round(z.powerPct)}% power`, z.setpointF != null && `Set ${z.setpointF}°`].filter(Boolean).join(' · ') || NBSP
      );
    return z.humidity != null ? `${Math.round(z.humidity)}% humidity` : NBSP;
  };
  return (
    <button
      type="button"
      class={`zone ${p.role} ${p.z?.bad ? 'bad' : ''} ${p.z?.stale ? 'stale' : ''} ${p.z ? '' : 'empty'}`}
      onClick={p.onOpen}
      title={p.z?.at ? `Updated ${ago(p.z.at)}` : undefined}
    >
      <span class="zone-top">
        <span class="zone-ic">{ZONE_GLYPH[p.role]()}</span>
        <Show when={p.z?.tempF != null}>
          <span class="zone-v">
            {p.z!.tempF!.toFixed(1)}
            <small>°</small>
          </span>
        </Show>
      </span>
      <span class="zone-text">
        <span class="zone-l">{ROLE_LABEL[p.role]}</span>
        <span class="zone-sub">{detail()}</span>
      </span>
      <Show when={heat && p.z?.powerPct != null}>
        <span class="power">
          <span style={{width: `${Math.min(100, Math.max(0, p.z!.powerPct!))}%`}} />
        </span>
      </Show>
    </button>
  );
}

function ClimateCard(p: {s: SnakeStatus; snake?: Snake; onOpen: () => void}) {
  const amb = () => ambient(p.s.zones);
  const linked = () => amb().sides.length > 0;
  const stale = () => linked() && amb().sides.every(z => z.stale);
  const health = () => ambientHealth(amb().tempF, amb().humidity, rangesFor(p.snake, p.s.species));
  return (
    <button type="button" class={`zone climate ${health() ?? ''} ${stale() ? 'stale' : ''} ${linked() ? '' : 'empty'}`} onClick={p.onOpen}>
      <span class="zone-top">
        <span class="zone-ic">{ZONE_GLYPH.warm()}</span>
      </span>
      <span class="zone-text">
        <span class="zone-v">
          <Show when={amb().tempF != null} fallback="—">
            {amb().tempF!.toFixed(1)}
            <small>°</small>
          </Show>
        </span>
        <span class="zone-sub">{!linked() ? 'Not linked' : amb().humidity != null ? `${Math.round(amb().humidity!)}% humidity` : NBSP}</span>
      </span>
    </button>
  );
}

type LastLog = SnakeStatus['lastLog'];
const latest = (...xs: (string | undefined)[]) =>
  xs
    .filter((x): x is string => !!x)
    .sort()
    .at(-1);

const ACTIVITY: {label: string; style: LogEventType; at: (l: LastLog) => string | undefined; sub: (l: LastLog, at: string) => string}[] = [
  {
    label: 'Food',
    style: 'feeding',
    at: l => l.feeding,
    sub: (l, at) => (l.refused && l.refused > at ? `Rejected ${ago(l.refused)}` : day(at)),
  },
  {
    label: 'Waste',
    style: 'poop',
    at: l => latest(l.poop, l.urates),
    sub: (l, at) => `${at === l.poop ? 'Pooped' : 'Urates'} · ${day(at)}`,
  },
  {label: 'Cleanup', style: 'cleaning', at: l => l.cleaning, sub: (_, at) => day(at)},
];

function ActivityCard(p: {a: (typeof ACTIVITY)[number]; s: SnakeStatus; onLogged?: () => void}) {
  const at = () => p.a.at(p.s.lastLog);
  const st = LOG_STYLE[p.a.style];
  const items = QUICK_LOG.find(g => g.group === p.a.label)?.items ?? [];
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  const close = () => setOpen(false);
  onDismiss(
    () => root,
    () => open() && close(),
  );
  const {item} = createLogger({snakeId: () => p.s.id, onLogged: () => p.onLogged?.(), close});
  return (
    <div class="activity-wrap" ref={root}>
      <button
        type="button"
        class={`zone activity-tile ${at() ? '' : 'empty'}`}
        style={{'--c': st.color}}
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
        title={at() ? new Date(at()!).toLocaleString() : undefined}
      >
        <span class="zone-top">
          <span class="zone-ic">{st.emoji}</span>
          <Show when={at()}>{t => <span class="zone-v">{since(t())}</span>}</Show>
        </span>
        <span class="zone-text">
          <span class="zone-l">{p.a.label}</span>
          <span class="zone-sub">{at() ? p.a.sub(p.s.lastLog, at()!) : 'Not logged'}</span>
        </span>
      </button>
      <Show when={open()}>
        <div class="user-dropdown log-menu activity-menu" role="menu" aria-label={`${p.a.label} for ${p.s.name}`}>
          <For each={items}>{item}</For>
        </div>
      </Show>
    </div>
  );
}

export type View = 'full' | 'compact' | 'mini' | 'activity';
export const VIEWS: {id: View; label: string; icon: () => JSX.Element}[] = [
  {id: 'full', label: 'Full', icon: Icon.rows},
  {id: 'compact', label: 'Compact', icon: Icon.grid},
  {id: 'mini', label: 'Mini', icon: Icon.dots},
  {id: 'activity', label: 'Activity', icon: Icon.clock},
];
export const isView = (v: string): v is View => VIEWS.some(x => x.id === v);

const COMPACT_ROLES: SensorRole[] = ['warm', 'cold'];

export function Zones(p: {
  s: SnakeStatus;
  snake?: Snake;
  view?: View;
  onPick: (role: SensorRole) => void;
  onOpen?: () => void;
  onLogged?: () => void;
}) {
  const open = () => p.onOpen?.();
  return (
    <div class="zones">
      <Switch
        fallback={
          <For each={p.view === 'compact' ? COMPACT_ROLES : SENSOR_ROLES}>
            {r => <ZoneCard role={r} z={p.s.zones[r]} onOpen={() => p.onPick(r)} />}
          </For>
        }
      >
        <Match when={p.view === 'mini'}>
          <ClimateCard s={p.s} snake={p.snake} onOpen={open} />
        </Match>
        <Match when={p.view === 'activity'}>
          <For each={ACTIVITY}>{a => <ActivityCard a={a} s={p.s} onLogged={p.onLogged} />}</For>
        </Match>
      </Switch>
    </div>
  );
}
