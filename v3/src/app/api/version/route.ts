import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
      buildSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "manual-deploy",
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? "unknown",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
