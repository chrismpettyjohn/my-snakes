import {eq, sql} from 'drizzle-orm';
import {DB, type Db} from '../../db/db.module';
import {devices, rawUploads} from '../../db/schema';
import {parseHerpstatUpload} from './herpstat-parser';
import {ReadingService} from '../../reading/reading.service';
import {Inject, Injectable, UnauthorizedException} from '@nestjs/common';

const MAX_RAW_PER_DEVICE = 200;
const MAX_RAW_BODY = 64_000;

export interface Upload {
  token: string;
  body: string;
  contentType?: string;
  headers: Record<string, unknown>;
}

@Injectable()
export class IngestService {
  constructor(
    @Inject(DB) private db: Db,
    private reading: ReadingService,
  ) {}

  async receive(u: Upload) {
    const [device] = await this.db.select().from(devices).where(eq(devices.ingestToken, u.token));
    if (!device || device.kind !== 'herpstat') throw new UnauthorizedException('Unknown API key');

    const parsed = parseHerpstatUpload(u.body, u.contentType);
    const now = new Date();
    await this.db.transaction(async tx => {
      await tx.insert(rawUploads).values({
        deviceId: device.id,
        contentType: u.contentType ?? null,
        headers: u.headers,
        body: u.body.slice(0, MAX_RAW_BODY),
      });
      await this.reading.record(device.id, parsed.readings, now, tx);
      await tx
        .update(devices)
        .set({
          lastSeenAt: now,
          externalId: device.externalId ?? parsed.mac ?? null,
          model: device.model ?? parsed.model ?? null,
        })
        .where(eq(devices.id, device.id));
    });
    await this.pruneRaw(device.id);
    return {ok: true, readings: parsed.readings.length};
  }

  private async pruneRaw(deviceId: string) {
    await this.db.execute(sql`
      delete from raw_uploads where device_id = ${deviceId} and id not in (
        select id from raw_uploads where device_id = ${deviceId} order by received_at desc limit ${MAX_RAW_PER_DEVICE})`);
  }
}
