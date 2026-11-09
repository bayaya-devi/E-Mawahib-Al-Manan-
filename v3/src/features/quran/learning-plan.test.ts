import { describe, expect, it } from "vitest";
import { getAllSurahs, getSurah } from "./canonical";
import { advanceLearning, currentRound, initialLearningState, learningOrder, makeLearningPlan, passage, phasesFor, reviewGroups, upgradeLearningState } from "./learning-plan";
import { getJuzPassages, validateJuzModel } from "./juz";

describe("four-surah reviews", () => {
  it("uses deterministic continuous groups", () => {
    expect(reviewGroups[0]).toEqual([114, 113, 112, 111]);
    expect(reviewGroups.flat()).toEqual(learningOrder.slice(0, 112));
    expect(makeLearningPlan("review-0").exercises).toHaveLength(4);
  });
});

describe("surah learning", () => {
  it("has three exercises per stable passage and one multi-question final test", () => {
    for (const surah of getAllSurahs()) {
      const plan = makeLearningPlan(`surah-${surah.number}`);
      expect(plan.finalStart).toBe(plan.phases.length * 3); expect(plan.exercises).toHaveLength(plan.finalStart + 1);
      plan.exercises.slice(0, plan.finalStart).forEach((exercise) => expect(exercise.rounds.length).toBeGreaterThanOrEqual(4));
      expect(plan.exercises[plan.finalStart]!.rounds.length).toBeGreaterThan(1);
    }
  });

  it("covers multiple ayat whenever the surah has multiple ayat", () => {
    for (const surah of getAllSurahs().filter((item) => item.verseCount > 1)) {
      const plan = makeLearningPlan(`surah-${surah.number}`);
      plan.exercises.slice(0, plan.finalStart).forEach((exercise, index) => {
        const phase = plan.phases[Math.floor(index / 3)]!;
        if (phase.to > phase.from) expect(new Set(exercise.rounds.map((round) => round.verseNumber)).size).toBeGreaterThan(1);
      });
    }
  });

  it("passes a five-question exercise with exactly one error and records 4/5", () => {
    const plan = makeLearningPlan("surah-114"); const exercise = { ...plan.exercises[0]!, rounds: plan.exercises[0]!.rounds.slice(0, 5) }; const five = { ...plan, exercises: [exercise, ...plan.exercises.slice(1)] };
    let state = { ...initialLearningState };
    for (const correct of [true, true, false, true, true, true]) state = advanceLearning(five, state, correct);
    expect(state.cursor).toBe(1); expect(state.lastResult).toEqual({ exercise: 0, total: 5, correct: 4, errors: 1, passed: true });
  });

  it("fails on the third error, stays locked, then retries the same exercise", () => {
    const plan = makeLearningPlan("surah-114"); let state = { ...initialLearningState };
    state = advanceLearning(plan, state, false);
    expect(advanceLearning(plan, state, false)).toEqual(state);
    state = advanceLearning(plan, state, true); state = advanceLearning(plan, state, false);
    expect(state.failed).toBe(false);
    state = advanceLearning(plan, state, true); state = advanceLearning(plan, state, false);
    expect(state.failed).toBe(true); expect(state.cursor).toBe(0); expect(currentRound(plan, state)).not.toBeNull();
    expect(advanceLearning(plan, state, true)).toEqual(state);
    state = advanceLearning(plan, state, false, true);
    expect(state.failed).toBe(false); expect(state.question).toBe(0); expect(state.attempt).toBe(1);
  });

  it("requires every exercise and the final test", () => {
    const plan = makeLearningPlan("surah-114"); let state = { ...initialLearningState };
    while (!state.passed) state = advanceLearning(plan, state, true);
    expect(state.cursor).toBe(plan.exercises.length); expect(state.passed).toBe(true);
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

  it("keeps long-surah exercises inside each canonical passage", () => {
    const plan = makeLearningPlan("surah-2");
    const firstPhase = plan.phases[0]!;
    const numbers = plan.exercises[0]!.rounds.map((round) => round.verseNumber);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(firstPhase.from);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(firstPhase.to);
    expect(plan.finalStart).toBeGreaterThan(4);
  });

  it("retains reviewed phase boundaries and canonical identifiers", () => {
    const surah = getSurah(96)!; expect(phasesFor(surah)).toEqual([{ from: 1, to: 5 }, { from: 6, to: 10 }, { from: 11, to: 19 }]);
    expect(passage(surah, phasesFor(surah)[1]!).verses[0]).toEqual(surah.verses[5]);
  });
});

describe("juz examinations", () => {
  it("builds ten solvable verified questions for every juz", () => {
    for (let juz = 1; juz <= 30; juz += 1) {
      const plan = makeLearningPlan(`juz-${juz}`);
      expect(plan.exercises).toHaveLength(1);
      expect(plan.exercises[0]?.rounds).toHaveLength(10);
      expect(plan.exercises[0]?.rounds.every((round) => round.options.length > 0)).toBe(true);
    }
  });

  it("represents all 30 juz and preserves boundaries inside a surah", () => {
    expect(validateJuzModel()).toBe(true);
    expect(getJuzPassages(2)).toContainEqual(expect.objectContaining({ surahNumber: 2, verseFrom: 142, verseTo: 252 }));
    expect(getJuzPassages(3)).toContainEqual(expect.objectContaining({ surahNumber: 2, verseFrom: 253, verseTo: 286 }));
    expect(getJuzPassages(30).at(0)).toMatchObject({ surahNumber: 114, verseFrom: 1, verseTo: 6 });
  });

  it.each([
    [7, 70, false],
    [8, 80, true],
    [10, 100, true],
  ])("scores %i correct answers as %i percent", (correctAnswers, score, passed) => {
    const plan = makeLearningPlan("juz-30");
    let state = { ...initialLearningState };
    for (let index = 0; index < 10; index += 1) state = advanceLearning(plan, state, index < correctAnswers);
    expect(state.score).toBe(score);
    expect(state.passed).toBe(passed);
    expect(state.failed).toBe(!passed);
  });

  it("allows an unlimited fresh attempt after a failed exam", () => {
    const plan = makeLearningPlan("juz-30");
    let state = { ...initialLearningState };
    for (let index = 0; index < 10; index += 1) state = advanceLearning(plan, state, index < 7);
    state = advanceLearning(plan, state, false, true);
    expect(state).toMatchObject({ question: 0, errors: 0, correct: 0, attempt: 1, failed: false, passed: false });
  });
});
