import type {ReadingInput} from '@snake/shared';
import {Inject, Injectable} from '@nestjs/common';
import {readings, readings5m} from '../db/schema';
import {DB, type Db, type Tx} from '../db/db.module';
import {and, desc, gt, inArray, eq, sql} from 'drizzle-orm';

const RAW_WINDOW_HOURS = 48;
const MAX_WINDOW_HOURS = 24 * 365;

const since = (hours: number) => sql`now() - make_interval(hours => ${hours})`;

@Injectable()
export class ReadingService {
  constructor(@Inject(DB) private db: Db) {}

  async record(deviceId: string, rows: ReadingInput[], at: Date, tx: Db | Tx = this.db) {
    if (rows.length) await tx.insert(readings).values(rows.map(r => ({...r, deviceId, at})));
  }

  latest(deviceIds: string[], hours = 24) {
    if (!deviceIds.length) return Promise.resolve([]);
    return this.db
      .selectDistinctOn([readings.deviceId, readings.channel, readings.metric])
      .from(readings)
      .where(and(inArray(readings.deviceId, deviceIds), gt(readings.at, since(hours))))
      .orderBy(readings.deviceId, readings.channel, readings.metric, desc(readings.at));
  }

  channelsSeen(deviceIds: string[], hours = 24 * 7) {
    if (!deviceIds.length) return Promise.resolve([]);
    return this.db
      .selectDistinct({deviceId: readings.deviceId, channel: readings.channel})
      .from(readings)
      .where(and(inArray(readings.deviceId, deviceIds), gt(readings.at, since(hours))));
  }

  history(deviceId: string, hours: number) {
    const h = Math.min(Math.max(hours || 24, 1), MAX_WINDOW_HOURS);
    if (h <= RAW_WINDOW_HOURS) {
      return this.db
        .select({channel: readings.channel, metric: readings.metric, value: readings.value, at: readings.at})
        .from(readings)
        .where(and(eq(readings.deviceId, deviceId), gt(readings.at, since(h))))
        .orderBy(readings.at);
    }
    return this.db
      .select({
        channel: readings5m.channel,
        metric: readings5m.metric,
        value: readings5m.avg,
        at: readings5m.bucket,
        min: readings5m.min,
        max: readings5m.max,
      })
      .from(readings5m)
      .where(and(eq(readings5m.deviceId, deviceId), gt(readings5m.bucket, since(h))))
      .orderBy(readings5m.bucket);
  }
}
