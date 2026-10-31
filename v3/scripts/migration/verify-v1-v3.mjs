import { readFile } from "node:fs/promises";

const fields = ["users", "students", "teachers", "progressions", "classes", "messages"];
const args = new Map(process.argv.slice(2).map((value, index, all) => value.startsWith("--") ? [value.slice(2), all[index + 1]] : ["", ""]));
const beforePath = args.get("before");
const afterPath = args.get("after");
if (!beforePath || !afterPath) {
  console.error("Usage: npm run migration:v1:verify -- --before before.json --after after.json");
  process.exit(2);
}
const [before, after] = await Promise.all([beforePath, afterPath].map(async (file) => JSON.parse(await readFile(file, "utf8"))));
const failures = [];
for (const field of fields) {
  if (!Number.isSafeInteger(before[field]) || before[field] < 0 || !Number.isSafeInteger(after[field]) || after[field] < 0) failures.push(`${field}: invalid count`);
  else if (after[field] < before[field]) failures.push(`${field}: ${before[field]} -> ${after[field]}`);
}
const report = { ok: failures.length === 0, before, after, failures, checkedAt: new Date().toISOString() };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
