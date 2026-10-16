"use client";

import { useOptimistic, useState } from "react";
import Link from "next/link";
import { updateTask } from "@/lib/actions/tasks";
import { STATUS_LABEL, STATUS_TONE, TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { dueBucket } from "@/lib/dates";
import { canChangeStatus } from "@/lib/permissions";
import type { SessionUser, TaskRow } from "@/lib/types";
import { tasksHref } from "@/lib/task-url";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";
import { CommentCount, DueBadge, PriorityDot, TagChips } from "./task-parts";

/** Kanban board. Drag a card to another column to change its status. */
export function TaskBoard({
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
  query: Record<string, string>;
}) {
  const toast = useToast();
  const { run } = useAction();
  const [items, applyMove] = useOptimistic(tasks, (state, move: { id: string; status: TaskStatus }) =>
    state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const mayMove = (t: TaskRow) => canChangeStatus(user, { assigneeId: t.assignee?.id ?? null, createdById: t.createdById });

  function drop(status: TaskStatus) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    const task = items.find((t) => t.id === id);
    if (!id || !task || task.status === status) return;
    if (!mayMove(task)) {
      toast.error("You can only move tasks assigned to you.");
      return;
    }
    run(async () => {
      applyMove({ id, status });
      return updateTask(id, { status });
    }, { success: false });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
      <div className="flex min-w-max gap-3">
        {TASK_STATUSES.map((status) => {
          const col = items.filter((t) => t.status === status);
          return (
            <section
              key={status}
              aria-label={STATUS_LABEL[status]}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(status);
              }}
              className={cn(
                "w-72 shrink-0 rounded-xl bg-subtle p-2 transition-colors",
                over === status && "bg-accent-soft ring-2 ring-accent/40",
              )}
            >
              <header className="flex items-center gap-2 px-2 pb-2 pt-1">
                <Pill tone={STATUS_TONE[status]} dot>
                  {STATUS_LABEL[status]}
                </Pill>
                <span className="text-xs text-muted tabular-nums">{col.length}</span>
              </header>
              <ul className="space-y-2">
                {col.map((t) => {
                  const overdue = dueBucket(t.dueDate, t.status, today) === "overdue";
                  const draggable = mayMove(t);
                  return (
                    <li
                      key={t.id}
                      draggable={draggable}
                      onDragStart={(e) => {
                        setDragId(t.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", t.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={cn(
                        "rounded-lg border bg-bg p-3 shadow-xs transition hover:shadow-pop",
                        draggable && "cursor-grab active:cursor-grabbing",
                        dragId === t.id && "opacity-40",
                        overdue && "border-l-[3px] border-l-danger",
                        t.id === selectedId && "ring-2 ring-accent",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-1.5">
                          <PriorityDot priority={t.priority} />
                        </span>
                        <Link href={tasksHref(query, { task: t.id })} scroll={false} draggable={false} className="flex-1 text-sm font-medium leading-snug hover:underline">
                          {t.title}
                        </Link>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <DueBadge dueDate={t.dueDate} status={t.status} today={today} />
                        <span className="ml-auto flex items-center gap-2">
                          <CommentCount n={t.commentCount} />
                          {t.assignee && <Avatar id={t.assignee.id} name={t.assignee.name} size={22} />}
                        </span>
                      </div>
                      {t.tags.length > 0 && (
                        <div className="mt-2">
                          <TagChips tags={t.tags} max={3} />
                        </div>
                      )}
                    </li>
                  );
                })}
                {col.length === 0 && (
                  <li className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-faint">
                    {dragId ? "Drop here" : "No tasks"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
