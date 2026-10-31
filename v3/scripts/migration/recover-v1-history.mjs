import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index < 0 ? null : process.argv[index + 1];
};
const reportPath = valueAfter("--report") ?? join(process.cwd(), ".artifacts", `legacy-recovery-${apply ? "apply" : "dry-run"}.json`);
const backupDirectory = valueAfter("--backup-dir");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (apply && !backupDirectory) throw new Error("--backup-dir is required with --apply");

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BATCH = "v1-history-20260905";
const SOURCE = "v1-live-supabase";
const LEGACY_TABLES = ["eleves", "profs", "progressions", "devoirs", "messages", "profils_admin", "horaires", "school_classes", "student_admin_profiles", "teacher_admin_profiles", "class_students", "teacher_classes", "school_messages", "admin_audit_logs"];
const TARGET_TABLES = ["profiles", "student_profiles", "teacher_profiles", "student_digital_files", "classes", "class_enrollments", "class_teacher_assignments", "student_surah_progress", "learning_events", "assignments", "course_sessions", "attendance_records", "teacher_session_runs", "teacher_session_students", "teacher_recitations", "teacher_session_reports", "staff_messages", "finance_transactions", "student_payments", "parent_feedback", "legacy_history_records", "legacy_migration_records"];

async function all(table) {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client.from(table).select("*").range(start, start + 999);
    if (error) {
      if (["PGRST205", "42P01"].includes(error.code)) return null;
      throw new Error(`${table}: ${error.code ?? "error"} ${error.message}`);
    }
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function uuid(value) {
  const chars = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20).join("")}`;
}
const fingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalizeLogin = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("fr");
const normalizeArabic = (value) => String(value ?? "").normalize("NFD").replace(/[\u064B-\u065F\u0670]/gu, "").replace(/^سورة\s*/u, "").replace(/[^\u0600-\u06FF]/gu, "");
const iso = (value) => /^\d{4}-\d{2}-\d{2}(?:T|$)/u.test(String(value ?? "")) && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
const dateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/u.test(String(value ?? "")) ? value : null;

async function resolveRole(login, role) {
  const alias = `${role === "student" ? "s" : "t"}_${normalizeLogin(login)}`;
  const { data, error } = await client.rpc("resolve_login_alias", { target_login_alias: alias });
  if (error || !data) return null;
  const id = String(data).split("@")[0];
  return /^[0-9a-f-]{36}$/iu.test(id) ? id : null;
}

async function upsert(table, rows, options = {}) {
  if (!apply || !rows.length) return;
  for (let index = 0; index < rows.length; index += 250) {
    const { error } = await client.from(table).upsert(rows.slice(index, index + 250), options);
    if (error) throw new Error(`${table}: ${error.code ?? "error"} ${error.message} ${error.details ?? ""}`.trim());
  }
}

async function insert(table, rows) {
  if (!apply || !rows.length) return;
  for (let index = 0; index < rows.length; index += 250) {
    const { error } = await client.from(table).insert(rows.slice(index, index + 250));
    if (error && error.code !== "23505") throw new Error(`${table}: ${error.code ?? "error"} ${error.message}`);
  }
}

const legacy = Object.fromEntries(await Promise.all(LEGACY_TABLES.map(async (table) => [table, await all(table)])));
const targetBefore = Object.fromEntries(await Promise.all(TARGET_TABLES.map(async (table) => [table, await all(table)])));
const sourceCounts = Object.fromEntries(Object.entries(legacy).map(([table, rows]) => [table, rows?.length ?? 0]));
const beforeCounts = Object.fromEntries(Object.entries(targetBefore).map(([table, rows]) => [table, rows?.length ?? 0]));

if (backupDirectory) {
  await mkdir(backupDirectory, { recursive: true });
  const manifest = { createdAt: new Date().toISOString(), source: {}, targets: {} };
  for (const [scope, collection] of [["source", legacy], ["targets", targetBefore]]) {
    for (const [table, rows] of Object.entries(collection)) {
      if (rows === null) continue;
      const safeRows = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([name]) => !/password|token|secret/iu.test(name))));
      const body = `${JSON.stringify(safeRows, null, 2)}\n`;
      const file = `${scope}-${table}.json`;
      await writeFile(join(backupDirectory, file), body, "utf8");
      manifest[scope][table] = { rows: safeRows.length, sha256: createHash("sha256").update(body).digest("hex"), file };
    }
  }
  await writeFile(join(backupDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

const students = new Map();
const teachers = new Map();
for (const row of legacy.eleves ?? []) students.set(normalizeLogin(row.username), await resolveRole(row.username, "student"));
for (const row of legacy.profs ?? []) teachers.set(normalizeLogin(row.username), await resolveRole(row.username, "teacher"));
const directionId = (targetBefore.user_roles ?? []).find((row) => row.role === "direction")?.user_id
  ?? (await all("user_roles"))?.find((row) => row.role === "direction")?.user_id;
if (!directionId) throw new Error("Direction account not found");
const memberships = await all("school_memberships");
const schoolId = memberships?.find((row) => row.user_id === directionId && row.status === "active")?.school_id;
if (!schoolId) throw new Error("Direction school not found");

const classByTeacher = new Map();
const classAssignments = targetBefore.class_teacher_assignments ?? [];
for (const row of legacy.profs ?? []) {
  const teacherId = teachers.get(normalizeLogin(row.username));
  const active = classAssignments.find((item) => item.teacher_id === teacherId && item.status === "active");
  if (teacherId && active) classByTeacher.set(normalizeLogin(row.username), active.class_id);
}
const enrollmentByStudent = new Map((targetBefore.class_enrollments ?? []).filter((row) => row.status === "active").map((row) => [row.student_id, row.class_id]));
const quran = await all("quran_surahs");
const surahMap = new Map();
for (const row of quran ?? []) {
  for (const value of [row.slug, row.name_arabic, String(row.number), `surah-${row.slug}`]) if (value) surahMap.set(normalizeArabic(value) || normalizeLogin(value).replace(/^surah-/u, ""), row);
}
function surah(value) {
  const raw = normalizeLogin(value).replace(/\.html$/u, "").replace(/^surah-/u, "");
  return surahMap.get(normalizeArabic(value)) ?? surahMap.get(raw) ?? null;
}
function payload(row, prefix) {
  if (!String(row.text ?? "").startsWith(prefix)) return null;
  try { return JSON.parse(String(row.text).slice(prefix.length)); } catch { return null; }
}
function appreciation(value) {
  const normalized = normalizeArabic(value);
  if (normalized === normalizeArabic("ممتاز")) return "excellent";
  if (normalized === normalizeArabic("جيد جدا")) return "very_good";
  if (normalized === normalizeArabic("جيد")) return "good";
  if (normalized === normalizeArabic("يحتاج مراجعة")) return "needs_review";
  if (normalized === normalizeArabic("غير متقن")) return "insufficient";
  return null;
}

const messages = legacy.messages ?? [];
const sessions = messages.map((row) => ({ row, data: payload(row, "[CLASS_SESSION] ") })).filter(({ data }) => data);
const notes = messages.map((row) => ({ row, data: payload(row, "[TEACHER_NOTE] ") })).filter(({ data }) => data);
const signals = messages.map((row) => ({ row, data: payload(row, "[SIGNAL_ADMIN] ") })).filter(({ data }) => data);
const virtual = messages.map((row) => ({ row, data: payload(row, "[VIRTUAL_TEACHER_RECITATION] ") })).filter(({ data }) => data);
const finances = messages.map((row) => ({ row, data: payload(row, "[ADMIN_FINANCE] ") })).filter(({ data }) => data);
const direct = messages.filter((row) => !String(row.username ?? "").startsWith("__"));
const remote = messages.filter((row) => /^__remote_/u.test(String(row.username ?? "")));
const handledMessageIds = new Set([...sessions, ...notes, ...signals, ...virtual, ...finances].map(({ row }) => row.id));
const unhandledSpecial = messages.filter((row) => String(row.username ?? "").startsWith("__") && !handledMessageIds.has(row.id) && !/^__remote_/u.test(String(row.username ?? "")));

const courseRows = [];
const runRows = [];
const sessionStudentRows = [];
const attendanceRows = [];
const reportRows = [];
const runByLegacySession = new Map();
const review = [];

for (const { row, data } of sessions) {
  const teacherId = teachers.get(normalizeLogin(data.profId ?? String(row.username).split(":").at(-1)));
  const classId = classByTeacher.get(normalizeLogin(data.profId ?? String(row.username).split(":").at(-1)));
  const occurred = iso(data.startedAt) ?? iso(data.date) ?? iso(data.savedAt);
  if (!teacherId || !classId || !occurred) { review.push({ type: "session", id: row.id, reason: "unmapped_relationship_or_date" }); continue; }
  const courseId = uuid(`${SOURCE}:course_session:${row.id}`);
  const runId = uuid(`${SOURCE}:teacher_session_run:${row.id}`);
  const ended = iso(data.endedAt) ?? iso(data.savedAt) ?? occurred;
  courseRows.push({ id: courseId, class_id: classId, teacher_id: teacherId, starts_at: occurred, ends_at: ended, title: "حصة تاريخية", status: "completed", created_at: occurred });
  runRows.push({ id: runId, course_session_id: courseId, class_id: classId, teacher_id: teacherId, status: "completed", started_at: occurred, ended_at: ended, created_at: occurred });
  for (const candidate of [data.id, ...(data.validations ?? []).map((item) => item.sessionId)].filter(Boolean)) runByLegacySession.set(String(candidate), runId);
  const statuses = [[data.present, "present"], [data.absent, "absent"]];
  for (const [list, status] of statuses) for (const value of Array.isArray(list) ? list : []) {
    const login = typeof value === "string" ? value : value?.username ?? value?.studentId;
    const studentId = students.get(normalizeLogin(login));
    if (!studentId) { review.push({ type: "attendance", id: `${row.id}:${login}`, reason: "student_unmapped" }); continue; }
    sessionStudentRows.push({ run_id: runId, student_id: studentId, attendance: status, minutes_late: 0, updated_at: ended });
    attendanceRows.push({ id: uuid(`${SOURCE}:attendance:${row.id}:${studentId}`), session_id: courseId, student_id: studentId, status, minutes_late: 0, recorded_by: teacherId, recorded_at: ended });
  }
  reportRows.push({ id: uuid(`${SOURCE}:session_report:${row.id}`), run_id: runId, teacher_id: teacherId, class_id: classId, status: "submitted", program_status: (data.validations ?? []).length ? "completed" : "not_completed", present_count: Array.isArray(data.present) ? data.present.length : 0, absent_count: Array.isArray(data.absent) ? data.absent.length : 0, late_count: 0, difficulty_flags: [], follow_up_students: [], incident: Array.isArray(data.alerts) && data.alerts.length > 0, incident_summary: Array.isArray(data.alerts) && data.alerts.length ? data.alerts.map(String).join(" | ").slice(0, 2000) : null, optional_note: null, submitted_at: ended, created_at: occurred, updated_at: ended });
}

const recitationCandidates = notes.map(({ row, data }) => ({ legacyId: `note:${row.id}`, data, row }));
for (const { row, data } of sessions) for (const [index, item] of (data.validations ?? []).entries()) recitationCandidates.push({ legacyId: `session:${row.id}:validation:${index}`, data: { ...item, profId: data.profId, sessionId: item.sessionId ?? data.id, savedAt: item.savedAt ?? data.savedAt }, row });
const recitationRows = [];
const recitationKeys = new Set();
for (const item of recitationCandidates) {
  const data = item.data;
  const studentId = students.get(normalizeLogin(data.studentId ?? data.username));
  const teacherId = teachers.get(normalizeLogin(data.profId));
  const surahRow = surah(data.surah);
  const recordedAt = iso(data.savedAt) ?? iso(data.date);
  const grade = appreciation(data.validation);
  if (!studentId || !teacherId || !surahRow || !recordedAt || !grade) { review.push({ type: "recitation", id: item.legacyId, reason: "unmapped_field" }); continue; }
  const identity = [studentId, teacherId, surahRow.number, data.ayahStart ?? 1, data.ayahEnd ?? surahRow.verse_count, grade, recordedAt.slice(0, 10)];
  const signature = fingerprint(identity);
  if (recitationKeys.has(signature)) continue;
  recitationKeys.add(signature);
  let runId = data.sessionId ? runByLegacySession.get(String(data.sessionId)) : null;
  if (!runId) {
    const day = recordedAt.slice(0, 10);
    const classId = enrollmentByStudent.get(studentId) ?? classByTeacher.get(normalizeLogin(data.profId));
    if (!classId) { review.push({ type: "recitation", id: item.legacyId, reason: "class_unmapped" }); continue; }
    const syntheticKey = `${teacherId}:${day}`;
    runId = runByLegacySession.get(syntheticKey);
    if (!runId) {
      const courseId = uuid(`${SOURCE}:standalone-course:${syntheticKey}`);
      runId = uuid(`${SOURCE}:standalone-run:${syntheticKey}`);
      courseRows.push({ id: courseId, class_id: classId, teacher_id: teacherId, starts_at: recordedAt, ends_at: recordedAt, title: "قراءات تاريخية", status: "completed", created_at: recordedAt });
      runRows.push({ id: runId, course_session_id: courseId, class_id: classId, teacher_id: teacherId, status: "completed", started_at: recordedAt, ended_at: recordedAt, created_at: recordedAt });
      runByLegacySession.set(syntheticKey, runId);
    }
  }
  recitationRows.push({ id: uuid(`${SOURCE}:recitation:${signature}`), run_id: runId, student_id: studentId, surah_number: surahRow.number, verse_from: Number(data.ayahStart) || 1, verse_to: Number(data.ayahEnd) || surahRow.verse_count, appreciation: grade, comment: String(data.comment ?? "").trim() || null, recorded_by: teacherId, recorded_at: recordedAt });
}

const learningRows = [];
for (const [index, row] of (legacy.progressions ?? []).entries()) {
  const studentId = students.get(normalizeLogin(row.username));
  const surahRow = surah(row.surah_id);
  if (!studentId || !surahRow) { review.push({ type: "progression", id: `${row.username}:${row.surah_id}`, reason: "unmapped" }); continue; }
  for (const [activity, entry] of Object.entries(row.activities ?? {})) {
    const occurred = iso(entry?.date);
    if (!occurred) { review.push({ type: "learning_activity", id: `${index}:${activity}`, reason: "date_missing" }); continue; }
    const sourceKey = `${SOURCE}:progressions:${row.username}:${row.surah_id}:${activity}`;
    learningRows.push({ student_id: studentId, event_kind: "v1_imported", surah_number: surahRow.number, metadata: { activity, score: Number(entry?.score) || 0, legacy_source: SOURCE }, occurred_at: occurred, legacy_source_key: sourceKey });
  }
  const completed = iso(row.completed_at);
  if (completed) learningRows.push({ student_id: studentId, event_kind: "surah_completed", surah_number: surahRow.number, metadata: { legacy_source: SOURCE, global_score: Number(row.global_score) || 0 }, occurred_at: completed, legacy_source_key: `${SOURCE}:progressions:${row.username}:${row.surah_id}:completed` });
}

const staffRows = [];
for (const { row, data } of signals) {
  const teacherId = teachers.get(normalizeLogin(data.profId));
  const created = iso(data.sentAt);
  if (!teacherId || !created) { review.push({ type: "teacher_report", id: row.id, reason: "unmapped" }); continue; }
  staffRows.push({ id: uuid(`${SOURCE}:staff_message:${row.id}`), school_id: schoolId, sender_id: teacherId, recipient_id: directionId, subject: String(data.category ?? "تقرير تاريخي"), body: String(data.text ?? ""), created_at: created });
}

const financeRows = [];
for (const { row, data } of finances) {
  const occurred = dateOnly(data.operationDate);
  const amount = Number(data.amount);
  if (!occurred || !(amount > 0)) { review.push({ type: "finance", id: row.id, reason: "invalid_date_or_amount" }); continue; }
  financeRows.push({ id: uuid(`${SOURCE}:finance:${row.id}`), school_id: schoolId, direction: data.type === "expense" ? "expense" : "income", category: String(data.type ?? "legacy"), amount, currency: "MAD", occurred_on: occurred, description: [data.label, data.note].filter(Boolean).join(" — ") || null, created_by: directionId, source_type: "legacy_v1", source_id: uuid(`${SOURCE}:finance-source:${row.id}`), reference_code: `v1-finance:${row.id}` });
}

const archiveRows = [];
for (const row of direct) {
  const studentId = students.get(normalizeLogin(row.username));
  if (!studentId) { review.push({ type: "student_message", id: row.id, reason: "student_unmapped" }); continue; }
  archiveRows.push({ id: uuid(`${SOURCE}:history:message:${row.id}`), school_id: schoolId, source_name: SOURCE, legacy_id: String(row.id), category: "student_message", subject_id: studentId, actor_id: directionId, class_id: enrollmentByStudent.get(studentId) ?? null, occurred_at: null, historical_date_label: String(row.date ?? "").trim() || null, title: "رسالة إدارية تاريخية", body: String(row.text ?? ""), metadata: { chronology: "year_missing" } });
}
for (const row of legacy.profils_admin ?? []) {
  const studentId = students.get(normalizeLogin(row.username));
  if (!studentId) continue;
  archiveRows.push({ id: uuid(`${SOURCE}:history:admin:${row.username}`), school_id: schoolId, source_name: SOURCE, legacy_id: String(row.username), category: "student_admin_snapshot", subject_id: studentId, actor_id: directionId, class_id: enrollmentByStudent.get(studentId) ?? null, occurred_at: null, historical_date_label: null, title: "ملف إداري تاريخي", body: null, metadata: { cin_provided: Boolean(row.cin_provided), birth_cert_provided: Boolean(row.birth_cert_provided) } });
  for (const [index, payment] of (Array.isArray(row.payments) ? row.payments : []).entries()) archiveRows.push({ id: uuid(`${SOURCE}:history:payment:${row.username}:${index}`), school_id: schoolId, source_name: SOURCE, legacy_id: `${row.username}:${index}`, category: "student_payment_snapshot", subject_id: studentId, actor_id: directionId, class_id: enrollmentByStudent.get(studentId) ?? null, occurred_at: null, historical_date_label: String(payment.month ?? "").trim() || null, title: "حالة أداء تاريخية", body: null, metadata: { status: payment.status ?? null, amount: Number.isFinite(Number(payment.amount)) ? Number(payment.amount) : null, chronology: "year_missing" } });
}

const existingStudentFiles = new Map((targetBefore.student_digital_files ?? []).map((row) => [row.student_id, row]));
const studentFileRows = [];
for (const row of legacy.profils_admin ?? []) {
  const studentId = students.get(normalizeLogin(row.username));
  if (!studentId) continue;
  const current = existingStudentFiles.get(studentId);
  studentFileRows.push({
    student_id: studentId,
    school_id: schoolId,
    guardian_name: current?.guardian_name ?? null,
    guardian_phone: current?.guardian_phone ?? null,
    monthly_fee: Number(current?.monthly_fee ?? 0),
    payment_required: Boolean(current?.payment_required),
    identity_document_received: Boolean(current?.identity_document_received || row.cin_provided),
    birth_certificate_received: Boolean(current?.birth_certificate_received || row.birth_cert_provided),
    guardian_identity_received: Boolean(current?.guardian_identity_received),
    medical_or_accessibility_notes: current?.medical_or_accessibility_notes ?? null,
    administrative_notes: current?.administrative_notes ?? null,
    updated_by: current?.updated_by ?? directionId,
    guardian_email: current?.guardian_email ?? null,
    guardian_identity_number: current?.guardian_identity_number ?? null,
    secondary_contact: current?.secondary_contact ?? null,
  });
}
for (const row of legacy.horaires ?? []) {
  const studentId = students.get(normalizeLogin(row.username));
  if (!studentId) continue;
  archiveRows.push({ id: uuid(`${SOURCE}:history:schedule:${row.username}`), school_id: schoolId, source_name: SOURCE, legacy_id: String(row.username), category: "schedule_snapshot", subject_id: studentId, actor_id: directionId, class_id: enrollmentByStudent.get(studentId) ?? null, occurred_at: null, historical_date_label: null, title: "توقيت تاريخي", body: String(row.schedule_text ?? ""), metadata: {} });
}
for (const row of remote) {
  const category = String(row.username).startsWith("__remote_class__") ? "remote_class" : String(row.username).startsWith("__remote_attendance__") ? "remote_attendance" : "remote_status";
  const prefixes = { remote_class: "[REMOTE_CLASS] ", remote_attendance: "[REMOTE_CLASS_ATTENDANCE] ", remote_status: "[REMOTE_CLASS_STATUS] " };
  const data = payload(row, prefixes[category]);
  if (!data) continue;
  const occurred = iso(data.createdAt) ?? iso(data.joinedAt) ?? iso(data.at);
  archiveRows.push({ id: uuid(`${SOURCE}:history:remote:${row.id}`), school_id: schoolId, source_name: SOURCE, legacy_id: String(row.id), category, subject_id: students.get(normalizeLogin(data.username)) ?? null, actor_id: teachers.get(normalizeLogin(data.profId ?? data.by)) ?? directionId, class_id: null, occurred_at: occurred, historical_date_label: String(row.date ?? "").trim() || null, title: "حصة عن بعد تاريخية", body: null, metadata: data });
}
for (const row of unhandledSpecial) archiveRows.push({
  id: uuid(`${SOURCE}:history:unmapped:${row.id}`), school_id: schoolId, source_name: SOURCE,
  legacy_id: String(row.id), category: "unmapped_record", subject_id: null, actor_id: directionId,
  class_id: null, occurred_at: null, historical_date_label: String(row.date ?? "").trim() || null,
  title: "سجل تاريخي غير مصنف", body: String(row.text ?? ""), metadata: { legacy_username: String(row.username ?? "") },
});

const recitationAttemptRows = [];
const recitationResultRows = [];
for (const { row, data } of virtual) {
  const studentId = students.get(normalizeLogin(data.studentId));
  const surahRow = surah(data.surahId ?? data.surahName);
  const occurred = iso(data.createdAt);
  if (!studentId || !surahRow || !occurred) { review.push({ type: "virtual_recitation", id: row.id, reason: "unmapped" }); continue; }
  const attemptId = uuid(`${SOURCE}:virtual-recitation:${row.id}`);
  const legacyScore = Number(data.score) || 0;
  recitationAttemptRows.push({ id: attemptId, student_id: studentId, surah_number: surahRow.number, verse_from: 1, verse_to: surahRow.verse_count, status: "completed", asr_engine: String(data.engineVersion ?? "v1"), started_at: occurred, completed_at: occurred });
  recitationResultRows.push({ attempt_id: attemptId, memorization_score: Math.max(0, Math.min(10, legacyScore > 10 ? legacyScore / 10 : legacyScore)), matched_words: Math.max(0, Number(data.masteredVerses) || 0), expected_words: Math.max(0, Number(data.totalVerses) || 0), is_conclusive: true, recommendation: String(data.appreciation ?? "").trim() || null, acoustic_tajwid_status: "not_evaluated", analysed_at: occurred });
}

const existingLegacyKeys = new Set((targetBefore.learning_events ?? []).map((row) => row.legacy_source_key).filter(Boolean));
const planned = {
  sessions: courseRows.length,
  sessionStudents: new Map(sessionStudentRows.map((row) => [`${row.run_id}:${row.student_id}`, row])).size,
  reports: reportRows.length,
  recitations: recitationRows.length,
  learningEvents: learningRows.filter((row) => !existingLegacyKeys.has(row.legacy_source_key)).length,
  staffMessages: staffRows.length,
  finance: financeRows.length,
  virtualRecitations: recitationAttemptRows.length,
  archivedRecords: archiveRows.length,
};

if (apply) {
  await upsert("course_sessions", [...new Map(courseRows.map((row) => [row.id, row])).values()], { onConflict: "id" });
  await upsert("teacher_session_runs", [...new Map(runRows.map((row) => [row.id, row])).values()], { onConflict: "id" });
  await upsert("teacher_session_students", [...new Map(sessionStudentRows.map((row) => [`${row.run_id}:${row.student_id}`, row])).values()], { onConflict: "run_id,student_id" });
  await upsert("attendance_records", [...new Map(attendanceRows.map((row) => [row.id, row])).values()], { onConflict: "id" });
  await upsert("teacher_recitations", recitationRows, { onConflict: "id" });
  await upsert("teacher_session_reports", reportRows, { onConflict: "id" });
  await upsert("staff_messages", staffRows, { onConflict: "id" });
  await upsert("finance_transactions", financeRows, { onConflict: "id" });
  await upsert("student_digital_files", studentFileRows, { onConflict: "student_id" });
  await upsert("recitation_attempts", recitationAttemptRows, { onConflict: "id" });
  await upsert("recitation_results", recitationResultRows, { onConflict: "attempt_id" });
  await upsert("legacy_history_records", archiveRows, { onConflict: "source_name,legacy_id,category" });
  await insert("learning_events", learningRows.filter((row) => !existingLegacyKeys.has(row.legacy_source_key)));

  const historicalFeedback = (targetBefore.parent_feedback ?? []).filter((row) => row.date_soumission && !row.student_id);
  for (const row of historicalFeedback) {
    const { error } = await client.from("parent_feedback").update({ school_id: schoolId, created_at: row.date_soumission }).eq("id", row.id);
    if (error) throw new Error(`parent_feedback: ${error.code ?? "error"} ${error.message}`);
  }

  const beforeIds = (table, field = "id") => new Set((targetBefore[table] ?? []).map((row) => String(row[field])));
  const ledger = [];
  const addLedger = (sourceTable, legacyId, targetTable, targetId, sourceRow, disposition = null) => ledger.push({
    batch_key: BATCH, source_name: SOURCE, source_table: sourceTable, legacy_id: String(legacyId),
    target_table: targetTable, target_id: targetId ? String(targetId) : null, fingerprint: fingerprint(sourceRow),
    disposition: disposition ?? (beforeIds(targetTable).has(String(targetId)) ? "already_present" : "restored"), detail: {},
  });
  for (const row of legacy.eleves ?? []) {
    const id = students.get(normalizeLogin(row.username));
    addLedger("eleves", row.username, id ? "profiles" : "none", id, { ...row, password: undefined }, id ? "already_present" : "insufficient_source");
  }
  for (const row of legacy.profs ?? []) {
    const id = teachers.get(normalizeLogin(row.username));
    addLedger("profs", row.username, id ? "profiles" : "none", id, { ...row, password: undefined }, id ? "already_present" : "insufficient_source");
  }
  for (const row of legacy.progressions ?? []) {
    const studentId = students.get(normalizeLogin(row.username));
    const surahRow = surah(row.surah_id);
    const id = studentId && surahRow ? `${studentId}:${surahRow.number}` : null;
    addLedger("progressions", `${row.username}:${row.surah_id}`, id ? "student_surah_progress" : "none", id, row, id ? "already_present" : "insufficient_source");
  }
  for (const row of legacy.devoirs ?? []) {
    const id = uuid(`v1:assignment:${row.id}`);
    addLedger("devoirs", row.id, "assignments", id, row, beforeIds("assignments").has(id) ? "already_present" : "ambiguous");
  }
  for (const row of learningRows) addLedger("progression_activities", row.legacy_source_key, "learning_events", row.legacy_source_key, row, "restored");
  for (const row of courseRows) addLedger("messages", `session:${row.id}`, "course_sessions", row.id, row, "restored");
  for (const row of recitationRows) addLedger("messages", `recitation:${row.id}`, "teacher_recitations", row.id, row, "restored");
  for (const row of reportRows) addLedger("messages", `report:${row.id}`, "teacher_session_reports", row.id, row, "restored");
  for (const row of staffRows) addLedger("messages", `staff:${row.id}`, "staff_messages", row.id, row, "restored");
  for (const row of financeRows) addLedger("messages", `finance:${row.id}`, "finance_transactions", row.id, row, "restored");
  for (const row of recitationAttemptRows) addLedger("messages", `virtual:${row.id}`, "recitation_attempts", row.id, row, "restored");
  for (const row of archiveRows) addLedger("legacy_archive", `${row.category}:${row.legacy_id}`, "legacy_history_records", row.id, row, "restored");
  await upsert("legacy_migration_records", ledger, { onConflict: "source_name,source_table,legacy_id,target_table" });
}

const targetAfter = Object.fromEntries(await Promise.all(TARGET_TABLES.map(async (table) => [table, await all(table)])));
const afterCounts = Object.fromEntries(Object.entries(targetAfter).map(([table, rows]) => [table, rows?.length ?? 0]));
const unmappedStudents = [...students.values()].filter((value) => !value).length;
const unmappedTeachers = [...teachers.values()].filter((value) => !value).length;
const report = { mode: apply ? "apply" : "dry-run", batch: BATCH, source: SOURCE, sourceCounts, beforeCounts, afterCounts, mappings: { students: students.size, teachers: teachers.size, unmappedStudents, unmappedTeachers }, planned, reviewCount: review.length, review, backupDirectory, completedAt: new Date().toISOString() };
await mkdir(join(reportPath, ".."), { recursive: true }).catch(() => {});
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ mode: report.mode, sourceCounts, mappings: report.mappings, planned, reviewCount: review.length, reportPath }));
