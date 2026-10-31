import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { getStudentDashboard } from "@/features/learning/repository";
import { QuranCatalog } from "@/features/quran/quran-catalog";

export const metadata: Metadata = { title: "مسار القرآن" };
export const dynamic = "force-dynamic";
export default async function QuranPage() {
  const data = await getStudentDashboard();
  return <AppShell kind="student"><div className="learning-page student-quran-page"><header className="student-page-head"><h1>مسار السور</h1></header><QuranCatalog progress={data.progress} /></div></AppShell>;
}
