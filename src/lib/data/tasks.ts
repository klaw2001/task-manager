import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gte, ilike, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { activities, comments, getDb, tasks, users } from "../db";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type MemberVisibility,
  type TaskPriority,
  type TaskStatus,
} from "../constants";
import { addDays, todayIn } from "../dates";
import { can, canViewTask } from "../permissions";
import type { ActivityView, CommentView, CompanyView, SessionUser, TaskDetail, TaskRow } from "../types";

const assignee = alias(users, "assignee");

const rowColumns = {
  id: tasks.id,
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  tags: tasks.tags,
  createdById: tasks.createdById,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  aId: assignee.id,
  aName: assignee.name,
  aEmail: assignee.email,
  aRole: assignee.role,
  aJobTitle: assignee.jobTitle,
  aActive: assignee.active,
  commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.taskId} = ${tasks.id})`,
};

type RawRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  tags: string[];
  createdById: string;
  completedAt: Date | null;
  createdAt: Date;
  aId: string | null;
  aName: string | null;
  aEmail: string | null;
  aRole: SessionUser["role"] | null;
  aJobTitle: string | null;
  aActive: boolean | null;
  commentCount: number;
};

function toRow(r: RawRow): TaskRow {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    dueDate: r.dueDate,
    tags: r.tags,
    createdById: r.createdById,
    commentCount: r.commentCount,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    assignee: r.aId
      ? {
          id: r.aId,
          name: r.aName ?? "Unknown",
          email: r.aEmail ?? "",
          role: r.aRole ?? "MEMBER",
          jobTitle: r.aJobTitle,
          active: r.aActive ?? true,
        }
      : null,
  };
}

/** Restrict what a user may see, according to their role and the company setting. */
export function visibleWhere(user: SessionUser, visibility: MemberVisibility): SQL | undefined {
  if (can.viewAllTasks(user.role, visibility)) return undefined;
  return or(eq(tasks.assigneeId, user.id), eq(tasks.createdById, user.id));
}

export type TaskFilters = {
  scope: "mine" | "all";
  q?: string;
  status: "active" | "all" | TaskStatus;
  assignee?: string; // uuid | "unassigned"
  priority?: TaskPriority;
  due?: "overdue" | "today" | "week" | "none";
  tag?: string;
};

export type TaskView = "table" | "board";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse untrusted search params into safe filters. */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
  user: SessionUser,
  company: CompanyView,
): { filters: TaskFilters; view: TaskView; raw: Record<string, string> } {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const canSeeAll = can.viewAllTasks(user.role, company.memberVisibility);
  const defaultScope = can.viewWorkload(user.role) ? "all" : "mine";
  let scope = (one("scope") as "mine" | "all" | undefined) ?? defaultScope;
  if (scope !== "mine" && scope !== "all") scope = defaultScope;
  if (scope === "all" && !canSeeAll) scope = "mine";

  const statusParam = one("status");
  const status: TaskFilters["status"] =
    statusParam === "all" || (TASK_STATUSES as readonly string[]).includes(statusParam ?? "")
      ? (statusParam as TaskFilters["status"])
      : "active";

  const assigneeParam = one("assignee");
  const assignee = assigneeParam === "unassigned" || (assigneeParam && uuidRe.test(assigneeParam)) ? assigneeParam : undefined;

  const priorityParam = one("priority");
  const priority = (TASK_PRIORITIES as readonly string[]).includes(priorityParam ?? "")
    ? (priorityParam as TaskPriority)
    : undefined;

  const dueParam = one("due");
  const due = (["overdue", "today", "week", "none"] as const).find((d) => d === dueParam);

  const tag = one("tag")?.toLowerCase().slice(0, 24);
  const q = one("q")?.slice(0, 100);
  const view: TaskView = one("view") === "board" ? "board" : "table";

  const filters: TaskFilters = { scope, status, assignee, priority, due, tag, q };
  const raw: Record<string, string> = { view, scope, status };
  if (assignee) raw.assignee = assignee;
  if (priority) raw.priority = priority;
  if (due) raw.due = due;
  if (tag) raw.tag = tag;
  if (q) raw.q = q;
  return { filters, view, raw };
}

export async function listTasks(
  user: SessionUser,
  company: CompanyView,
  filters: TaskFilters,
  opts: { view?: TaskView; limit?: number } = {},
): Promise<TaskRow[]> {
  const db = await getDb();
  const today = todayIn(company.timezone);
  const conds: (SQL | undefined)[] = [visibleWhere(user, company.memberVisibility)];

  if (filters.scope === "mine") conds.push(eq(tasks.assigneeId, user.id));

  if (filters.status === "active") {
    if (opts.view === "board") {
      // Board keeps the Done column useful without growing forever.
      conds.push(or(ne(tasks.status, "DONE"), gte(tasks.completedAt, sql`now() - interval '14 days'`)));
    } else {
      conds.push(ne(tasks.status, "DONE"));
    }
  } else if (filters.status !== "all") {
    conds.push(eq(tasks.status, filters.status));
  }

  if (filters.assignee === "unassigned") conds.push(isNull(tasks.assigneeId));
  else if (filters.assignee) conds.push(eq(tasks.assigneeId, filters.assignee));

  if (filters.priority) conds.push(eq(tasks.priority, filters.priority));

  switch (filters.due) {
    case "overdue":
      conds.push(and(ne(tasks.status, "DONE"), lt(tasks.dueDate, today)));
      break;
    case "today":
      conds.push(and(ne(tasks.status, "DONE"), eq(tasks.dueDate, today)));
      break;
    case "week":
      conds.push(
        and(
          ne(tasks.status, "DONE"),
          gte(tasks.dueDate, today),
          sql`${tasks.dueDate} <= ${addDays(today, 7)}::date`,
        ),
      );
      break;
    case "none":
      conds.push(isNull(tasks.dueDate));
      break;
  }

  if (filters.tag) conds.push(sql`${filters.tag} = any(${tasks.tags})`);
  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    conds.push(or(ilike(tasks.title, like), ilike(tasks.description, like)));
  }

  // Overdue first, then due today, upcoming, undated, and finished work last.
  const bucket = sql`case
    when ${tasks.status} = 'DONE' then 4
    when ${tasks.dueDate} is null then 3
    when ${tasks.dueDate} < ${today}::date then 0
    when ${tasks.dueDate} = ${today}::date then 1
    else 2 end`;

  const rows = await db
    .select(rowColumns)
    .from(tasks)
    .leftJoin(assignee, eq(tasks.assigneeId, assignee.id))
    .where(and(...conds))
    .orderBy(bucket, asc(tasks.dueDate), desc(tasks.priority), desc(tasks.createdAt))
    .limit(opts.limit ?? 500);

  return rows.map(toRow);
}

export async function getTaskDetail(
  user: SessionUser,
  company: CompanyView,
  id: string,
): Promise<TaskDetail | null> {
  if (!uuidRe.test(id)) return null;
  const db = await getDb();

  const creator = alias(users, "creator");
  const [row] = await db
    .select({
      ...rowColumns,
      description: tasks.description,
      updatedAt: tasks.updatedAt,
      assigneeId: tasks.assigneeId,
      creatorName: creator.name,
    })
    .from(tasks)
    .leftJoin(assignee, eq(tasks.assigneeId, assignee.id))
    .leftJoin(creator, eq(tasks.createdById, creator.id))
    .where(eq(tasks.id, id))
    .limit(1);
  if (!row) return null;
  if (!canViewTask(user, { assigneeId: row.assigneeId, createdById: row.createdById }, company.memberVisibility)) {
    return null;
  }

  const [commentRows, activityRows] = await Promise.all([
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
        authorId: users.id,
        authorName: users.name,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.taskId, id))
      .orderBy(asc(comments.createdAt)),
    db
      .select({
        id: activities.id,
        type: activities.type,
        meta: activities.meta,
        createdAt: activities.createdAt,
        actorId: users.id,
        actorName: users.name,
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(and(eq(activities.taskId, id), ne(activities.type, "comment")))
      .orderBy(desc(activities.createdAt))
      .limit(40),
  ]);

  const commentViews: CommentView[] = commentRows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    author: c.authorId ? { id: c.authorId, name: c.authorName ?? "Unknown" } : null,
  }));
  const activityViews: ActivityView[] = activityRows.map((a) => ({
    id: a.id,
    type: a.type,
    meta: a.meta,
    createdAt: a.createdAt.toISOString(),
    actor: a.actorId ? { id: a.actorId, name: a.actorName ?? "Unknown" } : null,
  }));

  return {
    ...toRow(row),
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
    createdBy: { id: row.createdById, name: row.creatorName ?? "Unknown" },
    comments: commentViews,
    activity: activityViews,
  };
}

/** Distinct tags across the tasks this user can see (for the filter dropdown). */
export async function listTagsInUse(user: SessionUser, company: CompanyView): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ tag: sql<string>`unnest(${tasks.tags})` })
    .from(tasks)
    .where(visibleWhere(user, company.memberVisibility))
    .limit(200);
  return rows.map((r) => r.tag).sort();
}

export async function overdueCountFor(user: SessionUser, company: CompanyView): Promise<number> {
  const db = await getDb();
  const today = todayIn(company.timezone);
  // Sidebar badge: members see their own; leads see company-wide.
  const scope = can.viewWorkload(user.role) ? undefined : eq(tasks.assigneeId, user.id);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(scope, ne(tasks.status, "DONE"), lt(tasks.dueDate, today)));
  return n;
}

/** Overdue tasks within the scope the user is currently looking at (for the banner on /tasks). */
export async function countOverdueInScope(
  user: SessionUser,
  company: CompanyView,
  scope: "mine" | "all",
): Promise<number> {
  const db = await getDb();
  const today = todayIn(company.timezone);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        visibleWhere(user, company.memberVisibility),
        scope === "mine" ? eq(tasks.assigneeId, user.id) : undefined,
        ne(tasks.status, "DONE"),
        lt(tasks.dueDate, today),
      ),
    );
  return n;
}
