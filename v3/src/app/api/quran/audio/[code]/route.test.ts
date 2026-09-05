import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("Warsh audio proxy", () => {
  it("rejects invalid codes without contacting the source", async () => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    const response = await GET(new Request("https://example.test/api/quran/audio/bad"), { params: Promise.resolve({ code: "bad" }) });
    expect(response.status).toBe(400); expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards byte ranges and audio headers", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(new Uint8Array([0x49, 0x44, 0x33]), { status: 206, headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-2/99" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await GET(new Request("https://example.test/api/quran/audio/114001", { headers: { range: "bytes=0-2" } }), { params: Promise.resolve({ code: "114001" }) });
    expect(response.status).toBe(206); expect(response.headers.get("content-range")).toBe("bytes 0-2/99");
    expect(upstream).toHaveBeenCalledWith(expect.stringContaining("114001.mp3"), expect.objectContaining({ headers: { Range: "bytes=0-2" } }));
  });

  it("uses the secondary source after a primary failure", async () => {
    const upstream = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await GET(new Request("https://example.test/api/quran/audio/001001"), { params: Promise.resolve({ code: "001001" }) });
    expect(response.status).toBe(200); expect(upstream).toHaveBeenCalledTimes(2);
  });
});
