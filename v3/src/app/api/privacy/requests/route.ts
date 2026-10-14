import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ kind: z.enum(["rectification", "erasure", "restriction"]), details: z.string().trim().max(2000) });
export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const session = await createClient(); const { data: auth } = await session.auth.getUser(); if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin.from("data_subject_requests").insert({ user_id: auth.user.id, kind: parsed.data.kind, details: parsed.data.details || null, status: "submitted" }).select("id").single();
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  await admin.from("audit_logs").insert({ actor_id: auth.user.id, action: "DATA_RIGHT_REQUESTED", entity_type: "data_subject_request", entity_id: data.id, metadata: { kind: parsed.data.kind } });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
