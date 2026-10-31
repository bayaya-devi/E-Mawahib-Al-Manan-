import "server-only";

import { createHmac } from "node:crypto";

import { getPrivilegedServerEnvironment } from "@/lib/env/server";

export function deriveLegacyAuthPassword(login: string, password: string) {
  const key = getPrivilegedServerEnvironment().LEGACY_AUTH_HMAC_KEY;
  if (!key) return null;
  return createHmac("sha256", key)
    .update(`e-mawahib-v1:${login}:${password.trim()}`)
    .digest("hex");
}
