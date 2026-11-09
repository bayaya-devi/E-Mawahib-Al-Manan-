import { AppShell } from "@/components/shell";
import { AdminSettings } from "@/features/admin/admin-settings";
import { getAdminSettingsData } from "@/features/admin/repository";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getAdminSettingsData();
  return <AppShell kind="admin"><div className="command-page"><header className="admin-page-head"><h1>الإعدادات</h1></header><AdminSettings schoolId={data.schoolId} initialThreshold={data.financeThreshold}/></div></AppShell>;
}
