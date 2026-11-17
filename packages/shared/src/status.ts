import type { SensorRole } from "./device";
import type { LogEventType } from "./husbandry";

export type Metric = "temp_f" | "humidity" | "power_pct" | "setpoint_f";

/** One value as produced by a device, before it's stored. */
export interface ReadingInput { channel: string; metric: Metric; value: number }

export interface Reading extends ReadingInput {
  deviceId: string;
  at: string;
}

/** Latest values for one enclosure zone. */
export interface Zone {
  role: SensorRole;
  tempF: number | null;
  humidity: number | null;
  powerPct: number | null;
  setpointF: number | null;
  at: string | null;
  stale: boolean;
  /** Reading is outside the snake's range (ambient) or far from setpoint (heat). */
  bad: boolean;
}

export type Zones = Partial<Record<SensorRole, Zone>>;

export interface SnakeStatus {
  id: string;
  name: string;
  species: string | null;
  morph: string | null;
  photo: string | null;
  zones: Zones;
  readings: (Reading & { deviceName: string; channelLabel: string | null; role: SensorRole | null; stale: boolean })[];
  alerts: string[];
  /** When each kind of husbandry event was last logged (ISO), for the activity view. */
  lastLog: Partial<Record<LogEventType, string>>;
}

/** Mean of the non-null values, or null if there are none. */
export function average(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/**
 * Ambient ranges apply to the enclosure average of the warm & cold sides, not each side alone
 * (the warm side is meant to sit high and the cold side low).
 */
export function ambient(zones: Zones) {
  const sides = [zones.warm, zones.cold].filter((z): z is Zone => !!z);
  return { sides, tempF: average(sides.map((z) => z.tempF)), humidity: average(sides.map((z) => z.humidity)) };
}
