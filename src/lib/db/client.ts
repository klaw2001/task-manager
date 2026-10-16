// Database factory. No `server-only` import so scripts (seed) can reuse it.
//
//  • DATABASE_URL set  → real Postgres (Neon, Vercel Postgres, Supabase, …)
//  • DATABASE_URL unset → embedded PGlite in ./.data (local development only)
import postgres from "postgres";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

export async function createDb(): Promise<Database> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const client = postgres(url, {
      // Works behind PgBouncer / Neon pooler (transaction pooling).
      prepare: false,
      // One connection per serverless instance; the pooler does the sharing.
      max: process.env.VERCEL ? 1 : 10,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    return drizzlePg(client, { schema });
  }

  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Add a Postgres database to this Vercel project " +
        "(Storage → Neon / Postgres) or set DATABASE_URL in Project Settings → Environment Variables.",
    );
  }

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true }); // PGlite won't create parent directories
  const db = drizzle(new PGlite(dir), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Database;
}
