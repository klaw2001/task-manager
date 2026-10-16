import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { needsSetup } from "@/lib/data/company";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await needsSetup()) redirect("/setup");
  redirect((await getCurrentUser()) ? "/dashboard" : "/login");
}
