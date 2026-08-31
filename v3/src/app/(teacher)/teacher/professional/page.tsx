import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { ProfessionalWorkspace } from "@/features/teacher/professional-workspace";
import { getTeacherProfessional } from "@/features/teacher/repository";
export const metadata: Metadata = { title: "المساحة المهنية" };
export const dynamic = "force-dynamic";
export default async function ProfessionalPage() { return <AppShell kind="teacher"><ProfessionalWorkspace data={await getTeacherProfessional()} /></AppShell>; }
