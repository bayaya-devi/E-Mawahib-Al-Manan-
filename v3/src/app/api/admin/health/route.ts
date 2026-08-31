import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/observability/logger";

const timeoutMs = 4_000;

export async function GET() {
  const startedAt = Date.now();
  try {
    const client = await createClient();
    const { data: auth } = await withTimeout(client.auth.getUser(), timeoutMs);
    if (!auth.user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

    const diagnostics = await withTimeout(client.rpc("system_diagnostics"), timeoutMs);
    if (diagnostics.error) return NextResponse.json({ ok: false, code: "NOT_AUTHORIZED" }, { status: 403 });

    const storage = await withTimeout(createAdminClient().storage.listBuckets(), timeoutMs).catch(() => null);
    const buckets = storage?.data ?? [];
    const requiredBuckets = ["message-attachments"];
    const storageReady = requiredBuckets.every((name) => buckets.some((bucket) => bucket.name === name && !bucket.public));

    return NextResponse.json({
      ok: true,
      appVersion: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "unknown",
      checks: {
        authentication: "ready",
        database: "ready",
        storage: storageReady ? "ready" : "degraded",
        serviceWorker: "/sw.js",
      },
      diagnostics: diagnostics.data,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logServerError("ADMIN_HEALTH_FAILED", error);
    return NextResponse.json({ ok: false, code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

async function withTimeout<T>(promise: PromiseLike<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("operation_timeout")), milliseconds)),
  ]);
}
