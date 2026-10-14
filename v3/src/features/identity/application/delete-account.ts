import "server-only";

import { z } from "zod";

import { can } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types";

type DeleteResult =
  | { ok: true; message: string }
  | { ok: false; code: "FORBIDDEN" | "INVALID" | "FAILED"; message: string };

export async function moveAccountToTrash(targetUserId: string): Promise<DeleteResult> {
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

  const { error } = await session.rpc("admin_soft_delete_account", {
    target_user_id: targetUserId,
    target_school_id: targetMembership.school_id,
  });
  if (error) {
    return {
      ok: false,
      code: "FAILED",
      message: error.message === "last_direction_account_required"
        ? "يجب الاحتفاظ بحساب إدارة نشط واحد على الأقل."
        : "تعذر نقل الحساب إلى سلة المحذوفات.",
    };
  }
  return { ok: true, message: "تم نقل الحساب إلى سلة المحذوفات مع حفظ السجل." };
}
