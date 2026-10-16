import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheckBig, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/data/company";
import { getDashboard } from "@/lib/data/dashboard";
import { can } from "@/lib/permissions";
import { pluralize } from "@/lib/utils";
import type { TaskRow } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { NewTaskButton } from "@/components/tasks/new-task";
import { TaskListRow } from "@/components/tasks/task-list-row";
import { Card, RecentActivity, SeeAll, StatCard, TrendChart, WorkloadList } from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date())) % 24;
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function groupByAssignee(tasks: TaskRow[]) {
  const groups = new Map<string, { id: string; name: string; tasks: TaskRow[] }>();
  for (const t of tasks) {
    const key = t.assignee?.id ?? "none";
    const g = groups.get(key) ?? { id: key, name: t.assignee?.name ?? "Unassigned", tasks: [] };
    g.tasks.push(t);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.id === "none" ? 1 : b.id === "none" ? -1 : b.tasks.length - a.tasks.length));
}

export default async function DashboardPage() {
  const user = await requireUser();
  const company = await getCompany();
  if (!company) redirect("/setup");
  const d = await getDashboard(user, company);
  const lead = can.viewWorkload(user.role);
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: company.timezone }).format(new Date());
  const scopeWord = lead ? "across the company" : "assigned to you";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{dateLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(company.timezone)}, {user.name.split(" ")[0]}
          </h1>
          {lead && d.myCounts && (
            <p className="mt-1 text-sm text-muted">
              On your own plate: {d.myCounts.open} open
              {d.myCounts.overdue > 0 && (
                <>
                  , <span className="font-medium text-danger">{d.myCounts.overdue} overdue</span>
                </>
              )}
              . <Link href="/tasks?scope=mine" className="underline-offset-2 hover:underline">View mine</Link>
            </p>
          )}
        </div>
      </header>

      {/* ── Overdue always comes first ───────────────────────────────── */}
      {d.overdue.length > 0 ? (
        <section aria-labelledby="overdue-h" className="overflow-hidden rounded-xl border border-danger/35 bg-danger-soft/40">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-danger" aria-hidden />
              <h2 id="overdue-h" className="text-sm font-semibold text-danger">
                Overdue · {d.counts.overdue}
              </h2>
              <span className="hidden text-xs text-muted sm:inline">
                {pluralize(d.counts.overdue, "task")} past deadline {scopeWord}
              </span>
            </div>
            <SeeAll href="/tasks?due=overdue" />
          </div>
          {lead ? (
            <div className="space-y-3 px-2 pb-3 pt-1">
              {groupByAssignee(d.overdue).map((g) => (
                <div key={g.id}>
                  <div className="flex items-center gap-2 px-3 pb-0.5 pt-1 text-xs font-medium text-muted">
                    {g.id !== "none" && <Avatar id={g.id} name={g.name} size={18} />}
                    {g.name}
                    <span className="rounded-full bg-danger/15 px-1.5 text-[11px] text-danger">{g.tasks.length}</span>
                  </div>
                  <ul>
                    {g.tasks.slice(0, 5).map((t) => (
                      <TaskListRow key={t.id} task={t} user={user} today={d.today} />
                    ))}
                  </ul>
                  {g.tasks.length > 5 && (
                    <Link
                      href={`/tasks?due=overdue&scope=all${g.id !== "none" ? `&assignee=${g.id}` : "&assignee=unassigned"}`}
                      className="block px-3 py-1 text-xs text-muted hover:text-fg"
                    >
                      + {g.tasks.length - 5} more
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ul className="px-2 pb-3 pt-1">
              {d.overdue.slice(0, 8).map((t) => (
                <TaskListRow key={t.id} task={t} user={user} today={d.today} />
              ))}
              {d.overdue.length > 8 && (
                <li className="px-3 pt-1 text-xs text-muted">
                  <Link href="/tasks?due=overdue" className="hover:text-fg">
                    + {d.overdue.length - 8} more overdue
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-xl border bg-accent-soft px-4 py-3.5">
          <CircleCheckBig className="size-5 text-success" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Nothing overdue.</span>{" "}
            <span className="text-muted">Every deadline {scopeWord} is on track.</span>
          </p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overdue" value={d.counts.overdue} href="/tasks?due=overdue" tone="danger" hint={lead ? "company-wide" : undefined} />
        <StatCard label="Due today" value={d.counts.dueToday} href="/tasks?due=today" tone="warn" />
        <StatCard label="In progress" value={d.counts.inProgress} href="/tasks?status=IN_PROGRESS" />
        <StatCard label="Done this week" value={d.counts.doneWeek} href="/tasks?status=DONE" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card title="Due in the next 7 days" action={<SeeAll href="/tasks?due=week" />}>
            {d.dueSoon.length === 0 ? (
              <div className="px-4 pb-5 pt-2 text-sm text-muted">
                Nothing due this week.{" "}
                <NewTaskButton label="Add a task" className="ml-1 !h-7 !px-2 !text-xs" />
              </div>
            ) : (
              <ul className="px-2 pb-2 pt-1">
                {d.dueSoon.map((t) => (
                  <TaskListRow key={t.id} task={t} user={user} today={d.today} showAssignee={lead} />
                ))}
              </ul>
            )}
          </Card>

          {lead && d.blocked.length > 0 && (
            <Card title={`Blocked · ${d.counts.blocked}`} action={<SeeAll href="/tasks?status=BLOCKED" />}>
              <ul className="px-2 pb-2 pt-1">
                {d.blocked.map((t) => (
                  <TaskListRow key={t.id} task={t} user={user} today={d.today} showAssignee />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          {lead && (
            <Card title="Team workload" action={<SeeAll href="/team">Team</SeeAll>}>
              <WorkloadList rows={d.workload} />
            </Card>
          )}
          <Card title="Momentum">
            <TrendChart data={d.trend} />
          </Card>
          <Card title="Recent activity">
            <RecentActivity items={d.recent} />
          </Card>
        </div>
      </div>
    </div>
  );
}
