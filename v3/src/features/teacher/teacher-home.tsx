import { BellRing, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { getSurah } from "@/features/quran/canonical";
import type { TeacherHomeData } from "./models";

export function TeacherHome({ data }: { data: TeacherHomeData }) {
  const classSchedule = scheduleForClasses(data);
  return <div className="teacher-page teacher-dashboard">
    <header className="teacher-page-head"><span>الرئيسية</span><h1>ملخص العمل</h1></header>
    <section className="teacher-summary" aria-label="ملخص العمل">
      <Summary icon={UsersRound} label="القسم" value={data.classes.map(({ name }) => name).join("، ") || "غير محدد"} />
      <Summary icon={CalendarDays} label="مواعيد الحصص" value={classSchedule || "لا يوجد جدول"} />
      <Summary icon={Clock3} label="الحصة القادمة" value={data.nextCourse ? date(data.nextCourse.startsAt) : "لا توجد حصة مجدولة"} />
      <Summary icon={UsersRound} label="عدد الطلاب" value={String(data.students.length)} />
    </section>
    <section className="teacher-reminders">
      <div className="section-heading"><div><span>المواعيد القريبة</span><h2>تذكير الواجبات</h2></div></div>
      {data.assignmentReminders.length ? <div className="teacher-record-list">{data.assignmentReminders.map((item) => <article key={item.id}><BellRing aria-hidden="true" size={19} /><div><strong>{item.studentName}</strong><small>{assignmentLabel(item.surahNumber, item.verseFrom, item.verseTo)} · {date(item.dueAt)}</small></div></article>)}</div> : <EmptyState title="لا توجد واجبات قريبة" description="ستظهر الواجبات المنتظرة هنا." />}
    </section>
  </div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) { return <article><Icon aria-hidden="true" size={21} /><span>{label}<strong>{value}</strong></span></article>; }
function scheduleForClasses(data: TeacherHomeData): string {
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return data.classes.map((classroom) => {
    if (classroom.scheduleText?.trim()) return `${classroom.name}: ${classroom.scheduleText.trim()}`;
    const slots = (data.recurringSchedule ?? []).filter((slot) => slot.classId === classroom.id);
    return slots.length ? `${classroom.name}: ${slots.map((slot) => `${days[slot.dayOfWeek]} ${slot.startsAt.slice(0, 5)}–${slot.endsAt.slice(0, 5)}`).join("، ")}` : null;
  }).filter((value): value is string => Boolean(value)).join(" · ");
}
function assignmentLabel(surah: number | null, from: number | null, to: number | null): string { if (!surah) return "واجب القرآن"; const name = getSurah(surah)?.nameArabic ?? "سورة"; return from && to ? `${name} · ${from} - ${to}` : name; }
function date(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(value)); }
