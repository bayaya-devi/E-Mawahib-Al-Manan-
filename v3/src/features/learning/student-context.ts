import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const activeStudentCookie = "emawahib_active_student";

export async function getActiveStudentContext(): Promise<{ accountId: string; studentId: string } | null> {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const requested = (await cookies()).get(activeStudentCookie)?.value;
  if (!requested || requested === auth.user.id) return { accountId: auth.user.id, studentId: auth.user.id };
  const permission = await client.rpc("can_switch_student_profile", { target_student_id: requested });
  return { accountId: auth.user.id, studentId: permission.data === true ? requested : auth.user.id };
}

export async function getActiveStudentLocale(): Promise<"ar" | "fr"> {
  const context = await getActiveStudentContext();
  if (!context) return "ar";
  const client = await createClient();
  const profile = await client.from("profiles").select("locale").eq("id", context.studentId).maybeSingle();
  return profile.data?.locale === "fr" ? "fr" : "ar";
}
