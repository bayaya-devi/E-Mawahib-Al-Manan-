import { describe, expect, it } from "vitest";
import { getAllSurahs, getSurah, getWarshAudioUrl, QURAN_SNAPSHOT_CHECKSUM } from "./canonical";

describe("canonical Quran snapshot", () => {
  it("contains all 114 surahs and 6236 sequential verses", () => {
    const surahs = getAllSurahs();
    expect(surahs).toHaveLength(114);
    expect(new Set(surahs.map(({ number }) => number)).size).toBe(114);
    expect(new Set(surahs.map(({ slug }) => slug)).size).toBe(114);
    expect(surahs.reduce((total, surah) => total + surah.verses.length, 0)).toBe(6236);
    for (const surah of surahs) {
      expect(surah.verses).toHaveLength(surah.verseCount);
      expect(surah.verses.map(({ number }) => number)).toEqual(
        Array.from({ length: surah.verseCount }, (_, index) => index + 1),
      );
    }
  });

  it("resolves only stored canonical content", () => {
    expect(getSurah(114)?.slug).toBe("al-nas");
    expect(getSurah("al-nas")?.number).toBe(114);
    expect(getSurah("unknown")).toBeUndefined();
    expect(QURAN_SNAPSHOT_CHECKSUM).toMatch(/^[0-9a-f]{64}$/);
  });

  it("builds the reviewed Warsh audio source", () => {
    expect(getWarshAudioUrl("114001")).toContain("/warsh/warsh_ibrahim_aldosary_128kbps/114001.mp3");
    expect(() => getWarshAudioUrl("../bad")).toThrow("Invalid Quran audio code");
  });
});

