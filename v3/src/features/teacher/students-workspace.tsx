"use client";

import { BookOpenText, CheckSquare2, ClipboardPlus, Eye, EyeOff, MessageSquareWarning, MessageSquareText, UserRound, UserX } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Drawer, EmptyState, useToast } from "@/components/ui";
import { getAllSurahs, getSurah } from "@/features/quran/canonical";
import { createClient } from "@/lib/supabase/client";
import type { TeacherStudent } from "./models";

export function TeacherStudentsWorkspace({ students }: { students: TeacherStudent[] }) {
  const router = useRouter();
  const ordered = useMemo(() => [...students].sort((a, b) => new Intl.Collator("ar", { sensitivity: "base" }).compare(a.name, b.name)), [students]);
  const visible = ordered.filter((student) => !student.hiddenByTeacher);
  const hidden = ordered.filter((student) => student.hiddenByTeacher);
  const [active, setActive] = useState<TeacherStudent | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [reportingMissing, setReportingMissing] = useState(false);
  const pressTimer = useRef<number | null>(null);
  function toggle(id: string) { setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); }
  function beginPress(id: string) { pressTimer.current = window.setTimeout(() => toggle(id), 480); }
  function endPress() { if (pressTimer.current) window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  return <div className="teacher-workspace teacher-students">
    <header className="teacher-page-head"><span>المتابعة</span><h1>الطلاب</h1><Button size="sm" variant="secondary" onClick={() => setReportingMissing(true)}><MessageSquareWarning size={17} />الإبلاغ عن طالب غير موجود</Button></header>
    {selected.length ? <div className="student-selection-bar"><strong>{selected.length} محدد</strong><Button size="sm" variant="secondary" onClick={() => setSelected(ordered.map(({ id }) => id))}><CheckSquare2 size={17} />كل القسم</Button><Button size="sm" onClick={() => setAssigning(true)}><ClipboardPlus size={17} />إرسال واجب</Button><Button size="sm" variant="quiet" onClick={() => setSelected([])}>إلغاء</Button></div> : null}
    {visible.length ? <div className="teacher-student-list">{visible.map((student) => <article className={selected.includes(student.id) ? "is-selected" : undefined} key={student.id} onPointerDown={() => beginPress(student.id)} onPointerUp={endPress} onPointerCancel={endPress} onContextMenu={(event) => { event.preventDefault(); toggle(student.id); }}>
      <button className="student-select" type="button" aria-label={`تحديد ${student.name}`} aria-pressed={selected.includes(student.id)} onClick={() => toggle(student.id)}><span /></button>
      <button className="student-open" type="button" onClick={() => selected.length ? toggle(student.id) : setActive(student)}><span className="teacher-avatar">{student.name.slice(0, 1)}</span><span><strong>{student.name}</strong><small>{student.className} · {student.lastSurahNumber ? getSurah(student.lastSurahNumber)?.nameArabic : "لا يوجد تقدم"}</small></span><Badge tone={student.absenceCount >= 2 || student.pendingAssignments > 0 ? "warning" : "success"}>{student.pendingAssignments ? `${student.pendingAssignments} واجب` : "متابعة"}</Badge></button>
    </article>)}</div> : <EmptyState title={hidden.length ? "كل الطلاب مخفيون" : "لا يوجد طلاب"} description={hidden.length ? "يمكنك إظهارهم من القائمة أدناه." : "لا يوجد طلاب مرتبطون بأقسامك."} />}
    {hidden.length ? <details className="student-disclosure teacher-hidden-students"><summary>الطلاب المخفيون<Badge tone="neutral">{hidden.length}</Badge></summary><div className="teacher-record-list">{hidden.map((student) => <article key={student.id}><div><strong>{student.name}</strong><small>{student.className}</small></div><Button size="sm" variant="quiet" onClick={() => setActive(student)}><Eye size={16} />إظهار</Button></article>)}</div></details> : null}
    <Drawer open={Boolean(active)} onOpenChange={(open) => !open && setActive(null)} title={active?.name ?? "الطالب"}>{active ? <StudentSheet student={active} onAssign={() => { setSelected([active.id]); setActive(null); setAssigning(true); }} onUpdated={() => { setActive(null); router.refresh(); }} /> : null}</Drawer>
    <Drawer open={assigning} onOpenChange={setAssigning} title="إرسال واجب القرآن"><AssignmentForm studentIds={selected} onDone={() => { setAssigning(false); setSelected([]); }} /></Drawer>
    <Drawer open={reportingMissing} onOpenChange={setReportingMissing} title="الإبلاغ عن طالب غير موجود"><MissingStudentForm students={students} onDone={() => setReportingMissing(false)} /></Drawer>
  </div>;
}

function MissingStudentForm({ students, onDone }: { students: TeacherStudent[]; onDone: () => void }) {
  const { showToast } = useToast();
  const classes = useMemo(() => Array.from(new Map(students.map((student) => [student.classId, student.className])).entries()), [students]);
  const [classId, setClassId] = useState(classes[0]?.[0] ?? "");
  const [studentName, setStudentName] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const name = studentName.trim();
    if (!classId || name.length < 2) return;
    const className = classes.find(([id]) => id === classId)?.[1] ?? "—";
    const title = `[طالب غير موجود] ${name}`;
    setBusy(true);
    const client = createClient();
    const duplicate = await client.from("teacher_requests").select("id").eq("kind", "general").eq("title", title).in("status", ["submitted", "seen", "in_review"]).limit(1).maybeSingle();
    if (duplicate.data) {
      setBusy(false);
      showToast({ title: "سبق إرسال هذا البلاغ", description: "يمكنك متابعة حالته في ملفك.", tone: "info" });
      return;
    }
    const result = await client.rpc("teacher_create_request", {
      target_kind: "general",
      target_title: title,
      target_details: `القسم: ${className}\nمعرف القسم: ${classId}${details.trim() ? `\nمعلومات إضافية: ${details.trim()}` : ""}`,
      target_starts_on: new Date().toISOString().slice(0, 10),
      target_ends_on: null,
    });
    setBusy(false);
    if (result.error) {
      showToast({ title: "تعذر إرسال البلاغ", description: "تحقق من الاتصال ثم حاول مجددا.", tone: "info" });
      return;
    }
    showToast({ title: "تم إرسال البلاغ إلى الإدارة", tone: "success" });
    onDone();
  }
  return <div className="teacher-form"><label>القسم<select value={classId} onChange={(event) => setClassId(event.target.value)}>{classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>اسم الطالب<input autoComplete="off" maxLength={120} value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label><label>معلومات إضافية اختيارية<textarea maxLength={600} value={details} onChange={(event) => setDetails(event.target.value)} /></label><Button loading={busy} disabled={!classId || studentName.trim().length < 2} onClick={() => void submit()}><MessageSquareWarning size={18} />إرسال إلى الإدارة</Button></div>;
}

function StudentSheet({ student, onAssign, onUpdated }: { student: TeacherStudent; onAssign: () => void; onUpdated: () => void }) {
  const { showToast } = useToast(); const router = useRouter(); const [note, setNote] = useState(""); const [absenceDate, setAbsenceDate] = useState(() => new Date().toISOString().slice(0, 10)); const [busy, setBusy] = useState(false); const [attendanceBusy, setAttendanceBusy] = useState(false); const [visibilityBusy, setVisibilityBusy] = useState(false);
  async function addNote() { if (note.trim().length < 2) return; setBusy(true); const { error } = await createClient().rpc("teacher_add_student_note", { target_student_id: student.id, target_content: note.trim() }); setBusy(false); if (error) return showToast({ title: "تعذر حفظ الملاحظة", tone: "info" }); showToast({ title: "تم حفظ الملاحظة", tone: "success" }); router.refresh(); }
  async function markAbsent() { setAttendanceBusy(true); const { error } = await createClient().rpc("teacher_record_student_absence", { target_student_id: student.id, target_class_id: student.classId, target_absent_on: absenceDate }); setAttendanceBusy(false); if (error) return showToast({ title: "تعذر تسجيل الغياب", description: "تحقق من التاريخ والاتصال.", tone: "info" }); showToast({ title: "تم تسجيل الغياب", description: student.name, tone: "success" }); onUpdated(); }
  async function setVisibility(hidden: boolean) { setVisibilityBusy(true); const { error } = await createClient().rpc("teacher_set_student_list_visibility", { target_student_id: student.id, target_hidden: hidden }); setVisibilityBusy(false); if (error) return showToast({ title: "تعذر تحديث القائمة", tone: "info" }); showToast({ title: hidden ? "تم إخفاء الطالب من قائمتك" : "تم إظهار الطالب في قائمتك", description: student.name, tone: "success" }); onUpdated(); }
  return <div className="student-sheet"><div className="student-sheet__summary"><span className="teacher-avatar is-large">{student.name.slice(0, 1)}</span><div><strong>{student.name}</strong><small>{student.className}</small></div></div><div className="student-insight"><span>آخر سورة<strong>{student.lastSurahNumber ? getSurah(student.lastSurahNumber)?.nameArabic : "—"}</strong></span><span>الغياب<strong>{student.absenceCount}</strong></span><span>التأخر<strong>{student.lateCount}</strong></span></div><Button onClick={onAssign}><ClipboardPlus size={18} />إعطاء واجب</Button><div className="teacher-form student-list-controls"><label>تاريخ الغياب<input aria-label="تاريخ الغياب" type="date" max={new Date().toISOString().slice(0, 10)} value={absenceDate} onChange={(event) => setAbsenceDate(event.target.value)} /></label><Button variant="secondary" loading={attendanceBusy} onClick={() => void markAbsent()}><UserX size={18} />تسجيل غياب</Button><Button variant="quiet" loading={visibilityBusy} onClick={() => void setVisibility(!student.hiddenByTeacher)}>{student.hiddenByTeacher ? <Eye size={18} /> : <EyeOff size={18} />}{student.hiddenByTeacher ? "إظهار في قائمتي" : "إخفاء من قائمتي"}</Button></div>
    <Disclosure title="السور المتقنة" count={student.masteredSurahs.length}>{student.masteredSurahs.length ? student.masteredSurahs.map((item) => <p key={item.surahNumber}>{getSurah(item.surahNumber)?.nameArabic}</p>) : <p>لا توجد سورة مسجلة.</p>}</Disclosure>
    <Disclosure title="التمارين الرقمية" count={student.digitalAttempts.length}>{student.digitalAttempts.length ? student.digitalAttempts.slice(0, 30).map((item, index) => <p key={`${item.learningKey}-${item.completedAt}-${index}`}><strong>{item.learningKey.startsWith("surah-") ? getSurah(Number(item.learningKey.slice(6)))?.nameArabic : "مراجعة"}</strong> · {item.status === "passed" ? "ناجح" : "محاولة"}<small>{item.correct} صحيحة · {item.errors} أخطاء · {formatDate(item.completedAt)}</small></p>) : <p>لا توجد محاولة رقمية.</p>}</Disclosure>
    <Disclosure title="اختبارات الأجزاء" count={student.juzExams.length}>{student.juzExams.length ? student.juzExams.map((item, index) => <p key={`${item.juzNumber}-${item.completedAt}-${index}`}><strong>الجزء {item.juzNumber}</strong> · {item.score}% · {item.passed ? "ناجح" : "لم ينجح"}<small>{formatDate(item.completedAt)}</small></p>) : <p>لا يوجد اختبار جزء.</p>}</Disclosure>
    <Disclosure title="القراءات والتقديرات" count={student.recitations.length}>{student.recitations.length ? student.recitations.map((item) => <p key={item.id}><strong>{getSurah(item.surahNumber)?.nameArabic}</strong> · {item.verseFrom} - {item.verseTo} · {appreciation(item.appreciation)}<small>{formatDate(item.recordedAt)}{item.comment ? ` · ${item.comment}` : ""}</small></p>) : <p>لا توجد قراءة مسجلة.</p>}</Disclosure>
    <Disclosure title="الغياب والتأخر" count={student.attendanceHistory.length}>{student.attendanceHistory.length ? student.attendanceHistory.map((item) => <p key={item.id}>{attendance(item.status)}{item.status === "late" ? ` · ${item.minutesLate} دقيقة` : ""}<small>{formatDate(item.recordedAt)}</small></p>) : <p>لا يوجد سجل.</p>}</Disclosure>
    <Disclosure title="الواجبات" count={student.assignments.length}>{student.assignments.length ? student.assignments.map((item) => <p key={item.id}>{item.surahNumber ? getSurah(item.surahNumber)?.nameArabic : "واجب القرآن"} · {status(item.status)}<small>{item.dueAt ? formatDate(item.dueAt) : "دون تاريخ"}</small></p>) : <p>لا توجد واجبات.</p>}</Disclosure>
    <Disclosure title="الملاحظات" count={student.notes.length}><div className="note-form"><textarea aria-label="ملاحظة تربوية" maxLength={1000} value={note} placeholder="ملاحظة تربوية قصيرة" onChange={(event) => setNote(event.target.value)} /><Button size="sm" loading={busy} disabled={note.trim().length < 2} onClick={() => void addNote()}><MessageSquareText size={17} />حفظ</Button></div>{student.notes.map((item) => <p key={item.id}>{item.content}<small>{item.teacherName} · {formatDate(item.createdAt)}</small></p>)}</Disclosure>
  </div>;
}

function AssignmentForm({ studentIds, onDone }: { studentIds: string[]; onDone: () => void }) {
  const { showToast } = useToast(); const router = useRouter(); const surahs = getAllSurahs(); const [surah, setSurah] = useState(114); const [whole, setWhole] = useState(true); const [from, setFrom] = useState(1); const [to, setTo] = useState(6); const [due, setDue] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  function changeSurah(value: number) { setSurah(value); setFrom(1); setTo(getSurah(value)?.verseCount ?? 1); }
  async function submit() { if (!studentIds.length || !due || from < 1 || to < from) return; const end = whole ? getSurah(surah)?.verseCount ?? to : to; setBusy(true); const { error } = await createClient().rpc("teacher_assign_quran_work", { target_student_ids: studentIds, target_surah_number: surah, target_verse_from: whole ? 1 : from, target_verse_to: end, target_due_at: new Date(`${due}T18:00:00`).toISOString(), target_note: note.trim() || null }); setBusy(false); if (error) return showToast({ title: "تعذر إرسال الواجب", tone: "info" }); showToast({ title: `تم إرسال الواجب إلى ${studentIds.length} طالب`, tone: "success" }); onDone(); router.refresh(); }
  return <div className="teacher-form assignment-form"><p><UserRound size={17} />{studentIds.length} طالب</p><label>السورة<select value={surah} onChange={(event) => changeSurah(Number(event.target.value))}>{surahs.map((item) => <option key={item.number} value={item.number}>{item.number} · {item.nameArabic}</option>)}</select></label><div className="choice-row"><button type="button" className={whole ? "is-active" : undefined} onClick={() => setWhole(true)}>السورة كاملة</button><button type="button" className={!whole ? "is-active" : undefined} onClick={() => setWhole(false)}>آيات محددة</button></div>{!whole ? <div className="form-pair"><label>من<input type="number" min="1" value={from} onChange={(event) => setFrom(Number(event.target.value))} /></label><label>إلى<input type="number" min="1" value={to} onChange={(event) => setTo(Number(event.target.value))} /></label></div> : null}<label>الموعد<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><label>ملاحظة اختيارية<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label><Button loading={busy} disabled={!due || !studentIds.length || from < 1 || to < from} onClick={() => void submit()}><BookOpenText size={18} />إرسال الواجب</Button></div>;
}

function Disclosure({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <details className="student-disclosure"><summary>{title}<Badge tone="neutral">{count}</Badge></summary><div>{children}</div></details>; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined, timeZone: "Africa/Casablanca" }).format(new Date(value)); }
function attendance(value: string): string { return ({ present: "حاضر", absent: "غائب", late: "متأخر", excused: "غياب مبرر" } as Record<string, string>)[value] ?? value; }
function status(value: string): string { return ({ todo: "مطلوب", in_progress: "جار", submitted: "مسلّم", corrected: "مصحح" } as Record<string, string>)[value] ?? value; }
function appreciation(value: string): string { return ({ excellent: "ممتاز", very_good: "جيد جدا", good: "جيد", acceptable: "مقبول", needs_review: "يحتاج مراجعة", weak: "ضعيف", insufficient: "يحتاج مراجعة" } as Record<string, string>)[value] ?? value; }
