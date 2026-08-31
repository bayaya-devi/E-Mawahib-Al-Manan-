import "server-only";
import { createHmac } from "node:crypto";
import { getPrivilegedServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getLoginRateLimit(request: Request, input: unknown): Promise<{ allowed: boolean; keys: string[] }> {
  const environment = getPrivilegedServerEnvironment(); const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const login = typeof record.login === "string" ? record.login.normalize("NFKC").trim().toLocaleLowerCase("fr") : "invalid";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(); const network = forwarded || request.headers.get("x-real-ip") || "unknown";
  const keys = [`login:${digest(login, environment.PUBLIC_INTERACTION_HMAC_KEY)}`, `network:${digest(network, environment.PUBLIC_INTERACTION_HMAC_KEY)}`];
  const result = await createAdminClient().rpc("auth_rate_limit_allowed", { target_keys: keys });
  return { allowed: result.data === true, keys };
}
export async function recordLoginRateLimit(keys: string[], success: boolean): Promise<void> { await createAdminClient().rpc("record_auth_rate_limit", { target_keys: keys, target_success: success }); }
function digest(value: string, key: string): string { return createHmac("sha256", key).update(value).digest("hex"); }
