import type { ReactNode } from "react";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  type TaskPriority,
  type TaskStatus,
  type Tone,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Pill({ tone = "gray", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("pill", `tone-${tone}`, className)}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}

export const StatusPill = ({ status }: { status: TaskStatus }) => (
  <Pill tone={STATUS_TONE[status]} dot>
    {STATUS_LABEL[status]}
  </Pill>
);

export const PriorityPill = ({ priority }: { priority: TaskPriority }) => (
  <Pill tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Pill>
);
