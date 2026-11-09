import { describe, expect, it } from "vitest";

import { getStudentStage } from "./student-stage";

const today = new Date("2026-11-09T12:00:00Z");

describe("getStudentStage", () => {
  it.each([
    [null, "neutral"],
    ["not-a-date", "neutral"],
    ["2022-01-01", "neutral"],
    ["2020-11-09", "child"],
    ["2017-11-09", "teen"],
    ["2007-11-09", "adult"],
  ] as const)("maps %s to %s", (dateOfBirth, expected) => {
    expect(getStudentStage(dateOfBirth, today)).toBe(expected);
  });

  it("keeps an eighteen-year-old in the teen presentation until their nineteenth birthday", () => {
    expect(getStudentStage("2007-11-10", today)).toBe("teen");
  });
});
