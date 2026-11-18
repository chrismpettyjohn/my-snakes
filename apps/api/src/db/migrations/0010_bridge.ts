import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(`
    CREATE TABLE "bridges" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "token_hash" text NOT NULL,
      "hostname" text,
      "last_seen_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "bridges_token_hash_unique" UNIQUE("token_hash")
    );
    ALTER TABLE "bridges" ADD CONSTRAINT "bridges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "bridges_user_idx" ON "bridges" USING btree ("user_id");
  `);
}

export async function down(sql: Sql) {
  await sql.unsafe('DROP TABLE "bridges";');
}
