import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "animals" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "animals" DROP COLUMN "position";
  `);
}
