import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, tasks, teams, users } from "../db";
import type { Role } from "../constants";
import { todayIn } from "../dates";

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  active: boolean;
  teamId: string | null;
  teamName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  open: number;
  overdue: number;
  doneWeek: number;
};

/** Everyone, with live workload counts. Callers decide who may see the numbers. */
export async function listPeople(timezone: string): Promise<PersonRow[]> {
  const db = await getDb();
  const today = todayIn(timezone);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      jobTitle: users.jobTitle,
      active: users.active,
      teamId: users.teamId,
      teamName: teams.name,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      open: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'DONE')::int`,
      overdue: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'DONE' and ${tasks.dueDate} < ${today}::date)::int`,
      doneWeek: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'DONE' and ${tasks.completedAt} >= now() - interval '7 days')::int`,
    })
    .from(users)
    .leftJoin(teams, eq(users.teamId, teams.id))
    .leftJoin(tasks, eq(tasks.assigneeId, users.id))
    .groupBy(users.id, teams.name)
    .orderBy(sql`${users.active} desc`, asc(users.name));

  return rows.map((r) => ({
    ...r,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type AssignableUser = { id: string; name: string; jobTitle: string | null; role: Role };

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, jobTitle: users.jobTitle, role: users.role })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
}

export type TeamRow = { id: string; name: string; description: string | null; members: number };

export async function listTeams(): Promise<TeamRow[]> {
  const db = await getDb();
  return db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      members: sql<number>`count(${users.id}) filter (where ${users.active})::int`,
    })
    .from(teams)
    .leftJoin(users, eq(users.teamId, teams.id))
    .groupBy(teams.id)
    .orderBy(asc(teams.name));
}

export async function getUserProfile(id: string) {
  const db = await getDb();
  const [u] = await db
    .select({ id: users.id, name: users.name, jobTitle: users.jobTitle, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return u ?? null;
}
