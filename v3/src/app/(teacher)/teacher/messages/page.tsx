import type { Metadata } from "next";
import { MessageSquareText } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Badge, EmptyState } from "@/components/ui";
import { getTeacherHome } from "@/features/teacher/repository";
export const metadata: Metadata = { title: "رسائل الأستاذ" };
export const dynamic = "force-dynamic";
export default async function MessagesPage() { const data = await getTeacherHome(); return <AppShell kind="teacher"><div className="teacher-workspace"><header className="teacher-hero"><div><span>التواصل الإداري</span><h1>الرسائل</h1><p>رسائل الإدارة والتنبيهات المرتبطة بعملك.</p></div></header>{data.messages.length ? <section className="teacher-record-list">{data.messages.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><small>{item.body} · {new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</small></div>{item.read ? null : <Badge tone="brand">جديد</Badge>}</article>)}</section> : <EmptyState title="لا توجد رسائل" description="ستظهر رسائل الإدارة هنا." icon={MessageSquareText} />}</div></AppShell>; }
