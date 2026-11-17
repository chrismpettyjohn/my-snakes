import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import type { HomeRole } from "@snake/shared";
import { DB, type Db } from "../db/db.module";
import { snakes, devices, homeMembers } from "../db/schema";

type DeviceRow = typeof devices.$inferSelect;

/**
 * Central tenancy checks. Snakes live in a home (collection) and are shared with its members;
 * devices belong to a user and are visible to anyone sharing one of that user's collections.
 */
@Injectable()
export class AccessService {
  constructor(@Inject(DB) private db: Db) {}

  /** The user's role in the home; 404s if they aren't a member (so homes can't be probed). */
  async role(userId: string, homeId: string): Promise<HomeRole> {
    const [m] = await this.db.select({ role: homeMembers.role }).from(homeMembers)
      .where(and(eq(homeMembers.homeId, homeId), eq(homeMembers.userId, userId)));
    if (!m) throw new NotFoundException("Home not found");
    return m.role;
  }

  async requireOwner(userId: string, homeId: string) {
    if ((await this.role(userId, homeId)) !== "owner") throw new ForbiddenException("Owner only");
  }

  async snake(userId: string, id: string) {
    const [r] = await this.db.select().from(snakes).where(eq(snakes.id, id));
    if (!r) throw new NotFoundException();
    await this.role(userId, r.homeId);
    return r;
  }

  /** The user who owns a home; its devices are the ones its snakes can be assigned to. */
  async homeOwner(homeId: string): Promise<string> {
    const [m] = await this.db.select({ userId: homeMembers.userId }).from(homeMembers)
      .where(and(eq(homeMembers.homeId, homeId), eq(homeMembers.role, "owner"))).orderBy(homeMembers.createdAt).limit(1);
    if (!m) throw new NotFoundException("Home not found");
    return m.userId;
  }

  /** A device the user owns, or one owned by the owner of a home the user is a member of. */
  async device(userId: string, id: string): Promise<DeviceRow> {
    const [d] = await this.db.select().from(devices).where(eq(devices.id, id));
    if (!d) throw new NotFoundException();
    if (d.ownerId === userId) return d;
    const shared = await this.db.select({ homeId: homeMembers.homeId }).from(homeMembers)
      .where(and(eq(homeMembers.userId, d.ownerId), eq(homeMembers.role, "owner"),
        inArray(homeMembers.homeId, this.db.select({ id: homeMembers.homeId }).from(homeMembers).where(eq(homeMembers.userId, userId)))))
      .limit(1);
    if (!shared.length) throw new NotFoundException();
    return d;
  }

  /** A device the user owns (only owners change or remove devices). */
  async ownedDevice(userId: string, id: string) {
    const d = await this.device(userId, id);
    if (d.ownerId !== userId) throw new ForbiddenException("Owner only");
    return d;
  }
}
