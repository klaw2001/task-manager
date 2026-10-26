"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SHOW_DELAY = 300;
const WARM_WINDOW = 500;
const GAP = 6;
const EDGE = 8;

// Moving across a row of icons shouldn't re-pay the hover delay for each one.
let lastHiddenAt = 0;

/**
 * Label bubble for icon-only controls, shown on hover (after a short delay) and keyboard focus.
 *
 * It's a manual popover, so it lives in the top layer: never clipped by `overflow` containers,
 * not shifted by the blurred sticky header, and still visible inside a modal <dialog>.
 * Visual only (aria-hidden) — the wrapped control must carry its own aria-label.
 */
export function Tooltip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const detach = useRef<(() => void) | undefined>(undefined);

  function hide() {
    window.clearTimeout(timer.current);
    detach.current?.();
    detach.current = undefined;
    const t = tip.current;
    if (t?.matches(":popover-open")) {
      t.hidePopover();
      lastHiddenAt = Date.now();
    }
  }

  function show() {
    const r = root.current;
    const t = tip.current;
    if (!r || !t || typeof t.showPopover !== "function" || t.matches(":popover-open")) return;
    t.showPopover();

    const a = r.getBoundingClientRect();
    const b = t.getBoundingClientRect();
    const fitsBelow = a.bottom + GAP + b.height + EDGE <= window.innerHeight;
    t.style.top = `${fitsBelow ? a.bottom + GAP : Math.max(EDGE, a.top - GAP - b.height)}px`;
    t.style.left = `${Math.min(Math.max(a.left + a.width / 2 - b.width / 2, EDGE), window.innerWidth - b.width - EDGE)}px`;

    // Dismissible without moving the pointer (Esc), and never left floating after the page scrolls.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    detach.current = () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={root}
      className={cn("inline-flex", className)}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        timer.current = window.setTimeout(show, Date.now() - lastHiddenAt < WARM_WINDOW ? 0 : SHOW_DELAY);
      }}
      onPointerLeave={hide}
      // Only keyboard focus (not the focus a mouse click leaves behind) should pop the tooltip.
      onFocus={(e) => e.target.matches(":focus-visible") && show()}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      <span
        ref={tip}
        popover="manual"
        aria-hidden="true"
        className="anim-fade-in pointer-events-none inset-auto w-max max-w-64 rounded-md bg-fg px-2 py-1 text-xs font-medium text-bg shadow-pop"
      >
        {label}
      </span>
    </span>
  );
}
