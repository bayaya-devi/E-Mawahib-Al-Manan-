import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicSiteData } from "@/features/public-site/repository";

export async function GET(request: Request) {
  const locale = z.enum(["ar", "fr", "en", "amz"]).safeParse(new URL(request.url).searchParams.get("locale"));
  if (!locale.success) return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await getPublicSiteData(locale.data)) });
}
