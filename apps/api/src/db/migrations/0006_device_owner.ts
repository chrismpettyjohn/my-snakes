import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "users" ADD COLUMN "govee_api_key_enc" text;
    ALTER TABLE "users" ADD COLUMN "govee_account_email" text;
    ALTER TABLE "users" ADD COLUMN "govee_last_sync_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN "govee_last_error" text;
    UPDATE "users" u SET
      "govee_api_key_enc" = h."govee_api_key_enc", "govee_account_email" = h."govee_account_email",
      "govee_last_sync_at" = h."govee_last_sync_at", "govee_last_error" = h."govee_last_error"
    FROM (
      SELECT DISTINCT ON (m."user_id") m."user_id", h.*
      FROM "homes" h JOIN "home_members" m ON m."home_id" = h."id" AND m."role" = 'owner'
      WHERE h."govee_api_key_enc" IS NOT NULL
      ORDER BY m."user_id", h."govee_last_sync_at" DESC NULLS LAST
    ) h
    WHERE h."user_id" = u."id";
    ALTER TABLE "devices" ADD COLUMN "owner_id" uuid;
    UPDATE "devices" d SET "owner_id" = (
      SELECT m."user_id" FROM "home_members" m WHERE m."home_id" = d."home_id" AND m."role" = 'owner'
      ORDER BY m."created_at" LIMIT 1
    );
    DELETE FROM "devices" WHERE "owner_id" IS NULL;
    CREATE TEMP TABLE "device_dupes" AS
      SELECT d."id" AS "dupe", k."id" AS "keep" FROM "devices" d
      JOIN LATERAL (
        SELECT k."id" FROM "devices" k
        WHERE k."owner_id" = d."owner_id" AND k."kind" = d."kind" AND k."external_id" = d."external_id"
        ORDER BY k."created_at", k."id" LIMIT 1
      ) k ON k."id" <> d."id"
      WHERE d."external_id" IS NOT NULL;
    INSERT INTO "snake_sensors" ("snake_id", "device_id", "channel", "role")
      SELECT s."snake_id", x."keep", s."channel", s."role" FROM "snake_sensors" s JOIN "device_dupes" x ON x."dupe" = s."device_id"
      ON CONFLICT DO NOTHING;
    DELETE FROM "devices" WHERE "id" IN (SELECT "dupe" FROM "device_dupes");
    DROP TABLE "device_dupes";
    ALTER TABLE "devices" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "devices" DROP CONSTRAINT "devices_home_id_homes_id_fk";
    DROP INDEX IF EXISTS "devices_home_idx";
    DROP INDEX IF EXISTS "devices_home_kind_ext_idx";
    ALTER TABLE "devices" DROP COLUMN "home_id";
    ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "devices_owner_idx" ON "devices" USING btree ("owner_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "devices_owner_kind_ext_idx" ON "devices" USING btree ("owner_id","kind","external_id");
    ALTER TABLE "homes" DROP COLUMN "govee_api_key_enc";
    ALTER TABLE "homes" DROP COLUMN "govee_account_email";
    ALTER TABLE "homes" DROP COLUMN "govee_last_sync_at";
    ALTER TABLE "homes" DROP COLUMN "govee_last_error";
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "homes" ADD COLUMN "govee_api_key_enc" text;
    ALTER TABLE "homes" ADD COLUMN "govee_account_email" text;
    ALTER TABLE "homes" ADD COLUMN "govee_last_sync_at" timestamp with time zone;
    ALTER TABLE "homes" ADD COLUMN "govee_last_error" text;
    UPDATE "homes" h SET
      "govee_api_key_enc" = u."govee_api_key_enc", "govee_account_email" = u."govee_account_email",
      "govee_last_sync_at" = u."govee_last_sync_at", "govee_last_error" = u."govee_last_error"
    FROM "home_members" m JOIN "users" u ON u."id" = m."user_id"
    WHERE m."home_id" = h."id" AND m."role" = 'owner';
    ALTER TABLE "devices" ADD COLUMN "home_id" uuid;
    UPDATE "devices" d SET "home_id" = COALESCE(
      (SELECT s."home_id" FROM "snake_sensors" ss JOIN "snakes" s ON s."id" = ss."snake_id" WHERE ss."device_id" = d."id" LIMIT 1),
      (SELECT m."home_id" FROM "home_members" m WHERE m."user_id" = d."owner_id" AND m."role" = 'owner' ORDER BY m."created_at" LIMIT 1)
    );
    DELETE FROM "devices" WHERE "home_id" IS NULL;
    ALTER TABLE "devices" ALTER COLUMN "home_id" SET NOT NULL;
    DROP INDEX IF EXISTS "devices_owner_idx";
    DROP INDEX IF EXISTS "devices_owner_kind_ext_idx";
    ALTER TABLE "devices" DROP CONSTRAINT "devices_owner_id_users_id_fk";
    ALTER TABLE "devices" DROP COLUMN "owner_id";
    ALTER TABLE "devices" ADD CONSTRAINT "devices_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "devices_home_idx" ON "devices" USING btree ("home_id");
    CREATE UNIQUE INDEX "devices_home_kind_ext_idx" ON "devices" USING btree ("home_id","kind","external_id");
    ALTER TABLE "users" DROP COLUMN "govee_api_key_enc";
    ALTER TABLE "users" DROP COLUMN "govee_account_email";
    ALTER TABLE "users" DROP COLUMN "govee_last_sync_at";
    ALTER TABLE "users" DROP COLUMN "govee_last_error";
  `);
}
