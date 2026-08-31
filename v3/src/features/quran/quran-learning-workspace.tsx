"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Brain, ChevronLeft, ChevronRight, Headphones, Mic, Pause, Play, Repeat2, RotateCcw, Volume2 } from "lucide-react";
import { Badge, Button, useToast } from "@/components/ui";
import { createQuranRound, isCorrect, type QuranGameKind } from "@/features/games/engine";
import { analyseMemorization } from "@/features/recitation/memorization-analysis";
import { acousticTajwidCapability } from "@/features/recitation/tajwid-capability";
import { startBrowserAsr, type BrowserAsrController } from "@/features/recitation/browser-asr";
import { createClient } from "@/lib/supabase/client";
import type { QuranSurah } from "./canonical";
import { getWarshAudioUrl, getWarshFallbackAudioUrl, WARSH_RECITER, WARSH_RIWAYA } from "./canonical";

export function QuranLearningWorkspace({ surah }: { surah: QuranSurah }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playAll, setPlayAll] = useState(true);
  const [repeat, setRepeat] = useState(1);
  const [repeatRun, setRepeatRun] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [listened, setListened] = useState<Set<number>>(new Set());
  const verse = surah.verses[current]!;
  const source = fallback ? getWarshFallbackAudioUrl(verse.audioCode) : getWarshAudioUrl(verse.audioCode);

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    player.load();
    void player.play().then(() => { setPlaying(true); setAutoplayBlocked(false); }).catch(() => { setPlaying(false); setAutoplayBlocked(true); });
  }, [source]);

  function toggle(): void {
    const player = audio.current;
    if (!player) return;
    if (player.paused) void player.play().then(() => { setPlaying(true); setAutoplayBlocked(false); });
    else { player.pause(); setPlaying(false); }
  }

  function handleEnded(): void {
    setListened((previous) => new Set(previous).add(verse.number));
    if (repeatRun + 1 < repeat) { setRepeatRun((value) => value + 1); audio.current?.play().catch(() => setAutoplayBlocked(true)); return; }
    setRepeatRun(0);
    if (playAll && current < surah.verses.length - 1) setCurrent((value) => value + 1);
    else setPlaying(false);
  }

  function selectVerse(index: number): void { setCurrent(index); setPlayAll(false); setFallback(false); setRepeatRun(0); }

  return <div className="quran-workspace">
    <header className="surah-head"><div><Badge tone="brand">{surah.revelationType}</Badge><h1>{surah.nameArabic}</h1><p>{surah.nameLatin} · {surah.verseCount} آيات</p></div><div className="surah-head__meta"><span>{WARSH_RIWAYA}</span><strong>{WARSH_RECITER}</strong></div></header>

    <section className="audio-console" aria-labelledby="listen-title">
      <div className="audio-console__head"><div><Headphones size={21} /><span><strong id="listen-title">الاستماع</strong><small>الآية {verse.number} من {surah.verseCount}</small></span></div><span>{listened.size}/{surah.verseCount}</span></div>
      <audio ref={audio} src={source} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={handleEnded} onError={() => { if (!fallback) setFallback(true); else setPlaying(false); }} />
      <div className="audio-controls">
        <Button variant="quiet" size="icon" aria-label="الآية السابقة" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}><ChevronRight /></Button>
        <Button size="icon" aria-label={playing ? "إيقاف مؤقت" : "تشغيل"} onClick={toggle}>{playing ? <Pause /> : <Play />}</Button>
        <Button variant="quiet" size="icon" aria-label="الآية التالية" disabled={current === surah.verses.length - 1} onClick={() => setCurrent((value) => value + 1)}><ChevronLeft /></Button>
        <Button variant={playAll ? "secondary" : "quiet"} onClick={() => { setPlayAll(true); setCurrent(0); }}><Volume2 size={18} />قراءة الكل</Button>
        <label className="repeat-control"><Repeat2 size={17} /><span>التكرار</span><select value={repeat} onChange={(event) => setRepeat(Number(event.target.value))}><option value="1">1</option><option value="3">3</option><option value="5">5</option></select></label>
      </div>
      {autoplayBlocked ? <p className="audio-notice">منع المتصفح التشغيل التلقائي. اضغط زر التشغيل مرة واحدة.</p> : null}
    </section>

    <section className="verse-reader" aria-label="آيات السورة">{surah.verses.map((item, index) => <button key={item.number} type="button" className={index === current ? "is-current" : undefined} onClick={() => selectVerse(index)}><span>{item.number}</span><p>{item.text}</p>{listened.has(item.number) ? <BookOpenCheck size={17} /> : <Play size={15} />}</button>)}</section>
    <div className="practice-grid"><GamePractice surah={surah} /><RecitationPractice surah={surah} /></div>
  </div>;
}

function GamePractice({ surah }: { surah: QuranSurah }) {
  const kinds: Array<{ kind: QuranGameKind; label: string }> = [
    { kind: "verse_order", label: "ترتيب الآية" }, { kind: "next_verse", label: "الآية التالية" },
    { kind: "missing_word", label: "الكلمة الناقصة" }, { kind: "match_edges", label: "ربط البداية والنهاية" },
    { kind: "listen_identify", label: "استمع وحدد" }, { kind: "flash_memory", label: "حفظ سريع" },
  ];
  const [kind, setKind] = useState<QuranGameKind>("missing_word");
  const [seed, setSeed] = useState(1);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [recordedOutcome, setRecordedOutcome] = useState<"none" | "wrong" | "correct">("none");
  const round = useMemo(() => createQuranRound(surah, kind, seed), [surah, kind, seed]);
  function answer(option: string): void {
    if (!round) return;
    const correct = isCorrect(round, option);
    setResult(correct ? "correct" : "wrong");
    if ((correct && recordedOutcome !== "correct") || (!correct && recordedOutcome === "none")) {
      setRecordedOutcome(correct ? "correct" : "wrong");
      void createClient().rpc("record_quran_practice", { target_surah_number: surah.number, target_verse_number: round.verseNumber || 1, target_success: correct });
    }
  }
  return <section className="practice-panel"><div className="section-heading"><div><span>تدريب</span><h2><Brain size={20} />تمارين الحفظ</h2></div></div><div className="practice-tabs">{kinds.map((item) => <button className={kind === item.kind ? "is-active" : undefined} key={item.kind} onClick={() => { setKind(item.kind); setResult("idle"); setRecordedOutcome("none"); }}>{item.label}</button>)}</div>{round ? <div className="game-round"><p>{round.prompt}</p><div>{round.options.map((option) => <button key={option} onClick={() => answer(option)}>{option}</button>)}</div>{result !== "idle" ? <p className={result === "correct" ? "answer-correct" : "answer-wrong"}>{result === "correct" ? "إجابة صحيحة" : "حاول مرة أخرى"}</p> : null}<Button variant="quiet" onClick={() => { setSeed((value) => value + 1); setResult("idle"); setRecordedOutcome("none"); }}><RotateCcw size={17} />تدريب جديد</Button></div> : null}</section>;
}

function RecitationPractice({ surah }: { surah: QuranSurah }) {
  const { showToast } = useToast();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [asrError, setAsrError] = useState<string | null>(null);
  const recognition = useRef<BrowserAsrController | null>(null);
  const expected = surah.verses.map(({ text }) => text).join(" ");
  const analysis = transcript ? analyseMemorization(expected, transcript, confidence) : null;

  function start(): void {
    setAsrError(null);
    recognition.current = startBrowserAsr({
      onTranscript: (text, score) => { setTranscript(text); if (score !== undefined) setConfidence(score); },
      onUnavailable: () => { setAsrError("التعرف الصوتي غير متاح في هذا المتصفح."); setListening(false); },
      onError: () => { setAsrError("تعذر فهم الصوت. تحقق من إذن الميكروفون وحاول في مكان هادئ."); },
      onEnd: () => setListening(false),
    });
    setListening(Boolean(recognition.current));
  }
  function stop(): void { recognition.current?.stop(); setListening(false); }

  async function save(): Promise<void> {
    if (!analysis || !transcript) return;
    setSaving(true);
    const { error } = await createClient().rpc("record_recitation_attempt", {
      target_surah_number: surah.number,
      target_verse_from: 1,
      target_verse_to: surah.verseCount,
      target_transcript: transcript,
      target_confidence: confidence ?? null,
      target_score: analysis.score,
      target_matched_words: analysis.matchedWords,
      target_expected_words: analysis.expectedWords,
      target_conclusive: analysis.conclusive,
      target_recommendation: analysis.recommendation,
      target_errors: analysis.errors.map((item) => ({ ...item })),
    });
    setSaving(false);
    showToast(error ? { title: "تعذر حفظ المحاولة", description: "لم تُفقد النتيجة المعروضة. حاول الحفظ عند عودة الاتصال." } : { title: "تم حفظ المحاولة", tone: "success" });
  }

  return <section className="practice-panel"><div className="section-heading"><div><span>اختياري</span><h2><Mic size={20} />الأستاذ الرقمي</h2></div></div><p>يساعدك في مراجعة الحفظ من النص المسموع. لا يقيّم أحكام التجويد الصوتية.</p><Button onClick={listening ? stop : start}>{listening ? <Pause size={18} /> : <Mic size={18} />}{listening ? "إنهاء التسميع" : "بدء التسميع"}</Button>{asrError ? <p className="audio-notice">{asrError}</p> : null}{transcript ? <div className="recitation-result"><span>النص المسموع</span><p>{transcript}</p>{analysis ? <><strong>{analysis.conclusive ? `${analysis.score}/10` : "النتيجة غير حاسمة"}</strong><p>{analysis.recommendation}</p><Button variant="secondary" loading={saving} onClick={() => void save()}>حفظ المحاولة</Button></> : null}</div> : null}<small className="tajwid-note">{acousticTajwidCapability.explanation}</small></section>;
}
