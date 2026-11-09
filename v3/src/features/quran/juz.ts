import { getAllSurahs, getSurah } from "./canonical";

export type JuzPassage = Readonly<{
  juzNumber: number;
  learningOrder: number;
  surahNumber: number;
  verseFrom: number;
  verseTo: number;
}>;

const starts = [
  [1, 1, 1], [2, 2, 142], [3, 2, 253], [4, 3, 93], [5, 4, 24], [6, 4, 148],
  [7, 5, 82], [8, 6, 111], [9, 7, 88], [10, 8, 41], [11, 9, 93], [12, 11, 6],
  [13, 12, 53], [14, 15, 1], [15, 17, 1], [16, 18, 75], [17, 21, 1], [18, 23, 1],
  [19, 25, 21], [20, 27, 56], [21, 29, 46], [22, 33, 31], [23, 36, 28], [24, 39, 32],
  [25, 41, 47], [26, 46, 1], [27, 51, 31], [28, 58, 1], [29, 67, 1], [30, 78, 1],
] as const;

const passages = starts.flatMap(([juzNumber, startSurah, startVerse], index) => {
  const next = starts[index + 1] ?? [31, 115, 1] as const;
  const [, nextSurah, nextVerse] = next;
  const rows: Omit<JuzPassage, "learningOrder">[] = [];
  for (let surahNumber = startSurah; surahNumber <= Math.min(nextSurah, 114); surahNumber += 1) {
    if (surahNumber === nextSurah && nextVerse === 1) continue;
    const surah = getSurah(surahNumber);
    if (!surah) throw new Error("invalid_juz_boundary");
    const verseFrom = surahNumber === startSurah ? startVerse : 1;
    const verseTo = surahNumber === nextSurah ? nextVerse - 1 : surah.verseCount;
    if (verseTo >= verseFrom) rows.push({ juzNumber, surahNumber, verseFrom, verseTo });
  }
  return rows.reverse().map((row, learningIndex) => ({ ...row, learningOrder: learningIndex + 1 }));
});

export function getJuzPassages(juzNumber: number): readonly JuzPassage[] {
  if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) return [];
  return passages.filter((item) => item.juzNumber === juzNumber);
}

export function getLearningJuzForSurah(surahNumber: number): number | null {
  const matching = passages.filter((item) => item.surahNumber === surahNumber);
  return matching.length ? Math.max(...matching.map((item) => item.juzNumber)) : null;
}

export function validateJuzModel(): boolean {
  return starts.every(([juzNumber]) => getJuzPassages(juzNumber).length > 0)
    && passages.every((item) => {
      const surah = getSurah(item.surahNumber);
      return Boolean(surah && item.verseFrom > 0 && item.verseTo <= surah.verseCount);
    })
    && getAllSurahs().every((surah) => passages.some((item) => item.surahNumber === surah.number));
}
