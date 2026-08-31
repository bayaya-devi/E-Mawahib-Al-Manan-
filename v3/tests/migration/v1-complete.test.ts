import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
describe("complete V1 migration preparation", () => {
  it("routes technical messages and strips account passwords", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "mawahib-full-"));
    try {
      const input = path.join(directory, "v1.json"); const output = path.join(directory, "v3.json");
      await writeFile(input, JSON.stringify({ accounts: [{ legacyUserId: "a", firstName: "A", lastName: "B", schoolCode: "S", roles: ["student"], password: "secret" }], messages: [{ id: 1, sender: "teacher", recipient: "student", body: "HOMEWORK: Review 114" }, { id: 2, sender: "admin", recipient: "teacher", body: "A regular message" }, { id: 3, body: "DEBUG: cache warm" }] }), "utf8");
      const script = path.resolve(import.meta.dirname, "../../scripts/migration/prepare-v1-complete.mjs");
      await execFileAsync(process.execPath, [script, input, output]);
      const raw = await readFile(output, "utf8"); const bundle = JSON.parse(raw);
      expect(raw).not.toContain("secret"); expect(bundle.sections.assignments).toHaveLength(1); expect(bundle.sections.conversations).toHaveLength(1); expect(bundle.discardedTechnicalCount).toBe(1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
