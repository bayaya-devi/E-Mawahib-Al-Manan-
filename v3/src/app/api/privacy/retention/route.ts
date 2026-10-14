import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET; const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin.rpc("run_privacy_retention");
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true, purged: data });
}

export const GET = POST;
