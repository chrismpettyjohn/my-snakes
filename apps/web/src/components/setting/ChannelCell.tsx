import { For, Show } from "solid-js";
import { ROLE_LABEL, rolesFor, type Device, type DeviceChannel, type LinkableSnake, type SensorRole } from "@snake/shared";
import { SnakePic } from "../../lib/art";
import { Icon } from "../../lib/icons";

/** Encodes a <select> option: "<snakeId>|<role>", or "" for not linked. */
const optionValue = (snakeId: string, role: SensorRole | null) => `${snakeId}|${role ?? ""}`;

/**
 * One assignable row: a Herpstat output, or a Govee sensor under its account. A single picker
 * chooses "<snake> · <zone>": thermostat outputs drive heat zones, air sensors read ambient ones.
 */
export function ChannelCell(p: {
  d: Device; c: DeviceChannel; snakes: LinkableSnake[]; busy: boolean;
  onAssign: (snakeId: string | null, role: SensorRole | null) => void;
  title?: string; detail?: string; onMenu?: () => void;
}) {
  const linked = () => p.snakes.find((s) => s.id === p.c.snakeIds[0]);
  /** Devices serve every collection, so name the collection once there is more than one. */
  const multi = () => new Set(p.snakes.map((s) => s.collection)).size > 1;
  return (
    <label class="cell indent">
      <Show when={linked()} fallback={<span class="chan-empty" />}>{(s) => <SnakePic s={s()} size={28} />}</Show>
      <span class="grow">
        <span class="title">{p.title ?? p.c.label ?? p.c.channel}</span>
        <Show when={p.detail}><span class="detail">{p.detail}</span></Show>
      </span>
      <select value={p.c.snakeIds[0] ? optionValue(p.c.snakeIds[0], p.c.role) : ""} disabled={p.busy}
        onChange={(e) => {
          const [snakeId, role] = e.currentTarget.value.split("|");
          p.onAssign(snakeId || null, (role || null) as SensorRole | null);
        }}>
        <option value="">Not linked</option>
        <Show when={linked() && !p.c.role}><option value={optionValue(p.c.snakeIds[0]!, null)}>{linked()!.name} · pick a zone</option></Show>
        <For each={p.snakes}>{(s) => (
          <optgroup label={multi() ? `${s.name} · ${s.collection}` : s.name}>
            <For each={rolesFor(p.d.kind)}>{(r) => <option value={optionValue(s.id, r)}>{s.name} · {ROLE_LABEL[r]}</option>}</For>
          </optgroup>
        )}</For>
      </select>
      {Icon.chevron()}
      <Show when={p.onMenu}>{(open) => (
        <button type="button" class="icon-btn" aria-label={`${p.d.name} options`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); open()(); }}>{Icon.more()}</button>
      )}</Show>
    </label>
  );
}
