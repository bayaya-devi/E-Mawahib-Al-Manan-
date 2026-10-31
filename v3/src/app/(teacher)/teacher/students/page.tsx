import { AppShell } from "@/components/shell";
import { getTeacherHome } from "@/features/teacher/repository";
import { TeacherStudentsWorkspace } from "@/features/teacher/students-workspace";

export const dynamic = "force-dynamic";
export default async function StudentsPage() { const data = await getTeacherHome(); return <AppShell kind="teacher"><TeacherStudentsWorkspace students={data.students} /></AppShell>; }
