import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAlias: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  profile: vi.fn(),
  roles: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getPrivilegedServerEnvironment: () => ({
    AUTH_INTERNAL_EMAIL_DOMAIN: "accounts.example.test",
    LEGACY_AUTH_HMAC_KEY: "legacy-auth-key-with-at-least-32-characters",
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.resolveAlias }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
    from: (table: string) => ({
      select: () => ({
        eq: () => table === "profiles"
          ? { maybeSingle: mocks.profile }
          : mocks.roles(),
      }),
    }),
  }),
}));

import { signInWithAlias } from "./sign-in";

describe("legacy-compatible sign in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAlias.mockImplementation((_name: string, { target_login_alias: alias }: { target_login_alias: string }) =>
      Promise.resolve({ data: alias === "s_elise_ben_ali" ? "student@accounts.example.test" : null, error: null }));
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    mocks.profile.mockResolvedValue({ data: { status: "active" }, error: null });
    mocks.roles.mockReturnValue(Promise.resolve({ data: [{ role: "student" }], error: null }));
  });

  it("authenticates a historical student alias through Supabase Auth", async () => {
    mocks.signIn
      .mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid") })
      .mockResolvedValueOnce({ data: { user: { id: "student-id" } }, error: null });

    await expect(signInWithAlias({
      login: "s_elise.ben_ali",
      password: "historical-password",
      kind: "student",
      firstName: "Élise",
      secondValue: "Ben Ali",
    })).resolves.toEqual({ ok: true, roles: ["student"] });
    expect(mocks.signIn).toHaveBeenCalledTimes(2);
    expect(mocks.resolveAlias).toHaveBeenCalledWith("resolve_login_alias", { target_login_alias: "s_elise_ben_ali" });
  });

  it("authenticates a historical teacher alias without changing its role", async () => {
    mocks.resolveAlias.mockImplementation((_name: string, { target_login_alias: alias }: { target_login_alias: string }) =>
      Promise.resolve({ data: alias === "t_ahmed_classe_1" ? "teacher@accounts.example.test" : null, error: null }));
    mocks.signIn
      .mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid") })
      .mockResolvedValueOnce({ data: { user: { id: "teacher-id" } }, error: null });
    mocks.roles.mockReturnValue(Promise.resolve({ data: [{ role: "teacher" }], error: null }));

    await expect(signInWithAlias({
      login: "t_ahmed.classe_1",
      password: "historical-password",
      kind: "teacher",
      firstName: "Ahmed",
      secondValue: "Classe 1",
    })).resolves.toEqual({ ok: true, roles: ["teacher"] });
  });

  it("recognizes the direction role through the teacher login path", async () => {
    mocks.resolveAlias.mockResolvedValue({ data: "direction@accounts.example.test", error: null });
    mocks.signIn.mockResolvedValue({ data: { user: { id: "direction-id" } }, error: null });
    mocks.roles.mockReturnValue(Promise.resolve({ data: [{ role: "direction" }], error: null }));

    await expect(signInWithAlias({ login: "t_auti1.487", password: "valid", kind: "teacher", firstName: "AUTI1", secondValue: "487!" }))
      .resolves.toEqual({ ok: true, roles: ["direction"] });
  });

  it("rejects a wrong password without revealing the account state", async () => {
    await expect(signInWithAlias({ login: "s_elise.ben_ali", password: "wrong", kind: "student", firstName: "Élise", secondValue: "Ben Ali" }))
      .resolves.toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("ends the session if the authenticated profile is unavailable", async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { id: "student-id" } }, error: null });
    mocks.profile.mockResolvedValue({ data: null, error: null });
    await expect(signInWithAlias({ login: "s_elise_ben_ali", password: "valid" }))
      .resolves.toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
