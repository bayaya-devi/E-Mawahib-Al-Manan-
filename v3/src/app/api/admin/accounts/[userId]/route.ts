import { NextResponse } from "next/server";

import { permanentlyDeleteAccount } from "@/features/identity/application/delete-account";
import { requireAdministrationMutation } from "@/lib/api/administration-guard";

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireAdministrationMutation(request);
  if (!guard.ok) return guard.response;
  const { userId } = await params;
  const result = await permanentlyDeleteAccount(userId);
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : 400 });
}
