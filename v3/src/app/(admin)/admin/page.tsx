import type { Metadata } from "next";
import { AppShell, ShellPage } from "@/components/shell";

export const metadata: Metadata = { title: "مساحة الإدارة" };
export default function AdminPage() { return <AppShell kind="admin"><ShellPage kind="admin" /></AppShell>; }
