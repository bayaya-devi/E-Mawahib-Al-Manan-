import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await createClient(); const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });
  const id = auth.user.id; const admin = createAdminClient();
  const [profile, roles, memberships, student, parent, teacher, enrollments, family, progress, recitations, requests] = await Promise.all([
    admin.from("profiles").select("id,display_name,locale,status,first_name,last_name,created_at,updated_at").eq("id", id).maybeSingle(),
    admin.from("user_roles").select("role,created_at").eq("user_id", id),
    admin.from("school_memberships").select("school_id,status,joined_at,ended_at").eq("user_id", id),
    admin.from("student_profiles").select("student_number,date_of_birth,gender,created_at,updated_at").eq("user_id", id).maybeSingle(),
    admin.from("parent_profiles").select("created_at,updated_at").eq("user_id", id).maybeSingle(),
    admin.from("teacher_profiles").select("employee_number,created_at,updated_at").eq("user_id", id).maybeSingle(),
    admin.from("class_enrollments").select("class_id,status,enrolled_at,ended_at").eq("student_id", id),
    admin.from("family_relationships").select("parent_id,student_id,relationship,status,is_primary,created_at").or(`parent_id.eq.${id},student_id.eq.${id}`),
    admin.from("student_surah_progress").select("surah_number,status,completion_percent,highest_completed_step,stars,started_at,mastered_at,last_activity_at,updated_at").eq("student_id", id),
    admin.from("teacher_recitations").select("student_id,recorded_by,run_id,surah_number,verse_from,verse_to,appreciation,comment,recorded_at").or(`student_id.eq.${id},recorded_by.eq.${id}`),
    admin.from("service_requests").select("id,kind,status,priority,title,details,created_at,updated_at").eq("requester_id", id),
  ]);
  const payload = { exportedAt: new Date().toISOString(), subjectId: id, profile: profile.data, roles: roles.data, memberships: memberships.data, roleProfiles: { student: student.data, parent: parent.data, teacher: teacher.data }, classEnrollments: enrollments.data, familyRelationships: family.data, quranProgress: progress.data, pedagogicalFollowUp: recitations.data, serviceRequests: requests.data };
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="e-mawahib-data-${id}.json"`, "cache-control": "no-store" } });
}
