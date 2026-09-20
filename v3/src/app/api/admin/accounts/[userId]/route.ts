import { NextResponse } from "next/server";

import { permanentlyDeleteAccount } from "@/features/identity/application/delete-account";
import { hasTrustedOrigin } from "@/lib/http/same-origin";

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ ok: false, message: "تعذر التحقق من الطلب." }, { status: 403 });
  }
  const { userId } = await params;
  const result = await permanentlyDeleteAccount(userId);
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : 400 });
}
