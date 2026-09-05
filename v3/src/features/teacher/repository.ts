import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/observability/logger";
import type { TeacherHomeData, TeacherProfessionalData, TeacherSessionData } from "./models";

const emptyHome: TeacherHomeData = { teacher: null, classes: [], students: [], schedule: [], nextCourse: null, openRun: null, messages: [], requests: [], alerts: [], assignmentReminders: [], taskCount: 0 };

export async function getTeacherHome(): Promise<TeacherHomeData> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return emptyHome;
  try {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    const teacherId = auth.user?.id;
    if (!teacherId) return emptyHome;
    const [profile, role, assignments, courses, messages, requests, alerts, openRun] = await Promise.all([
      client.from("profiles").select("id,display_name,status").eq("id", teacherId).maybeSingle(),
      client.from("user_roles").select("role").eq("user_id", teacherId).eq("role", "teacher").maybeSingle(),
      client.from("class_teacher_assignments").select("class_id").eq("teacher_id", teacherId).eq("status", "active"),
      client.from("course_sessions").select("id,class_id,title,starts_at,ends_at,location,status").eq("teacher_id", teacherId).order("starts_at").limit(30),
      client.from("staff_messages").select("id,subject,body,sender_id,read_at,created_at").eq("recipient_id", teacherId).order("created_at", { ascending: false }).limit(12),
      client.from("teacher_requests").select("id,kind,title,details,status,starts_on,ends_on,admin_response,submitted_at").eq("teacher_id", teacherId).order("submitted_at", { ascending: false }).limit(20),
      client.from("user_notifications").select("id,title,body,read_at,created_at").eq("user_id", teacherId).order("created_at", { ascending: false }).limit(10),
      client.from("teacher_session_runs").select("id,course_session_id,class_id,status,started_at").eq("teacher_id", teacherId).in("status", ["in_progress", "report_pending"]).limit(1).maybeSingle(),
    ]);
    if (!profile.data || profile.data.status !== "active" || !role.data) return emptyHome;
    const teacherName = profile.data.display_name;
    const classIds = (assignments.data ?? []).map(({ class_id }) => class_id);
    const [classRows, enrollmentRows] = classIds.length ? await Promise.all([
      client.from("classes").select("id,name,level").in("id", classIds),
      client.from("class_enrollments").select("class_id,student_id").in("class_id", classIds).eq("status", "active"),
    ]) : [{ data: [] }, { data: [] }];
    const enrollments = enrollmentRows.data ?? [];
    const studentIds = enrollments.map(({ student_id }) => student_id);
    const [studentProfiles, progressRows, attendanceRows, assignmentRows, submissionRows, recitationRows, noteRows] = studentIds.length ? await Promise.all([
      client.from("profiles").select("id,display_name").in("id", studentIds),
      client.from("student_surah_progress").select("student_id,surah_number,status,completion_percent,mastered_at,last_activity_at").in("student_id", studentIds).order("last_activity_at", { ascending: false }),
      client.from("attendance_records").select("id,student_id,status,minutes_late,recorded_at").in("student_id", studentIds).order("recorded_at", { ascending: false }),
      client.from("assignments").select("id,class_id,student_id,surah_number,verse_from,verse_to,due_at").eq("teacher_id", teacherId).order("due_at", { ascending: true }),
      client.from("assignment_submissions").select("assignment_id,student_id,status").in("student_id", studentIds),
      client.from("teacher_recitations").select("id,student_id,surah_number,verse_from,verse_to,appreciation,comment,recorded_at").eq("recorded_by", teacherId).in("student_id", studentIds).order("recorded_at", { ascending: false }).limit(500),
      client.from("teacher_student_notes").select("id,student_id,content,created_at").eq("teacher_id", teacherId).in("student_id", studentIds).order("created_at", { ascending: false }).limit(500),
    ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
    const classNames = new Map((classRows.data ?? []).map((row) => [row.id, row.name]));
    const names = new Map((studentProfiles.data ?? []).map((row) => [row.id, row.display_name]));
    const latestProgress = new Map<string, { surah_number: number; completion_percent: number }>();
    for (const row of progressRows.data ?? []) if (!latestProgress.has(row.student_id)) latestProgress.set(row.student_id, row);
    const absenceCounts = countBy((attendanceRows.data ?? []).filter(({ status }) => status === "absent").map(({ student_id }) => student_id));
    const lateCounts = countBy((attendanceRows.data ?? []).filter(({ status }) => status === "late").map(({ student_id }) => student_id));
    const pendingRows = (submissionRows.data ?? []).filter(({ status }) => status === "todo" || status === "in_progress");
    const pendingCounts = countBy(pendingRows.map(({ student_id }) => student_id));
    const submissionStatus = new Map((submissionRows.data ?? []).map((row) => [`${row.assignment_id}:${row.student_id}`, row.status]));
    const students = enrollments.map((entry) => {
      const progress = latestProgress.get(entry.student_id);
      const absences = absenceCounts.get(entry.student_id) ?? 0;
      const pending = pendingCounts.get(entry.student_id) ?? 0;
      const studentAssignments = (assignmentRows.data ?? []).filter((item) => item.student_id === entry.student_id || item.class_id === entry.class_id);
      return {
        id: entry.student_id, name: names.get(entry.student_id) ?? "طالب", classId: entry.class_id, className: classNames.get(entry.class_id) ?? "القسم",
        lastSurahNumber: progress?.surah_number ?? null, lastProgressPercent: progress?.completion_percent ?? 0,
        absenceCount: absences, lateCount: lateCounts.get(entry.student_id) ?? 0, pendingAssignments: pending,
        suggestion: suggestionFor(absences, pending, progress?.completion_percent ?? 0),
        masteredSurahs: (progressRows.data ?? []).filter((item) => item.student_id === entry.student_id && item.status === "mastered").map((item) => ({ surahNumber: item.surah_number, masteredAt: item.mastered_at })),
        attendanceHistory: (attendanceRows.data ?? []).filter((item) => item.student_id === entry.student_id).map((item) => ({ id: item.id, status: item.status, minutesLate: item.minutes_late, recordedAt: item.recorded_at })),
        recitations: (recitationRows.data ?? []).filter((item) => item.student_id === entry.student_id).map((item) => ({ id: item.id, surahNumber: item.surah_number, verseFrom: item.verse_from, verseTo: item.verse_to, appreciation: item.appreciation, comment: item.comment, recordedAt: item.recorded_at })),
        notes: (noteRows.data ?? []).filter((item) => item.student_id === entry.student_id).map((item) => ({ id: item.id, content: item.content, teacherName, createdAt: item.created_at })),
        assignments: studentAssignments.map((item) => ({ id: item.id, surahNumber: item.surah_number, verseFrom: item.verse_from, verseTo: item.verse_to, dueAt: item.due_at, status: submissionStatus.get(`${item.id}:${entry.student_id}`) ?? "todo" })),
      };
    });
    const classStudentCounts = countBy(enrollments.map(({ class_id }) => class_id));
    const classes = (classRows.data ?? []).map((row) => ({ id: row.id, name: row.name, level: row.level, studentCount: classStudentCounts.get(row.id) ?? 0 }));
    const schedule = (courses.data ?? []).map((course) => ({ id: course.id, classId: course.class_id, className: classNames.get(course.class_id) ?? "القسم", title: course.title, startsAt: course.starts_at, endsAt: course.ends_at, location: course.location, status: course.status }));
    const now = Date.now();
    const reminders = (assignmentRows.data ?? []).flatMap((item) => {
      if (!item.due_at || new Date(item.due_at).getTime() > now + 3 * 86400000) return [];
      const targets = item.student_id ? students.filter(({ id }) => id === item.student_id) : students.filter(({ classId }) => classId === item.class_id);
      return targets.filter((target) => ["todo", "in_progress"].includes(submissionStatus.get(`${item.id}:${target.id}`) ?? "todo")).map((target) => ({ id: `${item.id}:${target.id}`, studentId: target.id, studentName: target.name, surahNumber: item.surah_number, verseFrom: item.verse_from, verseTo: item.verse_to, dueAt: item.due_at! }));
    }).slice(0, 8);
    return {
      teacher: { id: profile.data.id, name: profile.data.display_name }, classes, students, schedule,
      nextCourse: schedule.find((course) => course.status === "scheduled" && new Date(course.endsAt).getTime() >= now) ?? null,
      openRun: openRun.data ? { id: openRun.data.id, courseSessionId: openRun.data.course_session_id, classId: openRun.data.class_id, status: openRun.data.status, startedAt: openRun.data.started_at } : null,
      messages: (messages.data ?? []).map((row) => ({ id: row.id, subject: row.subject, body: row.body, senderId: row.sender_id, read: Boolean(row.read_at), createdAt: row.created_at })),
      requests: (requests.data ?? []).map((row) => ({ id: row.id, kind: row.kind, title: row.title, details: row.details, status: row.status, startsOn: row.starts_on, endsOn: row.ends_on, adminResponse: row.admin_response, submittedAt: row.submitted_at })),
      alerts: (alerts.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, read: Boolean(row.read_at), createdAt: row.created_at })),
      assignmentReminders: reminders,
      taskCount: (submissionRows.data ?? []).length + (assignmentRows.data ?? []).filter((item) => !item.student_id && !item.class_id).length,
    };
  } catch (error) { logServerError("TEACHER_HOME_LOAD_FAILED", error); return emptyHome; }
}

export async function getTeacherSession(): Promise<TeacherSessionData> {
  const home = await getTeacherHome();
  const defaultDueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const elapsedSeconds = home.openRun ? Math.max(0, Math.floor((Date.now() - new Date(home.openRun.startedAt).getTime()) / 1000)) : 0;
  if (!home.openRun) return { ...home, attendance: [], openReportId: null, elapsedSeconds, defaultDueDate };
  try {
    const client = await createClient();
    const [rows, report] = await Promise.all([
      client.from("teacher_session_students").select("student_id,attendance,minutes_late,processed_at").eq("run_id", home.openRun.id),
      client.from("teacher_session_reports").select("id").eq("run_id", home.openRun.id).eq("status", "draft").maybeSingle(),
    ]);
    return { ...home, attendance: (rows.data ?? []).map((row) => ({ studentId: row.student_id, status: row.attendance, minutesLate: row.minutes_late, processed: Boolean(row.processed_at) })), openReportId: report.data?.id ?? null, elapsedSeconds, defaultDueDate };
  } catch (error) { logServerError("TEACHER_SESSION_LOAD_FAILED", error); return { ...home, attendance: [], openReportId: null, elapsedSeconds, defaultDueDate }; }
}

export async function getTeacherProfessional(): Promise<TeacherProfessionalData> {
  const home = await getTeacherHome();
  if (!home.teacher) return { teacher: null, schedule: [], requests: [], salaries: [], documents: [], reports: [] };
  try {
    const client = await createClient();
    const [salaries, documents, reports] = await Promise.all([
      client.from("teacher_salary_records").select("id,period_month,gross_amount,deductions,net_amount,currency,status,paid_at").eq("teacher_id", home.teacher.id).order("period_month", { ascending: false }),
      client.from("teacher_documents").select("id,title,category,storage_path,visible_from").eq("teacher_id", home.teacher.id).order("visible_from", { ascending: false }),
      client.from("teacher_session_reports").select("id,run_id,status,submitted_at,present_count,absent_count,late_count").eq("teacher_id", home.teacher.id).order("created_at", { ascending: false }).limit(30),
    ]);
    return { teacher: home.teacher, schedule: home.schedule, requests: home.requests,
      salaries: (salaries.data ?? []).map((row) => ({ id: row.id, month: row.period_month, gross: Number(row.gross_amount), deductions: Number(row.deductions), net: Number(row.net_amount), currency: row.currency, status: row.status, paidAt: row.paid_at })),
      documents: (documents.data ?? []).map((row) => ({ id: row.id, title: row.title, category: row.category, storagePath: row.storage_path, visibleFrom: row.visible_from })),
      reports: (reports.data ?? []).map((row) => ({ id: row.id, runId: row.run_id, status: row.status, submittedAt: row.submitted_at, present: row.present_count, absent: row.absent_count, late: row.late_count })),
    };
  } catch (error) { logServerError("TEACHER_PROFESSIONAL_LOAD_FAILED", error); return { teacher: home.teacher, schedule: home.schedule, requests: home.requests, salaries: [], documents: [], reports: [] }; }
}

function countBy(values: readonly string[]): Map<string, number> { const counts = new Map<string, number>(); for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1); return counts; }
function suggestionFor(absences: number, pending: number, progress: number): string { if (absences >= 2) return "ابدأ بسؤال قصير بعد الغياب"; if (pending > 0) return "راجع الواجب قبل التلاوة"; if (progress > 0 && progress < 60) return "ثبّت آخر مقطع قبل الجديد"; return "متابعة المسار المعتاد"; }
