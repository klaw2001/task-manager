// Dump the audio cue list (clicks, whooshes, typing ticks, …) declared by the composition.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
await p.goto("file://" + join(root, "composition", "index.html"));
const out = await p.evaluate(() => ({ total: window.TOTAL, events: window.collectEvents() }));
mkdirSync(join(root, "audio"), { recursive: true });
writeFileSync(join(root, "audio", "events.json"), JSON.stringify(out, null, 1));
const counts = {}; out.events.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
console.log("total", out.total, counts);
await b.close();
