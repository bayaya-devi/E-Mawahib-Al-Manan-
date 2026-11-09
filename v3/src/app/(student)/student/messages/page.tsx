import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getMessagingWorkspace, MessagingWorkspace } from "@/features/messaging";
export const metadata: Metadata = { title: "الرسائل والطلبات" }; export const dynamic = "force-dynamic";
export default async function Page() { const data = await getMessagingWorkspace(true); return <AppShell kind="student"><MessagingWorkspace data={data} studentActorId={data.currentUserId} /></AppShell>; }
