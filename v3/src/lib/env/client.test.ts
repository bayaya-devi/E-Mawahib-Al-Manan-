import { describe, expect, it } from "vitest";

import { parseClientEnvironment } from "./client";

describe("client environment", () => {
  it("accepts a complete environment", () => {
    expect(
      parseClientEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "publishable-key-with-safe-length",
        NEXT_PUBLIC_APP_ENV: "test",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "publishable-key-with-safe-length",
      NEXT_PUBLIC_APP_ENV: "test",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
    });
  });

  it("rejects missing or malformed public configuration", () => {
    expect(() => parseClientEnvironment({})).toThrow();
  });
});
