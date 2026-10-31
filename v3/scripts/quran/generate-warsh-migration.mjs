import { readFile, writeFile } from "node:fs/promises";

const corpus = JSON.parse(await readFile(new URL("../../src/features/quran/data/quran-v1.json", import.meta.url), "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const rows = corpus.surahs.flatMap((surah) => surah.verses.map((verse) => `(${surah.number},${verse.number},${quote(verse.text)},${quote(verse.audioCode)})`));
const chunks = [];
for (let index = 0; index < rows.length; index += 300) chunks.push(`insert into quran_warsh_reference values\n${rows.slice(index, index + 300).join(",\n")};`);
const surahs = corpus.surahs.map((surah) => `(${surah.number},${quote(surah.textHash)})`).join(",\n");
const sql = `-- Generated only from the immutable KFGQPC Warsh v8 reference. Do not edit Quran text manually.\n` +
`begin;\ncreate temporary table quran_warsh_reference(surah_number smallint, verse_number smallint, canonical_text text, audio_code text, primary key(surah_number,verse_number)) on commit drop;\n${chunks.join("\n")}\n` +
`do $$ begin if (select count(*) from quran_warsh_reference) <> 6236 then raise exception 'invalid_warsh_corpus'; end if; end $$;\n` +
`update public.quran_verses q set canonical_text=r.canonical_text,audio_code=r.audio_code,checksum=encode(sha256(convert_to(r.canonical_text,'UTF8')),'hex') from quran_warsh_reference r where q.surah_number=r.surah_number and q.verse_number=r.verse_number;\n` +
`update public.quran_surahs q set source_label='KFGQPC Warsh Uthmani v8 via quran-api@6be8e17',checksum=v.checksum from (values\n${surahs}\n) v(number,checksum) where q.number=v.number;\n` +
`do $$ begin if (select count(*) from public.quran_verses q join quran_warsh_reference r using(surah_number,verse_number) where q.canonical_text=r.canonical_text and q.audio_code=r.audio_code) <> 6236 then raise exception 'warsh_update_incomplete'; end if; end $$;\ncommit;\n`;
await writeFile(new URL("../../supabase/migrations/202609050012_v3_verified_warsh_corpus.sql", import.meta.url), sql, "utf8");
console.log(`Generated Warsh migration with ${rows.length} verses`);
