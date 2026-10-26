// Shared helpers for filming the real app with Playwright.
// Every screenshot is a genuine render of the running product at 2x pixel density.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(ASSETS, { recursive: true });
const MANIFEST = join(ASSETS, "manifest.json");

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** manifest.json maps every asset to { w, h, url, rects } so the composition knows what it is placing. */
function record(name, entry) {
  const m = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  m[name] = entry;
  writeFileSync(MANIFEST, JSON.stringify(m, null, 1));
}

/** Open a browser context that renders crisp, deterministic frames. */
export async function open({ width = 1440, height = 900, scale = 2, dark = false, mobile = false } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: dark ? "dark" : "light",
    reducedMotion: "reduce", // animations resolve instantly → frames never catch a half-finished transition
    isMobile: mobile,
    hasTouch: mobile,
    locale: "en-US",
    timezoneId: "UTC",
  });
  const page = await context.newPage();
  // Hide the Next.js dev badge so it never leaks into footage.
  await page.addInitScript(() => {
    const add = () => {
      const host = document.head || document.documentElement;
      if (!host || document.getElementById("__hide-dev")) return;
      const s = document.createElement("style");
      s.id = "__hide-dev";
      s.textContent = "nextjs-portal,[data-nextjs-dev-tools-button],[data-next-badge-root]{display:none!important}";
      host.appendChild(s);
    };
    add();
    document.addEventListener("DOMContentLoaded", add);
    new MutationObserver(add).observe(document, { childList: true, subtree: true });
  });
  return { browser, context, page };
}

export async function login(page, email, password = "demo1234") {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL(/\/(dashboard|tasks|change-password)/, { timeout: 30000 }), page.click('button[type="submit"]')]);
  await settle(page);
}

export async function settle(page, ms = 350) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await wait(ms);
}

/** Bounding boxes (CSS px, viewport coords) for a { key: Locator } map. */
export async function rectsOf(map = {}) {
  const out = {};
  for (const [k, loc] of Object.entries(map)) {
    try {
      const b = await loc.first().boundingBox({ timeout: 1500 });
      if (b) out[k] = { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
    } catch {
      /* element not on screen in this frame */
    }
  }
  return out;
}

/** Save a viewport screenshot to assets/<name>.png and register it. */
export async function shot(page, name, { rects, full = false } = {}) {
  const vp = page.viewportSize();
  const r = await rectsOf(rects);
  await page.screenshot({ path: join(ASSETS, `${name}.png`), fullPage: full });
  const h = full ? await page.evaluate(() => document.documentElement.scrollHeight) : vp.height;
  record(name, { w: vp.width, h, url: page.url().replace(BASE, ""), full, rects: r });
  console.log("  •", name, full ? `(full ${h}px)` : "");
}

/** Capture the page at scroll 0 twice — viewport (for fixed chrome) and full page (for the scrolling content). */
export async function shotScrollable(page, name, opts = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(120);
  await shot(page, `${name}-top`, opts);
  await shot(page, `${name}-full`, { ...opts, full: true });
}

/** Type text in growing chunks, shooting a frame after each — gives the composition real typing footage. */
export async function typeFrames(page, locator, text, name, { steps = 5, rects } = {}) {
  const n = text.length;
  const cuts = [...new Set(Array.from({ length: steps }, (_, i) => Math.max(1, Math.round(((i + 1) / steps) * n))))];
  let i = 0;
  for (const c of cuts) {
    await locator.fill(text.slice(0, c));
    await wait(80);
    await shot(page, `${name}-${i++}`, { rects });
  }
  return cuts.length;
}

/** Save an element's own pixels (e.g. a Kanban card) with a transparent surround. */
export async function elementShot(locator, name) {
  const b = await locator.first().boundingBox();
  await locator.first().screenshot({ path: join(ASSETS, `${name}.png`), omitBackground: true });
  record(name, { w: Math.round(b.width), h: Math.round(b.height), url: "", full: false, rects: {} });
  console.log("  •", name, "(element)");
}

export const log = (...a) => console.log(...a);
