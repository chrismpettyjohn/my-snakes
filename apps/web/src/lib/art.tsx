import { Show } from "solid-js";
import type { LogEventType, Snake } from "@snake/shared";
import { findSpecies } from "./species";

/* ---------- Snake avatars ---------- */
interface Palette { body: string; spot: string; bg: string; belly: string; bands?: boolean; dark?: boolean }
type AvatarProps = { name: string; species?: string | null; morph?: string | null; size?: number; sad?: boolean; class?: string };

/** Keyed by "Species" or "Species/Morph". */
const BY_SPECIES: Record<string, Palette> = {
  "Ball Python/Normal": { body: "#6b4423", spot: "#d0a35a", bg: "#f6e9d6", belly: "#eedcb4" },
  "Ball Python/Mojave": { body: "#4f3f35", spot: "#dcc79c", bg: "#efe8df", belly: "#efe4cf" },
  "California King": { body: "#1f1f22", spot: "#f6f4ea", bg: "#e9e9ec", belly: "#f6f4ea", bands: true, dark: true },
  "Mexican Black King": { body: "#202024", spot: "#34343a", bg: "#e4e4ea", belly: "#2c2c31", dark: true },
  "Pueblan Milk": { body: "#e2432f", spot: "#1d1d1f", bg: "#fde0dc", belly: "#f4d35e", bands: true },
  "Hognose/Brown": { body: "#a7804f", spot: "#5e4126", bg: "#f4eadb", belly: "#3a3532" },
};
const FALLBACK: Palette[] = [
  { body: "#7aa7e0", spot: "#3b5c99", bg: "#e2ecfa", belly: "#cfe0f6" },
  { body: "#b28ad8", spot: "#6a4596", bg: "#efe4f8", belly: "#e0cff2" },
  { body: "#5cc6b4", spot: "#227a6c", bg: "#dcf4ef", belly: "#c2ece3" },
  { body: "#f0b93a", spot: "#a0661a", bg: "#fdf1d4", belly: "#f8e2a8" },
  { body: "#ef8aa8", spot: "#a83e5f", bg: "#fde3eb", belly: "#f8ccd9" },
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function paletteFor(name: string, species?: string | null, morph?: string | null): Palette {
  const preset = findSpecies(species);
  const fallback = FALLBACK[hash(name) % FALLBACK.length]!;
  if (!preset) return fallback;
  const m = preset.morphs.find((x) => x.toLowerCase() === morph?.toLowerCase()) ?? preset.morphs[0];
  return BY_SPECIES[m ? `${preset.name}/${m}` : preset.name] ?? fallback;
}

/** A cute coiled snake, coloured by species (or by name when the species is unknown). */
function SnakeAvatar(p: AvatarProps) {
  const c = () => paletteFor(p.name, p.species, p.morph);
  const coil = "M14 47 C14 37 50 37 50 47 C50 56 20 56 20 47 C20 41 43 41 43 46";
  return (
    <svg class={`avatar ${p.class ?? ""}`} width={p.size ?? 56} height={p.size ?? 56} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={c().bg} />
      <ellipse cx="32" cy="55" rx="20" ry="3" fill="#000" opacity=".06" />
      <path d={coil} fill="none" stroke={c().body} stroke-width="9" stroke-linecap="round" />
      <path d={coil} fill="none" stroke={c().spot} stroke-width={c().bands ? 9 : 4} stroke-linecap={c().bands ? "butt" : "round"} stroke-dasharray={c().bands ? "2.5 6" : "0.1 8"} opacity=".9" />
      <path d="M43 46 C43 38 40 31 34 27" fill="none" stroke={c().body} stroke-width="9" stroke-linecap="round" />
      <path d="M43 44 C43 38 41 33 37 30" fill="none" stroke={c().belly} stroke-width="3" stroke-linecap="round" opacity=".7" />
      <g class="avatar-tongue">
        <path d="M32 30 v4 M32 34 l-1.6 1.8 M32 34 l1.6 1.8" stroke="#ff4d6d" stroke-width="1.3" stroke-linecap="round" fill="none" />
      </g>
      <ellipse cx="32" cy="22" rx="11" ry="8.5" fill={c().body} />
      <ellipse cx="32" cy="25.5" rx="7" ry="3.5" fill={c().belly} opacity=".55" />
      <g class="avatar-eyes">
        <Show when={c().dark}><circle cx="27.5" cy="20.5" r="3.4" fill="#fff" /><circle cx="36.5" cy="20.5" r="3.4" fill="#fff" /></Show>
        <circle cx="27.5" cy="20.5" r="2.4" fill="#1d1d1f" />
        <circle cx="36.5" cy="20.5" r="2.4" fill="#1d1d1f" />
        <circle cx="28.2" cy="19.7" r=".8" fill="#fff" />
        <circle cx="37.2" cy="19.7" r=".8" fill="#fff" />
      </g>
      <ellipse cx="24.5" cy="24.5" rx="2.2" ry="1.3" fill="#ff7a9a" opacity=".55" />
      <ellipse cx="39.5" cy="24.5" rx="2.2" ry="1.3" fill="#ff7a9a" opacity=".55" />
      <path d={p.sad ? "M30 27 q2 -1.4 4 0" : "M30 26 q2 1.6 4 0"} stroke="#1d1d1f" stroke-width="1.1" stroke-linecap="round" fill="none" />
      <Show when={p.sad}><path d="M41 15 q1.5 2.5 0 3.5 q-1.5 -1 0 -3.5z" fill="#6cc4ff" /></Show>
    </svg>
  );
}

/* ---------- Care log styles ---------- */
export const LOG_STYLE: Record<LogEventType, { emoji: string; label: string; color: string }> = {
  feeding: { emoji: "🐭", label: "Fed", color: "#ff9f0a" },
  refused: { emoji: "🙅", label: "Refused", color: "#ff453a" },
  shed: { emoji: "✨", label: "Shed", color: "#bf5af2" },
  poop: { emoji: "💩", label: "Pooped", color: "#a2845e" },
  urates: { emoji: "🤍", label: "Urates", color: "#98989d" },
  water: { emoji: "💧", label: "Water changed", color: "#0a84ff" },
  cleaning: { emoji: "🫧", label: "Cleaned", color: "#64d2ff" },
  weight: { emoji: "⚖️", label: "Weighed", color: "#30d158" },
  note: { emoji: "📝", label: "Note", color: "#ffd60a" },
};

/* ---------- Empty-state scene ---------- */
export function EmptyScene() {
  return (
    <svg class="scene" viewBox="0 0 240 150" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="50%" cy="0%" r="80%">
          <stop offset="0" stop-color="#ffd27a" stop-opacity=".9" />
          <stop offset="1" stop-color="#ffd27a" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path d="M150 0v18" stroke="#8e8e93" stroke-width="2" />
      <path d="M136 30a14 12 0 0 1 28 0z" fill="#8e8e93" />
      <ellipse cx="150" cy="95" rx="70" ry="60" fill="url(#glow)" class="lamp-glow" />
      <ellipse cx="120" cy="134" rx="104" ry="10" fill="#c9a77c" opacity=".35" />
      <path d="M40 134c0-34 22-52 48-52s48 18 48 52z" fill="#a1866a" />
      <path d="M62 134c0-20 12-30 26-30s26 10 26 30z" fill="#4a3a2c" />
      <path d="M152 128c4-14 10-22 18-22" stroke="#4cbf5a" stroke-width="5" stroke-linecap="round" fill="none" />
      <path d="M170 106c-6-8-4-18 2-22M170 106c6-6 14-6 18-2" stroke="#4cbf5a" stroke-width="4" stroke-linecap="round" fill="none" />
      <g class="peek">
        <path d="M74 134c0-10 6-18 14-18s14 8 14 18" fill="#c78f4e" />
        <circle cx="83" cy="124" r="2.6" fill="#1d1d1f" /><circle cx="93" cy="124" r="2.6" fill="#1d1d1f" />
        <circle cx="83.8" cy="123.2" r=".9" fill="#fff" /><circle cx="93.8" cy="123.2" r=".9" fill="#fff" />
        <ellipse cx="79" cy="129" rx="2.4" ry="1.4" fill="#ff7a9a" opacity=".6" />
        <ellipse cx="97" cy="129" rx="2.4" ry="1.4" fill="#ff7a9a" opacity=".6" />
      </g>
      <g fill="#ffd60a" class="sparkles">
        <path d="M200 40l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /><path d="M40 50l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" />
        <path d="M214 86l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
      </g>
    </svg>
  );
}

/** Photo if one was added, otherwise the illustrated avatar. */
export function SnakePic(p: { s: Pick<Snake, "name" | "species" | "morph"> & { photo?: string | null }; size?: number; sad?: boolean; class?: string }) {
  return (
    <Show when={p.s.photo} fallback={<SnakeAvatar name={p.s.name} species={p.s.species} morph={p.s.morph} size={p.size} sad={p.sad} class={p.class} />}>
      <img class={`avatar photo ${p.class ?? ""}`} src={p.s.photo!} alt="" width={p.size ?? 56} height={p.size ?? 56} />
    </Show>
  );
}

