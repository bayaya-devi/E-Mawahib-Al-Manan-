import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DatabaseAssignmentStatus } from "@/types/database";
import type { FamilyChildData, FamilyChildSummary, StudentDashboardData, StudentHistoryData } from "./models";

const emptyStudent: StudentDashboardData = {
  student: null, teacher: null, nextCourse: null, announcements: [], events: [],
  assignments: [], goal: null, progress: [], notifications: [],
};

export async function getStudentDashboard(): Promise<StudentDashboardData> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return emptyStudent;
  try {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    const studentId = auth.user?.id;
    if (!studentId) return emptyStudent;

    const [profileResult, enrollmentResult, membershipResult, progressResult, goalResult, submissionResult, notificationResult] = await Promise.all([
      client.from("profiles").select("id,display_name").eq("id", studentId).maybeSingle(),
      client.from("class_enrollments").select("class_id").eq("student_id", studentId).eq("status", "active").maybeSingle(),
      client.from("school_memberships").select("school_id").eq("user_id", studentId).eq("status", "active").maybeSingle(),
      client.from("student_surah_progress").select("surah_number,status,completion_percent,stars").eq("student_id", studentId).order("surah_number", { ascending: false }),
      client.from("learning_goals").select("id,surah_number,verse_from,verse_to,target_date").eq("student_id", studentId).is("completed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("assignment_submissions").select("assignment_id,status").eq("student_id", studentId),
      client.from("user_notifications").select("id,title,body,href,read_at,created_at").eq("user_id", studentId).order("created_at", { ascending: false }).limit(8),
    ]);
    const classId = enrollmentResult.data?.class_id;
    const schoolId = membershipResult.data?.school_id;
    const now = new Date().toISOString();
    const [sessionsResult, teacherAssignmentResult, announcementResult, eventResult, assignmentResult] = await Promise.all([
      classId ? client.from("course_sessions").select("id,title,starts_at,ends_at,location").eq("class_id", classId).gte("starts_at", now).eq("status", "scheduled").order("starts_at").limit(1).maybeSingle() : Promise.resolve({ data: null }),
      classId ? client.from("class_teacher_assignments").select("teacher_id").eq("class_id", classId).eq("status", "active").order("assigned_at").limit(1).maybeSingle() : Promise.resolve({ data: null }),
      schoolId ? client.from("school_announcements").select("id,title,body,published_at").eq("school_id", schoolId).order("published_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
      schoolId ? client.from("school_events").select("id,title,starts_at").eq("school_id", schoolId).gte("starts_at", now).order("starts_at").limit(6) : Promise.resolve({ data: [] }),
      schoolId ? client.from("assignments").select("id,title,instructions,due_at,surah_number,class_id,student_id").eq("school_id", schoolId).order("due_at").limit(40) : Promise.resolve({ data: [] }),
    ]);
    const teacherId = teacherAssignmentResult.data?.teacher_id;
    const teacherResult = teacherId ? await client.from("profiles").select("id,display_name").eq("id", teacherId).maybeSingle() : { data: null };
    const submissionStatus = new Map((submissionResult.data ?? []).map((row) => [row.assignment_id, row.status]));
    const assignments = (assignmentResult.data ?? [])
      .filter((row) => row.student_id === studentId || row.class_id === classId)
      .map((row) => ({ id: row.id, title: row.title, instructions: row.instructions, dueAt: row.due_at, surahNumber: row.surah_number, status: submissionStatus.get(row.id) ?? "todo" as DatabaseAssignmentStatus }));

    return {
      student: profileResult.data ? { id: profileResult.data.id, name: profileResult.data.display_name } : null,
      teacher: teacherResult.data ? { id: teacherResult.data.id, name: teacherResult.data.display_name } : null,
      nextCourse: sessionsResult.data ? { id: sessionsResult.data.id, title: sessionsResult.data.title, startsAt: sessionsResult.data.starts_at, endsAt: sessionsResult.data.ends_at, location: sessionsResult.data.location } : null,
      announcements: (announcementResult.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, publishedAt: row.published_at })),
      events: (eventResult.data ?? []).map((row) => ({ id: row.id, title: row.title, startsAt: row.starts_at })),
      assignments,
      goal: goalResult.data ? { id: goalResult.data.id, surahNumber: goalResult.data.surah_number, verseFrom: goalResult.data.verse_from, verseTo: goalResult.data.verse_to, targetDate: goalResult.data.target_date } : null,
      progress: (progressResult.data ?? []).map((row) => ({ surahNumber: row.surah_number, status: row.status, percent: row.completion_percent, stars: row.stars })),
      notifications: (notificationResult.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, href: row.href, read: Boolean(row.read_at), createdAt: row.created_at })),
    };
  } catch {
    return emptyStudent;
  }
}

export async function getFamilyChildren(): Promise<FamilyChildSummary[]> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return [];
  try {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return [];
    const relationships = await client.from("family_relationships").select("student_id").eq("parent_id", auth.user.id).eq("status", "active");
    const ids = (relationships.data ?? []).map(({ student_id }) => student_id);
    if (!ids.length) return [];
    const profiles = await client.from("profiles").select("id,display_name").in("id", ids);
    return (profiles.data ?? []).map((profile) => ({ id: profile.id, name: profile.display_name }));
  } catch {
    return [];
  }
}

export async function getFamilyChild(studentId: string): Promise<FamilyChildData | null> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return null;
  try {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return null;
    const profile = await client.from("profiles").select("id,display_name").eq("id", studentId).maybeSingle();
    if (!profile.data) return null;
    const enrollment = await client.from("class_enrollments").select("class_id").eq("student_id", studentId).eq("status", "active").maybeSingle();
    const assignmentQuery = enrollment.data?.class_id
      ? client.from("assignments").select("id,title,instructions,due_at,surah_number").or(`student_id.eq.${studentId},class_id.eq.${enrollment.data.class_id}`).order("due_at")
      : client.from("assignments").select("id,title,instructions,due_at,surah_number").eq("student_id", studentId).order("due_at");
    const [progress, assignments, submissions, attendance, examResults, announcements, messages, documents] = await Promise.all([
      client.from("student_surah_progress").select("surah_number,status,completion_percent,stars").eq("student_id", studentId).order("surah_number", { ascending: false }),
      assignmentQuery,
      client.from("assignment_submissions").select("assignment_id,status").eq("student_id", studentId),
      client.from("attendance_records").select("id,status,minutes_late,recorded_at").eq("student_id", studentId).order("recorded_at", { ascending: false }).limit(30),
      client.from("exam_results").select("exam_id,score,appreciation,completed_at").eq("student_id", studentId).order("completed_at", { ascending: false }),
      client.from("school_announcements").select("id,title,body,published_at").order("published_at", { ascending: false }).limit(12),
      client.from("user_notifications").select("id,title,body,created_at,read_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(20),
      client.from("authorized_documents").select("id,title,storage_path,created_at").eq("student_id", studentId).eq("visible_to_family", true).order("created_at", { ascending: false }),
    ]);
    const examIds = (examResults.data ?? []).map(({ exam_id }) => exam_id);
    const examRows = examIds.length ? await client.from("exams").select("id,title").in("id", examIds) : { data: [] };
    const examTitles = new Map((examRows.data ?? []).map((exam) => [exam.id, exam.title]));
    const statuses = new Map((submissions.data ?? []).map((row) => [row.assignment_id, row.status]));
    return {
      child: { id: profile.data.id, name: profile.data.display_name },
      progress: (progress.data ?? []).map((row) => ({ surahNumber: row.surah_number, status: row.status, percent: row.completion_percent, stars: row.stars })),
      assignments: (assignments.data ?? []).map((row) => ({ id: row.id, title: row.title, instructions: row.instructions, dueAt: row.due_at, surahNumber: row.surah_number, status: statuses.get(row.id) ?? "todo" })),
      attendance: (attendance.data ?? []).map((row) => ({ id: row.id, status: row.status, minutesLate: row.minutes_late, recordedAt: row.recorded_at })),
      exams: (examResults.data ?? []).map((row) => ({ id: row.exam_id, title: examTitles.get(row.exam_id) ?? "اختبار", score: row.score, appreciation: row.appreciation, completedAt: row.completed_at })),
      announcements: (announcements.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, publishedAt: row.published_at })),
      messages: (messages.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.created_at, read: Boolean(row.read_at) })),
      documents: (documents.data ?? []).map((row) => ({ id: row.id, title: row.title, storagePath: row.storage_path, createdAt: row.created_at })),
    };
  } catch {
    return null;
  }
}

export async function getStudentHistory(): Promise<StudentHistoryData> {
  const empty: StudentHistoryData = { events: [], recitations: [], reviews: [] };
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return empty;
  try {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return empty;
    const studentId = auth.user.id;
    const [events, attempts, reviews] = await Promise.all([
      client.from("learning_events").select("id,event_kind,surah_number,occurred_at").eq("student_id", studentId).order("occurred_at", { ascending: false }).limit(80),
      client.from("recitation_attempts").select("id,surah_number,verse_from,verse_to,status,started_at").eq("student_id", studentId).order("started_at", { ascending: false }).limit(40),
      client.from("review_passages").select("id,surah_number,verse_from,verse_to,reason,due_at").eq("student_id", studentId).is("resolved_at", null).order("due_at"),
    ]);
    const attemptRows = attempts.data ?? [];
    const results = attemptRows.length ? await client.from("recitation_results").select("attempt_id,memorization_score,is_conclusive,recommendation").in("attempt_id", attemptRows.map(({ id }) => id)) : { data: [] };
    const byAttempt = new Map((results.data ?? []).map((result) => [result.attempt_id, result]));
    return {
      events: (events.data ?? []).map((event) => ({ id: event.id, kind: event.event_kind, surahNumber: event.surah_number, occurredAt: event.occurred_at })),
      recitations: attemptRows.map((attempt) => { const result = byAttempt.get(attempt.id); return { id: attempt.id, surahNumber: attempt.surah_number, verseFrom: attempt.verse_from, verseTo: attempt.verse_to, status: attempt.status, startedAt: attempt.started_at, score: result?.memorization_score ?? null, conclusive: result?.is_conclusive ?? false, recommendation: result?.recommendation ?? null }; }),
      reviews: (reviews.data ?? []).map((review) => ({ id: review.id, surahNumber: review.surah_number, verseFrom: review.verse_from, verseTo: review.verse_to, reason: review.reason, dueAt: review.due_at })),
    };
  } catch {
    return empty;
  }
}
