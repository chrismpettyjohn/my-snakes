import { createSignal, For, Show } from "solid-js";
import type { AlertRanges, Sex, Snake, UpsertSnakeInput } from "@snake/shared";
import { createAction } from "../../lib/action";
import { api } from "../../lib/api";
import { SnakePic } from "../../lib/art";
import { homeId } from "../../lib/home";
import { Icon } from "../../lib/icons";
import { toThumb } from "../../lib/image";
import { findSpecies, SPECIES, type SpeciesPreset } from "../../lib/species";
import { Section, Segmented, formValue } from "../../lib/ui";

const OTHER = "__other";
const SEXES = ["unknown", "male", "female"] as const;

const presetRanges = (p: SpeciesPreset): AlertRanges =>
  ({ minTempF: p.minTempF, maxTempF: p.maxTempF, minHumidity: p.minHumidity, maxHumidity: p.maxHumidity });

/** One numeric alert threshold row. */
function RangeInput(p: { label: string; unit: "°F" | "%"; value: number | null; onInput: (v: number | null) => void }) {
  const temp = p.unit === "°F";
  return (
    <label class="cell"><span class="grow">{p.label}</span>
      <input class="value range-input" type="number" step={temp ? "0.1" : undefined} inputmode={temp ? "decimal" : "numeric"}
        placeholder={p.unit} value={p.value ?? ""}
        onInput={(e) => { const v = e.currentTarget.value; p.onInput(v === "" ? null : Number(v)); }} />
    </label>
  );
}

/** Add (name + species) or edit. Species presets fill the alert ranges; everything else is tucked away. */
export function SnakeForm(p: { snake?: Snake; onDone: (deleted?: boolean) => void }) {
  const a = p.snake;
  const [species, setSpecies] = createSignal(a?.species ?? "");
  const [name, setName] = createSignal(a?.name ?? "");
  const [morph, setMorph] = createSignal(a?.morph ?? findSpecies(a?.species)?.morphs[0] ?? "");
  const morphs = () => findSpecies(species())?.morphs ?? [];
  const [sex, setSex] = createSignal<Sex>(a?.sex ?? "unknown");
  const [range, setRange] = createSignal<AlertRanges>({
    minTempF: a?.minTempF ?? null, maxTempF: a?.maxTempF ?? null, minHumidity: a?.minHumidity ?? null, maxHumidity: a?.maxHumidity ?? null,
  });
  const setBound = (k: keyof AlertRanges) => (v: number | null) => setRange({ ...range(), [k]: v });
  const [custom, setCustom] = createSignal(!!a?.species && !findSpecies(a.species));
  const [photo, setPhoto] = createSignal<string | null>(a?.photo ?? null);
  const { busy, error, setError, run } = createAction();

  const pickSpecies = (v: string) => {
    if (v === OTHER) { setCustom(true); setSpecies(""); return; }
    setCustom(false); setSpecies(v);
    const preset = findSpecies(v);
    setMorph(preset?.morphs[0] ?? "");
    if (preset) setRange(presetRanges(preset));
  };

  function save(e: SubmitEvent) {
    e.preventDefault();
    const opt = (k: string) => formValue(e, k) || undefined;
    const body: UpsertSnakeInput = {
      name: formValue(e, "name"), species: species().trim() || undefined, morph: morph().trim() || undefined, sex: sex(),
      hatchDate: opt("hatchDate") ?? null, notes: opt("notes"), photo: photo(), ...range(),
    };
    void run(async () => {
      if (a) await api(`/snakes/${a.id}`, { method: "PUT", body });
      else await api(`/homes/${homeId()}/snakes`, { body });
      p.onDone();
    });
  }

  function remove() {
    if (!a || !confirm(`Delete ${a.name} and its history?`)) return;
    void run(async () => {
      await api(`/snakes/${a.id}`, { method: "DELETE" });
      p.onDone(true);
    });
  }

  return (
    <form onSubmit={save}>
      <div class="form-avatar">
        <label class="photo-pick">
          <SnakePic s={{ name: name(), species: species(), morph: morph(), photo: photo() }} size={96} />
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (f) { try { setPhoto(await toThumb(f)); } catch { setError("Couldn't read that image"); } }
          }} />
          <span class="photo-btn">{photo() ? "Change Photo" : "Add Photo"}</span>
        </label>
        <Show when={photo()}><button type="button" class="link-btn" onClick={() => setPhoto(null)}>Remove photo</button></Show>
      </div>
      <Section>
        <label class="cell"><input name="name" required placeholder="Name" value={a?.name ?? ""} autofocus={!a} onInput={(e) => setName(e.currentTarget.value)} /></label>
        <label class="cell">
          <span class="grow">Species</span>
          <select value={custom() ? OTHER : species()} onChange={(e) => pickSpecies(e.currentTarget.value)}>
            <option value="">Not set</option>
            <For each={SPECIES}>{(sp) => <option value={sp.name}>{sp.name}</option>}</For>
            <option value={OTHER}>Other…</option>
          </select>
        </label>
        <Show when={morphs().length > 1}>
          <div class="cell"><span class="label">Morph</span><Segmented value={morph()} options={morphs()} onChange={setMorph} /></div>
        </Show>
        <Show when={morphs().length === 1}>
          <div class="cell"><span class="grow">Morph</span><span class="value">{morphs()[0]}</span></div>
        </Show>
        <Show when={custom()}>
          <label class="cell"><input placeholder="Species name" value={species()} onInput={(e) => setSpecies(e.currentTarget.value)} /></label>
        </Show>
      </Section>

      <details class="section more" open={!!a}>
        <summary class="section-title"><span>Details</span>{Icon.chevron()}</summary>
        <div class="group">
          <Show when={!morphs().length}>
            <label class="cell"><span class="label">Morph</span><input placeholder="Optional" value={morph()} onInput={(e) => setMorph(e.currentTarget.value)} /></label>
          </Show>
          <div class="cell"><span class="label">Sex</span><Segmented value={sex()} options={SEXES} onChange={setSex} /></div>
          <label class="cell"><span class="label">Hatched</span><input name="hatchDate" type="date" value={a?.hatchDate ?? ""} /></label>
          <label class="cell"><textarea name="notes" rows="2" placeholder="Notes">{a?.notes ?? ""}</textarea></label>
        </div>
      </details>

      <details class="section more">
        <summary class="section-title"><span>Alert ranges</span>{Icon.chevron()}</summary>
        <div class="group">
          <RangeInput label="Min temperature" unit="°F" value={range().minTempF} onInput={setBound("minTempF")} />
          <RangeInput label="Max temperature" unit="°F" value={range().maxTempF} onInput={setBound("maxTempF")} />
          <RangeInput label="Min humidity" unit="%" value={range().minHumidity} onInput={setBound("minHumidity")} />
          <RangeInput label="Max humidity" unit="%" value={range().maxHumidity} onInput={setBound("maxHumidity")} />
        </div>
        <p class="section-foot">
          Picking a species fills these in. You'll get an alert when a linked sensor reads outside them.
          <Show when={findSpecies(species())}>{(sp) => <> <button type="button" class="link" onClick={() => setRange(presetRanges(sp()))}>Reset to {sp().name} defaults</button></>}</Show>
        </p>
      </details>

      <Show when={error()}><p class="error" style={{ "margin-bottom": "12px" }}>{error()}</p></Show>
      <button class="btn block" disabled={busy()}>{a ? "Save" : "Add Snake"}</button>
      <Show when={a}>
        <button type="button" class="btn block gray danger" style={{ "margin-top": "12px" }} disabled={busy()} onClick={remove}>Delete Snake</button>
      </Show>
    </form>
  );
}
