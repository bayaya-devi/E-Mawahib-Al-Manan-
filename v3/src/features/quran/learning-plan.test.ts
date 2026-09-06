import { describe, expect, it } from "vitest";
import { getAllSurahs, getSurah } from "./canonical";
import { advanceLearning, currentRound, initialLearningState, learningOrder, makeLearningPlan, passage, phasesFor, reviewGroups, upgradeLearningState } from "./learning-plan";

describe("four-surah reviews", () => {
  it("uses deterministic continuous groups", () => {
    expect(reviewGroups[0]).toEqual([114, 113, 112, 111]);
    expect(reviewGroups.flat()).toEqual(learningOrder.slice(0, 112));
    expect(makeLearningPlan("review-0").exercises).toHaveLength(4);
  });
});

describe("surah learning", () => {
  it("has exactly four multi-question exercises and one multi-question final test", () => {
    for (const surah of getAllSurahs()) {
      const plan = makeLearningPlan(`surah-${surah.number}`);
      expect(plan.finalStart).toBe(4); expect(plan.exercises).toHaveLength(5);
      plan.exercises.slice(0, 4).forEach((exercise) => expect(exercise.rounds.length).toBeGreaterThanOrEqual(4));
      expect(plan.exercises[4]!.rounds.length).toBeGreaterThan(1);
    }
  });

  it("covers multiple ayat whenever the surah has multiple ayat", () => {
    for (const surah of getAllSurahs().filter((item) => item.verseCount > 1)) {
      const plan = makeLearningPlan(`surah-${surah.number}`);
      plan.exercises.slice(0, 4).forEach((exercise) => expect(new Set(exercise.rounds.map((round) => round.verseNumber)).size).toBeGreaterThan(1));
    }
  });

  it("passes a five-question exercise with exactly one error and records 4/5", () => {
    const plan = makeLearningPlan("surah-114"); const exercise = { ...plan.exercises[0]!, rounds: plan.exercises[0]!.rounds.slice(0, 5) }; const five = { ...plan, exercises: [exercise, ...plan.exercises.slice(1)] };
    let state = { ...initialLearningState };
    for (const correct of [true, true, false, true, true, true]) state = advanceLearning(five, state, correct);
    expect(state.cursor).toBe(1); expect(state.lastResult).toEqual({ exercise: 0, total: 5, correct: 4, errors: 1, passed: true });
  });

  it("fails on the second error, stays locked, then retries the same exercise", () => {
    const plan = makeLearningPlan("surah-114"); let state = { ...initialLearningState };
    state = advanceLearning(plan, state, false);
    expect(advanceLearning(plan, state, false)).toEqual(state);
    state = advanceLearning(plan, state, true); state = advanceLearning(plan, state, false);
    expect(state.failed).toBe(true); expect(state.cursor).toBe(0); expect(currentRound(plan, state)).not.toBeNull();
    expect(advanceLearning(plan, state, true)).toEqual(state);
    state = advanceLearning(plan, state, false, true);
    expect(state.failed).toBe(false); expect(state.question).toBe(0); expect(state.attempt).toBe(1);
  });

  it("requires every exercise and the final test", () => {
    const plan = makeLearningPlan("surah-114"); let state = { ...initialLearningState };
    while (!state.passed) state = advanceLearning(plan, state, true);
    expect(state.cursor).toBe(5); expect(state.passed).toBe(true);
  });

  it("upgrades legacy progress without discarding completed exercise position", () => {
    expect(upgradeLearningState({ cursor: 3, errors: 1, attempt: 2, failed: false, passed: false })).toMatchObject({ schema: 3, cursor: 3, question: 0, attempt: 2 });
  });

  it("counts at most one error for repeated attempts on the same question", () => {
    const plan = makeLearningPlan("surah-114");
    const first = advanceLearning(plan, { ...initialLearningState }, false);
    const repeated = advanceLearning(plan, first, false);
    expect(first.errors).toBe(1);
    expect(repeated).toEqual(first);
    expect(repeated.failed).toBe(false);
  });

  it("spreads long-surah questions over the canonical passage", () => {
    const plan = makeLearningPlan("surah-2");
    const numbers = plan.exercises[0]!.rounds.map((round) => round.verseNumber);
    expect(Math.max(...numbers) - Math.min(...numbers)).toBeGreaterThan(100);
  });

  it("retains reviewed phase boundaries and canonical identifiers", () => {
    const surah = getSurah(96)!; expect(phasesFor(surah)).toEqual([{ from: 1, to: 5 }, { from: 6, to: 10 }, { from: 11, to: 19 }]);
    expect(passage(surah, phasesFor(surah)[1]!).verses[0]).toEqual(surah.verses[5]);
  });
});
