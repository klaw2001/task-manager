"use client";

import { useEffect, useOptimistic, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Flag, Hash, Trash2, UserRound, Workflow, X } from "lucide-react";
import { activityText } from "@/lib/activity-text";
import { addComment, deleteComment, deleteTask, updateTask } from "@/lib/actions/tasks";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/constants";
import { describeDue, relativeTime } from "@/lib/dates";
import type { AssignableUser } from "@/lib/data/users";
import { can, canChangeStatus, canDeleteTask, canEditTask } from "@/lib/permissions";
import type { SessionUser, TaskDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { PillSelect } from "@/components/ui/pill-select";
import { useAction } from "@/components/ui/use-action";

const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));
const PRIORITY_OPTIONS = TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }));

/** Notion-style "side peek": all task properties, description, comments and history. */
export function TaskPeek({
  task,
  user,
  assignees,
  today,
  closeHref,
}: {
  task: TaskDetail;
  user: SessionUser;
  assignees: AssignableUser[];
  today: string;
  closeHref: string;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const lead = can.assignToOthers(user.role);
  const assigneeId = task.assignee?.id ?? null;
  const perms = { assigneeId, createdById: task.createdById };
  const mayEdit = canEditTask(user, perms);
  const mayStatus = canChangeStatus(user, perms);
  const mayDelete = canDeleteTask(user, perms);
  const mayClaim = !lead && !assigneeId;

  const [status, setStatus] = useOptimistic<TaskStatus>(task.status);
  const [priority, setPriority] = useOptimistic<TaskPriority>(task.priority);
  const [assignee, setAssignee] = useOptimistic<string>(assigneeId ?? "");
  const [due, setDue] = useOptimistic<string>(task.dueDate ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("dialog")) router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, closeHref]);

  const save = (patch: Record<string, unknown>, optimistic?: () => void) =>
    run(async () => {
      optimistic?.();
      return updateTask(task.id, patch);
    }, { success: false });

  const dueInfo = describeDue(due || null, status, today);

  return (
    <div className="fixed inset-0 z-40">
      <Link href={closeHref} scroll={false} aria-label="Close task" tabIndex={-1} className="anim-fade-in absolute inset-0 bg-black/30" />
      <aside
        role="dialog"
        aria-label="Task details"
        className="anim-slide-in absolute inset-y-0 right-0 flex w-full flex-col border-l bg-bg shadow-pop sm:w-[min(640px,100vw)]"
      >
        <header className="flex items-center gap-1 border-b px-3 py-2">
          <Link href={closeHref} scroll={false} aria-label="Close" className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
            <X className="size-4" />
          </Link>
          <span className="ml-1 text-xs text-faint" aria-live="polite">
            {pending ? "Saving…" : "Esc to close"}
          </span>
          <div className="flex-1" />
          {mayDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirm(`Delete “${task.title}”? This can't be undone.`)) return;
                run(() => deleteTask(task.id), {
                  onDone: (r) => r.ok && router.push(closeHref, { scroll: false }),
                });
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-5 py-5 sm:px-8">
            {/* Title */}
            <input
              key={task.title}
              defaultValue={task.title}
              disabled={!mayEdit}
              maxLength={160}
              aria-label="Task title"
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (!v) e.currentTarget.value = task.title;
                else if (v !== task.title) save({ title: v });
              }}
              className="-mx-1.5 w-[calc(100%+0.75rem)] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xl font-bold leading-tight tracking-tight hover:border-border focus-visible:border-accent disabled:hover:border-transparent"
            />

            {/* Properties */}
            <dl className="space-y-1">
              <Prop icon={Workflow} label="Status">
                <PillSelect
                  ariaLabel="Status"
                  value={status}
                  options={STATUS_OPTIONS}
                  tone={STATUS_TONE[status]}
                  dot
                  disabled={!mayStatus}
                  onChange={(v) => save({ status: v }, () => setStatus(v as TaskStatus))}
                />
              </Prop>

              <Prop icon={UserRound} label="Assignee">
                {lead ? (
                  <PillSelect
                    ariaLabel="Assignee"
                    value={assignee}
                    options={[{ value: "", label: "Unassigned" }, ...assignees.map((a) => ({ value: a.id, label: a.name }))]}
                    onChange={(v) => save({ assigneeId: v || null }, () => setAssignee(v))}
                  >
                    {assignee ? (
                      <>
                        <Avatar id={assignee} name={assignees.find((a) => a.id === assignee)?.name ?? "?"} size={20} />
                        {assignees.find((a) => a.id === assignee)?.name ?? task.assignee?.name}
                      </>
                    ) : (
                      <span className="text-faint">Unassigned</span>
                    )}
                  </PillSelect>
                ) : mayClaim ? (
                  <Button size="sm" onClick={() => save({ assigneeId: user.id })}>
                    Assign to me
                  </Button>
                ) : task.assignee ? (
                  <span className="inline-flex h-7 items-center gap-2 px-2 text-sm">
                    <Avatar id={task.assignee.id} name={task.assignee.name} size={20} />
                    {task.assignee.name}
                  </span>
                ) : (
                  <span className="px-2 text-sm text-faint">Unassigned</span>
                )}
              </Prop>

              <Prop icon={CalendarDays} label="Deadline">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={due}
                    disabled={!mayEdit}
                    aria-label="Deadline"
                    onChange={(e) => save({ dueDate: e.target.value || null }, () => setDue(e.target.value))}
                    className="h-7 rounded-md border border-transparent bg-transparent px-1.5 text-sm hover:border-border focus-visible:border-accent disabled:hover:border-transparent"
                  />
                  {due && (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        dueInfo.tone === "danger" && "text-danger",
                        dueInfo.tone === "warn" && "text-warn",
                        dueInfo.tone === "muted" && "text-muted",
                      )}
                    >
                      {dueInfo.label}
                    </span>
                  )}
                  {due && mayEdit && (
                    <button
                      onClick={() => save({ dueDate: null }, () => setDue(""))}
                      className="text-xs text-faint hover:text-fg"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </Prop>

              <Prop icon={Flag} label="Priority">
                <PillSelect
                  ariaLabel="Priority"
                  value={priority}
                  options={PRIORITY_OPTIONS}
                  tone={PRIORITY_TONE[priority]}
                  disabled={!mayEdit}
                  onChange={(v) => save({ priority: v }, () => setPriority(v as TaskPriority))}
                />
              </Prop>

              <Prop icon={Hash} label="Tags">
                <input
                  key={task.tags.join(",")}
                  defaultValue={task.tags.join(", ")}
                  disabled={!mayEdit}
                  placeholder={mayEdit ? "Add tags, comma separated" : "No tags"}
                  aria-label="Tags"
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  onBlur={(e) => {
                    const next = e.currentTarget.value;
                    if (next.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean).join(",") !== task.tags.join(",")) {
                      save({ tags: next });
                    }
                  }}
                  className="h-7 w-full rounded-md border border-transparent bg-transparent px-2 text-sm placeholder:text-faint hover:border-border focus-visible:border-accent disabled:hover:border-transparent"
                />
              </Prop>
            </dl>

            <p className="text-xs text-faint">
              Created by {task.createdBy?.name ?? "someone"} ·{" "}
              <span suppressHydrationWarning>{relativeTime(task.createdAt)}</span>
            </p>

            <hr />

            {/* Description */}
            <section aria-label="Description">
              <Textarea
                key={task.updatedAt + task.description.length}
                defaultValue={task.description}
                disabled={!mayEdit}
                placeholder={mayEdit ? "Add a description — context, links, what “done” looks like…" : "No description."}
                className="min-h-36 border-transparent shadow-none hover:border-border"
                onBlur={(e) => {
                  if (e.currentTarget.value !== task.description) save({ description: e.currentTarget.value });
                }}
              />
            </section>

            <hr />

            <Comments task={task} user={user} />

            {task.activity.length > 0 && (
              <details className="group text-sm">
                <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-faint hover:text-muted">
                  Activity ({task.activity.length})
                </summary>
                <ul className="mt-3 space-y-2.5 border-l pl-4">
                  {task.activity.map((a) => (
                    <li key={a.id} className="text-[13px] leading-snug text-muted">
                      <span className="font-medium text-fg">{a.actor?.name ?? "Someone"}</span> {activityText(a.type, a.meta)}
                      <span className="ml-1.5 text-[11px] text-faint" suppressHydrationWarning>
                        {relativeTime(a.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Prop({ icon: Icon, label, children }: { icon: typeof Flag; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2 sm:gap-4">
      <dt className="flex w-24 shrink-0 items-center gap-2 text-sm text-muted sm:w-28">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function Comments({ task, user }: { task: TaskDetail; user: SessionUser }) {
  const { pending, run } = useAction();
  const [body, setBody] = useState("");
  const listEnd = useRef<HTMLDivElement>(null);
  const seen = useRef(task.comments.length);

  // Scroll to the newest comment when one is added.
  useEffect(() => {
    if (task.comments.length > seen.current) listEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    seen.current = task.comments.length;
  }, [task.comments.length]);

  function submit() {
    const text = body.trim();
    if (!text) return;
    run(() => addComment(task.id, { body: text }), {
      success: false,
      onDone: (r) => r.ok && setBody(""),
    });
  }

  return (
    <section aria-label="Comments" className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Comments ({task.comments.length})</h3>
      {task.comments.length > 0 && (
        <ul className="space-y-4">
          {task.comments.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Avatar id={c.author?.id ?? c.id} name={c.author?.name ?? "?"} size={28} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{c.author?.name ?? "Former member"}</span>
                  <span className="text-xs text-faint" suppressHydrationWarning>
                    {relativeTime(c.createdAt)}
                  </span>
                  {(c.author?.id === user.id || user.role === "ADMIN") && (
                    <button
                      onClick={() => confirm("Delete this comment?") && run(() => deleteComment(c.id), { success: false })}
                      className="ml-auto text-xs text-faint opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  )}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div ref={listEnd} />
      <div className="flex gap-3">
        <Avatar id={user.id} name={user.name} size={28} className="mt-1" />
        <div className="flex-1 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…  (⌘/Ctrl + Enter to send)"
            aria-label="Write a comment"
            maxLength={4000}
            className="min-h-16"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex justify-end">
            <Button variant="primary" size="sm" disabled={pending || !body.trim()} onClick={submit}>
              {pending ? "Sending…" : "Comment"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
