import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicInteractionIdentity } from "@/features/public-site/interaction-identity";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ replayId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = z.string().uuid().safeParse((await params).replayId);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const identity = await getPublicInteractionIdentity(parsed.data);
  const { data, error } = await createAdminClient().rpc("toggle_public_replay_like", { target_replay_id: parsed.data, target_visitor_hash: identity.visitorHash, target_network_hash: identity.networkHash });
  if (error) return NextResponse.json({ ok: false }, { status: error.message.includes("like_rate_limited") ? 429 : 400 });
  const result = data?.[0];
  const response = NextResponse.json({ ok: true, liked: result?.liked ?? false, likesCount: result?.likes_count ?? 0 });
  if (identity.isNew) response.cookies.set("mawahib_public_visitor", identity.visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31536000, path: "/" });
  return response;
}
