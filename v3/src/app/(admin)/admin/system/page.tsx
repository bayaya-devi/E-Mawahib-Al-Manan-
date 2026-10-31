import { AppShell } from "@/components/shell";
import { SystemHealth } from "@/features/admin/system-health";

export const dynamic = "force-dynamic";
export default function Page() { return <AppShell kind="admin"><SystemHealth /></AppShell>; }
