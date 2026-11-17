import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { GOVEE_CHANNEL, type Device, type FoundHerpstat, type Member, type SensorRole, type Snake } from "@snake/shared";
import { createAction } from "../lib/action";
import { api, logout, me } from "../lib/api";
import { assignSensor, fetchDevices } from "../lib/device";
import { ago, plural } from "../lib/format";
import { currentHome, homeId, homes, isOwner, refetchHomes, selectHome } from "../lib/home";
import { DeviceTile, Glyph, Icon, IconTile, TILE } from "../lib/icons";
import { ActionSheet, Avatar, FormSheet, PageHead, Section, formValue, type Action } from "../lib/ui";
import { ChannelCell } from "../components/setting/ChannelCell";
import { DeviceHead } from "../components/setting/DeviceHead";
import { WebhookCells } from "../components/setting/WebhookCells";

const ONLINE_MS = 5 * 60_000;
/** Expand-state key for the Govee account row (device ids are UUIDs, so no clash). */
const GOVEE_ACCOUNT = "govee-account";
const online = (d: Device) => !!d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < ONLINE_MS;
const updated = (d: Device, first: string | null) => [first, `updated ${ago(d.lastSeenAt)}`].filter(Boolean).join(" · ");

type SheetId = "manual" | "govee" | "member" | "home" | { ip: Device };

export default function Settings() {
  const [data, { refetch }] = createResource(homeId, fetchDevices);
  const [snakes] = createResource(homeId, (id) => api<Snake[]>(`/homes/${id}/snakes`));
  const [members, { refetch: refetchMembers }] = createResource(homeId, (id) => api<Member[]>(`/homes/${id}/members`));
  const herpstats = () => data()?.devices.filter((d) => d.kind === "herpstat") ?? [];
  const govees = () => data()?.devices.filter((d) => d.kind === "govee") ?? [];
  const govee = () => data()?.govee;

  // Page-level actions (menus, pickers) report errors at the top of the page.
  const { busy, error, setError, run: runAction } = createAction();
  const run = (fn: () => Promise<unknown>) => runAction(async () => { await fn(); refetch(); });
  /** For form sheets: throws so the sheet shows the error and stays open. */
  const submit = async (fn: () => Promise<unknown>) => { await fn(); refetch(); setSheet(null); };

  // Herpstats on the LAN are found automatically; adding one is a single tap.
  const [found, setFound] = createSignal<FoundHerpstat[]>([]);
  const [scanning, setScanning] = createSignal(false);
  const scan = async () => {
    setScanning(true);
    try { setFound(await api<FoundHerpstat[]>(`/homes/${homeId()}/devices/herpstat/discover`, { method: "POST" })); }
    catch { /* scanning is best-effort */ } finally { setScanning(false); }
  };
  onMount(() => { if (isOwner()) void scan(); });
  const addHerpstat = (name: string, host?: string) => api(`/homes/${homeId()}/devices/herpstat`, { body: { name, host: host || undefined } });

  const [sheet, setSheet] = createSignal<SheetId | null>(null);
  const ipSheet = () => { const s = sheet(); return typeof s === "object" && s ? s.ip : undefined; };
  const [menu, setMenu] = createSignal<{ title: string; actions: Action[] } | null>(null);

  const deviceMenu = (d: Device) => setMenu({
    title: d.name,
    actions: [
      ...(d.kind === "herpstat" ? [
        ...(d.host ? [{ label: "Refresh Now", run: () => run(() => api(`/devices/${d.id}/refresh`, { method: "POST" })) }] : []),
        { label: "Change IP Address", run: () => setSheet({ ip: d }) },
        ...(d.uploadUrl ? [{ label: "Webhook", expand: () => <WebhookCells d={d} onRotated={refetch} onError={setError} /> }] : []),
      ] : []),
      { label: `Remove ${d.name}`, danger: true, run: () => confirm(`Remove ${d.name} and its history?`) && run(() => api(`/devices/${d.id}`, { method: "DELETE" })) },
    ],
  });
  const goveeMenu = () => setMenu({
    title: "Govee",
    actions: [
      { label: "Sync Now", run: () => run(() => api(`/homes/${homeId()}/govee/refresh`, { method: "POST" })) },
      { label: "Replace API Key", run: () => setSheet("govee") },
      { label: "Disconnect Govee", danger: true, run: () => confirm("Disconnect Govee?") && run(() => api(`/homes/${homeId()}/govee`, { method: "DELETE" })) },
    ],
  });

  // Devices start collapsed; tap one to show its outlet/sensor rows.
  const [expanded, setExpanded] = createSignal(new Set<string>());
  const toggle = (id: string) => {
    const next = new Set(expanded());
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const Channel = (p: { d: Device; c: Device["channels"][number]; title?: string; detail?: string; menu?: boolean }) => (
    <ChannelCell d={p.d} c={p.c} snakes={snakes() ?? []} busy={busy()} title={p.title} detail={p.detail}
      onMenu={p.menu && isOwner() ? () => deviceMenu(p.d) : undefined}
      onAssign={(snakeId, role: SensorRole | null) => run(() =>
        assignSensor({ deviceId: p.d.id, channel: p.c.channel, snakeIds: snakeId ? [snakeId] : [], role }))} />
  );

  return (
    <>
      <PageHead title="Settings" sub={currentHome()?.name} />
      <Show when={error()}><p class="error" style={{ margin: "0 16px 16px" }}>{error()}</p></Show>

      <Show when={me()}>{(u) => (
        <Section title="Account">
          <div class="cell">
            <Avatar name={u().displayName} />
            <span class="grow"><span class="title">{u().displayName}</span><span class="detail">{u().email}</span></span>
          </div>
        </Section>
      )}</Show>

      <Section collapse="setup-herpstat" title={<><span class="st"><DeviceTile kind="herpstat" />Herpstat</span><Show when={scanning()}><span>Searching…</span></Show></>}
        foot={<>On each unit, open <b>Admin → Advanced Status Integration</b> and turn on <b>/RAWSTATUS</b>. Assign each output to a snake's basking bulb or RHP.</>}>
        <For each={herpstats()}>{(d) => (
          <>
            <DeviceHead expanded={expanded().has(d.id)} onToggle={() => toggle(d.id)}
              tile={<span class="tile-wrap"><DeviceTile kind={d.kind} /><span class={`dot mini ${d.lastError ? "bad" : online(d) ? "" : "idle"}`} /></span>}
              title={d.name} detail={d.lastError ?? updated(d, d.host ?? "Upload only")}
              menuLabel={`${d.name} options`} onMenu={isOwner() ? () => deviceMenu(d) : undefined} />
            <For each={expanded().has(d.id) ? d.channels : []}>{(c) => <Channel d={d} c={c} />}</For>
          </>
        )}</For>
        <For each={found()}>{(f) => (
          <div class="cell">
            <IconTile color={TILE.herpstat}>{Glyph.wave()}</IconTile>
            <span class="grow"><span class="title">{f.name}</span><span class="detail">Found on your network · {f.host}</span></span>
            <button class="btn" disabled={busy()} onClick={() => run(async () => {
              await addHerpstat(f.name, f.host);
              setFound(found().filter((x) => x !== f));
            })}>Add</button>
          </div>
        )}</For>
        <Show when={!herpstats().length && !found().length}>
          <div class="cell scanning">
            <span class={`radar ${scanning() ? "on" : ""}`}>{Glyph.wave()}</span>
            <span class="grow muted">{scanning() ? "Looking for Herpstats on your network…" : "No Herpstats found"}</span>
          </div>
        </Show>
        <Show when={isOwner()}>
          <button class="cell action" onClick={scan} disabled={scanning()}>Search Again</button>
          <button class="cell action" onClick={() => setSheet("manual")}>Add by IP Address…</button>
        </Show>
      </Section>

      <Section collapse="setup-govee" title={<span class="st"><DeviceTile kind="govee" />Govee</span>}
        foot={govee()?.configured ? undefined : <>Get a key in the Govee Home app under <b>Profile → Settings → Apply for API Key</b>. Assign each sensor to a snake's warm or cold side.</>}>
        <Show when={govee()?.configured} fallback={
          <Show when={isOwner()} fallback={<div class="cell"><span class="muted">Not connected</span></div>}>
            <button class="cell action" onClick={() => setSheet("govee")}>Connect Govee Account…</button>
          </Show>
        }>
          <DeviceHead expanded={expanded().has(GOVEE_ACCOUNT)} onToggle={() => toggle(GOVEE_ACCOUNT)}
            tile={<IconTile color={TILE.govee}>{Glyph.cloud()}</IconTile>}
            title={govee()?.email ?? "Govee account"}
            detail={govee()?.lastError ?? `${plural(govees().length, "sensor")} · synced ${ago(govee()?.lastSyncAt)}`}
            badge={<span class={`badge ${govee()?.lastError ? "bad" : "ok"}`}>{govee()?.lastError ? "Error" : "Connected"}</span>}
            menuLabel="Govee options" onMenu={isOwner() ? goveeMenu : undefined} />
          <For each={expanded().has(GOVEE_ACCOUNT) ? govees() : []}>{(d) => (
            <Channel d={d} c={d.channels.find((c) => c.channel === GOVEE_CHANNEL) ?? { channel: GOVEE_CHANNEL, label: null, snakeIds: [], role: null }}
              title={d.name} menu detail={d.lastError ?? updated(d, d.model)} />
          )}</For>
        </Show>
      </Section>

      <Section collapse="setup-people" title={<span class="st"><IconTile color={TILE.people}>{Glyph.people()}</IconTile>People</span>}
        foot="Everyone here sees these snakes and sensors. Only owners can change devices.">
        <For each={members()}>{(m) => (
          <div class="cell">
            <Avatar name={m.displayName} />
            <span class="grow"><span class="title">{m.displayName}</span><span class="detail">{m.email}</span></span>
            <span class="value" style={{ "text-transform": "capitalize", "font-size": "15px" }}>{m.role}</span>
          </div>
        )}</For>
        <Show when={isOwner()}><button class="cell action" onClick={() => setSheet("member")}>Add Person…</button></Show>
      </Section>

      <Section collapse="setup-collections" title={<span class="st"><IconTile color={TILE.home}>{Glyph.house()}</IconTile>Collections</span>}>
        <For each={homes()}>{(h) => (
          <button class="cell" onClick={() => selectHome(h.id)}>
            <IconTile color={TILE.home}>{Glyph.house()}</IconTile>
            <span class="grow">{h.name}</span>
            <Show when={h.id === homeId()}>{Icon.check()}</Show>
          </button>
        )}</For>
        <button class="cell action" onClick={() => setSheet("home")}>New Collection…</button>
      </Section>

      <Section>
        <button class="cell action danger" style={{ "justify-content": "center" }} onClick={logout}>Sign Out</button>
      </Section>

      {/* ---- Sheets ---- */}
      <ActionSheet open={!!menu()} onClose={() => setMenu(null)} title={menu()?.title} actions={menu()?.actions ?? []} />

      <FormSheet open={sheet() === "manual"} title="Add Herpstat" onClose={() => setSheet(null)}
        onSubmit={(e) => { const name = formValue(e, "name"), host = formValue(e, "host"); return submit(() => addHerpstat(name, host)); }}
        foot="Leave the IP blank if the server can't reach the unit; you'll get an upload URL instead.">
        <label class="cell"><input name="name" required placeholder="Name, e.g. Rack A" autofocus /></label>
        <label class="cell"><input name="host" placeholder="IP address, e.g. 192.168.1.141" inputmode="decimal" /></label>
      </FormSheet>

      <Show when={ipSheet()}>{(d) => (
        <FormSheet open title="IP Address" onClose={() => setSheet(null)}
          onSubmit={(e) => { const host = formValue(e, "host") || null; return submit(() => api(`/devices/${d().id}`, { method: "PUT", body: { host } })); }}
          foot="Leave blank to receive uploads only.">
          <label class="cell"><input name="host" value={d().host ?? ""} placeholder="192.168.1.141" inputmode="decimal" autofocus /></label>
        </FormSheet>
      )}</Show>

      <FormSheet open={sheet() === "govee"} title="Govee" onClose={() => setSheet(null)}
        onSubmit={(e) => {
          const body = { email: formValue(e, "email"), apiKey: formValue(e, "apiKey") };
          return submit(() => api(`/homes/${homeId()}/govee`, { method: "PUT", body }));
        }}
        foot={<>In the Govee Home app: <b>Profile → Settings → Apply for API Key</b>. Sensors appear here after the first sync.</>}>
        <label class="cell"><input name="email" type="email" required placeholder="Govee account email" value={govee()?.email ?? ""} autofocus /></label>
        <label class="cell"><input name="apiKey" type="password" required placeholder="API key" /></label>
      </FormSheet>

      <FormSheet open={sheet() === "member"} title="Add Person" onClose={() => setSheet(null)}
        onSubmit={async (e) => { await api(`/homes/${homeId()}/members`, { body: { email: formValue(e, "email") } }); refetchMembers(); setSheet(null); }}
        foot="They need a MySnakes account first.">
        <label class="cell"><input name="email" type="email" required placeholder="Email" autofocus /></label>
      </FormSheet>

      <FormSheet open={sheet() === "home"} title="New Collection" onClose={() => setSheet(null)}
        onSubmit={async (e) => { const h = await api<{ id: string }>("/homes", { body: { name: formValue(e, "name") } }); await refetchHomes(); selectHome(h.id); setSheet(null); }}
        foot="Use a separate collection for another location, like a breeding room.">
        <label class="cell"><input name="name" required placeholder="Name" autofocus /></label>
      </FormSheet>
    </>
  );
}
