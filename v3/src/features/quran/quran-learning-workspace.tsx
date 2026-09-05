"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, Headphones, LockKeyhole, Pause, Play, Repeat2, RotateCcw, Volume2 } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { createQuranRound, isCorrect, type QuranGameKind } from "@/features/games/engine";
import { createClient } from "@/lib/supabase/client";
import type { QuranSurah } from "./canonical";
import { getWarshAudioUrl, getWarshFallbackAudioUrl, WARSH_RIWAYA } from "./canonical";

const STEPS: readonly { kind: QuranGameKind; title: string }[] = [
  { kind: "missing_word", title: "الكلمة الناقصة" }, { kind: "next_verse", title: "الآية التالية" }, { kind: "match_edges", title: "أكمل الآية" }, { kind: "flash_memory", title: "تثبيت الحفظ" },
];

export function QuranLearningWorkspace({ surah }: { surah: QuranSurah }) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const { showToast } = useToast();
  const [current, setCurrent] = useState(0); const [playing, setPlaying] = useState(false); const [playAll, setPlayAll] = useState(true); const [fallback, setFallback] = useState(false); const [autoplayBlocked, setAutoplayBlocked] = useState(false); const [listened, setListened] = useState<Set<number>>(new Set());
  const [step, setStep] = useState(0); const [seed, setSeed] = useState(1); const [errors, setErrors] = useState(0); const [completed, setCompleted] = useState(false); const [saving, setSaving] = useState(false);
  const verse = surah.verses[current]!; const source = fallback ? getWarshFallbackAudioUrl(verse.audioCode) : getWarshAudioUrl(verse.audioCode); const finalStep = step === STEPS.length;
  const round = useMemo(() => createQuranRound(surah, finalStep ? "listen_identify" : STEPS[step]?.kind ?? "missing_word", seed), [surah, step, seed, finalStep]);
  useEffect(() => { const player = audio.current; if (!player) return; player.load(); void player.play().then(() => { setPlaying(true); setAutoplayBlocked(false); }).catch(() => { setPlaying(false); setAutoplayBlocked(true); }); }, [source]);
  function toggle(): void { const player = audio.current; if (!player) return; if (player.paused) void player.play().then(() => { setPlaying(true); setAutoplayBlocked(false); }); else { player.pause(); setPlaying(false); } }
  function ended(): void { setListened((value) => new Set(value).add(verse.number)); if (playAll && current < surah.verses.length - 1) setCurrent((value) => value + 1); else setPlaying(false); }
  async function answer(option: string): Promise<void> {
    if (!round || saving || completed) return;
    if (!isCorrect(round, option)) { if (!errors) { setErrors(1); showToast({ title: "حاول مرة أخرى", description: "تبقى لك محاولة واحدة." }); } else { setErrors(0); setSeed((value) => value + 13); showToast({ title: "أعد هذا التمرين", description: "لا يمكن فتح التمرين التالي قبل إتقانه." }); } return; }
    setErrors(0); if (!finalStep) { setStep((value) => value + 1); setSeed((value) => value + 7); return; }
    setSaving(true); const client = createClient(); const { error } = await client.rpc("complete_quran_surah", { target_surah_number: surah.number }); setSaving(false);
    if (error) { showToast({ title: "تعذر إتمام السورة", description: "أعد الاختبار بعد لحظات." }); return; }
    setCompleted(true); showToast({ title: "أحسنت", description: "تم حفظ تقدمك وفتح السورة التالية.", tone: "success" });
  }
  return <div className="quran-workspace student-surah-workspace">
    <header className="student-surah-head"><div><span>{WARSH_RIWAYA}</span><h1>{surah.nameArabic}</h1><small>{surah.verseCount} آيات</small></div><div className="student-stepper" aria-label="مراحل السورة">{[...STEPS, { title: "اختبار" }].map((item, index) => <span key={item.title} className={index < step || completed ? "is-done" : index === step ? "is-current" : ""}>{index < step || completed ? <CheckCircle2 size={15} /> : index + 1}</span>)}</div></header>
    <section className="audio-console student-audio-console" aria-labelledby="listen-title"><div className="audio-console__head"><div><Headphones size={21} /><span><strong id="listen-title">استمع</strong><small>الآية {verse.number} من {surah.verseCount}</small></span></div><span>{listened.size}/{surah.verseCount}</span></div><audio ref={audio} src={source} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={ended} onError={() => { if (!fallback) setFallback(true); else setPlaying(false); }} /><div className="audio-controls"><Button variant="quiet" size="icon" aria-label="الآية السابقة" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}><ChevronRight /></Button><Button size="icon" aria-label={playing ? "إيقاف مؤقت" : "تشغيل"} onClick={toggle}>{playing ? <Pause /> : <Play />}</Button><Button variant="quiet" size="icon" aria-label="الآية التالية" disabled={current === surah.verses.length - 1} onClick={() => setCurrent((value) => value + 1)}><ChevronLeft /></Button><Button variant={playAll ? "secondary" : "quiet"} onClick={() => { setPlayAll(true); setCurrent(0); }}><Volume2 size={18} />قراءة الكل</Button><Button variant="quiet" onClick={() => { audio.current?.play().catch(() => setAutoplayBlocked(true)); }}><Repeat2 size={17} />إعادة</Button></div>{autoplayBlocked ? <p className="audio-notice">اضغط تشغيل للاستماع.</p> : null}</section>
    <section className="verse-reader" aria-label="آيات السورة">{surah.verses.map((item, index) => <button key={item.number} type="button" className={index === current ? "is-current" : undefined} onClick={() => { setCurrent(index); setPlayAll(false); setFallback(false); }}><span>{item.number}</span><p>{item.text}</p>{listened.has(item.number) ? <BookOpenCheck size={17} /> : <Play size={15} />}</button>)}</section>
    <section className="student-exercise" aria-live="polite">{completed ? <><CheckCircle2 size={36} /><h2>تم إتقان السورة</h2><Button onClick={() => router.push("/student/quran")}>العودة إلى المسار</Button></> : round ? <><div className="student-exercise__title"><span>{finalStep ? "الاختبار الأخير" : `التمرين ${step + 1} من 4`}</span><h2>{finalStep ? "اختبر حفظك" : STEPS[step]?.title}</h2>{errors ? <small>محاولة أخيرة</small> : null}</div><p>{round.prompt}</p><div className="student-exercise__options">{round.options.map((option) => <button type="button" key={option} disabled={saving} onClick={() => void answer(option)}>{option}</button>)}</div><Button variant="quiet" onClick={() => { setErrors(0); setSeed((value) => value + 1); }}><RotateCcw size={17} />تمرين جديد</Button></> : <LockKeyhole />}</section>
  </div>;
}
