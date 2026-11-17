import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  GOVEE_CHANNEL, type AssignSensorInput, type Device, type DeviceChannel, type DeviceList, type HomeRole, type UpdateDeviceInput,
} from "@snake/shared";
import { DB, type Db } from "../db/db.module";
import { devices, snakeSensors, snakes } from "../db/schema";
import { GoveeService } from "../govee/govee.service";
import { HerpstatPollerService } from "../herpstat/herpstat-poller.service";
import { uploadCredentials } from "../herpstat/herpstat.service";
import { ReadingService } from "../reading/reading.service";

type DeviceRow = typeof devices.$inferSelect;
type Assignment = typeof snakeSensors.$inferSelect;

@Injectable()
export class DeviceService {
  constructor(@Inject(DB) private db: Db, private reading: ReadingService, private govee: GoveeService,
    private poller: HerpstatPollerService) {}

  /** A home's devices with their channels and snake links. `role` decides whether upload secrets are included. */
  async list(homeId: string, role: HomeRole): Promise<DeviceList> {
    const devs = await this.db.select().from(devices).where(eq(devices.homeId, homeId)).orderBy(devices.kind, devices.name);
    const ids = devs.map((d) => d.id);
    const [seen, assigns, govee] = await Promise.all([
      this.reading.channelsSeen(ids),
      ids.length ? this.db.select().from(snakeSensors).where(inArray(snakeSensors.deviceId, ids)) : [],
      this.govee.account(homeId),
    ]);
    return {
      govee,
      devices: devs.map((d) => toDevice(d, role, seen.filter((c) => c.deviceId === d.id).map((c) => c.channel),
        assigns.filter((a) => a.deviceId === d.id))),
    };
  }

  async update(d: DeviceRow, input: UpdateDeviceInput) {
    const hostChanged = input.host !== undefined;
    await this.db.update(devices).set({ ...input, lastError: hostChanged ? null : d.lastError }).where(eq(devices.id, d.id));
    if (d.kind === "herpstat" && input.host) await this.poller.pollDevice(d.id);
  }

  async remove(id: string) {
    await this.db.delete(devices).where(eq(devices.id, id));
  }

  /** Replaces the set of snakes one device channel serves. */
  async assign(d: DeviceRow, input: AssignSensorInput) {
    const ids = [...new Set(input.snakeIds)];
    if (ids.length) {
      const owned = await this.db.select({ id: snakes.id }).from(snakes)
        .where(and(eq(snakes.homeId, d.homeId), inArray(snakes.id, ids)));
      if (owned.length !== ids.length) throw new BadRequestException("Snakes must belong to the device's collection");
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(snakeSensors).where(and(eq(snakeSensors.deviceId, d.id), eq(snakeSensors.channel, input.channel)));
      if (ids.length) {
        await tx.insert(snakeSensors).values(ids.map((snakeId) => ({ snakeId, deviceId: d.id, channel: input.channel, role: input.role ?? null })));
      }
    });
  }
}

function toDevice(d: DeviceRow, role: HomeRole, seen: string[], assigns: Assignment[]): Device {
  // Only owners see the Herpstat upload secret.
  const creds = d.kind === "herpstat" && role === "owner" && d.ingestToken ? uploadCredentials(d.ingestToken) : undefined;
  const channels = [...new Set([
    // A Govee sensor is a single channel; show it before its first reading arrives.
    ...(d.kind === "govee" ? [GOVEE_CHANNEL] : []),
    ...seen,
    ...assigns.map((a) => a.channel),
  ])].sort().map((channel): DeviceChannel => {
    const mine = assigns.filter((a) => a.channel === channel);
    return { channel, label: d.channelLabels?.[channel] ?? null, snakeIds: mine.map((a) => a.snakeId), role: mine[0]?.role ?? null };
  });
  return {
    id: d.id, kind: d.kind, name: d.name, model: d.model, externalId: d.externalId, lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    host: d.host, firmware: d.firmware, lastError: d.lastError,
    uploadUrl: creds?.uploadUrl, apiKey: creds?.apiKey,
    channels,
  };
}
