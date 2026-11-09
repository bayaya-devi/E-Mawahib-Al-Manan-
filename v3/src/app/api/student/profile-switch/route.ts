import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { activeStudentCookie } from "@/features/learning/student-context";
import { hasTrustedOrigin } from "@/lib/http/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({ studentId: z.string().uuid() });
const localeSchema = z.object({ locale: z.enum(["ar", "fr"]), studentId: z.string().uuid() });

export async function GET() {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const links = await client.from("student_profile_switch_authorizations").select("target_student_id").eq("source_student_id", auth.user.id).eq("status", "active");
  if (links.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const ids = [auth.user.id, ...(links.data ?? []).map((row) => row.target_student_id)];
  const admin = createAdminClient();
  const [profiles, students] = await Promise.all([
    admin.from("profiles").select("id,display_name,status,locale").in("id", ids),
    admin.from("student_profiles").select("user_id,age_category").in("user_id", ids),
  ]);
  if (profiles.error || students.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const categories = new Map((students.data ?? []).map((student) => [student.user_id, student.age_category]));
  const requested = inputSchema.shape.studentId.safeParse((await cookies()).get(activeStudentCookie)?.value);
  const active = requested.success && ids.includes(requested.data) ? requested.data : auth.user.id;
  return NextResponse.json({ active, profiles: (profiles.data ?? []).filter((profile) => profile.status === "active").map((profile) => ({ id: profile.id, name: profile.display_name, ageCategory: categories.get(profile.id) ?? null, locale: profile.locale === "fr" ? "fr" : "ar" })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = localeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const updated = await client.rpc("set_student_locale", { target_student_id: parsed.data.studentId, target_locale: parsed.data.locale });
  if (updated.error) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const allowed = await client.rpc("can_switch_student_profile", { target_student_id: parsed.data.studentId });
  if (allowed.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (allowed.data !== true) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(activeStudentCookie, parsed.data.studentId, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 43_200 });
  return response;
}
