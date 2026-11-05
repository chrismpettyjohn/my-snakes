import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./db.module";
import { setupTimescale } from "./timescale";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder });
  await setupTimescale(db);
}
