import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("Usage: npm run migration:v1:complete -- export-v1.json bundle-v3.json");
const source = JSON.parse(await readFile(inputPath, "utf8"));
if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("The V1 export must be an object");

const arrays = ["accounts", "progressions", "teachers", "relationships", "assignments", "administrativeData", "messages", "history"];
for (const key of arrays) if (source[key] !== undefined && !Array.isArray(source[key])) throw new Error(`${key} must be an array`);

const technical = { assignments: [], sessionReports: [], incidents: [], requests: [], discarded: [], review: [] };
const conversations = [];
for (const [index, raw] of (source.messages ?? []).entries()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) { technical.review.push({ index, reason: "invalid_message", raw }); continue; }
  const body = String(raw.body ?? raw.message ?? "").trim();
  const prefix = body.match(/^\s*\[?([A-Z_ -]{3,24})\]?\s*[:|]\s*/u)?.[1]?.replace(/[ -]+/gu, "_");
  const cleanBody = prefix ? body.replace(/^\s*\[?[A-Z_ -]{3,24}\]?\s*[:|]\s*/u, "").trim() : body;
  const record = { legacyId: String(raw.id ?? `message-${index}`), sender: raw.sender ?? raw.senderId ?? null, recipient: raw.recipient ?? raw.recipientId ?? null, title: String(raw.subject ?? raw.title ?? "رسالة").trim(), body: cleanBody, createdAt: raw.createdAt ?? raw.date ?? null };
  if (["CACHE", "DEBUG", "VERSION", "SYNC", "TECH", "XP"].includes(prefix)) technical.discarded.push({ ...record, reason: prefix.toLowerCase() });
  else if (["HOMEWORK", "DEVOIR", "ASSIGNMENT"].includes(prefix)) technical.assignments.push(record);
  else if (["SESSION_REPORT", "RAPPORT", "SEANCE"].includes(prefix)) technical.sessionReports.push(record);
  else if (["INCIDENT", "ALERT", "SIGNALEMENT"].includes(prefix)) technical.incidents.push(record);
  else if (["REQUEST", "DEMANDE", "SALARY", "MATERIAL"].includes(prefix)) technical.requests.push(record);
  else if (!record.sender || !record.recipient || !record.body) technical.review.push({ ...record, reason: "missing_relationship_or_body" });
  else conversations.push(record);
}

const accountFields = new Set(["legacyUserId", "firstName", "lastName", "schoolCode", "roles", "status"]);
const accounts = (source.accounts ?? []).map((record, index) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`accounts[${index}] is invalid`);
  const clean = Object.fromEntries(Object.entries(record).filter(([key]) => accountFields.has(key)));
  if (!clean.legacyUserId || !clean.firstName || !clean.lastName) throw new Error(`accounts[${index}] misses identity fields`);
  return { ...clean, status: ["active", "suspended", "archived", "pending"].includes(clean.status) ? clean.status : "pending", requiresPasswordReset: true };
});

const sections = {
  accounts,
  progressions: source.progressions ?? [], teachers: source.teachers ?? [], relationships: source.relationships ?? [],
  assignments: [...(source.assignments ?? []), ...technical.assignments], administrativeData: source.administrativeData ?? [],
  conversations, sessionReports: technical.sessionReports, incidents: technical.incidents, requests: technical.requests,
  history: source.history ?? [], review: technical.review,
};
const sourceFingerprint = createHash("sha256").update(JSON.stringify(source)).digest("hex");
const counts = Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.length]));
const output = { format: "e-mawahib-v3-migration-bundle@1", generatedAt: new Date().toISOString(), sourceFingerprint, counts, discardedTechnicalCount: technical.discarded.length, sections };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ sourceFingerprint, counts, discardedTechnicalCount: technical.discarded.length }));
