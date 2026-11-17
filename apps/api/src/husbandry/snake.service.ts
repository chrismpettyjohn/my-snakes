import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import type { UpsertSnakeInput } from "@snake/shared";
import { DB, type Db } from "../db/db.module";
import { snakes } from "../db/schema";

@Injectable()
export class SnakeService {
  constructor(@Inject(DB) private db: Db) {}

  /** A home's snakes in the user-chosen display order. */
  list(homeId: string) {
    return this.db.select().from(snakes).where(eq(snakes.homeId, homeId)).orderBy(snakes.position, snakes.name);
  }

  /** New snakes go to the end of the list. */
  async create(homeId: string, input: UpsertSnakeInput) {
    const [{ next }] = await this.db.select({ next: sql<number>`coalesce(max(${snakes.position}) + 1, 0)::int` })
      .from(snakes).where(eq(snakes.homeId, homeId));
    const [row] = await this.db.insert(snakes).values({ ...input, homeId, position: next }).returning();
    return row!;
  }

  async update(id: string, input: UpsertSnakeInput) {
    const [row] = await this.db.update(snakes).set(input).where(eq(snakes.id, id)).returning();
    return row!;
  }

  async remove(id: string) {
    await this.db.delete(snakes).where(eq(snakes.id, id));
  }

  /** Sets display order. Scoped to the home, so ids from elsewhere are ignored. */
  async reorder(homeId: string, ids: string[]) {
    await this.db.transaction(async (tx) => {
      for (const [position, id] of ids.entries()) {
        await tx.update(snakes).set({ position }).where(and(eq(snakes.id, id), eq(snakes.homeId, homeId)));
      }
    });
  }
}
