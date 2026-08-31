import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverNotification } from "@/features/notifications/providers";
import { getPrivilegedServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const environment = getPrivilegedServerEnvironment();
  if (!environment.NOTIFICATION_WORKER_SECRET) return NextResponse.json({ error: "worker_not_configured" }, { status: 503 });
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";
  if (!sameSecret(supplied, environment.NOTIFICATION_WORKER_SECRET)) return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  const client = createAdminClient(); await client.rpc("process_due_notification_events", { target_limit: 100 });
  const claimed = await client.rpc("claim_notification_deliveries", { target_limit: 50 });
  if (claimed.error) return NextResponse.json({ error: "queue_unavailable" }, { status: 503 });
  const configs = { email: { url: environment.NOTIFICATION_EMAIL_WEBHOOK_URL, token: environment.NOTIFICATION_EMAIL_WEBHOOK_TOKEN }, sms: { url: environment.NOTIFICATION_SMS_WEBHOOK_URL, token: environment.NOTIFICATION_SMS_WEBHOOK_TOKEN }, push: { url: environment.NOTIFICATION_PUSH_WEBHOOK_URL, token: environment.NOTIFICATION_PUSH_WEBHOOK_TOKEN } };
  let sent = 0; let failed = 0;
  for (const job of claimed.data ?? []) { const result = await deliverNotification(job, configs); await client.rpc("finish_notification_delivery", { target_delivery_id: job.delivery_id, target_success: result.success, target_provider: result.provider, target_provider_message_id: result.messageId ?? null, target_error_code: result.errorCode ?? null, target_error_detail: result.errorDetail ?? null }); if (result.success) sent++; else failed++; }
  return NextResponse.json({ claimed: claimed.data?.length ?? 0, sent, failed });
}
function sameSecret(first: string, second: string) { const a = Buffer.from(first); const b = Buffer.from(second); return a.length === b.length && timingSafeEqual(a, b); }
