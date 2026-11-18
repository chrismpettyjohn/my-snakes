import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "homes" ADD COLUMN "icon" text DEFAULT 'house' NOT NULL;
    ALTER TABLE "homes" ADD COLUMN "color" text DEFAULT 'indigo' NOT NULL;
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "homes" DROP COLUMN "icon";
    ALTER TABLE "homes" DROP COLUMN "color";
  `);
}
