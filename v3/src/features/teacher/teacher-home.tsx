import { BellRing, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { getSurah } from "@/features/quran/canonical";
import type { TeacherHomeData } from "./models";

export function TeacherHome({ data }: { data: TeacherHomeData }) {
  const formatter = new Intl.DateTimeFormat("ar-MA", { weekday: "long" });
  const days = [...new Set(data.schedule.map((item) => formatter.format(new Date(item.startsAt))))];
  const hours = [...new Set(data.schedule.map((item) => `${time(item.startsAt)} - ${time(item.endsAt)}`))];
  return <div className="teacher-page teacher-dashboard">
    <header className="teacher-page-head"><span>الرئيسية</span><h1>ملخص العمل</h1></header>
    <section className="teacher-summary" aria-label="ملخص العمل">
      <Summary icon={UsersRound} label="القسم" value={data.classes.map(({ name }) => name).join("، ") || "غير محدد"} />
      <Summary icon={CalendarDays} label="أيام الدروس" value={days.join("، ") || "لا يوجد جدول"} />
      <Summary icon={Clock3} label="الأوقات" value={hours.join("، ") || "غير محددة"} />
      <Summary icon={UsersRound} label="عدد الطلاب" value={String(data.students.length)} />
    </section>
    <section className="teacher-reminders">
      <div className="section-heading"><div><span>المواعيد القريبة</span><h2>تذكير الواجبات</h2></div></div>
      {data.assignmentReminders.length ? <div className="teacher-record-list">{data.assignmentReminders.map((item) => <article key={item.id}><BellRing aria-hidden="true" size={19} /><div><strong>{item.studentName}</strong><small>{assignmentLabel(item.surahNumber, item.verseFrom, item.verseTo)} · {date(item.dueAt)}</small></div></article>)}</div> : <EmptyState title="لا توجد واجبات قريبة" description="ستظهر الواجبات المنتظرة هنا." />}
    </section>
  </div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) { return <article><Icon aria-hidden="true" size={21} /><span>{label}<strong>{value}</strong></span></article>; }
function assignmentLabel(surah: number | null, from: number | null, to: number | null): string { if (!surah) return "واجب القرآن"; const name = getSurah(surah)?.nameArabic ?? "سورة"; return from && to ? `${name} · ${from} - ${to}` : name; }
function time(value: string): string { return new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function date(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(value)); }
