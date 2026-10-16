"use client";

import { useOptimistic } from "react";
import { updateTask } from "@/lib/actions/tasks";
import { STATUS_LABEL, STATUS_TONE, TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { PillSelect } from "@/components/ui/pill-select";
import { StatusPill } from "@/components/ui/pill";
import { useAction } from "@/components/ui/use-action";

const OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

/** Inline status editor used in lists, the board and the dashboard. */
export function StatusSelect({ taskId, status, disabled }: { taskId: string; status: TaskStatus; disabled?: boolean }) {
  const { run } = useAction();
  const [optimistic, setOptimistic] = useOptimistic(status);

  if (disabled) return <StatusPill status={status} />;

  return (
    <PillSelect
      ariaLabel="Status"
      value={optimistic}
      options={OPTIONS}
      tone={STATUS_TONE[optimistic]}
      dot
      onChange={(next) =>
        run(async () => {
          setOptimistic(next as TaskStatus);
          return updateTask(taskId, { status: next });
        }, { success: false })
      }
    />
  );
}
