-- Devices and the Govee key move from a collection (home) to the user who owns it.
ALTER TABLE "users" ADD COLUMN "govee_api_key_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "govee_account_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "govee_last_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "govee_last_error" text;--> statement-breakpoint
UPDATE "users" u SET
  "govee_api_key_enc" = h."govee_api_key_enc", "govee_account_email" = h."govee_account_email",
  "govee_last_sync_at" = h."govee_last_sync_at", "govee_last_error" = h."govee_last_error"
FROM (
  SELECT DISTINCT ON (m."user_id") m."user_id", h.*
  FROM "homes" h JOIN "home_members" m ON m."home_id" = h."id" AND m."role" = 'owner'
  WHERE h."govee_api_key_enc" IS NOT NULL
  ORDER BY m."user_id", h."govee_last_sync_at" DESC NULLS LAST
) h
WHERE h."user_id" = u."id";--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "devices" d SET "owner_id" = (
  SELECT m."user_id" FROM "home_members" m WHERE m."home_id" = d."home_id" AND m."role" = 'owner'
  ORDER BY m."created_at" LIMIT 1
);--> statement-breakpoint
DELETE FROM "devices" WHERE "owner_id" IS NULL;--> statement-breakpoint
-- One user owning the same sensor in two collections: keep the oldest row and move links to it.
CREATE TEMP TABLE "device_dupes" AS
  SELECT d."id" AS "dupe", k."id" AS "keep" FROM "devices" d
  JOIN LATERAL (
    SELECT k."id" FROM "devices" k
    WHERE k."owner_id" = d."owner_id" AND k."kind" = d."kind" AND k."external_id" = d."external_id"
    ORDER BY k."created_at", k."id" LIMIT 1
  ) k ON k."id" <> d."id"
  WHERE d."external_id" IS NOT NULL;--> statement-breakpoint
INSERT INTO "snake_sensors" ("snake_id", "device_id", "channel", "role")
  SELECT s."snake_id", x."keep", s."channel", s."role" FROM "snake_sensors" s JOIN "device_dupes" x ON x."dupe" = s."device_id"
  ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "devices" WHERE "id" IN (SELECT "dupe" FROM "device_dupes");--> statement-breakpoint
DROP TABLE "device_dupes";--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" DROP CONSTRAINT "devices_home_id_homes_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "devices_home_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "devices_home_kind_ext_idx";--> statement-breakpoint
ALTER TABLE "devices" DROP COLUMN "home_id";--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_owner_idx" ON "devices" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "devices_owner_kind_ext_idx" ON "devices" USING btree ("owner_id","kind","external_id");--> statement-breakpoint
ALTER TABLE "homes" DROP COLUMN "govee_api_key_enc";--> statement-breakpoint
ALTER TABLE "homes" DROP COLUMN "govee_account_email";--> statement-breakpoint
ALTER TABLE "homes" DROP COLUMN "govee_last_sync_at";--> statement-breakpoint
ALTER TABLE "homes" DROP COLUMN "govee_last_error";
