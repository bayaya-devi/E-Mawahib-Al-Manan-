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
      await createAdminClient().auth.admin.deleteUser(result.userId);
      return NextResponse.json({ ok: false, message: saved.message }, { status: 500 });
    }
  }

  return NextResponse.json(result, { status: 201 });
}
