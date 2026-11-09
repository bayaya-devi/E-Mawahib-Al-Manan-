import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell";
import { LearningExercise } from "@/features/quran/learning-exercise";

type PageProps = { params: Promise<{ juz: string }> };

export const metadata: Metadata = { title: "اختبار الجزء" };

export default async function StudentJuzExamPage({ params }: PageProps) {
  const juz = Number((await params).juz);
  if (!Number.isInteger(juz) || juz < 1 || juz > 30) notFound();
  return <AppShell kind="student"><div className="learning-page student-juz-exam"><header className="student-page-head"><span>اختبار شامل</span><h1>اختبار الجزء {juz}</h1><p>عشرة أسئلة متنوعة. النجاح من 80% ويمكنك إعادة المحاولة.</p></header><LearningExercise learningKey={`juz-${juz}`} /></div></AppShell>;
}
