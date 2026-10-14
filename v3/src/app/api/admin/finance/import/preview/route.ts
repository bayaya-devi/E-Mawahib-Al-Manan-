import { NextResponse } from "next/server";

import { previewPaymentCsv } from "@/features/admin/finance/payment-import";
import { requireAdministrationMutation } from "@/lib/api/administration-guard";

const MAX_CSV_BYTES = 1_000_000;

export async function POST(request: Request) {
  const guard = await requireAdministrationMutation(request);
  if (!guard.ok) return guard.response;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_CSV_BYTES) {
    return NextResponse.json({ ok: false, message: "الملف كبير جدا." }, { status: 413 });
  }
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > MAX_CSV_BYTES) {
    return NextResponse.json({ ok: false, message: "الملف كبير جدا." }, { status: 413 });
  }
  try {
    return NextResponse.json({ ok: true, preview: previewPaymentCsv(source) });
  } catch {
    return NextResponse.json({ ok: false, message: "ملف CSV غير صالح." }, { status: 400 });
  }
}
