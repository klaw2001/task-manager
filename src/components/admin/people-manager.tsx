"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, Pencil, Search, UserCheck, UserPlus, UserX } from "lucide-react";
import { createUser, resetUserPassword, setUserActive, updateUser } from "@/lib/actions/people";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/constants";
import { relativeTime } from "@/lib/dates";
import type { PersonRow, TeamRow } from "@/lib/data/users";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { Pill } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";

type Modal =
  | { type: "create" }
  | { type: "edit"; person: PersonRow }
  | { type: "credentials"; heading: string; email: string; password: string }
  | null;

const ROLE_TONE = { ADMIN: "purple", MANAGER: "blue", MEMBER: "gray" } as const;

export function PeopleManager({ people, teams, currentUserId }: { people: PersonRow[]; teams: TeamRow[]; currentUserId: string }) {
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [q, setQ] = useState("");
  const { run } = useAction();
  const toast = useToast();
  // A dialog's `close` event also fires when we close it programmatically (e.g. create → credentials),
  // so only clear the modal if that dialog is still the active one.
  const closeIf = (type: NonNullable<Modal>["type"]) => () => setModal((m) => (m?.type === type ? null : m));

  const counts = { active: people.filter((p) => p.active).length, inactive: people.filter((p) => !p.active).length };
  const visible = useMemo(
    () =>
      people.filter(
        (p) =>
          (tab === "active" ? p.active : !p.active) &&
          (!q || `${p.name} ${p.email} ${p.jobTitle ?? ""} ${p.teamName ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [people, tab, q],
  );

  function resetPassword(p: PersonRow) {
    if (!confirm(`Reset ${p.name}'s password? They'll be signed out everywhere and must choose a new one.`)) return;
    run(() => resetUserPassword(p.id), {
      success: false,
      onDone: (r) => r.ok && r.data && setModal({ type: "credentials", heading: "Password reset", email: p.email, password: r.data.tempPassword }),
    });
  }

  function toggleActive(p: PersonRow) {
    const next = !p.active;
    if (!next && !confirm(`Deactivate ${p.name}? They'll be signed out and can no longer sign in. Their history is kept.`)) return;
    run(() => setUserActive(p.id, next), {
      success: false,
      onDone: (r) => {
        if (!r.ok) return;
        const open = r.data?.openTasks ?? 0;
        toast.success(
          next
            ? `${p.name} can sign in again.`
            : open > 0
              ? `${p.name} was deactivated. ${open} open task${open === 1 ? " is" : "s are"} still assigned to them — reassign from Tasks.`
              : `${p.name} was deactivated.`,
        );
      },
    });
  }

  return (
    <div className="space-y-6">
      <section aria-label="Roles" className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border bg-subtle p-4">
            <Pill tone={ROLE_TONE[r]}>{ROLE_LABEL[r]}</Pill>
            <p className="mt-2 text-xs leading-relaxed text-muted">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-md border bg-subtle p-0.5 text-[13px]">
          {(["active", "inactive"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded px-2.5 py-1 font-medium", tab === t ? "bg-bg shadow-xs" : "text-muted hover:text-fg")}
            >
              {t === "active" ? "Active" : "Deactivated"} <span className="text-faint">{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="h-8 w-full rounded-md border bg-bg pl-8 pr-2 text-[13px] placeholder:text-faint focus-visible:border-accent"
          />
        </div>
        <div className="flex-1" />
        <Button variant="primary" onClick={() => setModal({ type: "create" })}>
          <UserPlus className="size-4" /> Add team member
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-subtle text-[11px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-4 py-2 font-medium">Person</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Workload</th>
              <th className="px-3 py-2 font-medium">Last active</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((p) => (
              <tr key={p.id} className="hover:bg-hover/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar id={p.id} name={p.name} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {p.name} {p.id === currentUserId && <span className="text-xs font-normal text-faint">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{p.jobTitle ? `${p.jobTitle} · ` : ""}{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Pill>
                </td>
                <td className="px-3 py-2.5 text-muted">{p.teamName ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs tabular-nums text-muted">
                  {p.open} open
                  {p.overdue > 0 && <span className="font-medium text-danger"> · {p.overdue} overdue</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted" suppressHydrationWarning>
                  {p.lastLoginAt ? relativeTime(p.lastLoginAt) : "Never signed in"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <IconButton label="Edit" onClick={() => setModal({ type: "edit", person: p })}>
                      <Pencil className="size-3.5" />
                    </IconButton>
                    {p.id !== currentUserId && p.active && (
                      <IconButton label="Reset password" onClick={() => resetPassword(p)}>
                        <KeyRound className="size-3.5" />
                      </IconButton>
                    )}
                    {p.id !== currentUserId && (
                      <IconButton label={p.active ? "Deactivate" : "Reactivate"} onClick={() => toggleActive(p)} danger={p.active}>
                        {p.active ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                      </IconButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                  {q ? "No one matches that search." : tab === "active" ? "No active members." : "No one has been deactivated."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={modal?.type === "create"}
        onClose={closeIf("create")}
        title="Add team member"
        description="Create their account and choose what they can do."
      >
        <UserForm
          teams={teams}
          onCancel={() => setModal(null)}
          onSubmit={(v) =>
            run(() => createUser(v), {
              success: "Team member added",
              onDone: (r) => {
                if (r.ok && r.data) setModal({ type: "credentials", heading: "Account created", email: r.data.email, password: r.data.tempPassword });
              },
            })
          }
        />
      </Dialog>

      <Dialog open={modal?.type === "edit"} onClose={closeIf("edit")} title="Edit team member">
        {modal?.type === "edit" && (
          <UserForm
            key={modal.person.id}
            teams={teams}
            person={modal.person}
            lockRole={false}
            onCancel={() => setModal(null)}
            onSubmit={(v) => run(() => updateUser(modal.person.id, v), { onDone: (r) => r.ok && setModal(null) })}
          />
        )}
      </Dialog>

      <Dialog
        open={modal?.type === "credentials"}
        onClose={closeIf("credentials")}
        title={modal?.type === "credentials" ? modal.heading : ""}
        description="Share this securely. It's shown only once, and they'll be asked to choose their own password at first sign-in."
      >
        {modal?.type === "credentials" && <Credentials email={modal.email} password={modal.password} onClose={() => setModal(null)} />}
      </Dialog>
    </div>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("rounded-md p-1.5 text-muted hover:bg-hover", danger ? "hover:text-danger" : "hover:text-fg")}
    >
      {children}
    </button>
  );
}

function Credentials({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${email}\nTemporary password: ${password}`;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-subtle p-4 font-mono text-sm">
        <p>
          <span className="text-muted">Email</span> {email}
        </p>
        <p className="mt-1">
          <span className="text-muted">Password</span> <strong>{password}</strong>
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard unavailable */
            }
          }}
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function UserForm({
  teams,
  person,
  onSubmit,
  onCancel,
}: {
  teams: TeamRow[];
  person?: PersonRow;
  lockRole?: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const editing = !!person;
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [role, setRole] = useState<Role>(person?.role ?? "MEMBER");
  const [teamId, setTeamId] = useState(person?.teamId ?? "");
  const [jobTitle, setJobTitle] = useState(person?.jobTitle ?? "");
  const [password, setPassword] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(editing ? { name, role, teamId: teamId || null, jobTitle } : { name, email, role, teamId: teamId || null, jobTitle, password });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="u-name">
          <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={80} />
        </Field>
        <Field label="Job title" htmlFor="u-title">
          <Input id="u-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={80} placeholder="e.g. Designer" />
        </Field>
      </div>
      <Field label="Work email" htmlFor="u-email" hint={editing ? "Email can't be changed." : undefined}>
        <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={editing} autoComplete="off" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="u-role">
          <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Team" htmlFor="u-team">
          <Select id="u-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted">{ROLE_DESCRIPTION[role]}</p>
      {!editing && (
        <Field label="Temporary password" htmlFor="u-pass" hint="Leave blank to generate a secure one. They must change it at first sign-in.">
          <Input id="u-pass" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} autoComplete="off" placeholder="Auto-generate" />
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || !email.trim()}>
          {editing ? "Save changes" : "Create account"}
        </Button>
      </div>
    </form>
  );
}
