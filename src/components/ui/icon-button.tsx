import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

/** Icon-only button. `label` is both its accessible name and its tooltip. */
export function IconButton({
  label,
  danger,
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> & { label: string; danger?: boolean }) {
  return (
    <Tooltip label={label}>
      <button
        type={type}
        aria-label={label}
        className={cn("rounded-md p-1.5 text-muted hover:bg-hover", danger ? "hover:text-danger" : "hover:text-fg", className)}
        {...props}
      />
    </Tooltip>
  );
}
