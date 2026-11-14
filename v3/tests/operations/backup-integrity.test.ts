import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/backup-integrity.mjs");
const integrityKey = "a".repeat(48);

describe("encrypted backup integrity", () => {
  it("accepts an untampered archive and rejects a modified one", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "e-mawahib-backup-"));
    try {
      const archive = path.join(directory, "backup.enc");
      const sidecar = `${archive}.integrity.json`;
      await writeFile(archive, "encrypted-content");

      expect(run("sign", archive, sidecar).status).toBe(0);
      expect(run("verify", archive, sidecar).status).toBe(0);

      await writeFile(archive, "modified-content");
      expect(run("verify", archive, sidecar).status).not.toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function run(command: "sign" | "verify", archive: string, sidecar: string) {
  return spawnSync(process.execPath, [script, command, archive, sidecar], {
    cwd: path.resolve("."),
    env: { ...process.env, BACKUP_INTEGRITY_KEY: integrityKey },
    encoding: "utf8",
  });
}
