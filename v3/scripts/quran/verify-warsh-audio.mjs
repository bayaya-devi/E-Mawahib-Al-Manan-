import { readFile } from "node:fs/promises";

const corpus = JSON.parse(await readFile(new URL("../../src/features/quran/data/quran-v1.json", import.meta.url), "utf8"));
const codes = corpus.surahs.flatMap((surah) => surah.verses.map((verse) => verse.audioCode));
const base = "https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps";
const listingResponse = await fetch(`${base}/`, { signal: AbortSignal.timeout(60000) });
if (!listingResponse.ok) throw new Error(`Audio index unavailable: HTTP ${listingResponse.status}`);
const listing = await listingResponse.text();
const listed = new Set([...listing.matchAll(/\/(\d{6})\.mp3"/g)].map((match) => match[1]));
const missing = codes.filter((code) => !listed.has(code));
if (missing.length) throw new Error(`${missing.length} audio files absent from source index: ${missing.slice(0, 30).join(",")}`);

const samples = corpus.surahs.flatMap((surah) => {
  const verses = surah.verses;
  return [...new Set([verses[0]?.audioCode, verses[Math.floor(verses.length / 2)]?.audioCode, verses.at(-1)?.audioCode].filter(Boolean))];
});
let cursor = 0; const failures = [];
async function verify(code) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${base}/${code}.mp3`, { method: "HEAD", signal: AbortSignal.timeout(30000) });
      if (response.ok && (response.headers.get("content-type") || "").includes("audio")) return;
    } catch { /* Retry transient source/network failures. */ }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  failures.push(code);
}
async function worker() { while (cursor < samples.length) await verify(samples[cursor++]); }
await Promise.all(Array.from({ length: 8 }, worker));
if (failures.length) throw new Error(`${failures.length} sampled audio responses failed: ${failures.join(",")}`);
console.log(`PASS: all ${codes.length} ayah files listed; ${samples.length} first/middle/last files across 114 surahs returned audio/mpeg`);
