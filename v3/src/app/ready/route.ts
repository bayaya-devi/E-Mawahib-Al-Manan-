import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError, requestId } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = requestId(request);
  const startedAt = Date.now();
  try {
    const result = await Promise.race([
      createAdminClient().from("schools").select("id", { head: true, count: "exact" }).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("database_timeout")), 4_000)),
    ]);
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, checks: { database: "ready" }, durationMs: Date.now() - startedAt }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch (error) {
    logServerError("READINESS_FAILED", error, { requestId: id, durationMs: Date.now() - startedAt });
    return NextResponse.json({ ok: false, checks: { database: "unavailable" } }, { status: 503, headers: { "cache-control": "no-store", "retry-after": "30", "x-request-id": id } });
  }
}
