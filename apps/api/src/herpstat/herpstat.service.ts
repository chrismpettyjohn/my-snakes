import {desc, eq} from 'drizzle-orm';
import {DB, type Db} from '../db/db.module';
import {devices, rawUploads} from '../db/schema';
import {Inject, Injectable} from '@nestjs/common';
import {WebhookService} from '../webhook/webhook.service';
import type {CreatedHerpstat, CreateHerpstatInput} from '@snake/shared';

const RECENT_RAW_UPLOADS = 20;

@Injectable()
export class HerpstatService {
  constructor(
    @Inject(DB) private db: Db,
    private webhook: WebhookService,
  ) {}

  add(ownerId: string, input: CreateHerpstatInput): Promise<CreatedHerpstat> {
    return this.db.transaction(async tx => {
      const [d] = await tx.insert(devices).values({ownerId, kind: 'herpstat', name: input.name}).returning();
      return {id: d!.id, webhook: await this.webhook.create(d!, tx)};
    });
  }

  rawUploads(deviceId: string) {
    return this.db.select().from(rawUploads).where(eq(rawUploads.deviceId, deviceId)).orderBy(desc(rawUploads.receivedAt)).limit(RECENT_RAW_UPLOADS);
  }
}
