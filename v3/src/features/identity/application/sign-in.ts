import "server-only";

import { randomUUID } from "node:crypto";

import { getPrivilegedServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types";

import { AUTH_MESSAGES } from "../domain/auth-messages";
import { loginInputSchema } from "./schemas";

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
  const { data: resolvedEmail, error: resolutionError } = await adminClient.rpc(
    "resolve_login_alias",
    { target_login_alias: parsed.data.login },
  );

  if (resolutionError) {
    return { ok: false, code: "UNAVAILABLE", message: AUTH_MESSAGES.unavailable };
  }

  const email =
    resolvedEmail ?? `unknown-${randomUUID()}@${environment.AUTH_INTERNAL_EMAIL_DOMAIN}`;
  const client = await createClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user || !resolvedEmail) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: AUTH_MESSAGES.invalidCredentials,
    };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
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

  const { data: roleRows, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  if (roleError || roleRows.length === 0) {
    await client.auth.signOut();
    return { ok: false, code: "UNAVAILABLE", message: AUTH_MESSAGES.unavailable };
  }

  return { ok: true, roles: roleRows.map(({ role }) => role) };
}
