import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { EmptyState } from "@/components/ui";
import { getStudentHistory } from "@/features/learning/repository";
import { getSurah } from "@/features/quran/canonical";
export const metadata: Metadata = { title: "سجل التعلم" };
export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const data = await getStudentHistory();
  const hasData = data.events.length || data.recitations.length || data.reviews.length;
  return <AppShell kind="student"><div className="learning-page"><header className="simple-page-head"><span>رحلتك</span><h1>سجل التعلم</h1><p>السور والمراجعات ومحاولات التسميع بترتيبها الزمني.</p></header>{hasData ? <div className="history-sections"><section><h2>مقاطع للمراجعة</h2>{data.reviews.map((item) => <HistoryLine key={item.id} title={getSurah(item.surahNumber)?.nameArabic ?? "سورة"} meta={`الآيات ${item.verseFrom} - ${item.verseTo}`} detail={item.reason ?? "مراجعة مقترحة"} />)}</section><section><h2>محاولات التسميع</h2>{data.recitations.map((item) => <HistoryLine key={item.id} title={getSurah(item.surahNumber)?.nameArabic ?? "سورة"} meta={item.conclusive ? `${item.score}/10` : "نتيجة غير حاسمة"} detail={item.recommendation ?? ""} />)}</section><section><h2>النشاط</h2>{data.events.map((item) => <HistoryLine key={item.id} title={eventLabel(item.kind)} meta={item.surahNumber ? getSurah(item.surahNumber)?.nameArabic ?? "" : ""} detail={formatDate(item.occurredAt)} />)}</section></div> : <EmptyState title="لا يوجد نشاط مسجل" description="يبدأ السجل عند أول نشاط محفوظ في V3 أو بعد استيراد تقدم V1." />}</div></AppShell>;
}
function HistoryLine({ title, meta, detail }: { title: string; meta: string; detail: string }) { return <article className="history-line"><div><strong>{title}</strong><span>{detail}</span></div><small>{meta}</small></article>; }
function eventLabel(kind: string): string { return ({ surah_started: "بدء سورة", surah_completed: "إتمام سورة", verse_practised: "تدريب آية", goal_completed: "إتمام هدف", assignment_updated: "تحديث واجب", game_completed: "إتمام تدريب", exam_completed: "إتمام اختبار", v1_imported: "استيراد تقدم سابق" } as Record<string, string>)[kind] ?? "نشاط تعليمي"; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
