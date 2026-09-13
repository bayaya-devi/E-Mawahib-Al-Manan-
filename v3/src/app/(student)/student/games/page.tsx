import { AppShell } from "@/components/shell";
import { getStudentDashboard } from "@/features/learning/repository";
import { StudentGames } from "@/features/learning/student-extensions";
import { getAllSurahs } from "@/features/quran/canonical";
export const dynamic = "force-dynamic";
export default async function StudentGamesPage() { const data = await getStudentDashboard(); const bySurah = new Map(data.progress.map((item) => [item.surahNumber, item.status])); const current = [...getAllSurahs()].reverse().find((surah) => bySurah.get(surah.number) !== "mastered")?.number ?? 1; const playable = getAllSurahs().filter((surah) => surah.number >= current).map((surah) => surah.number); return <AppShell kind="student"><StudentGames unlocked={playable} /></AppShell>; }
