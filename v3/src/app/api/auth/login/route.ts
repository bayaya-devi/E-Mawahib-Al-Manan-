import { NextResponse } from "next/server";

import { signInWithAlias } from "@/features/identity/application/sign-in";
import { getLoginRateLimit, recordLoginRateLimit } from "@/features/identity/application/login-rate-limit";
import { AUTH_MESSAGES } from "@/features/identity/domain/auth-messages";
import { hasTrustedOrigin } from "@/lib/http/same-origin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: AUTH_MESSAGES.invalidCredentials },
      { status: 401 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: AUTH_MESSAGES.invalidCredentials },
      { status: 400 },
    );
  }

  const rateLimit = await getLoginRateLimit(request, input);
  if (!rateLimit.allowed) return NextResponse.json({ ok: false, message: AUTH_MESSAGES.invalidCredentials }, { status: 429 });
  const result = await signInWithAlias(input);
  await recordLoginRateLimit(rateLimit.keys, result.ok);
  if (!result.ok) {
    const status = result.code === "INVALID_CREDENTIALS" ? 401 : 403;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
