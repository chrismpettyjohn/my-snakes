import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import { snakes, devices, homeMembers } from "../db/schema";

/** Central tenancy checks: every request touching a home-scoped row goes through here. */
@Injectable()
export class AccessService {
  constructor(@Inject(DB) private db: Db) {}

  async role(userId: string, homeId: string) {
    const [m] = await this.db.select().from(homeMembers)
      .where(and(eq(homeMembers.homeId, homeId), eq(homeMembers.userId, userId)));
    if (!m) throw new NotFoundException("Home not found");
    return m.role;
  }

  async requireOwner(userId: string, homeId: string) {
    if ((await this.role(userId, homeId)) !== "owner") throw new ForbiddenException("Owner only");
  }

  private async homeOf<T extends { homeId: string }>(row: T | undefined, userId: string): Promise<T> {
    if (!row) throw new NotFoundException();
    await this.role(userId, row.homeId);
    return row;
  }

  async snake(userId: string, id: string) {
    const [r] = await this.db.select().from(snakes).where(eq(snakes.id, id));
    return this.homeOf(r, userId);
  }
  async device(userId: string, id: string) {
    const [r] = await this.db.select().from(devices).where(eq(devices.id, id));
    return this.homeOf(r, userId);
  }
}
