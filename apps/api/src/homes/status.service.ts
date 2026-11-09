import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ROLE_LABEL, type LogEventType, type SnakeStatus, type Metric, type SensorRole, type Zone } from "@snake/shared";
import { DB, type Db } from "../db/db.module";
import { snakeSensors, snakeLogs, snakes, devices, readings } from "../db/schema";

const STALE_MS = 15 * 60_000;
/** Heat zones alert when the probe drifts this far from the thermostat setpoint. */
const SETPOINT_DRIFT_F = 5;

/** Fallback for links made before roles existed: guess from the channel nickname. */
function guessRole(label: string | null, kind: string): SensorRole | null {
  const l = (label ?? "").toLowerCase();
  if (kind === "herpstat") return /rhp|panel|belly/.test(l) ? "rhp" : /bask|bulb|lamp|spot/.test(l) ? "bask" : null;
  return /cold|cool/.test(l) ? "cold" : /warm|hot/.test(l) ? "warm" : null;
}

@Injectable()
export class StatusService {
  /** Each snake is its own enclosure: status = the latest readings of the channels linked to it. */
  constructor(@Inject(DB) private db: Db) {}

  async forHome(homeId: string): Promise<SnakeStatus[]> {
    const anims = await this.db.select().from(snakes).where(eq(snakes.homeId, homeId)).orderBy(snakes.position, snakes.name);
    if (!anims.length) return [];

    const links = await this.db
      .select({ l: snakeSensors, deviceName: devices.name, kind: devices.kind, labels: devices.channelLabels })
      .from(snakeSensors).innerJoin(devices, eq(devices.id, snakeSensors.deviceId))
      .where(inArray(snakeSensors.snakeId, anims.map((a) => a.id)));

    const deviceIds = [...new Set(links.map((x) => x.l.deviceId))];
    const latest = deviceIds.length
      ? await this.db.selectDistinctOn([readings.deviceId, readings.channel, readings.metric])
        .from(readings)
        .where(and(inArray(readings.deviceId, deviceIds), sql`${readings.at} > now() - interval '1 day'`))
        .orderBy(readings.deviceId, readings.channel, readings.metric, desc(readings.at))
      : [];

    // Most recent log of each type per snake (uses the snake_id/at index).
    const lastLogs = await this.db.selectDistinctOn([snakeLogs.snakeId, snakeLogs.type],
      { snakeId: snakeLogs.snakeId, type: snakeLogs.type, at: snakeLogs.at })
      .from(snakeLogs)
      .where(inArray(snakeLogs.snakeId, anims.map((a) => a.id)))
      .orderBy(snakeLogs.snakeId, snakeLogs.type, desc(snakeLogs.at));

    const now = Date.now();
    return anims.map((a) => {
      const mine = links.filter((x) => x.l.snakeId === a.id);
      const rs = latest.flatMap((r) => {
        const link = mine.find((m) => m.l.deviceId === r.deviceId && m.l.channel === r.channel);
        if (!link) return [];
        const channelLabel = link.labels?.[r.channel] ?? null;
        return [{
          deviceId: r.deviceId, channel: r.channel, metric: r.metric as Metric, value: r.value,
          at: r.at.toISOString(), deviceName: link.deviceName, channelLabel,
          role: (link.l.role ?? guessRole(channelLabel, link.kind)) as SensorRole | null,
          stale: now - r.at.getTime() > STALE_MS,
        }];
      });

      // Collapse readings into the four enclosure zones.
      const zones: Partial<Record<SensorRole, Zone>> = {};
      for (const r of rs) {
        if (!r.role) continue;
        const z = zones[r.role] ??= { role: r.role, tempF: null, humidity: null, powerPct: null, setpointF: null, at: null, stale: false, bad: false };
        if (r.metric === "temp_f") z.tempF = r.value;
        if (r.metric === "humidity") z.humidity = r.value;
        if (r.metric === "power_pct") z.powerPct = r.value;
        if (r.metric === "setpoint_f") z.setpointF = r.value;
        if (!z.at || r.at > z.at) z.at = r.at;
        z.stale ||= r.stale;
      }

      const alerts: string[] = [];
      for (const z of Object.values(zones)) {
        const label = ROLE_LABEL[z.role];
        if (z.stale && z.at) alerts.push(`${label}: no data for ${Math.round((now - Date.parse(z.at)) / 60000)} min`);
        if (z.tempF == null) continue;
        const t = z.tempF.toFixed(1);
        if (z.role === "warm" || z.role === "cold") continue; // rated as an average below
        if (z.setpointF != null && Math.abs(z.tempF - z.setpointF) > SETPOINT_DRIFT_F) {
          z.bad = true;
          alerts.push(`${label}: ${t}°F, set to ${z.setpointF}°F`);
        }
      }
      // Ambient ranges apply to the enclosure average of the warm & cold sides, not each side alone
      // (the warm side is meant to sit high and the cold side low).
      const ambient = [zones.warm, zones.cold].filter((z): z is Zone => !!z);
      const avg = (xs: (number | null)[]) => {
        const v = xs.filter((x): x is number => x != null);
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
      };
      const temp = avg(ambient.map((z) => z.tempF));
      const rh = avg(ambient.map((z) => z.humidity));
      if (temp != null) {
        const t = temp.toFixed(1);
        const low = a.minTempF != null && temp < a.minTempF, high = a.maxTempF != null && temp > a.maxTempF;
        if (low) alerts.push(`Ambient: ${t}°F avg below ${a.minTempF}°F`);
        if (high) alerts.push(`Ambient: ${t}°F avg above ${a.maxTempF}°F`);
        if (low || high) for (const z of ambient) z.bad = true;
      }
      if (rh != null) {
        if (a.minHumidity != null && rh < a.minHumidity) alerts.push(`Ambient: ${Math.round(rh)}% RH avg below ${a.minHumidity}%`);
        if (a.maxHumidity != null && rh > a.maxHumidity) alerts.push(`Ambient: ${Math.round(rh)}% RH avg above ${a.maxHumidity}%`);
      }
      // Linked channels without a zone still alert on stale data.
      for (const r of rs) if (!r.role && r.stale) alerts.push(`${r.channelLabel ?? `${r.deviceName} ${r.channel}`}: no recent data`);
      if (mine.length && !rs.length) alerts.push("No sensor data in the last 24h");

      const lastLog: SnakeStatus["lastLog"] = {};
      for (const l of lastLogs) if (l.snakeId === a.id) lastLog[l.type as LogEventType] = l.at.toISOString();

      return { id: a.id, name: a.name, species: a.species, morph: a.morph, photo: a.photo, zones, readings: rs, alerts: [...new Set(alerts)], lastLog };
    });
  }
}
