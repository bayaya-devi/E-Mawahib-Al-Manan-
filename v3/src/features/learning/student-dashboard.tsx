import { CalendarDays, CheckCircle2, Clock3, Star, UserRound, UsersRound } from "lucide-react";
import { getSurah } from "@/features/quran/canonical";
import { QuranCatalog } from "@/features/quran/quran-catalog";
import type { StudentDashboardData } from "./models";

export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const mastered = data.progress.filter(({ status }) => status === "mastered").length;
  const stars = data.progress.reduce((sum, item) => sum + item.stars, 0);
  const assignment = data.assignments.find(({ status }) => status === "todo" || status === "in_progress");
  return (
    <div className="learning-page student-home">
      <section className="student-class-strip" aria-label="معلومات الحصة">
        <Info icon={UserRound} label="المعلّم" value={data.teacher?.name ?? "—"} />
        <Info icon={UsersRound} label="القسم" value={data.classroom?.name ?? "—"} />
        <Info icon={CalendarDays} label="أوقات الحصص" value={scheduleLabel(data.courseSchedule)} />
      </section>
      {assignment ? <section className="student-assignment" aria-label="الواجب الحالي"><CheckCircle2 size={20} /><div><strong>{assignment.surahNumber ? getSurah(assignment.surahNumber)?.nameArabic : assignment.title}</strong><span>{assignmentRange(assignment)}{assignment.dueAt ? ` · ${formatDate(assignment.dueAt)}` : ""}{assignment.instructions ? ` · ${assignment.instructions}` : ""}</span></div></section> : null}
      <section className="student-progress" aria-label="تقدم الحفظ">
        <div><span>تقدّم الحفظ</span><strong>{mastered}<small>/114</small></strong></div>
        <div className="progress-band__track"><span style={{ width: `${Math.round(mastered / 114 * 100)}%` }} /></div>
        <div className="student-stars"><Star aria-hidden="true" fill="currentColor" /><strong>{stars}</strong></div>
      </section>
      <section className="student-dashboard-path" aria-label="مسار السور"><QuranCatalog progress={data.progress} /></section>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="today-info"><Icon aria-hidden="true" size={20} /><span>{label}<strong>{value}</strong></span></div>;
}

function assignmentRange(assignment: StudentDashboardData["assignments"][number]): string {
  if (!assignment.surahNumber) return "";
  if (assignment.verseFrom && assignment.verseTo) return assignment.verseFrom === 1 && assignment.verseTo === getSurah(assignment.surahNumber)?.verseCount ? "السورة كاملة" : `من الآية ${assignment.verseFrom} إلى الآية ${assignment.verseTo}`;
  return "السورة كاملة";
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { weekday: "long", day: "numeric", month: "short" }).format(new Date(value)); }
function timeRange(start: string, end: string): string { const formatter = new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }); return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`; }
function scheduleLabel(sessions: StudentDashboardData["courseSchedule"]): string { const labels = sessions.map((session) => `${new Intl.DateTimeFormat("ar-MA", { weekday: "long" }).format(new Date(session.startsAt))} · ${timeRange(session.startsAt, session.endsAt)}`); return [...new Set(labels)].join("، ") || "—"; }
