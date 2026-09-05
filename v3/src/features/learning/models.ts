import type { DatabaseAssignmentStatus, DatabaseAttendanceStatus, DatabaseLearningProgressStatus } from "@/types/database";

export type StudentDashboardData = {
  student: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null;
  classroom: { id: string; name: string } | null;
  nextCourse: { id: string; title: string; startsAt: string; endsAt: string; location: string | null } | null;
  courseSchedule: Array<{ id: string; startsAt: string; endsAt: string }>;
  announcements: Array<{ id: string; title: string; body: string; publishedAt: string }>;
  events: Array<{ id: string; title: string; startsAt: string }>;
  assignments: Array<{ id: string; title: string; instructions: string | null; dueAt: string | null; surahNumber: number | null; verseFrom: number | null; verseTo: number | null; status: DatabaseAssignmentStatus }>;
  goal: { id: string; surahNumber: number; verseFrom: number; verseTo: number; targetDate: string | null } | null;
  progress: Array<{ surahNumber: number; status: DatabaseLearningProgressStatus; percent: number; stars: number }>;
  notifications: Array<{ id: string; title: string; body: string; href: string | null; read: boolean; createdAt: string }>;
};

export type FamilyChildSummary = { id: string; name: string };
export type FamilyChildData = {
  child: FamilyChildSummary;
  progress: StudentDashboardData["progress"];
  assignments: StudentDashboardData["assignments"];
  attendance: Array<{ id: string; status: DatabaseAttendanceStatus; minutesLate: number; recordedAt: string }>;
  exams: Array<{ id: string; title: string; score: number | null; appreciation: string | null; completedAt: string | null }>;
  announcements: StudentDashboardData["announcements"];
  messages: Array<{ id: string; title: string; body: string; createdAt: string; read: boolean }>;
  documents: Array<{ id: string; title: string; storagePath: string; createdAt: string }>;
};

export type StudentHistoryData = {
  events: Array<{ id: number; kind: string; surahNumber: number | null; occurredAt: string }>;
  recitations: Array<{ id: string; surahNumber: number; verseFrom: number; verseTo: number; status: string; startedAt: string; score: number | null; conclusive: boolean; recommendation: string | null }>;
  reviews: Array<{ id: string; surahNumber: number; verseFrom: number; verseTo: number; reason: string | null; dueAt: string | null }>;
};
