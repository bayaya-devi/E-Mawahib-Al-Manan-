"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock3, Flag, Play, Send } from "lucide-react";
import { Badge, Button, ButtonLink, EmptyState, useToast } from "@/components/ui";
import { getAllSurahs, getSurah } from "@/features/quran/canonical";
import { createClient } from "@/lib/supabase/client";
import type { DatabaseAttendanceStatus, DatabaseRecitationAppreciation } from "@/types/database";
import type { TeacherSessionData } from "./models";

type AttendanceState = Record<string, { status: DatabaseAttendanceStatus; minutesLate: number }>;
const difficulties = ["ضعف التركيز", "نسيان متكرر", "صعوبة الربط", "قلة المراجعة"];

export function SessionWizard({ data }: { data: TeacherSessionData }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [runId, setRunId] = useState(data.openRun?.id ?? null);
  const [reportId, setReportId] = useState(data.openReportId);
  const [step, setStep] = useState(data.openRun?.status === "report_pending" ? 3 : data.openRun ? 1 : 0);
  const [startedAt, setStartedAt] = useState(data.openRun?.startedAt ?? null);
  const [seconds, setSeconds] = useState(data.elapsedSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialAttendance = Object.fromEntries(data.students.map((student) => { const stored = data.attendance.find((item) => item.studentId === student.id); return [student.id, { status: stored?.status ?? "present", minutesLate: stored?.minutesLate ?? 0 }]; }));
  const [attendance, setAttendance] = useState<AttendanceState>(initialAttendance);
  const activeClassId = data.openRun?.classId ?? data.nextCourse?.classId ?? data.classes[0]?.id;
  const classStudents = data.students.filter(({ classId }) => classId === activeClassId);
  const presentStudents = classStudents.filter((student) => ["present", "late"].includes(attendance[student.id]?.status ?? "present"));
  const [studentIndex, setStudentIndex] = useState(0);
  const student = presentStudents[studentIndex];

  useEffect(() => { if (!startedAt) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [startedAt]);

  async function start(): Promise<void> {
    if (!data.nextCourse) return;
    setBusy(true); setError(null);
    const { data: id, error: rpcError } = await createClient().rpc("teacher_start_session", { target_course_session_id: data.nextCourse.id });
    setBusy(false);
    if (rpcError || !id) { setError("تعذر بدء الحصة. تحقق من الحصة والاتصال."); return; }
    setRunId(id); setStartedAt(new Date().toISOString()); setStep(1);
  }

  async function saveAttendance(): Promise<void> {
    if (!runId) return;
    setBusy(true); setError(null);
    const rows = classStudents.map(({ id }) => ({ student_id: id, status: attendance[id]?.status ?? "present", minutes_late: attendance[id]?.minutesLate ?? 0 }));
    const { error: rpcError } = await createClient().rpc("teacher_save_attendance", { target_run_id: runId, attendance_rows: rows });
    setBusy(false);
    if (rpcError) { setError("تعذر حفظ الحضور. لم يتم الانتقال للخطوة التالية."); return; }
    setStep(2); setStudentIndex(0);
  }

  async function openReport(): Promise<void> {
    if (!runId) return;
    setBusy(true); setError(null);
    const { data: id, error: rpcError } = await createClient().rpc("teacher_open_session_report", { target_run_id: runId });
    setBusy(false);
    if (rpcError || !id) { setError("تعذر فتح تقرير الحصة."); return; }
    setReportId(id); setStep(3);
  }

  return <div className="session-mode">
    <header className="session-top"><div><span>{formatDate(new Date())}</span><strong>{data.nextCourse?.className ?? data.classes.find(({ id }) => id === activeClassId)?.name ?? "الحصة"}</strong></div>{startedAt ? <div className="session-timer"><Clock3 size={18} /><strong>{formatDuration(seconds)}</strong></div> : null}<ButtonLink href="/teacher" variant="quiet">خروج</ButtonLink></header>
    <div className="session-progress" aria-label={`الخطوة ${step + 1} من 4`}>{[0, 1, 2, 3].map((item) => <span key={item} className={item <= step ? "is-active" : undefined} />)}</div>
    {error ? <p className="session-error" role="alert"><AlertTriangle size={18} />{error}</p> : null}
    {step === 0 ? <StartStep data={data} busy={busy} onStart={() => void start()} /> : null}
    {step === 1 ? <AttendanceStep students={classStudents} attendance={attendance} setAttendance={setAttendance} busy={busy} onContinue={() => void saveAttendance()} /> : null}
    {step === 2 ? student ? <StudentStep key={student.id} runId={runId!} student={student} position={studentIndex + 1} total={presentStudents.length} defaultDueDate={data.defaultDueDate} busy={busy} setBusy={setBusy} onError={setError} onBack={() => setStudentIndex((value) => Math.max(0, value - 1))} onNext={() => { if (studentIndex < presentStudents.length - 1) setStudentIndex((value) => value + 1); else void openReport(); }} /> : <EmptyState title="لا يوجد طالب حاضر" description="يمكن فتح التقرير مباشرة بعد حفظ الحضور." action={<Button onClick={() => void openReport()}>فتح التقرير</Button>} /> : null}
    {step === 3 && reportId ? <ReportStep reportId={reportId} students={classStudents} attendance={attendance} busy={busy} setBusy={setBusy} onError={setError} onSubmitted={() => { showToast({ title: "تم إرسال تقرير الحصة", tone: "success" }); router.push("/teacher/reports?sent=1"); router.refresh(); }} /> : null}
  </div>;
}

function StartStep({ data, busy, onStart }: { data: TeacherSessionData; busy: boolean; onStart: () => void }) {
  return <section className="session-step session-start"><Badge tone="brand">الاستعداد</Badge><h1>ابدأ الحصة بوضوح</h1><p>راجع الملخص ثم ابدأ عندما يكون الطلاب مستعدين.</p><div className="session-brief"><div><span>الحصة</span><strong>{data.nextCourse?.title ?? "لا توجد حصة مجدولة"}</strong></div><div><span>القسم</span><strong>{data.nextCourse?.className ?? "—"}</strong></div><div><span>الطلاب</span><strong>{data.students.filter(({ classId }) => classId === data.nextCourse?.classId).length}</strong></div></div>{data.students.length ? <div className="assistant-note"><Flag size={19} /><span><strong>اقتراح البداية</strong>{data.students.find(({ absenceCount }) => absenceCount >= 2)?.name ? `ابدأ بمتابعة ${data.students.find(({ absenceCount }) => absenceCount >= 2)?.name} بعد الغياب.` : "ابدأ بالنداء ثم تابع الطلاب حسب ترتيب القائمة."}</span></div> : null}<Button disabled={!data.nextCourse} loading={busy} onClick={onStart}><Play size={18} />بدء الحصة</Button></section>;
}

function AttendanceStep({ students, attendance, setAttendance, busy, onContinue }: { students: TeacherSessionData["students"]; attendance: AttendanceState; setAttendance: Dispatch<SetStateAction<AttendanceState>>; busy: boolean; onContinue: () => void }) {
  const count = (status: DatabaseAttendanceStatus) => students.filter(({ id }) => attendance[id]?.status === status).length;
  return <section className="session-step"><div className="session-title"><div><span>الخطوة 2</span><h1>تسجيل الحضور</h1></div><div className="attendance-counts"><b>{count("present")} حاضر</b><b>{count("absent")} غائب</b><b>{count("late")} متأخر</b></div></div><div className="attendance-list">{students.map((student) => { const current = attendance[student.id] ?? { status: "present", minutesLate: 0 }; return <article key={student.id}><span className="teacher-avatar">{student.name.slice(0, 1)}</span><strong>{student.name}</strong><div className="attendance-actions">{(["present", "absent", "late"] as const).map((status) => <button type="button" className={current.status === status ? "is-active" : undefined} key={status} onClick={() => setAttendance((state) => ({ ...state, [student.id]: { status, minutesLate: status === "late" ? Math.max(1, current.minutesLate) : 0 } }))}>{({ present: "حاضر", absent: "غائب", late: "متأخر" })[status]}</button>)}</div>{current.status === "late" ? <input aria-label={`دقائق تأخر ${student.name}`} type="number" min="1" max="600" value={current.minutesLate} onChange={(event) => setAttendance((state) => ({ ...state, [student.id]: { ...current, minutesLate: Number(event.target.value) } }))} /> : null}</article>; })}</div><div className="session-footer"><ButtonLink href="/teacher" variant="quiet"><ArrowRight size={17} />إلغاء</ButtonLink><Button loading={busy} onClick={onContinue}><Check size={18} />حفظ ومتابعة</Button></div></section>;
}

function StudentStep({ runId, student, position, total, defaultDueDate, busy, setBusy, onError, onBack, onNext }: { runId: string; student: TeacherSessionData["students"][number]; position: number; total: number; defaultDueDate: string; busy: boolean; setBusy: (value: boolean) => void; onError: (value: string | null) => void; onBack: () => void; onNext: () => void }) {
  const surahs = getAllSurahs();
  const initialSurah = student.lastSurahNumber ?? 114;
  const [surah, setSurah] = useState(initialSurah);
  const [from, setFrom] = useState(1); const [to, setTo] = useState(getSurah(initialSurah)?.verseCount ?? 1);
  const [appreciation, setAppreciation] = useState<DatabaseRecitationAppreciation>("good");
  const [behavior, setBehavior] = useState<"excellent" | "good" | "mixed" | "difficult">("good");
  const [comment, setComment] = useState(""); const [flags, setFlags] = useState<string[]>([]);
  const [createGoal, setCreateGoal] = useState(false); const [createAssignment, setCreateAssignment] = useState(false);
  const [due, setDue] = useState(defaultDueDate);
  const verseCount = getSurah(surah)?.verseCount ?? 1;
  function changeSurah(value: number): void { setSurah(value); setFrom(1); setTo(getSurah(value)?.verseCount ?? 1); }
  async function save(): Promise<void> {
    setBusy(true); onError(null);
    if (createAssignment && !due) { onError("حدد موعد الواجب قبل المتابعة."); setBusy(false); return; }
    const { error } = await createClient().rpc("teacher_record_student_work", { target_run_id: runId, target_student_id: student.id, target_surah_number: surah, target_verse_from: from, target_verse_to: to, target_appreciation: appreciation, target_comment: comment, target_behavior: behavior, target_difficulties: flags, target_create_goal: createGoal, target_goal_surah: surah, target_goal_from: from, target_goal_to: to, target_create_assignment: createAssignment, target_assignment_due: createAssignment ? new Date(`${due}T18:00:00`).toISOString() : null });
    setBusy(false); if (error) { onError("تعذر حفظ متابعة الطالب. تحقق من الآيات والاتصال."); return; } onNext();
  }
  return <section className="session-step"><div className="student-session-head"><span className="teacher-avatar is-large">{student.name.slice(0, 1)}</span><div><small>الطالب {position} من {total}</small><h1>{student.name}</h1><p>{student.className}</p></div></div><div className="student-insight"><span>آخر تقدم<strong>{student.lastSurahNumber ? getSurah(student.lastSurahNumber)?.nameArabic : "لا يوجد"}</strong></span><span>الغياب<strong>{student.absenceCount}</strong></span><span>واجبات معلقة<strong>{student.pendingAssignments}</strong></span></div><div className="assistant-note"><Flag size={18} /><span><strong>اقتراح</strong>{student.suggestion}</span></div><div className="quick-form"><label>السورة<select value={surah} onChange={(event) => changeSurah(Number(event.target.value))}>{surahs.map((item) => <option key={item.number} value={item.number}>{item.number} · {item.nameArabic}</option>)}</select></label><div className="form-pair"><label>من الآية<input type="number" min="1" max={verseCount} value={from} onChange={(event) => setFrom(Number(event.target.value))} /></label><label>إلى الآية<input type="number" min={from} max={verseCount} value={to} onChange={(event) => setTo(Number(event.target.value))} /></label></div><fieldset><legend>التقدير السريع</legend><div className="choice-row">{(["excellent", "very_good", "good", "needs_review", "insufficient"] as const).map((item) => <button type="button" className={appreciation === item ? "is-active" : undefined} key={item} onClick={() => setAppreciation(item)}>{({ excellent: "ممتاز", very_good: "جيد جدا", good: "جيد", needs_review: "يحتاج مراجعة", insufficient: "غير كاف" })[item]}</button>)}</div></fieldset><fieldset><legend>السلوك</legend><div className="choice-row">{(["excellent", "good", "mixed", "difficult"] as const).map((item) => <button type="button" className={behavior === item ? "is-active" : undefined} key={item} onClick={() => setBehavior(item)}>{({ excellent: "ممتاز", good: "جيد", mixed: "متفاوت", difficult: "صعب" })[item]}</button>)}</div></fieldset><fieldset><legend>صعوبات ملحوظة</legend><div className="check-row">{difficulties.map((item) => <label key={item}><input type="checkbox" checked={flags.includes(item)} onChange={() => setFlags((current) => current.includes(item) ? current.filter((flag) => flag !== item) : [...current, item])} />{item}</label>)}</div></fieldset><label>ملاحظة قصيرة اختيارية<input value={comment} onChange={(event) => setComment(event.target.value)} /></label><div className="explicit-actions"><label><input type="checkbox" checked={createGoal} onChange={(event) => setCreateGoal(event.target.checked)} />تعيين هذا المقطع هدفا جديدا</label><label><input type="checkbox" checked={createAssignment} onChange={(event) => setCreateAssignment(event.target.checked)} />إرسال واجب مراجعة</label>{createAssignment ? <input aria-label="موعد الواجب" type="date" value={due} onChange={(event) => setDue(event.target.value)} /> : null}</div></div><div className="session-footer"><Button variant="quiet" disabled={position === 1} onClick={onBack}><ArrowRight size={17} />السابق</Button><Button loading={busy} onClick={() => void save()}>{position === total ? "حفظ وفتح التقرير" : "حفظ والطالب التالي"}<ArrowLeft size={17} /></Button></div></section>;
}

function ReportStep({ reportId, students, attendance, busy, setBusy, onError, onSubmitted }: { reportId: string; students: TeacherSessionData["students"]; attendance: AttendanceState; busy: boolean; setBusy: (value: boolean) => void; onError: (value: string | null) => void; onSubmitted: () => void }) {
  const [program, setProgram] = useState<"completed" | "partial" | "not_completed">("completed"); const [behavior, setBehavior] = useState<"excellent" | "good" | "mixed" | "difficult">("good");
  const [flags, setFlags] = useState<string[]>([]); const [follow, setFollow] = useState<string[]>([]); const [incident, setIncident] = useState(false); const [incidentText, setIncidentText] = useState(""); const [equipment, setEquipment] = useState<"ready" | "missing" | "damaged">("ready"); const [equipmentText, setEquipmentText] = useState(""); const [note, setNote] = useState("");
  const present = students.filter(({ id }) => attendance[id]?.status === "present").length; const absent = students.filter(({ id }) => attendance[id]?.status === "absent").length; const late = students.filter(({ id }) => attendance[id]?.status === "late").length;
  async function submit(): Promise<void> { setBusy(true); onError(null); const { error } = await createClient().rpc("teacher_submit_session_report", { target_report_id: reportId, target_program_status: program, target_behavior: behavior, target_difficulties: flags, target_follow_up_students: follow, target_incident: incident, target_incident_summary: incidentText, target_equipment: equipment, target_equipment_details: equipmentText, target_optional_note: note }); setBusy(false); if (error) { onError("تعذر إرسال التقرير. راجع خانة الحادث والاتصال."); return; } onSubmitted(); }
  return <section className="session-step"><Badge tone="success">الخطوة الأخيرة</Badge><h1>تقرير الحصة</h1><p>اختر الإجابات المناسبة، ثم راجع وأرسل إلى الإدارة.</p><div className="report-presence"><span>حاضر<strong>{present}</strong></span><span>غائب<strong>{absent}</strong></span><span>متأخر<strong>{late}</strong></span></div><ReportChoice label="البرنامج المنجز" value={program} onChange={setProgram} options={[{ value: "completed", label: "كامل" }, { value: "partial", label: "جزئي" }, { value: "not_completed", label: "لم ينجز" }]} /><ReportChoice label="سلوك المجموعة" value={behavior} onChange={setBehavior} options={[{ value: "excellent", label: "ممتاز" }, { value: "good", label: "جيد" }, { value: "mixed", label: "متفاوت" }, { value: "difficult", label: "صعب" }]} /><fieldset><legend>الصعوبات</legend><div className="check-row">{difficulties.map((item) => <label key={item}><input type="checkbox" checked={flags.includes(item)} onChange={() => setFlags((current) => current.includes(item) ? current.filter((flag) => flag !== item) : [...current, item])} />{item}</label>)}</div></fieldset><fieldset><legend>طلاب يحتاجون متابعة</legend><div className="check-row">{students.map((item) => <label key={item.id}><input type="checkbox" checked={follow.includes(item.id)} onChange={() => setFollow((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />{item.name}</label>)}</div></fieldset><label className="toggle-line"><input type="checkbox" checked={incident} onChange={(event) => setIncident(event.target.checked)} />وقع حادث أو مشكل</label>{incident ? <label>وصف قصير للحادث<input value={incidentText} onChange={(event) => setIncidentText(event.target.value)} required /></label> : null}<ReportChoice label="المعدات" value={equipment} onChange={setEquipment} options={[{ value: "ready", label: "جاهزة" }, { value: "missing", label: "ناقصة" }, { value: "damaged", label: "متضررة" }]} />{equipment !== "ready" ? <label>تفصيل قصير<input value={equipmentText} onChange={(event) => setEquipmentText(event.target.value)} /></label> : null}<label>ملاحظة إضافية اختيارية<input value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="report-preview"><strong>ملخص قبل الإرسال</strong><p>البرنامج: {({ completed: "كامل", partial: "جزئي", not_completed: "لم ينجز" })[program]} · الحضور: {present} · الغياب: {absent} · التأخر: {late}</p></div><Button loading={busy} disabled={incident && incidentText.trim().length < 3} onClick={() => void submit()}><Send size={18} />اعتماد وإرسال للإدارة</Button></section>;
}

function ReportChoice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string }> }) { return <fieldset><legend>{label}</legend><div className="choice-row">{options.map((item) => <button type="button" className={value === item.value ? "is-active" : undefined} key={item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div></fieldset>; }
function formatDuration(seconds: number): string { const minutes = Math.floor(seconds / 60).toString().padStart(2, "0"); return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`; }
function formatDate(value: Date): string { return new Intl.DateTimeFormat("ar-MA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value); }
