import "server-only";
import { createHmac } from "node:crypto";
import { getPrivilegedServerEnvironment } from "@/lib/env/server";

export async function getLoginRateLimit(request: Request, input: unknown): Promise<{ allowed: boolean; keys: string[] }> {
  const environment = getPrivilegedServerEnvironment(); const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const login = typeof record.login === "string" ? record.login.normalize("NFKC").trim().toLocaleLowerCase("fr") : "invalid";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(); const network = forwarded || request.headers.get("x-real-ip") || "unknown";
  const keys = [`login:${digest(login, environment.INTERACTION_HMAC_KEY)}`, `network:${digest(network, environment.INTERACTION_HMAC_KEY)}`];
  const result = await callRateLimitRpc("auth_rate_limit_allowed", { target_keys: keys });
  return { allowed: result === true, keys };
}
export async function recordLoginRateLimit(keys: string[], success: boolean): Promise<void> { await callRateLimitRpc("record_auth_rate_limit", { target_keys: keys, target_success: success }); }
function digest(value: string, key: string): string { return createHmac("sha256", key).update(value).digest("hex"); }

async function callRateLimitRpc(name: "auth_rate_limit_allowed" | "record_auth_rate_limit", body: Record<string, unknown>) {
  const environment = getPrivilegedServerEnvironment();
  const response = await fetch(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return null;
  if (name === "record_auth_rate_limit") return true;
  return await response.json() as boolean;
}
