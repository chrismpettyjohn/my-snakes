import postgres from 'postgres';
import {DATABASE_URL} from '../config';
import {fileURLToPath} from 'node:url';
import {existsSync, readFileSync} from 'node:fs';

const drizzleDir = fileURLToPath(new URL('../../drizzle', import.meta.url));

interface JournalEntry {
  tag: string;
  when: number;
}

const journal = JSON.parse(readFileSync(`${drizzleDir}/meta/_journal.json`, 'utf-8')) as {
  entries: JournalEntry[];
};

const sql = postgres(DATABASE_URL, {max: 1, onnotice: () => {}});

try {
  const [last] = await sql<{id: number; created_at: string}[]>`
    SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1
  `;
  if (!last) {
    console.log('nothing to revert');
    process.exit(0);
  }

  const entry = journal.entries.find(e => e.when === Number(last.created_at));
  if (!entry) {
    console.error(`applied migration (when=${last.created_at}) is not in drizzle/meta/_journal.json`);
    process.exit(1);
  }

  const downFile = `${drizzleDir}/down/${entry.tag}.sql`;
  if (!existsSync(downFile)) {
    console.error(`no down migration for ${entry.tag}: create drizzle/down/${entry.tag}.sql`);
    process.exit(1);
  }

  await sql.begin(async tx => {
    await tx.unsafe(readFileSync(downFile, 'utf-8'));
    await tx`DELETE FROM drizzle.__drizzle_migrations WHERE id = ${last.id}`;
  });
  console.log(`reverted ${entry.tag}`);
} finally {
  await sql.end();
}
