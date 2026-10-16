/** Build a /tasks URL from the current (serialisable) filter params plus a patch. */
export function tasksHref(query: Record<string, string>, patch: Record<string, string | null> = {}) {
  const p = new URLSearchParams(query);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `/tasks?${s}` : "/tasks";
}
