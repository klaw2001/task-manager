// Applies SQL migrations from ./drizzle.
// Runs automatically before `next build` (see package.json) so every Vercel
// deploy ships with an up-to-date schema.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;

if (!url) {
  if (process.env.VERCEL) {
    console.error(
      "\n✖ DATABASE_URL is not set — cannot migrate.\n" +
        "  Add a Postgres database in Vercel (Storage → Neon) or set DATABASE_URL, then redeploy.\n",
    );
    process.exit(1);
  }
  console.log("• No DATABASE_URL — skipping migrations (local dev uses embedded PGlite and migrates on start).");
  process.exit(0);
}

const client = postgres(url, { max: 1, prepare: false, connect_timeout: 30, onnotice: () => {} });
try {
  console.log("• Applying database migrations…");
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("✔ Database is up to date.");
} catch (err) {
  console.error("✖ Migration failed:", err);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
