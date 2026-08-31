import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { AccountCommunicationSettings } from "@/features/settings";
export const metadata: Metadata = { title: "الإعدادات" };
export default function Page() { return <AppShell kind="teacher"><div className="learning-page"><header className="simple-page-head"><span>الحساب</span><h1>الإعدادات</h1><p>وسائل الاتصال والإشعارات والأجهزة.</p></header><AccountCommunicationSettings /></div></AppShell>; }
