import { NextResponse } from "next/server";
import { z } from "zod";

import { getSiteManager } from "@/features/public-site/admin-access";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("student_payment"),
    studentId: z.string().uuid(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    amount: z.number().finite().min(0),
    paidOn: z.string().date(),
    note: z.string().trim().max(1000).nullable(),
  }),
  z.object({
    kind: z.literal("teacher_salary"),
    teacherId: z.string().uuid(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    amount: z.number().finite().min(0),
    paidOn: z.string().date(),
    note: z.string().trim().max(1000).nullable(),
  }),
]);

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false, message: "تعذر التحقق من الطلب." }, { status: 403 });
  if (!(await getSiteManager())) return NextResponse.json({ ok: false, message: "غير مسموح." }, { status: 403 });
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ ok: false, message: "تحقق من بيانات الأداء." }, { status: 400 });
  const client = await createClient();
  const payload = input.data;
  const { data, error } = payload.kind === "student_payment"
    ? await client.rpc("admin_record_student_payment", {
      target_student_id: payload.studentId,
      target_period_month: `${payload.month}-01`,
      target_amount: payload.amount,
      target_paid_on: payload.paidOn,
      target_note: payload.note,
    })
    : await client.rpc("admin_record_teacher_salary", {
      target_teacher_id: payload.teacherId,
      target_period_month: `${payload.month}-01`,
      target_amount: payload.amount,
      target_paid_on: payload.paidOn,
      target_note: payload.note,
    });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data });
}
