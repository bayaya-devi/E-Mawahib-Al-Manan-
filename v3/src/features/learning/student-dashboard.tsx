"use client";

import { CalendarDays, CheckCircle2, Clock3, Star, UserRound, UsersRound } from "lucide-react";
import { getAllSurahs, getSurah } from "@/features/quran/canonical";
import { QuranCatalog } from "@/features/quran/quran-catalog";
import type { StudentDashboardData } from "./models";
import { studentText, useStudentLocale } from "./student-locale";

export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const locale = useStudentLocale();
  const t = (ar: string, fr: string) => studentText(locale, ar, fr);
  const mastered = data.progress.filter(({ status }) => status === "mastered").length;
  const verseCounts = new Map(getAllSurahs().map((surah) => [surah.number, surah.verseCount]));
  const totalVerses = getAllSurahs().reduce((total, surah) => total + surah.verseCount, 0);
  const completedVerseUnits = data.progress.reduce((total, item) => total + (verseCounts.get(item.surahNumber) ?? 0) * Math.max(0, Math.min(100, item.percent)) / 100, 0);
  const progressPercent = Math.round(completedVerseUnits / totalVerses * 100);
  const stars = data.progress.reduce((sum, item) => sum + item.stars, 0);
  const assignment = data.assignments.find(({ status }) => status === "todo" || status === "in_progress");
  const latestMessage = data.notifications[0] ?? null;
  return (
    <div className="learning-page student-home">
      <section className="student-class-strip" aria-label={t("معلومات الحصة", "Informations du cours")}>
        <Info icon={UserRound} label={t("المعلّم", "Professeur")} value={data.teacher?.name ?? "—"} />
        <Info icon={UsersRound} label={t("القسم", "Classe")} value={data.classroom?.name ?? "—"} />
        <ScheduleInfo value={data.classScheduleText || scheduleLabel(data.courseSchedule, locale)} label={t("أوقات الحصص", "Horaires des cours")} expand={t("عرض الكل", "Tout afficher")} />
      </section>
      {assignment ? <section className="student-assignment" aria-label="الواجب الحالي"><CheckCircle2 size={20} /><div><strong>{assignment.surahNumber ? getSurah(assignment.surahNumber)?.nameArabic : assignment.title}</strong><span>{assignmentRange(assignment)}{assignment.dueAt ? ` · ${formatDate(assignment.dueAt)}` : ""}{assignment.instructions ? ` · ${assignment.instructions}` : ""}</span></div></section> : null}
      {latestMessage ? <section className="student-assignment student-direction-message" aria-label="آخر رسالة من الإدارة"><div><strong>{latestMessage.title}</strong><span>{latestMessage.body}</span></div></section> : null}
      <section className="student-progress" aria-label={t("تقدم الحفظ", "Progression de mémorisation")}>
        <div><span>{t("تقدّم الحفظ", "Progression")}</span><strong>{progressPercent}<small>% · {mastered}/114</small></strong></div>
        <div className="progress-band__track"><span style={{ width: `${progressPercent}%` }} /></div>
        <div className="student-stars"><Star aria-hidden="true" fill="currentColor" /><strong>{stars}</strong></div>
      </section>
      <section className="student-dashboard-path" aria-label="مسار السور"><QuranCatalog progress={data.progress} juzExams={data.juzExams} /></section>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="today-info"><Icon aria-hidden="true" size={20} /><span>{label}<strong>{value}</strong></span></div>;
}

function ScheduleInfo({ value, label, expand }: { value: string; label: string; expand: string }) {
  const long = value.length > 52;
  return <div className="today-info today-info--schedule"><CalendarDays aria-hidden="true" size={20} /><span>{label}{long ? <details><summary><strong>{`${value.slice(0, 52).trim()}…`}</strong><small>{expand}</small></summary><p>{value}</p></details> : <strong>{value}</strong>}</span></div>;
}

function assignmentRange(assignment: StudentDashboardData["assignments"][number]): string {
  if (!assignment.surahNumber) return "";
  if (assignment.verseFrom && assignment.verseTo) return assignment.verseFrom === 1 && assignment.verseTo === getSurah(assignment.surahNumber)?.verseCount ? "السورة كاملة" : `من الآية ${assignment.verseFrom} إلى الآية ${assignment.verseTo}`;
  return "السورة كاملة";
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { weekday: "long", day: "numeric", month: "short" }).format(new Date(value)); }
function timeRange(start: string, end: string): string { const formatter = new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }); return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`; }
function scheduleLabel(sessions: StudentDashboardData["courseSchedule"], locale: "ar" | "fr"): string { const days = locale === "fr" ? ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] : ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]; const labels = sessions.map((session) => session.dayOfWeek === undefined ? `${new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", { weekday: "long" }).format(new Date(session.startsAt))} · ${timeRange(session.startsAt, session.endsAt)}` : `${days[session.dayOfWeek]} · ${session.startsAt.slice(0,5)}–${session.endsAt.slice(0,5)}`); return [...new Set(labels)].join(locale === "fr" ? ", " : "، ") || "—"; }
