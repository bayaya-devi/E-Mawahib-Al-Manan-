import { getAllSurahs, getSurah, type QuranSurah } from './canonical';
import { createQuranRound, type QuranGameRound } from '@/features/games/engine';

export type Phase = { from: number; to: number };
// Explicit boundaries can be reviewed independently of the UI; the fallback uses balanced passages.
export const phaseOverrides: Readonly<Record<number, readonly number[]>> = { 87: [10, 19], 96: [5, 10, 19] };
export function phasesFor(surah: QuranSurah): Phase[] {
  const count = surah.verseCount < 13 ? 1 : Math.ceil(surah.verseCount / 8);
  const ends = phaseOverrides[surah.number] ?? Array.from({ length: count }, (_, i) => Math.ceil((i + 1) * surah.verseCount / count));
  if (ends.at(-1) !== surah.verseCount || ends.some((end, i) => end <= (ends[i - 1] ?? 0) || end > surah.verseCount)) throw new Error('invalid_phase_boundaries');
  return ends.map((to, i) => ({ from: (ends[i - 1] ?? 0) + 1, to }));
}
export function passage(surah: QuranSurah, phase: Phase): QuranSurah {
  const verses = surah.verses.filter(v => v.number >= phase.from && v.number <= phase.to);
  return { ...surah, verses, verseCount: verses.length };
}
export const learningOrder = [...getAllSurahs()].reverse().map(s => s.number);
// Groups continue across Juz boundaries, following the existing surah-level learning order.
export const reviewGroups = Array.from({ length: Math.floor(learningOrder.length / 4) }, (_, i) => learningOrder.slice(i * 4, i * 4 + 4));
export type LearningState = { cursor: number; errors: number; attempt: number; failed: boolean; passed: boolean };
export const initialLearningState: LearningState = { cursor: 0, errors: 0, attempt: 0, failed: false, passed: false };
export type LearningPlan = { key: string; surah: number | null; group: readonly number[]; rounds: QuranGameRound[]; phases: Phase[]; finalStart: number };
function roundFor(surah: QuranSurah, kind: QuranGameRound['kind'], seed: number): QuranGameRound {
  const round = createQuranRound(surah, kind, seed);
  if (!round) throw new Error('empty_quran_passage');
  return round;
}
export function makeLearningPlan(key: string, attempt = 0): LearningPlan {
  const match = /^(surah|review)-(\d+)$/.exec(key);
  if (!match) throw new Error('invalid_learning_key');
  const id = Number(match[2]);
  if (match[1] === 'review') {
    const group = reviewGroups[id]; if (!group) throw new Error('invalid_review_group');
    const kinds = ['verse_order', 'missing_word', 'match_edges', 'next_verse'] as const;
    return { key, surah: null, group, phases: [], finalStart: 0, rounds: group.map((n, i) => roundFor(getSurah(n)!, kinds[i]!, attempt + i)) };
  }
  const surah = getSurah(id); if (!surah) throw new Error('invalid_surah');
  const phases = phasesFor(surah);
  const rounds = phases.flatMap((phase, i) => {
    const source = passage(surah, phase);
    return (['missing_word', 'next_verse', 'match_edges', 'verse_order'] as const).map((kind, j) => roundFor(source, kind, attempt + i + j));
  });
  const finalStart = rounds.length;
  // Sample the whole surah, including its beginning and end, in a short common final test.
  const samples = phases.length === 1 ? [0] : [0, Math.floor(surah.verseCount / 2), surah.verseCount - 1];
  samples.forEach(seed => rounds.push(roundFor(surah, 'missing_word', seed)));
  return { key, surah: id, group: [], phases, rounds, finalStart };
}
export function advanceLearning(plan: LearningPlan, state: LearningState, correct: boolean, retry = false): LearningState {
  if (state.passed) return state;
  if (retry) {
    if (!state.failed) return state;
    return { ...state, cursor: plan.surah === null ? 0 : state.cursor >= plan.finalStart ? plan.finalStart : state.cursor, errors: 0, failed: false, attempt: state.attempt + 1 };
  }
  if (state.failed) return state;
  if (!correct) return { ...state, errors: state.errors + 1, failed: state.errors + 1 > 1 };
  const cursor = state.cursor + 1;
  return { ...state, cursor, errors: plan.surah !== null && cursor <= plan.finalStart ? 0 : state.errors, passed: cursor === plan.rounds.length };
}
