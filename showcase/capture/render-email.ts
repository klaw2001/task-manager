// Renders the REAL assignment email (src/lib/email/templates.ts) for the demo data, so the video shows
// exactly what an assignee receives. Writes assets/email.html + assets/email.json.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assignmentEmail } from "../../src/lib/email/templates";
import { addDays, formatYmd, todayIn } from "../../src/lib/dates";
import { PRIORITY_LABEL } from "../../src/lib/constants";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(out, { recursive: true });
const today = todayIn("UTC");
const mail = assignmentEmail({
  companyName: "Northwind Studio",
  accentColor: "#4f46e5",
  assigneeName: "Priya Shah",
  assignerName: "Alex Morgan",
  task: {
    title: "Send Q4 proposal to Acme",
    description: "Pricing, timeline and next steps. Loop in Maya before it goes out.",
    priorityLabel: PRIORITY_LABEL.HIGH,
    dueLabel: formatYmd(addDays(today, 1), today),
  },
  url: "https://tasks.northwind.example/tasks?task=8f2c1a",
});
writeFileSync(join(out, "email.html"), mail.html);
writeFileSync(join(out, "email.json"), JSON.stringify({ subject: mail.subject, from: "Northwind Studio <tasks@northwind.example>", to: "Priya Shah" }, null, 1));
console.log("subject:", mail.subject);
