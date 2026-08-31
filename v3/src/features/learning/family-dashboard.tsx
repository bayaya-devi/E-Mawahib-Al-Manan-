"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpenCheck, CalendarCheck, ClipboardCheck, FileText, Megaphone, Star, UserRound } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { getSurah } from "@/features/quran/canonical";
import type { FamilyChildData, FamilyChildSummary } from "./models";

export function FamilyDashboard({ accounts, data }: { accounts: FamilyChildSummary[]; data: FamilyChildData | null }) {
  const router = useRouter();
  if (!accounts.length) return <div className="learning-page"><header className="simple-page-head"><span>مساحة الأسرة</span><h1>متابعة الأبناء</h1></header><EmptyState icon={UserRound} title="لا يوجد حساب طفل مرتبط" description="تظهر الحسابات هنا بعد أن تربطها الإدارة بحساب الأسرة." /></div>;
  const mastered = data?.progress.filter(({ status }) => status === "mastered").length ?? 0;
  const stars = data?.progress.reduce((sum, item) => sum + item.stars, 0) ?? 0;
  return <div className="learning-page family-dashboard">
    <header className="family-head"><div><span>مساحة الأسرة</span><h1>متابعة واضحة لكل طفل</h1></div><label><span>الطفل</span><select value={data?.child.id ?? accounts[0]?.id} onChange={(event) => router.replace(`/family?child=${encodeURIComponent(event.target.value)}`)}>{accounts.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select></label></header>
    <section className="family-summary"><div><BookOpenCheck /><span>السور المتقنة<strong>{mastered}</strong></span></div><div><Star /><span>النجوم<strong>{stars}</strong></span></div><div><CalendarCheck /><span>سجلات الحضور<strong>{data?.attendance.length ?? 0}</strong></span></div><div><ClipboardCheck /><span>الواجبات<strong>{data?.assignments.length ?? 0}</strong></span></div></section>
    <div className="family-sections">
      <FamilySection id="progress" title="التقدم" icon={BookOpenCheck}>{data?.progress.length ? data.progress.slice(0, 12).map((item) => <Line key={item.surahNumber} title={getSurah(item.surahNumber)?.nameArabic ?? `سورة ${item.surahNumber}`} meta={`${item.percent}%`} badge={item.status === "mastered" ? "متقنة" : "قيد التعلم"} />) : <SmallEmpty text="لا توجد بيانات تقدم بعد" />}</FamilySection>
      <FamilySection id="assignments" title="الواجبات" icon={ClipboardCheck}>{data?.assignments.length ? data.assignments.map((item) => <Line key={item.id} title={item.title} meta={item.dueAt ? formatDate(item.dueAt) : "دون موعد"} badge={({ todo: "مطلوب", in_progress: "جار", submitted: "مسلّم", corrected: "مصحح" })[item.status]} />) : <SmallEmpty text="لا توجد واجبات" />}</FamilySection>
      <FamilySection id="attendance" title="الحضور والتأخر" icon={CalendarCheck}>{data?.attendance.length ? data.attendance.map((item) => <Line key={item.id} title={({ present: "حاضر", absent: "غائب", late: "متأخر", excused: "غياب مبرر" })[item.status]} meta={formatDate(item.recordedAt)} badge={item.minutesLate ? `${item.minutesLate} دقيقة` : ""} />) : <SmallEmpty text="لا توجد سجلات حضور" />}</FamilySection>
      <FamilySection id="exams" title="الاختبارات" icon={BookOpenCheck}>{data?.exams.length ? data.exams.map((item) => <Line key={item.id} title={item.title} meta={item.appreciation ?? ""} badge={item.score === null ? "بانتظار النتيجة" : `${item.score}%`} />) : <SmallEmpty text="لا توجد نتائج اختبارات" />}</FamilySection>
      <FamilySection id="messages" title="الإعلانات والرسائل" icon={Megaphone}>{data && (data.messages.length || data.announcements.length) ? <>{data.messages.map((item) => <Line key={item.id} title={item.title} meta={item.body} badge={item.read ? formatDate(item.createdAt) : "جديد"} />)}{data.announcements.map((item) => <Line key={item.id} title={item.title} meta={item.body} badge={formatDate(item.publishedAt)} />)}</> : <SmallEmpty text="لا توجد رسائل جديدة" />}</FamilySection>
      <FamilySection id="documents" title="الوثائق المسموح بها" icon={FileText}>{data?.documents.length ? data.documents.map((item) => <Line key={item.id} title={item.title} meta={formatDate(item.createdAt)} badge="وثيقة" />) : <SmallEmpty text="لا توجد وثائق متاحة" />}</FamilySection>
    </div>
  </div>;
}

function FamilySection({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof BookOpenCheck; children: ReactNode }) { return <section className="family-section" id={id}><div className="section-heading"><div><span>المتابعة</span><h2><Icon size={20} />{title}</h2></div></div><div className="family-lines">{children}</div></section>; }
function Line({ title, meta, badge }: { title: string; meta: string; badge: string }) { return <article><div><strong>{title}</strong><span>{meta}</span></div>{badge ? <Badge>{badge}</Badge> : null}</article>; }
function SmallEmpty({ text }: { text: string }) { return <p className="compact-empty">{text}</p>; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
