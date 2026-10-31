import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getTeacherHome } from "@/features/teacher/repository";
import { TeacherHome } from "@/features/teacher/teacher-home";

export const metadata: Metadata = { title: "مساحة المعلّم" };
export const dynamic = "force-dynamic";
export default async function TeacherPage() { const data = await getTeacherHome(); return <AppShell kind="teacher"><TeacherHome data={data} /></AppShell>; }
