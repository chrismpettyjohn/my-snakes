import {devices} from '../db/schema';
import {DB, type Db} from '../db/db.module';
import {errorMessage} from '../common/errors';
import {and, eq, isNotNull} from 'drizzle-orm';
import {HERPSTAT_POLL_SECONDS} from '../config';
import {ReadingService} from '../reading/reading.service';
import {channelLabels, fetchRawStatus, readingsFrom} from './rawstatus';
import {Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown} from '@nestjs/common';

@Injectable()
export class HerpstatPollerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private log = new Logger('Herpstat');
  private timer?: Timer;
  private inFlight = new Set<string>();

  constructor(
    @Inject(DB) private db: Db,
    private reading: ReadingService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.pollAll(), HERPSTAT_POLL_SECONDS * 1000);
    void this.pollAll();
  }
  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async pollAll() {
    const devs = await this.db
      .select({id: devices.id})
      .from(devices)
      .where(and(eq(devices.kind, 'herpstat'), isNotNull(devices.host)));
    await Promise.all(devs.map(d => this.pollDevice(d.id)));
  }

  async pollDevice(id: string) {
    if (this.inFlight.has(id)) return;
    this.inFlight.add(id);
    try {
      const [d] = await this.db.select().from(devices).where(eq(devices.id, id));
      if (!d?.host) return;
      try {
        const s = await fetchRawStatus(d.host);
        const now = new Date();
        await this.reading.record(d.id, readingsFrom(s), now);
        await this.db
          .update(devices)
          .set({
            lastSeenAt: now,
            lastError: null,
            channelLabels: channelLabels(s),
            externalId: s.system.mac.toUpperCase(),
            firmware: s.system.firmware != null ? String(s.system.firmware) : d.firmware,
            model: d.model ?? `Herpstat ${s.system.numberofoutputs ?? ''}`.trim(),
          })
          .where(eq(devices.id, d.id));
      } catch (e) {
        const msg = errorMessage(e);
        if (msg !== d.lastError) this.log.warn(`${d.name} (${d.host}): ${msg}`);
        await this.db.update(devices).set({lastError: msg}).where(eq(devices.id, d.id));
      }
    } finally {
      this.inFlight.delete(id);
    }
  }
}
