import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { CreateHerpstatInput, FoundHerpstat, UploadCredentials } from "@snake/shared";
import { randomToken } from "../common/crypto";
import { PUBLIC_API_URL } from "../config";
import { DB, type Db } from "../db/db.module";
import { devices, rawUploads } from "../db/schema";
import { discoverHerpstats } from "./discover";
import { HerpstatPollerService } from "./herpstat-poller.service";

const RECENT_RAW_UPLOADS = 20;

/** Where a unit pushes its "custom URL" uploads; the token doubles as its API key. */
export const uploadCredentials = (token: string): UploadCredentials =>
  ({ uploadUrl: `${PUBLIC_API_URL}/ingest/herpstat/${token}`, apiKey: token });

@Injectable()
export class HerpstatService {
  constructor(@Inject(DB) private db: Db, private poller: HerpstatPollerService) {}

  async add(homeId: string, input: CreateHerpstatInput) {
    const token = randomToken();
    const [d] = await this.db.insert(devices)
      .values({ homeId, kind: "herpstat", name: input.name, host: input.host ?? null, ingestToken: token }).returning();
    if (d!.host) await this.poller.pollDevice(d!.id);
    return { id: d!.id, ...uploadCredentials(token) };
  }

  /** Scans the API host's LAN for SpyderWeb units not yet added to this home. */
  async discover(homeId: string): Promise<FoundHerpstat[]> {
    const existing = await this.db.select({ host: devices.host, ext: devices.externalId }).from(devices)
      .where(and(eq(devices.homeId, homeId), eq(devices.kind, "herpstat")));
    return (await discoverHerpstats()).filter((f) => !existing.some((e) => e.host === f.host || e.ext === f.mac));
  }

  /** Pulls fresh /RAWSTATUS from one LAN unit right now. */
  async refresh(d: typeof devices.$inferSelect) {
    if (d.kind !== "herpstat" || !d.host) throw new BadRequestException("Only Herpstats with an IP address can be refreshed");
    await this.poller.pollDevice(d.id);
  }

  async rotateKey(d: typeof devices.$inferSelect): Promise<UploadCredentials> {
    if (d.kind !== "herpstat") throw new BadRequestException("Only Herpstat devices have upload keys");
    const token = randomToken();
    await this.db.update(devices).set({ ingestToken: token }).where(eq(devices.id, d.id));
    return uploadCredentials(token);
  }

  /** Recent raw uploads, for checking what the firmware actually sends. */
  rawUploads(deviceId: string) {
    return this.db.select().from(rawUploads).where(eq(rawUploads.deviceId, deviceId))
      .orderBy(desc(rawUploads.receivedAt)).limit(RECENT_RAW_UPLOADS);
  }
}
