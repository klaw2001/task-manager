"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { createTeam, deleteTeam, updateTeam } from "@/lib/actions/people";
import { pluralize } from "@/lib/utils";
import type { TeamRow } from "@/lib/data/users";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";

export function TeamsManager({ teams }: { teams: TeamRow[] }) {
  const [editing, setEditing] = useState<TeamRow | "new" | null>(null);
  const { run } = useAction();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> New team
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
          <Users className="size-8 text-faint" />
          <p className="font-semibold">No teams yet</p>
          <p className="max-w-sm text-sm text-muted">Teams (Engineering, Design, Sales…) group people so you can see who works on what.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <li key={t.id} className="flex flex-col rounded-xl border bg-bg p-4">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 font-semibold">{t.name}</h2>
                <button aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
                  <Pencil className="size-3.5" />
                </button>
                <button
                  aria-label={`Delete ${t.name}`}
                  onClick={() => {
                    if (confirm(`Delete the “${t.name}” team? Its ${pluralize(t.members, "member")} will become unassigned to any team.`)) {
                      run(() => deleteTeam(t.id));
                    }
                  }}
                  className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <p className="mt-1 flex-1 text-sm text-muted">{t.description || "No description"}</p>
              <p className="mt-3 text-xs text-faint">{pluralize(t.members, "member")}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New team" : "Edit team"}>
        {editing && (
          <TeamForm
            key={editing === "new" ? "new" : editing.id}
            team={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSubmit={(v, done) =>
              run(() => (editing === "new" ? createTeam(v) : updateTeam(editing.id, v)), {
                onDone: (r) => {
                  if (r.ok) setEditing(null);
                  else done(r.fieldErrors ?? {});
                },
              })
            }
          />
        )}
      </Dialog>
    </div>
  );
}

function TeamForm({
  team,
  onSubmit,
  onCancel,
}: {
  team?: TeamRow;
  onSubmit: (values: { name: string; description: string }, setErrors: (e: Record<string, string>) => void) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, description }, setErrors);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Team name" htmlFor="t-name" error={errors.name}>
        <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={40} placeholder="e.g. Engineering" />
      </Field>
      <Field label="Description" htmlFor="t-desc" error={errors.description}>
        <Input id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="What does this team own?" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          {team ? "Save" : "Create team"}
        </Button>
      </div>
    </form>
  );
}
