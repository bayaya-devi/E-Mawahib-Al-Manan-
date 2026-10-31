import type { Metadata } from "next";

import { AppShell } from "@/components/shell";
import { EmptyState } from "@/components/ui";
import { getTeacherFollowUp } from "@/features/learning/repository";
import { getSurah } from "@/features/quran/canonical";

export const metadata: Metadata = { title: "متابعة الحفظ" };
export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const entries = await getTeacherFollowUp();
  return <AppShell kind="student"><div className="learning-page student-follow-up">
    <header className="student-page-head"><div><span>السجل التربوي</span><h1>متابعة الحفظ</h1></div></header>
    {entries.length ? <ol className="follow-up-timeline">{entries.map((entry) => {
      const surah = getSurah(entry.surahNumber);
      const full = entry.verseFrom === 1 && entry.verseTo === surah?.verseCount;
      return <li key={entry.id}><time>{formatDate(entry.recordedAt)}<small>{formatTime(entry.recordedAt)}</small></time><article><header><strong>{surah?.nameArabic ?? "سورة"}</strong><span>{appreciationLabel(entry.appreciation)}</span></header><p>{full ? "السورة كاملة" : `الآيات ${entry.verseFrom}–${entry.verseTo}`}</p><footer><span>{entry.teacherName}</span>{entry.className ? <small>{entry.className}</small> : null}</footer>{entry.comment ? <blockquote>{entry.comment}</blockquote> : null}</article></li>;
    })}</ol> : <EmptyState title="لا توجد متابعة مسجلة" description="ستظهر هنا القراءات التي يسجلها الأستاذ(ة) أثناء الحصة." />}
  </div></AppShell>;
}

function appreciationLabel(value: string): string {
  return ({ excellent: "ممتاز", very_good: "جيد جدا", good: "جيد", acceptable: "مقبول", needs_review: "يحتاج مراجعة", weak: "ضعيف", insufficient: "غير كاف" } as Record<string, string>)[value] ?? value;
}
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(value)); }
function formatTime(value: string): string { return new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
