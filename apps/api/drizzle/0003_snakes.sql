ALTER TABLE "animals" RENAME TO "snakes";--> statement-breakpoint
ALTER TABLE "animal_logs" RENAME TO "snake_logs";--> statement-breakpoint
ALTER TABLE "animal_sensors" RENAME TO "snake_sensors";--> statement-breakpoint
ALTER TABLE "snake_logs" RENAME COLUMN "animal_id" TO "snake_id";--> statement-breakpoint
ALTER TABLE "snake_sensors" RENAME COLUMN "animal_id" TO "snake_id";--> statement-breakpoint
ALTER TABLE "snakes" RENAME CONSTRAINT "animals_home_id_homes_id_fk" TO "snakes_home_id_homes_id_fk";--> statement-breakpoint
ALTER TABLE "snake_logs" RENAME CONSTRAINT "animal_logs_animal_id_animals_id_fk" TO "snake_logs_snake_id_snakes_id_fk";--> statement-breakpoint
ALTER TABLE "snake_logs" RENAME CONSTRAINT "animal_logs_user_id_users_id_fk" TO "snake_logs_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "snake_sensors" RENAME CONSTRAINT "animal_sensors_animal_id_animals_id_fk" TO "snake_sensors_snake_id_snakes_id_fk";--> statement-breakpoint
ALTER TABLE "snake_sensors" RENAME CONSTRAINT "animal_sensors_device_id_devices_id_fk" TO "snake_sensors_device_id_devices_id_fk";--> statement-breakpoint
ALTER TABLE "snake_sensors" RENAME CONSTRAINT "animal_sensors_animal_id_device_id_channel_pk" TO "snake_sensors_snake_id_device_id_channel_pk";--> statement-breakpoint
ALTER INDEX "animals_home_idx" RENAME TO "snakes_home_idx";--> statement-breakpoint
ALTER INDEX "animal_logs_animal_at_idx" RENAME TO "snake_logs_snake_at_idx";--> statement-breakpoint
ALTER INDEX "animal_sensors_device_idx" RENAME TO "snake_sensors_device_idx";
