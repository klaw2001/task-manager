import type { CSSProperties, ReactNode } from "react";
import { cn, readableOn } from "@/lib/utils";

/** Applies the company's accent colour to everything inside. */
export function BrandScope({ accent, children }: { accent: string; children: ReactNode }) {
  const style = { "--accent": accent, "--accent-fg": readableOn(accent) } as CSSProperties;
  return (
    <div className="contents" style={style}>
      {children}
    </div>
  );
}

export function CompanyMark({ name, logoUrl, size = 28, className }: { name: string; logoUrl?: string | null; size?: number; className?: string }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL on any host
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-md bg-subtle object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md bg-accent font-bold text-accent-fg", className)}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.trim().charAt(0).toUpperCase() || "•"}
    </span>
  );
}
