import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({ audience: z.boolean(), marketing: z.boolean(), locale: z.enum(["ar", "fr", "en", "amz"]), policyVersion: z.string().min(1).max(40) });
const visitorCookie = "mawahib_privacy_id";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const current = request.headers.get("cookie")?.match(/(?:^|;\s*)mawahib_privacy_id=([^;]+)/u)?.[1];
  const visitor = current && /^[0-9a-f-]{36}$/iu.test(current) ? current : randomUUID();
  const anonymousHash = createHash("sha256").update(visitor).digest("hex");
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { error } = await admin.from("privacy_consents").insert({ anonymous_hash: anonymousHash, policy_version: parsed.data.policyVersion, necessary: true, audience_measurement: parsed.data.audience, marketing: parsed.data.marketing, locale: parsed.data.locale, user_agent_family: request.headers.get("user-agent")?.slice(0, 120) ?? null });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  const response = NextResponse.json({ ok: true });
  if (!current) response.cookies.set(visitorCookie, visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
  return response;
}
