import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
type Context = { params: Promise<{ attachmentId: string }> };
export async function GET(_request: Request, context: Context) {
  const { attachmentId } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) return NextResponse.json({ ok: false }, { status: 400 });
  const client = await createClient(); const { data: auth } = await client.auth.getUser(); if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });
  const attachment = await client.from("message_attachments").select("storage_path").eq("id", attachmentId).maybeSingle(); if (!attachment.data) return NextResponse.json({ ok: false }, { status: 404 });
  const signed = await createAdminClient().storage.from("message-attachments").createSignedUrl(attachment.data.storage_path, 60); if (!signed.data) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.redirect(signed.data.signedUrl, { status: 302 });
}
