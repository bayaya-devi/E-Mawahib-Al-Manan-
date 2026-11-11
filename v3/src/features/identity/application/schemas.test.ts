import { describe, expect, it } from "vitest";

import { provisionAccountInputSchema } from "./schemas";

const validAccount = {
  login: "t_test_teacher",
  temporaryPassword: "Test-1234!",
  firstName: "Test",
  lastName: "Teacher",
  roles: ["teacher"] as const,
  schoolId: "10000000-0000-4000-8000-000000000001",
};

describe("provisionAccountInputSchema", () => {
  it("rejects passwords Supabase would reject before attempting account creation", () => {
    expect(provisionAccountInputSchema.safeParse({ ...validAccount, temporaryPassword: "1234" }).success).toBe(false);
    expect(provisionAccountInputSchema.safeParse({ ...validAccount, temporaryPassword: "Abc1234" }).success).toBe(false);
  });

  it("accepts a compliant temporary password", () => {
    expect(provisionAccountInputSchema.safeParse(validAccount).success).toBe(true);
  });
});
