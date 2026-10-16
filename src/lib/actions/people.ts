"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { company, getDb, tasks, teams, users } from "../db";
import { hashPassword, generateTempPassword } from "../auth/password";
import { requireRole, requireUser } from "../auth/session";
import { AppError, isUniqueViolation } from "../errors";
import {
  companySchema,
  profileSchema,
  teamSchema,
  userCreateSchema,
  userUpdateSchema,
} from "../validation";
import type { ActionResult } from "../types";
import { run } from "./helpers";

const refresh = () => revalidatePath("/", "layout");

async function activeAdminsExcluding(userId: string) {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.active, true), ne(users.id, userId)));
  return n;
}

async function assertTeamExists(teamId: string | null | undefined) {
  if (!teamId) return;
  const db = await getDb();
  const [t] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!t) throw new AppError("That team no longer exists.", { teamId: "Pick a valid team" });
}

// ── Users ────────────────────────────────────────────────────────────────

export async function createUser(input: unknown): Promise<ActionResult<{ id: string; email: string; tempPassword: string }>> {
  return run(async () => {
    await requireRole("ADMIN");
    const d = userCreateSchema.parse(input);
    await assertTeamExists(d.teamId);
    const db = await getDb();

    const tempPassword = d.password ?? generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    try {
      const [u] = await db
        .insert(users)
        .values({
          name: d.name,
          email: d.email,
          role: d.role,
          teamId: d.teamId ?? null,
          jobTitle: d.jobTitle ?? null,
          passwordHash,
          mustChangePassword: true,
        })
        .returning({ id: users.id });
      refresh();
      return { id: u.id, email: d.email, tempPassword };
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("Someone with that email already exists.", { email: "Email already in use" });
      throw err;
    }
  }, "Team member added");
}

export async function updateUser(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    await requireRole("ADMIN");
    const d = userUpdateSchema.parse(input);
    await assertTeamExists(d.teamId);
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new AppError("User not found.");

    if (target.role === "ADMIN" && d.role !== "ADMIN" && target.active && (await activeAdminsExcluding(id)) === 0) {
      throw new AppError("There must always be at least one active admin. Promote someone else first.", {
        role: "Last admin",
      });
    }
    await db
      .update(users)
      .set({ name: d.name, role: d.role, teamId: d.teamId ?? null, jobTitle: d.jobTitle ?? null, updatedAt: new Date() })
      .where(eq(users.id, id));
    refresh();
  }, "Changes saved");
}

export async function resetUserPassword(id: string): Promise<ActionResult<{ tempPassword: string }>> {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    if (admin.id === id) throw new AppError("Change your own password from Settings.");
    const db = await getDb();
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new AppError("User not found.");

    const tempPassword = generateTempPassword();
    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    refresh();
    return { tempPassword };
  }, "Password reset");
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult<{ openTasks: number }>> {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new AppError("User not found.");
    if (!active) {
      if (admin.id === id) throw new AppError("You can't deactivate your own account.");
      if (target.role === "ADMIN" && target.active && (await activeAdminsExcluding(id)) === 0) {
        throw new AppError("There must always be at least one active admin.");
      }
    }
    await db
      .update(users)
      .set({
        active,
        // Kill any live sessions straight away when deactivating.
        sessionVersion: active ? target.sessionVersion : target.sessionVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    const [{ n }] = await db
      .select({ n: count() })
      .from(tasks)
      .where(and(eq(tasks.assigneeId, id), ne(tasks.status, "DONE")));
    refresh();
    return { openTasks: n };
  });
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser();
    const d = profileSchema.parse(input);
    const db = await getDb();
    await db
      .update(users)
      .set({ name: d.name, jobTitle: d.jobTitle ?? null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    refresh();
  }, "Profile updated");
}

// ── Teams ────────────────────────────────────────────────────────────────

export async function createTeam(input: unknown): Promise<ActionResult> {
  return run(async () => {
    await requireRole("ADMIN");
    const d = teamSchema.parse(input);
    const db = await getDb();
    try {
      await db.insert(teams).values({ name: d.name, description: d.description ?? null });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("A team with that name already exists.", { name: "Name already used" });
      throw err;
    }
    refresh();
  }, "Team created");
}

export async function updateTeam(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    await requireRole("ADMIN");
    const d = teamSchema.parse(input);
    const db = await getDb();
    try {
      await db.update(teams).set({ name: d.name, description: d.description ?? null }).where(eq(teams.id, id));
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("A team with that name already exists.", { name: "Name already used" });
      throw err;
    }
    refresh();
  }, "Team updated");
}

export async function deleteTeam(id: string): Promise<ActionResult> {
  return run(async () => {
    await requireRole("ADMIN");
    const db = await getDb();
    await db.delete(teams).where(eq(teams.id, id)); // members' teamId → null (FK set null)
    refresh();
  }, "Team deleted");
}

// ── Company ──────────────────────────────────────────────────────────────

export async function updateCompany(input: unknown): Promise<ActionResult> {
  return run(async () => {
    await requireRole("ADMIN");
    const d = companySchema.parse(input);
    const db = await getDb();
    const [existing] = await db.select({ id: company.id }).from(company).limit(1);
    if (!existing) throw new AppError("Workspace isn't set up yet.");
    await db
      .update(company)
      .set({
        name: d.name,
        tagline: d.tagline ?? null,
        description: d.description ?? null,
        website: d.website ?? null,
        industry: d.industry ?? null,
        size: d.size ?? null,
        foundedYear: d.foundedYear ?? null,
        timezone: d.timezone,
        accentColor: d.accentColor,
        logoUrl: d.logoUrl ?? null,
        memberVisibility: d.memberVisibility,
        updatedAt: new Date(),
      })
      .where(eq(company.id, existing.id));
    refresh();
  }, "Company profile saved");
}
