import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const ignoredDirectories = new Set(["node_modules", ".next", "coverage", "playwright-report", "test-results", ".artifacts"]);
const files = walk(rootPath)
  .filter((file) => !/package-lock\.json$|quran-v1\.json$|\.example$|scripts[\\/]check-secrets\.mjs$/.test(file));
const patterns = [
  { name: "private key", value: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "OpenAI-style secret", value: /\bsk-[A-Za-z0-9_-]{24,}\b/ },
  { name: "live service-role assignment", value: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!replace|example|test)[^\s]{20,}/ },
  { name: "embedded bearer token", value: /authorization["']?\s*[:=]\s*["']Bearer\s+[A-Za-z0-9._-]{20,}/i },
];
const findings = [];
for (const file of files) {
  let content;
  try { content = readFileSync(path.join(rootPath, file), "utf8"); } catch { continue; }
  for (const pattern of patterns) if (pattern.value.test(content)) findings.push(`${file}: ${pattern.name}`);
}
if (findings.length) {
  console.error(`Potential committed secrets detected:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} project files).`);

function walk(directory, prefix = "") {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && (ignoredDirectories.has(entry.name) || entry.name.startsWith(".next-stale-"))) continue;
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) output.push(...walk(path.join(directory, entry.name), relative));
    else if (entry.isFile()) output.push(relative);
  }
  return output;
}
