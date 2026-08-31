import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { EmptyState } from "@/components/ui";
export const metadata: Metadata = { title: "الإعدادات" };
export default function SettingsPage() { return <AppShell kind="student"><div className="learning-page"><header className="simple-page-head"><span>الحساب</span><h1>الإعدادات</h1></header><EmptyState title="إعدادات الحساب" description="تظهر الخيارات المسموح بها لهذا الحساب بعد تحميل الملف الشخصي." /></div></AppShell>; }
