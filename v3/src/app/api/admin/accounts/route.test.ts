import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  provisionAccount: vi.fn(),
}));

vi.mock("@/lib/api/administration-guard", () => ({
  requireAdministrationMutation: vi.fn().mockResolvedValue({
    ok: true,
    access: { admin: {} },
  }),
}));
vi.mock("@/features/identity/application/provision-account", () => ({
  provisionAccount: mocks.provisionAccount,
}));
vi.mock("@/features/admin/application/save-person", () => ({
  savePersonFromAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/admin/accounts", () => {
  beforeEach(() => {
    mocks.provisionAccount.mockReset();
  });

  it("rejects a student account without an official class", async () => {
    const response = await POST(new Request("https://example.test/api/admin/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        login: "a_test_student",
        temporaryPassword: "Test-1234!",
        firstName: "Test",
        lastName: "Student",
        roles: ["student"],
        schoolId: "10000000-0000-4000-8000-000000000001",
        dossier: { firstName: "Test", lastName: "Student" },
      }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
    expect(mocks.provisionAccount).not.toHaveBeenCalled();
  });
});
