// Parallel frame renderer.
//   node render/render.mjs [--fps 30] [--workers 4] [--from 0] [--to <frames>] [--dir frames]
// Each worker renders a contiguous chunk of frames from the time-seekable composition into PNGs.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const FPS = +arg("fps", 30), WORKERS = +arg("workers", 4), DIR = join(root, arg("dir", "frames"));
mkdirSync(DIR, { recursive: true });

const probe = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const pp = await probe.newPage();
await pp.goto("file://" + join(root, "composition", "index.html"));
const TOTAL = await pp.evaluate(() => window.TOTAL);
await probe.close();
const N = Math.round(TOTAL * FPS);
const from = +arg("from", 0), to = Math.min(+arg("to", N), N);
console.log(`total ${TOTAL}s · ${N} frames @ ${FPS}fps · rendering [${from}, ${to}) with ${WORKERS} workers`);

const chunk = Math.ceil((to - from) / WORKERS);
let done = 0;
const t0 = Date.now();
async function worker(id) {
  const a = from + id * chunk, b = Math.min(to, a + chunk);
  if (a >= b) return;
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files", "--disable-gpu-vsync"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error(`[w${id}] PAGE ERROR:`, e.message));
  await page.goto("file://" + join(root, "composition", "index.html"));
  for (let f = a; f < b; f++) {
    const path = join(DIR, `f${String(f).padStart(5, "0")}.png`);
    await page.evaluate((t) => window.render(t), f / FPS);
    await page.screenshot({ path, type: "png" });
    done++;
    if (done % 100 === 0) {
      const el = (Date.now() - t0) / 1000, rate = done / el;
      console.log(`${done}/${to - from}  ${rate.toFixed(2)} fps  eta ${(((to - from) - done) / rate / 60).toFixed(1)} min`);
    }
  }
  await browser.close();
}
await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
