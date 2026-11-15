import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ROLE_LABEL, type SensorRole } from "@snake/shared";
import { api, me, setToken } from "../lib/api";
import { currentHome, homeId, homes, refetchHomes, selectHome } from "../lib/home";
import { ago } from "../lib/format";
import { Glyph, IconTile, SnakePic } from "../lib/art";
import { ActionSheet, Avatar, CopyCell, Icon, PageHead, Section, Sheet, type Action } from "../lib/ui";

export interface Device {
  id: string; kind: "herpstat" | "govee"; name: string; model: string | null; externalId: string | null;
  lastSeenAt: string | null; uploadUrl?: string; apiKey?: string;
  host: string | null; firmware: string | null; lastError: string | null;
  channels: { channel: string; label: string | null; snakeIds: string[]; role: SensorRole | null }[];
}
export interface DeviceList { govee: { configured: boolean; email: string | null; lastSyncAt: string | null; lastError: string | null }; devices: Device[] }
interface Found { host: string; mac: string; name: string }

const ONLINE_MS = 5 * 60_000;
/** Expand-state key for the Govee account row (device ids are UUIDs, so no clash). */
const GOVEE_ACCOUNT = "govee-account";
const online = (d: Device) => !!d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < ONLINE_MS;

export default function Settings() {
  const nav = useNavigate();
  const [data, { refetch }] = createResource(homeId, (id) => api<DeviceList>(`/homes/${id}/devices`));
  const [snakes] = createResource(homeId, (id) => api<{ id: string; name: string; species: string | null; morph: string | null; photo: string | null }[]>(`/homes/${id}/snakes`));
  const [members, { refetch: refetchMembers }] = createResource(homeId, (id) =>
    api<{ id: string; email: string; displayName: string; role: string }[]>(`/homes/${id}/members`));
  const owner = () => currentHome()?.role === "owner";
  const herpstats = () => data()?.devices.filter((d) => d.kind === "herpstat") ?? [];
  const govees = () => data()?.devices.filter((d) => d.kind === "govee") ?? [];

  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); refetch(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  // Herpstats on the LAN are found automatically; adding one is a single tap.
  const [found, setFound] = createSignal<Found[]>([]);
  const [scanning, setScanning] = createSignal(false);
  const scan = async () => {
    setScanning(true);
    try { setFound(await api<Found[]>(`/homes/${homeId()}/devices/herpstat/discover`, { method: "POST" })); }
    catch { /* scanning is best-effort */ } finally { setScanning(false); }
  };
  onMount(() => { if (owner()) scan(); });
  const addHerpstat = (name: string, host?: string) =>
    run(() => api(`/homes/${homeId()}/devices/herpstat`, { body: { name, host: host || undefined } }));

  const [sheet, setSheet] = createSignal<null | "manual" | "govee" | "member" | "home" | { ip: Device }>(null);
  const [menu, setMenu] = createSignal<{ title: string; actions: Action[] } | null>(null);
  const formValue = (e: SubmitEvent, k: string) => String(new FormData(e.currentTarget as HTMLFormElement).get(k) ?? "").trim();

  const deviceMenu = (d: Device) => setMenu({
    title: d.name,
    actions: [
      ...(d.kind === "herpstat" ? [
        ...(d.host ? [{ label: "Refresh Now", run: () => run(() => api(`/devices/${d.id}/refresh`, { method: "POST" })) }] : []),
        { label: "Change IP Address", run: () => setSheet({ ip: d }) },
        ...(d.uploadUrl ? [{ label: "Webhook", expand: () => <WebhookCells d={d} /> }] : []),
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
  const toggleDevice = (id: string) => {
    const next = new Set(expanded());
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  // Upload URL + key for the Herpstat's custom URL upload; the key can be rotated in place.
  const WebhookCells = (p: { d: Device }) => {
    const [creds, setCreds] = createSignal({ uploadUrl: p.d.uploadUrl!, apiKey: p.d.apiKey! });
    const [rotating, setRotating] = createSignal(false);
    const rotate = async () => {
      setRotating(true); setError("");
      try { setCreds(await api<{ uploadUrl: string; apiKey: string }>(`/devices/${p.d.id}/rotate-key`, { method: "POST" })); refetch(); }
      catch (e) { setError((e as Error).message); } finally { setRotating(false); }
    };
    return (
      <>
        <CopyCell label="Webhook URL" value={creds().uploadUrl} />
        <CopyCell label="Webhook API Key" value={creds().apiKey}
          extra={<button type="button" class={`icon-btn ${rotating() ? "spin" : ""}`} aria-label="Rotate API key" title="Rotate API key" disabled={rotating()} onClick={rotate}>{Icon.rotate()}</button>} />
      </>
    );
  };

  /** One assignable row: a Herpstat output, or a Govee sensor under its account. */
  const ChannelCell = (p: { d: Device; c: Device["channels"][number]; title?: string; detail?: string; menu?: boolean }) => (
    <label class="cell indent">
      <Show when={snakes()?.find((s) => s.id === p.c.snakeIds[0])} fallback={<span class="chan-empty" />}>
        {(s) => <SnakePic s={s()} size={28} />}
      </Show>
      <span class="grow">
        <span class="title">{p.title ?? p.c.label ?? p.c.channel}</span>
        <Show when={p.detail}><span class="detail">{p.detail}</span></Show>
      </span>
      {/* One picker: "<snake> · <zone>". Thermostat outputs drive heat; air sensors read ambient. */}
      <select value={p.c.snakeIds[0] ? `${p.c.snakeIds[0]}|${p.c.role ?? ""}` : ""} disabled={busy()}
        onChange={(e) => {
          const [snakeId, role] = e.currentTarget.value.split("|");
          run(() => api("/sensor-assignments", { method: "PUT",
            body: { deviceId: p.d.id, channel: p.c.channel, snakeIds: snakeId ? [snakeId] : [], role: role || null } }));
        }}>
        <option value="">Not linked</option>
        <Show when={p.c.snakeIds[0] && !p.c.role}><option value={`${p.c.snakeIds[0]}|`}>{snakes()?.find((s) => s.id === p.c.snakeIds[0])?.name} · pick a zone</option></Show>
        <For each={snakes()}>{(s) => (
          <optgroup label={s.name}>
            <For each={(p.d.kind === "herpstat" ? ["bask", "rhp"] : ["warm", "cold"]) as SensorRole[]}>{(r) => (
              <option value={`${s.id}|${r}`}>{s.name} · {ROLE_LABEL[r]}</option>
            )}</For>
          </optgroup>
        )}</For>
      </select>
      {Icon.chevron()}
      <Show when={p.menu && owner()}>
        <button type="button" class="icon-btn" aria-label={`${p.d.name} options`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deviceMenu(p.d); }}>{Icon.more()}</button>
      </Show>
    </label>
  );

  const DeviceCells = (p: { d: Device }) => (
    <>
      <div class="cell device-head" role="button" tabindex="0" aria-expanded={expanded().has(p.d.id)}
        onClick={() => toggleDevice(p.d.id)}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleDevice(p.d.id); } }}>
        <span class="tile-wrap">
          <IconTile color={p.d.kind === "herpstat" ? "linear-gradient(135deg,#ffb340,#ff7a00)" : "linear-gradient(135deg,#5ac8fa,#007aff)"}>
            {p.d.kind === "herpstat" ? Glyph.thermostat() : Glyph.droplet()}
          </IconTile>
          <span class={`dot mini ${p.d.lastError ? "bad" : online(p.d) ? "" : "idle"}`} />
        </span>
        <span class="grow">
          <span class="title">{p.d.name}</span>
          <span class="detail">{p.d.lastError ?? [p.d.kind === "herpstat" ? p.d.host ?? "Upload only" : p.d.model, `updated ${ago(p.d.lastSeenAt)}`].filter(Boolean).join(" · ")}</span>
        </span>
        <Show when={owner()}><button class="icon-btn" aria-label={`${p.d.name} options`} onClick={(e) => { e.stopPropagation(); deviceMenu(p.d); }}>{Icon.more()}</button></Show>
      </div>
      <For each={expanded().has(p.d.id) ? p.d.channels : []}>{(c) => <ChannelCell d={p.d} c={c} />}</For>
    </>
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

      <Section collapse="setup-herpstat" title={<><span class="st"><IconTile color="linear-gradient(135deg,#ffb340,#ff7a00)">{Glyph.thermostat()}</IconTile>Herpstat</span><Show when={scanning()}><span>Searching…</span></Show></>}
        foot={<>On each unit, open <b>Admin → Advanced Status Integration</b> and turn on <b>/RAWSTATUS</b>. Assign each output to a snake's basking bulb or RHP.</>}>
        <For each={herpstats()}>{(d) => <DeviceCells d={d} />}</For>
        <For each={found()}>{(f) => (
          <div class="cell">
            <IconTile color="linear-gradient(135deg,#ffb340,#ff7a00)">{Glyph.wave()}</IconTile>
            <span class="grow"><span class="title">{f.name}</span><span class="detail">Found on your network · {f.host}</span></span>
            <button class="btn" disabled={busy()} onClick={() => addHerpstat(f.name, f.host).then(() => setFound(found().filter((x) => x !== f)))}>Add</button>
          </div>
        )}</For>
        <Show when={!herpstats().length && !found().length}>
          <div class="cell scanning">
            <span class={`radar ${scanning() ? "on" : ""}`}>{Glyph.wave()}</span>
            <span class="grow muted">{scanning() ? "Looking for Herpstats on your network…" : "No Herpstats found"}</span>
          </div>
        </Show>
        <Show when={owner()}>
          <button class="cell action" onClick={scan} disabled={scanning()}>Search Again</button>
          <button class="cell action" onClick={() => setSheet("manual")}>Add by IP Address…</button>
        </Show>
      </Section>

      <Section collapse="setup-govee" title={<span class="st"><IconTile color="linear-gradient(135deg,#7ad7ff,#32ade6)">{Glyph.droplet()}</IconTile>Govee</span>} foot={data()?.govee.configured ? undefined : <>Get a key in the Govee Home app under <b>Profile → Settings → Apply for API Key</b>. Assign each sensor to a snake's warm or cold side.</>}>
        <Show when={data()?.govee.configured} fallback={
          <Show when={owner()} fallback={<div class="cell"><span class="muted">Not connected</span></div>}>
            <button class="cell action" onClick={() => setSheet("govee")}>Connect Govee Account…</button>
          </Show>
        }>
          <div class="cell device-head" role="button" tabindex="0" aria-expanded={expanded().has(GOVEE_ACCOUNT)}
            onClick={() => toggleDevice(GOVEE_ACCOUNT)}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleDevice(GOVEE_ACCOUNT); } }}>
            <IconTile color="linear-gradient(135deg,#7ad7ff,#32ade6)">{Glyph.cloud()}</IconTile>
            <span class="grow">
              <span class="title">{data()?.govee.email ?? "Govee account"}</span>
              <span class="detail">{data()?.govee.lastError
                ?? `${govees().length} sensor${govees().length === 1 ? "" : "s"} · synced ${ago(data()?.govee.lastSyncAt)}`}</span>
            </span>
            <span class={`badge ${data()?.govee.lastError ? "bad" : "ok"}`}>{data()?.govee.lastError ? "Error" : "Connected"}</span>
            <Show when={owner()}><button class="icon-btn" aria-label="Govee options" onClick={(e) => { e.stopPropagation(); goveeMenu(); }}>{Icon.more()}</button></Show>
          </div>
          <For each={expanded().has(GOVEE_ACCOUNT) ? govees() : []}>{(d) => (
            <ChannelCell d={d} c={d.channels.find((c) => c.channel === "main") ?? { channel: "main", label: null, snakeIds: [], role: null }}
              title={d.name} menu
              detail={d.lastError ?? [d.model, `updated ${ago(d.lastSeenAt)}`].filter(Boolean).join(" · ")} />
          )}</For>
        </Show>
      </Section>

      <Section collapse="setup-people" title={<span class="st"><IconTile color="linear-gradient(135deg,#5de07a,#28b446)">{Glyph.people()}</IconTile>People</span>} foot="Everyone here sees these snakes and sensors. Only owners can change devices.">
        <For each={members()}>{(m) => (
          <div class="cell">
            <Avatar name={m.displayName} />
            <span class="grow"><span class="title">{m.displayName}</span><span class="detail">{m.email}</span></span>
            <span class="value" style={{ "text-transform": "capitalize", "font-size": "15px" }}>{m.role}</span>
          </div>
        )}</For>
        <Show when={owner()}><button class="cell action" onClick={() => setSheet("member")}>Add Person…</button></Show>
      </Section>

      <Section collapse="setup-collections" title={<span class="st"><IconTile color="linear-gradient(135deg,#7d7aff,#5856d6)">{Glyph.house()}</IconTile>Collections</span>}>
        <For each={homes()}>{(h) => (
          <button class="cell" onClick={() => selectHome(h.id)}>
            <IconTile color="linear-gradient(135deg,#7d7aff,#5856d6)">{Glyph.house()}</IconTile>
            <span class="grow">{h.name}</span>
            <Show when={h.id === homeId()}>{Icon.check()}</Show>
          </button>
        )}</For>
        <button class="cell action" onClick={() => setSheet("home")}>New Collection…</button>
      </Section>

      <Section>
        <button class="cell action danger" style={{ "justify-content": "center" }} onClick={() => { setToken(null); nav("/login"); }}>Sign Out</button>
      </Section>

      {/* ---- Sheets ---- */}
      <ActionSheet open={!!menu()} onClose={() => setMenu(null)} title={menu()?.title} actions={menu()?.actions ?? []} />

      <FormSheet open={sheet() === "manual"} title="Add Herpstat" onClose={() => setSheet(null)}
        onSubmit={(e) => addHerpstat(formValue(e, "name"), formValue(e, "host")).then(() => setSheet(null))}
        foot="Leave the IP blank if the server can't reach the unit; you'll get an upload URL instead.">
        <label class="cell"><input name="name" required placeholder="Name, e.g. Rack A" autofocus /></label>
        <label class="cell"><input name="host" placeholder="IP address, e.g. 192.168.1.141" inputmode="decimal" /></label>
      </FormSheet>

      <Show when={(() => { const s = sheet(); return s && typeof s === "object" && "ip" in s ? s.ip : undefined; })()}>{(d) => (
        <FormSheet open title="IP Address" onClose={() => setSheet(null)}
          onSubmit={(e) => run(() => api(`/devices/${d().id}`, { method: "PUT", body: { host: formValue(e, "host") || null } })).then(() => setSheet(null))}
          foot="Leave blank to receive uploads only.">
          <label class="cell"><input name="host" value={d().host ?? ""} placeholder="192.168.1.141" inputmode="decimal" autofocus /></label>
        </FormSheet>
      )}</Show>

      <FormSheet open={sheet() === "govee"} title="Govee" onClose={() => setSheet(null)}
        onSubmit={(e) => run(() => api(`/homes/${homeId()}/govee`, { method: "PUT", body: { email: formValue(e, "email"), apiKey: formValue(e, "apiKey") } })).then(() => setSheet(null))}
        foot={<>In the Govee Home app: <b>Profile → Settings → Apply for API Key</b>. Sensors appear here after the first sync.</>}>
        <label class="cell"><input name="email" type="email" required placeholder="Govee account email" value={data()?.govee.email ?? ""} autofocus /></label>
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

function FormSheet(p: { open: boolean; title: string; onClose: () => void; onSubmit: (e: SubmitEvent) => Promise<unknown>; foot?: any; children: any }) {
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  let form!: HTMLFormElement;
  return (
    <Sheet open={p.open} title={p.title} onClose={() => { setError(""); p.onClose(); }}
      done={<button type="button" disabled={busy()} onClick={() => form.requestSubmit()}>Done</button>}>
      <form ref={form} onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError("");
        try { await p.onSubmit(e); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
      }}>
        <Section foot={error() ? <span class="error">{error()}</span> : p.foot}>{p.children}</Section>
        <button hidden />
      </form>
    </Sheet>
  );
}
