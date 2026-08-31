import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getStudentDashboard } from "@/features/learning/repository";
import { QuranCatalog } from "@/features/quran/quran-catalog";

export const metadata: Metadata = { title: "مسار القرآن" };
export const dynamic = "force-dynamic";
export default async function QuranPage() {
  const data = await getStudentDashboard();
  return <AppShell kind="student"><div className="learning-page"><header className="simple-page-head"><span>114 سورة</span><h1>مسار القرآن الكريم</h1><p>اختر السورة، واستمع إلى رواية ورش، ثم تابع الحفظ والمراجعة.</p></header><QuranCatalog progress={data.progress} /></div></AppShell>;
}
