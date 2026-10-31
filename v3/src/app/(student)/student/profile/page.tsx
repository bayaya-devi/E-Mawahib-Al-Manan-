import { AppShell } from "@/components/shell";
import { getStudentAccountProfile } from "@/features/learning/repository";
import { StudentProfile } from "@/features/learning/student-extensions";
export const dynamic = "force-dynamic";
export default async function StudentProfilePage() { const data = await getStudentAccountProfile(); return <AppShell kind="student"><StudentProfile {...data} /></AppShell>; }
