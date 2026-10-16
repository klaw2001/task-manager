import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/data/company";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  return (
    <>
      <h1 className="text-xl font-semibold">Set up your workspace</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Create your company and the first admin account. You&apos;ll add teammates and assign roles next.
      </p>
      <SetupForm requireKey={!!process.env.SETUP_KEY} />
    </>
  );
}
