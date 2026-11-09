import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getStudentDashboard } from "@/features/learning/repository";
import { QuranCatalog } from "@/features/quran/quran-catalog";
import { getActiveStudentLocale } from "@/features/learning/student-context";

export const metadata: Metadata = { title: "مسار القرآن" };
export const dynamic = "force-dynamic";
export default async function QuranPage() {
  const [data, locale] = await Promise.all([getStudentDashboard(), getActiveStudentLocale()]);
  return <AppShell kind="student"><div className="learning-page student-quran-page"><header className="student-page-head"><h1>{locale === "fr" ? "Parcours des sourates" : "مسار السور"}</h1></header><QuranCatalog progress={data.progress} juzExams={data.juzExams} /></div></AppShell>;
}
