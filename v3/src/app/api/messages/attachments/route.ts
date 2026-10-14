import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { allowedMessageMimeTypes, hasAllowedUploadSize, isVerifiedUpload } from "@/lib/security/upload-validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const maximumAttachmentSize = 10_485_760;
export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!hasAllowedUploadSize(request, maximumAttachmentSize)) return NextResponse.json({ ok: false }, { status: 413 });
  const form = await request.formData().catch(() => null); const file = form?.get("file"); const messageId = Number(form?.get("messageId")); const conversationId = String(form?.get("conversationId") ?? "");
  if (!(file instanceof File) || !Number.isSafeInteger(messageId) || !/^[0-9a-f-]{36}$/i.test(conversationId) || file.size < 1 || file.size > maximumAttachmentSize || !await isVerifiedUpload(file, allowedMessageMimeTypes)) return NextResponse.json({ ok: false }, { status: 400 });
  const client = await createClient(); const { data: auth } = await client.auth.getUser(); if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });
  const access = await client.rpc("is_conversation_member", { target_conversation_id: conversationId }); if (!access.data) return NextResponse.json({ ok: false }, { status: 403 });
  const bytes = new Uint8Array(await file.arrayBuffer()); const checksum = createHash("sha256").update(bytes).digest("hex"); const extension = extensionFor(file.type); const storagePath = `${conversationId}/${auth.user.id}/${randomUUID()}.${extension}`;
  const admin = createAdminClient(); const upload = await admin.storage.from("message-attachments").upload(storagePath, bytes, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (upload.error) return NextResponse.json({ ok: false }, { status: 503 });
  const registered = await client.rpc("register_message_attachment", { target_message_id: messageId, target_storage_path: storagePath, target_file_name: safeName(file.name), target_mime_type: file.type, target_size_bytes: file.size, target_checksum: checksum });
  if (registered.error) { await admin.storage.from("message-attachments").remove([storagePath]); return NextResponse.json({ ok: false }, { status: 403 }); }
  return NextResponse.json({ ok: true, id: registered.data });
}
function safeName(value: string): string { return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f/\\]/gu, "_").slice(0, 180) || "document"; }
function extensionFor(type: string): string { return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/webm": "webm" } as Record<string, string>)[type] ?? "bin"; }
