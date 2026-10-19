import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const LOCK_ID = 727274; // advisory lock so several instances starting together don't race

export async function migrate(log = console.log) {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  await db.tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const { rows } = await c.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      log(`applying ${file}`);
      await c.query(await fs.readFile(path.join(dir, file), 'utf8'));
      await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }
  });
}
