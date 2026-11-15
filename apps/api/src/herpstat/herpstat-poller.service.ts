import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { and, eq, isNotNull } from "drizzle-orm";
import { HERPSTAT_POLL_SECONDS } from "../config";
import { DB, type Db } from "../db/db.module";
import { devices, readings } from "../db/schema";
import { fetchRawStatus, outputs, readingsFrom } from "./rawstatus";

/**
 * Polls Herpstat /RAWSTATUS over the LAN. Only useful while the API runs on the same network
 * as the units; the push (custom URL upload) path in ./ingest covers remote/VPS deployments.
 */
@Injectable()
export class HerpstatPollerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private log = new Logger("Herpstat");
  private timer?: Timer;
  private inFlight = new Set<string>();

  constructor(@Inject(DB) private db: Db) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.pollAll(), HERPSTAT_POLL_SECONDS * 1000);
    void this.pollAll();
  }
  onApplicationShutdown() { clearInterval(this.timer); }

  async pollAll() {
    const devs = await this.db.select().from(devices)
      .where(and(eq(devices.kind, "herpstat"), isNotNull(devices.host)));
    await Promise.all(devs.map((d) => this.pollDevice(d.id)));
  }

  /** One request in flight per device: the Herpstat blocks its control loop on fast polling. */
  async pollDevice(id: string) {
    if (this.inFlight.has(id)) return;
    this.inFlight.add(id);
    try {
      const [d] = await this.db.select().from(devices).where(eq(devices.id, id));
      if (!d?.host) return;
      try {
        const s = await fetchRawStatus(d.host);
        const now = new Date();
        const rows = readingsFrom(s);
        if (rows.length) await this.db.insert(readings).values(rows.map((r) => ({ ...r, deviceId: d.id, at: now })));
        await this.db.update(devices).set({
          lastSeenAt: now, lastError: null,
          channelLabels: Object.fromEntries(outputs(s).filter(([, o]) => o?.outputnickname?.trim()).map(([ch, o]) => [ch, o.outputnickname!.trim()])),
          externalId: s.system.mac.toUpperCase(),
          firmware: s.system.firmware != null ? String(s.system.firmware) : d.firmware,
          model: d.model ?? `Herpstat ${s.system.numberofoutputs ?? ""}`.trim(),
        }).where(eq(devices.id, d.id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== d.lastError) this.log.warn(`${d.name} (${d.host}): ${msg}`);
        await this.db.update(devices).set({ lastError: msg }).where(eq(devices.id, d.id));
      }
    } finally {
      this.inFlight.delete(id);
    }
  }
}
