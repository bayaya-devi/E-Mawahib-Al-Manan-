import { describe, expect, it } from "vitest";

import { isValidLoginAlias, normalizeLoginAlias } from "./login-alias";
import { buildCanonicalLoginAlias, buildLoginAliasCandidates } from "./legacy-login";

describe("login aliases", () => {
  it("normalizes case and Unicode without losing Arabic letters", () => {
    expect(normalizeLoginAlias("  ÉLÈVE_أحمد  ")).toBe("élève_أحمد");
  });

  it("accepts letters, numbers, dots, dashes, and underscores", () => {
    expect(isValidLoginAlias("student-25.test")).toBe(true);
    expect(isValidLoginAlias("تلميذ_25")).toBe(true);
  });

  it("rejects short aliases and control-like punctuation", () => {
    expect(isValidLoginAlias("ab")).toBe(false);
    expect(isValidLoginAlias("admin<script>")).toBe(false);
  });

  it("keeps every historical V1 username shape available to the server", () => {
    expect(buildCanonicalLoginAlias("student", " Élise ", "Ben Ali")).toBe("s_elise.ben_ali");
    expect(buildLoginAliasCandidates({
      login: "s_elise.ben_ali",
      kind: "student",
      firstName: " Élise ",
      secondValue: "Ben Ali",
    })).toEqual(expect.arrayContaining([
      "s_elise.ben_ali",
      "s_eliseben_ali",
      "s_elise_ben_ali",
      "s_elise-ben_ali",
    ]));
  });

  it("keeps student and teacher aliases separated", () => {
    expect(buildLoginAliasCandidates({ login: "t_auti1.487", kind: "teacher", firstName: "AUTI1", secondValue: "487!" }))
      .toContain("t_auti1.487");
    expect(buildLoginAliasCandidates({ login: "s_a.b", kind: "student", firstName: "A", secondValue: "B" }))
      .not.toContain("t_a.b");
  });
});
