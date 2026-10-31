import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithResilience, resetCircuitsForTests } from "./resilience";

afterEach(() => { vi.unstubAllGlobals(); resetCircuitsForTests(); });
describe("fetchWithResilience", () => {
  it("retries a transient server failure", async () => {
    const mocked = vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", mocked);
    const response = await fetchWithResilience("https://example.com/check", { retries: 1, retryDelayMs: 0 });
    expect(response.status).toBe(200);
    expect(mocked).toHaveBeenCalledTimes(2);
  });
  it("does not retry a client error", async () => {
    const mocked = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", mocked);
    const response = await fetchWithResilience("https://example.com/check", { retries: 2, retryDelayMs: 0 });
    expect(response.status).toBe(400);
    expect(mocked).toHaveBeenCalledTimes(1);
  });
});
