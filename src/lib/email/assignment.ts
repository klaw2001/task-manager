import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { getDb, tasks, users } from "../db";
import { getCompany } from "../data/company";
import { PRIORITY_LABEL } from "../constants";
import { formatYmd, todayIn } from "../dates";
import { appBaseUrl, readEmailConfig } from "./config";
import { assignmentEmail } from "./templates";
import { sendEmail } from "./transport";

let warned = false;

/**
 * Emails the new assignee once the response has gone out (so a slow or failing mail server never
 * delays or fails the action). Like in-app notifications, nobody is emailed about their own action.
 */
export function queueAssignmentEmail(opts: { taskId: string; assigneeId: string; actor: { id: string; name: string } }) {
  const { taskId, assigneeId, actor } = opts;
  if (assigneeId === actor.id) return;
  if (!readEmailConfig()) {
    if (!warned) {
      warned = true;
      console.info("[email] Brevo SMTP isn't configured (BREVO_SMTP_LOGIN, BREVO_SMTP_KEY, EMAIL_FROM) — assignment emails are off.");
    }
    return;
  }

  after(async () => {
    try {
      const db = await getDb();
      const [[row], company, h] = await Promise.all([
        db
          .select({
            title: tasks.title,
            description: tasks.description,
            priority: tasks.priority,
            dueDate: tasks.dueDate,
            currentAssigneeId: tasks.assigneeId,
            email: users.email,
            name: users.name,
            active: users.active,
          })
          .from(tasks)
          .innerJoin(users, eq(users.id, assigneeId))
          .where(eq(tasks.id, taskId))
          .limit(1),
        getCompany(),
        headers(),
      ]);
      // Reassigned again (or the person deactivated) between the action and now: don't email a stale assignee.
      if (!row || !company || !row.active || row.currentAssigneeId !== assigneeId) return;

      const base = appBaseUrl(process.env, { host: h.get("x-forwarded-host") ?? h.get("host"), proto: h.get("x-forwarded-proto") });
      const mail = assignmentEmail({
        companyName: company.name,
        accentColor: company.accentColor,
        assigneeName: row.name,
        assignerName: actor.name,
        task: {
          title: row.title,
          description: row.description,
          priorityLabel: PRIORITY_LABEL[row.priority],
          dueLabel: row.dueDate ? formatYmd(row.dueDate, todayIn(company.timezone)) : null,
        },
        url: base ? `${base}/tasks?task=${taskId}` : null,
      });
      await sendEmail({ to: { name: row.name, address: row.email }, ...mail });
    } catch (err) {
      console.error("[email] couldn't send assignment email", err);
    }
  });
}
