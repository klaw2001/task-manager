"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  SquareCheckBig,
  UserCog,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import type { AssignableUser } from "@/lib/data/users";
import type { CompanyView, NotificationView, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { ToastProvider } from "@/components/ui/toast";
import { NewTaskButton, NewTaskProvider } from "@/components/tasks/new-task";
import { CompanyMark } from "./brand";
import { NotificationBell } from "./notifications";
import { ThemeToggle } from "./theme-toggle";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

export function AppShell({
  user,
  company,
  overdueCount,
  notifications,
  assignees,
  today,
  children,
}: {
  user: SessionUser;
  company: CompanyView;
  overdueCount: number;
  notifications: { items: NotificationView[]; unread: number };
  assignees: AssignableUser[];
  today: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The drawer is "open on a path": navigating anywhere closes it, no effect needed.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawer = drawerPath === pathname;
  const setDrawer = (open: boolean) => setDrawerPath(open ? pathname : null);

  const main: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "Tasks", icon: SquareCheckBig, badge: overdueCount },
    { href: "/team", label: "Team", icon: Users },
  ];
  const admin: NavItem[] =
    user.role === "ADMIN"
      ? [
          { href: "/admin/people", label: "People & roles", icon: UserCog },
          { href: "/admin/teams", label: "Teams", icon: UsersRound },
          { href: "/admin/company", label: "Company profile", icon: Building2 },
        ]
      : [];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <CompanyMark name={company.name} logoUrl={company.logoUrl} size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{company.name}</p>
          <p className="truncate text-xs text-muted">{company.tagline || "Task manager"}</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-2.5 py-2">
        <NavGroup items={main} pathname={pathname} />
        {admin.length > 0 && <NavGroup title="Admin" items={admin} pathname={pathname} />}
      </nav>

      <div className="border-t p-2.5">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <Avatar id={user.id} name={user.name} size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.jobTitle || ROLE_LABEL[user.role]}</p>
          </div>
          <Link href="/settings" aria-label="Settings" title="Settings" className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
            <Settings className="size-4" />
          </Link>
          <form action={logoutAction}>
            <button aria-label="Sign out" title="Sign out" className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <NewTaskProvider user={user} assignees={assignees} today={today}>
        <div className="flex min-h-dvh">
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r bg-sidebar md:block">{sidebar}</aside>

          {drawer && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div className="anim-fade-in absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
              <aside className="anim-slide-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-sidebar shadow-pop">
                <button aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute right-2 top-3 rounded-md p-1.5 text-muted hover:bg-hover">
                  <X className="size-4" />
                </button>
                {sidebar}
              </aside>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-12 items-center gap-1.5 border-b bg-bg/85 px-3 backdrop-blur sm:px-5">
              <button aria-label="Open menu" onClick={() => setDrawer(true)} className="rounded-md p-1.5 text-muted hover:bg-hover md:hidden">
                <Menu className="size-5" />
              </button>
              <div className="flex items-center gap-2 md:hidden">
                <CompanyMark name={company.name} logoUrl={company.logoUrl} size={22} />
                <span className="max-w-32 truncate text-sm font-semibold">{company.name}</span>
              </div>
              <div className="flex-1" />
              <NotificationBell items={notifications.items} unread={notifications.unread} />
              <ThemeToggle />
              <NewTaskButton className="ml-1" label="New task" />
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </NewTaskProvider>
    </ToastProvider>
  );
}

function NavGroup({ title, items, pathname }: { title?: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      {title && <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</p>}
      <ul className="space-y-0.5">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-hover text-fg" : "text-muted hover:bg-hover hover:text-fg",
                )}
              >
                <Icon className={cn("size-4", active && "text-accent")} />
                <span className="flex-1">{label}</span>
                {!!badge && badge > 0 && (
                  <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-[18px] text-white" title={`${badge} overdue`}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
