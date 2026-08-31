import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
      buildSha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown",
      buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? "unknown",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
