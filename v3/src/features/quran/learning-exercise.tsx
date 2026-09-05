"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import type { LearningState } from './learning-plan';
type View = { state: LearningState; version: number; round: { kind: string; prompt: string; options: string[]; verseNumber: number } | null; finalStart: number; total: number };
export function LearningExercise({ learningKey, onState }: { learningKey: string; onState?: (state: LearningState, finalStart: number) => void }) {
  const [data, setData] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [words, setWords] = useState<number[]>([]);
  const callback = useRef(onState);
  useEffect(() => { callback.current = onState; }, [onState]);
  const lock = useRef(false);
  const load = useCallback(() => {
    return fetch(`/api/student/learning?key=${learningKey}`, { cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error(); const value: View = await response.json(); setData(value); callback.current?.(value.state, value.finalStart); setError(false); }).catch(() => setError(true));
  }, [learningKey]);
  useEffect(() => { void load(); }, [load]);
  async function submit(answer?: string, retry = false) {
    if (!data || lock.current) return; lock.current = true; setBusy(true);
    try {
      const response = await fetch('/api/student/learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: learningKey, version: data.version, answer, retry }) });
      if (response.status === 409) { await load(); return; }
      if (!response.ok) throw new Error();
      const value: View = await response.json(); setData(value); setWords([]); setError(false); callback.current?.(value.state, value.finalStart);
    } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  }
  if (!data) return <section className="student-exercise">{error ? <><p role="alert">تعذر تحميل التقدم</p><Button onClick={() => void load()}>إعادة المحاولة</Button></> : <p role="status">جار التحميل</p>}</section>;
  const { state, round } = data;
  return <section className="student-exercise" aria-live="polite" aria-busy={busy}>
    {state.passed ? <h2>✓ تم بنجاح</h2> : state.failed ? <><h2>أعد المحاولة</h2><p>أكثر من خطأ واحد</p><Button disabled={busy} onClick={() => void submit(undefined, true)}>إعادة</Button></> : round ? <>
      <span>{learningKey.startsWith('review') ? `مراجعة ${state.cursor + 1} / ${data.total}` : state.cursor >= data.finalStart ? 'الاختبار الأخير' : `التمرين ${state.cursor % 4 + 1} / 4`}</span>
      <p>{round.prompt}</p>{state.errors ? <small>خطأ واحد</small> : null}
      {round.kind === 'verse_order' ? <><div className="learning-word-answer">{words.map((index, position) => <button type="button" key={position} disabled={busy} onClick={() => setWords(previous => previous.filter((_, i) => i !== position))}>{round.options[index]}</button>)}</div><div className="learning-word-bank">{round.options.map((word, index) => <button type="button" key={index} disabled={busy || words.includes(index)} onClick={() => setWords(previous => [...previous, index])}>{word}</button>)}</div><Button disabled={busy || words.length !== round.options.length} onClick={() => void submit(words.map(i => round.options[i]).join(' '))}>تحقق</Button></> : <div className="student-exercise__options">{round.options.map((option, index) => <button type="button" key={index} disabled={busy} onClick={() => void submit(option)}>{option}</button>)}</div>}
    </> : null}
    {error ? <p role="alert">تعذر حفظ الإجابة. أعد المحاولة.</p> : null}
  </section>;
}
