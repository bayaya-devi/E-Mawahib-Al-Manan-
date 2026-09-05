import { isValidLoginAlias, normalizeLoginAlias } from "./login-alias";

export type LoginAccountKind = "student" | "teacher";

export function buildCanonicalLoginAlias(kind: LoginAccountKind, firstName: string, secondValue: string): string {
  return `${kind === "student" ? "s" : "t"}_${cleanIdentityPart(firstName)}.${cleanIdentityPart(secondValue)}`;
}

export function buildLoginAliasCandidates(input: {
  login: string;
  kind?: LoginAccountKind | undefined;
  firstName?: string | undefined;
  secondValue?: string | undefined;
}): string[] {
  const aliases = [normalizeLoginAlias(input.login)];
  if (!input.kind || input.firstName === undefined || input.secondValue === undefined) return aliases;

  const prefix = input.kind === "student" ? "s" : "t";
  const cleanFirst = cleanIdentityPart(input.firstName);
  const cleanSecond = cleanIdentityPart(input.secondValue);
  const rawFirst = input.firstName.trim().toLocaleLowerCase("fr");
  const rawSecond = input.secondValue.trim().toLocaleLowerCase("fr");
  const legacy = `${input.firstName.trim()}.${input.secondValue.trim()}`
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\s+/gu, "_");

  const historicalUsernames = [
    `${cleanFirst}.${cleanSecond}`,
    legacy,
    `${cleanFirst}${cleanSecond}`,
    `${cleanFirst}_${cleanSecond}`,
    `${cleanFirst}-${cleanSecond}`,
    `${rawFirst}.${rawSecond}`,
    `${rawFirst}_${rawSecond}`,
  ];

  for (const username of historicalUsernames) {
    const alias = normalizeLoginAlias(`${prefix}_${username}`);
    if (isValidLoginAlias(alias) && !aliases.includes(alias)) aliases.push(alias);
  }
  return aliases;
}

function cleanIdentityPart(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/['’`´]/gu, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}
