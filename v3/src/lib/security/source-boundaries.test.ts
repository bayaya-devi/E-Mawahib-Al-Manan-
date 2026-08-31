import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(fullPath);
      if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
        return [fullPath];
      }
      return [];
    }),
  );
  return nested.flat();
}

describe("source security boundaries", () => {
  it("does not use browser storage as an authorization source", async () => {
    const files = await sourceFiles(path.resolve(import.meta.dirname, "../.."));
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/(?:localStorage|sessionStorage).*role|role.*(?:localStorage|sessionStorage)/i.test(source)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not expose service credentials or legacy hardcoded admin identifiers", async () => {
    const files = await sourceFiles(path.resolve(import.meta.dirname, "../.."));
    const forbiddenFragments = [
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE",
      "AUTI1",
      "487!",
      "!0110",
    ];
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (forbiddenFragments.some((fragment) => source.includes(fragment))) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
