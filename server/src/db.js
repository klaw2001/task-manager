import fs from 'node:fs';
import pg from 'pg';
import { config } from './config.js';

// keep DATE columns as plain 'YYYY-MM-DD' strings instead of shifting them through the server timezone
pg.types.setTypeParser(1082, (v) => v);

const ssl = config.databaseSsl
  ? config.databaseSslCaFile
    ? { ca: fs.readFileSync(config.databaseSslCaFile, 'utf8') }
    : { rejectUnauthorized: false }
  : undefined;

const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl, max: 10 });

export const db = {
  query: (text, params) => pool.query(text, params),
  all: async (text, params) => (await pool.query(text, params)).rows,
  one: async (text, params) => (await pool.query(text, params)).rows[0] ?? null,
  /** Runs fn(client) in a transaction; client.query returns the raw pg result. */
  async tx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  close: () => pool.end(),
};
