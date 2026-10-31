import { AppShell } from "@/components/shell";
import { AdminCommunicationCenter } from "@/features/admin/communication-center";
import { getAdminCommandData } from "@/features/admin/repository";
import { getMessagingWorkspace, MessagingWorkspace } from "@/features/messaging";
export const dynamic = "force-dynamic";
export default async function Page() { const [command, messaging] = await Promise.all([getAdminCommandData(), getMessagingWorkspace()]); return <AppShell kind="admin"><div className="command-page"><header className="admin-page-head"><h1>التواصل</h1></header><AdminCommunicationCenter schoolId={command.school?.id ?? null} classes={command.classes.map(({ id, name }) => ({ id, name }))} people={command.people.map(({id,name,role,gender,classId})=>({id,name,role,gender,classId}))}/><MessagingWorkspace data={messaging} /></div></AppShell>; }
