// Sample workspace content. Shared by the optional "Start with sample data"
// checkbox on /setup and by `npm run db:seed`. No server-only import so the
// seed script can use it.
import bcrypt from "bcryptjs";
import { addDays, todayIn } from "../dates";
import type { Database } from "./client";
import { activities, comments, notifications, tasks, teams, users } from "./schema";
import type { TaskPriority, TaskStatus } from "../constants";

type Key = "alex" | "maya" | "jordan" | "sam" | "priya" | null;

const PEOPLE = [
  { key: "maya", name: "Maya Patel", email: "maya@example.com", role: "MANAGER", title: "Head of Product", team: "Leadership" },
  { key: "jordan", name: "Jordan Lee", email: "jordan@example.com", role: "MEMBER", title: "Senior Engineer", team: "Engineering" },
  { key: "sam", name: "Sam Rivera", email: "sam@example.com", role: "MEMBER", title: "Product Designer", team: "Design" },
  { key: "priya", name: "Priya Shah", email: "priya@example.com", role: "MEMBER", title: "Marketing Lead", team: "Growth" },
] as const;

type SampleTask = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: number | null;
  who: Key;
  tags?: string[];
  description?: string;
  doneDaysAgo?: number;
};

const TASKS: SampleTask[] = [
  { title: "Migrate image uploads to object storage", status: "TODO", priority: "HIGH", due: -9, who: "jordan", tags: ["infra"], description: "Move user uploads off local disk so we can scale horizontally.\n\n- Pick a bucket layout\n- Backfill existing files\n- Switch the upload endpoint" },
  { title: "Fix checkout timeout on slow networks", status: "IN_PROGRESS", priority: "URGENT", due: -3, who: "jordan", tags: ["bug", "checkout"], description: "Customers on 3G see a spinner for 30s then an error. Repro steps in the support thread." },
  { title: "Add rate limiting to the public API", status: "IN_REVIEW", priority: "HIGH", due: 1, who: "jordan", tags: ["api", "security"] },
  { title: "Write postmortem for Tuesday's outage", status: "BLOCKED", priority: "MEDIUM", due: 2, who: "jordan", tags: ["docs"], description: "Blocked on the logs export from our hosting provider." },
  { title: "Upgrade CI to Node 22", status: "DONE", priority: "MEDIUM", due: -4, who: "jordan", tags: ["infra"], doneDaysAgo: 3 },
  { title: "Redesign onboarding flow (v2)", status: "IN_PROGRESS", priority: "HIGH", due: -1, who: "sam", tags: ["design", "onboarding"], description: "Cut the steps from 7 to 4. Test with five new users before hand-off." },
  { title: "Update brand guidelines PDF", status: "TODO", priority: "MEDIUM", due: -2, who: "sam", tags: ["brand"] },
  { title: "Design review: pricing page", status: "IN_REVIEW", priority: "MEDIUM", due: 0, who: "sam", tags: ["design", "pricing"] },
  { title: "Icon set refresh", status: "TODO", priority: "LOW", due: 12, who: "sam", tags: ["design"] },
  { title: "Create dark mode palette", status: "DONE", priority: "MEDIUM", due: -6, who: "sam", tags: ["design"], doneDaysAgo: 5 },
  { title: "Q4 launch email sequence", status: "IN_PROGRESS", priority: "URGENT", due: -5, who: "priya", tags: ["email", "launch"], description: "Three emails: teaser, launch day, follow-up. Copy is drafted, needs design + scheduling." },
  { title: "Publish case study: Acme Corp", status: "TODO", priority: "MEDIUM", due: 5, who: "priya", tags: ["content"] },
  { title: "Plan partner webinar", status: "TODO", priority: "HIGH", due: 9, who: "priya", tags: ["events"] },
  { title: "Refresh SEO landing pages", status: "DONE", priority: "LOW", due: -1, who: "priya", tags: ["content"], doneDaysAgo: 1 },
  { title: "Collect testimonials from top 10 customers", status: "TODO", priority: "MEDIUM", due: null, who: "priya", tags: ["content"] },
  { title: "Finalize Q4 roadmap", status: "IN_PROGRESS", priority: "HIGH", due: 0, who: "maya", tags: ["planning"] },
  { title: "Customer interviews — round 3", status: "TODO", priority: "MEDIUM", due: 3, who: "maya", tags: ["research"] },
  { title: "Hire: senior backend engineer", status: "IN_PROGRESS", priority: "HIGH", due: 10, who: "maya", tags: ["hiring"] },
  { title: "Board update — October", status: "TODO", priority: "URGENT", due: -2, who: "alex", tags: ["board"] },
  { title: "Review annual budget with finance", status: "TODO", priority: "HIGH", due: 4, who: "alex", tags: ["finance"] },
  { title: "Approve Q4 marketing spend", status: "TODO", priority: "MEDIUM", due: 1, who: "alex", tags: ["finance"] },
  { title: "Set up customer support inbox", status: "TODO", priority: "MEDIUM", due: 6, who: null, tags: ["ops"] },
];

const COMMENTS: { task: string; who: Exclude<Key, null>; body: string }[] = [
  { task: "Fix checkout timeout on slow networks", who: "maya", body: "This is the top support complaint this week — can we get a patch out before the launch email goes?" },
  { task: "Fix checkout timeout on slow networks", who: "jordan", body: "Found it: we retry the payment intent three times serially. Switching to a single request with a longer timeout. PR coming today." },
  { task: "Migrate image uploads to object storage", who: "alex", body: "Is this blocking the hiring plan for the infra role? Let me know if you need to re-scope." },
  { task: "Q4 launch email sequence", who: "alex", body: "Looks great so far. Can we A/B the subject line on email #2?" },
  { task: "Redesign onboarding flow (v2)", who: "sam", body: "First prototype is in Figma. Booking user tests for Thursday." },
  { task: "Board update — October", who: "maya", body: "I put together the product section — drop it in whenever you start." },
];

export async function insertSampleData(
  db: Database,
  opts: { adminId: string; timezone: string; password: () => Promise<string> | string },
) {
  const today = todayIn(opts.timezone);
  const now = Date.now();

  const teamNames = [...new Set(PEOPLE.map((p) => p.team))];
  const teamRows = await db.insert(teams).values(teamNames.map((name) => ({ name }))).returning({ id: teams.id, name: teams.name });
  const teamId = new Map(teamRows.map((t) => [t.name, t.id]));

  const ids: Record<string, string> = { alex: opts.adminId };
  for (const p of PEOPLE) {
    const hash = await bcrypt.hash(await opts.password(), 10);
    const [u] = await db
      .insert(users)
      .values({
        name: p.name,
        email: p.email,
        role: p.role,
        jobTitle: p.title,
        teamId: teamId.get(p.team) ?? null,
        passwordHash: hash,
        lastLoginAt: new Date(now - Math.random() * 3 * 86_400_000),
      })
      .returning({ id: users.id });
    ids[p.key] = u.id;
  }

  const taskIds = new Map<string, string>();
  for (const [i, t] of TASKS.entries()) {
    const completedAt = t.doneDaysAgo !== undefined ? new Date(now - t.doneDaysAgo * 86_400_000) : null;
    const created = new Date(now - (14 - Math.min(i, 13)) * 86_400_000);
    const creator = t.who === "alex" || t.who === null ? opts.adminId : ids.maya;
    const [row] = await db
      .insert(tasks)
      .values({
        title: t.title,
        description: t.description ?? "",
        status: t.status,
        priority: t.priority,
        dueDate: t.due === null ? null : addDays(today, t.due),
        assigneeId: t.who ? ids[t.who] : null,
        createdById: creator,
        tags: t.tags ?? [],
        completedAt,
        createdAt: created,
        updatedAt: completedAt ?? created,
      })
      .returning({ id: tasks.id });
    taskIds.set(t.title, row.id);

    await db.insert(activities).values({ taskId: row.id, actorId: creator, type: "created", createdAt: created });
    if (t.status !== "TODO") {
      await db.insert(activities).values({
        taskId: row.id,
        actorId: t.who ? ids[t.who] : creator,
        type: "status",
        meta: { from: "TODO", to: t.status },
        createdAt: completedAt ?? new Date(created.getTime() + 86_400_000),
      });
    }
  }

  for (const [i, c] of COMMENTS.entries()) {
    await db.insert(comments).values({
      taskId: taskIds.get(c.task)!,
      authorId: ids[c.who],
      body: c.body,
      createdAt: new Date(now - (COMMENTS.length - i) * 3_600_000 * 5),
    });
  }

  // A few unread notifications so the bell isn't empty on first look.
  await db.insert(notifications).values([
    {
      userId: opts.adminId,
      type: "comment",
      title: "Jordan Lee commented on “Fix checkout timeout on slow networks”",
      body: "Found it: we retry the payment intent three times serially…",
      taskId: taskIds.get("Fix checkout timeout on slow networks"),
    },
    {
      userId: opts.adminId,
      type: "overdue",
      title: "Overdue: Board update — October",
      body: "Was due 2 days ago",
      taskId: taskIds.get("Board update — October"),
    },
  ]);
}
