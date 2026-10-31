import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getTeacherHome } from "@/features/teacher/repository";
import { TeacherClasses } from "@/features/teacher/teacher-classes";

export const metadata: Metadata = { title: "أقسام الأستاذ" };
export const dynamic = "force-dynamic";

export default async function TeacherClassesPage() {
  return <AppShell kind="teacher"><TeacherClasses data={await getTeacherHome()} /></AppShell>;
}
