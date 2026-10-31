import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: Context) {
  const { documentId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return NextResponse.json({ ok: false }, { status: 400 });
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });
  const document = await client.from("teacher_documents").select("storage_path,visible_from,expires_at").eq("id", documentId).lte("visible_from", new Date().toISOString()).maybeSingle();
  if (!document.data || (document.data.expires_at && Date.parse(document.data.expires_at) <= Date.now())) return NextResponse.json({ ok: false }, { status: 404 });
  const signed = await createAdminClient().storage.from("teacher-documents").createSignedUrl(document.data.storage_path, 60);
  if (!signed.data) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.redirect(signed.data.signedUrl, { status: 302 });
}
