import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { BrandScope } from "@/components/layout/brand";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/data/company";
import { listNotifications } from "@/lib/data/notifications";
import { overdueCountFor } from "@/lib/data/tasks";
import { listAssignableUsers } from "@/lib/data/users";
import { todayIn } from "@/lib/dates";

// Everything in the app is per-user and reads live data.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompany();
  const name = company?.name ?? "Task Manager";
  return { title: { default: name, template: `%s · ${name}` } };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const company = await getCompany();
  if (!company) redirect("/setup");

  const [notifications, overdueCount, assignees] = await Promise.all([
    listNotifications(user.id),
    overdueCountFor(user, company),
    listAssignableUsers(),
  ]);

  return (
    <BrandScope accent={company.accentColor}>
      <AppShell
        user={user}
        company={company}
        overdueCount={overdueCount}
        notifications={notifications}
        assignees={assignees}
        today={todayIn(company.timezone)}
      >
        {children}
      </AppShell>
    </BrandScope>
  );
}
