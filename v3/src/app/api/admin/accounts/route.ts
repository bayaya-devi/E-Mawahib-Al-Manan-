import { NextResponse } from "next/server";

import { provisionAccount } from "@/features/identity/application/provision-account";
import { savePersonFromAdmin, type PersonFormPayload } from "@/features/admin/application/save-person";
import { buildCanonicalLoginAlias } from "@/features/identity/domain/legacy-login";
import { AUTH_MESSAGES } from "@/features/identity/domain/auth-messages";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: AUTH_MESSAGES.forbidden },
      { status: 403 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: AUTH_MESSAGES.accountCreateFailed },
      { status: 400 },
    );
  }

  const body = input as { roles?: string[]; firstName?: string; lastName?: string; dossier?: PersonFormPayload };
  const isStudent = body.roles?.includes("student");
  const isTeacher = body.roles?.includes("teacher");
  if ((isStudent || isTeacher) && !body.dossier) {
    return NextResponse.json(
      { ok: false, message: "تعذر حفظ ملف الحساب. أكمل البيانات ثم أعد المحاولة." },
      { status: 400 },
    );
  }
  const result = await provisionAccount({
    ...(body as object),
    login: isStudent && body.firstName && body.lastName
      ? buildCanonicalLoginAlias("student", body.firstName, body.lastName)
      : (body as { login?: string }).login,
  });
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  const role = isStudent ? "student" : isTeacher ? "teacher" : null;
  if (role && body.dossier) {
    const saved = await savePersonFromAdmin(result.userId, role, body.dossier);
    if (!saved.ok) {
      await discardIncompleteAccount(result.userId);
      return NextResponse.json({ ok: false, message: saved.message }, { status: 500 });
    }
    const verified = await verifyProvisionedAccount(result.userId, role, body.dossier.classId);
    if (!verified) {
      await discardIncompleteAccount(result.userId);
      return NextResponse.json(
        { ok: false, message: "تعذر التحقق من اكتمال الحساب. لم يتم تفعيل حساب ناقص." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(result, { status: 201 });
}

async function discardIncompleteAccount(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("cleanup_provisioned_account_data", { target_user_id: userId });
  await admin.auth.admin.deleteUser(userId);
}

async function verifyProvisionedAccount(
  userId: string,
  role: "student" | "teacher",
  classId?: string,
): Promise<boolean> {
  const admin = createAdminClient();
  if (role === "teacher") {
    const [{ data: profile }, { data: teacher }] = await Promise.all([
      admin.from("profiles").select("id,status").eq("id", userId).maybeSingle(),
      admin.from("teacher_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
    return profile?.status === "active" && Boolean(teacher);
  }
  if (!classId) return false;
  const [{ data: profile }, { data: student }, { data: file }, { data: enrollment }, { data: primaryTeacher }] = await Promise.all([
    admin.from("profiles").select("id,status").eq("id", userId).maybeSingle(),
    admin.from("student_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
    admin.from("student_digital_files").select("student_id").eq("student_id", userId).maybeSingle(),
    admin.from("class_enrollments").select("student_id").eq("student_id", userId).eq("class_id", classId).eq("status", "active").maybeSingle(),
    admin.from("class_teacher_assignments").select("teacher_id").eq("class_id", classId).eq("status", "active").eq("assignment_kind", "primary").maybeSingle(),
  ]);
  return profile?.status === "active" && Boolean(student) && Boolean(file) && Boolean(enrollment) && Boolean(primaryTeacher);
}
