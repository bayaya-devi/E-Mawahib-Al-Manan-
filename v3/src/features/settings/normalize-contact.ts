import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { DatabaseContactKind } from "@/types/database";

export function normalizeContact(kind: DatabaseContactKind, value: string): { normalized: string; countryCode: string } {
  const trimmed = value.trim();
  if (kind === "phone") { const phone = parsePhoneNumberFromString(trimmed, "MA"); if (!phone?.isValid()) throw new Error("أدخل رقم هاتف صحيحا مع رمز الدولة."); return { normalized: phone.number, countryCode: phone.country ?? "MA" }; }
  const normalized = trimmed.toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) throw new Error("أدخل بريدا إلكترونيا صحيحا."); return { normalized, countryCode: "" };
}
