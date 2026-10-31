import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getTeacherSession } from "@/features/teacher/repository";
import { SessionWizard } from "@/features/teacher/session-wizard";
export const metadata: Metadata = { title: "وضع الحصة" };
export const dynamic = "force-dynamic";
export default async function SessionPage() { const data = await getTeacherSession(); return <AppShell kind="teacher"><SessionWizard data={data} /></AppShell>; }
