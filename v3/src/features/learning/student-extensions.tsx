"use client";

import { Check, Gamepad2, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { getAllSurahs } from "@/features/quran/canonical";
import { applyAppearance, readAccent, readAppearance, saveAppearance } from "@/features/settings/appearance";
import type { AppearanceAccent, AppearanceMode } from "@/features/settings/appearance";
import { readDeviceAccounts, rememberAuthenticatedAccount, removeDeviceAccount } from "@/features/teacher/device-account-vault";
import type { SavedDeviceAccount } from "@/features/teacher/device-account-vault";

export function StudentGames({ unlocked }: { unlocked: number[] }) {
  const [selected, setSelected] = useState<number[]>(unlocked.slice(0, 2)); const [started, setStarted] = useState(false); const [round, setRound] = useState(0);
  const choices = getAllSurahs().filter((surah) => unlocked.includes(surah.number)).reverse();
  if (!choices.length) return <section className="student-empty"><Gamepad2 size={30} /><strong>أتم سورة واحدة لفتح الألعاب</strong></section>;
  const current = choices[round % choices.length];
  return <div className="student-games">{started ? <section className="student-game-board"><span>الجولة {round + 1}</span><h2>{current?.nameArabic}</h2><p>اختر السورة التي تريد مراجعتها ثم ابدأ من أول آياتها.</p><Button onClick={() => setRound((value) => value + 1)}>جولة جديدة</Button></section> : <><header className="student-page-head"><h1>ألعاب القرآن</h1></header><section className="student-game-picker"><h2>اختر السور</h2><div>{choices.map((surah) => <button key={surah.number} className={selected.includes(surah.number) ? "is-selected" : ""} onClick={() => setSelected((value) => value.includes(surah.number) ? value.filter((id) => id !== surah.number) : [...value, surah.number])}><span>{surah.nameArabic}</span>{selected.includes(surah.number) ? <Check size={16} /> : null}</button>)}</div><Button disabled={!selected.length} onClick={() => setStarted(true)}>ابدأ اللعبة</Button></section></>}</div>;
}

export function ParentSurvey() {
  const { showToast } = useToast(); const [scores, setScores] = useState([7, 7, 7, 7, 7]); const [comment, setComment] = useState(""); const [sending, setSending] = useState(false);
  async function send() { setSending(true); const { error } = await createClient().rpc("submit_parent_feedback", { target_scores: scores, target_comment: comment.trim() || null }); setSending(false); if (error) showToast({ title: "تعذر الإرسال", description: "حاول مرة أخرى." }); else { setComment(""); showToast({ title: "تم الإرسال", tone: "success" }); } }
  return <div className="student-parent"><header className="student-page-head"><h1>للـوالدين</h1></header><section className="parent-survey"><h2>استبيان المتابعة</h2>{["الحفظ", "المراجعة", "الالتزام", "وضوح المنصة", "التواصل"].map((label, index) => <label key={label}><span>{label}<strong>{scores[index]}/10</strong></span><input type="range" min="1" max="10" value={scores[index]} onChange={(event) => setScores((value) => value.map((score, position) => position === index ? Number(event.target.value) : score))} /></label>)}<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="ملاحظة اختيارية" /><Button loading={sending} onClick={() => void send()}>إرسال</Button></section></div>;
}

export function StudentSettings() {
  const router = useRouter(); const { showToast } = useToast(); const [appearance, setAppearance] = useState<AppearanceMode>(readAppearance); const [accent, setAccent] = useState<AppearanceAccent>(readAccent); const [accounts, setAccounts] = useState<SavedDeviceAccount[]>([]); const [active, setActive] = useState<string | null>(null);
  useEffect(() => { void rememberAuthenticatedAccount().then(({ items, active: id }) => { setAccounts(items); setActive(id); }); }, []);
  function change(mode: AppearanceMode, color = accent) { setAppearance(mode); setAccent(color); saveAppearance(mode, color); applyAppearance(mode, color); }
  async function switchTo(account: SavedDeviceAccount) { const { error } = await createClient().auth.setSession({ access_token: account.accessToken, refresh_token: account.refreshToken }); if (error) return showToast({ title: "إعادة الاتصال مطلوبة" }); router.replace(account.kind === "student" ? "/student" : account.kind === "parent" ? "/family" : "/teacher"); router.refresh(); }
  async function signOut() { await createClient().auth.signOut({ scope: "local" }); router.replace("/login"); router.refresh(); }
  return <div className="student-settings"><header className="student-page-head"><h1>الإعدادات</h1></header><section><h2>المظهر</h2><div className="student-setting-row">{(["light", "dark", "system"] as AppearanceMode[]).map((mode) => <button className={appearance === mode ? "is-active" : ""} key={mode} onClick={() => change(mode)}>{({ light: "فاتح", dark: "داكن", system: "حسب الجهاز" })[mode]}</button>)}</div><div className="student-color-row">{(["green", "blue", "plum", "gold"] as AppearanceAccent[]).map((color) => <button key={color} className={`is-${color} ${accent === color ? "is-active" : ""}`} aria-label={color} onClick={() => change(appearance, color)} />)}</div></section><section><h2>الحسابات على هذا الجهاز</h2>{accounts.map((account) => <article className="student-account" key={account.id}><span>{account.name}</span>{account.id === active ? <small>الحساب الحالي</small> : <Button size="sm" variant="secondary" onClick={() => void switchTo(account)}>تبديل</Button>}<button aria-label="إزالة الحساب من هذا الجهاز" onClick={() => { removeDeviceAccount(account.id); setAccounts(readDeviceAccounts()); }}><Trash2 size={17} /></button></article>)}</section><Button variant="quiet" onClick={() => void signOut()}><LogOut size={18} />تسجيل الخروج</Button></div>;
}

export function StudentProfile({ name, dateOfBirth, className, file }: { name: string; dateOfBirth: string | null; className: string | null; file: { birth: boolean; guardian: boolean; identity: boolean; paymentRequired: boolean; fee: number | null; months: string[] } | null }) {
  return <div className="student-profile"><header className="student-page-head"><h1>ملفي</h1></header><section><h2>{name}</h2><div className="student-profile-lines"><p><span>القسم</span><strong>{className ?? "—"}</strong></p><p><span>تاريخ الازدياد</span><strong>{dateOfBirth ?? "—"}</strong></p></div></section><section><h2>وثائق التسجيل</h2><Status label="عقد الازدياد" value={file?.birth ?? false} /><Status label="هوية ولي الأمر" value={file?.guardian ?? false} /><Status label="هوية التلميذ" value={file?.identity ?? false} /></section><section><h2>الاشتراك</h2><p className="student-payment">{file?.paymentRequired === false ? "معفى من الأداء" : file?.fee ? `${file.fee} درهم شهرياً` : "تحدده الإدارة"}</p><div className="student-months">{["شتنبر", "أكتوبر", "نونبر", "دجنبر", "يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو"].map((month) => <span key={month} className={file?.months.includes(month) ? "is-paid" : ""}>{month}</span>)}</div></section></div>;
}
function Status({ label, value }: { label: string; value: boolean }) { return <p className="student-status"><span>{label}</span><strong className={value ? "is-yes" : "is-no"}>{value ? "تم" : "غير مسلّم"}</strong></p>; }
