"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, notifications } from "../db";
import { getCurrentUser } from "../auth/session";

export async function markNotificationsRead(id?: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const db = await getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
        id ? eq(notifications.id, id) : undefined,
      ),
    );
  revalidatePath("/", "layout");
}
