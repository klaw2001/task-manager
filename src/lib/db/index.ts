import "server-only";
import { createDb, type Database } from "./client";

// Survive Next.js dev hot-reloads and share one pool per server instance.
const g = globalThis as unknown as { __taskManagerDb?: Promise<Database> };

export function getDb(): Promise<Database> {
  if (!g.__taskManagerDb) {
    g.__taskManagerDb = createDb().catch((err) => {
      g.__taskManagerDb = undefined; // allow retry on next request
      throw err;
    });
  }
  return g.__taskManagerDb;
}

export * from "./schema";
