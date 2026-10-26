// Render individual test frames:  node render/frame.mjs 12.5 40 ...   → out/test-<t>.png
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.env.OUT ?? join(root, "out", "test");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto("file://" + join(root, "composition", "index.html"));
console.log("total duration:", await page.evaluate(() => window.TOTAL));
for (const a of process.argv.slice(2)) {
  const t = parseFloat(a);
  await page.evaluate((t) => window.render(t), t);
  await page.screenshot({ path: join(out, `t${t.toFixed(2).padStart(7, "0")}.png`) });
  console.log("frame", t);
}
await browser.close();
