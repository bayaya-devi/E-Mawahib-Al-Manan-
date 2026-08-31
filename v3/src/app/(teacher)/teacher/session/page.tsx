import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui";
import { getTeacherSession } from "@/features/teacher/repository";
import { SessionWizard } from "@/features/teacher/session-wizard";
export const metadata: Metadata = { title: "وضع الحصة" };
export const dynamic = "force-dynamic";
export default async function SessionPage() { const data = await getTeacherSession(); return <ToastProvider><SessionWizard data={data} /></ToastProvider>; }
