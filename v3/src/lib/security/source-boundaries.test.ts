import { beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if ([".git", ".next", "node_modules", "coverage"].includes(entry.name)) return [];
        return sourceFiles(fullPath);
      }
      if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
        return [fullPath];
      }
      return [];
    }),
  );
  return nested.flat();
}

describe("source security boundaries", () => {
  let sources: Array<{ file: string; source: string }> = [];

  beforeAll(async () => {
    const files = await sourceFiles(path.resolve(import.meta.dirname, "../.."));
    sources = await Promise.all(files.map(async (file) => ({ file, source: await readFile(file, "utf8") })));
  }, 30_000);

  it("does not use browser storage as an authorization source", () => {
    const violations: string[] = [];
    for (const { file, source } of sources) {
      if (/(?:localStorage|sessionStorage).*role|role.*(?:localStorage|sessionStorage)/i.test(source)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not expose service credentials or legacy hardcoded admin identifiers", () => {
    const forbiddenFragments = [
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE",
      "AUTI1",
      "487!",
      "!0110",
    ];
    const violations: string[] = [];
    for (const { file, source } of sources) {
      if (forbiddenFragments.some((fragment) => source.includes(fragment))) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
