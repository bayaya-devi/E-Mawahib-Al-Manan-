import "server-only";

import { z } from "zod";

import { can } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types";

import { AUTH_MESSAGES } from "../domain/auth-messages";
import { accountStatusInputSchema } from "./schemas";

type ChangeStatusResult =
  | { ok: true; message: string }
  | { ok: false; code: "INVALID" | "FORBIDDEN" | "FAILED"; message: string };

export async function changeAccountStatus(
  targetUserId: string,
  input: unknown,
): Promise<ChangeStatusResult> {
  const parsedUserId = z.string().uuid().safeParse(targetUserId);
  const parsed = accountStatusInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { ok: false, code: "INVALID", message: AUTH_MESSAGES.statusUpdateFailed };
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
  if (
    roleError ||
    actorProfile?.status !== "active" ||
    !actorRoles.some((role) => can(role, "school:manage"))
  ) {
    return { ok: false, code: "FORBIDDEN", message: AUTH_MESSAGES.forbidden };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.rpc("set_account_status", {
    target_user_id: parsedUserId.data,
    target_status: parsed.data.status,
    target_suspension_reason: parsed.data.suspensionReason,
    actor_user_id: authentication.user.id,
    target_school_id: parsed.data.schoolId,
  });

  if (error) {
    return { ok: false, code: "FAILED", message: AUTH_MESSAGES.statusUpdateFailed };
  }
  return { ok: true, message: AUTH_MESSAGES.statusUpdated };
}
