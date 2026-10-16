import "server-only";
import { and, desc, eq, ne, sql, type SQL } from "drizzle-orm";
import { activities, getDb, tasks, users } from "../db";
import { addDays, todayIn } from "../dates";
import { can } from "../permissions";
import type { ActivityView, CompanyView, SessionUser, TaskRow } from "../types";
import { listTasks, visibleWhere } from "./tasks";

export type DashboardData = {
  today: string;
  /** "company" = leads see everything; "mine" = members see their own work. */
  scope: "company" | "mine";
  counts: { overdue: number; dueToday: number; open: number; inProgress: number; blocked: number; doneWeek: number };
  myCounts: { open: number; overdue: number } | null;
  overdue: TaskRow[];
  dueSoon: TaskRow[];
  blocked: TaskRow[];
  trend: { day: string; count: number }[];
  workload: { id: string; name: string; jobTitle: string | null; open: number; overdue: number; doneWeek: number }[];
  recent: (ActivityView & { taskId: string; taskTitle: string })[];
};

export async function getDashboard(user: SessionUser, company: CompanyView): Promise<DashboardData> {
  const db = await getDb();
  const today = todayIn(company.timezone);
  const lead = can.viewWorkload(user.role);
  const scope: DashboardData["scope"] = lead ? "company" : "mine";

  const base: (SQL | undefined)[] = [visibleWhere(user, company.memberVisibility)];
  if (!lead) base.push(eq(tasks.assigneeId, user.id));
  const where = and(...base);

  const open = ne(tasks.status, "DONE");
  const listFilters = { scope: lead ? ("all" as const) : ("mine" as const), status: "active" as const };

  const [[counts], myCountsRow, overdue, dueSoon, blocked, trendRows, workload, recent] = await Promise.all([
    db
      .select({
        overdue: sql<number>`count(*) filter (where ${open} and ${tasks.dueDate} < ${today}::date)::int`,
        dueToday: sql<number>`count(*) filter (where ${open} and ${tasks.dueDate} = ${today}::date)::int`,
        open: sql<number>`count(*) filter (where ${open})::int`,
        inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'IN_PROGRESS')::int`,
        blocked: sql<number>`count(*) filter (where ${tasks.status} = 'BLOCKED')::int`,
        doneWeek: sql<number>`count(*) filter (where ${tasks.status} = 'DONE' and ${tasks.completedAt} >= now() - interval '7 days')::int`,
      })
      .from(tasks)
      .where(where),
    lead
      ? db
          .select({
            open: sql<number>`count(*) filter (where ${open})::int`,
            overdue: sql<number>`count(*) filter (where ${open} and ${tasks.dueDate} < ${today}::date)::int`,
          })
          .from(tasks)
          .where(eq(tasks.assigneeId, user.id))
      : Promise.resolve(null),
    listTasks(user, company, { ...listFilters, due: "overdue" }, { limit: 60 }),
    listTasks(user, company, { ...listFilters, due: "week" }, { limit: 12 }),
    lead ? listTasks(user, company, { ...listFilters, status: "BLOCKED" }, { limit: 6 }) : Promise.resolve([]),
    db
      .select({
        day: sql<string>`to_char(timezone(${company.timezone}, ${tasks.completedAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(and(where, eq(tasks.status, "DONE"), sql`${tasks.completedAt} >= now() - interval '16 days'`))
      .groupBy(sql`1`),
    lead
      ? db
          .select({
            id: users.id,
            name: users.name,
            jobTitle: users.jobTitle,
            open: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'DONE')::int`,
            overdue: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'DONE' and ${tasks.dueDate} < ${today}::date)::int`,
            doneWeek: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'DONE' and ${tasks.completedAt} >= now() - interval '7 days')::int`,
          })
          .from(users)
          .leftJoin(tasks, eq(tasks.assigneeId, users.id))
          .where(eq(users.active, true))
          .groupBy(users.id)
      : Promise.resolve([]),
    db
      .select({
        id: activities.id,
        type: activities.type,
        meta: activities.meta,
        createdAt: activities.createdAt,
        taskId: tasks.id,
        taskTitle: tasks.title,
        actorId: users.id,
        actorName: users.name,
      })
      .from(activities)
      .innerJoin(tasks, eq(activities.taskId, tasks.id))
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(and(visibleWhere(user, company.memberVisibility), ne(activities.type, "comment")))
      .orderBy(desc(activities.createdAt))
      .limit(10),
  ]);

  const byDay = new Map(trendRows.map((r) => [r.day, r.count]));
  const trend = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i - 13);
    return { day, count: byDay.get(day) ?? 0 };
  });

  return {
    today,
    scope,
    counts,
    myCounts: myCountsRow ? myCountsRow[0] : null,
    overdue,
    dueSoon,
    blocked,
    trend,
    workload: [...workload].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name)),
    recent: recent.map((a) => ({
      id: a.id,
      type: a.type,
      meta: a.meta,
      createdAt: a.createdAt.toISOString(),
      actor: a.actorId ? { id: a.actorId, name: a.actorName ?? "Unknown" } : null,
      taskId: a.taskId,
      taskTitle: a.taskTitle,
    })),
  };
}
