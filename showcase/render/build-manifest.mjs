// assets/manifest.json → composition/manifest.js (so the page can read it from file://)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const m = JSON.parse(readFileSync(join(root, "assets", "manifest.json"), "utf8"));
writeFileSync(join(root, "composition", "manifest.js"), `window.MANIFEST = ${JSON.stringify(m)};\n`);
console.log("manifest.js:", Object.keys(m).length, "assets");
