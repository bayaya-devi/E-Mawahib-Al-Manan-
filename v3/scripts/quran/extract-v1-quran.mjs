import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const v3Root = path.resolve(import.meta.dirname, "../..");
const v1Root = path.resolve(v3Root, "..");

function extractAssignedArray(source, variableNames) {
  const name = variableNames.find((candidate) => new RegExp(`(?:const|let|var)\\s+${candidate}\\s*=\\s*\\[`).test(source));
  if (!name) throw new Error(`Missing array: ${variableNames.join(", ")}`);
  const assignment = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(source);
  const start = source.indexOf("[", assignment.index + assignment[0].length - 1);
  let depth = 0; let quote = ""; let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "[") depth += 1;
    if (char === "]" && --depth === 0) return vm.runInNewContext(`(${source.slice(start, index + 1)})`, Object.create(null), { timeout: 1000 });
  }
  throw new Error(`Unclosed array ${name}`);
}

const registrySource = await readFile(path.join(v1Root, "registry.js"), "utf8");
const registry = extractAssignedArray(registrySource, ["SURAH_REGISTRY"]);
const specialVariables = new Map([
  [95, ["surahTinData"]], [96, ["surahData"]], [97, ["surahData"]], [98, ["surahData"]],
  [99, ["verses"]], [100, ["verses"]], [101, ["verses"]], [102, ["verses"]],
  [103, ["verses"]], [104, ["verses"]], [105, ["verses"]], [106, ["surahData"]],
]);

const surahs = [];
function collectVerseRows(value, output = []) {
  if (Array.isArray(value)) value.forEach((item) => collectVerseRows(item, output));
  else if (value && typeof value === "object") {
    if (Number.isInteger(Number(value.num)) && typeof value.text === "string") output.push(value);
    else Object.values(value).forEach((item) => collectVerseRows(item, output));
  }
  return output;
}
for (const meta of registry.sort((a, b) => a.num - b.num)) {
  const source = await readFile(path.join(v1Root, meta.file), "utf8");
  const raw = extractAssignedArray(source, specialVariables.get(meta.num) ?? ["verses", "surahData"]);
  const seen = new Map();
  for (const row of collectVerseRows(raw)) {
    if (!row || typeof row !== "object" || !Number.isInteger(Number(row.num)) || typeof row.text !== "string") continue;
    const verse = { number: Number(row.num), text: row.text.trim(), audioCode: String(row.audio ?? `${String(meta.num).padStart(3, "0")}${String(row.num).padStart(3, "0")}`) };
    if (!seen.has(verse.number)) seen.set(verse.number, verse);
  }
  const verses = [...seen.values()].sort((a, b) => a.number - b.number);
  if (verses.length !== meta.ayat) throw new Error(`${meta.num} ${meta.id}: expected ${meta.ayat} verses, found ${verses.length}`);
  verses.forEach((verse, index) => { if (verse.number !== index + 1 || !/[\u0600-\u06ff]/u.test(verse.text)) throw new Error(`${meta.num}:${verse.number} invalid canonical verse`); });
  const textHash = createHash("sha256").update(verses.map((verse) => `${verse.number}:${verse.text}`).join("\n")).digest("hex");
  surahs.push({ number: meta.num, slug: meta.id, nameArabic: meta.nameAr, nameLatin: meta.nameFr, verseCount: meta.ayat, revelationType: meta.type, sourceFile: meta.file, textSource: "V1 quran-uthmani snapshot", audioRiwaya: "warsh", audioReciter: "Ibrahim Al-Dosary", textHash, verses });
}

if (surahs.length !== 114 || surahs.some((surah, index) => surah.number !== index + 1)) throw new Error("The canonical package must contain exactly surahs 1 through 114.");
const payload = { schemaVersion: 1, generatedFrom: "E-Mawahib Al-Manan V1 immutable Quran snapshot", generatedAt: new Date().toISOString(), surahCount: 114, verseCount: surahs.reduce((sum, surah) => sum + surah.verseCount, 0), checksum: createHash("sha256").update(surahs.map((surah) => surah.textHash).join("")).digest("hex"), surahs };
const output = path.join(v3Root, "src/features/quran/data/quran-v1.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload)}\n`, "utf8");

const sqlText = value => `'${String(value).replaceAll("'", "''")}'`;
const surahValues = surahs.map(surah => `(${surah.number},${sqlText(surah.slug)},${sqlText(surah.nameArabic)},${sqlText(surah.nameLatin)},${surah.verseCount},${sqlText(surah.textSource)},${sqlText(surah.textHash)})`).join(",\n");
const verseValues = surahs.flatMap(surah => surah.verses.map(verse => {
  const checksum = createHash("sha256").update(verse.text).digest("hex");
  return `(${surah.number},${verse.number},${sqlText(verse.text)},${sqlText(verse.audioCode)},${sqlText(checksum)})`;
})).join(",\n");
const sql = `-- Generated mechanically from the reviewed V1 immutable Quran snapshot. Do not edit verse text here.
begin;
insert into public.quran_surahs (number,slug,name_arabic,name_latin,verse_count,source_label,checksum) values
${surahValues};
insert into public.quran_verses (surah_number,verse_number,canonical_text,audio_code,checksum) values
${verseValues};
commit;
`;
const sqlOutput = path.join(v3Root, "supabase/migrations/202608300005_v3_quran_canonical_seed.sql");
await writeFile(sqlOutput, sql, "utf8");
console.log(`Wrote ${payload.surahCount} surahs and ${payload.verseCount} verses (${payload.checksum}) plus SQL seed.`);
