import { CalendarDays, MessageSquare, TriangleAlert } from "lucide-react";
import { PRIORITY_LABEL, PRIORITY_TONE, type TaskPriority } from "@/lib/constants";
import { describeDue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import Link from "next/link";

export function DueBadge({
  dueDate,
  status,
  today,
  className,
}: {
  dueDate: string | null;
  status: string;
  today: string;
  className?: string;
}) {
  const info = describeDue(dueDate, status, today);
  if (!dueDate) return <span className={cn("text-xs text-faint", className)}>No deadline</span>;
  const Icon = info.tone === "danger" ? TriangleAlert : CalendarDays;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
        info.tone === "danger" && "text-danger",
        info.tone === "warn" && "text-warn",
        info.tone === "normal" && "text-fg",
        info.tone === "muted" && "text-muted",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {info.label}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  return (
    <span
      title={`${PRIORITY_LABEL[priority]} priority`}
      className={cn("pill-dot !size-2 shrink-0", `tone-${PRIORITY_TONE[priority]}`)}
      style={{ background: "var(--t-dot)" }}
    />
  );
}

export function TagChips({ tags, max = 3, hrefFor }: { tags: string[]; max?: number; hrefFor?: (tag: string) => string }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((t) =>
        hrefFor ? (
          <Link key={t} href={hrefFor(t)} className="rounded bg-hover px-1.5 py-0.5 text-[11px] text-muted hover:text-fg">
            #{t}
          </Link>
        ) : (
          <Pill key={t} tone="gray" className="!h-5 !px-1.5 !text-[11px]">
            #{t}
          </Pill>
        ),
      )}
      {tags.length > max && <span className="text-[11px] text-faint">+{tags.length - max}</span>}
    </span>
  );
}

export function CommentCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={`${n} comment${n === 1 ? "" : "s"}`}>
      <MessageSquare className="size-3.5" aria-hidden />
      {n}
    </span>
  );
}
