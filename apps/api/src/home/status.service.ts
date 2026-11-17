import {DB, type Db} from '../db/db.module';
import {desc, eq, inArray} from 'drizzle-orm';
import {Inject, Injectable} from '@nestjs/common';
import {ReadingService} from '../reading/reading.service';
import {snakeSensors, snakeLogs, snakes, devices} from '../db/schema';
import {ROLE_LABEL, ambient, type LogEventType, type Metric, type SensorRole, type SnakeStatus, type Zone, type Zones} from '@snake/shared';

const STALE_MS = 15 * 60_000;
const SETPOINT_DRIFT_F = 5;

type SnakeRow = typeof snakes.$inferSelect;
type StatusReading = SnakeStatus['readings'][number];

function guessRole(label: string | null, kind: string): SensorRole | null {
  const l = (label ?? '').toLowerCase();
  if (kind === 'herpstat') return /rhp|panel|belly/.test(l) ? 'rhp' : /bask|bulb|lamp|spot/.test(l) ? 'bask' : null;
  return /cold|cool/.test(l) ? 'cold' : /warm|hot/.test(l) ? 'warm' : null;
}

const ZONE_FIELD: Record<Metric, keyof Pick<Zone, 'tempF' | 'humidity' | 'powerPct' | 'setpointF'>> = {
  temp_f: 'tempF',
  humidity: 'humidity',
  power_pct: 'powerPct',
  setpoint_f: 'setpointF',
};

function toZones(rs: StatusReading[]): Zones {
  const zones: Zones = {};
  for (const r of rs) {
    if (!r.role) continue;
    const z = (zones[r.role] ??= {role: r.role, tempF: null, humidity: null, powerPct: null, setpointF: null, at: null, stale: false, bad: false});
    z[ZONE_FIELD[r.metric]] = r.value;
    if (!z.at || r.at > z.at) z.at = r.at;
    z.stale ||= r.stale;
  }
  return zones;
}

function alertsFor(a: SnakeRow, zones: Zones, rs: StatusReading[], linked: boolean, now: number): string[] {
  const alerts: string[] = [];
  for (const z of Object.values(zones)) {
    const label = ROLE_LABEL[z.role];
    if (z.stale && z.at) alerts.push(`${label}: no data for ${Math.round((now - Date.parse(z.at)) / 60000)} min`);
    if (z.tempF == null || z.role === 'warm' || z.role === 'cold') continue;
    if (z.setpointF != null && Math.abs(z.tempF - z.setpointF) > SETPOINT_DRIFT_F) {
      z.bad = true;
      alerts.push(`${label}: ${z.tempF.toFixed(1)}°F, set to ${z.setpointF}°F`);
    }
  }

  const {sides, tempF: temp, humidity: rh} = ambient(zones);
  if (temp != null) {
    const t = temp.toFixed(1);
    const low = a.minTempF != null && temp < a.minTempF,
      high = a.maxTempF != null && temp > a.maxTempF;
    if (low) alerts.push(`Ambient: ${t}°F avg below ${a.minTempF}°F`);
    if (high) alerts.push(`Ambient: ${t}°F avg above ${a.maxTempF}°F`);
    if (low || high) for (const z of sides) z.bad = true;
  }
  if (rh != null) {
    if (a.minHumidity != null && rh < a.minHumidity) alerts.push(`Ambient: ${Math.round(rh)}% RH avg below ${a.minHumidity}%`);
    if (a.maxHumidity != null && rh > a.maxHumidity) alerts.push(`Ambient: ${Math.round(rh)}% RH avg above ${a.maxHumidity}%`);
  }
  for (const r of rs) if (!r.role && r.stale) alerts.push(`${r.channelLabel ?? `${r.deviceName} ${r.channel}`}: no recent data`);
  if (linked && !rs.length) alerts.push('No sensor data in the last 24h');
  return [...new Set(alerts)];
}

@Injectable()
export class StatusService {
  constructor(
    @Inject(DB) private db: Db,
    private reading: ReadingService,
  ) {}

  async forHome(homeId: string): Promise<SnakeStatus[]> {
    const anims = await this.db.select().from(snakes).where(eq(snakes.homeId, homeId)).orderBy(snakes.position, snakes.name);
    if (!anims.length) return [];
    const snakeIds = anims.map(a => a.id);

    const links = await this.db
      .select({l: snakeSensors, deviceName: devices.name, kind: devices.kind, labels: devices.channelLabels})
      .from(snakeSensors)
      .innerJoin(devices, eq(devices.id, snakeSensors.deviceId))
      .where(inArray(snakeSensors.snakeId, snakeIds));

    const [latest, lastLogs] = await Promise.all([
      this.reading.latest([...new Set(links.map(x => x.l.deviceId))]),
      this.db
        .selectDistinctOn([snakeLogs.snakeId, snakeLogs.type], {snakeId: snakeLogs.snakeId, type: snakeLogs.type, at: snakeLogs.at})
        .from(snakeLogs)
        .where(inArray(snakeLogs.snakeId, snakeIds))
        .orderBy(snakeLogs.snakeId, snakeLogs.type, desc(snakeLogs.at)),
    ]);

    const now = Date.now();
    return anims.map(a => {
      const mine = links.filter(x => x.l.snakeId === a.id);
      const rs = latest.flatMap((r): StatusReading[] => {
        const link = mine.find(m => m.l.deviceId === r.deviceId && m.l.channel === r.channel);
        if (!link) return [];
        const channelLabel = link.labels?.[r.channel] ?? null;
        return [
          {
            deviceId: r.deviceId,
            channel: r.channel,
            metric: r.metric as Metric,
            value: r.value,
            at: r.at.toISOString(),
            deviceName: link.deviceName,
            channelLabel,
            role: link.l.role ?? guessRole(channelLabel, link.kind),
            stale: now - r.at.getTime() > STALE_MS,
          },
        ];
      });
      const zones = toZones(rs);
      const alerts = alertsFor(a, zones, rs, mine.length > 0, now);

      const lastLog: SnakeStatus['lastLog'] = {};
      for (const l of lastLogs) if (l.snakeId === a.id) lastLog[l.type as LogEventType] = l.at.toISOString();

      return {id: a.id, name: a.name, species: a.species, morph: a.morph, photo: a.photo, zones, readings: rs, alerts, lastLog};
    });
  }
}
