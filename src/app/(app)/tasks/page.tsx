import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheckBig, Inbox, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/data/company";
import {
  countOverdueInScope,
  getTaskDetail,
  listTagsInUse,
  listTasks,
  parseFilters,
} from "@/lib/data/tasks";
import { listAssignableUsers } from "@/lib/data/users";
import { todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { tasksHref } from "@/lib/task-url";
import { pluralize } from "@/lib/utils";
import { NewTaskButton } from "@/components/tasks/new-task";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskPeek } from "@/components/tasks/task-peek";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskToolbar } from "@/components/tasks/task-toolbar";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const company = await getCompany();
  if (!company) redirect("/setup");

  const sp = await searchParams;
  const { filters, view, raw } = parseFilters(sp, user, company);
  const taskParam = Array.isArray(sp.task) ? sp.task[0] : sp.task;
  const today = todayIn(company.timezone);

  const [tasks, assignees, tags, detail, overdueInScope] = await Promise.all([
    listTasks(user, company, filters, { view }),
    listAssignableUsers(),
    listTagsInUse(user, company),
    taskParam ? getTaskDetail(user, company, taskParam) : Promise.resolve(null),
    countOverdueInScope(user, company, filters.scope),
  ]);

  const lead = can.viewWorkload(user.role);
  const canSeeAll = can.viewAllTasks(user.role, company.memberVisibility);
  const showingOverdueOnly = filters.due === "overdue";
  const filtered = filters.status !== "active" || filters.assignee || filters.priority || filters.due || filters.tag || filters.q;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted">
            {pluralize(tasks.length, "task")}
            {filters.scope === "mine" ? " assigned to you" : lead ? " across the company" : ""}
            {tasks.length >= 500 && " (showing the first 500)"}
          </p>
        </div>
      </header>

      {/* Overdue is surfaced before anything else, whatever view you're in. */}
      {overdueInScope > 0 && !showingOverdueOnly && (
        <Link
          href={tasksHref(raw, { due: "overdue", status: "active" })}
          className="flex items-center gap-3 rounded-xl border border-danger/35 bg-danger-soft/50 px-4 py-2.5 text-sm hover:bg-danger-soft"
        >
          <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden />
          <span className="flex-1">
            <span className="font-semibold text-danger">{pluralize(overdueInScope, "overdue task")}</span>{" "}
            <span className="text-muted">
              {filters.scope === "mine" ? "need your attention" : "across the team"} — overdue work is listed first.
            </span>
          </span>
          <span className="text-xs font-medium text-danger">Show only overdue →</span>
        </Link>
      )}

      <TaskToolbar
        filters={filters}
        view={view}
        assignees={assignees}
        tags={tags}
        canSeeAll={canSeeAll}
        lead={lead}
        userId={user.id}
      />

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          {showingOverdueOnly ? (
            <CircleCheckBig className="size-8 text-success" />
          ) : (
            <Inbox className="size-8 text-faint" />
          )}
          <div>
            <p className="font-semibold">
              {showingOverdueOnly ? "Nothing overdue" : filtered ? "No tasks match these filters" : "No tasks yet"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {filtered
                ? "Try clearing a filter or searching for something else."
                : lead
                  ? "Create the first task and assign it to someone on your team."
                  : "When a task is assigned to you, it will show up here."}
            </p>
          </div>
          {!filtered && <NewTaskButton label={lead ? "Create a task" : "Add a task for yourself"} />}
        </div>
      ) : view === "board" ? (
        <TaskBoard tasks={tasks} user={user} today={today} selectedId={detail?.id} query={raw} />
      ) : (
        <TaskTable tasks={tasks} user={user} today={today} selectedId={detail?.id} query={raw} />
      )}

      {detail && (
        <TaskPeek
          key={detail.id}
          task={detail}
          user={user}
          assignees={assignees}
          today={today}
          closeHref={tasksHref(raw, { task: null })}
        />
      )}
    </div>
  );
}
