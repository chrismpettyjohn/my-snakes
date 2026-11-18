import {ago, plural} from '../lib/format';
import {createAction} from '../lib/action';
import {api, logout, me} from '../lib/api';
import {assignSensor, fetchDevices} from '../lib/device';
import {DeviceHead} from '../components/setting/DeviceHead';
import {ChannelCell} from '../components/setting/ChannelCell';
import {createResource, createSignal, For, Show} from 'solid-js';
import {BridgeSection} from '../components/setting/BridgeSection';
import {CollectionTile, DeviceTile, Glyph, Icon, IconTile, TILE} from '../lib/icons';
import {GOVEE_CHANNEL, type Device, type Member, type SensorRole} from '@snake/shared';
import {currentHome, homeId, homes, isOwner, refetchHomes, selectHome} from '../lib/home';
import {ActionSheet, Avatar, FormSheet, PageHead, Section, formValue, type Action} from '../lib/ui';

const ONLINE_MS = 5 * 60_000;
const GOVEE_ACCOUNT = 'govee-account';
const online = (d: Device) => !!d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < ONLINE_MS;
const updated = (d: Device, first: string | null) => [first, `updated ${ago(d.lastSeenAt)}`].filter(Boolean).join(' · ');

type SheetId = 'govee' | 'member' | 'home';

export default function Settings() {
  const [data, {refetch}] = createResource(homeId, fetchDevices);
  const [members, {refetch: refetchMembers}] = createResource(homeId, id => api<Member[]>(`/homes/${id}/members`));
  const herpstats = () => data()?.devices.filter(d => d.kind === 'herpstat') ?? [];
  const govees = () => data()?.devices.filter(d => d.kind === 'govee') ?? [];
  const govee = () => data()?.govee;

  const {busy, error, setError, run: runAction} = createAction();
  const run = (fn: () => Promise<unknown>) =>
    runAction(async () => {
      await fn();
      void refetch();
    });
  const submit = async (fn: () => Promise<unknown>) => {
    await fn();
    void refetch();
    setSheet(null);
  };

  const [sheet, setSheet] = createSignal<SheetId | null>(null);
  const [menu, setMenu] = createSignal<{title: string; actions: Action[]} | null>(null);

  const deviceMenu = (d: Device) =>
    setMenu({
      title: d.name,
      actions: [
        {
          label: `Remove ${d.name}`,
          danger: true,
          run: () => confirm(`Remove ${d.name} and its history?`) && run(() => api(`/devices/${d.id}`, {method: 'DELETE'})),
        },
      ],
    });
  const goveeMenu = () =>
    setMenu({
      title: 'Govee',
      actions: [
        {label: 'Sync Now', run: () => run(() => api('/govee/refresh', {method: 'POST'}))},
        {label: 'Replace API Key', run: () => setSheet('govee')},
        {label: 'Disconnect Govee', danger: true, run: () => confirm('Disconnect Govee?') && run(() => api('/govee', {method: 'DELETE'}))},
      ],
    });

  const [expanded, setExpanded] = createSignal(new Set<string>());
  const toggle = (id: string) => {
    const next = new Set(expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const Channel = (p: {d: Device; c: Device['channels'][number]; title?: string; detail?: string; menu?: boolean}) => (
    <ChannelCell
      d={p.d}
      c={p.c}
      snakes={data()?.snakes ?? []}
      busy={busy()}
      title={p.title}
      detail={p.detail}
      onMenu={p.menu && isOwner() ? () => deviceMenu(p.d) : undefined}
      onAssign={(snakeId, role: SensorRole | null) =>
        run(() => assignSensor({deviceId: p.d.id, channel: p.c.channel, snakeIds: snakeId ? [snakeId] : [], role}))
      }
    />
  );

  return (
    <>
      <PageHead title="Settings" sub={currentHome()?.name} />
      <Show when={error()}>
        <p class="error" style={{margin: '0 16px 16px'}}>
          {error()}
        </p>
      </Show>

      <Show when={me()}>
        {u => (
          <Section title="Account">
            <div class="cell">
              <Avatar name={u().displayName} src={u().avatarUrl} />
              <span class="grow">
                <span class="title">{u().displayName}</span>
                <span class="detail">{u().email}</span>
              </span>
            </div>
          </Section>
        )}
      </Show>

      <Section
        collapse="setup-herpstat"
        title={
          <span class="st">
            <DeviceTile kind="herpstat" />
            Herpstat
          </span>
        }
        foot={<>Units show up here once a bridge finds them. Assign each output to a snake's basking bulb or RHP.</>}
      >
        <For each={herpstats()}>
          {d => (
            <>
              <DeviceHead
                expanded={expanded().has(d.id)}
                onToggle={() => toggle(d.id)}
                tile={
                  <span class="tile-wrap">
                    <DeviceTile kind={d.kind} />
                    <span class={`dot mini ${d.lastError ? 'bad' : online(d) ? '' : 'idle'}`} />
                  </span>
                }
                title={d.name}
                detail={d.lastSeenAt ? updated(d, d.model) : 'Waiting for a bridge to find it'}
                menuLabel={`${d.name} options`}
                onMenu={isOwner() ? () => deviceMenu(d) : undefined}
              />
              <For each={expanded().has(d.id) ? d.channels : []}>{c => <Channel d={d} c={c} />}</For>
            </>
          )}
        </For>
        <Show when={!herpstats().length}>
          <div class="cell">
            <span class="muted">No Herpstats yet. Install a bridge to find them.</span>
          </div>
        </Show>
      </Section>

      <Show when={isOwner()}>
        <BridgeSection onChange={() => void refetch()} onError={setError} />
      </Show>

      <Section
        collapse="setup-govee"
        title={
          <span class="st">
            <DeviceTile kind="govee" />
            Govee
          </span>
        }
        foot={
          govee()?.configured ? undefined : (
            <>
              Get a key in the Govee Home app under <b>Profile → Settings → Apply for API Key</b>. Assign each sensor to a snake's warm or cold side.
            </>
          )
        }
      >
        <Show
          when={govee()?.configured}
          fallback={
            <Show
              when={isOwner()}
              fallback={
                <div class="cell">
                  <span class="muted">Not connected</span>
                </div>
              }
            >
              <button class="cell action" onClick={() => setSheet('govee')}>
                Connect Govee Account…
              </button>
            </Show>
          }
        >
          <DeviceHead
            expanded={expanded().has(GOVEE_ACCOUNT)}
            onToggle={() => toggle(GOVEE_ACCOUNT)}
            tile={<IconTile color={TILE.govee}>{Glyph.cloud()}</IconTile>}
            title={govee()?.email ?? 'Govee account'}
            detail={govee()?.lastError ?? `${plural(govees().length, 'sensor')} · synced ${ago(govee()?.lastSyncAt)}`}
            badge={<span class={`badge ${govee()?.lastError ? 'bad' : 'ok'}`}>{govee()?.lastError ? 'Error' : 'Connected'}</span>}
            menuLabel="Govee options"
            onMenu={isOwner() ? goveeMenu : undefined}
          />
          <For each={expanded().has(GOVEE_ACCOUNT) ? govees() : []}>
            {d => (
              <Channel
                d={d}
                c={d.channels.find(c => c.channel === GOVEE_CHANNEL) ?? {channel: GOVEE_CHANNEL, label: null, snakeIds: [], role: null}}
                title={d.name}
                menu
                detail={d.lastError ?? updated(d, d.model)}
              />
            )}
          </For>
        </Show>
      </Section>

      <Section
        collapse="setup-people"
        title={
          <span class="st">
            <IconTile color={TILE.people}>{Glyph.people()}</IconTile>People
          </span>
        }
        foot="Everyone here sees these snakes and sensors. Only owners can change devices."
      >
        <For each={members()}>
          {m => (
            <div class="cell">
              <Avatar name={m.displayName} src={m.avatarUrl} />
              <span class="grow">
                <span class="title">{m.displayName}</span>
                <span class="detail">{m.username && `@${m.username}`}</span>
              </span>
              <span class="value" style={{'text-transform': 'capitalize', 'font-size': '15px'}}>
                {m.role}
              </span>
            </div>
          )}
        </For>
        <Show when={isOwner()}>
          <button class="cell action" onClick={() => setSheet('member')}>
            Add Person…
          </button>
        </Show>
      </Section>

      <Section
        collapse="setup-collections"
        title={
          <span class="st">
            <IconTile color={TILE.home}>{Glyph.house()}</IconTile>Collections
          </span>
        }
      >
        <For each={homes()}>
          {h => (
            <button class="cell" onClick={() => selectHome(h.id)}>
              <CollectionTile icon={h.icon} color={h.color} />
              <span class="grow">{h.name}</span>
              <Show when={h.id === homeId()}>{Icon.check()}</Show>
            </button>
          )}
        </For>
        <button class="cell action" onClick={() => setSheet('home')}>
          New Collection…
        </button>
      </Section>

      <Section>
        <button class="cell action danger" style={{'justify-content': 'center'}} onClick={logout}>
          Sign Out
        </button>
      </Section>

      <ActionSheet open={!!menu()} onClose={() => setMenu(null)} title={menu()?.title} actions={menu()?.actions ?? []} />

      <FormSheet
        open={sheet() === 'govee'}
        title="Govee"
        onClose={() => setSheet(null)}
        onSubmit={e => {
          const body = {email: formValue(e, 'email'), apiKey: formValue(e, 'apiKey')};
          return submit(() => api('/govee', {method: 'PUT', body}));
        }}
        foot={
          <>
            In the Govee Home app: <b>Profile → Settings → Apply for API Key</b>. Sensors appear here after the first sync.
          </>
        }
      >
        <label class="cell">
          <input name="email" type="email" required placeholder="Govee account email" value={govee()?.email ?? ''} autofocus />
        </label>
        <label class="cell">
          <input name="apiKey" type="password" required placeholder="API key" />
        </label>
      </FormSheet>

      <FormSheet
        open={sheet() === 'member'}
        title="Add Person"
        onClose={() => setSheet(null)}
        onSubmit={async e => {
          await api(`/homes/${homeId()}/members`, {body: {username: formValue(e, 'username')}});
          void refetchMembers();
          setSheet(null);
        }}
        foot="They need to have signed in to MySnakes with Discord first."
      >
        <label class="cell">
          <input
            name="username"
            required
            minLength={2}
            maxLength={33}
            placeholder="Discord username"
            autocapitalize="off"
            autocomplete="off"
            autofocus
          />
        </label>
      </FormSheet>

      <FormSheet
        open={sheet() === 'home'}
        title="New Collection"
        onClose={() => setSheet(null)}
        onSubmit={async e => {
          const h = await api<{id: string}>('/homes', {body: {name: formValue(e, 'name')}});
          await refetchHomes();
          selectHome(h.id);
          setSheet(null);
        }}
        foot="Use a separate collection for another location, like a breeding room."
      >
        <label class="cell">
          <input name="name" required placeholder="Name" autofocus />
        </label>
      </FormSheet>
    </>
  );
}
