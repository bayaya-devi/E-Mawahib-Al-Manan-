import "server-only";

import { getServerEnvironment } from "@/lib/env/server";

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(getServerEnvironment().APP_BASE_URL).origin;
  } catch {
    return false;
  }
}
