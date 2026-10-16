import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRolePage } from "@/lib/auth/session";
import { getCompany } from "@/lib/data/company";
import { CompanyForm } from "@/components/admin/company-form";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyPage() {
  await requireRolePage("ADMIN");
  const company = await getCompany();
  if (!company) redirect("/setup");
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Company profile</h1>
        <p className="mt-0.5 text-sm text-muted">Manage how {company.name} looks and behaves for everyone.</p>
      </header>
      <CompanyForm company={company} />
    </div>
  );
}
