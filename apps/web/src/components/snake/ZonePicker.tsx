import { createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { ROLE_KIND, ROLE_LABEL, type Device, type DeviceChannel, type SensorRole, type SnakeStatus } from "@snake/shared";
import { createAction } from "../../lib/action";
import { assignSensor, fetchDevices } from "../../lib/device";
import { plural } from "../../lib/format";
import { homeId } from "../../lib/home";
import { DeviceTile, Glyph, Icon, ZONE_GLYPH } from "../../lib/icons";
import { Section, Sheet } from "../../lib/ui";

export type ZonePick = { s: SnakeStatus; role: SensorRole };

/** Pick which device channel feeds one zone of one snake's enclosure. */
export function ZonePicker(p: { pick: ZonePick | null; onClose: () => void; onChange: () => void }) {
  // Keyed on the pick so each open shows current assignments.
  const [data] = createResource(() => p.pick && { id: homeId(), pick: p.pick }, ({ id }) => fetchDevices(id!));
  const { busy, error, setError, run } = createAction();

  const kind = () => (p.pick ? ROLE_KIND[p.pick.role] : undefined);
  const devices = () => (data()?.devices ?? []).filter((d) => d.kind === kind() && d.channels.length);
  const chans = () => devices().flatMap((d) => d.channels.map((c) => ({ d, c })));
  const isCurrent = (c: DeviceChannel) => !!p.pick && c.snakeIds.includes(p.pick.s.id) && c.role === p.pick.role;
  const linked = () => chans().some(({ c }) => isCurrent(c));
  const herp = () => kind() === "herpstat";
  /** Who else a channel already serves, so sharing a rack output is visible before you tap. */
  const sharedWith = (c: DeviceChannel) => {
    const others = c.snakeIds.filter((id) => id !== p.pick?.s.id).length;
    return others ? `Also used by ${plural(others, "other snake")}` : undefined;
  };
  const assign = (d: Device, c: DeviceChannel, snakeIds: string[], role: SensorRole | null) =>
    assignSensor({ deviceId: d.id, channel: c.channel, snakeIds, role: snakeIds.length ? role : null });

  const choose = (target: { d: Device; c: DeviceChannel } | null) => run(async () => {
    const { s, role } = p.pick!;
    // Unlink whatever currently feeds this zone (other snakes on that channel keep it).
    for (const { d, c } of chans()) {
      if (isCurrent(c) && c !== target?.c) await assign(d, c, c.snakeIds.filter((id) => id !== s.id), c.role);
    }
    if (target && !isCurrent(target.c)) {
      const { d, c } = target;
      // A channel shared by a rack keeps its other snakes only if it already measures this zone.
      await assign(d, c, c.role === role ? [...new Set([...c.snakeIds, s.id])] : [s.id], role);
    }
    p.onChange(); p.onClose();
  });

  return (
    <Sheet open={!!p.pick} onClose={() => { setError(""); p.onClose(); }} title="Sensor">
      <Show when={p.pick}>{(pk) => (
        <div>
          <div class={`pick-hero ${pk().role}`}>
            <span class="zone-ic">{ZONE_GLYPH[pk().role]()}</span>
            <h1>{ROLE_LABEL[pk().role]}</h1>
            <p>{pk().s.name}<Show when={devices().length}> · {herp() ? "Choose a Herpstat output" : "Choose a Govee sensor"}</Show></p>
          </div>

          <For each={devices()}>{(d) => (
            <Section title={<span class="st"><DeviceTile kind={d.kind} />{d.name}</span>}>
              <For each={d.channels}>{(c) => (
                <button type="button" class={`cell ${isCurrent(c) ? "on" : ""}`} disabled={busy()} onClick={() => choose({ d, c })}
                  style={{ "--c": `var(--zone-${pk().role})` }}>
                  <span class="chan-ic">{herp() ? Glyph.plug() : Glyph.droplet()}</span>
                  <span class="grow">
                    <span class="title">{c.label ?? c.channel}</span>
                    <Show when={sharedWith(c)}>{(t) => <span class="detail">{t()}</span>}</Show>
                  </span>
                  <Show when={isCurrent(c)}>{Icon.check()}</Show>
                </button>
              )}</For>
            </Section>
          )}</For>

          <Section foot={error() ? <span class="error">{error()}</span>
            : <>Add or rename devices in <A href="/settings" onClick={p.onClose}>Settings</A>.</>}>
            <button type="button" class="cell" disabled={busy()} onClick={() => choose(null)}>
              <span class="grow">None</span>
              <Show when={data() && !linked()}>{Icon.check()}</Show>
            </button>
          </Section>
        </div>
      )}</Show>
    </Sheet>
  );
}
