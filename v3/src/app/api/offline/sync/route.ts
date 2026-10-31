import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createClient } from "@/lib/supabase/server";

const envelope = z.object({
  id: z.string().uuid(),
  kind: z.enum(["message.send", "request.create", "quran.practice", "assignment.update"]),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = envelope.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id, kind, payload } = parsed.data;
  const claim = await client.rpc("claim_offline_mutation", { target_id: id, target_kind: kind });
  if (claim.error) return NextResponse.json({ ok: false, retryable: false }, { status: 409 });
  if (claim.data === "completed") return NextResponse.json({ ok: true, id, duplicate: true });
  if (claim.data === "busy") return NextResponse.json({ ok: false, retryable: true }, { status: 409 });
  let error: { message: string } | null = null;
  if (kind === "message.send") {
    const input = z.object({ conversationId: z.string().uuid(), body: z.string().min(1).max(4000), clientId: z.string().uuid() }).safeParse(payload);
    if (!input.success) return invalidMutation(client, id);
    ({ error } = await client.rpc("send_conversation_message", { target_conversation_id: input.data.conversationId, target_body: input.data.body, target_client_id: input.data.clientId }));
  } else if (kind === "request.create") {
    const input = z.object({ kind: z.enum(["leave","absence","equipment","incident","salary_problem","administrative_question","complaint","class_change","technical_problem","other"]), priority: z.enum(["low","normal","high","urgent"]), title: z.string().min(3).max(120), details: z.string().max(4000), clientId: z.string().uuid() }).safeParse(payload);
    if (!input.success) return invalidMutation(client, id);
    ({ error } = await client.rpc("create_service_request", { target_kind: input.data.kind, target_title: input.data.title, target_details: input.data.details || null, target_priority: input.data.priority, target_client_id: input.data.clientId }));
  } else if (kind === "quran.practice") {
    const input = z.object({ surahNumber: z.number().int().min(1).max(114), verseNumber: z.number().int().positive(), success: z.boolean() }).safeParse(payload);
    if (!input.success) return invalidMutation(client, id);
    ({ error } = await client.rpc("record_quran_practice", { target_surah_number: input.data.surahNumber, target_verse_number: input.data.verseNumber, target_success: input.data.success }));
  } else {
    const input = z.object({ assignmentId: z.string().uuid(), status: z.enum(["in_progress", "submitted"]), response: z.string().max(4000).nullable().optional() }).safeParse(payload);
    if (!input.success) return invalidMutation(client, id);
    ({ error } = await client.rpc("update_own_assignment", { target_assignment_id: input.data.assignmentId, target_status: input.data.status, target_response: input.data.response ?? null }));
  }
  if (error) {
    await client.rpc("finish_offline_mutation", { target_id: id, target_success: false, target_error_code: "SYNC_FAILED" });
    return NextResponse.json({ ok: false, retryable: /timeout|network/i.test(error.message) }, { status: 409 });
  }
  await client.rpc("finish_offline_mutation", { target_id: id, target_success: true, target_error_code: null });
  return NextResponse.json({ ok: true, id });
}

async function invalidMutation(client: Awaited<ReturnType<typeof createClient>>, id: string) {
  await client.rpc("finish_offline_mutation", { target_id: id, target_success: false, target_error_code: "VALIDATION_ERROR" });
  return NextResponse.json({ ok: false }, { status: 400 });
}
