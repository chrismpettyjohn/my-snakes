import {DB, type Db} from '../db/db.module';
import {and, eq, inArray} from 'drizzle-orm';
import {GoveeService} from '../govee/govee.service';
import {toWebhook} from '../webhook/webhook.service';
import {ReadingService} from '../reading/reading.service';
import {BadRequestException, Inject, Injectable} from '@nestjs/common';
import {devices, homeMembers, homes, snakeSensors, snakes, webhooks} from '../db/schema';
import {GOVEE_CHANNEL, type AssignSensorInput, type Device, type DeviceChannel, type DeviceList, type UpdateDeviceInput} from '@snake/shared';

type DeviceRow = typeof devices.$inferSelect;
type Assignment = typeof snakeSensors.$inferSelect;
type WebhookRow = typeof webhooks.$inferSelect;

@Injectable()
export class DeviceService {
  constructor(
    @Inject(DB) private db: Db,
    private reading: ReadingService,
    private govee: GoveeService,
  ) {}

  async list(ownerId: string, viewerId: string): Promise<DeviceList> {
    const devs = await this.db.select().from(devices).where(eq(devices.ownerId, ownerId)).orderBy(devices.kind, devices.name);
    const ids = devs.map(d => d.id);
    const isOwner = ownerId === viewerId;
    const [seen, assigns, hooks, govee, linkable] = await Promise.all([
      this.reading.channelsSeen(ids),
      ids.length ? this.db.select().from(snakeSensors).where(inArray(snakeSensors.deviceId, ids)) : [],
      ids.length && isOwner ? this.db.select().from(webhooks).where(inArray(webhooks.deviceId, ids)).orderBy(webhooks.createdAt) : [],
      this.govee.account(ownerId),
      this.linkableSnakes(ownerId, viewerId),
    ]);
    return {
      govee,
      devices: devs.map(d =>
        toDevice(
          d,
          seen.filter(c => c.deviceId === d.id).map(c => c.channel),
          assigns.filter(a => a.deviceId === d.id),
          isOwner && d.kind === 'herpstat' ? hooks.filter(w => w.deviceId === d.id) : undefined,
        ),
      ),
      snakes: linkable.map(({s, collection}) => ({...s, collection})),
    };
  }

  private linkableSnakes(ownerId: string, viewerId: string) {
    const owned = this.db
      .select({id: homeMembers.homeId})
      .from(homeMembers)
      .where(and(eq(homeMembers.userId, ownerId), eq(homeMembers.role, 'owner')));
    const visible = this.db.select({id: homeMembers.homeId}).from(homeMembers).where(eq(homeMembers.userId, viewerId));
    return this.db
      .select({s: snakes, collection: homes.name})
      .from(snakes)
      .innerJoin(homes, eq(homes.id, snakes.homeId))
      .where(and(inArray(snakes.homeId, owned), inArray(snakes.homeId, visible)))
      .orderBy(homes.createdAt, snakes.position, snakes.name);
  }

  async update(d: DeviceRow, input: UpdateDeviceInput) {
    await this.db.update(devices).set({name: input.name}).where(eq(devices.id, d.id));
  }

  async remove(id: string) {
    await this.db.delete(devices).where(eq(devices.id, id));
  }

  async assign(d: DeviceRow, input: AssignSensorInput, userId: string) {
    const ids = [...new Set(input.snakeIds)];
    if (ids.length) {
      const existing = await this.db
        .select({id: snakeSensors.snakeId})
        .from(snakeSensors)
        .where(and(eq(snakeSensors.deviceId, d.id), eq(snakeSensors.channel, input.channel)));
      const added = ids.filter(id => !existing.some(e => e.id === id));
      if (added.length) {
        const ok = (await this.linkableSnakes(d.ownerId, userId)).filter(({s}) => added.includes(s.id));
        if (ok.length !== added.length) throw new BadRequestException("Snakes must be in one of the device owner's collections");
      }
    }
    await this.db.transaction(async tx => {
      await tx.delete(snakeSensors).where(and(eq(snakeSensors.deviceId, d.id), eq(snakeSensors.channel, input.channel)));
      if (ids.length) {
        await tx.insert(snakeSensors).values(ids.map(snakeId => ({snakeId, deviceId: d.id, channel: input.channel, role: input.role ?? null})));
      }
    });
  }
}

function toDevice(d: DeviceRow, seen: string[], assigns: Assignment[], hooks?: WebhookRow[]): Device {
  const channels = [...new Set([...(d.kind === 'govee' ? [GOVEE_CHANNEL] : []), ...seen, ...assigns.map(a => a.channel)])]
    .sort()
    .map((channel): DeviceChannel => {
      const mine = assigns.filter(a => a.channel === channel);
      return {channel, label: d.channelLabels?.[channel] ?? null, snakeIds: mine.map(a => a.snakeId), role: mine[0]?.role ?? null};
    });
  return {
    id: d.id,
    kind: d.kind,
    name: d.name,
    model: d.model,
    externalId: d.externalId,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    firmware: d.firmware,
    lastError: d.lastError,
    webhooks: hooks?.map(toWebhook),
    channels,
  };
}
