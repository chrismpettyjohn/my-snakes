import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import type { CreateLogInput } from "@snake/shared";
import { DB, type Db } from "../db/db.module";
import { snakeLogs } from "../db/schema";

const MAX_LOGS = 200;

/** Husbandry events: feeding, shed, weight, ... */
@Injectable()
export class LogService {
  constructor(@Inject(DB) private db: Db) {}

  forSnake(snakeId: string) {
    return this.db.select().from(snakeLogs).where(eq(snakeLogs.snakeId, snakeId)).orderBy(desc(snakeLogs.at)).limit(MAX_LOGS);
  }

  async add(snakeId: string, userId: string, input: CreateLogInput) {
    const [row] = await this.db.insert(snakeLogs).values({
      snakeId, userId, type: input.type, value: input.value, notes: input.notes,
      at: input.at ? new Date(input.at) : undefined,
    }).returning();
    return row!;
  }
}
