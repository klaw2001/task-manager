import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/constants";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-6 sm:px-8 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted">Your profile and sign-in details.</p>
      </header>

      <section aria-labelledby="profile-h" className="space-y-4">
        <h2 id="profile-h" className="text-base font-semibold">
          Profile
        </h2>
        <ProfileForm name={user.name} jobTitle={user.jobTitle ?? ""} email={user.email} />
        <p className="text-xs text-muted">
          Your role is <strong className="text-fg">{ROLE_LABEL[user.role]}</strong>. {ROLE_DESCRIPTION[user.role]}
        </p>
      </section>

      <hr />

      <section aria-labelledby="pw-h" className="space-y-4">
        <h2 id="pw-h" className="text-base font-semibold">
          Change password
        </h2>
        <div className="max-w-sm">
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
