import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { CommandDashboard } from "@/features/admin/command-dashboard";
import { getAdminCommandData } from "@/features/admin/repository";

export const metadata: Metadata = { title: "مساحة الإدارة" };
export const dynamic = "force-dynamic";
export default async function AdminPage() { return <AppShell kind="admin"><CommandDashboard data={await getAdminCommandData()} /></AppShell>; }
