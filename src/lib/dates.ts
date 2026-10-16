// Due dates are plain calendar dates (YYYY-MM-DD) interpreted in the company
// timezone. Comparing them as strings is therefore always correct and avoids
// the classic "overdue at 11pm UTC" bugs.

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayIn(tz: string, now: Date = new Date()): string {
  const zone = isValidTimezone(tz) ? tz : "UTC";
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const utc = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);

export function addDays(ymd: string, n: number): string {
  const d = new Date(utc(ymd));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from b to a (a - b). */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(a) - utc(b)) / 86_400_000);
}

export function isValidYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(utc(s)) && new Date(utc(s)).toISOString().slice(0, 10) === s;
}

export function formatYmd(ymd: string, today?: string) {
  const sameYear = today ? ymd.slice(0, 4) === today.slice(0, 4) : false;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(utc(ymd)));
}

export type DueBucket = "overdue" | "today" | "upcoming" | "none" | "done";

export function dueBucket(dueDate: string | null, status: string, today: string): DueBucket {
  if (status === "DONE") return "done";
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

export type DueInfo = {
  label: string;
  tone: "danger" | "warn" | "normal" | "muted";
  bucket: DueBucket;
  daysOverdue: number;
};

export function describeDue(dueDate: string | null, status: string, today: string): DueInfo {
  const bucket = dueBucket(dueDate, status, today);
  if (!dueDate) return { label: "No date", tone: "muted", bucket, daysOverdue: 0 };
  const diff = diffDays(dueDate, today);
  if (bucket === "done") return { label: formatYmd(dueDate, today), tone: "muted", bucket, daysOverdue: 0 };
  if (bucket === "overdue") {
    const d = -diff;
    return { label: d === 1 ? "1 day overdue" : `${d} days overdue`, tone: "danger", bucket, daysOverdue: d };
  }
  if (bucket === "today") return { label: "Due today", tone: "warn", bucket, daysOverdue: 0 };
  if (diff === 1) return { label: "Tomorrow", tone: "warn", bucket, daysOverdue: 0 };
  if (diff < 7) {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(utc(dueDate)));
    return { label: wd, tone: "normal", bucket, daysOverdue: 0 };
  }
  return { label: formatYmd(dueDate, today), tone: "normal", bucket, daysOverdue: 0 };
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 7 * 86_400) return `${Math.round(diff / 86_400)}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}
