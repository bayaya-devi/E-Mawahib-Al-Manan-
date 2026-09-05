"use client";

import { ArrowLeft, ChevronDown, LockKeyhole, LockKeyholeOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { reviewGroups } from './learning-plan';
import { ReviewCheckpoint } from './review-checkpoint';
import { getAllSurahs } from "./canonical";
import type { StudentDashboardData } from "@/features/learning/models";

export type Juz = { number: number; name: string; from: number; to: number };
export const JUZ: readonly Juz[] = [
  { number: 30, name: "جزء عمّ", from: 78, to: 114 }, { number: 29, name: "جزء تبارك", from: 67, to: 77 }, { number: 28, name: "جزء قد سمع", from: 58, to: 66 }, { number: 27, name: "جزء قال فما خطبكم", from: 51, to: 57 }, { number: 26, name: "جزء حم", from: 46, to: 50 }, { number: 25, name: "جزء إليه يرد", from: 41, to: 45 }, { number: 24, name: "جزء فمن أظلم", from: 39, to: 41 }, { number: 23, name: "جزء وما لي", from: 36, to: 39 }, { number: 22, name: "جزء ومن يقنت", from: 33, to: 36 }, { number: 21, name: "جزء اتل ما أوحي", from: 29, to: 33 }, { number: 20, name: "جزء أمن خلق", from: 27, to: 29 }, { number: 19, name: "جزء قال الذين", from: 25, to: 27 }, { number: 18, name: "جزء قد أفلح", from: 23, to: 25 }, { number: 17, name: "جزء اقترب", from: 21, to: 23 }, { number: 16, name: "جزء قال ألم", from: 18, to: 21 }, { number: 15, name: "جزء سبحان الذي", from: 17, to: 18 }, { number: 14, name: "جزء ربّما", from: 15, to: 17 }, { number: 13, name: "جزء وما أبرئ", from: 12, to: 15 }, { number: 12, name: "جزء وما من دابة", from: 11, to: 12 }, { number: 11, name: "جزء يعتذر", from: 9, to: 11 }, { number: 10, name: "جزء واعلموا", from: 8, to: 9 }, { number: 9, name: "جزء قال الملأ", from: 7, to: 8 }, { number: 8, name: "جزء ولو أننا", from: 6, to: 7 }, { number: 7, name: "جزء وإذا سمعوا", from: 5, to: 6 }, { number: 6, name: "جزء لا يحب الله", from: 4, to: 5 }, { number: 5, name: "جزء والمحصنات", from: 4, to: 4 }, { number: 4, name: "جزء لن تنالوا", from: 3, to: 4 }, { number: 3, name: "جزء تلك الرسل", from: 2, to: 3 }, { number: 2, name: "جزء سيقول", from: 2, to: 2 }, { number: 1, name: "جزء الحمد", from: 1, to: 2 },
];

export function QuranCatalog({ progress }: { progress: StudentDashboardData["progress"] }) {
  const [openJuz, setOpenJuz] = useState<number | null>(null);
  const bySurah = useMemo(() => new Map(progress.map((item) => [item.surahNumber, item])), [progress]);
  const ordered = useMemo(() => [...getAllSurahs()].reverse(), []);
  const next = ordered.find((surah) => bySurah.get(surah.number)?.status !== "mastered")?.number ?? 1;
  const activeJuz = JUZ.find((juz) => next >= juz.from && next <= juz.to)?.number ?? 1;
  const activeIndex = JUZ.findIndex((juz) => juz.number === activeJuz);
  return <div className="student-quran-path">{JUZ.map((juz, index) => {
    const surahs = ordered.filter((surah) => surah.number >= juz.from && surah.number <= juz.to);
    const complete = surahs.every((surah) => bySurah.get(surah.number)?.status === "mastered");
    const active = juz.number === activeJuz;
    const preview = index === activeIndex + 1;
    const future = !complete && !active;
    if (future && !preview) return null;
    const expanded = active || openJuz === juz.number;
    return <section className={`juz-path ${active ? "is-active" : ""} ${complete ? "is-complete" : ""} ${preview ? "is-locked" : ""}`} key={juz.number}>
      <button type="button" className="juz-path__head" disabled={preview} onClick={() => setOpenJuz((value) => value === juz.number ? null : juz.number)} aria-expanded={expanded}>
        <span className="juz-path__marker">{complete ? <ArrowLeft size={17} /> : preview ? <LockKeyhole size={16} /> : <Sparkles size={17} />}</span><span><strong>{juz.name}</strong><small>من السورة {juz.to} إلى السورة {juz.from}</small></span>{preview ? null : <ChevronDown className={expanded ? "is-open" : undefined} size={19} />}
      </button>
      <div className={expanded || preview ? "juz-path__items" : "juz-path__items is-preview"}>
        {(expanded ? surahs : preview ? surahs.slice(0, 2) : []).map((surah) => { const groupIndex = reviewGroups.findIndex(group => group.at(-1) === surah.number); const group = reviewGroups[groupIndex]; return <Fragment key={surah.number}><SurahNode surah={surah} item={bySurah.get(surah.number)} unlocked={!preview && surah.number >= next} />{!preview && group && group.every(n => bySurah.get(n)?.status === 'mastered') ? <ReviewCheckpoint index={groupIndex} group={group} /> : null}</Fragment>; })}
        {!expanded ? <p>{complete ? "اضغط لعرض السور" : "أتم الجزء الحالي أولاً"}</p> : null}
      </div>
    </section>;
  })}</div>;
}

function SurahNode({ surah, item, unlocked }: { surah: ReturnType<typeof getAllSurahs>[number]; item: StudentDashboardData["progress"][number] | undefined; unlocked: boolean }) {
  const status = item?.status ?? "not_started";
  const content = <><span className={`surah-node__dot is-${status}`}>{status === "mastered" ? <ArrowLeft size={16} /> : unlocked ? <LockKeyholeOpen size={16} /> : <LockKeyhole size={15} />}</span><span className="surah-node__line" /><span className="surah-node__card"><strong>{surah.nameArabic}</strong><small>{surah.verseCount} آيات</small>{status === "mastered" ? <em>مكتملة</em> : status === "in_progress" ? <em>تابع</em> : null}</span></>;
  return unlocked || status === "mastered" ? <Link href={`/student/quran/${surah.slug}`} className="surah-node">{content}</Link> : <div className="surah-node is-disabled" aria-disabled="true">{content}</div>;
}
