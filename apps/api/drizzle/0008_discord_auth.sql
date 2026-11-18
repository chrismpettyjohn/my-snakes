ALTER TABLE "users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_access_token_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_refresh_token_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id");
