import { createHmac, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { deliverOtp } from "@/features/notifications/providers";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { getPrivilegedServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({ linkId: z.string().uuid() });

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false, message: "تعذر تنفيذ الطلب." }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تعذر تنفيذ الطلب." }, { status: 400 });
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, message: "تعذر تنفيذ الطلب." }, { status: 401 });
  const environment = getPrivilegedServerEnvironment();
  if (!environment.OTP_HMAC_SECRET) return NextResponse.json({ ok: false, message: "خدمة التحقق غير مهيأة بعد." }, { status: 503 });

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const digest = otpDigest(code, environment.OTP_HMAC_SECRET);
  const admin = createAdminClient();
  const challenge = await admin.rpc("create_contact_verification_challenge", { target_user_id: data.user.id, target_link_id: parsed.data.linkId, target_code_digest: digest });
  const row = challenge.data?.[0];
  if (challenge.error || !row) return NextResponse.json({ ok: false, message: challenge.error?.message.includes("rate") || challenge.error?.message.includes("hourly") ? "انتظر قليلا قبل طلب رمز جديد." : "تعذر تنفيذ الطلب." }, { status: 429 });

  const result = await deliverOtp(row.contact_kind, row.destination, code, {
    appBaseUrl: environment.APP_BASE_URL, resendApiKey: environment.RESEND_API_KEY, emailFrom: environment.EMAIL_FROM,
    twilioAccountSid: environment.TWILIO_ACCOUNT_SID, twilioAuthToken: environment.TWILIO_AUTH_TOKEN,
    twilioFromNumber: environment.TWILIO_FROM_NUMBER, twilioMessagingServiceSid: environment.TWILIO_MESSAGING_SERVICE_SID,
    vapidPublicKey: environment.NEXT_PUBLIC_VAPID_PUBLIC_KEY, vapidPrivateKey: environment.VAPID_PRIVATE_KEY, vapidSubject: environment.VAPID_SUBJECT,
    webhook: { email: { url: environment.NOTIFICATION_EMAIL_WEBHOOK_URL, token: environment.NOTIFICATION_EMAIL_WEBHOOK_TOKEN }, sms: { url: environment.NOTIFICATION_SMS_WEBHOOK_URL, token: environment.NOTIFICATION_SMS_WEBHOOK_TOKEN } },
  });
  if (!result.success) {
    await admin.rpc("cancel_contact_verification_challenge", { target_challenge_id: row.challenge_id, target_user_id: data.user.id, target_reason: result.errorCode ?? "provider_failed" });
    return NextResponse.json({ ok: false, message: "تعذر إرسال الرمز عبر وسيلة الاتصال." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, message: "تم إرسال رمز التحقق." });
}

function otpDigest(code: string, secret: string) { return createHmac("sha256", secret).update(code).digest("hex"); }
