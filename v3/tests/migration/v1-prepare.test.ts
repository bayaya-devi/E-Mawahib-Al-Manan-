import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("V1 account preparation", () => {
  it("drops legacy passwords and raw login identifiers", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "mawahib-v1-migration-"));
    temporaryDirectories.push(directory);
    const inputPath = path.join(directory, "input.json");
    const outputPath = path.join(directory, "output.json");
    const scriptPath = path.resolve(
      import.meta.dirname,
      "../../scripts/migration/prepare-v1-accounts.mjs",
    );

    await writeFile(
      inputPath,
      JSON.stringify([
        {
          legacyUserId: "legacy-1",
          loginIdentifier: "Student_A",
          firstName: "Student",
          lastName: "A",
          schoolCode: "FIRST",
          roles: ["student"],
          password: "legacy-plain-secret",
        },
      ]),
      "utf8",
    );

    await execFileAsync(process.execPath, [scriptPath, inputPath, outputPath], {
      env: {
        ...process.env,
        V1_MIGRATION_FINGERPRINT_KEY: "test-key-with-more-than-thirty-two-characters",
      },
    });

    const rawOutput = await readFile(outputPath, "utf8");
    const output = JSON.parse(rawOutput) as {
      droppedPasswordFieldCount: number;
      accounts: Array<Record<string, unknown>>;
    };

    expect(output.droppedPasswordFieldCount).toBe(1);
    expect(rawOutput).not.toContain("legacy-plain-secret");
    expect(rawOutput).not.toContain("student_a");
    expect(output.accounts[0]).toMatchObject({
      legacyUserId: "legacy-1",
      targetStatus: "pending",
      requiresPasswordReset: true,
    });
  });
});
