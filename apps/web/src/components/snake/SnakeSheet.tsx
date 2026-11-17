import { createResource, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import type { SensorRole, Snake, SnakeLog, SnakeStatus } from "@snake/shared";
import { api } from "../../lib/api";
import { LOG_STYLE, SnakePic } from "../../lib/art";
import { ago, subtitle } from "../../lib/format";
import { findSpecies, type SpeciesPreset } from "../../lib/species";
import { Section, Sheet } from "../../lib/ui";
import { SnakeForm } from "./SnakeForm";
import { Zones } from "./Zones";

/** A snake's detail sheet: alerts, zones, recent logs and care ranges; Edit swaps in the form. */
export function SnakeSheet(p: { status?: SnakeStatus; snake?: Snake; onClose: () => void; onChange: () => void; onPick: (s: SnakeStatus, role: SensorRole) => void }) {
  const [editing, setEditing] = createSignal(false);
  const close = () => { setEditing(false); p.onClose(); };
  return (
    <Sheet open={!!p.status} onClose={close} title={editing() ? "Edit" : ""}
      done={editing() ? undefined : <button type="button" onClick={() => setEditing(true)}>Edit</button>}>
      <Show when={p.status}>{(s) => (
        <Show when={!editing()} fallback={
          <SnakeForm snake={p.snake} onDone={(deleted) => { setEditing(false); p.onChange(); if (deleted) p.onClose(); }} />
        }>
          <div class="sheet-hero">
            <SnakePic s={s()} size={88} sad={s().alerts.length > 0} class="hero-avatar" />
            <h1>{s().name}</h1>
            <Show when={subtitle(s())}><p class="muted">{subtitle(s())}</p></Show>
            <Show when={s().alerts.length}>
              <div class="alerts" role="alert">
                <For each={s().alerts}>{(a) => <div class="alert-banner"><span class="alert-ic">⚠️</span><span class="grow">{a}</span></div>}</For>
              </div>
            </Show>
            <Zones s={s()} onPick={(role) => p.onPick(s(), role)} />
          </div>
          <CareLog snakeId={s().id} />
          <Show when={p.snake && (p.snake.minTempF != null || p.snake.minHumidity != null) && p.snake}>{(a) => <AlertRanges snake={a()} />}</Show>
          <Show when={findSpecies(s().species)}>{(sp) => <Recommended sp={sp()} />}</Show>
          <Show when={!Object.keys(s().zones).length}>
            <Section foot={<>Link sensors to {s().name} in <A href="/settings" onClick={close}>Settings</A>.</>}>
              <div class="cell"><span class="grow muted">No zones linked</span></div>
            </Section>
          </Show>
        </Show>
      )}</Show>
    </Sheet>
  );
}

const SHOWN_LOGS = 2;

/** The most recent husbandry logs. */
function CareLog(p: { snakeId: string }) {
  const [logs] = createResource(() => p.snakeId, (id) => api<SnakeLog[]>(`/snakes/${id}/logs`));
  return (
    <div class="activity">
      <Section title="Activity Log">
        <Show when={logs()?.length} fallback={<div class="cell activity-empty"><span class="muted">{logs.loading ? " " : "No logs yet"}</span></div>}>
          <For each={logs()!.slice(0, SHOWN_LOGS)}>{(l) => {
            const st = LOG_STYLE[l.type];
            return (
              <div class="cell">
                <span class="log-ic" style={{ "--c": st?.color ?? "#8e8e93" }}>{st?.emoji ?? "•"}</span>
                <span class="grow"><span class="title">
                  {st?.label ?? l.type}{l.value != null ? ` · ${l.value} g` : ""}{l.notes ? ` · ${l.notes}` : ""}
                </span></span>
                <span class="value">{ago(l.at)}</span>
              </div>
            );
          }}</For>
        </Show>
      </Section>
    </div>
  );
}

const range = (lo: number | null, hi: number | null, unit: string) => `${lo ?? "–"}–${hi ?? "–"}${unit}`;

function AlertRanges(p: { snake: Snake }) {
  return (
    <Section title="Alert ranges">
      <div class="cell"><span class="log-ic" style={{ "--c": "#ff9f0a" }}>🌡️</span><span class="grow">Ambient temperature</span><span class="value">{range(p.snake.minTempF, p.snake.maxTempF, "°F")}</span></div>
      <div class="cell"><span class="log-ic" style={{ "--c": "#64d2ff" }}>💧</span><span class="grow">Ambient humidity</span><span class="value">{range(p.snake.minHumidity, p.snake.maxHumidity, "%")}</span></div>
    </Section>
  );
}

/** The species' healthy baseline: what to program into the Herpstat, and the Govee alarm ranges. */
function Recommended(p: { sp: SpeciesPreset }) {
  const h = p.sp.herpstat;
  const row = (label: string, value: string) => <div class="cell"><span class="grow">{label}</span><span class="value">{value}</span></div>;
  /** Parent row with indented day/night child rows underneath. */
  const split = (label: string, day: number, night: number) => (
    <>
      <div class="cell parent"><span class="grow">{label}</span></div>
      <div class="cell child"><span class="grow">Day</span><span class="value">{day}°F</span></div>
      <div class="cell child"><span class="grow">Night</span><span class="value">{night}°F</span></div>
    </>
  );
  return (
    <>
      <Section title={`Herpstat · ${p.sp.name}`} foot="Recommended thermostat program for this species.">
        {split("Basking", h.baskDay, h.baskNight)}
        {split("RHP", h.rhpDay, h.rhpNight)}
        {row("Alarms", `${h.lowAlarm}–${h.highAlarm}°F`)}
      </Section>
      <Section title="Govee alarms">
        {row("Temperature", `${p.sp.minTempF}–${p.sp.maxTempF}°F`)}
        {row("Humidity", `${p.sp.minHumidity}–${p.sp.maxHumidity}%`)}
      </Section>
    </>
  );
}
