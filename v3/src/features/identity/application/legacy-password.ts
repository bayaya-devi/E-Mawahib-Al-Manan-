import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getPrivilegedServerEnvironment } from "@/lib/env/server";

type LegacyAccount = { password?: string | null };

export function deriveLegacyAuthPassword(login: string, password: string) {
  const key = getPrivilegedServerEnvironment().LEGACY_AUTH_HMAC_KEY;
  if (!key) return null;
  return createHmac("sha256", key)
    .update(`e-mawahib-v1:${login}:${password}`)
    .digest("hex");
}

function passwordMatches(stored: string, submitted: string) {
  const candidates = [submitted, Buffer.from(submitted, "utf8").toString("base64")];
  return candidates.some((candidate) => {
    const left = Buffer.from(stored, "utf8");
    const right = Buffer.from(candidate, "utf8");
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

export async function verifyLegacyPassword(login: string, password: string) {
  const environment = getPrivilegedServerEnvironment();
  if (!environment.LEGACY_AUTH_HMAC_KEY) return false;
  const headers = {
    apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const legacyLogin = login.replace(/^[st]_/u, "");
  const tables = login.startsWith("t_") ? ["profs"] as const : ["eleves"] as const;
  for (const table of tables) {
    const query = new URL(`/rest/v1/${table}`, environment.NEXT_PUBLIC_SUPABASE_URL);
    query.searchParams.set("select", "password");
    query.searchParams.set("username", `eq.${legacyLogin}`);
    query.searchParams.set("limit", "1");
    const response = await fetch(query, { headers, cache: "no-store" });
    if (!response.ok) continue;
    const rows = (await response.json()) as LegacyAccount[];
    const stored = rows[0]?.password;
    if (stored && passwordMatches(stored, password)) return true;
  }
  return false;
}
