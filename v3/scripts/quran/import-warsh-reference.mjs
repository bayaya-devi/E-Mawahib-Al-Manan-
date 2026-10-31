import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@6be8e17f2a0c13b1f33b1c3057f73cb28d5e848e/editions/ara-quranwarsh.min.json";
const SOURCE_SHA256 = "bce3bd2ec734e17699ae0ee72e96510103fc5bf640da6f746006719e30b0cf65";
const target = new URL("../../src/features/quran/data/quran-v1.json", import.meta.url);

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Warsh source unavailable: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const sourceHash = createHash("sha256").update(bytes).digest("hex");
if (sourceHash !== SOURCE_SHA256) throw new Error(`Warsh source hash mismatch: ${sourceHash}`);

const reference = JSON.parse(bytes.toString("utf8"));
if (!Array.isArray(reference.quran) || reference.quran.length !== 6236) throw new Error("Invalid Warsh reference corpus");
const previous = JSON.parse(await readFile(target, "utf8"));
const byKey = new Map(reference.quran.map((verse) => [`${verse.chapter}:${verse.verse}`, verse.text]));
const surahs = previous.surahs.map((surah) => {
  const verses = surah.verses.map((verse) => {
    const text = byKey.get(`${surah.number}:${verse.number}`);
    if (typeof text !== "string" || !text.trim()) throw new Error(`Missing reference verse ${surah.number}:${verse.number}`);
    return { number: verse.number, text, audioCode: `${String(surah.number).padStart(3, "0")}${String(verse.number).padStart(3, "0")}` };
  });
  const textHash = createHash("sha256").update(verses.map((verse) => verse.text).join("\n"), "utf8").digest("hex");
  return { ...surah, textSource: "KFGQPC Warsh Uthmani v8 via quran-api@6be8e17", textHash, verses };
});
const canonicalText = surahs.flatMap((surah) => surah.verses.map((verse) => `${surah.number}:${verse.number}:${verse.text}`)).join("\n");
const output = {
  ...previous,
  schemaVersion: 2,
  generatedFrom: SOURCE_URL,
  generatedAt: "2026-09-05T00:00:00.000Z",
  sourceSha256: SOURCE_SHA256,
  checksum: createHash("sha256").update(canonicalText, "utf8").digest("hex"),
  surahs,
};
await writeFile(target, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Imported ${reference.quran.length} verified Warsh verses; canonical checksum ${output.checksum}`);
