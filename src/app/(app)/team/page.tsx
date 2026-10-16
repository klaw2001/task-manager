import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Building2, Calendar, Globe, Mail, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/data/company";
import { listPeople, type PersonRow } from "@/lib/data/users";
import { ROLE_LABEL } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { CompanyMark } from "@/components/layout/brand";
import { Pill } from "@/components/ui/pill";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireUser();
  const company = await getCompany();
  if (!company) redirect("/setup");

  const people = (await listPeople(company.timezone)).filter((p) => p.active);
  const showLoad = can.viewAllTasks(user.role, company.memberVisibility);

  const byTeam = new Map<string, PersonRow[]>();
  for (const p of people) {
    const key = p.teamName ?? "";
    byTeam.set(key, [...(byTeam.get(key) ?? []), p]);
  }
  const groups = [...byTeam.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">
      <section className="flex flex-col gap-4 rounded-xl border bg-subtle p-5 sm:flex-row sm:items-start">
        <CompanyMark name={company.name} logoUrl={company.logoUrl} size={56} className="!rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
          {company.tagline && <p className="text-sm text-muted">{company.tagline}</p>}
          {company.description && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">{company.description}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
            {company.industry && (
              <div className="flex items-center gap-1.5">
                <Briefcase className="size-3.5" /> {company.industry}
              </div>
            )}
            {company.size && (
              <div className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {company.size} people
              </div>
            )}
            {company.foundedYear && (
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Founded {company.foundedYear}
              </div>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-fg">
                <Globe className="size-3.5" /> {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </dl>
        </div>
        {user.role === "ADMIN" && (
          <Link href="/admin/company" className={buttonStyles("secondary", "sm", "self-start")}>
            <Building2 className="size-3.5" /> Edit profile
          </Link>
        )}
      </section>

      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">People</h2>
          <p className="text-sm text-muted">{people.length} on the team</p>
        </div>
        {user.role === "ADMIN" && (
          <Link href="/admin/people" className={buttonStyles("secondary", "sm")}>
            Manage people & roles
          </Link>
        )}
      </div>

      {groups.map(([team, members]) => (
        <section key={team || "none"} aria-label={team || "No team"}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            {team || "No team yet"} · {members.length}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-xl border bg-bg p-4">
                <Avatar id={p.id} name={p.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    {p.id === user.id && <span className="text-xs text-faint">you</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{p.jobTitle || "—"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Pill tone={p.role === "ADMIN" ? "purple" : p.role === "MANAGER" ? "blue" : "gray"}>{ROLE_LABEL[p.role]}</Pill>
                    {showLoad && (
                      <Link
                        href={`/tasks?scope=all&assignee=${p.id}`}
                        className="text-xs text-muted hover:text-fg"
                      >
                        {p.open} open
                        {p.overdue > 0 && <span className="font-medium text-danger"> · {p.overdue} overdue</span>}
                      </Link>
                    )}
                  </div>
                  <a href={`mailto:${p.email}`} className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted hover:text-fg">
                    <Mail className="size-3 shrink-0" /> <span className="truncate">{p.email}</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
