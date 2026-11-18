import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    CREATE TYPE "public"."webhook_provider" AS ENUM('herpstat');
    CREATE TABLE "webhooks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "device_id" uuid NOT NULL,
      "provider" "webhook_provider" NOT NULL,
      "api_key" text NOT NULL,
      "last_received_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "webhooks_api_key_unique" UNIQUE("api_key")
    );
    ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "webhooks_device_idx" ON "webhooks" USING btree ("device_id");
    CREATE INDEX "webhooks_user_idx" ON "webhooks" USING btree ("user_id");
    INSERT INTO "webhooks" ("user_id", "device_id", "provider", "api_key")
      SELECT "owner_id", "id", 'herpstat', "ingest_token" FROM "devices" WHERE "kind" = 'herpstat' AND "ingest_token" IS NOT NULL;
    ALTER TABLE "devices" DROP CONSTRAINT "devices_ingest_token_unique";
    ALTER TABLE "devices" DROP COLUMN "ingest_token";
    ALTER TABLE "devices" DROP COLUMN "host";
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "devices" ADD COLUMN "host" text;
    ALTER TABLE "devices" ADD COLUMN "ingest_token" text;
    ALTER TABLE "devices" ADD CONSTRAINT "devices_ingest_token_unique" UNIQUE("ingest_token");
    UPDATE "devices" d SET "ingest_token" = (
      SELECT w."api_key" FROM "webhooks" w WHERE w."device_id" = d."id" ORDER BY w."created_at" LIMIT 1
    );
    DROP TABLE "webhooks";
    DROP TYPE "public"."webhook_provider";
  `);
}
