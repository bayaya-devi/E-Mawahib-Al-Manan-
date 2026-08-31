import { Bell, BookOpenText, CalendarDays, CheckCircle2, Clock3, Megaphone, Star, UserRound } from "lucide-react";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getSurah } from "@/features/quran/canonical";
import type { StudentDashboardData } from "./models";

export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const mastered = data.progress.filter(({ status }) => status === "mastered").length;
  const stars = data.progress.reduce((sum, item) => sum + item.stars, 0);
  const active = data.progress.find(({ status }) => status === "in_progress") ?? data.progress[0];
  const goalSurah = data.goal ? getSurah(data.goal.surahNumber) : active ? getSurah(active.surahNumber) : undefined;
  return (
    <div className="learning-page">
      <header className="learning-hero">
        <div><span>مرحبا {data.student?.name ?? "بك"}</span><h1>تابع حفظك بهدوء وثبات</h1><p>خطوتك الحالية واضحة، وكل ما تحتاجه اليوم قريب منك.</p></div>
        <ButtonLink href={goalSurah ? `/student/quran/${goalSurah.slug}` : "/student/quran"}><BookOpenText size={19} />متابعة الحفظ</ButtonLink>
      </header>

      <section className="today-strip" aria-label="معلومات اليوم">
        <Info icon={Clock3} label="الحصة القادمة" value={data.nextCourse ? formatDate(data.nextCourse.startsAt) : "لا توجد حصة قريبة"} />
        <Info icon={UserRound} label="الأستاذ" value={data.teacher?.name ?? "غير محدد"} />
        <Info icon={CalendarDays} label="الوقت" value={data.nextCourse ? timeRange(data.nextCourse.startsAt, data.nextCourse.endsAt) : "—"} />
      </section>

      <section className="progress-band" aria-label="التقدم">
        <div><span>السور المتقنة</span><strong>{mastered}<small>/ 114</small></strong></div>
        <div className="progress-band__track"><span style={{ width: `${Math.round(mastered / 114 * 100)}%` }} /></div>
        <div className="star-total"><Star aria-hidden="true" fill="currentColor" /><strong>{stars}</strong><span>نجمة</span></div>
      </section>

      <div className="learning-grid">
        <section className="learning-main" aria-labelledby="current-goal">
          <div className="section-heading"><div><span>الهدف الحالي</span><h2 id="current-goal">{goalSurah?.nameArabic ?? "ابدأ مسار الحفظ"}</h2></div>{active ? <Badge tone="warning">{active.percent}%</Badge> : null}</div>
          {goalSurah ? <div className="current-goal"><BookOpenText size={28} /><div><strong>من الآية {data.goal?.verseFrom ?? 1} إلى الآية {data.goal?.verseTo ?? goalSurah.verseCount}</strong><span>{data.goal?.targetDate ? `قبل ${formatDay(data.goal.targetDate)}` : "تقدم حسب قدرتك"}</span></div><ButtonLink href={`/student/quran/${goalSurah.slug}`} variant="secondary">فتح السورة</ButtonLink></div> : <EmptyState title="لا يوجد هدف نشط" description="افتح مسار القرآن واختر السورة المتاحة للمتابعة." action={<ButtonLink href="/student/quran">عرض السور</ButtonLink>} />}
        </section>

        <section className="learning-side" aria-labelledby="assignments-title">
          <div className="section-heading"><div><span>المهام</span><h2 id="assignments-title">الواجبات</h2></div><Badge>{data.assignments.length}</Badge></div>
          <CompactList empty="لا توجد واجبات حاليا" items={data.assignments.slice(0, 4).map((item) => ({ id: item.id, title: item.title, meta: assignmentLabel(item.status), icon: CheckCircle2 }))} />
          <ButtonLink href="/student/assignments" variant="quiet">عرض كل الواجبات</ButtonLink>
        </section>

        <section className="learning-main" aria-labelledby="announcements-title">
          <div className="section-heading"><div><span>المؤسسة</span><h2 id="announcements-title">الإعلانات والأحداث</h2></div></div>
          <CompactList empty="لا توجد إعلانات جديدة" items={[
            ...data.announcements.slice(0, 3).map((item) => ({ id: item.id, title: item.title, meta: item.body, icon: Megaphone })),
            ...data.events.slice(0, 2).map((item) => ({ id: item.id, title: item.title, meta: formatDate(item.startsAt), icon: CalendarDays })),
          ]} />
        </section>

        <section className="learning-side" aria-labelledby="notifications-title">
          <div className="section-heading"><div><span>الجديد</span><h2 id="notifications-title">الإشعارات</h2></div></div>
          <CompactList empty="لا توجد إشعارات" items={data.notifications.slice(0, 5).map((item) => ({ id: item.id, title: item.title, meta: item.body, icon: Bell }))} />
        </section>
      </div>
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
function formatDay(value: string): string { return new Intl.DateTimeFormat("ar-MA", { day: "numeric", month: "long" }).format(new Date(value)); }
function timeRange(start: string, end: string): string { const formatter = new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }); return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`; }

