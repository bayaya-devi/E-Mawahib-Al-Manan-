import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getMessagingWorkspace, MessagingWorkspace } from "@/features/messaging";
export const metadata: Metadata = { title: "رسائل الأسرة وطلباتها" }; export const dynamic = "force-dynamic";
export default async function Page() { return <AppShell kind="family"><MessagingWorkspace data={await getMessagingWorkspace()} /></AppShell>; }
