// Local demo data:  npm run db:seed
//
// • Uses DATABASE_URL if set, otherwise the embedded PGlite database in ./.data
//   (stop `next dev` first — PGlite allows one process at a time).
// • Creates the company, an admin and four teammates, teams, and ~20 tasks
//   with a realistic mix of overdue / due-soon / done work.
import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import { createDb } from "../src/lib/db/client";
import { company, users } from "../src/lib/db/schema";
import { insertSampleData } from "../src/lib/db/sample";

const PASSWORD = "demo1234";

if ((process.env.VERCEL || process.env.NODE_ENV === "production") && !process.env.ALLOW_DEMO_SEED) {
  console.error("Refusing to seed demo accounts with a known password in production. Set ALLOW_DEMO_SEED=1 to override.");
  process.exit(1);
}

const db = await createDb();
const [{ n }] = await db.select({ n: count() }).from(users);
if (n > 0) {
  console.error("The database already has users. For a clean local demo: stop the dev server, `rm -rf .data`, then re-run.");
  process.exit(1);
}

await db.insert(company).values({ name: "Northwind Studio", tagline: "Design & engineering for ambitious products", timezone: "UTC", industry: "Product studio", size: "11–50", foundedYear: 2019, website: "https://example.com", description: "We help early-stage teams ship thoughtful products, fast." });
const [admin] = await db
  .insert(users)
  .values({ name: "Alex Morgan", email: "founder@example.com", role: "ADMIN", jobTitle: "Founder & CEO", passwordHash: await bcrypt.hash(PASSWORD, 10), lastLoginAt: new Date() })
  .returning({ id: users.id });

await insertSampleData(db, { adminId: admin.id, timezone: "UTC", password: () => PASSWORD });

console.log(`\n✔ Seeded.\n\n  Admin / founder   founder@example.com   ${PASSWORD}\n  Manager           maya@example.com      ${PASSWORD}\n  Members           jordan@ / sam@ / priya@example.com   ${PASSWORD}\n`);
process.exit(0);
