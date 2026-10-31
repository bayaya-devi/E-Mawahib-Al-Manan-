import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("does not send ranged Quran audio through CacheStorage", async () => {
  const source = await readFile(new URL("../../../public/sw.js", import.meta.url), "utf8");
  expect(source).toContain('request.headers.has("range") ? fetch(request)');
  expect(source).toContain("response.status === 200");
  expect(source.indexOf('/api/quran/audio/')).toBeLessThan(source.indexOf('url.pathname.includes("/student/quran")'));
});
