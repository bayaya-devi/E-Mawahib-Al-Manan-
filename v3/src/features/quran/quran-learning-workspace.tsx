"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, Headphones, Pause, Play, Repeat2, Volume2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { LearningExercise } from "./learning-exercise";
import { type LearningState } from "./learning-plan";
import { setQuranRecitationActive } from "@/features/settings/interaction-feedback";

import type { QuranSurah } from "./canonical";
import { getWarshAudioUrl, getWarshFallbackAudioUrl, WARSH_RIWAYA } from "./canonical";



export function QuranLearningWorkspace({ surah }: { surah: QuranSurah }) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);

  const [current, setCurrent] = useState(0); const [playing, setPlaying] = useState(false); const [playAll, setPlayAll] = useState(true); const [fallback, setFallback] = useState(false); const [autoplayBlocked, setAutoplayBlocked] = useState(false); const [audioError, setAudioError] = useState(false); const [loadingAudio, setLoadingAudio] = useState(true); const [listened, setListened] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [audioStep, setAudioStep] = useState(true);
  const [completed, setCompleted] = useState(false);
  const finalStep = cursor >= 4;
  const start = 0;
  const finish = surah.verseCount;
  const selectedIndex = Math.max(start, Math.min(current, finish - 1));
  const verse = surah.verses[selectedIndex]!;
  const source = fallback ? getWarshFallbackAudioUrl(verse.audioCode) : getWarshAudioUrl(verse.audioCode);
  const onState = useCallback((state: LearningState) => {
    setCursor(state.cursor); setCompleted(state.passed);
  }, []);
  useEffect(() => {
    const player = audio.current; if (!player) return;
    let live = true;
    if (!audioStep) return;
    player.load();
    void player.play().then(() => { if (live) { setPlaying(true); setAutoplayBlocked(false); } }).catch(() => { if (live) { setPlaying(false); setAutoplayBlocked(true); } });
    return () => { live = false; player.pause(); setQuranRecitationActive(false); };
  }, [source, audioStep]);
  function play() { setAudioError(false); void audio.current?.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true)); }
  function toggle(): void { if (audio.current?.paused) play(); else audio.current?.pause(); }
  function ended(): void { setQuranRecitationActive(false); setListened(value => new Set(value).add(verse.number)); if (playAll && selectedIndex < finish - 1) { setFallback(false); setCurrent(selectedIndex + 1); } else setPlaying(false); }
  return <div className="quran-workspace student-surah-workspace">
    <header className="student-surah-head"><div><span>{WARSH_RIWAYA}</span><h1>{surah.nameArabic}</h1><small>{surah.verseCount} آيات</small></div><div className="student-stepper" aria-label="مراحل السورة">{[0,1,2,3,4,5].map(index => { const activeIndex = finalStep ? 5 : audioStep ? 0 : cursor + 1; return <span key={index} className={completed || index < activeIndex ? "is-done" : index === activeIndex ? "is-current" : ""}>{completed ? <CheckCircle2 size={15} /> : index + 1}</span>; })}</div></header>
    {audioStep ? <>
      <section className="audio-console student-audio-console" aria-labelledby="listen-title"><div className="audio-console__head"><div><Headphones size={21} /><span><strong id="listen-title">استمع</strong><small>الآية {verse.number} من {surah.verseCount}</small></span></div><span>{listened.size}/{finish - start}</span></div><audio ref={audio} src={source} preload="auto" onLoadStart={() => setLoadingAudio(true)} onCanPlay={() => setLoadingAudio(false)} onPlay={() => { setPlaying(true); setQuranRecitationActive(true); }} onPause={() => { setPlaying(false); setQuranRecitationActive(false); }} onEnded={ended} onError={() => { if (!fallback) setFallback(true); else { setPlaying(false); setLoadingAudio(false); setAudioError(true); } }} /><div className="audio-controls"><Button variant="quiet" size="icon" aria-label="الآية السابقة" disabled={selectedIndex === start} onClick={() => setCurrent(selectedIndex - 1)}><ChevronRight /></Button><Button size="icon" aria-label={playing ? "إيقاف مؤقت" : "تشغيل"} loading={loadingAudio} onClick={toggle}>{playing ? <Pause /> : <Play />}</Button><Button variant="quiet" size="icon" aria-label="الآية التالية" disabled={selectedIndex === finish - 1} onClick={() => setCurrent(selectedIndex + 1)}><ChevronLeft /></Button><Button variant={playAll ? "secondary" : "quiet"} onClick={() => { setPlayAll(true); setCurrent(start); setFallback(false); if (selectedIndex === start && audio.current) { audio.current.currentTime = 0; play(); } }}><Volume2 size={18} />قراءة الكل</Button><Button variant="quiet" onClick={() => { if (audio.current) audio.current.currentTime = 0; play(); }}><Repeat2 size={17} />إعادة</Button></div>{autoplayBlocked ? <p className="audio-notice">اضغط تشغيل للاستماع.</p> : null}{audioError ? <p className="audio-notice" role="alert">تعذر تحميل الصوت. تحقق من الاتصال ثم أعد المحاولة.</p> : null}</section>
      <section className="verse-reader" aria-label="آيات السورة">{surah.verses.slice(start, finish).map((item, offset) => <button key={item.number} type="button" className={item.number - 1 === selectedIndex ? "is-current" : undefined} onClick={() => { setCurrent(start + offset); setPlayAll(false); setFallback(false); if (selectedIndex === start + offset && audio.current) { audio.current.currentTime = 0; play(); } }}><span>{item.number}</span><p>{item.text}</p>{listened.has(item.number) ? <BookOpenCheck size={17} /> : <Play size={15} />}</button>)}</section>
      <div className="student-learning-actions"><ButtonLink href="/student/quran" variant="quiet">رجوع</ButtonLink><Button onClick={() => { audio.current?.pause(); setAudioStep(false); }}>متابعة</Button></div>
    </> : null}
    <div hidden={audioStep}><LearningExercise learningKey={`surah-${surah.number}`} onState={onState} /></div>
    {completed ? <Button onClick={() => { router.push("/student/quran"); router.refresh(); }}>العودة إلى المسار</Button> : null}
  </div>;
}
