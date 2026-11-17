import {findSpecies} from '../../lib/species';
import type {AlertRanges} from '@snake/shared';

export type Health = 'ok' | 'warn' | 'bad';
const RANK: Record<Health, number> = {ok: 0, warn: 1, bad: 2};

function rate(v: number | null, lo: number | null | undefined, hi: number | null | undefined, minMargin: number): Health | null {
  if (v == null || (lo == null && hi == null)) return null;
  if ((lo != null && v < lo) || (hi != null && v > hi)) return 'bad';
  const m = lo != null && hi != null ? Math.max(minMargin, (hi - lo) * 0.15) : minMargin;
  if ((lo != null && v < lo + m) || (hi != null && v > hi - m)) return 'warn';
  return 'ok';
}

const worst = (hs: (Health | null)[]): Health | null => hs.reduce<Health | null>((w, h) => (h && (!w || RANK[h] > RANK[w]) ? h : w), null);

export function rangesFor(snake: Partial<AlertRanges> | undefined, species: string | null): Partial<AlertRanges> {
  const sp = findSpecies(species);
  return {
    minTempF: snake?.minTempF ?? sp?.minTempF,
    maxTempF: snake?.maxTempF ?? sp?.maxTempF,
    minHumidity: snake?.minHumidity ?? sp?.minHumidity,
    maxHumidity: snake?.maxHumidity ?? sp?.maxHumidity,
  };
}

export function ambientHealth(tempF: number | null, humidity: number | null, r: Partial<AlertRanges>) {
  return worst([rate(tempF, r.minTempF, r.maxTempF, 2), rate(humidity, r.minHumidity, r.maxHumidity, 5)]);
}
