import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/constants";
import { dueBucket, type DueBucket } from "@/lib/dates";
import { canChangeStatus } from "@/lib/permissions";
import type { SessionUser, TaskRow } from "@/lib/types";
import { tasksHref } from "@/lib/task-url";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { CommentCount, DueBadge, PriorityDot, TagChips } from "./task-parts";
import { StatusSelect } from "./status-select";

const GROUPS: { key: DueBucket; title: string; tone?: "danger" | "warn" }[] = [
  { key: "overdue", title: "Overdue", tone: "danger" },
  { key: "today", title: "Due today", tone: "warn" },
  { key: "upcoming", title: "Upcoming" },
  { key: "none", title: "No deadline" },
  { key: "done", title: "Completed" },
];

export function TaskTable({
  tasks,
  user,
  today,
  selectedId,
  query,
}: {
  tasks: TaskRow[];
  user: SessionUser;
  today: string;
  selectedId?: string;
  /** Current filter params, used to build links that keep the view state. */
  query: Record<string, string>;
}) {
  const grouped = new Map<DueBucket, TaskRow[]>();
  for (const t of tasks) {
    const b = dueBucket(t.dueDate, t.status, today);
    grouped.set(b, [...(grouped.get(b) ?? []), t]);
  }

  return (
    <div className="space-y-5">
      {GROUPS.filter((g) => grouped.has(g.key)).map((g) => {
        const rows = grouped.get(g.key)!;
        return (
          <details key={g.key} open={g.key !== "done"} className="group/section">
            <summary
              className={cn(
                "flex list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold marker:hidden hover:bg-hover [&::-webkit-details-marker]:hidden",
                g.tone === "danger" && "text-danger",
                g.tone === "warn" && "text-warn",
              )}
            >
              <ChevronDown className="size-4 text-faint transition-transform group-not-open/section:-rotate-90" aria-hidden />
              {g.title}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-medium",
                  g.tone === "danger" ? "bg-danger/15 text-danger" : "bg-hover text-muted",
                )}
              >
                {rows.length}
              </span>
            </summary>

            {/* Column headings (desktop) */}
            <div className="hidden grid-cols-[minmax(0,1fr)_9.5rem_9rem_8.5rem_5.5rem] gap-3 border-b px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint md:grid">
              <span>Task</span>
              <span>Status</span>
              <span>Assignee</span>
              <span>Deadline</span>
              <span>Priority</span>
            </div>

            <ul className="divide-y divide-border/60">
              {rows.map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-hover md:grid-cols-[minmax(0,1fr)_9.5rem_9rem_8.5rem_5.5rem]",
                    t.id === selectedId && "bg-accent-soft",
                    g.key === "overdue" && "border-l-2 border-l-danger",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PriorityDot priority={t.priority} />
                    <Link href={tasksHref(query, { task: t.id })} scroll={false} className="min-w-0 truncate font-medium hover:underline">
                      {t.title}
                    </Link>
                    <CommentCount n={t.commentCount} />
                    <span className="hidden lg:inline">
                      <TagChips tags={t.tags} max={2} hrefFor={(tag) => tasksHref(query, { tag })} />
                    </span>
                  </div>

                  <div className="justify-self-end md:justify-self-start">
                    <StatusSelect
                      taskId={t.id}
                      status={t.status}
                      disabled={!canChangeStatus(user, { assigneeId: t.assignee?.id ?? null, createdById: t.createdById })}
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-3 text-xs md:col-span-1 md:contents">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted md:text-fg">
                      {t.assignee ? (
                        <>
                          <Avatar id={t.assignee.id} name={t.assignee.name} size={20} />
                          <span className="truncate">{t.assignee.id === user.id ? "You" : t.assignee.name}</span>
                        </>
                      ) : (
                        <span className="text-faint">Unassigned</span>
                      )}
                    </span>
                    <DueBadge dueDate={t.dueDate} status={t.status} today={today} />
                    <span className="ml-auto md:ml-0">
                      <Pill tone={PRIORITY_TONE[t.priority]} className="!h-5">
                        {PRIORITY_LABEL[t.priority]}
                      </Pill>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
