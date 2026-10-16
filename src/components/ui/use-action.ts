"use client";

import { useTransition } from "react";
import type { ActionResult } from "@/lib/types";
import { useToast } from "./toast";

/** Runs a server action in a transition and surfaces success/error as toasts. */
export function useAction() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function run<T>(
    fn: () => Promise<ActionResult<T>>,
    opts: { success?: string | false; onDone?: (result: ActionResult<T>) => void } = {},
  ) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) toast.error(result.error);
        else if (opts.success !== false) {
          const msg = opts.success ?? result.message;
          if (msg) toast.success(msg);
        }
        opts.onDone?.(result);
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return { pending, run };
}
