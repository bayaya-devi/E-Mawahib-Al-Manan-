import { getAllSurahs, getSurah, type QuranSurah } from "./canonical";
import { createQuranRound, type QuranGameKind, type QuranGameRound } from "@/features/games/engine";
import { getJuzPassages } from "./juz";

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
export type LearningState = { schema: 3; cursor: number; question: number; questionMistake: boolean; errors: number; correct: number; score: number | null; attempt: number; failed: boolean; passed: boolean; lastResult: ExerciseResult | null };
export const initialLearningState: LearningState = { schema: 3, cursor: 0, question: 0, questionMistake: false, errors: 0, correct: 0, score: null, attempt: 0, failed: false, passed: false, lastResult: null };
export type LearningExercisePlan = { kind: QuranGameKind | "mixed"; rounds: readonly QuranGameRound[] };
export type LearningPlan = { key: string; mode: "surah" | "review" | "juz_exam"; surah: number | null; juz: number | null; group: readonly number[]; exercises: readonly LearningExercisePlan[]; phases: Phase[]; finalStart: number; passScore: number | null };

function roundFor(surah: QuranSurah, kind: QuranGameKind, seed: number): QuranGameRound {
  const item = createQuranRound(surah, kind, seed);
  if (!item) throw new Error("empty_quran_passage");
  return item;
}
function questionCount(surah: QuranSurah): number { return Math.max(4, Math.min(8, surah.verseCount)); }
function makeRounds(surah: QuranSurah, kind: QuranGameKind, count: number, seed: number): QuranGameRound[] {
  return Array.from({ length: count }, (_, index) => {
    const spread = Math.floor(index * surah.verseCount / count);
    return roundFor(surah, kind, seed + spread);
  });
}

export function makeLearningPlan(key: string, attempt = 0): LearningPlan {
  const match = /^(surah|review|juz)-(\d+)$/.exec(key);
  if (!match) throw new Error("invalid_learning_key");
  const id = Number(match[2]);
  if (match[1] === "review") {
    const group = reviewGroups[id]; if (!group) throw new Error("invalid_review_group");
    const kinds: QuranGameKind[] = ["verse_order", "missing_word", "match_edges", "next_verse"];
    const exercises = kinds.map((kind, exercise) => ({ kind, rounds: group.map((number, index) => roundFor(getSurah(number)!, kind, attempt * 17 + exercise * 5 + index)) }));
    return { key, mode: "review", surah: null, juz: null, group, phases: [], finalStart: exercises.length, exercises, passScore: null };
  }
  if (match[1] === "juz") {
    const juz = id;
    const juzPassages = getJuzPassages(juz);
    if (!juzPassages.length) throw new Error("invalid_juz");
    const kinds: QuranGameKind[] = ["missing_word", "next_verse", "match_edges", "verse_order"];
    const rounds = Array.from({ length: 10 }, (_, index) => {
      const item = juzPassages[Math.floor(index * juzPassages.length / 10)] ?? juzPassages.at(-1)!;
      const surah = getSurah(item.surahNumber)!;
      return roundFor(passage(surah, { from: item.verseFrom, to: item.verseTo }), kinds[index % kinds.length]!, attempt * 53 + index * 7);
    });
    return { key, mode: "juz_exam", surah: null, juz, group: [...new Set(juzPassages.map((item) => item.surahNumber))], phases: [], finalStart: 0, exercises: [{ kind: "mixed", rounds }], passScore: 80 };
  }
  const surah = getSurah(id); if (!surah) throw new Error("invalid_surah");
  const phases = phasesFor(surah);
  const passageKinds: QuranGameKind[] = ["next_verse", "verse_order", "missing_word"];
  const exercises: LearningExercisePlan[] = phases.flatMap((phase, phaseIndex) => {
    const unit = passage(surah, phase);
    const count = questionCount(unit);
    return passageKinds.map((kind, exerciseIndex) => ({
      kind,
      rounds: makeRounds(unit, kind, count, attempt * 101 + phaseIndex * 17 + exerciseIndex * 5),
    }));
  });
  const finalKinds: QuranGameKind[] = ["missing_word", "next_verse", "match_edges", "verse_order", "missing_word"];
  exercises.push({ kind: "mixed", rounds: finalKinds.map((kind, index) => roundFor(surah, kind, attempt * 41 + Math.floor(index * Math.max(1, surah.verseCount - 1) / 4))) });
  return { key, mode: "surah", surah: id, juz: null, group: [], phases, finalStart: phases.length * passageKinds.length, exercises, passScore: null };
}
export function currentRound(plan: LearningPlan, state: LearningState): QuranGameRound | null {
  return plan.exercises[state.cursor]?.rounds[state.question] ?? null;
}
export function advanceLearning(plan: LearningPlan, state: LearningState, answerCorrect: boolean, retry = false): LearningState {
  if (state.passed) return state;
  if (retry) {
    if (!state.failed) return state;
    return { ...state, question: 0, questionMistake: false, errors: 0, correct: 0, score: null, failed: false, attempt: state.attempt + 1, lastResult: null };
  }
  if (state.failed) return state;
  const exercise = plan.exercises[state.cursor];
  if (!exercise) return { ...state, passed: true };
  if (plan.mode === "juz_exam") {
    const correct = state.correct + (answerCorrect ? 1 : 0);
    const errors = state.errors + (answerCorrect ? 0 : 1);
    const question = state.question + 1;
    if (question < exercise.rounds.length) return { ...state, question, questionMistake: false, errors, correct };
    const score = Math.round(correct / exercise.rounds.length * 100);
    const passed = score >= (plan.passScore ?? 80);
    return { ...state, question, errors, correct, score, passed, failed: !passed, lastResult: { exercise: 0, total: exercise.rounds.length, correct, errors, passed } };
  }
  if (!answerCorrect) {
    if (state.questionMistake) return state;
    const errors = state.errors + 1;
    if (errors >= 3) return { ...state, questionMistake: true, errors, failed: true, lastResult: { exercise: state.cursor, total: exercise.rounds.length, correct: state.correct, errors, passed: false } };
    return { ...state, questionMistake: true, errors, lastResult: null };
  }
  const errors = state.errors;
  const correct = state.correct + (state.questionMistake ? 0 : 1);
  const question = state.question + 1;
  if (question < exercise.rounds.length) return { ...state, question, questionMistake: false, errors, correct, lastResult: null };
  const result = { exercise: state.cursor, total: exercise.rounds.length, correct, errors, passed: true };
  const cursor = state.cursor + 1;
  return { ...state, cursor, question: 0, questionMistake: false, errors: 0, correct: 0, failed: false, passed: cursor === plan.exercises.length, lastResult: result };
}
export function upgradeLearningState(value: unknown): LearningState {
  const state = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (state.schema === 3) return { ...initialLearningState, ...state } as LearningState;
  if (state.schema === 2) return { ...initialLearningState, ...state, schema: 3, questionMistake: false } as LearningState;
  return { ...initialLearningState, cursor: Math.max(0, Math.min(5, Number(state.cursor) || 0)), attempt: Math.max(0, Number(state.attempt) || 0), passed: state.passed === true };
}
