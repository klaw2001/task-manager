import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { needsSetup } from "@/lib/data/company";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await needsSetup()) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Sign in to see what&apos;s on your plate.</p>
      <LoginForm next={next} />
    </>
  );
}
