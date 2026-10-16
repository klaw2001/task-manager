import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../errors";
import type { ActionResult } from "../types";

/**
 * Wraps an action body: turns validation / permission errors into a typed
 * result the UI can show, and lets Next's redirect()/notFound() pass through.
 */
export async function run<T = void>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form.", fieldErrors };
    }
    console.error("[action] unexpected error", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  return schema.parse(input);
}
