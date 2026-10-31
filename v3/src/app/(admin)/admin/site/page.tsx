import type { Metadata } from "next";

import { AppShell } from "@/components/shell";
import { PublicSiteAdminWorkspace } from "@/features/public-site/admin-workspace";

export const metadata: Metadata = { title: "إدارة الموقع العام" };
export default function AdminSitePage() { return <AppShell kind="admin"><PublicSiteAdminWorkspace /></AppShell>; }
