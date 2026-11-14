import { describe, expect, it } from "vitest";

import { dashboardPathForRoles } from "./login-form";

describe("dashboardPathForRoles", () => {
  it("routes each authenticated role to its current workspace", () => {
    expect(dashboardPathForRoles(["direction"])).toBe("/admin");
    expect(dashboardPathForRoles(["admin"])).toBe("/admin");
    expect(dashboardPathForRoles(["teacher"])).toBe("/teacher");
    expect(dashboardPathForRoles(["student"])).toBe("/student");
  });
});
