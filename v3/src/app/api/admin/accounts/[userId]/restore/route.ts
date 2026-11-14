import { NextResponse } from "next/server";

import { restoreAccountFromTrash } from "@/features/identity/application/restore-account";
import { requireAdministrationMutation } from "@/lib/api/administration-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const guard = await requireAdministrationMutation(request);
  if (!guard.ok) return guard.response;
  const { userId } = await params;
  const result = await restoreAccountFromTrash(userId);
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : 400,
  });
}
