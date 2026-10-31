import { AppShell } from "@/components/shell"; import { AdminDomainWorkspace } from "@/features/admin/domain-workspace"; import { getAdminCommandData } from "@/features/admin/repository";
export const dynamic = "force-dynamic"; export default async function Page() { return <AppShell kind="admin"><AdminDomainWorkspace domain="resources" data={await getAdminCommandData()} /></AppShell>; }
