import { createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath] = process.argv.slice(2);
const fingerprintKey = process.env.V1_MIGRATION_FINGERPRINT_KEY;

if (!inputPath || !outputPath) {
  throw new Error("Usage: npm run migration:v1:prepare -- input.json output.json");
}
if (!fingerprintKey || fingerprintKey.length < 32) {
  throw new Error("V1_MIGRATION_FINGERPRINT_KEY must contain at least 32 characters");
}

const allowedRoles = new Set(["student", "parent", "teacher", "admin", "direction"]);
const legacyPasswordKeys = new Set([
  "password",
  "mot_de_passe",
  "motDePasse",
  "mdp",
  "encrypted_password",
]);

function requiredText(record, key, index) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Record ${index}: ${key} is required`);
  }
  return value.trim();
}

function normalizeIdentifier(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("fr");
}

const source = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(source)) throw new Error("The source file must contain a JSON array");

const seenLegacyIds = new Set();
const seenFingerprints = new Set();
let droppedPasswordFieldCount = 0;

const accounts = source.map((record, index) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Record ${index}: expected an object`);
  }

  droppedPasswordFieldCount += Object.keys(record).filter((key) =>
    legacyPasswordKeys.has(key),
  ).length;

  const legacyUserId = requiredText(record, "legacyUserId", index);
  const loginIdentifier = normalizeIdentifier(
    requiredText(record, "loginIdentifier", index),
  );
  const firstName = requiredText(record, "firstName", index);
  const lastName = requiredText(record, "lastName", index);
  const schoolCode = requiredText(record, "schoolCode", index);
  const roles = record.roles;

  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    roles.some((role) => typeof role !== "string" || !allowedRoles.has(role))
  ) {
    throw new Error(`Record ${index}: roles are invalid`);
  }

  const identifierFingerprint = createHmac("sha256", fingerprintKey)
    .update(loginIdentifier)
    .digest("hex");

  if (seenLegacyIds.has(legacyUserId)) {
    throw new Error(`Duplicate legacyUserId at record ${index}`);
  }
  if (seenFingerprints.has(identifierFingerprint)) {
    throw new Error(`Duplicate login identifier at record ${index}`);
  }
  seenLegacyIds.add(legacyUserId);
  seenFingerprints.add(identifierFingerprint);

  return {
    legacyUserId,
    identifierFingerprint,
    firstName,
    lastName,
    schoolCode,
    roles: [...new Set(roles)],
    targetStatus: "pending",
    requiresPasswordReset: true,
  };
});

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceCount: source.length,
      preparedCount: accounts.length,
      droppedPasswordFieldCount,
      accounts,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify({
    sourceCount: source.length,
    preparedCount: accounts.length,
    droppedPasswordFieldCount,
  }),
);
