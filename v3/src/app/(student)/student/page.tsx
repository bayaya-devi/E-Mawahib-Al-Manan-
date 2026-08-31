import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getStudentDashboard } from "@/features/learning/repository";
import { StudentDashboard } from "@/features/learning/student-dashboard";

export const metadata: Metadata = { title: "مساحة الطالب" };
export const dynamic = "force-dynamic";
export default async function StudentPage() {
  const data = await getStudentDashboard();
  return <AppShell kind="student"><StudentDashboard data={data} /></AppShell>;
}
