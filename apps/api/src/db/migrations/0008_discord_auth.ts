import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "users" DROP COLUMN "password_hash";
    ALTER TABLE "users" ADD COLUMN "discord_id" text;
    ALTER TABLE "users" ADD COLUMN "username" text;
    ALTER TABLE "users" ADD COLUMN "avatar" text;
    ALTER TABLE "users" ADD COLUMN "discord_access_token_enc" text;
    ALTER TABLE "users" ADD COLUMN "discord_refresh_token_enc" text;
    ALTER TABLE "users" ADD COLUMN "discord_token_expires_at" timestamp with time zone;
    ALTER TABLE "users" ADD CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id");
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "users" DROP COLUMN "discord_id";
    ALTER TABLE "users" DROP COLUMN "username";
    ALTER TABLE "users" DROP COLUMN "avatar";
    ALTER TABLE "users" DROP COLUMN "discord_access_token_enc";
    ALTER TABLE "users" DROP COLUMN "discord_refresh_token_enc";
    ALTER TABLE "users" DROP COLUMN "discord_token_expires_at";
    ALTER TABLE "users" ADD COLUMN "password_hash" text NOT NULL DEFAULT '';
    ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT;
  `);
}
