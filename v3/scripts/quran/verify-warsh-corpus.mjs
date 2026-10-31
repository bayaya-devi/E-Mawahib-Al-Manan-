import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const corpus = JSON.parse(await readFile(new URL("../../src/features/quran/data/quran-v1.json", import.meta.url), "utf8"));
const expectedCounts = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
if (corpus.surahs.length !== 114 || corpus.verseCount !== 6236) throw new Error("Invalid corpus totals");
const lines = [];
for (let index = 0; index < 114; index += 1) {
  const surah = corpus.surahs[index];
  if (surah.number !== index + 1 || surah.verseCount !== expectedCounts[index] || surah.verses.length !== expectedCounts[index]) throw new Error(`Invalid surah ${index + 1}`);
  for (let verseIndex = 0; verseIndex < surah.verses.length; verseIndex += 1) {
    const verse = surah.verses[verseIndex];
    const code = `${String(surah.number).padStart(3, "0")}${String(verseIndex + 1).padStart(3, "0")}`;
    if (verse.number !== verseIndex + 1 || verse.audioCode !== code || typeof verse.text !== "string" || !verse.text.trim()) throw new Error(`Invalid verse ${surah.number}:${verseIndex + 1}`);
    lines.push(`${surah.number}:${verse.number}:${verse.text}`);
  }
}
const checksum = createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
if (checksum !== corpus.checksum) throw new Error(`Corpus checksum mismatch: ${checksum}`);
console.log(`PASS: 114 surahs, 6236 verses, 0 structural/text checksum divergence (${checksum})`);
