import {snakes} from '../db/schema';
import {and, eq, sql} from 'drizzle-orm';
import {DB, type Db} from '../db/db.module';
import {Inject, Injectable} from '@nestjs/common';
import type {UpsertSnakeInput} from '@snake/shared';

@Injectable()
export class SnakeService {
  constructor(@Inject(DB) private db: Db) {}

  list(homeId: string) {
    return this.db.select().from(snakes).where(eq(snakes.homeId, homeId)).orderBy(snakes.position, snakes.name);
  }

  private async nextPosition(homeId: string, db: Pick<Db, 'select'> = this.db) {
    const [{next}] = await db
      .select({next: sql<number>`coalesce(max(${snakes.position}) + 1, 0)::int`})
      .from(snakes)
      .where(eq(snakes.homeId, homeId));
    return next;
  }

  async create(homeId: string, input: UpsertSnakeInput) {
    const next = await this.nextPosition(homeId);
    const [row] = await this.db
      .insert(snakes)
      .values({...input, homeId, position: next})
      .returning();
    return row!;
  }

  async update(id: string, input: UpsertSnakeInput) {
    const [row] = await this.db.update(snakes).set(input).where(eq(snakes.id, id)).returning();
    return row!;
  }

  async move(id: string, homeId: string) {
    const position = await this.nextPosition(homeId);
    await this.db.update(snakes).set({homeId, position}).where(eq(snakes.id, id));
  }

  async remove(id: string) {
    await this.db.delete(snakes).where(eq(snakes.id, id));
  }

  async reorder(homeId: string, ids: string[]) {
    await this.db.transaction(async tx => {
      for (const [position, id] of ids.entries()) {
        await tx
          .update(snakes)
          .set({position})
          .where(and(eq(snakes.id, id), eq(snakes.homeId, homeId)));
      }
    });
  }
}
