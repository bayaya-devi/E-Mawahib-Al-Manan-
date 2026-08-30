import { describe, expect, it } from "vitest";

import { isValidLoginAlias, normalizeLoginAlias } from "./login-alias";

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
});
