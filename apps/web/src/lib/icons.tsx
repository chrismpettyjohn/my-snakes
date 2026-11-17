import type {JSX} from 'solid-js';
import type {CollectionColor, CollectionIcon, DeviceKind, SensorRole} from '@snake/shared';

const stroked = (d: JSX.Element, width = 2, cls?: string) => (
  <svg
    class={cls}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={width}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);
const ui = (d: JSX.Element) => stroked(d, 1.9);

export const Icon = {
  grid: () =>
    ui(
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </>,
    ),
  rows: () =>
    ui(
      <>
        <rect x="4" y="4" width="16" height="7" rx="1.5" />
        <rect x="4" y="13" width="16" height="7" rx="1.5" />
      </>,
    ),
  dots: () => ui(<>{[5, 12, 19].flatMap(y => [5, 12, 19].map(x => <rect x={x - 2} y={y - 2} width="4" height="4" rx="1" />))}</>),
  clock: () =>
    ui(
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </>,
    ),
  plus: () => ui(<path d="M12 5v14M5 12h14" />),
  more: () =>
    ui(
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>,
    ),
  chevron: () => stroked(<path d="m9 6 6 6-6 6" />, 2.5, 'chev'),
  rotate: () =>
    ui(
      <>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </>,
    ),
  check: () => stroked(<path d="m5 12 5 5 9-10" />, 2.5, 'check'),
};

export const Glyph = {
  thermostat: () =>
    stroked(
      <>
        <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z" />
        <path d="M12 9v6" />
      </>,
    ),
  droplet: () => stroked(<path d="M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z" />),
  cloud: () => stroked(<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 11.2 3.5 3.5 0 0 0 7 18z" />),
  people: () =>
    stroked(
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16.5 14c2.4.2 4 1.7 4.5 4.5" />
      </>,
    ),
  house: () =>
    stroked(
      <>
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v9h12v-9" />
      </>,
    ),
  plug: () =>
    stroked(
      <>
        <path d="M9 3v5M15 3v5" />
        <path d="M6 8h12v3a6 6 0 0 1-12 0z" />
        <path d="M12 17v4" />
      </>,
    ),
  wave: () =>
    stroked(
      <>
        <path d="M5 12a7 7 0 0 1 14 0" />
        <path d="M8.5 12a3.5 3.5 0 0 1 7 0" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </>,
    ),
};

export const ZONE_GLYPH: Record<SensorRole, () => JSX.Element> = {
  warm: () =>
    stroked(
      <>
        <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
        <path d="M12 9v7" />
      </>,
    ),
  cold: () => stroked(<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />),
  bask: () =>
    stroked(
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z" />
      </>,
    ),
  rhp: () =>
    stroked(
      <>
        <rect x="3" y="4" width="18" height="6" rx="1.5" />
        <path d="M7 14c0 1.5 1.2 1.5 1.2 3S7 18.5 7 20M12 14c0 1.5 1.2 1.5 1.2 3S12 18.5 12 20M17 14c0 1.5 1.2 1.5 1.2 3S17 18.5 17 20" />
      </>,
    ),
};

export const TILE = {
  herpstat: 'linear-gradient(135deg,#ffb340,#ff7a00)',
  govee: 'linear-gradient(135deg,#7ad7ff,#32ade6)',
  people: 'linear-gradient(135deg,#5de07a,#28b446)',
  home: 'linear-gradient(135deg,#7d7aff,#5856d6)',
} as const;

const DEVICE_GLYPH: Record<DeviceKind, () => JSX.Element> = {herpstat: Glyph.thermostat, govee: Glyph.droplet};

export function IconTile(p: {color: string; children: JSX.Element}) {
  return (
    <span class="icon-tile" style={{background: p.color}}>
      {p.children}
    </span>
  );
}

export const DeviceTile = (p: {kind: DeviceKind}) => <IconTile color={TILE[p.kind]}>{DEVICE_GLYPH[p.kind]()}</IconTile>;

export const COLLECTION_GLYPH: Record<CollectionIcon, () => JSX.Element> = {
  house: Glyph.house,
  bedroom: () =>
    stroked(
      <>
        <path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
        <circle cx="7" cy="11" r="1.6" />
      </>,
    ),
  living: () =>
    stroked(
      <>
        <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
        <path d="M3 13a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v4H3z" />
        <path d="M5 17v2M19 17v2" />
      </>,
    ),
  office: () =>
    stroked(
      <>
        <rect x="4" y="4" width="16" height="11" rx="1.5" />
        <path d="M9 20h6M12 15v5" />
      </>,
    ),
  upstairs: () =>
    stroked(
      <>
        <path d="M4 20h4v-4h4v-4h4V8h4" />
        <path d="M14 4h6v6M20 4l-6 6" />
      </>,
    ),
  basement: () =>
    stroked(
      <>
        <path d="M4 8h4v4h4v4h4v4h4" />
        <path d="M10 4 4 10M4 4v6h6" />
      </>,
    ),
  garage: () =>
    stroked(
      <>
        <path d="M3 10 12 4l9 6v10H3z" />
        <path d="M7 20v-7h10v7M7 16h10" />
      </>,
    ),
  closet: () =>
    stroked(
      <>
        <path d="M12 7a2 2 0 1 1 2-2c0 1-2 1.5-2 3" />
        <path d="M12 8 3 15a1 1 0 0 0 .6 1.8h16.8A1 1 0 0 0 21 15z" />
      </>,
    ),
  rack: () =>
    stroked(
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
        <path d="M4 9.2h16M4 14.8h16M15 6.3h2M15 12h2M15 17.6h2" />
      </>,
    ),
  breeding: () =>
    stroked(
      <>
        <path d="M9 4c-2.5 0-4.5 4-4.5 7.5a4.5 4.5 0 0 0 9 0C13.5 8 11.5 4 9 4z" />
        <path d="M16 9c-1.8 0-3 2.5-3 5 0 .3 0 .6.1.9M16 9c1.8 0 3.5 2.7 3.5 5.2a3.5 3.5 0 0 1-5.6 2.8" />
      </>,
    ),
  quarantine: () =>
    stroked(
      <>
        <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6z" />
        <path d="M12 9v6M9 12h6" />
      </>,
    ),
  building: () =>
    stroked(
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="1" />
        <path d="M9 7.5h1.5M13.5 7.5H15M9 11.5h1.5M13.5 11.5H15M10.5 20.5v-4h3v4" />
      </>,
    ),
};

export const COLLECTION_ICON_LABEL: Record<CollectionIcon, string> = {
  house: 'House',
  bedroom: 'Bedroom',
  living: 'Living room',
  office: 'Office',
  upstairs: 'Upstairs',
  basement: 'Basement',
  garage: 'Garage',
  closet: 'Closet',
  rack: 'Rack',
  breeding: 'Breeding',
  quarantine: 'Quarantine',
  building: 'Other building',
};

export const COLLECTION_COLOR: Record<CollectionColor, string> = {
  indigo: TILE.home,
  blue: 'linear-gradient(135deg,#5ac8fa,#007aff)',
  teal: 'linear-gradient(135deg,#6ee0d8,#30b0c7)',
  green: 'linear-gradient(135deg,#5de07a,#28b446)',
  yellow: 'linear-gradient(135deg,#ffd60a,#ffb800)',
  orange: 'linear-gradient(135deg,#ffb340,#ff7a00)',
  red: 'linear-gradient(135deg,#ff6961,#ff3b30)',
  pink: 'linear-gradient(135deg,#ff7aa2,#ff2d55)',
  purple: 'linear-gradient(135deg,#da8fff,#af52de)',
  gray: 'linear-gradient(135deg,#aeaeb2,#8e8e93)',
};

export const CollectionTile = (p: {icon?: CollectionIcon; color?: CollectionColor}) => (
  <IconTile color={COLLECTION_COLOR[p.color!] ?? COLLECTION_COLOR.indigo}>{(COLLECTION_GLYPH[p.icon!] ?? COLLECTION_GLYPH.house)()}</IconTile>
);
