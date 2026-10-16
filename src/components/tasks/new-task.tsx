"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import { PRIORITY_LABEL, TASK_PRIORITIES, type TaskPriority } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { can } from "@/lib/permissions";
import type { AssignableUser } from "@/lib/data/users";
import type { SessionUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";

type Defaults = { assigneeId?: string; dueDate?: string };
type Ctx = { openNewTask: (defaults?: Defaults) => void };

const NewTaskContext = createContext<Ctx>({ openNewTask: () => {} });
export const useNewTask = () => useContext(NewTaskContext);

export function NewTaskProvider({
  user,
  assignees,
  today,
  children,
}: {
  user: SessionUser;
  assignees: AssignableUser[];
  today: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<Defaults>({});
  const [formKey, setFormKey] = useState(0);

  const openNewTask = useCallback((d: Defaults = {}) => {
    setDefaults(d);
    setFormKey((k) => k + 1);
    setOpen(true);
  }, []);

  // "c" opens the composer, like Linear/Notion.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], dialog")) return;
      e.preventDefault();
      openNewTask();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewTask]);

  const value = useMemo(() => ({ openNewTask }), [openNewTask]);

  return (
    <NewTaskContext.Provider value={value}>
      {children}
      <Dialog open={open} onClose={() => setOpen(false)} title="New task" description="Capture it now, refine it later.">
        <NewTaskForm key={formKey} user={user} assignees={assignees} today={today} defaults={defaults} onDone={() => setOpen(false)} />
      </Dialog>
    </NewTaskContext.Provider>
  );
}

function NewTaskForm({
  user,
  assignees,
  today,
  defaults,
  onDone,
}: {
  user: SessionUser;
  assignees: AssignableUser[];
  today: string;
  defaults: Defaults;
  onDone: () => void;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const lead = can.assignToOthers(user.role);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState(defaults.dueDate ?? "");
  const [assigneeId, setAssigneeId] = useState(lead ? (defaults.assigneeId ?? "") : user.id);
  const [tags, setTags] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    run(
      () => createTask({ title, description, priority, dueDate, assigneeId: assigneeId || null, tags }),
      {
        onDone: (r) => {
          if (r.ok) {
            onDone();
            router.refresh();
          } else setErrors(r.fieldErrors ?? {});
        },
      },
    );
  }

  const chips: [string, string][] = [
    ["Today", today],
    ["Tomorrow", addDays(today, 1)],
    ["Next week", addDays(today, 7)],
  ];

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title" htmlFor="nt-title" error={errors.title}>
        <Input id="nt-title" autoFocus required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send Q4 proposal to Acme" />
      </Field>
      <Field label="Description" htmlFor="nt-desc" error={errors.description}>
        <Textarea id="nt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Context, links, what “done” looks like…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assignee" htmlFor="nt-assignee" error={errors.assigneeId}>
          {lead ? (
            <Select id="nt-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.id === user.id ? " (you)" : ""}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="nt-assignee" value="You" disabled />
          )}
        </Field>
        <Field label="Priority" htmlFor="nt-priority">
          <Select id="nt-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Deadline" htmlFor="nt-due" error={errors.dueDate}>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="nt-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-auto" />
          {chips.map(([label, value]) => (
            <Button key={label} size="sm" variant={dueDate === value ? "primary" : "secondary"} onClick={() => setDueDate(value)}>
              {label}
            </Button>
          ))}
          {dueDate && (
            <Button size="sm" variant="ghost" onClick={() => setDueDate("")}>
              Clear
            </Button>
          )}
        </div>
      </Field>
      <Field label="Tags" htmlFor="nt-tags" hint="Comma separated, e.g. design, q4">
        <Input id="nt-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending || !title.trim()}>
          {pending ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}

export function NewTaskButton({ className, label = "New task", defaults }: { className?: string; label?: string; defaults?: Defaults }) {
  const { openNewTask } = useNewTask();
  return (
    <Button variant="primary" className={className} onClick={() => openNewTask(defaults)}>
      <Plus className="size-4" />
      {label}
    </Button>
  );
}
