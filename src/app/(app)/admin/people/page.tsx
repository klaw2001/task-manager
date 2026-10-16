import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRolePage } from "@/lib/auth/session";
import { getCompany } from "@/lib/data/company";
import { listPeople, listTeams } from "@/lib/data/users";
import { PeopleManager } from "@/components/admin/people-manager";

export const metadata: Metadata = { title: "People & roles" };

export default async function PeoplePage() {
  const user = await requireRolePage("ADMIN");
  const company = await getCompany();
  if (!company) redirect("/setup");
  const [people, teams] = await Promise.all([listPeople(company.timezone), listTeams()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">People & roles</h1>
        <p className="mt-0.5 text-sm text-muted">Add teammates, choose their role, and control who can sign in.</p>
      </header>
      <PeopleManager people={people} teams={teams} currentUserId={user.id} />
    </div>
  );
}
