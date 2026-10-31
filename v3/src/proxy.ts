import { type NextRequest, NextResponse } from "next/server";

import { refreshSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE === "1" && !isMaintenanceBypass(request.nextUrl.pathname)) {
    if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ ok: false, code: "MAINTENANCE" }, { status: 503, headers: { "retry-after": "300" } });
    return new NextResponse(maintenanceHtml, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "300", "cache-control": "no-store" } });
  }
  return refreshSession(request);
}

function isMaintenanceBypass(pathname: string) { return pathname === "/health" || pathname === "/ready" || pathname === "/api/version"; }
const maintenanceHtml = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>صيانة مؤقتة</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3efe7;color:#17231f;font-family:Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box}main{max-width:520px}h1{color:#0d5a45}p{line-height:1.8}</style><main><h1>صيانة مؤقتة</h1><p>نحافظ على بياناتك ونعود قريبًا.<br>Maintenance temporaire · Temporary maintenance</p></main></html>`;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
