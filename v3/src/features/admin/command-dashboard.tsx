import { AlertTriangle, BookOpenCheck, CalendarClock, Clock3, GraduationCap, Landmark, MessageSquareText, Settings, UsersRound } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import type { AdminCommandData } from "./models";

export function CommandDashboard({ data }: { data: AdminCommandData }) {
  const teachers = data.people.filter((person) => person.role === "teacher" && person.status === "active");
  const learning = data.timeline.filter((item) => item.kind === "learning").slice(0, 6);
  return <div className="command-page">
    <header className="admin-page-head"><div><p>مركز القيادة</p><h1>نظرة المؤسسة اليوم</h1></div><nav className="admin-quick-links" aria-label="الإدارات الثانوية">
      <Link href="/admin/classes"><UsersRound size={18}/>الأقسام</Link>
      <Link href="/admin/communications"><MessageSquareText size={18}/>التواصل</Link>
      <Link href="/admin/parents"><GraduationCap size={18}/>الوالدان</Link>
      <Link href="/admin/settings"><Settings size={18}/>الإعدادات</Link>
    </nav></header>
    <section className="command-metrics" aria-label="المؤشرات الرئيسية">{data.metrics.map((metric) => <article className={metric.tone ? `is-${metric.tone}` : undefined} key={metric.key}><span>{metric.label}</span><strong>{metric.value.toLocaleString("ar-MA")}</strong></article>)}</section>
    <div className="admin-dashboard-grid">
      <section className="command-panel"><div className="command-heading"><h2>الحصص المبرمجة الآن</h2><CalendarClock size={20}/></div>{data.scheduledNow.length ? <div className="compact-records">{data.scheduledNow.map((row) => <article key={row.classId}><div><strong>{row.className}</strong><small>{row.teacherName ?? "أستاذ غير معيّن"} · {row.startsAt}–{row.endsAt}{row.room ? ` · ${row.room}` : ""}</small></div><span className={row.confirmed ? "status-confirmed" : "status-scheduled"}>{row.confirmed ? "مؤكدة" : "مبرمجة"}</span></article>)}</div> : <EmptyState title="لا توجد حصة الآن" description="الحساب يعتمد على الجدول الرسمي بتوقيت الدار البيضاء."/>}</section>
      <section className="command-panel"><div className="command-heading"><h2>للمعالجة</h2><AlertTriangle size={20}/></div>{data.tasks.length ? <div className="compact-records">{data.tasks.slice(0, 6).map((task) => <article key={`${task.source}-${task.id}`}><div><strong>{task.title}</strong><small>{task.reason}</small></div><Link href={task.href}>فتح</Link></article>)}</div> : <EmptyState title="لا توجد عناصر معلقة" description="كل الطلبات والتنبيهات المهمة تمت معالجتها."/>}</section>
    </div>
    <section className="command-panel"><div className="command-heading"><h2>النتيجة حسب القسم</h2><Landmark size={20}/></div>{data.classFinance.length ? <div className="class-finance-grid">{data.classFinance.slice(0, 8).map((row) => <article key={row.classId} className={row.result > 0 ? "is-positive" : row.result < 0 ? "is-negative" : "is-balanced"}><div><strong>{row.className}</strong><small>{row.teacherName ?? "دون أستاذ"} · {row.students} طالب</small></div><b>{money(row.result)}</b><small>مداخيل {money(row.income)} · مصاريف {money(row.directExpense + row.commonShare)}</small></article>)}</div> : <EmptyState title="لا توجد بيانات مالية حسب القسم" description="تظهر النتائج عند ربط العمليات بأقسامها الرسمية."/>}</section>
    <section className="teacher-distribution"><h2>الطلاب حسب الأستاذ</h2><div>{teachers.map((teacher) => <span key={teacher.id}><b>{teacher.name}</b>{data.people.filter((student) => student.role === "student" && student.teacherIds.includes(teacher.id)).length}</span>)}</div></section>
    <div className="admin-dashboard-grid"><section className="command-panel"><div className="command-heading"><h2>آخر التقارير</h2><BookOpenCheck size={20}/></div>{data.reports.length ? <div className="compact-records">{data.reports.slice(0, 3).map((row) => <details key={row.id}><summary><strong>{row.teacherName}</strong><span>{row.className}</span><time>{row.submittedAt ? format(row.submittedAt) : "—"}</time></summary><p>{row.summary ?? (row.incident ? "يتضمن تنبيها يحتاج المراجعة." : `الحالة: ${row.status}`)}</p></details>)}</div> : <EmptyState title="لا توجد تقارير" description="ستظهر التقارير المرسلة من الأساتذة هنا."/>}</section><section className="command-panel"><div className="command-heading"><h2>آخر الأنشطة</h2><Clock3 size={20}/></div>{data.timeline.length ? <div className="compact-records">{data.timeline.slice(0, 6).map((row) => <article key={row.id}><div><strong>{row.title}</strong><small>{row.detail}</small></div><time>{format(row.occurredAt)}</time></article>)}</div> : <EmptyState title="لا توجد أنشطة" description="سيظهر النشاط الحقيقي فور تسجيله."/>}</section></div>
    <section className="command-panel"><div className="command-heading"><h2>آخر إنجازات الطلاب</h2><GraduationCap size={20}/></div>{learning.length ? <div className="achievement-strip">{learning.map((row) => <article key={row.id}><UsersRound size={18}/><div><strong>{row.title}</strong><small>{row.detail}</small></div><time>{format(row.occurredAt)}</time></article>)}</div> : <EmptyState title="لا توجد إنجازات مسجلة" description="تظهر السور والأجزاء المكتملة هنا."/>}</section>
  </div>;
}
function format(value:string){return new Intl.DateTimeFormat("ar-MA",{dateStyle:"short",timeStyle:"short"}).format(new Date(value))}
function money(value:number){return `${value.toLocaleString("ar-MA",{maximumFractionDigits:2})} DH`}
