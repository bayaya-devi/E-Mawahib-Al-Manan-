"use client";

import { BookOpenText, CheckSquare2, ClipboardPlus, MessageSquareText, UserRound } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Drawer, EmptyState, useToast } from "@/components/ui";
import { getAllSurahs, getSurah } from "@/features/quran/canonical";
import { createClient } from "@/lib/supabase/client";
import type { TeacherStudent } from "./models";

export function TeacherStudentsWorkspace({ students }: { students: TeacherStudent[] }) {
  const ordered = useMemo(() => [...students].sort((a, b) => new Intl.Collator("ar", { sensitivity: "base" }).compare(a.name, b.name)), [students]);
  const [active, setActive] = useState<TeacherStudent | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const pressTimer = useRef<number | null>(null);
  function toggle(id: string) { setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); }
  function beginPress(id: string) { pressTimer.current = window.setTimeout(() => toggle(id), 480); }
  function endPress() { if (pressTimer.current) window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  return <div className="teacher-workspace teacher-students">
    <header className="teacher-page-head"><span>المتابعة</span><h1>الطلاب</h1></header>
    {selected.length ? <div className="student-selection-bar"><strong>{selected.length} محدد</strong><Button size="sm" variant="secondary" onClick={() => setSelected(ordered.map(({ id }) => id))}><CheckSquare2 size={17} />كل القسم</Button><Button size="sm" onClick={() => setAssigning(true)}><ClipboardPlus size={17} />إرسال واجب</Button><Button size="sm" variant="quiet" onClick={() => setSelected([])}>إلغاء</Button></div> : null}
    {ordered.length ? <div className="teacher-student-list">{ordered.map((student) => <article className={selected.includes(student.id) ? "is-selected" : undefined} key={student.id} onPointerDown={() => beginPress(student.id)} onPointerUp={endPress} onPointerCancel={endPress} onContextMenu={(event) => { event.preventDefault(); toggle(student.id); }}>
      <button className="student-select" type="button" aria-label={`تحديد ${student.name}`} aria-pressed={selected.includes(student.id)} onClick={() => toggle(student.id)}><span /></button>
      <button className="student-open" type="button" onClick={() => selected.length ? toggle(student.id) : setActive(student)}><span className="teacher-avatar">{student.name.slice(0, 1)}</span><span><strong>{student.name}</strong><small>{student.className} · {student.lastSurahNumber ? getSurah(student.lastSurahNumber)?.nameArabic : "لا يوجد تقدم"}</small></span><Badge tone={student.absenceCount >= 2 || student.pendingAssignments > 0 ? "warning" : "success"}>{student.pendingAssignments ? `${student.pendingAssignments} واجب` : "متابعة"}</Badge></button>
    </article>)}</div> : <EmptyState title="لا يوجد طلاب" description="لا يوجد طلاب مرتبطون بأقسامك." />}
    <Drawer open={Boolean(active)} onOpenChange={(open) => !open && setActive(null)} title={active?.name ?? "الطالب"}>{active ? <StudentSheet student={active} onAssign={() => { setSelected([active.id]); setActive(null); setAssigning(true); }} /> : null}</Drawer>
    <Drawer open={assigning} onOpenChange={setAssigning} title="إرسال واجب القرآن"><AssignmentForm studentIds={selected} onDone={() => { setAssigning(false); setSelected([]); }} /></Drawer>
  </div>;
}

function StudentSheet({ student, onAssign }: { student: TeacherStudent; onAssign: () => void }) {
  const { showToast } = useToast(); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  async function addNote() { if (note.trim().length < 2) return; setBusy(true); const { error } = await createClient().rpc("teacher_add_student_note", { target_student_id: student.id, target_content: note.trim() }); setBusy(false); if (error) return showToast({ title: "تعذر حفظ الملاحظة", tone: "info" }); showToast({ title: "تم حفظ الملاحظة", tone: "success" }); window.location.reload(); }
  return <div className="student-sheet"><div className="student-sheet__summary"><span className="teacher-avatar is-large">{student.name.slice(0, 1)}</span><div><strong>{student.name}</strong><small>{student.className}</small></div></div><div className="student-insight"><span>آخر سورة<strong>{student.lastSurahNumber ? getSurah(student.lastSurahNumber)?.nameArabic : "—"}</strong></span><span>الغياب<strong>{student.absenceCount}</strong></span><span>التأخر<strong>{student.lateCount}</strong></span></div><Button onClick={onAssign}><ClipboardPlus size={18} />إعطاء واجب</Button>
    <Disclosure title="السور المتقنة" count={student.masteredSurahs.length}>{student.masteredSurahs.length ? student.masteredSurahs.map((item) => <p key={item.surahNumber}>{getSurah(item.surahNumber)?.nameArabic}</p>) : <p>لا توجد سورة مسجلة.</p>}</Disclosure>
    <Disclosure title="القراءات والتقديرات" count={student.recitations.length}>{student.recitations.length ? student.recitations.map((item) => <p key={item.id}><strong>{getSurah(item.surahNumber)?.nameArabic}</strong> · {item.verseFrom} - {item.verseTo} · {appreciation(item.appreciation)}<small>{formatDate(item.recordedAt)}{item.comment ? ` · ${item.comment}` : ""}</small></p>) : <p>لا توجد قراءة مسجلة.</p>}</Disclosure>
    <Disclosure title="الغياب والتأخر" count={student.attendanceHistory.length}>{student.attendanceHistory.length ? student.attendanceHistory.map((item) => <p key={item.id}>{attendance(item.status)}{item.status === "late" ? ` · ${item.minutesLate} دقيقة` : ""}<small>{formatDate(item.recordedAt)}</small></p>) : <p>لا يوجد سجل.</p>}</Disclosure>
    <Disclosure title="الواجبات" count={student.assignments.length}>{student.assignments.length ? student.assignments.map((item) => <p key={item.id}>{item.surahNumber ? getSurah(item.surahNumber)?.nameArabic : "واجب القرآن"} · {status(item.status)}<small>{item.dueAt ? formatDate(item.dueAt) : "دون تاريخ"}</small></p>) : <p>لا توجد واجبات.</p>}</Disclosure>
    <Disclosure title="الملاحظات" count={student.notes.length}><div className="note-form"><textarea aria-label="ملاحظة تربوية" maxLength={1000} value={note} placeholder="ملاحظة تربوية قصيرة" onChange={(event) => setNote(event.target.value)} /><Button size="sm" loading={busy} disabled={note.trim().length < 2} onClick={() => void addNote()}><MessageSquareText size={17} />حفظ</Button></div>{student.notes.map((item) => <p key={item.id}>{item.content}<small>{item.teacherName} · {formatDate(item.createdAt)}</small></p>)}</Disclosure>
  </div>;
}

function AssignmentForm({ studentIds, onDone }: { studentIds: string[]; onDone: () => void }) {
  const { showToast } = useToast(); const surahs = getAllSurahs(); const [surah, setSurah] = useState(114); const [whole, setWhole] = useState(true); const [from, setFrom] = useState(1); const [to, setTo] = useState(6); const [due, setDue] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  function changeSurah(value: number) { setSurah(value); setFrom(1); setTo(getSurah(value)?.verseCount ?? 1); }
  async function submit() { if (!studentIds.length || !due || from < 1 || to < from) return; const end = whole ? getSurah(surah)?.verseCount ?? to : to; setBusy(true); const { error } = await createClient().rpc("teacher_assign_quran_work", { target_student_ids: studentIds, target_surah_number: surah, target_verse_from: whole ? 1 : from, target_verse_to: end, target_due_at: new Date(`${due}T18:00:00`).toISOString(), target_note: note.trim() || null }); setBusy(false); if (error) return showToast({ title: "تعذر إرسال الواجب", tone: "info" }); showToast({ title: `تم إرسال الواجب إلى ${studentIds.length} طالب`, tone: "success" }); onDone(); window.location.reload(); }
  return <div className="teacher-form assignment-form"><p><UserRound size={17} />{studentIds.length} طالب</p><label>السورة<select value={surah} onChange={(event) => changeSurah(Number(event.target.value))}>{surahs.map((item) => <option key={item.number} value={item.number}>{item.number} · {item.nameArabic}</option>)}</select></label><div className="choice-row"><button type="button" className={whole ? "is-active" : undefined} onClick={() => setWhole(true)}>السورة كاملة</button><button type="button" className={!whole ? "is-active" : undefined} onClick={() => setWhole(false)}>آيات محددة</button></div>{!whole ? <div className="form-pair"><label>من<input type="number" min="1" value={from} onChange={(event) => setFrom(Number(event.target.value))} /></label><label>إلى<input type="number" min="1" value={to} onChange={(event) => setTo(Number(event.target.value))} /></label></div> : null}<label>الموعد<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><label>ملاحظة اختيارية<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label><Button loading={busy} disabled={!due || !studentIds.length || from < 1 || to < from} onClick={() => void submit()}><BookOpenText size={18} />إرسال الواجب</Button></div>;
}

function Disclosure({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <details className="student-disclosure"><summary>{title}<Badge tone="neutral">{count}</Badge></summary><div>{children}</div></details>; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(new Date(value)); }
function attendance(value: string): string { return ({ present: "حاضر", absent: "غائب", late: "متأخر", excused: "غياب مبرر" } as Record<string, string>)[value] ?? value; }
function status(value: string): string { return ({ todo: "مطلوب", in_progress: "جار", submitted: "مسلّم", corrected: "مصحح" } as Record<string, string>)[value] ?? value; }
function appreciation(value: string): string { return ({ excellent: "ممتاز", very_good: "جيد جدا", good: "جيد", acceptable: "مقبول", needs_review: "يحتاج مراجعة", weak: "ضعيف", insufficient: "يحتاج مراجعة" } as Record<string, string>)[value] ?? value; }
