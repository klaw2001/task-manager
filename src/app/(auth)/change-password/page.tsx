import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PasswordForm } from "@/components/settings/password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/dashboard");
  return (
    <>
      <h1 className="text-xl font-semibold">Choose your own password</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Hi {user.name.split(" ")[0]} — your admin gave you a temporary password. Replace it with one only you know.
      </p>
      <PasswordForm forced />
    </>
  );
}
