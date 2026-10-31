import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSurah } from "@/features/quran/canonical";
import { QuranLearningWorkspace } from "@/features/quran/quran-learning-workspace";

type PageProps = { params: Promise<{ surah: string }> };
export async function generateMetadata({ params }: PageProps): Promise<Metadata> { const item = getSurah((await params).surah); return { title: item?.nameArabic ?? "السورة" }; }
export default async function SurahPage({ params }: PageProps) { const item = getSurah((await params).surah); if (!item) notFound(); return <AppShell kind="student"><QuranLearningWorkspace key={item.number} surah={item} /></AppShell>; }
