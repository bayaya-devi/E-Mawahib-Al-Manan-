const LOGIN_ALIAS_PATTERN = /^[\p{L}\p{N}._-]+$/u;

export function normalizeLoginAlias(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("fr");
}

export function isValidLoginAlias(value: string): boolean {
  const normalized = normalizeLoginAlias(value);
  return (
    normalized.length >= 3 &&
    normalized.length <= 80 &&
    LOGIN_ALIAS_PATTERN.test(normalized)
  );
}
