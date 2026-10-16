import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/session";
import { listTeams } from "@/lib/data/users";
import { TeamsManager } from "@/components/admin/teams-manager";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  await requireRolePage("ADMIN");
  const teams = await listTeams();
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="mt-0.5 text-sm text-muted">Group people by function. Assign members to a team from People & roles.</p>
      </header>
      <TeamsManager teams={teams} />
    </div>
  );
}
