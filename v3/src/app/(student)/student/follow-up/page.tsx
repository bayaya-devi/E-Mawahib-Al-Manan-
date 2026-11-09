import type { Metadata } from "next";

import { AppShell } from "@/components/shell";
import { EmptyState } from "@/components/ui";
import { getTeacherFollowUp } from "@/features/learning/repository";
import { getSurah } from "@/features/quran/canonical";
import { getActiveStudentLocale } from "@/features/learning/student-context";

export const metadata: Metadata = { title: "متابعة الحفظ" };
export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const [entries, locale] = await Promise.all([getTeacherFollowUp(), getActiveStudentLocale()]);
  const fr = locale === "fr";
  return <AppShell kind="student"><div className="learning-page student-follow-up">
    <header className="student-page-head"><div><span>{fr ? "Registre pédagogique" : "السجل التربوي"}</span><h1>{fr ? "Suivi de mémorisation" : "متابعة الحفظ"}</h1></div></header>
    {entries.length ? <ol className="follow-up-timeline">{entries.map((entry) => {
      const surah = getSurah(entry.surahNumber);
      const full = entry.verseFrom === 1 && entry.verseTo === surah?.verseCount;
      return <li key={entry.id}><time>{formatDate(entry.recordedAt, locale)}<small>{formatTime(entry.recordedAt, locale)}</small></time><article><header><strong>{surah?.nameArabic ?? "سورة"}</strong><span>{appreciationLabel(entry.appreciation, locale)}</span></header><p>{full ? fr ? "Sourate entière" : "السورة كاملة" : fr ? `Versets ${entry.verseFrom}–${entry.verseTo}` : `الآيات ${entry.verseFrom}–${entry.verseTo}`}</p><footer><span>{entry.teacherName}</span>{entry.className ? <small>{entry.className}</small> : null}</footer>{entry.comment ? <blockquote>{entry.comment}</blockquote> : null}</article></li>;
    })}</ol> : <EmptyState title={fr ? "Aucun suivi enregistré" : "لا توجد متابعة مسجلة"} description={fr ? "Les lectures enregistrées par le professeur apparaîtront ici." : "ستظهر هنا القراءات التي يسجلها الأستاذ(ة) أثناء الحصة."} />}
  </div></AppShell>;
}

function appreciationLabel(value: string, locale: "ar" | "fr"): string {
  const labels = locale === "fr" ? { excellent: "Excellent", very_good: "Très bien", good: "Bien", acceptable: "Acceptable", needs_review: "À revoir", weak: "Faible", insufficient: "Insuffisant" } : { excellent: "ممتاز", very_good: "جيد جدا", good: "جيد", acceptable: "مقبول", needs_review: "يحتاج مراجعة", weak: "ضعيف", insufficient: "غير كاف" };
  return (labels as Record<string, string>)[value] ?? value;
}
function formatDate(value: string, locale: "ar" | "fr"): string { return new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" }).format(new Date(value)); }
function formatTime(value: string, locale: "ar" | "fr"): string { return new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" }).format(new Date(value)); }
