import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrivilegedServerEnvironment } from "@/lib/env/server";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({ linkId: z.string().uuid(), code: z.string().regex(/^\d{6}$/u) });

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false, message: "رمز غير صحيح أو منتهي." }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "رمز غير صحيح أو منتهي." }, { status: 400 });
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, message: "رمز غير صحيح أو منتهي." }, { status: 401 });
  const secret = getPrivilegedServerEnvironment().OTP_HMAC_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "خدمة التحقق غير مهيأة بعد." }, { status: 503 });
  const digest = createHmac("sha256", secret).update(parsed.data.code).digest("hex");
  const result = await createAdminClient().rpc("verify_contact_verification_challenge", { target_user_id: data.user.id, target_link_id: parsed.data.linkId, target_code_digest: digest });
  if (result.error || !result.data) return NextResponse.json({ ok: false, message: "رمز غير صحيح أو منتهي." }, { status: 400 });
  return NextResponse.json({ ok: true, message: "تم توثيق وسيلة الاتصال." });
}
