"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Bell, CalendarClock, CircleAlert, MessageSquare, UserPlus, Workflow } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { relativeTime } from "@/lib/dates";
import type { NotificationView } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Bell> = {
  assigned: UserPlus,
  comment: MessageSquare,
  status: Workflow,
  overdue: CircleAlert,
  due: CalendarClock,
};

export function NotificationBell({ items, unread }: { items: NotificationView[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openItem(n: NotificationView) {
    setOpen(false);
    startTransition(async () => {
      if (!n.readAt) await markNotificationsRead(n.id);
      if (n.taskId) router.push(`/tasks?task=${n.taskId}`);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-pop-in absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-bg shadow-pop">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                className="text-xs text-muted hover:text-fg"
                onClick={() => startTransition(async () => void (await markNotificationsRead()))}
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">
              <AtSign className="mx-auto mb-2 size-5 text-faint" />
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-hover", !n.readAt && "bg-accent-soft")}
                    >
                      <Icon className={cn("mt-0.5 size-4 shrink-0", n.type === "overdue" ? "text-danger" : "text-muted")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug">{n.title}</span>
                        {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-faint" suppressHydrationWarning>
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                      {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
