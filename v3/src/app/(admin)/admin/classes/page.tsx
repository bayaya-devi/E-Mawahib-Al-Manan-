import { AppShell } from "@/components/shell";
import { AdminClassWorkspace } from "@/features/admin/class-workspace";
import { getAdminCommandData } from "@/features/admin/repository";

export const dynamic = "force-dynamic";

export default async function AdminClassesPage() {
  return <AppShell kind="admin"><AdminClassWorkspace data={await getAdminCommandData()}/></AppShell>;
}
