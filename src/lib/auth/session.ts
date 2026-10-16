import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "../db";
import type { Role } from "../constants";
import type { SessionUser } from "../types";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "./token";
import { ForbiddenError } from "../errors";

export async function createSession(userId: string, sessionVersion: number) {
  const token = await signSession({ sub: userId, sv: sessionVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * The authoritative "who is this?" check. Re-validates against the database on
 * every request so deactivating a user or resetting a password takes effect
 * immediately (the proxy only checks the cookie signature).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const payload = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!u || !u.active || u.sessionVersion !== payload.sv) return null;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    teamId: u.teamId,
    jobTitle: u.jobTitle,
    mustChangePassword: u.mustChangePassword,
  };
});

/** Page/action guard: signed in, and not stuck on a forced password change. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

/** Guard for pages: sends users without the role back to the dashboard. */
export async function requireRolePage(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Guard for actions: throws so the action wrapper can return a clean error. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}
