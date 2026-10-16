"use client";

import { useActionState, useEffect, useRef } from "react";
import { setupAction } from "@/lib/actions/auth";
import { TIMEZONES } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

export function SetupForm({ requireKey }: { requireKey: boolean }) {
  const [state, action, pending] = useActionState(setupAction, undefined);
  const tzRef = useRef<HTMLSelectElement>(null);

  // Preselect the browser's timezone (DOM sync only — no state needed).
  useEffect(() => {
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tzRef.current && !tzRef.current.dataset.touched && guess && TIMEZONES.includes(guess)) tzRef.current.value = guess;
  }, []);

  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <form action={action} className="space-y-4">
      {requireKey && (
        <Field label="Setup key" htmlFor="setupKey" error={fe.setupKey} hint="The SETUP_KEY you configured for this deployment.">
          <Input id="setupKey" name="setupKey" type="password" required autoComplete="off" />
        </Field>
      )}
      <Field label="Company name" htmlFor="companyName" error={fe.companyName}>
        <Input id="companyName" name="companyName" required autoFocus maxLength={80} defaultValue={v.companyName} placeholder="Acme Inc." />
      </Field>
      <Field label="Timezone" htmlFor="timezone" error={fe.timezone} hint="Deadlines and “overdue” are judged in this timezone.">
        <Select
          id="timezone"
          name="timezone"
          ref={tzRef}
          defaultValue={v.timezone ?? "UTC"}
          onChange={(e) => (e.currentTarget.dataset.touched = "1")}
        >
          {TIMEZONES.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <hr />
      <Field label="Your name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" required autoComplete="name" maxLength={80} defaultValue={v.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" defaultValue={v.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password} hint="At least 8 characters.">
        <Input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
      </Field>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
        <input type="checkbox" name="sample" defaultChecked={v.sample === "on"} className="mt-0.5 accent-[var(--accent)]" />
        <span>
          Start with sample data
          <span className="block text-xs text-muted">
            Adds four teammates, teams and ~20 tasks so you can explore. Sample teammates have random passwords — reset one in People &amp; roles to sign in as them. Easy to ignore, or remove later by deactivating them.
          </span>
        </span>
      </label>
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
