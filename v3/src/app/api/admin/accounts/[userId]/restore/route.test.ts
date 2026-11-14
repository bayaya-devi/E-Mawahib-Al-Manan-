import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ restoreAccountFromTrash: vi.fn() }));

vi.mock("@/lib/api/administration-guard", () => ({
  requireAdministrationMutation: vi.fn().mockResolvedValue({ ok: true, access: { admin: {} } }),
}));
vi.mock("@/features/identity/application/restore-account", () => ({
  restoreAccountFromTrash: mocks.restoreAccountFromTrash,
}));

import { POST } from "./route";

describe("POST /api/admin/accounts/:userId/restore", () => {
  beforeEach(() => mocks.restoreAccountFromTrash.mockReset());

  it("restores an account through the audited application service", async () => {
    mocks.restoreAccountFromTrash.mockResolvedValue({ ok: true, message: "restored" });
    const response = await POST(new Request("https://example.test", { method: "POST" }), {
      params: Promise.resolve({ userId: "10000000-0000-4000-8000-000000000001" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.restoreAccountFromTrash).toHaveBeenCalledWith("10000000-0000-4000-8000-000000000001");
  });
});
