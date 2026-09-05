import type { QuranSurah, QuranVerse } from "@/features/quran/canonical";

export type QuranGameKind =
  | "verse_order"
  | "next_verse"
  | "missing_word"
  | "match_edges"
  | "listen_identify"
  | "flash_memory";

export type QuranGameRound = Readonly<{
  id: string;
  kind: QuranGameKind;
  prompt: string;
  options: readonly string[];
  answer: string;
  verseNumber: number;
  audioCode?: string;
}>;

export type ValidatedLearningItem = Readonly<{
  id: string;
  kind: "tajwid_theory" | "arabic_vocabulary" | "validated_hadith" | "validated_adhkar";
  prompt: string;
  answer: string;
  distractors: readonly string[];
  sourceReference: string;
}>;

export function createQuranRound(
  surah: QuranSurah,
  kind: QuranGameKind,
  seed = 0,
): QuranGameRound | null {
  const verses = surah.verses;
  if (verses.length === 0) return null;
  const index = Math.abs(seed) % verses.length;
  const verse = verses[index];
  if (!verse) return null;

  switch (kind) {
    case "verse_order":
      return verseOrderRound(surah, verse, seed);
    case "next_verse":
      return nextVerseRound(surah, Math.min(index, Math.max(0, verses.length - 2)), seed);
    case "missing_word":
      return missingWordRound(surah, verse, seed);
    case "match_edges":
      return matchEdgesRound(surah, verse, seed);
    case "listen_identify":
      return listenRound(surah, verse, seed);
    case "flash_memory":
      return flashRound(surah, verse, seed);
  }
}

export function createValidatedRound(item: ValidatedLearningItem): QuranGameRound {
  return {
    id: item.id,
    kind: "flash_memory",
    prompt: item.prompt,
    options: stableShuffle([item.answer, ...item.distractors], item.id.length),
    answer: item.answer,
    verseNumber: 0,
  };
}

export function isCorrect(round: QuranGameRound, response: string): boolean {
  return normalize(response) === normalize(round.answer);
}

export function gameAnswerPoints(correct: boolean, priorMistakes: number, streak: number): number {
  if (!correct) return 0;
  return Math.max(40, 100 - priorMistakes * 40) + Math.min(30, Math.max(0, streak) * 5);
}

function verseOrderRound(surah: QuranSurah, verse: QuranVerse, seed: number): QuranGameRound {
  const start = Math.min(Math.max(0, surah.verses.findIndex(({ number }) => number === verse.number)), Math.max(0, surah.verses.length - 3));
  const passage = surah.verses.slice(start, start + Math.min(3, surah.verses.length));
  const fragments = passage.map(({ text }) => text);
  return round(surah, verse, "verse_order", "رتّب آيات المقطع", stableShuffle(fragments, seed), fragments.join(" "));
}

function nextVerseRound(surah: QuranSurah, index: number, seed: number): QuranGameRound {
  const verse = surah.verses[index] ?? surah.verses[0]!;
  const answer = surah.verses[index + 1] ?? verse;
  const pool = unique([answer.text, ...nearbyVerses(surah, index + 1).map(({ text }) => text)]).slice(0, 4);
  return round(surah, verse, "next_verse", `ما الآية التالية بعد: ${verse.text}`, stableShuffle(pool, seed), answer.text);
}

function missingWordRound(surah: QuranSurah, verse: QuranVerse, seed: number): QuranGameRound {
  const words = wordsOf(verse.text);
  const missingIndex = words.length > 1 ? Math.abs(seed) % words.length : 0;
  const answer = words[missingIndex] ?? verse.text;
  const promptWords = words.map((word, index) => index === missingIndex ? "_____" : word);
  const context = nearbyVerses(surah, surah.verses.findIndex(({ number }) => number === verse.number)).slice(0, 2).map(({ text }) => text);
  const distractors = unique(surah.verses.flatMap(({ text }) => wordsOf(text))).filter((word) => word !== answer);
  return round(surah, verse, "missing_word", [...context, promptWords.join(" ")].join(" · "), stableShuffle([answer, ...distractors.slice(0, 3)], seed), answer);
}

function matchEdgesRound(surah: QuranSurah, verse: QuranVerse, seed: number): QuranGameRound {
  const words = wordsOf(verse.text);
  const split = Math.max(1, Math.ceil(words.length / 2));
  const beginning = words.slice(0, split).join(" ");
  const answer = words.slice(split).join(" ") || words.at(-1) || verse.text;
  const alternatives = nearbyVerses(surah, verse.number - 1).map(({ text }) => {
    const candidateWords = wordsOf(text);
    return candidateWords.slice(Math.max(1, Math.ceil(candidateWords.length / 2))).join(" ");
  }).filter(Boolean);
  return round(surah, verse, "match_edges", `أكمل نهاية الآية: ${beginning}`, stableShuffle(unique([answer, ...alternatives]).slice(0, 4), seed), answer);
}

function listenRound(surah: QuranSurah, verse: QuranVerse, seed: number): QuranGameRound {
  const options = unique([verse.text, ...nearbyVerses(surah, verse.number - 1).map(({ text }) => text)]).slice(0, 4);
  return { ...round(surah, verse, "listen_identify", "استمع ثم اختر الآية", stableShuffle(options, seed), verse.text), audioCode: verse.audioCode };
}

function flashRound(surah: QuranSurah, verse: QuranVerse, seed: number): QuranGameRound {
  const options = unique([verse.text, ...nearbyVerses(surah, verse.number - 1).map(({ text }) => text)]).slice(0, 4);
  return round(surah, verse, "flash_memory", "احفظ الآية ثم اخترها بعد اختفائها", stableShuffle(options, seed), verse.text);
}

function round(surah: QuranSurah, verse: QuranVerse, kind: QuranGameKind, prompt: string, options: readonly string[], answer: string): QuranGameRound {
  return { id: `${surah.number}-${verse.number}-${kind}`, kind, prompt, options, answer, verseNumber: verse.number };
}

function nearbyVerses(surah: QuranSurah, index: number): readonly QuranVerse[] {
  return surah.verses.filter((_, candidateIndex) => candidateIndex !== index).slice(0, 5);
}

function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/u).filter(Boolean);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/gu, "").replace(/\s+/gu, " ").trim();
}

function stableShuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  let state = (seed || 1) >>> 0;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}
