import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { ProfessionalWorkspace } from "@/features/teacher/professional-workspace";
import { getTeacherProfessional } from "@/features/teacher/repository";
export const metadata: Metadata = { title: "تقارير الحصص" };
export const dynamic = "force-dynamic";
export default async function ReportsPage() { return <AppShell kind="teacher"><ProfessionalWorkspace data={await getTeacherProfessional()} initialTab="reports" /></AppShell>; }
