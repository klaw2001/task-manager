import "server-only";
import { cache } from "react";
import { count } from "drizzle-orm";
import { company, getDb, users } from "../db";
import type { CompanyView } from "../types";

export const getCompany = cache(async (): Promise<CompanyView | null> => {
  const db = await getDb();
  const [c] = await db.select().from(company).limit(1);
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    website: c.website,
    industry: c.industry,
    size: c.size,
    foundedYear: c.foundedYear,
    timezone: c.timezone,
    accentColor: c.accentColor,
    logoUrl: c.logoUrl,
    memberVisibility: c.memberVisibility,
  };
});

/** True until the first admin has been created via /setup. */
export async function needsSetup(): Promise<boolean> {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(users);
  return n === 0;
}
