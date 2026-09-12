import { NextResponse } from "next/server";
import { z } from "zod";

import { getSiteManager } from "@/features/public-site/admin-access";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createClient } from "@/lib/supabase/server";

const slotSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  starts_at: z.string().regex(/^\d{2}:\d{2}$/),
  ends_at: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().max(120).nullable(),
});
const classPayloadSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  level: z.string().max(120),
  capacity: z.string().nullable(),
  teacher_id: z.string().uuid().nullable(),
  student_ids: z.array(z.string().uuid()).max(500),
  status: z.enum(["active", "archived"]),
  schedule: z.array(slotSchema).max(14),
});
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), payload: classPayloadSchema }),
  z.object({ action: z.literal("send_schedule"), classId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ ok: false, message: "تعذر التحقق من الطلب." }, { status: 403 });
  }
  if (!(await getSiteManager())) {
    return NextResponse.json({ ok: false, message: "غير مسموح." }, { status: 403 });
  }
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ ok: false, message: "تحقق من بيانات القسم." }, { status: 400 });
  }
  const client = await createClient();
  if (input.data.action === "send_schedule") {
    const { data, error } = await client.rpc("admin_send_class_schedule", {
      target_class_id: input.data.classId,
    });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data });
  }
  const { data, error } = await client.rpc("admin_save_class", {
    payload: input.data.payload,
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data });
}
