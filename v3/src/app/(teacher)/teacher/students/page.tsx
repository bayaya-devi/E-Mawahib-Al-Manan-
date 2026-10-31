import { AppShell } from "@/components/shell";
import { getTeacherHome } from "@/features/teacher/repository";
import { TeacherStudentsWorkspace } from "@/features/teacher/students-workspace";

export const dynamic = "force-dynamic";
export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ class?: string; enroll?: string }> }) { const [data, query] = await Promise.all([getTeacherHome(), searchParams]); return <AppShell kind="teacher"><TeacherStudentsWorkspace students={data.students} classes={data.classes} enrollmentDossiers={data.enrollmentDossiers} initialClass={query.class ?? "all"} initialEnrollmentOpen={query.enroll === "1"} /></AppShell>; }
