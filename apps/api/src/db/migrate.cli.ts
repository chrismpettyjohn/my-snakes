import postgres from 'postgres';
import * as schema from './schema';
import {DATABASE_URL} from '../config';
import {runMigrations} from './migrate';
import {drizzle} from 'drizzle-orm/postgres-js';

const client = postgres(DATABASE_URL, {max: 1, onnotice: () => {}});
await runMigrations(drizzle(client, {schema}));
await client.end();
console.log('Migrations applied');
