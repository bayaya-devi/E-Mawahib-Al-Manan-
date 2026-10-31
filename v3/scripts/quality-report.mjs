import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const output = join(root, "reports", "08-quality", "inventory.md");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  }));
  return nested.flat();
}

const files = (await walk(sourceRoot)).filter((file) => /\.(ts|tsx)$/u.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));
const measured = await Promise.all(files.map(async (file) => ({
  file: relative(root, file).replaceAll("\\", "/"),
  lines: (await readFile(file, "utf8")).split(/\r?\n/u).length,
  bytes: (await stat(file)).size,
})));
const large = measured.filter((file) => file.lines > 300).sort((a, b) => b.lines - a.lines);
const report = [
  "# Inventaire qualité",
  "",
  `Généré le ${new Date().toISOString()}.`,
  "",
  `- Fichiers source TypeScript : ${measured.length}`,
  `- Fichiers de plus de 300 lignes : ${large.length}`,
  `- Fichiers de plus de 500 lignes : ${large.filter((file) => file.lines > 500).length}`,
  "",
  "## Fichiers à surveiller",
  "",
  "| Fichier | Lignes | Octets |",
  "| --- | ---: | ---: |",
  ...large.map((file) => `| ${file.file} | ${file.lines} | ${file.bytes} |`),
  "",
].join("\n");

await mkdir(join(root, "reports", "08-quality"), { recursive: true });
await writeFile(output, report, "utf8");
console.log(`Inventaire écrit dans ${relative(root, output)}`);
