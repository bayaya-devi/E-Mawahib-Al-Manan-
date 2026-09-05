import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { StudentSettings } from "@/features/learning/student-extensions";
export const metadata: Metadata = { title: "الإعدادات" };
export default function SettingsPage() { return <AppShell kind="student"><StudentSettings /></AppShell>; }
