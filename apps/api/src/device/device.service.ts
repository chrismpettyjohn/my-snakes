import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  GOVEE_CHANNEL, type AssignSensorInput, type Device, type DeviceChannel, type DeviceList, type UpdateDeviceInput,
} from "@snake/shared";
import { DB, type Db } from "../db/db.module";
import { devices, homeMembers, homes, snakeSensors, snakes } from "../db/schema";
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

  /** One user's devices with their channels and snake links. Only the owner sees upload secrets. */
  async list(ownerId: string, viewerId: string): Promise<DeviceList> {
    const devs = await this.db.select().from(devices).where(eq(devices.ownerId, ownerId)).orderBy(devices.kind, devices.name);
    const ids = devs.map((d) => d.id);
    const [seen, assigns, govee, linkable] = await Promise.all([
      this.reading.channelsSeen(ids),
      ids.length ? this.db.select().from(snakeSensors).where(inArray(snakeSensors.deviceId, ids)) : [],
      this.govee.account(ownerId),
      this.linkableSnakes(ownerId, viewerId),
    ]);
    return {
      govee,
      devices: devs.map((d) => toDevice(d, d.ownerId === viewerId, seen.filter((c) => c.deviceId === d.id).map((c) => c.channel),
        assigns.filter((a) => a.deviceId === d.id))),
      snakes: linkable.map(({ s, collection }) => ({ ...s, collection })),
    };
  }

  /** Snakes in the owner's collections that the viewer is also a member of. */
  private linkableSnakes(ownerId: string, viewerId: string) {
    const owned = this.db.select({ id: homeMembers.homeId }).from(homeMembers)
      .where(and(eq(homeMembers.userId, ownerId), eq(homeMembers.role, "owner")));
    const visible = this.db.select({ id: homeMembers.homeId }).from(homeMembers).where(eq(homeMembers.userId, viewerId));
    return this.db.select({ s: snakes, collection: homes.name }).from(snakes).innerJoin(homes, eq(homes.id, snakes.homeId))
      .where(and(inArray(snakes.homeId, owned), inArray(snakes.homeId, visible)))
      .orderBy(homes.createdAt, snakes.position, snakes.name);
  }

  async update(d: DeviceRow, input: UpdateDeviceInput) {
    const hostChanged = input.host !== undefined;
    await this.db.update(devices).set({ ...input, lastError: hostChanged ? null : d.lastError }).where(eq(devices.id, d.id));
    if (d.kind === "herpstat" && input.host) await this.poller.pollDevice(d.id);
  }

  async remove(id: string) {
    await this.db.delete(devices).where(eq(devices.id, id));
  }

  /**
   * Replaces the set of snakes one device channel serves. Newly linked snakes must be in one of the
   * device owner's collections that the user shares; existing links are kept even if the snake has
   * since moved to another collection (a link belongs to the snake, not the collection).
   */
  async assign(d: DeviceRow, input: AssignSensorInput, userId: string) {
    const ids = [...new Set(input.snakeIds)];
    if (ids.length) {
      const existing = await this.db.select({ id: snakeSensors.snakeId }).from(snakeSensors)
        .where(and(eq(snakeSensors.deviceId, d.id), eq(snakeSensors.channel, input.channel)));
      const added = ids.filter((id) => !existing.some((e) => e.id === id));
      if (added.length) {
        const ok = (await this.linkableSnakes(d.ownerId, userId)).filter(({ s }) => added.includes(s.id));
        if (ok.length !== added.length) throw new BadRequestException("Snakes must be in one of the device owner's collections");
      }
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(snakeSensors).where(and(eq(snakeSensors.deviceId, d.id), eq(snakeSensors.channel, input.channel)));
      if (ids.length) {
        await tx.insert(snakeSensors).values(ids.map((snakeId) => ({ snakeId, deviceId: d.id, channel: input.channel, role: input.role ?? null })));
      }
    });
  }
}

function toDevice(d: DeviceRow, isOwner: boolean, seen: string[], assigns: Assignment[]): Device {
  // Only the owner sees the Herpstat upload secret.
  const creds = d.kind === "herpstat" && isOwner && d.ingestToken ? uploadCredentials(d.ingestToken) : undefined;
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
