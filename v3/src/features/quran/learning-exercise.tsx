"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import type { LearningState } from './learning-plan';
import { emitLearningFeedback, primeLearningFeedback } from '@/features/settings/interaction-feedback';
type View = { state: LearningState; version: number; round: { kind: string; prompt: string; options: string[]; verseNumber: number } | null; finalStart: number; total: number; questionTotal: number; answerCorrect?: boolean | null };
export function LearningExercise({ learningKey, rewardStars, onState }: { learningKey: string; rewardStars?: number; onState?: (state: LearningState, finalStart: number) => void }) {
  const [data, setData] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [words, setWords] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "error" | null>(null);
  const [showResult, setShowResult] = useState(false);
  const callback = useRef(onState);
  useEffect(() => { callback.current = onState; }, [onState]);
  const lock = useRef(false);
  const load = useCallback(() => {
    return fetch(`/api/student/learning?key=${learningKey}`, { cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error(); const value: View = await response.json(); setData(value); callback.current?.(value.state, value.finalStart); setError(false); }).catch(() => setError(true));
  }, [learningKey]);
  useEffect(() => { void load(); }, [load]);
  async function submit(answer?: string, retry = false) {
    if (!data || lock.current) return; primeLearningFeedback(); lock.current = true; setBusy(true);
    try {
      const response = await fetch('/api/student/learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: learningKey, version: data.version, answer, retry }) });
      if (response.status === 409) { await load(); return; }
      if (!response.ok) throw new Error();
      const value: View = await response.json();
      if (!retry) {
        const correct = value.answerCorrect === true;
        setFeedback(correct ? "correct" : "error"); emitLearningFeedback(correct ? "correct" : "error");
        window.setTimeout(() => setFeedback(null), 500);
        if (value.state.lastResult?.passed) { setShowResult(true); emitLearningFeedback(value.state.passed ? "important" : "complete"); }
      }
      setData(value); setWords([]); setError(false); callback.current?.(value.state, value.finalStart);
    } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  }
  if (!data) return <section className="student-exercise">{error ? <><p role="alert">تعذر تحميل التقدم</p><Button onClick={() => void load()}>إعادة المحاولة</Button></> : <p role="status">جار التحميل</p>}</section>;
  const { state, round } = data;
  return <section className={`student-exercise ${feedback ? `is-${feedback}` : ""}`} aria-live="polite" aria-busy={busy}>
    {showResult && state.lastResult ? <div className="exercise-result-backdrop"><div className={`exercise-result ${state.lastResult.errors ? "is-pass" : "is-perfect"}`} role="dialog" aria-modal="true" aria-labelledby="exercise-result-title">{state.lastResult.errors === 0 ? <div className="celebration-burst" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</div> : null}<Sparkles aria-hidden="true" /><strong>{state.lastResult.correct}/{state.lastResult.total}</strong><h2 id="exercise-result-title">{state.passed ? "أتممت السورة" : state.lastResult.errors ? "أحسنت" : "ممتاز"}</h2><span>{state.lastResult.errors ? "خطأ واحد فقط · تم الاجتياز" : "إجابة متقنة بلا أخطاء"}</span><Button onClick={() => setShowResult(false)}>{state.passed ? "عرض النتيجة" : "متابعة"}</Button></div></div> : null}
    {state.passed ? <div className="exercise-complete"><Check aria-hidden="true" /><h2>✓ تم بنجاح</h2>{rewardStars ? <strong className="exercise-stars">+{rewardStars} ★</strong> : null}<p>حُفظ تقدمك وفُتحت الخطوة التالية.</p></div> : state.failed ? <div className="exercise-result-backdrop"><div className="exercise-result exercise-retry" role="dialog" aria-modal="true" aria-labelledby="exercise-retry-title"><RotateCcw aria-hidden="true" /><h2 id="exercise-retry-title">اقتربت من الإتقان</h2><p>{state.correct}/{state.lastResult?.total ?? data.questionTotal} صحيحة · حاول بهدوء مرة أخرى</p><Button disabled={busy} onClick={() => void submit(undefined, true)}>إعادة التمرين</Button></div></div> : round ? <>
      <span>{learningKey.startsWith('review') ? `مراجعة ${state.cursor + 1} / ${data.total}` : state.cursor >= data.finalStart ? 'الاختبار الأخير' : `التمرين ${state.cursor + 1} / 4`}</span>
      <div className="exercise-question-progress"><span>{state.question + 1}/{data.questionTotal}</span><span>{state.correct} صحيحة</span></div>
      <p className="exercise-prompt">{round.prompt}</p>{state.errors ? <small className="exercise-error-count">خطأ واحد · المحاولة التالية لا تضيف خطأ جديداً لهذا السؤال</small> : null}
      {round.kind === 'verse_order' ? <><div className="learning-word-answer" aria-label="الترتيب المختار">{words.length ? words.map((index, position) => <button type="button" key={position} disabled={busy} onClick={() => setWords(previous => previous.filter((_, i) => i !== position))}><span>{position + 1}</span>{round.options[index]}</button>) : <p>اضغط على المقاطع بالترتيب</p>}</div><div className="learning-word-bank" aria-label="المقاطع المتاحة">{round.options.map((word, index) => <button type="button" key={index} disabled={busy || words.includes(index)} onClick={() => setWords(previous => [...previous, index])}>{word}</button>)}</div><Button disabled={busy || words.length !== round.options.length} onClick={() => void submit(words.map(i => round.options[i]).join(' '))}>تحقق</Button></> : <div className="student-exercise__options">{round.options.map((option, index) => <button type="button" key={index} disabled={busy} onClick={() => void submit(option)}>{option}</button>)}</div>}
    </> : null}
    {error ? <p role="alert">تعذر حفظ الإجابة. أعد المحاولة.</p> : null}
  </section>;
}
