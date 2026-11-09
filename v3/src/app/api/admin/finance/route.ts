import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdministrationMutation } from "@/lib/api/administration-guard";
import { logServerWarning, requestId } from "@/lib/observability/logger";
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
  z.object({
    kind: z.literal("manual"),
    schoolId: z.string().uuid(),
    direction: z.enum(["income", "expense"]),
    category: z.string().trim().min(2).max(80),
    amount: z.number().finite().positive(),
    occurredOn: z.string().date(),
    description: z.string().trim().max(1000),
    classId: z.string().uuid().nullable(),
    paymentMethod: z.enum(["cash", "bank", "card", "other"]),
    allocationKind: z.enum(["direct", "common", "unassigned"]),
    idempotencyKey: z.string().uuid(),
  }),
  z.object({ kind: z.literal("reverse"), transactionId: z.string().uuid(), reason: z.string().trim().min(3).max(1000), idempotencyKey: z.string().uuid() }),
  z.object({
    kind: z.literal("recurring_save"), schoolId: z.string().uuid(), id: z.string().uuid().nullable(), title: z.string().trim().min(2).max(120),
    category: z.string().trim().min(2).max(80), amount: z.number().positive(), dueDay: z.number().int().min(1).max(28), classId: z.string().uuid().nullable(),
    allocationKind: z.enum(["direct", "common"]), startsOn: z.string().date(), endsOn: z.string().date().nullable(), active: z.boolean(),
  }),
  z.object({ kind: z.literal("recurring_pay"), chargeId: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/), paidOn: z.string().date(), idempotencyKey: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const diagnosticId = requestId(request);
  const guard = await requireAdministrationMutation(request);
  if (!guard.ok) return guard.response;
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ ok: false, message: "تحقق من بيانات الأداء." }, { status: 400 });
  const client = await createClient();
  const payload = input.data;
  let result;
  if (payload.kind === "student_payment") result = await client.rpc("admin_record_student_payment", {
      target_student_id: payload.studentId,
      target_period_month: `${payload.month}-01`,
      target_amount: payload.amount,
      target_paid_on: payload.paidOn,
      target_note: payload.note,
    });
  else if (payload.kind === "teacher_salary") result = await client.rpc("admin_record_teacher_salary", {
      target_teacher_id: payload.teacherId,
      target_period_month: `${payload.month}-01`,
      target_amount: payload.amount,
      target_paid_on: payload.paidOn,
      target_note: payload.note,
    });
  else if (payload.kind === "manual") result = await client.rpc("admin_record_manual_finance", {
    target_school_id: payload.schoolId, target_direction: payload.direction, target_category: payload.category, target_amount: payload.amount,
    target_occurred_on: payload.occurredOn, target_description: payload.description, target_class_id: payload.classId,
    target_payment_method: payload.paymentMethod, target_allocation_kind: payload.allocationKind, target_idempotency_key: payload.idempotencyKey,
  });
  else if (payload.kind === "reverse") result = await client.rpc("admin_reverse_manual_finance", {
    target_transaction_id: payload.transactionId, target_reason: payload.reason, target_idempotency_key: payload.idempotencyKey,
  });
  else if (payload.kind === "recurring_save") result = await client.rpc("admin_save_recurring_charge", {
    target_school_id: payload.schoolId, target_id: payload.id, target_title: payload.title, target_category: payload.category,
    target_amount: payload.amount, target_due_day: payload.dueDay, target_class_id: payload.classId, target_allocation_kind: payload.allocationKind,
    target_starts_on: payload.startsOn, target_ends_on: payload.endsOn, target_active: payload.active,
  });
  else result = await client.rpc("admin_pay_recurring_charge", {
    target_charge_id: payload.chargeId, target_period_month: `${payload.month}-01`, target_paid_on: payload.paidOn, target_idempotency_key: payload.idempotencyKey,
  });
  const { data, error } = result;
  if (error) {
    logServerWarning("admin_finance_mutation_failed", { diagnosticId, kind: payload.kind, databaseCode: error.code, databaseMessage: error.message });
    return NextResponse.json({ ok: false, message: financeErrorMessage(error.message), diagnosticId }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: data });
}

function financeErrorMessage(message: string): string {
  if (message.includes("direct_class_required")) return "اختر القسم المرتبط بهذه العملية.";
  if (message.includes("transaction_not_reversible")) return "لا يمكن إلغاء هذه العملية أو سبق إلغاؤها.";
  if (message.includes("finance_scope_denied") || message.includes("class_scope_denied")) return "ليست لديك صلاحية لتنفيذ هذه العملية.";
  if (message.includes("invalid_") || message.includes("check constraint")) return "تحقق من بيانات العملية المالية.";
  return "تعذر حفظ العملية. أعد المحاولة واحتفظ برقم التشخيص.";
}
