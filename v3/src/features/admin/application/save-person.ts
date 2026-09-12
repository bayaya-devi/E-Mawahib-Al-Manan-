import "server-only";

import { buildCanonicalLoginAlias } from "@/features/identity/domain/legacy-login";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type PersonFormPayload = {
  firstName: string;
  lastName: string;
  gender?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  monthlyAmount?: string | undefined;
  guardianName?: string | undefined;
  guardianPhone?: string | undefined;
  dateOfBirth?: string | undefined;
  identityDocumentReceived?: boolean | undefined;
  birthCertificateReceived?: boolean | undefined;
  guardianIdentityReceived?: boolean | undefined;
  accessibilityNotes?: string | undefined;
  classId?: string | undefined;
  classIds?: string[] | undefined;
  teacherIds?: string[] | undefined;
};

export async function savePersonFromAdmin(
  targetUserId: string,
  role: "student" | "teacher",
  input: PersonFormPayload,
) {
  const client = await createClient();
  const payload: Json = {
    first_name: input.firstName,
    last_name: input.lastName,
    gender: input.gender ?? "unspecified",
    phone: input.phone ?? "",
    email: input.email ?? "",
    monthly_salary: input.monthlyAmount ?? "0",
    monthly_fee: input.monthlyAmount ?? "0",
    guardian_name: input.guardianName ?? "",
    guardian_phone: input.guardianPhone ?? "",
    date_of_birth: input.dateOfBirth ?? "",
    identity_document_received: input.identityDocumentReceived ?? false,
    birth_certificate_received: input.birthCertificateReceived ?? false,
    guardian_identity_received: input.guardianIdentityReceived ?? false,
    accessibility_notes: input.accessibilityNotes ?? "",
  };

  if (role === "student") {
    const alias = buildCanonicalLoginAlias("student", input.firstName, input.lastName);
    const credentials = await client.rpc("admin_update_login_alias", {
      target_user_id: targetUserId,
      target_login_alias: alias,
      target_password_reset: false,
    });
    if (credentials.error) return { ok: false as const, message: "تعذر ضبط بيانات الدخول." };
  }

  const profile = await client.rpc("admin_update_person", {
    target_user_id: targetUserId,
    payload,
  });
  if (profile.error) return { ok: false as const, message: "تعذر حفظ ملف الحساب." };

  if (role === "student" && input.classId) {
    const relations = await client.rpc("admin_set_student_relations", {
      target_student_id: targetUserId,
      target_class_id: input.classId,
      target_teacher_ids: input.teacherIds ?? [],
    });
    if (relations.error) return { ok: false as const, message: "تم إنشاء الملف، وتعذر ربط القسم أو الأستاذ." };
  }

  if (role === "teacher") {
    const relations = await client.rpc("admin_set_teacher_classes", {
      target_teacher_id: targetUserId,
      target_class_ids: input.classIds ?? [],
    });
    if (relations.error) return { ok: false as const, message: "تم إنشاء الملف، وتعذر ربط الأقسام." };
  }

  return { ok: true as const };
}
