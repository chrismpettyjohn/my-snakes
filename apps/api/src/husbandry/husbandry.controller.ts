import { Body, Controller, Delete, Get, Inject, Param, Post, Put } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateLogInput, ReorderSnakesInput, UpsertSnakeInput,
  type CreateLogInput as CreateLog, type ReorderSnakesInput as ReorderSnakes, type UpsertSnakeInput as UpsertSnake,
} from "@snake/shared";
import { UserId } from "../auth/auth.guard";
import { AccessService } from "../common/access.service";
import { ZodPipe } from "../common/zod.pipe";
import { DB, type Db } from "../db/db.module";
import { snakeLogs, snakes } from "../db/schema";

@Controller()
export class HusbandryController {
  constructor(@Inject(DB) private db: Db, private access: AccessService) {}

  // ----- Snakes -----
  @Get("homes/:homeId/snakes")
  async listSnakes(@UserId() u: string, @Param("homeId") homeId: string) {
    await this.access.role(u, homeId);
    return this.db.select().from(snakes).where(eq(snakes.homeId, homeId)).orderBy(snakes.position, snakes.name);
  }

  @Post("homes/:homeId/snakes")
  async createSnake(@UserId() u: string, @Param("homeId") homeId: string,
    @Body(new ZodPipe(UpsertSnakeInput)) body: UpsertSnake) {
    await this.access.role(u, homeId);
    // New snakes go to the end of the list.
    const [{ next }] = await this.db.select({ next: sql<number>`coalesce(max(${snakes.position}) + 1, 0)::int` })
      .from(snakes).where(eq(snakes.homeId, homeId));
    const [row] = await this.db.insert(snakes).values({ ...body, homeId, position: next }).returning();
    return row;
  }

  @Put("homes/:homeId/snakes/order")
  async reorderSnakes(@UserId() u: string, @Param("homeId") homeId: string,
    @Body(new ZodPipe(ReorderSnakesInput)) body: ReorderSnakes) {
    await this.access.role(u, homeId);
    await this.db.transaction(async (tx) => {
      for (const [i, id] of body.ids.entries()) {
        // Scoped to the home so ids from elsewhere are ignored.
        await tx.update(snakes).set({ position: i }).where(and(eq(snakes.id, id), eq(snakes.homeId, homeId)));
      }
    });
    return { ok: true };
  }

  @Put("snakes/:id")
  async updateSnake(@UserId() u: string, @Param("id") id: string,
    @Body(new ZodPipe(UpsertSnakeInput)) body: UpsertSnake) {
    await this.access.snake(u, id);
    const [row] = await this.db.update(snakes).set(body).where(eq(snakes.id, id)).returning();
    return row;
  }

  @Delete("snakes/:id")
  async deleteSnake(@UserId() u: string, @Param("id") id: string) {
    await this.access.snake(u, id);
    await this.db.delete(snakes).where(eq(snakes.id, id));
    return { ok: true };
  }

  // ----- Logs (feeding, shed, weight, ...) -----
  @Get("snakes/:id/logs")
  async logs(@UserId() u: string, @Param("id") id: string) {
    await this.access.snake(u, id);
    return this.db.select().from(snakeLogs).where(eq(snakeLogs.snakeId, id)).orderBy(desc(snakeLogs.at)).limit(200);
  }

  @Post("snakes/:id/logs")
  async addLog(@UserId() u: string, @Param("id") id: string, @Body(new ZodPipe(CreateLogInput)) body: CreateLog) {
    await this.access.snake(u, id);
    const [row] = await this.db.insert(snakeLogs).values({
      snakeId: id, userId: u, type: body.type, value: body.value, notes: body.notes,
      at: body.at ? new Date(body.at) : undefined,
    }).returning();
    return row;
  }
}
