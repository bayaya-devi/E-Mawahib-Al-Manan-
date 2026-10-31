import "server-only";

import { randomUUID } from "node:crypto";

import { can } from "@/lib/auth/authorization";
import { getPrivilegedServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types";

import { AUTH_MESSAGES } from "../domain/auth-messages";
import {
  provisionAccountInputSchema,
} from "./schemas";

type ProvisionAccountResult =
  | { ok: true; userId: string; message: string }
  | { ok: false; code: "INVALID" | "FORBIDDEN" | "FAILED"; message: string };

async function discardIncompleteAccount(userId: string) {
  const adminClient = createAdminClient();
  const { error: dataCleanupError } = await adminClient.rpc(
    "cleanup_provisioned_account_data",
    { target_user_id: userId },
  );

  if (dataCleanupError) {
    console.error("account_data_cleanup_failed", {
      userId,
      code: dataCleanupError.code,
    });
  }

  const { error: authCleanupError } = await adminClient.auth.admin.deleteUser(userId);
  if (authCleanupError) {
    console.error("account_auth_cleanup_failed", {
      userId,
      code: authCleanupError.code,
    });
  }
}

export async function provisionAccount(
  input: unknown,
): Promise<ProvisionAccountResult> {
  const parsed = provisionAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: AUTH_MESSAGES.accountCreateFailed };
  }

  const sessionClient = await createClient();
  const { data: authentication, error: authenticationError } =
    await sessionClient.auth.getUser();
  if (authenticationError || !authentication.user) {
    return { ok: false, code: "FORBIDDEN", message: AUTH_MESSAGES.forbidden };
  }

  const { data: actorProfile } = await sessionClient
    .from("profiles")
    .select("status")
    .eq("id", authentication.user.id)
    .maybeSingle();
  const { data: roleRows, error: roleError } = await sessionClient
    .from("user_roles")
    .select("role")
    .eq("user_id", authentication.user.id);

  const actorRoles = (roleRows ?? []).map(({ role }) => role as AppRole);
  const canCreateBasic = actorRoles.some((role) => can(role, "account:create-basic"));
  const requestsPrivilegedRole = parsed.data.roles.some(
    (role) => role === "admin" || role === "direction",
  );
  const canCreatePrivileged = actorRoles.some((role) =>
    can(role, "account:create-privileged"),
  );

  if (
    roleError ||
    actorProfile?.status !== "active" ||
    !canCreateBasic ||
    (requestsPrivilegedRole && !canCreatePrivileged)
  ) {
    return { ok: false, code: "FORBIDDEN", message: AUTH_MESSAGES.forbidden };
  }

  const environment = getPrivilegedServerEnvironment();
  const adminClient = createAdminClient();
  const internalEmail = `${randomUUID()}@${environment.AUTH_INTERNAL_EMAIL_DOMAIN}`;
  const { data: createdAuthUser, error: authCreationError } =
    await adminClient.auth.admin.createUser({
      email: internalEmail,
      password: parsed.data.temporaryPassword,
      email_confirm: true,
      user_metadata: { requires_password_reset: true },
    });

  if (authCreationError || !createdAuthUser.user) {
    return { ok: false, code: "FAILED", message: AUTH_MESSAGES.accountCreateFailed };
  }

  const userId = createdAuthUser.user.id;
  const { error: profileCreationError } = await adminClient.rpc(
    "provision_account_data",
    {
      target_user_id: userId,
      target_login_alias: parsed.data.login,
      target_first_name: parsed.data.firstName,
      target_last_name: parsed.data.lastName,
      target_roles: parsed.data.roles,
      target_school_id: parsed.data.schoolId,
      actor_user_id: authentication.user.id,
      target_locale: parsed.data.locale,
    },
  );

  if (profileCreationError) {
    await discardIncompleteAccount(userId);
    return { ok: false, code: "FAILED", message: AUTH_MESSAGES.accountCreateFailed };
  }

  const { error: activationError } = await adminClient.rpc("set_account_status", {
    target_user_id: userId,
    target_status: "active",
    target_suspension_reason: null,
    actor_user_id: authentication.user.id,
    target_school_id: parsed.data.schoolId,
  });
  if (activationError) {
    await discardIncompleteAccount(userId);
    return { ok: false, code: "FAILED", message: AUTH_MESSAGES.accountCreateFailed };
  }

  return { ok: true, userId, message: "تم إنشاء الحساب وتفعيله." };
}
