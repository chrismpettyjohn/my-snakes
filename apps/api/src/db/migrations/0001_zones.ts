import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "animal_sensors" ADD COLUMN "role" text;
    ALTER TABLE "animals" ADD COLUMN "photo" text;
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "animals" DROP COLUMN "photo";
    ALTER TABLE "animal_sensors" DROP COLUMN "role";
  `);
}
