import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
let pulled = {};
try {
  const text = await readFile(process.env.QURAN_VERIFY_ENV_FILE || ".env.production.verify", "utf8");
  pulled = Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")]; }));
} catch { /* Local verification may use the already loaded environment. */ }
const url = pulled.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL; const key = pulled.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase public configuration missing");
const client = createClient(url, key, { auth: { persistSession: false } });
const corpus = JSON.parse(await readFile(new URL("../../src/features/quran/data/quran-v1.json", import.meta.url), "utf8"));
const expected = corpus.surahs.flatMap((surah) => surah.verses.map((verse) => ({ surah_number: surah.number, verse_number: verse.number, canonical_text: verse.text, audio_code: verse.audioCode })));
const actual = [];
for (let start = 0; start < expected.length; start += 1000) {
  const { data, error } = await client.from("quran_verses").select("surah_number,verse_number,canonical_text,audio_code").order("surah_number").order("verse_number").range(start, start + 999);
  if (error) throw error; actual.push(...data);
}
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Production Quran differs: expected ${expected.length}, received ${actual.length}`);
console.log(`PASS: production contains the exact ${actual.length}-ayah canonical Warsh corpus`);
