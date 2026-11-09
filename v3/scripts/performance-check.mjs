import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const budget = JSON.parse(await readFile("performance-budget.json", "utf8"));
const checks = [
  ["JavaScript statique", await sizeOf(".next/static/chunks", ".js"), budget.maxStaticJavaScriptBytes],
  ["CSS statique", await sizeOf(".next/static/css", ".css"), budget.maxStaticCssBytes],
  ["Plus grande image publique", await largestFile("public", /\.(avif|webp|png|jpe?g)$/iu), budget.maxPublicImageBytes],
];
let failed = false;
for (const [label, actual, limit] of checks) { const ok = actual <= limit; failed ||= !ok; console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${actual} / ${limit} bytes`); }
if (failed) process.exitCode = 1;

async function sizeOf(directory, extension) { try { const matches = (await files(directory)).filter((file) => file.endsWith(extension)); const sizes = await Promise.all(matches.map(async (file) => (await stat(file)).size)); return sizes.reduce((sum, size) => sum + size, 0); } catch { return Number.POSITIVE_INFINITY; } }
async function largestFile(directory, pattern) { const matches = (await files(directory)).filter((file) => pattern.test(file)); return Math.max(0, ...await Promise.all(matches.map(async (file) => (await stat(file)).size))); }
async function files(directory) { const result = []; for (const entry of await readdir(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); if (entry.isDirectory()) result.push(...await files(target)); else result.push(target); } return result; }
