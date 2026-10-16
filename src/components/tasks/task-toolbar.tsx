"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, List, Search, X } from "lucide-react";
import { PRIORITY_LABEL, STATUS_LABEL, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { AssignableUser } from "@/lib/data/users";
import type { TaskFilters, TaskView } from "@/lib/data/tasks";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/form";

const filterSelect = "!h-8 !w-auto !pr-7 !text-[13px]";

export function TaskToolbar({
  filters,
  view,
  assignees,
  tags,
  canSeeAll,
  lead,
  userId,
}: {
  filters: TaskFilters;
  view: TaskView;
  assignees: AssignableUser[];
  tags: string[];
  canSeeAll: boolean;
  lead: boolean;
  userId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const firstRun = useRef(true);

  function hrefWith(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  }

  function set(patch: Record<string, string | null>) {
    startTransition(() => router.replace(hrefWith(patch), { scroll: false }));
  }

  // Debounced search → URL.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== q.trim()) set({ q: q.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters =
    filters.status !== "active" || !!filters.assignee || !!filters.priority || !!filters.due || !!filters.tag || !!filters.q;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canSeeAll && (
          <div role="tablist" aria-label="Scope" className="inline-flex rounded-md border bg-subtle p-0.5 text-[13px]">
            {(
              [
                ["mine", "My tasks"],
                ["all", lead ? "All tasks" : "Everyone"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={filters.scope === value}
                onClick={() => set({ scope: value, assignee: null })}
                className={cn(
                  "rounded px-2.5 py-1 font-medium transition-colors",
                  filters.scope === value ? "bg-bg text-fg shadow-xs" : "text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="inline-flex rounded-md border bg-subtle p-0.5 text-[13px]" role="group" aria-label="View">
          {(
            [
              ["table", "List", List],
              ["board", "Board", Columns3],
            ] as const
          ).map(([value, label, Icon]) => (
            <Link
              key={value}
              href={hrefWith({ view: value })}
              replace
              scroll={false}
              aria-current={view === value ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors",
                view === value ? "bg-bg text-fg shadow-xs" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>

        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="h-8 w-full rounded-md border bg-bg pl-8 pr-2 text-[13px] placeholder:text-faint hover:border-faint/60 focus-visible:border-accent focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent"
          />
        </div>
        {pending && <span className="text-xs text-faint" aria-live="polite">Updating…</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Status" className={filterSelect} value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="active">Open tasks</option>
          <option value="all">Everything</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>

        <Select aria-label="Deadline" className={filterSelect} value={filters.due ?? ""} onChange={(e) => set({ due: e.target.value || null })}>
          <option value="">Any deadline</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Next 7 days</option>
          <option value="none">No deadline</option>
        </Select>

        <Select aria-label="Priority" className={filterSelect} value={filters.priority ?? ""} onChange={(e) => set({ priority: e.target.value || null })}>
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>

        {filters.scope === "all" && (
          <Select aria-label="Assignee" className={filterSelect} value={filters.assignee ?? ""} onChange={(e) => set({ assignee: e.target.value || null })}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.id === userId ? " (you)" : ""}
              </option>
            ))}
          </Select>
        )}

        {tags.length > 0 && (
          <Select aria-label="Tag" className={filterSelect} value={filters.tag ?? ""} onChange={(e) => set({ tag: e.target.value || null })}>
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </Select>
        )}

        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              set({ status: null, assignee: null, priority: null, due: null, tag: null, q: null });
            }}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-hover hover:text-fg"
          >
            <X className="size-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
