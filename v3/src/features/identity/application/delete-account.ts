import "server-only";

import { z } from "zod";

import { can } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types";

type DeleteResult =
  | { ok: true; message: string }
  | { ok: false; code: "FORBIDDEN" | "INVALID" | "HAS_HISTORY" | "FAILED"; message: string };

export async function permanentlyDeleteAccount(targetUserId: string): Promise<DeleteResult> {
  if (!z.string().uuid().safeParse(targetUserId).success) {
    return { ok: false, code: "INVALID", message: "معرّف الحساب غير صالح." };
  }

  const session = await createClient();
  const { data: auth } = await session.auth.getUser();
  if (!auth.user || auth.user.id === targetUserId) {
    return { ok: false, code: "FORBIDDEN", message: "غير مسموح بحذف هذا الحساب." };
  }

  const [{ data: actorRoles }, { data: actorProfile }, { data: targetMembership }] = await Promise.all([
    session.from("user_roles").select("role").eq("user_id", auth.user.id),
    session.from("profiles").select("status").eq("id", auth.user.id).maybeSingle(),
    session.from("school_memberships").select("school_id").eq("user_id", targetUserId).eq("status", "active").maybeSingle(),
  ]);
  const roles = (actorRoles ?? []).map(({ role }) => role as AppRole);
  if (actorProfile?.status !== "active" || !roles.some((role) => can(role, "school:manage")) || !targetMembership) {
    return { ok: false, code: "FORBIDDEN", message: "غير مسموح بحذف هذا الحساب." };
  }

  const admin = createAdminClient();
  const { error: dataError } = await admin.rpc("cleanup_provisioned_account_data", {
    target_user_id: targetUserId,
  });
  if (dataError) {
    const code = "HAS_HISTORY";
    return {
      ok: false,
      code,
      message: code === "HAS_HISTORY"
        ? "لا يمكن الحذف النهائي لحساب له سجل تعلم أو مالي. استخدم الأرشفة للحفاظ على التاريخ."
        : "تعذر حذف الحساب نهائيا.",
    };
  }

  const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);
  if (authError) {
    return { ok: false, code: "FAILED", message: "تم حذف بيانات الحساب، وتعذر حذف بيانات الدخول." };
  }
  return { ok: true, message: "تم حذف الحساب نهائيا." };
}
