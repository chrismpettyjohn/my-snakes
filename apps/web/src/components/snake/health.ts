import type { AlertRanges } from "@snake/shared";
import { findSpecies } from "../../lib/species";

export type Health = "ok" | "warn" | "bad";
const RANK: Record<Health, number> = { ok: 0, warn: 1, bad: 2 };

/**
 * Safety rating for one reading against a [lo, hi] range: outside → "bad"; inside but within the
 * margin of either edge → "warn"; otherwise "ok". The margin is 15% of the range's width, but at
 * least `minMargin`, so narrow ranges still get a usable warning band.
 */
export function rate(v: number | null, lo: number | null | undefined, hi: number | null | undefined, minMargin: number): Health | null {
  if (v == null || (lo == null && hi == null)) return null;
  if ((lo != null && v < lo) || (hi != null && v > hi)) return "bad";
  const m = lo != null && hi != null ? Math.max(minMargin, (hi - lo) * 0.15) : minMargin;
  if ((lo != null && v < lo + m) || (hi != null && v > hi - m)) return "warn";
  return "ok";
}

/** The worst of several ratings, ignoring unrated ones. */
export const worst = (hs: (Health | null)[]): Health | null =>
  hs.reduce<Health | null>((w, h) => (h && (!w || RANK[h] > RANK[w]) ? h : w), null);

/** A snake's own alert thresholds, each falling back to its species' recommended range. */
export function rangesFor(snake: Partial<AlertRanges> | undefined, species: string | null): Partial<AlertRanges> {
  const sp = findSpecies(species);
  return {
    minTempF: snake?.minTempF ?? sp?.minTempF, maxTempF: snake?.maxTempF ?? sp?.maxTempF,
    minHumidity: snake?.minHumidity ?? sp?.minHumidity, maxHumidity: snake?.maxHumidity ?? sp?.maxHumidity,
  };
}

/** Ambient health: temperature (2 °F margin) and humidity (5 % margin), worse of the two. */
export function ambientHealth(tempF: number | null, humidity: number | null, r: Partial<AlertRanges>) {
  return worst([rate(tempF, r.minTempF, r.maxTempF, 2), rate(humidity, r.minHumidity, r.maxHumidity, 5)]);
}
