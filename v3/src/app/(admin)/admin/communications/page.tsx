import { AppShell } from "@/components/shell";
import { AdminCommunicationCenter } from "@/features/admin/communication-center";
import { AdminDomainWorkspace } from "@/features/admin/domain-workspace";
import { getAdminCommandData } from "@/features/admin/repository";
import { getMessagingWorkspace, MessagingWorkspace } from "@/features/messaging";
export const dynamic = "force-dynamic";
export default async function Page() { const [command, messaging] = await Promise.all([getAdminCommandData(), getMessagingWorkspace()]); return <AppShell kind="admin"><AdminCommunicationCenter schoolId={command.school?.id ?? null} classes={command.classes.map(({ id, name }) => ({ id, name }))} /><AdminDomainWorkspace domain="communications" data={command} /><MessagingWorkspace data={messaging} /></AppShell>; }
