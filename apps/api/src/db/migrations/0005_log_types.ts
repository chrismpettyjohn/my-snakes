import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    ALTER TYPE "public"."log_type" ADD VALUE 'poop' BEFORE 'weight';
    ALTER TYPE "public"."log_type" ADD VALUE 'urates' BEFORE 'weight';
    ALTER TYPE "public"."log_type" ADD VALUE 'water' BEFORE 'weight';
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe(`
    DELETE FROM "snake_logs" WHERE "type" IN ('poop', 'urates', 'water');
    ALTER TYPE "public"."log_type" RENAME TO "log_type_old";
    CREATE TYPE "public"."log_type" AS ENUM('feeding', 'refused', 'shed', 'weight', 'cleaning', 'note');
    ALTER TABLE "snake_logs" ALTER COLUMN "type" TYPE "public"."log_type" USING "type"::text::"public"."log_type";
    DROP TYPE "public"."log_type_old";
  `);
}
