// Phase C — additions for features shipped after the first capture pass:
//   • tooltips on icon-only buttons (hover bell / theme toggle / row actions)
//   • the real assignment email, rendered from the app's own template
// Needs the dev server on :3000 with demo data (reset-seed.sh) and `npx tsx capture/render-email.ts` run first.
import { open, login, shot, settle, wait, BASE, ASSETS } from "./lib.mjs";
import { join } from "node:path";

const { browser, page } = await open();
await login(page, "founder@example.com");
await page.goto(`${BASE}/dashboard`);
await settle(page, 700);
await shot(page, "v2-dash-top");

const hover = async (loc, name, rects = {}) => {
  await page.mouse.move(700, 500);
  await wait(250);
  await loc.hover();
  await wait(750); // 300 ms tooltip delay + fade
  await shot(page, name, { rects: { target: loc, tip: page.locator("[popover]:popover-open"), ...rects } });
};
await hover(page.getByRole("button", { name: /Notifications/ }), "tip-bell");
await hover(page.getByRole("button", { name: "Toggle dark mode" }), "tip-theme");

await page.goto(`${BASE}/admin/people`);
await settle(page, 700);
const row = page.locator("tr", { hasText: "Jordan Lee" });
await shot(page, "v2-people-top");
await hover(row.getByRole("button", { name: "Reset password" }), "tip-reset");
await hover(row.getByRole("button", { name: "Deactivate" }), "tip-deactivate");
await browser.close();

// the email
const mail = await open({ width: 568, height: 700, scale: 2 });
await mail.page.goto("file://" + join(ASSETS, "email.html"));
await wait(300);
const h = await mail.page.evaluate(() => document.documentElement.scrollHeight);
await mail.page.setViewportSize({ width: 568, height: h });
await wait(150);
await shot(mail.page, "email-assign");
await mail.browser.close();
console.log("additions captured");
