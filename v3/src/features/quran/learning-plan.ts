import { getAllSurahs, getSurah, type QuranSurah } from "./canonical";
import { createQuranRound, type QuranGameKind, type QuranGameRound } from "@/features/games/engine";

export type Phase = { from: number; to: number };
export const phaseOverrides: Readonly<Record<number, readonly number[]>> = { 87: [10, 19], 96: [5, 10, 19] };
export function phasesFor(surah: QuranSurah): Phase[] {
  const count = surah.verseCount < 13 ? 1 : Math.ceil(surah.verseCount / 8);
  const ends = phaseOverrides[surah.number] ?? Array.from({ length: count }, (_, index) => Math.ceil((index + 1) * surah.verseCount / count));
  if (ends.at(-1) !== surah.verseCount || ends.some((end, index) => end <= (ends[index - 1] ?? 0) || end > surah.verseCount)) throw new Error("invalid_phase_boundaries");
  return ends.map((to, index) => ({ from: (ends[index - 1] ?? 0) + 1, to }));
}
export function passage(surah: QuranSurah, phase: Phase): QuranSurah {
  const verses = surah.verses.filter((verse) => verse.number >= phase.from && verse.number <= phase.to);
  return { ...surah, verses, verseCount: verses.length };
}

export const learningOrder = [...getAllSurahs()].reverse().map((surah) => surah.number);
export const reviewGroups = Array.from({ length: Math.floor(learningOrder.length / 4) }, (_, index) => learningOrder.slice(index * 4, index * 4 + 4));
export type ExerciseResult = { exercise: number; total: number; correct: number; errors: number; passed: boolean };
export type LearningState = { schema: 2; cursor: number; question: number; errors: number; correct: number; attempt: number; failed: boolean; passed: boolean; lastResult: ExerciseResult | null };
export const initialLearningState: LearningState = { schema: 2, cursor: 0, question: 0, errors: 0, correct: 0, attempt: 0, failed: false, passed: false, lastResult: null };
export type LearningExercisePlan = { kind: QuranGameKind | "mixed"; rounds: readonly QuranGameRound[] };
export type LearningPlan = { key: string; surah: number | null; group: readonly number[]; exercises: readonly LearningExercisePlan[]; phases: Phase[]; finalStart: number };

function roundFor(surah: QuranSurah, kind: QuranGameKind, seed: number): QuranGameRound {
  const item = createQuranRound(surah, kind, seed);
  if (!item) throw new Error("empty_quran_passage");
  return item;
}
function questionCount(surah: QuranSurah): number { return Math.max(4, Math.min(8, surah.verseCount)); }
function makeRounds(surah: QuranSurah, kind: QuranGameKind, count: number, seed: number): QuranGameRound[] {
  return Array.from({ length: count }, (_, index) => roundFor(surah, kind, seed + index));
}

export function makeLearningPlan(key: string, attempt = 0): LearningPlan {
  const match = /^(surah|review)-(\d+)$/.exec(key);
  if (!match) throw new Error("invalid_learning_key");
  const id = Number(match[2]);
  if (match[1] === "review") {
    const group = reviewGroups[id]; if (!group) throw new Error("invalid_review_group");
    const kinds: QuranGameKind[] = ["verse_order", "missing_word", "match_edges", "next_verse"];
    const exercises = kinds.map((kind, exercise) => ({ kind, rounds: group.map((number, index) => roundFor(getSurah(number)!, kind, attempt * 17 + exercise * 5 + index)) }));
    return { key, surah: null, group, phases: [], finalStart: exercises.length, exercises };
  }
  const surah = getSurah(id); if (!surah) throw new Error("invalid_surah");
  const count = questionCount(surah);
  const kinds: QuranGameKind[] = ["missing_word", "next_verse", "match_edges", "verse_order"];
  const exercises: LearningExercisePlan[] = kinds.map((kind, index) => ({ kind, rounds: makeRounds(surah, kind, count, attempt * 37 + index * 11) }));
  const finalKinds: QuranGameKind[] = ["missing_word", "next_verse", "match_edges", "verse_order", "missing_word"];
  exercises.push({ kind: "mixed", rounds: finalKinds.map((kind, index) => roundFor(surah, kind, attempt * 41 + Math.floor(index * Math.max(1, surah.verseCount - 1) / 4))) });
  return { key, surah: id, group: [], phases: phasesFor(surah), finalStart: 4, exercises };
}
export function currentRound(plan: LearningPlan, state: LearningState): QuranGameRound | null {
  return plan.exercises[state.cursor]?.rounds[state.question] ?? null;
}
export function advanceLearning(plan: LearningPlan, state: LearningState, answerCorrect: boolean, retry = false): LearningState {
  if (state.passed) return state;
  if (retry) {
    if (!state.failed) return state;
    return { ...state, question: 0, errors: 0, correct: 0, failed: false, attempt: state.attempt + 1, lastResult: null };
  }
  if (state.failed) return state;
  const exercise = plan.exercises[state.cursor];
  if (!exercise) return { ...state, passed: true };
  const errors = state.errors + (answerCorrect ? 0 : 1);
  const correct = state.correct + (answerCorrect ? 1 : 0);
  if (errors >= 2) return { ...state, errors, correct, failed: true, lastResult: { exercise: state.cursor, total: exercise.rounds.length, correct, errors, passed: false } };
  const question = state.question + 1;
  if (question < exercise.rounds.length) return { ...state, question, errors, correct, lastResult: null };
  const result = { exercise: state.cursor, total: exercise.rounds.length, correct, errors, passed: true };
  const cursor = state.cursor + 1;
  return { ...state, cursor, question: 0, errors: 0, correct: 0, failed: false, passed: cursor === plan.exercises.length, lastResult: result };
}
export function upgradeLearningState(value: unknown): LearningState {
  const state = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (state.schema === 2) return { ...initialLearningState, ...state } as LearningState;
  return { ...initialLearningState, cursor: Math.max(0, Math.min(5, Number(state.cursor) || 0)), attempt: Math.max(0, Number(state.attempt) || 0), passed: state.passed === true };
}
