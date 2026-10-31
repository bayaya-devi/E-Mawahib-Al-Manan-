import "server-only";

import { NextResponse } from "next/server";

import { getAdministrationAccess } from "@/lib/auth/administration-access";
import { hasTrustedOrigin } from "@/lib/http/same-origin";

type GuardFailure = { ok: false; response: NextResponse };
type GuardSuccess = {
  ok: true;
  access: NonNullable<Awaited<ReturnType<typeof getAdministrationAccess>>>;
};

/** Common CSRF, session, status and role gate for privileged mutations. */
export async function requireAdministrationMutation(
  request: Request,
): Promise<GuardFailure | GuardSuccess> {
  if (!hasTrustedOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "تعذر التحقق من الطلب." },
        { status: 403 },
      ),
    };
  }

  const access = await getAdministrationAccess();
  if (!access) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "غير مسموح." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, access };
}
