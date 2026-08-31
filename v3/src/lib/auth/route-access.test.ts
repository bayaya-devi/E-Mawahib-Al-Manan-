import { describe, expect, it } from "vitest";

import { mayAccessPath, requiredRolesForPath } from "./route-access";

describe("workspace route access", () => {
  it("maps protected workspaces to their server roles", () => {
    expect(requiredRolesForPath("/admin/people")).toEqual(["admin", "direction"]);
    expect(requiredRolesForPath("/teacher/session")).toEqual(["teacher"]);
    expect(requiredRolesForPath("/ar/programs")).toBeNull();
  });

  it("rejects horizontal workspace switching", () => {
    expect(mayAccessPath("/admin", ["student"])).toBe(false);
    expect(mayAccessPath("/teacher/students", ["parent"])).toBe(false);
    expect(mayAccessPath("/student/quran", ["teacher"])).toBe(false);
    expect(mayAccessPath("/family", ["parent"])).toBe(true);
  });
});
