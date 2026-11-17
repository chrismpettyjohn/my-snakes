import type { JSX } from "solid-js";
import type { DeviceKind, SensorRole } from "@snake/shared";

/** A 24×24 stroked icon in the current text colour (SF Symbols style). */
const stroked = (d: JSX.Element, width = 2, cls?: string) => (
  <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={width} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>
);
const ui = (d: JSX.Element) => stroked(d, 1.9);

/** Toolbar and list icons. */
export const Icon = {
  grid: () => ui(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  rows: () => ui(<><rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" /></>),
  dots: () => ui(<>{[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <rect x={x - 2} y={y - 2} width="4" height="4" rx="1" />))}</>),
  clock: () => ui(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></>),
  plus: () => ui(<path d="M12 5v14M5 12h14" />),
  more: () => ui(<><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>),
  chevron: () => stroked(<path d="m9 6 6 6-6 6" />, 2.5, "chev"),
  rotate: () => ui(<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>),
  check: () => stroked(<path d="m5 12 5 5 9-10" />, 2.5, "check"),
};

/** Glyphs for iOS Settings-style icon tiles. */
export const Glyph = {
  thermostat: () => stroked(<><path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z" /><path d="M12 9v6" /></>),
  droplet: () => stroked(<path d="M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z" />),
  cloud: () => stroked(<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 11.2 3.5 3.5 0 0 0 7 18z" />),
  people: () => stroked(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14c2.4.2 4 1.7 4.5 4.5" /></>),
  house: () => stroked(<><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></>),
  plug: () => stroked(<><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v4" /></>),
  wave: () => stroked(<><path d="M5 12a7 7 0 0 1 14 0" /><path d="M8.5 12a3.5 3.5 0 0 1 7 0" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>),
};

/** One glyph per enclosure zone. */
export const ZONE_GLYPH: Record<SensorRole, () => JSX.Element> = {
  warm: () => stroked(<><path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" /><path d="M12 9v7" /></>),
  cold: () => stroked(<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />),
  bask: () => stroked(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z" /></>),
  rhp: () => stroked(<><rect x="3" y="4" width="18" height="6" rx="1.5" /><path d="M7 14c0 1.5 1.2 1.5 1.2 3S7 18.5 7 20M12 14c0 1.5 1.2 1.5 1.2 3S12 18.5 12 20M17 14c0 1.5 1.2 1.5 1.2 3S17 18.5 17 20" /></>),
};

/** Tile gradients, so each section and device kind keeps one colour everywhere. */
export const TILE = {
  herpstat: "linear-gradient(135deg,#ffb340,#ff7a00)",
  govee: "linear-gradient(135deg,#7ad7ff,#32ade6)",
  people: "linear-gradient(135deg,#5de07a,#28b446)",
  home: "linear-gradient(135deg,#7d7aff,#5856d6)",
} as const;

export const DEVICE_GLYPH: Record<DeviceKind, () => JSX.Element> = { herpstat: Glyph.thermostat, govee: Glyph.droplet };

export function IconTile(p: { color: string; children: JSX.Element }) {
  return <span class="icon-tile" style={{ background: p.color }}>{p.children}</span>;
}

/** The tile for a device kind: orange thermostat or blue droplet. */
export const DeviceTile = (p: { kind: DeviceKind }) => <IconTile color={TILE[p.kind]}>{DEVICE_GLYPH[p.kind]()}</IconTile>;
