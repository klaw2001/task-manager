import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTE = [
  "#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308",
  "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b",
];

/** Stable colour per id so a person always looks the same. */
export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function parseTags(input: string | string[] | undefined | null): string[] {
  const raw = Array.isArray(input) ? input : (input ?? "").split(",");
  const seen = new Set<string>();
  for (const t of raw) {
    const clean = t.trim().replace(/^#/, "").toLowerCase().slice(0, 24);
    if (clean) seen.add(clean);
  }
  return [...seen].slice(0, 8);
}

/** Pick black or white text for a given hex background. */
export function readableOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#111827" : "#ffffff";
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
