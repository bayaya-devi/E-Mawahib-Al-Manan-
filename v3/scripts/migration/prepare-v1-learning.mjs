import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("Usage: npm run migration:v1:learning -- progressions.json prepared.json");
const source = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(source)) throw new Error("The V1 export must be an array of progression rows");

const quran = JSON.parse(await readFile(new URL("../../src/features/quran/data/quran-v1.json", import.meta.url), "utf8"));
const identifiers = new Map();
for (const surah of quran.surahs) {
  for (const identifier of [surah.slug, String(surah.number), `surah-${surah.slug}`, surah.sourceFile?.replace(/\.html$/u, "")]) {
    if (identifier) identifiers.set(normalize(identifier), surah.number);
  }
}

const grouped = new Map();
for (const [index, row] of source.entries()) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Row ${index} is invalid`);
  const username = String(row.username ?? "").trim();
  const legacySurah = String(row.surah_id ?? row.surahId ?? "").trim();
  if (!username || !legacySurah) throw new Error(`Row ${index} misses username or surah_id`);
  const surahNumber = identifiers.get(normalize(legacySurah));
  if (!surahNumber) throw new Error(`Row ${index} references unknown surah ${legacySurah}`);
  const activities = row.activities && typeof row.activities === "object" && !Array.isArray(row.activities) ? row.activities : {};
  const activityValues = Object.values(activities).filter(value => value && typeof value === "object");
  const dates = activityValues.map(value => value.date).filter(value => typeof value === "string").sort();
  const scores = activityValues.map(value => Number(value.score)).filter(Number.isFinite);
  const completedAt = row.completed_at ?? row.completedAt ?? null;
  const entry = {
    surah_number: surahNumber,
    completed: Boolean(completedAt ?? row.is_completed),
    completion_percent: completedAt ? 100 : Math.min(99, activityValues.length * 20),
    highest_completed_step: activityValues.length,
    stars: Math.max(0, Number(row.stars ?? 0) || 0),
    started_at: dates[0] ?? null,
    completed_at: completedAt,
    last_activity_at: dates.at(-1) ?? completedAt,
    legacy_global_score: scores.length ? Math.max(...scores) : Number(row.global_score ?? 0) || 0,
  };
  const current = grouped.get(username) ?? [];
  current.push(entry);
  grouped.set(username, current);
}

const accounts = [...grouped.entries()].map(([legacyUsername, rows]) => {
  const rawRows = source.filter(row => String(row.username ?? "").trim() === legacyUsername);
  const fingerprint = createHash("sha256").update(JSON.stringify(rawRows)).digest("hex");
  return { legacyUsername, sourceKey: "v1.progressions", sourceFingerprint: fingerprint, rawPayload: rawRows, normalizedRows: rows };
});
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceCount: source.length, accountCount: accounts.length, accounts }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ sourceCount: source.length, accountCount: accounts.length }));

function normalize(value) { return value.normalize("NFKC").trim().toLowerCase().replace(/^surah[-_:]/u, "").replace(/\.html$/u, ""); }
