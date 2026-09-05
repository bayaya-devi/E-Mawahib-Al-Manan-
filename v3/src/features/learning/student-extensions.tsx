"use client";

import { Check, Gamepad2, Plus, Puzzle, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { getAllSurahs } from "@/features/quran/canonical";
import { createQuranRound, gameAnswerPoints, isCorrect, type QuranGameKind, type QuranGameRound } from "@/features/games/engine";
import { JUZ } from "@/features/quran/quran-catalog";
import { applyAppearance, readAccent, readAppearance, saveAppearance } from "@/features/settings/appearance";
import type { AppearanceAccent, AppearanceMode } from "@/features/settings/appearance";
import { emitLearningFeedback, readFeedbackPreferences, saveFeedbackPreferences, type FeedbackPreferences } from "@/features/settings/interaction-feedback";
import { deviceAccountHome, readDeviceAccounts, rememberAuthenticatedAccount, removeDeviceAccount } from "@/features/teacher/device-account-vault";
import type { SavedDeviceAccount } from "@/features/teacher/device-account-vault";

const gameDefinitions: Array<{ kind: QuranGameKind; title: string; text: string }> = [
  { kind: "verse_order", title: "رتّب الآيات", text: "أعد بناء المقطع بالترتيب" },
  { kind: "match_edges", title: "لغز المقطع", text: "صل البداية بالنهاية الصحيحة" },
  { kind: "missing_word", title: "أكمل المقطع", text: "استرجع الكلمات الناقصة" },
];

export function StudentGames({ unlocked }: { unlocked: number[] }) {
  const [kind, setKind] = useState<QuranGameKind | null>(null);
  const [juzNumber, setJuzNumber] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<QuranGameRound | null>(null);
  const [ordered, setOrdered] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mistakesOnRound, setMistakesOnRound] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "error" | null>(null);
  const [locked, setLocked] = useState(false);
  const choices = getAllSurahs().filter((surah) => unlocked.includes(surah.number)).reverse();
  const totalRounds = Math.max(5, Math.min(8, selected.reduce((total, number) => total + (choices.find((item) => item.number === number)?.verseCount ?? 0), 0)));
  if (!choices.length) return <section className="student-empty"><Gamepad2 size={30} /><strong>أتم سورة واحدة لفتح الألعاب</strong></section>;
  const accessibleJuz = JUZ.filter((juz) => choices.some((surah) => surah.number >= juz.from && surah.number <= juz.to));
  const selectedJuz = JUZ.find((juz) => juz.number === juzNumber);
  const juzSurahs = choices.filter((surah) => selectedJuz && surah.number >= selectedJuz.from && surah.number <= selectedJuz.to);
  function makeRound(index: number): QuranGameRound | null {
    const surah = choices.find((item) => item.number === selected[index % selected.length]);
    return surah && kind ? createQuranRound(surah, kind, index * 7 + selected.length) : null;
  }
  function begin() {
    setRoundIndex(0); setScore(0); setCorrectCount(0); setErrorCount(0); setStreak(0); setMistakesOnRound(0); setOrdered([]); setFeedback(null); setRound(makeRound(0));
  }
  function advance() {
    const next = roundIndex + 1;
    setOrdered([]); setMistakesOnRound(0); setFeedback(null); setLocked(false);
    if (next >= totalRounds) { setRound(null); setRoundIndex(-1); emitLearningFeedback("complete"); return; }
    setRoundIndex(next); setRound(makeRound(next));
  }
  function answer(value: string) {
    if (!round || locked) return;
    const correct = isCorrect(round, value); setLocked(true); setFeedback(correct ? "correct" : "error"); emitLearningFeedback(correct ? "correct" : "error");
    if (correct) {
      setScore((current) => current + gameAnswerPoints(true, mistakesOnRound, streak));
      setCorrectCount((current) => current + 1); setStreak((current) => current + 1);
      window.setTimeout(advance, 500);
    } else {
      setErrorCount((current) => current + 1); setStreak(0);
      if (mistakesOnRound === 0) { setMistakesOnRound(1); window.setTimeout(() => { setFeedback(null); setLocked(false); setOrdered([]); }, 600); }
      else { setMistakesOnRound(2); window.setTimeout(advance, 650); }
    }
  }
  function resetPortal() { setKind(null); setJuzNumber(null); setSelected([]); setRoundIndex(0); setRound(null); setScore(0); }
  return <div className="student-games"><header className="student-page-head"><h1>ألعاب القرآن</h1></header>
    {!kind ? <section className="student-game-portal">{gameDefinitions.map((game) => <button key={game.kind} onClick={() => setKind(game.kind)}><Puzzle aria-hidden="true" /><strong>{game.title}</strong><span>{game.text}</span></button>)}</section>
      : !juzNumber ? <section className="student-game-picker"><h2>اختر الجزء</h2><div>{accessibleJuz.map((juz) => <button key={juz.number} onClick={() => setJuzNumber(juz.number)}>{juz.name}</button>)}</div></section>
      : !round && roundIndex >= 0 ? <section className="student-game-picker"><h2>اختر سورة أو أكثر</h2><div>{juzSurahs.map((surah) => <button key={surah.number} className={selected.includes(surah.number) ? "is-selected" : ""} onClick={() => setSelected((value) => value.includes(surah.number) ? value.filter((id) => id !== surah.number) : [...value, surah.number])}><span>{surah.nameArabic}</span>{selected.includes(surah.number) ? <Check size={16} /> : null}</button>)}</div><Button disabled={!selected.length} onClick={begin}>ابدأ اللعبة</Button></section>
      : round ? <section className={`student-game-board ${feedback ? `is-${feedback}` : ""}`} aria-live="polite"><div className="game-scoreline"><span>السؤال {roundIndex + 1}/{totalRounds}</span><strong>النقاط: {score}</strong></div><p>{round.prompt}</p>{feedback ? <small>{feedback === "correct" ? "أحسنت" : mistakesOnRound === 1 ? "حاول مرة أخرى" : "ننتقل للسؤال التالي"}</small> : null}{round.kind === "verse_order" ? <><div className="learning-word-answer">{ordered.map((index, position) => <button key={position} disabled={locked} onClick={() => setOrdered((value) => value.filter((_, item) => item !== position))}>{round.options[index]}</button>)}</div><div className="learning-word-bank">{round.options.map((option, index) => <button key={index} disabled={locked || ordered.includes(index)} onClick={() => setOrdered((value) => [...value, index])}>{option}</button>)}</div><Button disabled={locked || ordered.length !== round.options.length} onClick={() => answer(ordered.map((index) => round.options[index]).join(" "))}>تحقق</Button></> : <div className="student-exercise__options">{round.options.map((option) => <button key={option} disabled={locked} onClick={() => answer(option)}>{option}</button>)}</div>}</section>
      : <section className="student-game-board game-summary"><h2>انتهت اللعبة</h2><strong>النقاط: {score}</strong><div><span>{correctCount} صحيحة</span><span>{errorCount} أخطاء</span><span>{Math.round(correctCount / totalRounds * 100)}%</span></div><Button onClick={begin}><RotateCcw size={17} />إعادة اللعب</Button><Button variant="quiet" onClick={resetPortal}>الألعاب</Button></section>}
  </div>;
}

const surveyCriteria = ["التنظيم", "المنهج التربوي", "التعليم", "سهولة استعمال المنصة", "أوقات الحصص"];
export function ParentSurvey() {
  const { showToast } = useToast(); const [scores, setScores] = useState<number[]>([0, 0, 0, 0, 0]); const [comment, setComment] = useState(""); const [sending, setSending] = useState(false);
  async function send() {
    const missing = scores.findIndex((score) => !score);
    if (missing >= 0) return showToast({ title: `يرجى تقييم: ${surveyCriteria[missing]}` });
    if (sending) return;
    setSending(true);
    try {
      const { error } = await createClient().rpc("submit_parent_feedback", { target_scores: scores, target_comment: comment.trim() || null });
      if (error) throw error;
      setComment(""); setScores([0, 0, 0, 0, 0]); emitLearningFeedback("complete"); showToast({ title: "شكراً، تم إرسال رأيكم", tone: "success" });
    } catch { showToast({ title: "تعذر الإرسال", description: "حاول مرة أخرى." }); }
    finally { setSending(false); }
  }
  return <div className="student-parent"><header className="student-page-head"><h1>للـوالدين</h1></header><section className="parent-survey"><h2>استبيان المتابعة</h2><p className="survey-instruction">يرجى تقييم كل معيار من 1 إلى 10، حيث تعني 1 «ضعيف» وتعني 10 «ممتاز».</p>{surveyCriteria.map((label, index) => <fieldset key={label}><legend>{label}{scores[index] ? <strong>{scores[index]}/10</strong> : null}</legend><div className="parent-score-grid">{Array.from({ length: 10 }, (_, value) => value + 1).map((score) => <button type="button" aria-label={`${label}: ${score}`} aria-pressed={scores[index] === score} className={scores[index] === score ? "is-selected" : ""} key={score} onClick={() => { setScores((values) => values.map((item, position) => position === index ? score : item)); emitLearningFeedback("correct"); }}>{score}</button>)}</div></fieldset>)}<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="ملاحظة اختيارية" /><Button loading={sending} disabled={sending} onClick={() => void send()}>إرسال</Button></section></div>;
}

export function StudentSettings() {
  const router = useRouter(); const { showToast } = useToast(); const [appearance, setAppearance] = useState<AppearanceMode>(readAppearance); const [accent, setAccent] = useState<AppearanceAccent>(readAccent); const [feedback, setFeedback] = useState<FeedbackPreferences>(readFeedbackPreferences); const [accounts, setAccounts] = useState<SavedDeviceAccount[]>([]); const [active, setActive] = useState<string | null>(null);
  useEffect(() => { void rememberAuthenticatedAccount().then(({ items, active: id }) => { setAccounts(items); setActive(id); }); }, []);
  function change(mode: AppearanceMode, color = accent) { setAppearance(mode); setAccent(color); saveAppearance(mode, color); applyAppearance(mode, color); }
  function changeFeedback(key: keyof FeedbackPreferences) { const next = { ...feedback, [key]: !feedback[key] }; setFeedback(next); saveFeedbackPreferences(next); }
  async function switchTo(account: SavedDeviceAccount) { const { data, error } = await createClient().auth.setSession({ access_token: account.accessToken, refresh_token: account.refreshToken }); if (error || !data.session || data.session.user.id !== account.id) return showToast({ title: "إعادة الاتصال مطلوبة" }); const remembered = await rememberAuthenticatedAccount(); setAccounts(remembered.items); setActive(remembered.active); router.replace(deviceAccountHome(account.kind)); router.refresh(); }
  return <div className="student-settings"><header className="student-page-head"><h1>الإعدادات</h1></header><section><h2>المظهر</h2><div className="student-setting-row">{(["light", "dark", "system"] as AppearanceMode[]).map((mode) => <button className={appearance === mode ? "is-active" : ""} key={mode} onClick={() => change(mode)}>{({ light: "فاتح", dark: "داكن", system: "حسب الجهاز" })[mode]}</button>)}</div><div className="student-color-row">{(["green", "blue", "plum", "gold"] as AppearanceAccent[]).map((color) => <button key={color} className={`is-${color} ${accent === color ? "is-active" : ""}`} aria-label={color} onClick={() => change(appearance, color)} />)}</div></section><section><h2>التفاعل</h2><button type="button" className="student-preference-toggle" aria-pressed={feedback.sounds} onClick={() => changeFeedback("sounds")}><span>أصوات التطبيق</span><strong>{feedback.sounds ? "مفعلة" : "متوقفة"}</strong></button><button type="button" className="student-preference-toggle" aria-pressed={feedback.vibrations} onClick={() => changeFeedback("vibrations")}><span>الاهتزاز</span><strong>{feedback.vibrations ? "مفعل" : "متوقف"}</strong></button></section><section><h2>الحسابات على هذا الجهاز</h2>{accounts.map((account) => <article className="student-account" key={account.id}><span>{account.name}</span>{account.id === active ? <small>الحساب الحالي</small> : <Button size="sm" variant="secondary" onClick={() => void switchTo(account)}>تبديل</Button>}<button aria-label="إزالة الحساب من هذا الجهاز" onClick={() => { removeDeviceAccount(account.id); setAccounts(readDeviceAccounts()); }}><Trash2 size={17} /></button></article>)}<Button variant="secondary" onClick={() => router.push("/login?add=1")}><Plus size={18} />إضافة حساب</Button></section></div>;
}

export function StudentProfile({ name, dateOfBirth, className, documents, file }: { name: string; dateOfBirth: string | null; className: string | null; documents: Array<{ id: string; title: string; category: string; path: string }>; file: { birth: boolean; guardian: boolean; identity: boolean; paymentRequired: boolean; fee: number | null; payments: Array<{ month: string; amount: number; date: string }>; legacyPayments?: Array<{ id: string; month: string; amount: number | null; status: string }> } | null }) {
  const today = new Date(); const startYear = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1; const months = Array.from({ length: 10 }, (_, index) => { const date = new Date(startYear, 8 + index, 1); return { key: date.toISOString().slice(0, 7), label: new Intl.DateTimeFormat("ar-MA", { month: "long" }).format(date) }; });
  return <div className="student-profile"><header className="student-page-head"><h1>ملفي</h1></header><section><h2>{name}</h2><div className="student-profile-lines"><p><span>القسم</span><strong>{className ?? "—"}</strong></p><p><span>تاريخ الازدياد</span><strong>{dateOfBirth ?? "—"}</strong></p></div></section><section><h2>وثائق التسجيل</h2><Status label="عقد الازدياد" value={file?.birth ?? false} /><Status label="هوية ولي الأمر" value={file?.guardian ?? false} /><Status label="هوية التلميذ" value={file?.identity ?? false} />{documents.map((document) => <a key={document.id} href={document.path} target="_blank" rel="noreferrer">{document.title}</a>)}</section><section><h2>الواجبات</h2><p className="student-payment">{file?.paymentRequired === false ? "معفى من الأداء" : file?.fee ? `${file.fee} درهم شهرياً` : "تحدده الإدارة"}</p><div className="student-months">{months.map((month) => { const payment = file?.payments.find((item) => item.month === month.key); return <details key={month.key} className={payment ? "is-paid" : ""}><summary>{month.label}<strong>{payment ? "مؤدى" : "غير مؤدى"}</strong></summary>{payment ? <p>{payment.amount} درهم · {payment.date}</p> : <p>في انتظار تأكيد الإدارة</p>}</details>; })}</div>{file?.legacyPayments?.length ? <details><summary>السجل السابق</summary>{file.legacyPayments.map((payment) => <p key={payment.id}>{payment.month} · {payment.status}{payment.amount === null ? "" : ` · ${payment.amount} درهم`}</p>)}</details> : null}</section></div>;
}
function Status({ label, value }: { label: string; value: boolean }) { return <p className="student-status"><span>{label}</span><strong className={value ? "is-yes" : "is-no"}>{value ? "تم" : "غير مسلّم"}</strong></p>; }
