import { Global, Module } from "@nestjs/common";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { DATABASE_URL, MIGRATE_ON_BOOT } from "../config";
import { runMigrations } from "./migrate";

export const DB = Symbol("DB");
export type Db = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [{
    provide: DB,
    useFactory: async (): Promise<Db> => {
      const db = drizzle(postgres(DATABASE_URL, { onnotice: () => {} }), { schema });
      if (MIGRATE_ON_BOOT) await runMigrations(db);
      return db;
    },
  }],
  exports: [DB],
})
export class DbModule {}
