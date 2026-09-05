import quranSnapshot from "./data/quran-v1.json" with { type: "json" };

export type QuranVerse = Readonly<{
  number: number;
  text: string;
  audioCode: string;
}>;

export type QuranSurah = Readonly<{
  number: number;
  slug: string;
  nameArabic: string;
  nameLatin: string;
  verseCount: number;
  revelationType: string;
  textHash: string;
  verses: readonly QuranVerse[];
}>;

type QuranSnapshot = Readonly<{
  surahCount: number;
  verseCount: number;
  checksum: string;
  surahs: readonly QuranSurah[];
}>;

const snapshot = quranSnapshot as QuranSnapshot;
const byNumber = new Map(snapshot.surahs.map((surah) => [surah.number, surah]));
const bySlug = new Map(snapshot.surahs.map((surah) => [surah.slug, surah]));

export const QURAN_SNAPSHOT_CHECKSUM = snapshot.checksum;
export const WARSH_RECITER = "إبراهيم الدوسري";
export const WARSH_RIWAYA = "ورش عن نافع";

export function getAllSurahs(): readonly QuranSurah[] {
  return snapshot.surahs;
}

export function getSurah(reference: string | number): QuranSurah | undefined {
  const numeric = typeof reference === "number" ? reference : Number(reference);
  return Number.isInteger(numeric) ? byNumber.get(numeric) : bySlug.get(String(reference));
}

export function getWarshAudioUrl(audioCode: string): string {
  assertAudioCode(audioCode);
  return `/api/quran/audio/${audioCode}`;
}

export function getWarshFallbackAudioUrl(audioCode: string): string {
  assertAudioCode(audioCode);
  return `/api/quran/audio/${audioCode}?source=fallback`;
}

function assertAudioCode(audioCode: string): void {
  if (!/^\d{6}$/.test(audioCode)) throw new Error("Invalid Quran audio code");
}
