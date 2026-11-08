import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { and, eq, isNotNull } from "drizzle-orm";
import { GOVEE_POLL_SECONDS } from "../config";
import { decryptSecret, encryptSecret } from "../common/crypto";
import { DB, type Db } from "../db/db.module";
import { devices, homes, readings } from "../db/schema";
import { govee, type GoveeDevice } from "./govee.client";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

@Injectable()
export class GoveeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private log = new Logger("Govee");
  private timer?: Timer;
  private running = false;
  /** One poll per home at a time; the timer, Sync Now and key changes all share it. */
  private inFlight = new Map<string, Promise<void>>();

  constructor(@Inject(DB) private db: Db) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.pollAll(), GOVEE_POLL_SECONDS * 1000);
    void this.pollAll();
  }
  onApplicationShutdown() { clearInterval(this.timer); }

  /** Validates the key against Govee, stores it encrypted, then imports sensors and reads them. */
  async setKey(homeId: string, apiKey: string, email: string) {
    const list = await govee.listDevices(apiKey); // throws on a bad key
    await this.db.update(homes).set({ goveeApiKeyEnc: await encryptSecret(apiKey), goveeAccountEmail: email, goveeLastError: null })
      .where(eq(homes.id, homeId));
    await this.pollHome(homeId, { fresh: true });
    return { imported: list.filter(govee.isSensor).length };
  }

  async clearKey(homeId: string) {
    await this.inFlight.get(homeId); // don't let a running poll write an error after disconnect
    await this.db.update(homes).set({ goveeApiKeyEnc: null, goveeAccountEmail: null, goveeLastError: null }).where(eq(homes.id, homeId));
  }

  async pollAll() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.db.select({ id: homes.id }).from(homes).where(isNotNull(homes.goveeApiKeyEnc));
      for (const h of rows) await this.pollHome(h.id);
    } catch (e) {
      this.log.warn(`poll: ${errMsg(e)}`);
    } finally { this.running = false; }
  }

  /**
   * Re-lists the account's sensors (picks up new ones), then reads each one. Concurrent calls
   * join the running poll; `fresh` waits for it and starts a new one (e.g. after a key change).
   */
  async pollHome(homeId: string, opts: { fresh?: boolean } = {}): Promise<void> {
    const running = this.inFlight.get(homeId);
    if (running) {
      if (!opts.fresh) return running;
      await running;
    }
    const p = this.doPoll(homeId).finally(() => {
      if (this.inFlight.get(homeId) === p) this.inFlight.delete(homeId);
    });
    this.inFlight.set(homeId, p);
    return p;
  }

  private async doPoll(homeId: string) {
    const [home] = await this.db.select().from(homes).where(eq(homes.id, homeId));
    if (!home?.goveeApiKeyEnc) return;

    let list: GoveeDevice[];
    let apiKey: string;
    try {
      apiKey = await decryptSecret(home.goveeApiKeyEnc);
      list = (await govee.listDevices(apiKey)).filter(govee.isSensor);
      await this.syncDevices(homeId, list);
    } catch (e) {
      return this.setHomeError(homeId, errMsg(e));
    }

    const inAccount = new Set(list.map((d) => d.device));
    const devs = await this.db.select().from(devices)
      .where(and(eq(devices.homeId, homeId), eq(devices.kind, "govee")));
    let failed = 0;

    for (const d of devs) {
      if (!d.externalId || !d.model) continue;
      if (!inAccount.has(d.externalId)) {
        // Removed from the Govee account: keep its history and snake links, stop polling it.
        if (d.lastError !== REMOVED) await this.db.update(devices).set({ lastError: REMOVED }).where(eq(devices.id, d.id));
        continue;
      }
      try {
        const s = await govee.sensorState(apiKey, { sku: d.model, device: d.externalId });
        const now = new Date();
        const rows = [
          s.tempF !== undefined && { metric: "temp_f", value: s.tempF },
          s.humidity !== undefined && { metric: "humidity", value: s.humidity },
        ].filter(Boolean) as { metric: string; value: number }[];
        if (s.online === false) {
          await this.db.update(devices).set({ lastError: "Offline" }).where(eq(devices.id, d.id));
          continue;
        }
        if (rows.length) {
          await this.db.insert(readings).values(rows.map((r) => ({ ...r, deviceId: d.id, channel: "main", at: now })));
        }
        await this.db.update(devices)
          .set(rows.length ? { lastSeenAt: now, lastError: null } : { lastError: "No temperature/humidity in response" })
          .where(eq(devices.id, d.id));
      } catch (e) {
        failed++;
        const msg = errMsg(e);
        this.log.warn(`home ${homeId} device ${d.externalId}: ${msg}`);
        await this.db.update(devices).set({ lastError: msg }).where(eq(devices.id, d.id));
      }
    }

    await this.db.update(homes).set({
      goveeLastSyncAt: new Date(),
      goveeLastError: failed ? `${failed} of ${inAccount.size} sensors failed to update` : null,
    }).where(eq(homes.id, homeId));
  }

  private async setHomeError(homeId: string, msg: string) {
    this.log.warn(`home ${homeId}: ${msg}`);
    // Only record it if the key is still set (it may have been disconnected mid-poll).
    await this.db.update(homes).set({ goveeLastError: msg })
      .where(and(eq(homes.id, homeId), isNotNull(homes.goveeApiKeyEnc)));
  }

  /** Upserts sensors from the account; existing names are kept so user renames survive. */
  private async syncDevices(homeId: string, list: GoveeDevice[]) {
    for (const d of list) {
      await this.db.insert(devices)
        .values({ homeId, kind: "govee", name: d.deviceName ?? d.sku, externalId: d.device, model: d.sku })
        .onConflictDoUpdate({
          target: [devices.homeId, devices.kind, devices.externalId],
          set: { model: d.sku },
        });
    }
  }
}

const REMOVED = "Not in Govee account";
