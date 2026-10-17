// TEMPORARY — finds which Supabase pooler region hosts this project (IPv4-reachable from Vercel).
// Bearer-protected, never prints credentials. Delete once DATABASE_URL points at the pooler.
import postgres from "postgres";
import { NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/auth/bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "sa-east-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "me-central-1", "af-south-1",
];

export async function GET(req: Request) {
  if (!hasCronSecret(req)) return new NextResponse("Unauthorized", { status: 401 });
  const u = new URL(process.env.DATABASE_URL ?? "");
  const ref = u.hostname.split(".")[1]; // db.<ref>.supabase.co
  const pass = decodeURIComponent(u.password);

  const hosts = ["aws-0", "aws-1"].flatMap((p) => REGIONS.map((r) => `${p}-${r}.pooler.supabase.com`));
  const results = await Promise.all(
    hosts.map(async (host) => {
      const sql = postgres({ host, port: 6543, user: `postgres.${ref}`, pass, database: "postgres", ssl: "require", prepare: false, max: 1, connect_timeout: 10 });
      try {
        await sql`select 1`;
        return { host, result: "OK" };
      } catch (e) {
        const err = e as { code?: string; message?: string };
        return { host, result: `${err.code ?? ""} ${(err.message ?? "").slice(0, 70)}`.trim() };
      } finally {
        await sql.end({ timeout: 1 }).catch(() => {});
      }
    }),
  );
  const wrong = (r: string) => /tenant or user not found/i.test(r) || /ENOTFOUND/.test(r);
  return NextResponse.json({
    ref,
    matches: results.filter((r) => !wrong(r.result)),
    wrongRegionCount: results.filter((r) => wrong(r.result)).length,
  });
}
