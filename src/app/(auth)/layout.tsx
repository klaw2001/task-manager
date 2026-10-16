import { BrandScope, CompanyMark } from "@/components/layout/brand";
import { getCompany } from "@/lib/data/company";
import { DEFAULT_ACCENT } from "@/lib/constants";

// Reads the database on every request — never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const company = await getCompany();
  return (
    <BrandScope accent={company?.accentColor ?? DEFAULT_ACCENT}>
      <div className="flex min-h-dvh flex-col items-center justify-center bg-subtle px-4 py-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <CompanyMark name={company?.name ?? "T"} logoUrl={company?.logoUrl} size={44} />
          {company && (
            <div>
              <p className="text-lg font-semibold leading-tight">{company.name}</p>
              {company.tagline && <p className="text-sm text-muted">{company.tagline}</p>}
            </div>
          )}
        </div>
        <div className="anim-pop-in w-full max-w-sm rounded-xl border bg-bg p-6 shadow-pop sm:p-7">{children}</div>
        <p className="mt-6 text-xs text-faint">Your tasks. Your deadlines. Nothing overdue left behind.</p>
      </div>
    </BrandScope>
  );
}
