import {desc, eq} from 'drizzle-orm';
import {rawUploads} from '../db/schema';
import {DB, type Db} from '../db/db.module';
import {Inject, Injectable} from '@nestjs/common';

const RECENT_RAW_UPLOADS = 20;

@Injectable()
export class HerpstatService {
  constructor(@Inject(DB) private db: Db) {}

  rawUploads(deviceId: string) {
    return this.db.select().from(rawUploads).where(eq(rawUploads.deviceId, deviceId)).orderBy(desc(rawUploads.receivedAt)).limit(RECENT_RAW_UPLOADS);
  }
}
