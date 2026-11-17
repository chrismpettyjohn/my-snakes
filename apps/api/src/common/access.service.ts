import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { HomeRole } from "@snake/shared";
import { DB, type Db } from "../db/db.module";
import { snakes, devices, homeMembers } from "../db/schema";

/** Central tenancy checks: every request touching a home-scoped row goes through here. */
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
    return this.inMemberHome(r, userId);
  }

  async device(userId: string, id: string) {
    const [r] = await this.db.select().from(devices).where(eq(devices.id, id));
    return this.inMemberHome(r, userId);
  }

  /** A device the user owns (via its home). */
  async ownedDevice(userId: string, id: string) {
    const d = await this.device(userId, id);
    await this.requireOwner(userId, d.homeId);
    return d;
  }

  private async inMemberHome<T extends { homeId: string }>(row: T | undefined, userId: string): Promise<T> {
    if (!row) throw new NotFoundException();
    await this.role(userId, row.homeId);
    return row;
  }
}
