import { describe, expect, it } from "vitest";

import { AuthorizationError, can, requireCapability } from "./authorization";

describe("authorization policy", () => {
  it("allows a teacher to assess learning", () => {
    expect(can("teacher", "learning:assess")).toBe(true);
  });

  it("does not let a student manage the school", () => {
    expect(can("student", "school:manage")).toBe(false);
    expect(() => requireCapability("student", "school:manage")).toThrow(
      AuthorizationError,
    );
  });

  it("reserves platform management for super admins", () => {
    expect(can("admin", "platform:manage")).toBe(false);
    expect(can("super_admin", "platform:manage")).toBe(true);
  });
});
