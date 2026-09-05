import type { DatabaseAppRole } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

export type SavedDeviceAccount = { id: string; name: string; kind: DatabaseAppRole; accessToken: string; refreshToken: string; expiresAt: number | null };
const KEY = "emawahib.device-accounts.v1";

export function readDeviceAccounts(): SavedDeviceAccount[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedDeviceAccount[];
    return Array.isArray(value) ? value.filter((item) => item.id && item.refreshToken && item.kind) : [];
  } catch { return []; }
}

export function saveDeviceAccounts(items: SavedDeviceAccount[]): void { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 8))); }
export function removeDeviceAccount(id: string): void { saveDeviceAccounts(readDeviceAccounts().filter((item) => item.id !== id)); }
export function deviceAccountHome(kind: DatabaseAppRole): string {
  if (kind === "teacher") return "/teacher";
  if (kind === "parent") return "/family";
  if (kind === "admin" || kind === "direction") return "/admin";
  return "/student";
}

export async function rememberAuthenticatedAccount(): Promise<{ items: SavedDeviceAccount[]; active: string | null }> {
  const client = createClient();
  const session = (await client.auth.getSession()).data.session;
  if (!session) return { items: readDeviceAccounts(), active: null };
  const [profile, memberships] = await Promise.all([
    client.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", session.user.id),
  ]);
  const kind = preferredKind((memberships.data ?? []).map(({ role }) => role));
  const item: SavedDeviceAccount = {
    id: session.user.id,
    name: profile.data?.display_name ?? "حساب",
    kind,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
  };
  const items = [item, ...readDeviceAccounts().filter(({ id }) => id !== item.id)].slice(0, 8);
  saveDeviceAccounts(items);
  return { items, active: item.id };
}

function preferredKind(kinds: DatabaseAppRole[]): DatabaseAppRole {
  return (["admin", "direction", "teacher", "parent", "student"] as DatabaseAppRole[]).find((kind) => kinds.includes(kind)) ?? "student";
}
