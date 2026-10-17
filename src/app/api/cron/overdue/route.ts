import { and, inArray, isNotNull, isNull, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/auth/bearer";
import { getDb, tasks } from "@/lib/db";
import { getCompany } from "@/lib/data/company";
import { notify } from "@/lib/data/notifications";
import { formatYmd, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Daily job (see vercel.json). Tells assignees — and whoever created the task —
 * once when a task slips past its deadline. Idempotent: each task is announced
 * at most once until its due date changes or it's reopened.
 */
export async function GET(req: Request) {
  if (!hasCronSecret(req)) return new NextResponse("Unauthorized", { status: 401 });

  const company = await getCompany();
  if (!company) return NextResponse.json({ ok: true, notified: 0 });

  const db = await getDb();
  const today = todayIn(company.timezone);
  const overdue = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
      createdById: tasks.createdById,
    })
    .from(tasks)
    .where(and(ne(tasks.status, "DONE"), lt(tasks.dueDate, today), isNull(tasks.overdueNotifiedAt), isNotNull(tasks.assigneeId)));

  for (const t of overdue) {
    const body = `Was due ${t.dueDate ? formatYmd(t.dueDate, today) : "earlier"}`;
    await notify(db, null, [
      { userId: t.assigneeId!, type: "overdue", title: `Overdue: ${t.title}`, body, taskId: t.id },
      ...(t.createdById !== t.assigneeId
        ? [{ userId: t.createdById, type: "overdue", title: `Overdue: ${t.title}`, body, taskId: t.id }]
        : []),
    ]);
  }
  if (overdue.length > 0) {
    await db
      .update(tasks)
      .set({ overdueNotifiedAt: new Date() })
      .where(inArray(tasks.id, overdue.map((t) => t.id)));
  }
  return NextResponse.json({ ok: true, notified: overdue.length });
}
