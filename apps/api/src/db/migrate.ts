import type {Db} from './db.module';
import {fileURLToPath} from 'node:url';
import {setupTimescale} from './timescale';
import {migrate} from 'drizzle-orm/postgres-js/migrator';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(db: Db) {
  await migrate(db, {migrationsFolder});
  await setupTimescale(db);
}
