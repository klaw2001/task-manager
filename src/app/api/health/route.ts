import { lookup } from "node:dns/promises";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/auth/bearer";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + database check.
 *  • Anyone:  200 {"ok":true} or 503 {"ok":false}  — no details.
 *  • With `Authorization: Bearer $CRON_SECRET`: adds the failing error code/message and
 *    how the database host resolves (IPv4/IPv6) — handy when wiring up a new database.
 */
export async function GET(req: Request) {
  const detailed = hasCronSecret(req);
  const info: Record<string, unknown> = {};

  if (detailed) {
    try {
      const host = new URL(process.env.DATABASE_URL ?? "").hostname;
      if (host) {
        const addrs = await lookup(host, { all: true });
        info.dns = addrs.map((a) => `IPv${a.family}`);
      }
    } catch (e) {
      info.dns = `lookup failed: ${(e as { code?: string }).code ?? "unknown"}`;
    }
  }

  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    if (detailed) {
      const rows = (await db.execute(
        sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
      )) as unknown as { n: number }[];
      info.publicTables = rows[0]?.n;
    }
    return NextResponse.json({ ok: true, ...(detailed ? info : {}) });
  } catch (err) {
    const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const body = detailed
      ? { ok: false, ...info, code: e.cause?.code ?? e.code, message: (e.cause?.message ?? e.message ?? "").slice(0, 300) }
      : { ok: false };
    return NextResponse.json(body, { status: 503 });
  }
}
