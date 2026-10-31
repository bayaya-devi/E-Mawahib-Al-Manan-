import Link from "next/link";
import { BellRing, BookOpenText, CalendarDays, Clock3, MessageSquareText, UserPlus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { getSurah } from "@/features/quran/canonical";
import type { TeacherHomeData } from "./models";

export function TeacherHome({ data }: { data: TeacherHomeData }) {
  const classSchedule = scheduleForClasses(data);
  return <div className="teacher-page teacher-dashboard">
    <header className="teacher-page-head"><span>الرئيسية · ملخص العمل</span><h1>{teacherGreeting(data.teacher)}</h1></header>
    <section className="teacher-summary" aria-label="ملخص العمل">
      <Summary icon={UsersRound} label="القسم" value={data.classes.map(({ name }) => name).join("، ") || "غير محدد"} />
      <Summary icon={CalendarDays} label="مواعيد الحصص" value={classSchedule || "لا يوجد جدول"} />
      <Summary icon={Clock3} label="الحصة القادمة" value={data.nextCourse ? date(data.nextCourse.startsAt) : "لا توجد حصة مجدولة"} />
      <Summary icon={UsersRound} label="عدد الطلاب" value={String(data.students.length)} />
    </section>
    <nav className="teacher-quick-actions" aria-label="إجراءات سريعة">
      <Link href="/teacher/session"><BookOpenText size={20} /><span><strong>بدء حصة</strong><small>الحضور والتلاوة والواجب</small></span></Link>
      <Link href="/teacher/students"><UsersRound size={20} /><span><strong>قائمة الطلاب</strong><small>بحث ومتابعة فردية</small></span></Link>
      <Link href="/teacher/students?enroll=1"><UserPlus size={20} /><span><strong>إضافة طالب</strong><small>طالب موجود أو ملف جديد</small></span></Link>
      <Link href="/teacher/messages"><MessageSquareText size={20} /><span><strong>مراسلة الإدارة</strong><small>{data.messages.filter(({ read }) => !read).length || "لا"} رسائل غير مقروءة</small></span></Link>
    </nav>
    <section className="teacher-reminders">
      <div className="section-heading"><div><span>المواعيد القريبة</span><h2>تذكير الواجبات</h2></div></div>
      {data.assignmentReminders.length ? <div className="teacher-record-list">{data.assignmentReminders.map((item) => <article key={item.id}><BellRing aria-hidden="true" size={19} /><div><strong>{item.studentName}</strong><small>{assignmentLabel(item.surahNumber, item.verseFrom, item.verseTo)} · {date(item.dueAt)}</small></div></article>)}</div> : <EmptyState title="لا توجد واجبات قريبة" description="ستظهر الواجبات المنتظرة هنا." />}
    </section>
    <section className="teacher-reminders">
      <div className="section-heading"><div><span>آخر المستجدات</span><h2>التنبيهات والرسائل</h2></div></div>
      {data.alerts.length || data.messages.length ? <div className="teacher-record-list">{data.alerts.slice(0, 3).map((item) => <article key={`alert-${item.id}`}><BellRing aria-hidden="true" size={19} /><div><strong>{item.title}</strong><small>{item.body}</small></div></article>)}{data.messages.slice(0, 3).map((item) => <article key={`message-${item.id}`}><MessageSquareText aria-hidden="true" size={19} /><div><strong>{item.subject}</strong><small>{item.body}</small></div></article>)}</div> : <EmptyState title="لا توجد تنبيهات جديدة" description="ستظهر رسائل الإدارة والتنبيهات المهمة هنا." />}
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
function teacherGreeting(teacher: TeacherHomeData["teacher"]): string { if (!teacher) return "مرحبًا أستاذ(ة)"; const title = teacher.gender === "female" ? "أستاذة" : teacher.gender === "male" ? "أستاذ" : "أستاذ(ة)"; return `مرحبًا ${title} ${teacher.name}`; }
