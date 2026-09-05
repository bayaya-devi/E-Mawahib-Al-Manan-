import { describe, expect, it } from "vitest";
import { getSurah } from "@/features/quran/canonical";
import { createQuranRound, createValidatedRound, isCorrect } from "./engine";

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
});
