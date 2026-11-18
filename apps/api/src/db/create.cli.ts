import {MIGRATION_FILE, migrationsDir} from './migrate';
import {existsSync, readdirSync, writeFileSync} from 'node:fs';

const name = process.argv[2]?.trim().toLowerCase().replace(/\W+/g, '_');
if (!name) {
  console.error('usage: bun run db:create <name>');
  process.exit(1);
}

const last = Math.max(-1, ...readdirSync(migrationsDir).map(f => Number(MIGRATION_FILE.exec(f)?.[1] ?? -1)));
const file = `${migrationsDir}/${String(last + 1).padStart(4, '0')}_${name}.ts`;
if (existsSync(file)) throw new Error(`${file} already exists`);

writeFileSync(
  file,
  `import type {Sql} from '../migrate';

export async function up(sql: Sql) {
  await sql.unsafe(\`\`);
}

export async function down(sql: Sql) {
  await sql.unsafe(\`\`);
}
`,
);
console.log(`created ${file}`);
