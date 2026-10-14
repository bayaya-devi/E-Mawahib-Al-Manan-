import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { TeacherSettings } from "@/features/teacher/teacher-settings";
import { PrivacyControls } from "@/features/privacy";
export const metadata: Metadata = { title: "الإعدادات" };
export default function Page() { return <AppShell kind="teacher"><div className="teacher-workspace"><header className="teacher-page-head"><span>الحساب</span><h1>الإعدادات</h1></header><TeacherSettings /><PrivacyControls /></div></AppShell>; }
