import {DB, type Db} from '../db/db.module';
import {devices, users} from '../db/schema';
import {errorMessage} from '../common/errors';
import {and, eq, isNotNull} from 'drizzle-orm';
import {govee, type GoveeDevice} from './govee.client';
import {ReadingService} from '../reading/reading.service';
import {decryptSecret, encryptSecret} from '../common/crypto';
import {GOVEE_CHANNEL, type GoveeAccount, type ReadingInput} from '@snake/shared';
import {Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown} from '@nestjs/common';

const POLL_MS = 5 * 60_000;
const REMOVED = 'Not in Govee account';
const OFFLINE = 'Offline';
const NO_DATA = 'No temperature/humidity in response';

type GoveeRow = typeof devices.$inferSelect;

@Injectable()
export class GoveeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private log = new Logger('Govee');
  private timer?: Timer;
  private running = false;
  private inFlight = new Map<string, Promise<void>>();

  constructor(
    @Inject(DB) private db: Db,
    private reading: ReadingService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.pollAll(), POLL_MS);
    void this.pollAll();
  }
  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async account(userId: string): Promise<GoveeAccount> {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    return {
      configured: !!u?.goveeApiKeyEnc,
      email: u?.goveeAccountEmail ?? null,
      lastSyncAt: u?.goveeLastSyncAt?.toISOString() ?? null,
      lastError: u?.goveeLastError ?? null,
    };
  }

  async setKey(userId: string, apiKey: string, email: string) {
    const list = await govee.listDevices(apiKey);
    await this.updateUser(userId, {goveeApiKeyEnc: await encryptSecret(apiKey), goveeAccountEmail: email, goveeLastError: null});
    await this.pollUser(userId, {fresh: true});
    return {imported: list.filter(govee.isSensor).length};
  }

  async clearKey(userId: string) {
    await this.inFlight.get(userId);
    await this.updateUser(userId, {goveeApiKeyEnc: null, goveeAccountEmail: null, goveeLastError: null});
  }

  async pollAll() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.db.select({id: users.id}).from(users).where(isNotNull(users.goveeApiKeyEnc));
      for (const u of rows) await this.pollUser(u.id);
    } catch (e) {
      this.log.warn(`poll: ${errorMessage(e)}`);
    } finally {
      this.running = false;
    }
  }

  async pollUser(userId: string, opts: {fresh?: boolean} = {}): Promise<void> {
    const running = this.inFlight.get(userId);
    if (running) {
      if (!opts.fresh) return running;
      await running;
    }
    const p = this.doPoll(userId).finally(() => {
      if (this.inFlight.get(userId) === p) this.inFlight.delete(userId);
    });
    this.inFlight.set(userId, p);
    return p;
  }

  private async doPoll(userId: string) {
    const [owner] = await this.db.select({keyEnc: users.goveeApiKeyEnc}).from(users).where(eq(users.id, userId));
    if (!owner?.keyEnc) return;

    let apiKey: string;
    let inAccount: Set<string>;
    try {
      apiKey = await decryptSecret(owner.keyEnc);
      const list = (await govee.listDevices(apiKey)).filter(govee.isSensor);
      await this.syncDevices(userId, list);
      inAccount = new Set(list.map(d => d.device));
    } catch (e) {
      return this.setUserError(userId, errorMessage(e));
    }

    const devs = await this.db
      .select()
      .from(devices)
      .where(and(eq(devices.ownerId, userId), eq(devices.kind, 'govee')));
    let failed = 0;
    for (const d of devs) {
      if (!d.externalId || !d.model) continue;
      if (!inAccount.has(d.externalId)) {
        if (d.lastError !== REMOVED) await this.setDevice(d.id, {lastError: REMOVED});
        continue;
      }
      try {
        await this.pollSensor(apiKey, d);
      } catch (e) {
        failed++;
        const msg = errorMessage(e);
        this.log.warn(`user ${userId} device ${d.externalId}: ${msg}`);
        await this.setDevice(d.id, {lastError: msg});
      }
    }

    await this.updateUser(userId, {
      goveeLastSyncAt: new Date(),
      goveeLastError: failed ? `${failed} of ${inAccount.size} sensors failed to update` : null,
    });
  }

  private async pollSensor(apiKey: string, d: GoveeRow) {
    const s = await govee.sensorState(apiKey, {sku: d.model!, device: d.externalId!});
    if (s.online === false) return this.setDevice(d.id, {lastError: OFFLINE});
    const rows: ReadingInput[] = [];
    if (s.tempF !== undefined) rows.push({channel: GOVEE_CHANNEL, metric: 'temp_f', value: s.tempF});
    if (s.humidity !== undefined) rows.push({channel: GOVEE_CHANNEL, metric: 'humidity', value: s.humidity});
    if (!rows.length) return this.setDevice(d.id, {lastError: NO_DATA});
    const now = new Date();
    await this.reading.record(d.id, rows, now);
    await this.setDevice(d.id, {lastSeenAt: now, lastError: null});
  }

  private async setUserError(userId: string, msg: string) {
    this.log.warn(`user ${userId}: ${msg}`);
    await this.db
      .update(users)
      .set({goveeLastError: msg})
      .where(and(eq(users.id, userId), isNotNull(users.goveeApiKeyEnc)));
  }

  private async syncDevices(userId: string, list: GoveeDevice[]) {
    for (const d of list) {
      await this.db
        .insert(devices)
        .values({ownerId: userId, kind: 'govee', name: d.deviceName ?? d.sku, externalId: d.device, model: d.sku})
        .onConflictDoUpdate({target: [devices.ownerId, devices.kind, devices.externalId], set: {model: d.sku}});
    }
  }

  private async updateUser(userId: string, set: Partial<typeof users.$inferInsert>) {
    await this.db.update(users).set(set).where(eq(users.id, userId));
  }

  private async setDevice(id: string, set: Partial<typeof devices.$inferInsert>) {
    await this.db.update(devices).set(set).where(eq(devices.id, id));
  }
}
