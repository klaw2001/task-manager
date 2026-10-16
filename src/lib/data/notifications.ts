import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb, notifications } from "../db";
import type { Database } from "../db/client";
import type { NotificationView } from "../types";

export async function listNotifications(userId: string, limit = 15): Promise<{ items: NotificationView[]; unread: number }> {
  const db = await getDb();
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return {
    unread: n,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      taskId: r.taskId,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

type Notifiable = { userId: string; type: string; title: string; body?: string | null; taskId?: string | null };

/** Insert notifications, skipping the actor so people aren't pinged about their own actions. */
export async function notify(
  db: Pick<Database, "insert">,
  actorId: string | null,
  items: Notifiable[],
) {
  const seen = new Set<string>();
  const rows = items.filter((i) => {
    if (i.userId === actorId) return false;
    const key = `${i.userId}:${i.type}:${i.taskId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (rows.length === 0) return;
  await db.insert(notifications).values(
    rows.map((r) => ({ userId: r.userId, type: r.type, title: r.title, body: r.body ?? null, taskId: r.taskId ?? null })),
  );
}
