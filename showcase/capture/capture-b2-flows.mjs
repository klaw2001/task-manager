// Phase B2 — interactive flows that CHANGE data. Run once after reset-seed.sh (re-run reset-seed.sh first to repeat).
import { open, login, shot, typeFrames, elementShot, settle, wait, BASE } from "./lib.mjs";

const attempt = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${label}:`, e.message.split("\n")[0]);
  }
};

const { browser, page } = await open();
page.on("dialog", (d) => d.accept()); // native confirm() prompts (delete / reset / deactivate)
await login(page, "founder@example.com");
const dlg = () => page.locator("dialog[open]");
const nav = { bell: page.getByRole("button", { name: /Notifications/ }), newTask: page.getByRole("button", { name: "New task" }) };
const P = page.locator('aside[role="dialog"]');
const peekRects = () => ({
  panel: P,
  status: P.locator('select[aria-label="Status"]'),
  assignee: P.locator('select[aria-label="Assignee"]'),
  deadline: P.locator('input[aria-label="Deadline"]'),
  priority: P.locator('select[aria-label="Priority"]'),
  comments: page.locator('section[aria-label="Comments"]'),
  commentBox: page.getByLabel("Write a comment"),
  commentBtn: page.getByRole("button", { name: "Comment", exact: true }),
  saving: page.locator('aside[role="dialog"] header span').first(),
});

// ───────────── Side-peek: edit inline, comment ─────────────
await attempt("peek edits", async () => {
  await page.goto(`${BASE}/tasks?scope=all`);
  await settle(page, 500);
  await page.getByRole("link", { name: "Add rate limiting to the public API" }).first().click();
  await page.waitForURL(/task=/);
  await settle(page, 700);
  await shot(page, "pe-0-open", { rects: peekRects() });
  await P.locator('select[aria-label="Priority"]').selectOption("URGENT");
  await settle(page, 700);
  await shot(page, "pe-1-priority", { rects: peekRects() });
  await P.locator('select[aria-label="Status"]').selectOption("DONE");
  await settle(page, 700);
  await shot(page, "pe-2-status", { rects: peekRects() });
  await page.locator('aside[role="dialog"] .overflow-y-auto').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await wait(200);
  await typeFrames(page, page.getByLabel("Write a comment"), "Load test passed — shipping this tonight.", "pe-3-comment", { steps: 4, rects: peekRects() });
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await settle(page, 900);
  await page.locator('aside[role="dialog"] .overflow-y-auto').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await wait(300);
  await shot(page, "pe-4-commented", { rects: peekRects() });
  await page.locator("summary", { hasText: "Activity" }).click();
  await page.locator('aside[role="dialog"] .overflow-y-auto').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await wait(300);
  await shot(page, "pe-5-activity", { rects: peekRects() });
  await page.keyboard.press("Escape");
  await settle(page, 400);
});

// ───────────── New task (press "c") ─────────────
await attempt("new task", async () => {
  await page.goto(`${BASE}/tasks?scope=all`);
  await settle(page, 600);
  await page.keyboard.press("c");
  await wait(400);
  const ntRects = () => ({
    dialog: dlg(),
    title: page.locator("#nt-title"),
    desc: page.locator("#nt-desc"),
    assignee: page.locator("#nt-assignee"),
    priority: page.locator("#nt-priority"),
    due: page.locator("#nt-due"),
    chipTomorrow: page.getByRole("button", { name: "Tomorrow" }),
    chipToday: page.getByRole("button", { name: "Today", exact: true }),
    chipWeek: page.getByRole("button", { name: "Next week" }),
    tags: page.locator("#nt-tags"),
    create: page.getByRole("button", { name: "Create task" }),
  });
  await shot(page, "nt-0-empty", { rects: ntRects() });
  await typeFrames(page, page.locator("#nt-title"), "Send Q4 proposal to Acme", "nt-1-title", { steps: 4, rects: ntRects() });
  await page.locator("#nt-desc").fill("Pricing, timeline and next steps. Loop in Maya before it goes out.");
  await page.locator("#nt-assignee").selectOption({ label: "Priya Shah" });
  await page.locator("#nt-priority").selectOption("HIGH");
  await wait(100);
  await shot(page, "nt-2-assign", { rects: ntRects() });
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await page.locator("#nt-tags").fill("sales, q4");
  await wait(150);
  await shot(page, "nt-3-filled", { rects: ntRects() });
  await page.getByRole("button", { name: "Create task" }).click();
  await settle(page, 1000);
  await shot(page, "nt-4-created", { rects: { toast: page.locator('[role="status"]'), row: page.locator("li", { hasText: "Send Q4 proposal to Acme" }).first() } });
});

// ───────────── Board: drag a card ─────────────
await attempt("board drag", async () => {
  await page.goto(`${BASE}/tasks?scope=all&view=board`);
  await settle(page, 700);
  const card = page.locator('section[aria-label="In progress"] li', { hasText: "Fix checkout timeout" });
  const target = page.locator('section[aria-label="In review"]');
  const rects = { card, target, colProg: page.locator('section[aria-label="In progress"]'), colReview: target };
  await shot(page, "bd-0-idle", { rects });
  await elementShot(card, "drag-card");
  const cb = await card.boundingBox();
  const tb = await target.boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height - 10);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + 24, cb.y + cb.height + 2, { steps: 4 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + 330, { steps: 18 });
  await wait(250);
  await shot(page, "bd-1-dragging", { rects });
  await page.mouse.up();
  await settle(page, 900);
  await shot(page, "bd-2-dropped", { rects: { ...rects, cardAfter: page.locator('section[aria-label="In review"] li', { hasText: "Fix checkout timeout" }) } });
});

// ───────────── Brand colour recolours the whole app ─────────────
await attempt("brand colours", async () => {
  await page.goto(`${BASE}/admin/company`);
  await settle(page, 700);
  const colors = { emerald: "#059669", rose: "#e11d48", violet: "#7c3aed", amber: "#d97706", indigo: "#4f46e5" };
  for (const [name, hex] of Object.entries(colors)) {
    await page.locator(`button[aria-label="Use ${hex}"]`).click();
    await wait(200);
    await shot(page, `brand-pick-${name}`, {
      rects: { swatches: page.locator('fieldset:has(legend:text("Brand colour"))'), swatch: page.locator(`button[aria-label="Use ${hex}"]`), preview: page.locator("aside").last(), save: page.getByRole("button", { name: "Save changes" }) },
    });
    await page.getByRole("button", { name: "Save changes" }).click();
    await settle(page, 1000);
    await shot(page, `brand-saved-${name}`, { rects: { toast: page.locator('[role="status"]') } });
  }
  // whole-app recolour on the dashboard for two hues
  for (const [name, hex] of [["emerald", "#059669"], ["rose", "#e11d48"]]) {
    await page.goto(`${BASE}/admin/company`);
    await settle(page, 500);
    await page.locator(`button[aria-label="Use ${hex}"]`).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await settle(page, 900);
    await page.goto(`${BASE}/dashboard`);
    await settle(page, 600);
    await shot(page, `brand-dash-${name}`);
    await page.goto(`${BASE}/tasks?scope=all&view=board`);
    await settle(page, 600);
    await shot(page, `brand-board-${name}`);
  }
  await page.goto(`${BASE}/admin/company`);
  await settle(page, 500);
  await page.locator('button[aria-label="Use #4f46e5"]').click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await settle(page, 900);
});

// ───────────── People & roles ─────────────
let tempPassword = "";
await attempt("people", async () => {
  await page.goto(`${BASE}/admin/people`);
  await settle(page, 700);
  await page.getByRole("button", { name: "Add team member" }).click();
  await wait(400);
  const pr = () => ({
    dialog: dlg(),
    name: page.locator("#u-name"),
    title: page.locator("#u-title"),
    email: page.locator("#u-email"),
    role: page.locator("#u-role"),
    team: page.locator("#u-team"),
    pass: page.locator("#u-pass"),
    create: page.getByRole("button", { name: "Create account" }),
  });
  await shot(page, "pm-0-empty", { rects: pr() });
  await typeFrames(page, page.locator("#u-name"), "Taylor Kim", "pm-1-name", { steps: 3, rects: pr() });
  await page.locator("#u-title").fill("Product Designer");
  await page.locator("#u-email").fill("taylor@northwind.example");
  await page.locator("#u-role").selectOption("MANAGER");
  await page.locator("#u-team").selectOption({ label: "Design" });
  await wait(200);
  await shot(page, "pm-2-filled", { rects: pr() });
  await page.getByRole("button", { name: "Create account" }).click();
  await settle(page, 1200);
  tempPassword = (await page.locator("dialog[open] strong").first().textContent()) ?? "";
  console.log("  temp password captured:", tempPassword.replace(/./g, "•"));
  await shot(page, "pm-3-credentials", { rects: { dialog: dlg(), creds: page.locator("dialog[open] .font-mono"), copy: page.getByRole("button", { name: "Copy" }), done: page.getByRole("button", { name: "Done" }) } });
  await page.getByRole("button", { name: "Done" }).click();
  await settle(page, 600);
  await shot(page, "pm-4-after-add", { rects: { row: page.locator("tr", { hasText: "Taylor Kim" }), table: page.locator("table") } });

  // reset password
  await page.locator("tr", { hasText: "Taylor Kim" }).getByRole("button", { name: "Reset password" }).click();
  await settle(page, 1200);
  await shot(page, "pm-5-reset", { rects: { dialog: dlg(), creds: page.locator("dialog[open] .font-mono") } });
  await page.getByRole("button", { name: "Done" }).click();
  await settle(page, 500);
  tempPassword = tempPassword; // keep the first one for the forced-change screen (the reset one invalidates it → re-read below)
  await page.locator("tr", { hasText: "Taylor Kim" }).getByRole("button", { name: "Reset password" }).click();
  await settle(page, 1200);
  tempPassword = (await page.locator("dialog[open] strong").first().textContent()) ?? tempPassword;
  await page.getByRole("button", { name: "Done" }).click();
  await settle(page, 400);

  // last-admin guard: try demoting yourself
  await page.locator("tr", { hasText: "Alex Morgan" }).getByRole("button", { name: "Edit" }).click();
  await wait(400);
  await page.locator("#u-role").selectOption("MEMBER");
  await wait(150);
  await shot(page, "pm-6-demote", { rects: { dialog: dlg(), role: page.locator("#u-role"), save: page.getByRole("button", { name: "Save changes" }) } });
  await page.getByRole("button", { name: "Save changes" }).click();
  await settle(page, 900);
  await shot(page, "pm-7-last-admin", { rects: { dialog: dlg(), toast: page.locator('[role="alert"], [role="status"]'), role: page.locator("#u-role") } });
  await page.keyboard.press("Escape");
  await settle(page, 400);

  // deactivate (confirm accepted automatically)
  await page.locator("tr", { hasText: "Taylor Kim" }).getByRole("button", { name: "Deactivate" }).click();
  await settle(page, 1000);
  await shot(page, "pm-8-deactivated", { rects: { toast: page.locator('[role="status"]'), tabs: page.getByRole("tablist") } });
  await page.getByRole("tab", { name: /Deactivated/ }).click();
  await wait(300);
  await shot(page, "pm-9-inactive-tab", { rects: { table: page.locator("table"), tabs: page.getByRole("tablist") } });
  await page.locator("tr", { hasText: "Taylor Kim" }).getByRole("button", { name: "Reactivate" }).click();
  await settle(page, 800);
});

// ───────────── Teams ─────────────
await attempt("teams", async () => {
  await page.goto(`${BASE}/admin/teams`);
  await settle(page, 600);
  await page.getByRole("button", { name: "New team" }).click();
  await wait(400);
  await typeFrames(page, page.locator("#t-name"), "Customer Success", "tm-0-name", { steps: 3, rects: { dialog: dlg() } });
  await page.locator("#t-desc").fill("Onboarding, support and renewals.");
  await shot(page, "tm-1-filled", { rects: { dialog: dlg(), name: page.locator("#t-name"), desc: page.locator("#t-desc") } });
  await page.getByRole("button", { name: "Create team" }).click();
  await settle(page, 900);
  await shot(page, "tm-2-created", { rects: { grid: page.locator("ul.grid"), card: page.locator("li", { hasText: "Customer Success" }) } });
});
await browser.close();

// ───────────── Forced password change for a brand-new member ─────────────
await attempt("forced password change", async () => {
  const b = await open({ width: 1100, height: 900, scale: 2 });
  await b.page.goto(`${BASE}/login`);
  await b.page.fill("#email", "taylor@northwind.example");
  await b.page.fill("#password", tempPassword.trim());
  await b.page.click('button[type="submit"]');
  await b.page.waitForURL(/change-password|dashboard/, { timeout: 30000 });
  await settle(b.page, 700);
  console.log("  new member landed on", b.page.url());
  await shot(b.page, "pw-forced", { rects: { card: b.page.locator("form").first() } });
  await b.browser.close();
});

// ───────────── Sign-in screens: error + lockout ─────────────
await attempt("login screens", async () => {
  const b = await open({ width: 1100, height: 900, scale: 2 });
  await b.page.goto(`${BASE}/login`);
  await settle(b.page, 600);
  const rects = { card: b.page.locator("form").first(), email: b.page.locator("#email"), pw: b.page.locator("#password"), submit: b.page.locator('button[type="submit"]') };
  await shot(b.page, "login-empty", { rects });
  for (let i = 0; i < 5; i++) {
    await b.page.fill("#email", "sam@example.com");
    await b.page.fill("#password", `wrong-password-${i}`);
    await b.page.click('button[type="submit"]');
    await settle(b.page, 700);
    if (i === 0) await shot(b.page, "login-wrong", { rects: { ...rects, error: b.page.locator('[role="alert"]') } });
  }
  await b.page.fill("#email", "sam@example.com");
  await b.page.fill("#password", "demo1234");
  await b.page.click('button[type="submit"]');
  await settle(b.page, 800);
  await shot(b.page, "login-locked", { rects: { ...rects, error: b.page.locator('[role="alert"]') } });
  await b.browser.close();
});

// ───────────── Member: claim an unassigned task + personal-task composer ─────────────
await attempt("member claim", async () => {
  const b = await open();
  await login(b.page, "jordan@example.com");
  await b.page.goto(`${BASE}/tasks?scope=all`);
  await settle(b.page, 600);
  await b.page.getByRole("link", { name: "Set up customer support inbox" }).first().click();
  await b.page.waitForURL(/task=/);
  await settle(b.page, 700);
  const claimRects = () => ({ panel: b.page.locator('aside[role="dialog"]'), claim: b.page.getByRole("button", { name: "Assign to me" }), status: b.page.locator('select[aria-label="Status"]') });
  await shot(b.page, "claim-0", { rects: claimRects() });
  await b.page.getByRole("button", { name: "Assign to me" }).click();
  await settle(b.page, 900);
  await shot(b.page, "claim-1", { rects: { ...claimRects(), assignee: b.page.locator('aside[role="dialog"] dd').nth(1) } });
  await b.page.keyboard.press("Escape");
  await settle(b.page, 400);
  await b.page.keyboard.press("c");
  await wait(400);
  await shot(b.page, "mem-newtask", { rects: { dialog: b.page.locator("dialog[open]"), assignee: b.page.locator("#nt-assignee") } });
  await b.browser.close();
});

console.log("interactive capture complete");
