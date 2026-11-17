import postgres from 'postgres';
import * as schema from './schema';
import {runMigrations} from './migrate';
import {Global, Module} from '@nestjs/common';
import {DATABASE_URL, MIGRATE_ON_BOOT} from '../config';
import {drizzle, type PostgresJsDatabase} from 'drizzle-orm/postgres-js';

export const DB = Symbol('DB');
export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: async (): Promise<Db> => {
        const db = drizzle(postgres(DATABASE_URL, {onnotice: () => {}}), {schema});
        if (MIGRATE_ON_BOOT) await runMigrations(db);
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
