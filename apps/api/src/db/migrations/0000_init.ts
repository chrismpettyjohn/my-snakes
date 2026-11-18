import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    CREATE TYPE "public"."device_kind" AS ENUM('herpstat', 'govee');
    CREATE TYPE "public"."home_role" AS ENUM('owner', 'member');
    CREATE TYPE "public"."log_type" AS ENUM('feeding', 'refused', 'shed', 'weight', 'cleaning', 'note');
    CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'unknown');
    CREATE TABLE "animal_logs" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"animal_id" uuid NOT NULL,
    	"user_id" uuid,
    	"type" "log_type" NOT NULL,
    	"at" timestamp with time zone DEFAULT now() NOT NULL,
    	"value" double precision,
    	"notes" text
    );
    CREATE TABLE "animal_sensors" (
    	"animal_id" uuid NOT NULL,
    	"device_id" uuid NOT NULL,
    	"channel" text NOT NULL,
    	CONSTRAINT "animal_sensors_animal_id_device_id_channel_pk" PRIMARY KEY("animal_id","device_id","channel")
    );
    CREATE TABLE "animals" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"home_id" uuid NOT NULL,
    	"name" text NOT NULL,
    	"species" text,
    	"morph" text,
    	"sex" "sex" DEFAULT 'unknown' NOT NULL,
    	"hatch_date" date,
    	"notes" text,
    	"min_temp_f" double precision,
    	"max_temp_f" double precision,
    	"min_humidity" double precision,
    	"max_humidity" double precision,
    	"created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "devices" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"home_id" uuid NOT NULL,
    	"kind" "device_kind" NOT NULL,
    	"name" text NOT NULL,
    	"external_id" text,
    	"model" text,
    	"host" text,
    	"firmware" text,
    	"last_error" text,
    	"channel_labels" jsonb,
    	"ingest_token" text,
    	"last_seen_at" timestamp with time zone,
    	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
    	CONSTRAINT "devices_ingest_token_unique" UNIQUE("ingest_token")
    );
    CREATE TABLE "home_members" (
    	"home_id" uuid NOT NULL,
    	"user_id" uuid NOT NULL,
    	"role" "home_role" DEFAULT 'member' NOT NULL,
    	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
    	CONSTRAINT "home_members_home_id_user_id_pk" PRIMARY KEY("home_id","user_id")
    );
    CREATE TABLE "homes" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"name" text NOT NULL,
    	"govee_api_key_enc" text,
    	"govee_last_sync_at" timestamp with time zone,
    	"govee_last_error" text,
    	"created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "raw_uploads" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"device_id" uuid,
    	"content_type" text,
    	"headers" jsonb,
    	"body" text NOT NULL,
    	"received_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "readings" (
    	"device_id" uuid NOT NULL,
    	"channel" text NOT NULL,
    	"metric" text NOT NULL,
    	"value" double precision NOT NULL,
    	"at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "users" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"email" text NOT NULL,
    	"password_hash" text NOT NULL,
    	"display_name" text NOT NULL,
    	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
    	CONSTRAINT "users_email_unique" UNIQUE("email")
    );
    ALTER TABLE "animal_logs" ADD CONSTRAINT "animal_logs_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "animal_logs" ADD CONSTRAINT "animal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "animal_sensors" ADD CONSTRAINT "animal_sensors_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "animal_sensors" ADD CONSTRAINT "animal_sensors_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "animals" ADD CONSTRAINT "animals_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "devices" ADD CONSTRAINT "devices_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "home_members" ADD CONSTRAINT "home_members_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "home_members" ADD CONSTRAINT "home_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "raw_uploads" ADD CONSTRAINT "raw_uploads_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "readings" ADD CONSTRAINT "readings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "animal_logs_animal_at_idx" ON "animal_logs" USING btree ("animal_id","at");
    CREATE INDEX "animal_sensors_device_idx" ON "animal_sensors" USING btree ("device_id","channel");
    CREATE INDEX "animals_home_idx" ON "animals" USING btree ("home_id");
    CREATE INDEX "devices_home_idx" ON "devices" USING btree ("home_id");
    CREATE UNIQUE INDEX "devices_home_kind_ext_idx" ON "devices" USING btree ("home_id","kind","external_id");
    CREATE INDEX "readings_device_at_idx" ON "readings" USING btree ("device_id","at");
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    DROP MATERIALIZED VIEW IF EXISTS "readings_5m" CASCADE;
    DROP TABLE "readings";
    DROP TABLE "animal_logs", "animal_sensors", "animals", "devices", "home_members", "homes", "raw_uploads", "users" CASCADE;
    DROP TYPE "public"."device_kind";
    DROP TYPE "public"."home_role";
    DROP TYPE "public"."log_type";
    DROP TYPE "public"."sex";
  `);
}
