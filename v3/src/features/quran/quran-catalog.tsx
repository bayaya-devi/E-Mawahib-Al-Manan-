import { BookOpenText, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { getAllSurahs } from "./canonical";
import type { StudentDashboardData } from "@/features/learning/models";

export function QuranCatalog({ progress }: { progress: StudentDashboardData["progress"] }) {
  const bySurah = new Map(progress.map((item) => [item.surahNumber, item]));
  return <div className="quran-catalog">{[...getAllSurahs()].reverse().map((surah) => {
    const item = bySurah.get(surah.number);
    const status = item?.status ?? "not_started";
    return <Link className="surah-row" href={`/student/quran/${surah.slug}`} key={surah.number}>
      <span className={`surah-row__status is-${status}`}>{status === "mastered" ? <Check size={18} /> : status === "not_started" ? <LockKeyhole size={17} /> : <BookOpenText size={18} />}</span>
      <span className="surah-row__number">{surah.number}</span>
      <span><strong>{surah.nameArabic}</strong><small>{surah.nameLatin} · {surah.verseCount} آيات</small></span>
      <span className="surah-row__progress">{item ? `${item.percent}%` : "ابدأ"}</span>
    </Link>;
  })}</div>;
}

