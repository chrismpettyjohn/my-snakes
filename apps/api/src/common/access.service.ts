import type {HomeRole} from '@snake/shared';
import {DB, type Db} from '../db/db.module';
import {and, eq, inArray} from 'drizzle-orm';
import {snakes, devices, homeMembers} from '../db/schema';
import {ForbiddenException, Inject, Injectable, NotFoundException} from '@nestjs/common';

type DeviceRow = typeof devices.$inferSelect;

@Injectable()
export class AccessService {
  constructor(@Inject(DB) private db: Db) {}

  async role(userId: string, homeId: string): Promise<HomeRole> {
    const [m] = await this.db
      .select({role: homeMembers.role})
      .from(homeMembers)
      .where(and(eq(homeMembers.homeId, homeId), eq(homeMembers.userId, userId)));
    if (!m) throw new NotFoundException('Home not found');
    return m.role;
  }

  async requireOwner(userId: string, homeId: string) {
    if ((await this.role(userId, homeId)) !== 'owner') throw new ForbiddenException('Owner only');
  }

  async snake(userId: string, id: string) {
    const [r] = await this.db.select().from(snakes).where(eq(snakes.id, id));
    if (!r) throw new NotFoundException();
    await this.role(userId, r.homeId);
    return r;
  }

  async homeOwner(homeId: string): Promise<string> {
    const [m] = await this.db
      .select({userId: homeMembers.userId})
      .from(homeMembers)
      .where(and(eq(homeMembers.homeId, homeId), eq(homeMembers.role, 'owner')))
      .orderBy(homeMembers.createdAt)
      .limit(1);
    if (!m) throw new NotFoundException('Home not found');
    return m.userId;
  }

  async device(userId: string, id: string): Promise<DeviceRow> {
    const [d] = await this.db.select().from(devices).where(eq(devices.id, id));
    if (!d) throw new NotFoundException();
    if (d.ownerId === userId) return d;
    const shared = await this.db
      .select({homeId: homeMembers.homeId})
      .from(homeMembers)
      .where(
        and(
          eq(homeMembers.userId, d.ownerId),
          eq(homeMembers.role, 'owner'),
          inArray(homeMembers.homeId, this.db.select({id: homeMembers.homeId}).from(homeMembers).where(eq(homeMembers.userId, userId))),
        ),
      )
      .limit(1);
    if (!shared.length) throw new NotFoundException();
    return d;
  }

  async ownedDevice(userId: string, id: string) {
    const d = await this.device(userId, id);
    if (d.ownerId !== userId) throw new ForbiddenException('Owner only');
    return d;
  }
}
