"use client";

import { Award, ArrowLeft, ChevronDown, LockKeyhole, LockKeyholeOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import type { StudentDashboardData } from "@/features/learning/models";
import { getSurah } from "./canonical";
import { getJuzPassages } from "./juz";
import { reviewGroups } from "./learning-plan";
import { ReviewCheckpoint } from "./review-checkpoint";
import { studentText, useStudentLocale, type StudentLocale } from "@/features/learning/student-locale";

export type Juz = { number: number; name: string; from: number; to: number };

const juzNames: Record<number, string> = {
  1: "جزء الحمد", 2: "جزء سيقول", 3: "جزء تلك الرسل", 4: "جزء لن تنالوا", 5: "جزء والمحصنات",
  6: "جزء لا يحب الله", 7: "جزء وإذا سمعوا", 8: "جزء ولو أننا", 9: "جزء قال الملأ", 10: "جزء واعلموا",
  11: "جزء يعتذر", 12: "جزء وما من دابة", 13: "جزء وما أبرئ", 14: "جزء ربّما", 15: "جزء سبحان الذي",
  16: "جزء قال ألم", 17: "جزء اقترب", 18: "جزء قد أفلح", 19: "جزء قال الذين", 20: "جزء أمن خلق",
  21: "جزء اتل ما أوحي", 22: "جزء ومن يقنت", 23: "جزء وما لي", 24: "جزء فمن أظلم", 25: "جزء إليه يرد",
  26: "جزء حم", 27: "جزء قال فما خطبكم", 28: "جزء قد سمع", 29: "جزء تبارك", 30: "جزء عمّ",
};

export const JUZ: readonly Juz[] = Array.from({ length: 30 }, (_, index) => 30 - index).map((number) => {
  const surahs = getJuzPassages(number).map((passage) => passage.surahNumber);
  return { number, name: juzNames[number]!, from: Math.min(...surahs), to: Math.max(...surahs) };
});

export function QuranCatalog({ progress, juzExams = [] }: { progress: StudentDashboardData["progress"]; juzExams?: StudentDashboardData["juzExams"] }) {
  const locale = useStudentLocale();
  const t = (ar: string, fr: string) => studentText(locale, ar, fr);
  const [openJuz, setOpenJuz] = useState<number | null>(null);
  const bySurah = useMemo(() => new Map(progress.map((item) => [item.surahNumber, item])), [progress]);
  const passedJuz = useMemo(() => new Set(juzExams.filter((attempt) => attempt.passed).map((attempt) => attempt.juzNumber)), [juzExams]);
  const bestScores = useMemo(() => {
    const scores = new Map<number, number>();
    for (const attempt of juzExams) scores.set(attempt.juzNumber, Math.max(scores.get(attempt.juzNumber) ?? 0, attempt.score));
    return scores;
  }, [juzExams]);
  const activeIndex = Math.max(0, JUZ.findIndex((juz) => !passedJuz.has(juz.number)));

  return <div className="student-quran-path">{JUZ.map((juz, index) => {
    const surahNumbers = [...new Set(getJuzPassages(juz.number).map((passage) => passage.surahNumber))];
    const surahs = surahNumbers.map((number) => getSurah(number)).filter((surah): surah is NonNullable<ReturnType<typeof getSurah>> => Boolean(surah));
    const passed = passedJuz.has(juz.number);
    const active = index === activeIndex;
    const preview = index === activeIndex + 1;
    if (!passed && !active && !preview) return null;
    const expanded = active || openJuz === juz.number;
    const readyForExam = surahs.every((surah) => bySurah.get(surah.number)?.status === "mastered");
    const nextSurah = surahs.find((surah) => bySurah.get(surah.number)?.status !== "mastered")?.number ?? null;
    return <section className={`juz-path ${active ? "is-active" : ""} ${passed ? "is-complete" : ""} ${preview ? "is-locked" : ""}`} key={juz.number}>
      <button type="button" className="juz-path__head" disabled={preview} onClick={() => setOpenJuz((value) => value === juz.number ? null : juz.number)} aria-expanded={expanded}>
        <span className="juz-path__marker">{passed ? <Award size={17} /> : preview ? <LockKeyhole size={16} /> : <Sparkles size={17} />}</span>
        <span><strong>{locale === "fr" ? `Juz ${juz.number}` : juz.name}</strong><small>{juzPassageLabel(juz.number, locale)}</small></span>
        {preview ? null : <ChevronDown className={expanded ? "is-open" : undefined} size={19} />}
      </button>
      <div className={expanded || preview ? "juz-path__items" : "juz-path__items is-preview"}>
        {(expanded ? surahs : preview ? surahs.slice(0, 2) : []).map((surah) => {
          const reviewIndex = reviewGroups.findIndex((group) => group.at(-1) === surah.number);
          const reviewGroup = reviewIndex >= 0 ? reviewGroups[reviewIndex] : null;
          const reviewReached = !preview && reviewGroup?.every((number) => bySurah.get(number)?.status === "mastered");
          return <Fragment key={surah.number}><SurahNode surah={surah} item={bySurah.get(surah.number)} unlocked={!preview && (surah.number === nextSurah || bySurah.get(surah.number)?.status === "mastered")} locale={locale} />{reviewReached && reviewGroup ? <ReviewCheckpoint index={reviewIndex} group={reviewGroup} /> : null}</Fragment>;
        })}
        {expanded && readyForExam ? <JuzExamNode juz={juz.number} passed={passed} score={bestScores.get(juz.number)} locale={locale} /> : null}
        {!expanded ? <p>{passed ? t("اضغط لعرض السور", "Afficher les sourates") : t("أتم الجزء الحالي أولاً", "Termine d'abord le Juz actuel")}</p> : null}
      </div>
    </section>;
  })}</div>;
}

function juzPassageLabel(juzNumber: number, locale: StudentLocale): string {
  const passages = getJuzPassages(juzNumber);
  const first = passages.at(-1);
  const last = passages[0];
  if (!first || !last) return "";
  const firstSurah = getSurah(first.surahNumber)?.nameArabic ?? String(first.surahNumber);
  const lastSurah = getSurah(last.surahNumber)?.nameArabic ?? String(last.surahNumber);
  return first.surahNumber === last.surahNumber
    ? `${firstSurah} · ${locale === "fr" ? "versets" : "الآيات"} ${first.verseFrom}–${last.verseTo}`
    : locale === "fr" ? `${lastSurah} à ${firstSurah}` : `من ${lastSurah} إلى ${firstSurah}`;
}

function JuzExamNode({ juz, passed, score, locale }: { juz: number; passed: boolean; score: number | undefined; locale: StudentLocale }) {
  const t = (ar: string, fr: string) => studentText(locale, ar, fr);
  return <Link href={`/student/quran/juz/${juz}`} className={`surah-node juz-exam-node ${passed ? "is-complete" : ""}`}>
    <span className="surah-node__dot is-mastered">{passed ? <Award size={16} /> : <LockKeyholeOpen size={16} />}</span><span className="surah-node__line" />
    <span className="surah-node__card"><strong>{passed ? t("مراجعة اختبار الجزء", "Revoir l'examen du Juz") : t("اختبار نهاية الجزء", "Examen de fin de Juz")}</strong><small>{passed ? `${t("أفضل نتيجة", "Meilleur score")} ${score ?? 80}%` : t("10 أسئلة · النجاح من 80%", "10 questions · réussite à 80 %")}</small><em>{passed ? t("ناجح", "Réussi") : t("جاهز", "Prêt")}</em></span>
  </Link>;
}

function SurahNode({ surah, item, unlocked, locale }: { surah: NonNullable<ReturnType<typeof getSurah>>; item: StudentDashboardData["progress"][number] | undefined; unlocked: boolean; locale: StudentLocale }) {
  const status = item?.status ?? "not_started";
  const t = (ar: string, fr: string) => studentText(locale, ar, fr);
  const content = <><span className={`surah-node__dot is-${status}`}>{status === "mastered" ? <ArrowLeft size={16} /> : unlocked ? <LockKeyholeOpen size={16} /> : <LockKeyhole size={15} />}</span><span className="surah-node__line" /><span className="surah-node__card"><strong>{surah.nameArabic}</strong><small>{surah.verseCount} {t("آيات", "versets")}</small>{status === "mastered" ? <em>{t("مكتملة", "Terminée")}</em> : status === "in_progress" ? <em>{t("تابع", "Continuer")}</em> : null}</span></>;
  return unlocked || status === "mastered" ? <Link href={`/student/quran/${surah.slug}`} className="surah-node">{content}</Link> : <div className="surah-node is-disabled" aria-disabled="true">{content}</div>;
}
