import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getMessagingWorkspace, MessagingWorkspace } from "@/features/messaging";
export const metadata: Metadata = { title: "رسائل الأستاذ" };
export const dynamic = "force-dynamic";
export default async function MessagesPage() { return <AppShell kind="teacher"><MessagingWorkspace data={await getMessagingWorkspace()} /></AppShell>; }
