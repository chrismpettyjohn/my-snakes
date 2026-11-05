// `bun run db:migrate`: apply migrations + TimescaleDB setup, then exit.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DATABASE_URL } from "../config";
import { runMigrations } from "./migrate";
import * as schema from "./schema";

const client = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
await runMigrations(drizzle(client, { schema }));
await client.end();
console.log("Migrations applied");
