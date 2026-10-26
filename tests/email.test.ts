import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appBaseUrl, readEmailConfig } from "../src/lib/email/config";
import { assignmentEmail, type AssignmentEmailInput } from "../src/lib/email/templates";

describe("readEmailConfig", () => {
  const full = { BREVO_SMTP_LOGIN: "a1@smtp-brevo.com", BREVO_SMTP_KEY: "xsmtpsib-secret", EMAIL_FROM: "Acme <tasks@acme.test>" };

  it("is off until login, key and sender are all set", () => {
    assert.equal(readEmailConfig({}), null);
    assert.equal(readEmailConfig({ ...full, BREVO_SMTP_KEY: "" }), null);
    assert.equal(readEmailConfig({ ...full, EMAIL_FROM: "   " }), null);
    assert.equal(readEmailConfig({ ...full, BREVO_SMTP_LOGIN: undefined }), null);
  });
  it("defaults to Brevo's relay on 587", () => {
    assert.deepEqual(readEmailConfig(full), {
      host: "smtp-relay.brevo.com",
      port: 587,
      user: "a1@smtp-brevo.com",
      pass: "xsmtpsib-secret",
      from: "Acme <tasks@acme.test>",
    });
  });
  it("allows overriding host and port (e.g. 2525 when 587 is blocked)", () => {
    const c = readEmailConfig({ ...full, BREVO_SMTP_HOST: "relay.example", BREVO_SMTP_PORT: "2525" });
    assert.equal(c?.host, "relay.example");
    assert.equal(c?.port, 2525);
    assert.equal(readEmailConfig({ ...full, BREVO_SMTP_PORT: "nope" })?.port, 587);
  });
});

describe("appBaseUrl", () => {
  it("prefers APP_URL and strips trailing slashes", () => {
    assert.equal(appBaseUrl({ APP_URL: "https://tasks.acme.test//" }, { host: "other.test" }), "https://tasks.acme.test");
  });
  it("falls back to the request host", () => {
    assert.equal(appBaseUrl({}, { host: "tasks.acme.test", proto: "https" }), "https://tasks.acme.test");
    assert.equal(appBaseUrl({}, { host: "a.test, b.test", proto: "https, http" }), "https://a.test");
  });
  it("assumes http only for localhost", () => {
    assert.equal(appBaseUrl({}, { host: "localhost:3000" }), "http://localhost:3000");
    assert.equal(appBaseUrl({}, { host: "tasks.acme.test" }), "https://tasks.acme.test");
  });
  it("returns null when nothing is known", () => {
    assert.equal(appBaseUrl({}), null);
    assert.equal(appBaseUrl({}, { host: null }), null);
  });
});

describe("assignmentEmail", () => {
  const base: AssignmentEmailInput = {
    companyName: "Northwind Studio",
    accentColor: "#112233",
    assigneeName: "Jordan Lee",
    assignerName: "Alex Morgan",
    task: { title: "Ship the pricing page", description: "Copy is in Notion.", priorityLabel: "High", dueLabel: "Nov 3" },
    url: "https://tasks.acme.test/tasks?task=abc",
  };

  it("builds subject, html and text with the essentials", () => {
    const m = assignmentEmail(base);
    assert.equal(m.subject, "Alex Morgan assigned you a task: Ship the pricing page");
    for (const part of ["Hi Jordan", "Alex Morgan", "Ship the pricing page", "Copy is in Notion.", "High", "Nov 3", "Northwind Studio"]) {
      assert.ok(m.html.includes(part), `html has ${part}`);
      assert.ok(m.text.includes(part), `text has ${part}`);
    }
    assert.ok(m.html.includes('href="https://tasks.acme.test/tasks?task=abc"'));
    assert.ok(m.html.includes("background:#112233"));
    assert.ok(m.text.includes("Open task: https://tasks.acme.test/tasks?task=abc"));
  });

  it("escapes user-controlled text so it can't inject markup", () => {
    const m = assignmentEmail({
      ...base,
      assigneeName: '<img src=x onerror=alert(1)>',
      assignerName: "Eve <script>",
      task: { ...base.task, title: '"><script>alert(1)</script>', description: "<b>bold</b> & more" },
      url: 'https://x.test/?a="><script>',
    });
    assert.ok(!m.html.includes("<script>"));
    assert.ok(!m.html.includes("<img"));
    assert.ok(!m.html.includes("<b>bold"));
    assert.ok(m.html.includes("&lt;b&gt;bold&lt;/b&gt; &amp; more"));
  });

  it("keeps the subject on one line", () => {
    const m = assignmentEmail({ ...base, task: { ...base.task, title: "Line one\r\nBcc: evil@x.test" } });
    assert.ok(!/[\r\n]/.test(m.subject));
  });

  it("handles a missing deadline, description and link", () => {
    const m = assignmentEmail({ ...base, task: { ...base.task, description: "  ", dueLabel: null }, url: null });
    assert.ok(m.text.includes("Due: No deadline"));
    assert.ok(!m.html.includes("Open task"));
    assert.ok(!m.text.includes("Open task"));
  });

  it("truncates long descriptions", () => {
    const m = assignmentEmail({ ...base, task: { ...base.task, description: "word ".repeat(200) } });
    assert.ok(m.text.includes("…"));
    assert.ok(m.text.length < 600);
  });

  it("ignores an invalid accent colour", () => {
    const m = assignmentEmail({ ...base, accentColor: "red;background:url(x)" });
    assert.ok(!m.html.includes("url(x)"));
    assert.ok(m.html.includes("background:#4f46e5"));
  });
});
