import { describe, expect, it } from "vitest";
import { analyseMemorization, normalizeArabic } from "./memorization-analysis";

describe("memorization analysis", () => {
  it("compares a clear transcript conservatively", () => {
    const result = analyseMemorization("قُلْ أَعُوذُ بِرَبِّ النَّاسِ", "قل اعوذ برب الناس", 0.9);
    expect(result.conclusive).toBe(true);
    expect(result.score).toBe(10);
    expect(result.errors).toHaveLength(0);
  });

  it("does not invent a low-confidence score", () => {
    const result = analyseMemorization("قل أعوذ برب الناس", "قل", 0.3);
    expect(result.conclusive).toBe(false);
    expect(result.score).toBeNull();
  });

  it("normalizes orthographic variants without changing the stored Quran", () => {
    expect(normalizeArabic("ٱلرَّحْمَٰنِ")).toBe("الرحمن");
  });
});

