import "server-only";

import { randomUUID } from "node:crypto";

import { getPrivilegedServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types";

import { AUTH_MESSAGES } from "../domain/auth-messages";
import { buildLoginAliasCandidates } from "../domain/legacy-login";
import { loginInputSchema } from "./schemas";
import { deriveLegacyAuthPassword } from "./legacy-password";

type SignInResult =
  | { ok: true; roles: AppRole[] }
  | {
      ok: false;
      code: "INVALID_CREDENTIALS" | "PENDING" | "SUSPENDED" | "ARCHIVED" | "UNAVAILABLE";
      message: string;
    };

export async function signInWithAlias(input: unknown): Promise<SignInResult> {
  const parsed = loginInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: AUTH_MESSAGES.invalidCredentials,
    };
  }

  const environment = getPrivilegedServerEnvironment();
  const adminClient = createAdminClient();
  const aliases = buildLoginAliasCandidates(parsed.data);
  const resolutions = await Promise.all(aliases.map((alias) => adminClient.rpc(
    "resolve_login_alias",
    { target_login_alias: alias },
  )));
  const resolvedIndex = resolutions.findIndex(({ data }) => Boolean(data));
  const resolvedEmail = resolvedIndex >= 0 ? resolutions[resolvedIndex]?.data ?? null : null;
  const resolvedAlias = resolvedIndex >= 0 ? aliases[resolvedIndex] ?? parsed.data.login : parsed.data.login;

  if (resolutions.every(({ error }) => Boolean(error))) {
    return { ok: false, code: "UNAVAILABLE", message: AUTH_MESSAGES.unavailable };
  }

  const email =
    resolvedEmail ?? `unknown-${randomUUID()}@${environment.AUTH_INTERNAL_EMAIL_DOMAIN}`;
  const client = await createClient();
  const passwords = [parsed.data.password];
  const trimmedPassword = parsed.data.password.trim();
  if (trimmedPassword && trimmedPassword !== parsed.data.password) passwords.push(trimmedPassword);
  const migratedPassword = deriveLegacyAuthPassword(resolvedAlias, trimmedPassword);
  if (migratedPassword) passwords.push(migratedPassword);

  let authenticatedUserId: string | null = null;
  for (const password of [...new Set(passwords)]) {
    const attempt = await client.auth.signInWithPassword({ email, password });
    if (!attempt.error && attempt.data.user) {
      authenticatedUserId = attempt.data.user.id;
      break;
    }
  }

  if (!authenticatedUserId || !resolvedEmail) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: AUTH_MESSAGES.invalidCredentials,
    };
  }

  // The database denies archived sessions at the RLS boundary. Use the
  // trusted server client here so the login endpoint can still return the
  // precise account-state message after Supabase Auth validates a password.
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", authenticatedUserId)
    .maybeSingle();

  if (profileError || !profile) {
    await client.auth.signOut();
    return { ok: false, code: "UNAVAILABLE", message: AUTH_MESSAGES.unavailable };
  }

  if (profile.status !== "active") {
    await client.auth.signOut();
    const statusMessages = {
      pending: AUTH_MESSAGES.pending,
      suspended: AUTH_MESSAGES.suspended,
      archived: AUTH_MESSAGES.archived,
    } as const;
    return {
      ok: false,
      code: profile.status.toUpperCase() as "PENDING" | "SUSPENDED" | "ARCHIVED",
      message: statusMessages[profile.status],
    };
  }

  const { data: roleRows, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", authenticatedUserId);

  if (roleError || roleRows.length === 0) {
    await client.auth.signOut();
    return { ok: false, code: "UNAVAILABLE", message: AUTH_MESSAGES.unavailable };
  }

  return { ok: true, roles: roleRows.map(({ role }) => role) };
}
