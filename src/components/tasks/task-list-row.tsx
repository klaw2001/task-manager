import Link from "next/link";
import type { SessionUser, TaskRow } from "@/lib/types";
import { canChangeStatus } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import { CommentCount, DueBadge, PriorityDot } from "./task-parts";
import { StatusSelect } from "./status-select";

/** Compact one-line task used by dashboard lists. */
export function TaskListRow({
  task,
  user,
  today,
  showAssignee,
}: {
  task: TaskRow;
  user: SessionUser;
  today: string;
  showAssignee?: boolean;
}) {
  return (
    <li className="group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-hover">
      <PriorityDot priority={task.priority} />
      <div className="min-w-0 flex-1">
        <Link href={`/tasks?task=${task.id}`} className="block truncate font-medium">
          {task.title}
        </Link>
        {/* On phones the deadline sits under the title — it's the whole point of the row. */}
        <div className="mt-0.5 flex items-center gap-2 sm:hidden">
          <DueBadge dueDate={task.dueDate} status={task.status} today={today} />
          {showAssignee && task.assignee && <span className="truncate text-xs text-muted">{task.assignee.name.split(" ")[0]}</span>}
        </div>
      </div>
      <CommentCount n={task.commentCount} />
      {showAssignee && (
        <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          {task.assignee ? (
            <>
              <Avatar id={task.assignee.id} name={task.assignee.name} size={20} />
              <span className="max-w-24 truncate">{task.assignee.name.split(" ")[0]}</span>
            </>
          ) : (
            "Unassigned"
          )}
        </span>
      )}
      <DueBadge dueDate={task.dueDate} status={task.status} today={today} className="hidden w-28 justify-end sm:inline-flex" />
      <StatusSelect
        taskId={task.id}
        status={task.status}
        disabled={!canChangeStatus(user, { assigneeId: task.assignee?.id ?? null, createdById: task.createdById })}
      />
    </li>
  );
}
