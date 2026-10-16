"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function PasswordForm({ forced = false }: { forced?: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Field label={forced ? "Temporary password" : "Current password"} htmlFor="current" error={fe.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="next" error={fe.next} hint="At least 8 characters.">
        <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && <p role="status" className="rounded-md bg-accent-soft px-3 py-2 text-sm">{state.success}</p>}
      <Button type="submit" variant="primary" className={forced ? "w-full" : ""} disabled={pending}>
        {pending ? "Saving…" : forced ? "Save and continue" : "Update password"}
      </Button>
    </form>
  );
}
