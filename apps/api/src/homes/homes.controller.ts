import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CreateHomeInput, InviteMemberInput, type Home } from "@snake/shared";
import { UserId } from "../auth/auth.guard";
import { AccessService } from "../common/access.service";
import { ZodPipe } from "../common/zod.pipe";
import { DB, type Db } from "../db/db.module";
import { homeMembers, homes, users } from "../db/schema";
import { StatusService } from "./status.service";

@Controller("homes")
export class HomesController {
  constructor(@Inject(DB) private db: Db, private access: AccessService, private status: StatusService) {}

  @Get()
  async list(@UserId() userId: string): Promise<Home[]> {
    return this.db.select({ id: homes.id, name: homes.name, role: homeMembers.role })
      .from(homeMembers).innerJoin(homes, eq(homes.id, homeMembers.homeId))
      .where(eq(homeMembers.userId, userId)).orderBy(homes.createdAt);
  }

  @Post()
  async create(@UserId() userId: string, @Body(new ZodPipe(CreateHomeInput)) body: CreateHomeInput) {
    return this.db.transaction(async (tx) => {
      const [h] = await tx.insert(homes).values({ name: body.name }).returning();
      await tx.insert(homeMembers).values({ homeId: h!.id, userId, role: "owner" });
      return { id: h!.id, name: h!.name, role: "owner" };
    });
  }

  @Get(":homeId/members")
  async members(@UserId() userId: string, @Param("homeId") homeId: string) {
    await this.access.role(userId, homeId);
    return this.db.select({ id: users.id, email: users.email, displayName: users.displayName, role: homeMembers.role })
      .from(homeMembers).innerJoin(users, eq(users.id, homeMembers.userId))
      .where(eq(homeMembers.homeId, homeId));
  }

  /** Adds an existing user to the home. (Email invites for unregistered users: later.) */
  @Post(":homeId/members")
  async invite(@UserId() userId: string, @Param("homeId") homeId: string,
    @Body(new ZodPipe(InviteMemberInput)) body: { email: string }) {
    await this.access.requireOwner(userId, homeId);
    const [u] = await this.db.select().from(users).where(eq(users.email, body.email.toLowerCase()));
    if (!u) throw new NotFoundException("No user with that email");
    await this.db.insert(homeMembers).values({ homeId, userId: u.id, role: "member" }).onConflictDoNothing();
    return { ok: true };
  }

  @Get(":homeId/status")
  async homeStatus(@UserId() userId: string, @Param("homeId") homeId: string) {
    await this.access.role(userId, homeId);
    return this.status.forHome(homeId);
  }
}
