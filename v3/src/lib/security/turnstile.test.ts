import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyTurnstile } from "./turnstile";

const originalSecret = process.env.TURNSTILE_SECRET_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalSecret;
});

describe("Turnstile verification", () => {
  it("does not alter existing login behaviour before Cloudflare is configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(verifyTurnstile(undefined)).resolves.toBe(true);
  });

  it("requires a token when the server secret is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    await expect(verifyTurnstile(undefined)).resolves.toBe(false);
  });

  it("accepts only a successful Siteverify response", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })));
    await expect(verifyTurnstile("token")).resolves.toBe(true);
  });
});
