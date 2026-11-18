import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TABLE "animals" RENAME TO "snakes";
    ALTER TABLE "animal_logs" RENAME TO "snake_logs";
    ALTER TABLE "animal_sensors" RENAME TO "snake_sensors";
    ALTER TABLE "snake_logs" RENAME COLUMN "animal_id" TO "snake_id";
    ALTER TABLE "snake_sensors" RENAME COLUMN "animal_id" TO "snake_id";
    ALTER TABLE "snakes" RENAME CONSTRAINT "animals_home_id_homes_id_fk" TO "snakes_home_id_homes_id_fk";
    ALTER TABLE "snake_logs" RENAME CONSTRAINT "animal_logs_animal_id_animals_id_fk" TO "snake_logs_snake_id_snakes_id_fk";
    ALTER TABLE "snake_logs" RENAME CONSTRAINT "animal_logs_user_id_users_id_fk" TO "snake_logs_user_id_users_id_fk";
    ALTER TABLE "snake_sensors" RENAME CONSTRAINT "animal_sensors_animal_id_animals_id_fk" TO "snake_sensors_snake_id_snakes_id_fk";
    ALTER TABLE "snake_sensors" RENAME CONSTRAINT "animal_sensors_device_id_devices_id_fk" TO "snake_sensors_device_id_devices_id_fk";
    ALTER TABLE "snake_sensors" RENAME CONSTRAINT "animal_sensors_animal_id_device_id_channel_pk" TO "snake_sensors_snake_id_device_id_channel_pk";
    ALTER INDEX "animals_home_idx" RENAME TO "snakes_home_idx";
    ALTER INDEX "animal_logs_animal_at_idx" RENAME TO "snake_logs_snake_at_idx";
    ALTER INDEX "animal_sensors_device_idx" RENAME TO "snake_sensors_device_idx";
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    ALTER INDEX "snake_sensors_device_idx" RENAME TO "animal_sensors_device_idx";
    ALTER INDEX "snake_logs_snake_at_idx" RENAME TO "animal_logs_animal_at_idx";
    ALTER INDEX "snakes_home_idx" RENAME TO "animals_home_idx";
    ALTER TABLE "snake_sensors" RENAME CONSTRAINT "snake_sensors_snake_id_device_id_channel_pk" TO "animal_sensors_animal_id_device_id_channel_pk";
    ALTER TABLE "snake_sensors" RENAME CONSTRAINT "snake_sensors_device_id_devices_id_fk" TO "animal_sensors_device_id_devices_id_fk";
    ALTER TABLE "snake_sensors" RENAME CONSTRAINT "snake_sensors_snake_id_snakes_id_fk" TO "animal_sensors_animal_id_animals_id_fk";
    ALTER TABLE "snake_logs" RENAME CONSTRAINT "snake_logs_user_id_users_id_fk" TO "animal_logs_user_id_users_id_fk";
    ALTER TABLE "snake_logs" RENAME CONSTRAINT "snake_logs_snake_id_snakes_id_fk" TO "animal_logs_animal_id_animals_id_fk";
    ALTER TABLE "snakes" RENAME CONSTRAINT "snakes_home_id_homes_id_fk" TO "animals_home_id_homes_id_fk";
    ALTER TABLE "snake_sensors" RENAME COLUMN "snake_id" TO "animal_id";
    ALTER TABLE "snake_logs" RENAME COLUMN "snake_id" TO "animal_id";
    ALTER TABLE "snake_sensors" RENAME TO "animal_sensors";
    ALTER TABLE "snake_logs" RENAME TO "animal_logs";
    ALTER TABLE "snakes" RENAME TO "animals";
  `);
}
