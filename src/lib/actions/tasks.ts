"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { activities, comments, getDb, tasks, users } from "../db";
import type { Database } from "../db/client";
import { requireUser } from "../auth/session";
import { getCompany } from "../data/company";
import { notify } from "../data/notifications";
import { queueAssignmentEmail } from "../email/assignment";
import { AppError, ForbiddenError } from "../errors";
import { can, canChangeStatus, canDeleteTask, canEditTask, canViewTask } from "../permissions";
import { commentSchema, taskCreateSchema, taskPatchSchema } from "../validation";
import { STATUS_LABEL, type TaskStatus } from "../constants";
import { formatYmd } from "../dates";
import type { ActionResult, SessionUser } from "../types";
import { run } from "./helpers";

function refresh() {
  // Dashboard, task views and the sidebar overdue badge all derive from tasks.
  revalidatePath("/", "layout");
}

async function loadCompany() {
  const c = await getCompany();
  if (!c) throw new AppError("Workspace isn't set up yet.");
  return c;
}

/** Returns the assignee's name, or throws if they don't exist / are deactivated. */
async function assignableName(db: Pick<Database, "select">, assigneeId: string): Promise<string> {
  const [u] = await db.select({ name: users.name, active: users.active }).from(users).where(eq(users.id, assigneeId)).limit(1);
  if (!u || !u.active) throw new AppError("That person can't be assigned tasks.", { assigneeId: "Pick an active team member" });
  return u.name;
}

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await requireUser();
    const d = taskCreateSchema.parse(input);
    const db = await getDb();

    // Members can only create tasks for themselves; leads can assign to anyone.
    let assigneeId = d.assigneeId ?? null;
    if (!can.assignToOthers(user.role)) assigneeId = user.id;
    if (assigneeId) await assignableName(db, assigneeId);

    const id = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(tasks)
        .values({
          title: d.title,
          description: d.description,
          status: d.status,
          priority: d.priority,
          dueDate: d.dueDate ?? null,
          assigneeId,
          createdById: user.id,
          tags: d.tags ?? [],
          completedAt: d.status === "DONE" ? new Date() : null,
        })
        .returning({ id: tasks.id });
      await tx.insert(activities).values({ taskId: t.id, actorId: user.id, type: "created" });
      if (assigneeId) {
        await notify(tx, user.id, [
          {
            userId: assigneeId,
            type: "assigned",
            title: `${user.name} assigned you a task`,
            body: d.title + (d.dueDate ? ` · due ${formatYmd(d.dueDate)}` : ""),
            taskId: t.id,
          },
        ]);
      }
      return t.id;
    });
    if (assigneeId) queueAssignmentEmail({ taskId: id, assigneeId, actor: user });
    refresh();
    return { id };
  }, "Task created");
}

export async function updateTask(id: string, patch: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser();
    const company = await loadCompany();
    const input = taskPatchSchema.parse(patch);
    const db = await getDb();
    let newAssigneeId = null as string | null; // set inside the transaction callback

    await db.transaction(async (tx) => {
      const [t] = await tx.select().from(tasks).where(eq(tasks.id, id)).limit(1);
      if (!t || !canViewTask(user, t, company.memberVisibility)) throw new AppError("Task not found.");

      const touchesContent =
        input.title !== undefined ||
        input.description !== undefined ||
        input.priority !== undefined ||
        input.dueDate !== undefined ||
        input.tags !== undefined;
      if (touchesContent && !canEditTask(user, t)) throw new ForbiddenError("Only the creator or a manager can edit this task.");
      if (input.status !== undefined && !canChangeStatus(user, t)) throw new ForbiddenError("You can only update tasks assigned to you.");

      const set: Partial<typeof tasks.$inferInsert> = {};
      const log: { type: string; meta?: Record<string, unknown> }[] = [];
      const alerts: Parameters<typeof notify>[2] = [];
      const taskTitle = input.title ?? t.title;

      if (input.title !== undefined && input.title !== t.title) {
        set.title = input.title;
        log.push({ type: "title", meta: { from: t.title, to: input.title } });
      }
      if (input.description !== undefined && input.description !== t.description) {
        set.description = input.description;
        log.push({ type: "description" });
      }
      if (input.priority !== undefined && input.priority !== t.priority) {
        set.priority = input.priority;
        log.push({ type: "priority", meta: { from: t.priority, to: input.priority } });
      }
      if (input.tags !== undefined && input.tags.join(",") !== t.tags.join(",")) {
        set.tags = input.tags;
        log.push({ type: "tags", meta: { to: input.tags } });
      }
      if (input.dueDate !== undefined && (input.dueDate ?? null) !== t.dueDate) {
        set.dueDate = input.dueDate ?? null;
        set.overdueNotifiedAt = null;
        log.push({ type: "due", meta: { from: t.dueDate, to: input.dueDate ?? null } });
        if (t.assigneeId) {
          alerts.push({
            userId: t.assigneeId,
            type: "due",
            title: `${user.name} changed a deadline`,
            body: `${taskTitle} → ${input.dueDate ? formatYmd(input.dueDate) : "no deadline"}`,
            taskId: t.id,
          });
        }
      }

      if (input.assigneeId !== undefined && (input.assigneeId ?? null) !== t.assigneeId) {
        const next = input.assigneeId ?? null;
        // Leads reassign freely; anyone may claim an unassigned task for themselves.
        const claiming = t.assigneeId === null && next === user.id;
        if (!can.assignToOthers(user.role) && !claiming) throw new ForbiddenError("Only managers can reassign tasks.");
        const nextName = next ? await assignableName(tx, next) : null;
        let prevName: string | null = null;
        if (t.assigneeId) {
          const [p] = await tx.select({ name: users.name }).from(users).where(eq(users.id, t.assigneeId)).limit(1);
          prevName = p?.name ?? null;
        }
        set.assigneeId = next;
        log.push({ type: "assignee", meta: { from: prevName, to: nextName } });
        if (next) {
          newAssigneeId = next;
          alerts.push({
            userId: next,
            type: "assigned",
            title: `${user.name} assigned you a task`,
            body: taskTitle,
            taskId: t.id,
          });
        }
      }

      if (input.status !== undefined && input.status !== t.status) {
        set.status = input.status;
        if (input.status === "DONE") set.completedAt = new Date();
        else if (t.status === "DONE") {
          set.completedAt = null;
          set.overdueNotifiedAt = null;
        }
        log.push({ type: "status", meta: { from: t.status, to: input.status } });
        const label = STATUS_LABEL[input.status as TaskStatus];
        for (const userId of [t.assigneeId, t.createdById]) {
          if (userId) {
            alerts.push({
              userId,
              type: "status",
              title: `${user.name} moved a task to ${label}`,
              body: taskTitle,
              taskId: t.id,
            });
          }
        }
      }

      if (log.length === 0) return;
      set.updatedAt = new Date();
      await tx.update(tasks).set(set).where(eq(tasks.id, id));
      await tx.insert(activities).values(log.map((l) => ({ taskId: id, actorId: user.id, type: l.type, meta: l.meta ?? null })));
      await notify(tx, user.id, alerts);
    });

    if (newAssigneeId) queueAssignmentEmail({ taskId: id, assigneeId: newAssigneeId, actor: user });
    refresh();
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser();
    const company = await loadCompany();
    const db = await getDb();
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!t || !canViewTask(user, t, company.memberVisibility)) throw new AppError("Task not found.");
    if (!canDeleteTask(user, t)) throw new ForbiddenError("Only the creator or a manager can delete this task.");
    await db.delete(tasks).where(eq(tasks.id, id));
    refresh();
  }, "Task deleted");
}

async function viewableTask(user: SessionUser, taskId: string) {
  const company = await loadCompany();
  const db = await getDb();
  const [t] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!t || !canViewTask(user, t, company.memberVisibility)) throw new AppError("Task not found.");
  return { db, t };
}

export async function addComment(taskId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser();
    const { body } = commentSchema.parse(input);
    const { db, t } = await viewableTask(user, taskId);

    await db.transaction(async (tx) => {
      await tx.insert(comments).values({ taskId, authorId: user.id, body });
      await tx.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, taskId));
      await notify(
        tx,
        user.id,
        [t.assigneeId, t.createdById]
          .filter((v): v is string => !!v)
          .map((userId) => ({
            userId,
            type: "comment",
            title: `${user.name} commented on “${t.title}”`,
            body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
            taskId,
          })),
      );
    });
    refresh();
  });
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const [c] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!c) throw new AppError("Comment not found.");
    await viewableTask(user, c.taskId);
    if (c.authorId !== user.id && user.role !== "ADMIN") throw new ForbiddenError("You can only delete your own comments.");
    await db.delete(comments).where(and(eq(comments.id, commentId)));
    refresh();
  });
}
