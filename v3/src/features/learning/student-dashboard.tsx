import { Bell, BookOpenText, CalendarDays, CheckCircle2, Clock3, Megaphone, Star, UserRound } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { getSurah } from "@/features/quran/canonical";
import { QuranCatalog } from "@/features/quran/quran-catalog";
import type { StudentDashboardData } from "./models";

export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const mastered = data.progress.filter(({ status }) => status === "mastered").length;
  const stars = data.progress.reduce((sum, item) => sum + item.stars, 0);
  const active = data.progress.find(({ status }) => status === "in_progress") ?? data.progress.find(({ status }) => status !== "mastered");
  const goalSurah = data.goal ? getSurah(data.goal.surahNumber) : active ? getSurah(active.surahNumber) : undefined;
  return (
    <div className="learning-page student-home">
      <section className="student-class-strip" aria-label="معلومات الحصة">
        <Info icon={UserRound} label="المعلّم" value={data.teacher?.name ?? "—"} />
        <Info icon={CalendarDays} label="الحصة القادمة" value={data.nextCourse ? formatDate(data.nextCourse.startsAt) : "—"} />
        <Info icon={Clock3} label="الموعد" value={data.nextCourse ? timeRange(data.nextCourse.startsAt, data.nextCourse.endsAt) : "—"} />
      </section>
      {data.assignments.length ? <section className="student-assignment" aria-label="الواجب الحالي"><CheckCircle2 size={20} /><div><strong>{data.assignments[0]?.title}</strong><span>{assignmentLabel(data.assignments[0]?.status ?? "todo")}</span></div><ButtonLink href="/student/assignments" variant="quiet">فتح</ButtonLink></section> : null}
      <section className="student-progress" aria-label="تقدم الحفظ">
        <div><span>تقدّم الحفظ</span><strong>{mastered}<small>/114</small></strong></div>
        <div className="progress-band__track"><span style={{ width: `${Math.round(mastered / 114 * 100)}%` }} /></div>
        <div className="student-stars"><Star aria-hidden="true" fill="currentColor" /><strong>{stars}</strong></div>
      </section>
      <section className="student-next" aria-label="السورة التالية">
        <BookOpenText aria-hidden="true" size={25} />
        <div><span>السورة التالية</span><strong>{goalSurah?.nameArabic ?? getSurah(active?.surahNumber ?? 114)?.nameArabic ?? "سورة الناس"}</strong></div>
        <ButtonLink href={goalSurah ? `/student/quran/${goalSurah.slug}` : active ? `/student/quran/${getSurah(active.surahNumber)?.slug}` : "/student/quran"}>ابدأ</ButtonLink>
      </section>
      <div className="student-home-grid">
        <section aria-labelledby="announcements-title"><h2 id="announcements-title">الإعلانات</h2><CompactList empty="لا توجد إعلانات" items={data.announcements.slice(0, 3).map((item) => ({ id: item.id, title: item.title, meta: item.body, icon: Megaphone }))} /></section>
        <section aria-labelledby="notifications-title"><h2 id="notifications-title">التنبيهات</h2><CompactList empty="لا توجد تنبيهات" items={data.notifications.slice(0, 3).map((item) => ({ id: item.id, title: item.title, meta: item.body, icon: Bell }))} /></section>
      </div>
      <section className="student-dashboard-path" aria-label="مسار السور"><QuranCatalog progress={data.progress} /></section>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="today-info"><Icon aria-hidden="true" size={20} /><span>{label}<strong>{value}</strong></span></div>;
}

function CompactList({ items, empty }: { items: Array<{ id: string; title: string; meta: string; icon: typeof Clock3 }>; empty: string }) {
  if (!items.length) return <p className="compact-empty">{empty}</p>;
  return <div className="compact-list">{items.map(({ id, title, meta, icon: Icon }) => <article key={id}><Icon aria-hidden="true" size={18} /><div><strong>{title}</strong><span>{meta}</span></div></article>)}</div>;
}

function assignmentLabel(status: StudentDashboardData["assignments"][number]["status"]): string {
  return ({ todo: "مطلوب", in_progress: "قيد الإنجاز", submitted: "تم التسليم", corrected: "تم التصحيح" })[status];
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { weekday: "long", day: "numeric", month: "short" }).format(new Date(value)); }
function timeRange(start: string, end: string): string { const formatter = new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }); return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`; }
