import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Home, Member } from "@snake/shared";
import { DB, type Db, type Tx } from "../db/db.module";
import { homeMembers, homes, users } from "../db/schema";

@Injectable()
export class HomeService {
  constructor(@Inject(DB) private db: Db) {}

  forUser(userId: string): Promise<Home[]> {
    return this.db.select({ id: homes.id, name: homes.name, role: homeMembers.role })
      .from(homeMembers).innerJoin(homes, eq(homes.id, homeMembers.homeId))
      .where(eq(homeMembers.userId, userId)).orderBy(homes.createdAt);
  }

  /** Creates a home owned by `userId`. Pass `tx` to make it part of a larger transaction. */
  async create(userId: string, name: string, tx?: Tx): Promise<Home> {
    if (!tx) return this.db.transaction((t) => this.create(userId, name, t));
    const [h] = await tx.insert(homes).values({ name }).returning();
    await tx.insert(homeMembers).values({ homeId: h!.id, userId, role: "owner" });
    return { id: h!.id, name: h!.name, role: "owner" };
  }

  members(homeId: string): Promise<Member[]> {
    return this.db.select({ id: users.id, email: users.email, displayName: users.displayName, role: homeMembers.role })
      .from(homeMembers).innerJoin(users, eq(users.id, homeMembers.userId))
      .where(eq(homeMembers.homeId, homeId));
  }

  /** Adds an existing user to the home. (Email invites for unregistered users: later.) */
  async addMember(homeId: string, email: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
    if (!u) throw new NotFoundException("No user with that email");
    await this.db.insert(homeMembers).values({ homeId, userId: u.id, role: "member" }).onConflictDoNothing();
  }
}
