"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type PillOption = { value: string; label: string };

/**
 * A pill (or plain chip) that is secretly a native <select>: Notion-style
 * property editing with full keyboard / screen-reader / mobile support.
 */
export function PillSelect({
  value,
  options,
  onChange,
  tone,
  dot,
  disabled,
  ariaLabel,
  children,
  className,
}: {
  value: string;
  options: PillOption[];
  onChange: (value: string) => void;
  tone?: Tone;
  dot?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  /** Visible content; defaults to the selected option's label. */
  children?: ReactNode;
  className?: string;
}) {
  const label = options.find((o) => o.value === value)?.label ?? "—";
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 whitespace-nowrap focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
        tone ? ["pill", `tone-${tone}`, "pr-1.5"] : "h-7 rounded-md px-2 text-sm hover:bg-hover",
        disabled && "opacity-80",
        className,
      )}
    >
      {tone && dot && <span className="pill-dot" />}
      {children ?? label}
      {!disabled && <ChevronDown className="size-3 shrink-0 opacity-50" aria-hidden />}
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
