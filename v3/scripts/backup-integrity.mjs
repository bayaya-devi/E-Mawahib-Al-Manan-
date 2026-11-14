import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [command, archivePath, sidecarPath] = process.argv.slice(2);
const key = process.env.BACKUP_INTEGRITY_KEY;

if (!key || key.length < 32) throw new Error("BACKUP_INTEGRITY_KEY must contain at least 32 characters");
if (!archivePath || !sidecarPath || !["sign", "verify"].includes(command ?? "")) throw new Error("Usage: backup-integrity.mjs <sign|verify> <archive> <sidecar>");

const archive = await readFile(archivePath);
const current = {
  algorithm: "HMAC-SHA256",
  sha256: createHash("sha256").update(archive).digest("hex"),
  hmac: createHmac("sha256", key).update(archive).digest("hex"),
};

if (command === "sign") {
  await writeFile(sidecarPath, `${JSON.stringify(current)}\n`, { mode: 0o600 });
  process.stdout.write(`${sidecarPath}\n`);
  process.exit(0);
}

const expected = JSON.parse(await readFile(sidecarPath, "utf8"));
const equal = (left, right) => typeof right === "string" && left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
if (expected.algorithm !== current.algorithm || !equal(current.sha256, expected.sha256) || !equal(current.hmac, expected.hmac)) throw new Error("Backup integrity verification failed");
process.stdout.write("Backup integrity verified.\n");
