import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteManager } from "@/features/public-site/admin-access";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import {
  normalizeLoginAlias,
  isValidLoginAlias,
} from "@/features/identity/domain/login-alias";
import { createClient } from "@/lib/supabase/server";
const schema = z
  .object({
    login: z.string().optional(),
    temporaryPassword: z.string().min(10).max(128).optional(),
  })
  .refine((value) => value.login || value.temporaryPassword);
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!hasTrustedOrigin(request))
    return NextResponse.json({ ok: false }, { status: 403 });
  const access = await getSiteManager();
  if (!access) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const { userId } = await params;
  if (!parsed.success || !z.string().uuid().safeParse(userId).success)
    return NextResponse.json({ ok: false }, { status: 400 });
  const member = await access.admin
    .from("school_memberships")
    .select("user_id")
    .eq("school_id", access.schoolId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member.data) return NextResponse.json({ ok: false }, { status: 403 });
  const alias = parsed.data.login ? normalizeLoginAlias(parsed.data.login) : "";
  if (alias && !isValidLoginAlias(alias))
    return NextResponse.json({ ok: false }, { status: 400 });
  const tracked = await (
    await createClient()
  ).rpc("admin_update_login_alias", {
    target_user_id: userId,
    target_login_alias: alias,
    target_password_reset: Boolean(parsed.data.temporaryPassword),
  });
  if (tracked.error) return NextResponse.json({ ok: false }, { status: 400 });
  if (parsed.data.temporaryPassword) {
    const updated = await access.admin.auth.admin.updateUserById(userId, {
      password: parsed.data.temporaryPassword,
      user_metadata: { requires_password_reset: true },
    });
    if (updated.error) return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
