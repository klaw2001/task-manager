// Phase A — fresh, empty database: film the first-run setup flow.
// Run on an EMPTY database (rm -rf .data, restart `next dev`), before reset-seed.sh.
import { open, shot, typeFrames, settle, wait, BASE } from "./lib.mjs";

const { browser, page } = await open({ width: 1100, height: 1080, scale: 2 });

await page.goto(`${BASE}/setup`);
await settle(page, 600);
const rects = {
  company: page.locator("#companyName"),
  tz: page.locator("#timezone"),
  name: page.locator("#name"),
  email: page.locator("#email"),
  password: page.locator("#password"),
  sample: page.locator('label:has(input[name="sample"])'),
  submit: page.locator('button[type="submit"]'),
  card: page.locator("form").first(),
};
await shot(page, "setup-empty", { rects });

await typeFrames(page, page.locator("#companyName"), "Northwind Studio", "setup-company", { steps: 5, rects });
await page.selectOption("#timezone", "America/New_York").catch(() => {});
await wait(100);
await page.fill("#name", "Alex Morgan");
await page.fill("#email", "founder@example.com");
await page.fill("#password", "correct-horse-battery");
await shot(page, "setup-filled-nosample", { rects });
await page.check('input[name="sample"]');
await wait(150);
await shot(page, "setup-filled", { rects });

await Promise.all([page.waitForURL(/\/dashboard/, { timeout: 60000 }), page.click('button[type="submit"]')]);
await settle(page, 900);
await page.setViewportSize({ width: 1440, height: 900 });
await settle(page, 600);
await shot(page, "setup-done-dashboard");

await browser.close();
console.log("setup capture complete");
