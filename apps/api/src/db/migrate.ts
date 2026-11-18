import postgres from 'postgres';
import type {Db} from './db.module';
import {readdirSync} from 'node:fs';
import {DATABASE_URL} from '../config';
import {fileURLToPath} from 'node:url';
import {setupTimescale} from './timescale';

export type Sql = postgres.TransactionSql;

interface Migration {
  name: string;
  up(sql: Sql): Promise<unknown>;
  down(sql: Sql): Promise<unknown>;
}

export const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));
export const MIGRATION_FILE = /^(\d{4})_\w+\.ts$/;
const LOCK_ID = 7_340_112;

async function load(): Promise<Migration[]> {
  const files = readdirSync(migrationsDir)
    .filter(f => MIGRATION_FILE.test(f))
    .sort();
  return Promise.all(
    files.map(async f => {
      const m = (await import(`${migrationsDir}/${f}`)) as Omit<Migration, 'name'>;
      return {name: f.replace(/\.ts$/, ''), up: m.up, down: m.down};
    }),
  );
}

async function adoptDrizzle(sql: postgres.Sql) {
  const [{found}] = await sql<{found: boolean}[]>`select to_regclass('drizzle.__drizzle_migrations') is not null as found`;
  if (!found) return;
  const [{count}] = await sql<{count: number}[]>`select count(*)::int as count from drizzle.__drizzle_migrations`;
  const names = (await load()).slice(0, count).map(m => ({name: m.name}));
  await sql.begin(async tx => {
    if (names.length > 0) await tx`insert into schema_migrations ${tx(names)} on conflict do nothing`;
    await tx`drop schema drizzle cascade`;
  });
}

async function withLock<T>(fn: (sql: postgres.Sql, migrations: Migration[]) => Promise<T>): Promise<T> {
  const sql = postgres(DATABASE_URL, {max: 1, onnotice: () => {}});
  try {
    await sql`select pg_advisory_lock(${LOCK_ID})`;
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    await adoptDrizzle(sql);
    return await fn(sql, await load());
  } finally {
    await sql.end();
  }
}

function migrateUp(): Promise<string[]> {
  return withLock(async (sql, migrations) => {
    const done = new Set((await sql<{name: string}[]>`select name from schema_migrations`).map(r => r.name));
    const applied: string[] = [];
    for (const m of migrations) {
      if (done.has(m.name)) continue;
      await sql.begin(async tx => {
        await m.up(tx);
        await tx`insert into schema_migrations (name) values (${m.name})`;
      });
      applied.push(m.name);
    }
    return applied;
  });
}

export function revertLast(): Promise<string | null> {
  return withLock(async (sql, migrations) => {
    const [last] = await sql<{name: string}[]>`select name from schema_migrations order by name desc limit 1`;
    if (!last) return null;
    const m = migrations.find(x => x.name === last.name);
    if (!m) throw new Error(`${last.name} is applied but src/db/migrations/${last.name}.ts does not exist`);
    await sql.begin(async tx => {
      await m.down(tx);
      await tx`delete from schema_migrations where name = ${m.name}`;
    });
    return m.name;
  });
}

export async function runMigrations(db: Db) {
  for (const name of await migrateUp()) console.log(`migrated ${name}`);
  await setupTimescale(db);
}
