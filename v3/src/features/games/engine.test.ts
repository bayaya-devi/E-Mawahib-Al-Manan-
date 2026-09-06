import { describe, expect, it } from "vitest";
import { getSurah } from "@/features/quran/canonical";
import { createQuranRound, createValidatedRound, gameAnswerPoints, isCorrect } from "./engine";

describe("shared Quran games engine", () => {
  const surah = getSurah(114)!;

  it.each(["verse_order", "next_verse", "missing_word", "match_edges", "listen_identify", "flash_memory"] as const)(
    "creates a %s round only from canonical verses",
    (kind) => {
      const round = createQuranRound(surah, kind, 3);
      expect(round).not.toBeNull();
      expect(round?.answer).toBeTruthy();
      expect(isCorrect(round!, round!.answer)).toBe(true);
    },
  );

  it("requires a validated source for non-Quran content", () => {
    const round = createValidatedRound({
      id: "reviewed-1",
      kind: "tajwid_theory",
      prompt: "سؤال مراجَع",
      answer: "جواب مراجَع",
      distractors: ["بديل"],
      sourceReference: "مرجع داخلي معتمد",
    });
    expect(round.options).toContain("جواب مراجَع");
  });

  it("builds the ordering exercise from several Quran verses", () => {
    const round = createQuranRound(surah, "verse_order", 1)!;
    expect(round.options.length).toBeGreaterThanOrEqual(3);
    expect(round.prompt).toContain("آيات");
  });

  it("keeps every generated answer inside unique canonical options", () => {
    for (const surah of [getSurah(2)!, getSurah(67)!, getSurah(96)!, getSurah(114)!]) {
      for (const kind of ["verse_order", "next_verse", "missing_word", "match_edges"] as const) {
        for (let seed = 0; seed < 12; seed += 1) {
          const round = createQuranRound(surah, kind, seed)!;
          if (kind === "verse_order") expect(round.answer.split(" ").length).toBeGreaterThan(2);
          else expect(round.options).toContain(round.answer);
          expect(new Set(round.options).size).toBe(round.options.length);
          expect(round.options.every(Boolean)).toBe(true);
        }
      }
    }
  });

  it("calculates score only from actual correct answers", () => {
    expect(gameAnswerPoints(false, 0, 4)).toBe(0);
    expect(gameAnswerPoints(true, 0, 0)).toBe(100);
    expect(gameAnswerPoints(true, 1, 0)).toBe(60);
    expect(gameAnswerPoints(true, 0, 3)).toBe(115);
  });
});
