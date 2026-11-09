import { describe, expect, it } from "vitest";

import { getStudentStage } from "./student-stage";

describe("getStudentStage", () => {
  it.each([
    [null, "neutral"],
    [undefined, "neutral"],
    ["CHILD_5_8", "child"],
    ["TEEN_9_18", "teen"],
    ["ADULT_19_PLUS", "adult"],
  ] as const)("maps %s to %s", (category, expected) => {
    expect(getStudentStage(category)).toBe(expected);
  });
});
