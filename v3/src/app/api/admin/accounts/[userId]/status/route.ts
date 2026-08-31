import { NextResponse } from "next/server";

import { changeAccountStatus } from "@/features/identity/application/change-account-status";
import { AUTH_MESSAGES } from "@/features/identity/domain/auth-messages";
import { hasTrustedOrigin } from "@/lib/http/same-origin";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: AUTH_MESSAGES.forbidden },
      { status: 403 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: AUTH_MESSAGES.statusUpdateFailed },
      { status: 400 },
    );
  }

  const { userId } = await context.params;
  const result = await changeAccountStatus(userId, input);
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
