"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; tone: "success" | "error"; message: string };
type Api = { success: (m: string) => void; error: (m: string) => void };

const ToastContext = createContext<Api | null>(null);

export function useToast(): Api {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Toast["tone"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3000);
  }, []);

  const api = useMemo<Api>(() => ({ success: (m) => push("success", m), error: (m) => push("error", m) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "anim-pop-in pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg border bg-bg px-3.5 py-2.5 text-sm shadow-pop",
              t.tone === "error" && "border-danger/40",
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              aria-label="Dismiss"
              className="-mr-1 rounded p-0.5 text-faint hover:bg-hover hover:text-fg"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
