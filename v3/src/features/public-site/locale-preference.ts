import { locales, type PublicLocale } from "./content";

export const publicLocaleCookie = "public_locale";

export function resolvePublicLocale(preferred: readonly string[] | null | undefined, saved?: string | null): PublicLocale {
  const savedLocale = toPublicLocale(saved);
  if (savedLocale) return savedLocale;
  for (const value of preferred ?? []) {
    const locale = toPublicLocale(value);
    if (locale) return locale;
  }
  return "fr";
}

export function toPublicLocale(value?: string | null): PublicLocale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  if ((locales as readonly string[]).includes(normalized)) return normalized as PublicLocale;
  const language = normalized.split("-", 1)[0];
  if (language === "fr" || language === "ar" || language === "en") return language;
  if (language === "zgh" || language === "tzm" || language === "shi") return "amz";
  return null;
}
