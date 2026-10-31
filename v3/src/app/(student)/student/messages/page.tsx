import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getMessagingWorkspace, MessagingWorkspace } from "@/features/messaging";
export const metadata: Metadata = { title: "الرسائل والطلبات" }; export const dynamic = "force-dynamic";
export default async function Page() { return <AppShell kind="student"><MessagingWorkspace data={await getMessagingWorkspace()} /></AppShell>; }
