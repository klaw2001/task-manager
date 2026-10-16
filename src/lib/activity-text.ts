import { PRIORITY_LABEL, STATUS_LABEL, type TaskPriority, type TaskStatus } from "./constants";
import { formatYmd } from "./dates";

/** Human sentence for an activity row, without the actor's name. */
export function activityText(type: string, meta: Record<string, unknown> | null): string {
  const m = meta ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  switch (type) {
    case "created":
      return "created this task";
    case "status": {
      const to = STATUS_LABEL[m.to as TaskStatus] ?? str(m.to);
      const from = STATUS_LABEL[m.from as TaskStatus] ?? str(m.from);
      return `changed status from ${from} to ${to}`;
    }
    case "assignee": {
      const to = str(m.to);
      const from = str(m.from);
      if (!to) return `unassigned this task${from ? ` from ${from}` : ""}`;
      return from ? `reassigned from ${from} to ${to}` : `assigned this to ${to}`;
    }
    case "due": {
      const to = str(m.to);
      const from = str(m.from);
      if (!to) return "removed the deadline";
      return from ? `moved the deadline from ${formatYmd(from)} to ${formatYmd(to)}` : `set the deadline to ${formatYmd(to)}`;
    }
    case "priority":
      return `changed priority to ${PRIORITY_LABEL[m.to as TaskPriority] ?? str(m.to)}`;
    case "title":
      return "renamed this task";
    case "description":
      return "updated the description";
    case "tags":
      return "updated the tags";
    default:
      return "updated this task";
  }
}
