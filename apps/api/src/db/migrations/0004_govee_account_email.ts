import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "homes" ADD COLUMN "govee_account_email" text;
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "homes" DROP COLUMN "govee_account_email";
  `);
}
