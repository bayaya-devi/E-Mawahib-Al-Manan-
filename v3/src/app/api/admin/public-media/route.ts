import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireAdministrationMutation } from "@/lib/api/administration-guard";

const mediaExtensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const maximumMediaSize = 100 * 1024 * 1024;

export async function POST(request: Request) {
  const guard = await requireAdministrationMutation(request);
  if (!guard.ok) return guard.response;

  const body = await request.formData().catch(() => null);
  const file = body?.get("file");
  const extension = file instanceof File ? mediaExtensions[file.type] : undefined;
  if (!(file instanceof File) || !extension || file.size < 1 || file.size > maximumMediaSize) {
    return NextResponse.json({ ok: false, message: "ملف الوسائط غير صالح." }, { status: 400 });
  }

  const path = `${guard.access.schoolId}/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
  const saved = await guard.access.admin.storage
    .from("public-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (saved.error) {
    return NextResponse.json({ ok: false, message: "تعذر رفع ملف الوسائط." }, { status: 400 });
  }

  const { data } = guard.access.admin.storage.from("public-media").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}
