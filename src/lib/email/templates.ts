// Pure (no server-only import) so it can be unit-tested.

export type AssignmentEmailInput = {
  companyName: string;
  accentColor: string;
  assigneeName: string;
  assignerName: string;
  task: { title: string; description: string; priorityLabel: string; dueLabel: string | null };
  /** Absolute link to the task; omitted when the public URL isn't known. */
  url: string | null;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function excerpt(s: string, max = 280) {
  const t = oneLine(s);
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function assignmentEmail(i: AssignmentEmailInput): { subject: string; html: string; text: string } {
  const title = oneLine(i.task.title);
  const note = excerpt(i.task.description);
  const accent = /^#[0-9a-f]{6}$/i.test(i.accentColor) ? i.accentColor : "#4f46e5";
  const first = i.assigneeName.trim().split(/\s+/)[0] || "there";

  const subject = `${oneLine(i.assignerName)} assigned you a task: ${title}`;

  const meta = [
    ["Priority", i.task.priorityLabel],
    ["Due", i.task.dueLabel ?? "No deadline"],
  ] as const;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#37352f;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(oneLine(i.assignerName))} assigned you “${esc(title)}”.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td style="padding:0 4px 12px;font-size:13px;font-weight:600;color:#787774;">${esc(i.companyName)}</td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e6e5e1;border-radius:12px;padding:28px;">
      <p style="margin:0 0 16px;font-size:14px;color:#787774;">Hi ${esc(first)}, <strong style="color:#37352f;">${esc(oneLine(i.assignerName))}</strong> assigned you a task.</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:600;">${esc(title)}</h1>
      ${note ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#55534e;">${esc(note)}</p>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:13px;">
        ${meta.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#787774;">${k}</td><td style="padding:2px 0;font-weight:500;">${esc(v)}</td></tr>`).join("\n        ")}
      </table>
      ${i.url ? `<a href="${esc(i.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Open task</a>` : ""}
    </td></tr>
    <tr><td style="padding:14px 4px 0;font-size:12px;color:#a5a39e;">You're receiving this because a task was assigned to you in ${esc(i.companyName)}.</td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${first}, ${oneLine(i.assignerName)} assigned you a task.`,
    "",
    title,
    ...(note ? ["", note] : []),
    "",
    ...meta.map(([k, v]) => `${k}: ${v}`),
    ...(i.url ? ["", `Open task: ${i.url}`] : []),
    "",
    `— ${i.companyName}`,
  ].join("\n");

  return { subject, html, text };
}
