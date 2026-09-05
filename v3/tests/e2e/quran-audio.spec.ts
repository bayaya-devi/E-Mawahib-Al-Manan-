import { expect, test } from "@playwright/test";

test("same-origin Warsh audio serves several exact ayah codes with byte-range support", async ({ request }) => {
  for (const code of ["001001", "002255", "096019", "114006"]) {
    const response = await request.get(`/api/quran/audio/${code}`, { headers: { Range: "bytes=0-1023" }, timeout: 30_000 });
    expect([200, 206]).toContain(response.status());
    expect(response.headers()["content-type"]).toContain("audio");
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  }
});
