"use client";

import { useState, type FormEvent } from "react";
import { updateProfile } from "@/lib/actions/people";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";

export function ProfileForm({ name: initialName, jobTitle: initialTitle, email }: { name: string; jobTitle: string; email: string }) {
  const { pending, run } = useAction();
  const [name, setName] = useState(initialName);
  const [jobTitle, setJobTitle] = useState(initialTitle);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => updateProfile({ name, jobTitle }), { onDone: (r) => setErrors(r.ok ? {} : (r.fieldErrors ?? {})) });
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor="p-name" error={errors.name}>
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </Field>
      <Field label="Job title" htmlFor="p-title" error={errors.jobTitle}>
        <Input id="p-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={80} placeholder="e.g. Product Designer" />
      </Field>
      <Field label="Email" htmlFor="p-email" hint="Ask an admin if this needs to change." className="sm:col-span-2">
        <Input id="p-email" value={email} disabled />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
