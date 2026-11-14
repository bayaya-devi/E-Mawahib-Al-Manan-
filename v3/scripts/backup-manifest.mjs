import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [outputPath, ...files] = process.argv.slice(2);
if (!outputPath || files.length === 0) throw new Error("Usage: backup-manifest.mjs <output> <file...>");
const entries = await Promise.all(files.map(async (file) => [file.split(/[\\/]/u).at(-1), createHash("sha256").update(await readFile(file)).digest("hex")]));
await writeFile(outputPath, `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`, { mode: 0o600 });
