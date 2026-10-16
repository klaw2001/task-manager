import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-5xl font-bold text-faint">404</p>
      <h1 className="text-lg font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-muted">It may have moved, or you might not have access to it.</p>
      <Link href="/dashboard" className={buttonStyles("primary")}>
        Back to dashboard
      </Link>
    </div>
  );
}
