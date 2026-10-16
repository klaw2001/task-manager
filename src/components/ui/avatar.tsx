import { cn, colorFor, initials } from "@/lib/utils";

export function Avatar({ id, name, size = 24, className }: { id: string; name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: colorFor(id), fontSize: Math.max(9, Math.round(size * 0.4)) }}
    >
      {initials(name)}
    </span>
  );
}
