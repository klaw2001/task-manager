"use server";

import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { company, getDb, users } from "../db";
import type { Database } from "../db/client";
import { insertSampleData } from "../db/sample";
import { DUMMY_HASH, generateTempPassword, hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, getCurrentUser } from "../auth/session";
import { needsSetup } from "../data/company";
import { changePasswordSchema, loginSchema, setupSchema } from "../validation";

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so React 19's post-action form reset doesn't wipe what the user typed. */
  values?: Record<string, string>;
} | undefined;

function valuesOf(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}

/** Only allow same-site relative redirects. */
function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const values = valuesOf(formData, ["email"]);
  if (!parsed.success) return { error: "Enter a valid email and your password.", values };
  const { email, password } = parsed.data;

  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const now = new Date();

  if (u?.lockedUntil && u.lockedUntil > now) {
    await verifyPassword(password, DUMMY_HASH);
    return { error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`, values };
  }

  const ok = await verifyPassword(password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !ok) {
    if (u) {
      const failed = u.failedLogins + 1;
      const lock = failed >= MAX_FAILED;
      await db
        .update(users)
        .set({
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
        })
        .where(eq(users.id, u.id));
    }
    return { error: "Invalid email or password.", values };
  }
  if (!u.active) return { error: "This account has been deactivated. Ask an admin to restore access.", values };

  await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(users.id, u.id));
  await createSession(u.id, u.sessionVersion);
  redirect(u.mustChangePassword ? "/change-password" : safeNext(formData.get("next")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

function setupKeyMatches(provided: string) {
  const expected = process.env.SETUP_KEY;
  if (!expected) return true;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ["companyName", "timezone", "name", "email", "sample"]);
  if (!(await needsSetup())) return { error: "This workspace is already set up. Sign in instead.", values };
  if (!setupKeyMatches(String(formData.get("setupKey") ?? ""))) {
    return { error: "Incorrect setup key.", fieldErrors: { setupKey: "Incorrect setup key" }, values };
  }

  const parsed = setupSchema.safeParse({
    companyName: formData.get("companyName"),
    timezone: formData.get("timezone"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error.issues);
    return { error: Object.values(fieldErrors)[0], fieldErrors, values };
  }
  const d = parsed.data;

  const db = await getDb();
  const passwordHash = await hashPassword(d.password);
  const adminId = await db.transaction(async (tx) => {
    // Re-check inside the transaction so two simultaneous setups can't both win.
    const existing = await tx.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) return null;
    await tx.insert(company).values({ name: d.companyName, timezone: d.timezone });
    const [admin] = await tx
      .insert(users)
      .values({ name: d.name, email: d.email, passwordHash, role: "ADMIN", jobTitle: "Founder", lastLoginAt: new Date() })
      .returning({ id: users.id });
    if (formData.get("sample") === "on") {
      // Teammates get random passwords nobody knows; the admin resets one to sign in as them.
      await insertSampleData(tx as unknown as Database, {
        adminId: admin.id,
        timezone: d.timezone,
        password: generateTempPassword,
      });
    }
    return admin.id;
  });
  if (!adminId) return { error: "This workspace is already set up. Sign in instead.", values };

  await createSession(adminId, 0);
  redirect("/dashboard");
}

/** Works both for the forced first-login change and for Settings. */
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error.issues);
    return { error: Object.values(fieldErrors)[0], fieldErrors };
  }

  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return { error: "Your current password is incorrect.", fieldErrors: { current: "Incorrect password" } };
  }

  const passwordHash = await hashPassword(parsed.data.next);
  const sessionVersion = row.sessionVersion + 1; // signs out every other device
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, sessionVersion, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await createSession(user.id, sessionVersion);

  if (user.mustChangePassword) redirect("/dashboard");
  revalidatePath("/settings");
  return { success: "Password updated. Other devices have been signed out." };
}
