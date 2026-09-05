import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getMessagingWorkspace, TeacherMailbox } from "@/features/messaging";
export const metadata: Metadata = { title: "رسائل الأستاذ" };
export const dynamic = "force-dynamic";
export default async function MessagesPage() { return <AppShell kind="teacher"><TeacherMailbox data={await getMessagingWorkspace()} /></AppShell>; }
