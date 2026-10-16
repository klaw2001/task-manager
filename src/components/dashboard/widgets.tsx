import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { activityText } from "@/lib/activity-text";
import type { DashboardData } from "@/lib/data/dashboard";
import { formatYmd, relativeTime } from "@/lib/dates";
import { cn, pluralize } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

export function StatCard({
  label,
  value,
  href,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "danger" | "warn";
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-bg p-4 transition-shadow hover:shadow-pop focus-visible:shadow-pop"
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
          tone === "danger" && value > 0 && "text-danger",
          tone === "warn" && value > 0 && "text-warn",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </Link>
  );
}

export function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-bg", className)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SeeAll({ href, children = "See all" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
      {children}
      <ArrowRight className="size-3" />
    </Link>
  );
}

/** 14-day completion bars. Plain SVG: no chart library, works with SSR. */
export function TrendChart({ data }: { data: DashboardData["trend"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const w = 280;
  const h = 72;
  const gap = 5;
  const bw = (w - gap * (data.length - 1)) / data.length;
  return (
    <div className="px-4 pb-4 pt-2">
      <p className="text-2xl font-semibold tabular-nums">
        {total} <span className="text-sm font-normal text-muted">completed in 14 days</span>
      </p>
      <svg viewBox={`0 0 ${w} ${h + 16}`} role="img" aria-label={`Tasks completed per day over the last 14 days, ${total} in total`} className="mt-3 w-full">
        {data.map((d, i) => {
          const bh = d.count === 0 ? 2 : Math.max(4, (d.count / max) * h);
          return (
            <g key={d.day}>
              <rect
                x={i * (bw + gap)}
                y={h - bh}
                width={bw}
                height={bh}
                rx={2}
                fill={d.count === 0 ? "var(--border)" : "var(--accent)"}
              >
                <title>{`${formatYmd(d.day)}: ${pluralize(d.count, "task")} completed`}</title>
              </rect>
            </g>
          );
        })}
        <text x={0} y={h + 13} fontSize={10} fill="var(--faint)">
          {formatYmd(data[0].day)}
        </text>
        <text x={w} y={h + 13} fontSize={10} fill="var(--faint)" textAnchor="end">
          Today
        </text>
      </svg>
    </div>
  );
}

export function WorkloadList({ rows }: { rows: DashboardData["workload"] }) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  if (rows.length === 0) return <p className="px-4 pb-4 pt-2 text-sm text-muted">No team members yet.</p>;
  return (
    <ul className="px-2 pb-2 pt-1">
      {rows.slice(0, 10).map((r) => {
        const rest = r.open - r.overdue;
        return (
          <li key={r.id}>
            <Link href={`/tasks?assignee=${r.id}&scope=all`} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-hover">
              <Avatar id={r.id} name={r.name} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {r.open} open
                    {r.overdue > 0 && <span className="font-medium text-danger"> · {r.overdue} overdue</span>}
                  </span>
                </div>
                <div
                  className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-hover"
                  role="img"
                  aria-label={`${r.open} open tasks, ${r.overdue} overdue`}
                >
                  <span className="bg-danger" style={{ width: `${(r.overdue / max) * 100}%` }} />
                  <span className="bg-accent" style={{ width: `${(rest / max) * 100}%` }} />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RecentActivity({ items }: { items: DashboardData["recent"] }) {
  if (items.length === 0) return <p className="px-4 pb-4 pt-2 text-sm text-muted">Activity will show up here as work happens.</p>;
  return (
    <ul className="space-y-0.5 px-2 pb-2 pt-1">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={`/tasks?task=${a.taskId}`} className="flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
            <Avatar id={a.actor?.id ?? a.id} name={a.actor?.name ?? "?"} size={22} className="mt-0.5" />
            <span className="min-w-0 flex-1 text-[13px] leading-snug">
              <span className="font-medium">{a.actor?.name ?? "Someone"}</span> {activityText(a.type, a.meta)}{" "}
              <span className="text-muted">— {a.taskTitle}</span>
              <span className="block text-[11px] text-faint" suppressHydrationWarning>
                {relativeTime(a.createdAt)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
