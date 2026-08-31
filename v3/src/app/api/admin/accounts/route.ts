import { NextResponse } from "next/server";

import { provisionAccount } from "@/features/identity/application/provision-account";
import { AUTH_MESSAGES } from "@/features/identity/domain/auth-messages";
import { hasTrustedOrigin } from "@/lib/http/same-origin";

export async function POST(request: Request) {
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
      { ok: false, message: AUTH_MESSAGES.accountCreateFailed },
      { status: 400 },
    );
  }

  const result = await provisionAccount(input);
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
