import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ ok: true, service: "e-mawahib-web", version: process.env.npm_package_version ?? "0.1.0", checkedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
