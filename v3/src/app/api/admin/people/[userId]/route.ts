import { NextResponse } from "next/server";
import { z } from "zod";

import { savePersonFromAdmin } from "@/features/admin/application/save-person";
import { getSiteManager } from "@/features/public-site/admin-access";
import { hasTrustedOrigin } from "@/lib/http/same-origin";

const payloadSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  gender: z.string().max(24).optional(),
  phone: z.string().max(60).optional(),
  email: z.string().max(254).optional(),
  monthlyAmount: z.string().max(40).optional(),
  guardianName: z.string().max(160).optional(),
  guardianFirstName: z.string().max(80).optional(),
  guardianLastName: z.string().max(80).optional(),
  guardianPhone: z.string().max(60).optional(),
  guardianSecondaryPhone: z.string().max(60).optional(),
  canLeaveAlone: z.boolean().optional(),
  dateOfBirth: z.string().max(20).optional(),
  identityDocumentReceived: z.boolean().optional(),
  birthCertificateReceived: z.boolean().optional(),
  guardianIdentityReceived: z.boolean().optional(),
  accessibilityNotes: z.string().max(2000).optional(),
  classId: z.string().uuid().optional(),
  classIds: z.array(z.string().uuid()).max(30).optional(),
  teacherIds: z.array(z.string().uuid()).max(30).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false, message: "تعذر التحقق من الطلب." }, { status: 403 });
  const access = await getSiteManager();
  const { userId } = await params;
  if (!access || !z.string().uuid().safeParse(userId).success) return NextResponse.json({ ok: false, message: "غير مسموح." }, { status: 403 });
  const input = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ ok: false, message: "تحقق من البيانات المدخلة." }, { status: 400 });

  const { data: roles } = await access.admin.from("user_roles").select("role").eq("user_id", userId);
  const role = roles?.some((item) => item.role === "student") ? "student" : roles?.some((item) => item.role === "teacher") ? "teacher" : null;
  if (!role) return NextResponse.json({ ok: false, message: "نوع الحساب غير قابل للتعديل هنا." }, { status: 400 });
  const result = await savePersonFromAdmin(userId, role, input.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
