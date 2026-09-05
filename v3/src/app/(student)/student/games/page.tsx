import { AppShell } from "@/components/shell";
import { getStudentDashboard } from "@/features/learning/repository";
import { StudentGames } from "@/features/learning/student-extensions";
export default async function StudentGamesPage() { const data = await getStudentDashboard(); return <AppShell kind="student"><StudentGames unlocked={data.progress.filter((item) => item.status !== "not_started").map((item) => item.surahNumber)} /></AppShell>; }
