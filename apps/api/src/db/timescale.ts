import {sql} from 'drizzle-orm';
import type {Db} from './db.module';
import {READINGS_RETENTION_DAYS} from '../config';

export async function setupTimescale(db: Db) {
  const steps = [
    sql`create extension if not exists timescaledb`,
    sql`select create_hypertable('readings', by_range('at', interval '1 day'), if_not_exists => true, migrate_data => true)`,
    sql`alter table readings set (timescaledb.compress, timescaledb.compress_segmentby = 'device_id, channel, metric', timescaledb.compress_orderby = 'at desc')`,
    sql`select add_compression_policy('readings', interval '2 days', if_not_exists => true)`,
    sql`create materialized view if not exists readings_5m with (timescaledb.continuous) as
          select device_id, channel, metric, time_bucket(interval '5 minutes', at) as bucket,
                 avg(value) as avg, min(value) as min, max(value) as max
          from readings group by device_id, channel, metric, bucket
          with no data`,
    sql`select add_continuous_aggregate_policy('readings_5m', start_offset => interval '3 days',
          end_offset => interval '5 minutes', schedule_interval => interval '5 minutes', if_not_exists => true)`,
    sql`create index if not exists readings_5m_device_bucket_idx on readings_5m (device_id, bucket desc)`,
  ];
  for (const s of steps) await db.execute(s);

  await db.execute(sql`select remove_retention_policy('readings', if_exists => true)`);
  await db.execute(sql.raw(`select add_retention_policy('readings', interval '${READINGS_RETENTION_DAYS} days')`));
  await db.execute(sql`call refresh_continuous_aggregate('readings_5m', null, now() - interval '5 minutes')`);
}
